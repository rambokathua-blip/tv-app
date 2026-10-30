"use client";

import React, { useState, useRef } from "react";
import {
  X,
  Upload,
  Camera,
  ImageIcon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  Save,
} from "lucide-react";
import type { Promotion } from "@/lib/signage/types";

interface EditOfferModalProps {
  promo: Promotion;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

async function compressClientImage(
  file: File
): Promise<{ file: File; dataUrl: string; isWide: boolean }> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      resolve({ file, dataUrl: url, isWide: true });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX_WIDTH = 1920;
        const MAX_HEIGHT = 1080;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          const url = URL.createObjectURL(file);
          resolve({ file, dataUrl: url, isWide: true });
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        const ratio = img.width / img.height;
        const isWide = ratio >= 1.6 && ratio <= 1.95;

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File(
                [blob],
                file.name.replace(/\.[^.]+$/, ".jpg"),
                { type: "image/jpeg", lastModified: Date.now() }
              );
              resolve({ file: compressedFile, dataUrl, isWide });
            } else {
              resolve({ file, dataUrl, isWide });
            }
          },
          "image/jpeg",
          0.82
        );
      };
      img.onerror = () => {
        const url = URL.createObjectURL(file);
        resolve({ file, dataUrl: url, isWide: true });
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      const url = URL.createObjectURL(file);
      resolve({ file, dataUrl: url, isWide: true });
    };
    reader.readAsDataURL(file);
  });
}

export default function EditOfferModal({
  promo,
  isOpen,
  onClose,
  onUpdated,
}: EditOfferModalProps) {
  const initialThumb =
    promo.media_id ||
    promo.media?.thumb_path ||
    promo.media?.storage_path ||
    "/kathua-fresh-logo.jpg";

  const [title, setTitle] = useState(promo.title);
  const [priceText, setPriceText] = useState(promo.price_text || "");
  const [durationSec, setDurationSec] = useState(promo.duration_sec || 10);
  const [status, setStatus] = useState(promo.status);
  const [imageUrl, setImageUrl] = useState(initialThumb);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [aspectWarning, setAspectWarning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { file: compressed, dataUrl, isWide } = await compressClientImage(file);
      setImageFile(compressed);
      setImageUrl(dataUrl);
      setAspectWarning(!isWide);
    } catch {
      setImageFile(file);
      setImageUrl(URL.createObjectURL(file));
    } finally {
      e.target.value = "";
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      let finalMediaId = promo.media_id;

      // If user uploaded a new image file
      if (imageFile) {
        try {
          const formData = new FormData();
          formData.append("file", imageFile);
          formData.append("kind", "image");
          const uploadRes = await fetch("/api/signage/admin/media/upload", {
            method: "POST",
            body: formData,
          });
          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            finalMediaId =
              uploadData.public_url ||
              uploadData.storage_path ||
              uploadData.media?.storage_path ||
              uploadData.media?.id ||
              null;
          }
        } catch (uploadErr) {
          console.warn("Upload fallback", uploadErr);
        }

        if (!finalMediaId || finalMediaId.startsWith("blob:")) {
          finalMediaId = imageUrl;
        }
      } else if (imageUrl && imageUrl !== initialThumb && !imageUrl.startsWith("blob:")) {
        finalMediaId = imageUrl;
      }

      // Update the promotion
      const res = await fetch(`/api/signage/admin/promotions/${promo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          price_text: priceText.trim() || null,
          duration_sec: durationSec,
          status,
          enabled: status === "live",
          media_id: finalMediaId,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || "Failed to update offer");
      }

      // Trigger publish so TV updates immediately
      await fetch("/api/signage/admin/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: `Updated offer: ${title.trim()}`,
        }),
      }).catch(() => {});

      onUpdated();
      onClose();
    } catch (err: any) {
      console.error(err);
      setSaveError(err.message || "Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white">Edit Offer Details</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Image & Preview */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-400">
              Offer Image & TV Preview
            </label>
            <div className="relative aspect-video rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={title}
                className="w-full h-full object-cover"
              />

              {/* Price badge mockup */}
              {priceText && (
                <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur-sm border border-emerald-500 px-3 py-1 rounded-xl">
                  <div className="text-[10px] text-emerald-400 font-bold uppercase leading-none">
                    {title}
                  </div>
                  <div className="text-sm font-black text-amber-300">
                    {priceText}
                  </div>
                </div>
              )}

              {/* Top overlay trigger */}
              <div className="relative absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-black/80 hover:bg-black text-white text-xs font-semibold flex items-center gap-1.5 backdrop-blur-sm cursor-pointer border border-white/20 active:scale-95 transition-all shadow-md overflow-hidden">
                <Upload className="w-3.5 h-3.5 text-emerald-400" />
                <span>Change Image</span>
                <input
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                  onChange={handleFileChange}
                />
              </div>
            </div>

            {/* Mobile Prominent Change Picture & Camera Buttons with direct inputs */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="relative py-3 px-3 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md text-center overflow-hidden">
                <Upload className="w-4 h-4 shrink-0" />
                <span>Change Picture</span>
                <input
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                  onChange={handleFileChange}
                />
              </div>
              <div className="relative py-3 px-3 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2 cursor-pointer transition-all text-center overflow-hidden">
                <Camera className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Take New Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                  onChange={handleFileChange}
                />
              </div>
            </div>

            {aspectWarning && (
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-2 text-xs text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Image is not 16:9 aspect ratio. It will fit with letterboxing.</span>
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Offer Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Price */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Price Text (Large on TV screen)
            </label>
            <input
              type="text"
              placeholder="e.g. ₹95 / kg"
              value={priceText}
              onChange={(e) => setPriceText(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-emerald-400 font-bold text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Duration Chips */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Display Duration
            </label>
            <div className="flex gap-2">
              {[8, 10, 15, 20].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setDurationSec(sec)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${
                    durationSec === sec
                      ? "bg-emerald-500 text-slate-950 border-emerald-400"
                      : "bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  {sec}s
                </button>
              ))}
            </div>
          </div>

          {/* Status Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Offer Status
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["live", "draft", "paused"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatus(st)}
                  className={`py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-colors ${
                    status === st
                      ? st === "live"
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500"
                        : st === "draft"
                        ? "bg-amber-500/20 text-amber-400 border-amber-500"
                        : "bg-slate-800 text-slate-300 border-slate-600"
                      : "bg-slate-950 text-slate-500 border-slate-800"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {saveError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          {/* Submit Actions */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !title.trim()}
              className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? "Saving..." : "Save & Update TV"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

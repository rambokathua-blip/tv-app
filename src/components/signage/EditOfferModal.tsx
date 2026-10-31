"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Upload,
  Camera,
  ImageIcon,
  AlertTriangle,
  Clock,
  Sparkles,
  Save,
  Link2,
  Check,
} from "lucide-react";
import type { Promotion } from "@/lib/signage/types";

interface EditOfferModalProps {
  promo: Promotion;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

const PRESET_GROCERY_PHOTOS = [
  {
    name: "Nashik Onion (प्याज)",
    url: "https://images.unsplash.com/photo-1508747703725-719777637510?q=80&w=1920&auto=format&fit=crop",
  },
  {
    name: "Kashmiri Apple (सेब)",
    url: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?q=80&w=1920&auto=format&fit=crop",
  },
  {
    name: "Desi Tomato (टमाटर)",
    url: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?q=80&w=1920&auto=format&fit=crop",
  },
  {
    name: "Fresh Cauliflower (गोभी)",
    url: "https://images.unsplash.com/photo-1568584711075-3d021a7c3ca3?q=80&w=1920&auto=format&fit=crop",
  },
  {
    name: "Fresh Potato (आलू)",
    url: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?q=80&w=1920&auto=format&fit=crop",
  },
  {
    name: "Green Capsicum (शिमला मिर्च)",
    url: "https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?q=80&w=1920&auto=format&fit=crop",
  },
  {
    name: "Fresh Banana (केला)",
    url: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?q=80&w=1920&auto=format&fit=crop",
  },
  {
    name: "Ginger & Garlic (अदरक लहसुन)",
    url: "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?q=80&w=1920&auto=format&fit=crop",
  },
  {
    name: "Kathua Fresh Logo",
    url: "/kathua-fresh-logo.jpg",
  },
];

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
        const MAX_WIDTH = 1280;
        const MAX_HEIGHT = 720;
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
          const url = (e.target?.result as string) || URL.createObjectURL(file);
          resolve({ file, dataUrl: url, isWide: true });
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
        const ratio = img.width / img.height;
        const isWide = ratio >= 1.5 && ratio <= 2.1;

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
          0.72
        );
      };
      img.onerror = () => {
        const url = (e.target?.result as string) || URL.createObjectURL(file);
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const getInitialThumb = () =>
    (promo.media?.thumb_path && !promo.media.thumb_path.includes("photo-1610832958506-aa56368176cf")
      ? promo.media.thumb_path
      : null) ||
    (promo.media?.storage_path && promo.media.storage_path !== "demo"
      ? promo.media.storage_path
      : null) ||
    (promo.media_id && (promo.media_id.startsWith("/") || promo.media_id.startsWith("http") || promo.media_id.startsWith("data:"))
      ? promo.media_id
      : null) ||
    promo.media?.thumb_path ||
    promo.media_id ||
    "/kathua-fresh-logo.jpg";

  const [title, setTitle] = useState(promo.title);
  const [priceText, setPriceText] = useState(promo.price_text || "");
  const [durationSec, setDurationSec] = useState(promo.duration_sec || 10);
  const [status, setStatus] = useState(promo.status);
  const [imageUrl, setImageUrl] = useState(getInitialThumb());
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [hasNewImage, setHasNewImage] = useState(false);
  const [aspectWarning, setAspectWarning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Secondary Photo Options: "upload" | "presets" | "url"
  const [imageTab, setImageTab] = useState<"upload" | "presets" | "url">("upload");
  const [customUrlInput, setCustomUrlInput] = useState("");

  // Sync state whenever modal opens or promo changes
  useEffect(() => {
    if (isOpen) {
      setTitle(promo.title);
      setPriceText(promo.price_text || "");
      setDurationSec(promo.duration_sec || 10);
      setStatus(promo.status);
      setImageUrl(getInitialThumb());
      setImageFile(null);
      setHasNewImage(false);
      setAspectWarning(false);
      setSaveError(null);
    }
  }, [isOpen, promo.id]);

  if (!isOpen) return null;

  const triggerChooseFile = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    fileInputRef.current?.click();
  };

  const triggerCamera = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    cameraInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { file: compressed, dataUrl, isWide } = await compressClientImage(file);
      setImageFile(compressed);
      setImageUrl(dataUrl);
      setHasNewImage(true);
      setAspectWarning(!isWide);
    } catch {
      setImageFile(file);
      const url = URL.createObjectURL(file);
      setImageUrl(url);
      setHasNewImage(true);
    } finally {
      e.target.value = "";
    }
  };

  const handleSelectPreset = (presetUrl: string) => {
    setImageUrl(presetUrl);
    setImageFile(null);
    setHasNewImage(true);
    setAspectWarning(false);
  };

  const handleApplyCustomUrl = () => {
    if (!customUrlInput.trim()) return;
    setImageUrl(customUrlInput.trim());
    setImageFile(null);
    setHasNewImage(true);
    setAspectWarning(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      let finalMediaId: string | null = null;

      // 1. If user uploaded a new local file, upload it to the server
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

        // If server upload failed or returned blob, guarantee base64 dataUri so it's permanent
        if (!finalMediaId || finalMediaId.startsWith("blob:")) {
          if (imageUrl && !imageUrl.startsWith("blob:")) {
            finalMediaId = imageUrl;
          } else {
            finalMediaId = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = (ev) => resolve((ev.target?.result as string) || "/kathua-fresh-logo.jpg");
              reader.onerror = () => resolve("/kathua-fresh-logo.jpg");
              reader.readAsDataURL(imageFile);
            });
          }
        }
      } else if (hasNewImage && imageUrl && !imageUrl.startsWith("blob:")) {
        // User selected a preset or typed an image URL
        finalMediaId = imageUrl;
      } else {
        // User kept existing image
        finalMediaId = getInitialThumb();
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

      const updatedPromoData = await res.json().catch(() => null);

      try {
        const cached = localStorage.getItem("kathua_signage_promotions");
        const list = cached ? JSON.parse(cached) : [];
        if (Array.isArray(list)) {
          const updated = list.map((p: any) =>
            p.id === promo.id
              ? {
                  ...p,
                  ...(updatedPromoData?.promotion || updatedPromoData || {}),
                  title: title.trim(),
                  price_text: priceText.trim() || null,
                  duration_sec: durationSec,
                  status,
                  enabled: status === "live",
                  media_id: finalMediaId || p.media_id,
                  media: {
                    id: finalMediaId || p.media_id,
                    storage_path: finalMediaId || p.media_id,
                    thumb_path: finalMediaId || p.media_id,
                  },
                }
              : p
          );
          localStorage.setItem("kathua_signage_promotions", JSON.stringify(updated));
        }
      } catch {}

      // Trigger publish so TV updates immediately
      await fetch("/api/signage/admin/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: `Updated offer: ${title.trim()}`,
        }),
      }).catch(() => {});

      // Real-time broadcast to all TV display screens
      try {
        const syncChannel = new BroadcastChannel("kathua_tv_sync");
        syncChannel.postMessage({ type: "TV_SYNC", timestamp: Date.now() });
        syncChannel.close();
      } catch {}
      try {
        localStorage.setItem("signage_force_refresh", Date.now().toString());
      } catch {}

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
        {/* Active inputs (hidden visually but kept in layout tree for Android WebView compatibility) */}
        <input
          id="edit-offer-file-input"
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          style={{
            position: "absolute",
            width: "1px",
            height: "1px",
            padding: 0,
            margin: "-1px",
            overflow: "hidden",
            clip: "rect(0,0,0,0)",
            border: 0,
            opacity: 0.001,
          }}
          onChange={handleFileChange}
        />
        <input
          id="edit-offer-camera-input"
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          style={{
            position: "absolute",
            width: "1px",
            height: "1px",
            padding: 0,
            margin: "-1px",
            overflow: "hidden",
            clip: "rect(0,0,0,0)",
            border: 0,
            opacity: 0.001,
          }}
          onChange={handleFileChange}
        />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white">Edit Offer Details</h2>
            {hasNewImage && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                New Photo Selected
              </span>
            )}
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
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-400">
                Offer Image & TV Preview
              </label>
              {hasNewImage && (
                <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Ready to Save
                </span>
              )}
            </div>

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

              {/* Top overlay Quick Trigger */}
              <button
                type="button"
                onClick={triggerChooseFile}
                className="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-black/80 hover:bg-black text-white text-xs font-semibold flex items-center gap-1.5 backdrop-blur-sm border border-white/20 active:scale-95 transition-all shadow-md cursor-pointer select-none"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-400" />
                <span>Change Image</span>
              </button>
            </div>

            {/* Photo Selection Tabs */}
            <div className="pt-1">
              <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 gap-1 mb-2.5">
                <button
                  type="button"
                  onClick={() => setImageTab("upload")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    imageTab === "upload"
                      ? "bg-emerald-500 text-slate-950 shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload / Camera</span>
                </button>
                <button
                  type="button"
                  onClick={() => setImageTab("presets")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    imageTab === "presets"
                      ? "bg-emerald-500 text-slate-950 shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Store Library</span>
                </button>
                <button
                  type="button"
                  onClick={() => setImageTab("url")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    imageTab === "url"
                      ? "bg-emerald-500 text-slate-950 shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Web Link</span>
                </button>
              </div>

              {/* Tab 1: Upload & Camera Buttons */}
              {imageTab === "upload" && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={triggerChooseFile}
                    className="py-3 px-3 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md text-center select-none"
                  >
                    <Upload className="w-4 h-4 shrink-0" />
                    <span>Choose from Files / Gallery</span>
                  </button>
                  <button
                    type="button"
                    onClick={triggerCamera}
                    className="py-3 px-3 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2 cursor-pointer transition-all text-center select-none"
                  >
                    <Camera className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Take New Photo (Camera)</span>
                  </button>
                </div>
              )}

              {/* Tab 2: 1-Tap Preset Store Photos */}
              {imageTab === "presets" && (
                <div className="space-y-1.5">
                  <div className="text-[11px] text-slate-400 font-medium">
                    Tap any fresh item to instantly apply photo:
                  </div>
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1 bg-slate-950/50 rounded-xl border border-slate-800">
                    {PRESET_GROCERY_PHOTOS.map((p) => {
                      const isSelected = imageUrl === p.url;
                      return (
                        <button
                          key={p.url}
                          type="button"
                          onClick={() => handleSelectPreset(p.url)}
                          className={`relative aspect-video rounded-lg overflow-hidden border transition-all text-left group ${
                            isSelected
                              ? "border-emerald-400 ring-2 ring-emerald-500/50"
                              : "border-slate-800 hover:border-slate-600"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.url}
                            alt={p.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-black/80 px-1 py-0.5 text-[9px] text-white font-bold truncate">
                            {p.name}
                          </div>
                          {isSelected && (
                            <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold">
                              ✓
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tab 3: Paste Custom Image Link */}
              {imageTab === "url" && (
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://example.com/image.jpg"
                    value={customUrlInput}
                    onChange={(e) => setCustomUrlInput(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCustomUrl}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition-all"
                  >
                    Apply Link
                  </button>
                </div>
              )}
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

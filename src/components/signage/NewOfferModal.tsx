"use client";

import React, { useState, useRef } from "react";
import {
  X,
  Upload,
  Camera,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Crop,
  Layers,
} from "lucide-react";

interface NewOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

/**
 * Process and convert any captured or uploaded photo directly into a crisp 16:9 TV-ready format.
 */
async function processImageTo16by9(
  file: File,
  fitMode: "crop169" | "contain" = "crop169"
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
        const TARGET_W = 1280;
        const TARGET_H = 720;
        const canvas = document.createElement("canvas");
        canvas.width = TARGET_W;
        canvas.height = TARGET_H;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          const url = URL.createObjectURL(file);
          resolve({ file, dataUrl: url, isWide: true });
          return;
        }

        // Fill background with elegant dark charcoal gradient
        ctx.fillStyle = "#090d16";
        ctx.fillRect(0, 0, TARGET_W, TARGET_H);

        if (fitMode === "crop169") {
          // COVER: Scales and center-crops into 16:9 aspect ratio so there are zero black bars
          const scale = Math.max(TARGET_W / img.width, TARGET_H / img.height);
          const drawW = img.width * scale;
          const drawH = img.height * scale;
          const drawX = (TARGET_W - drawW) / 2;
          const drawY = (TARGET_H - drawH) / 2;
          ctx.drawImage(img, drawX, drawY, drawW, drawH);
        } else {
          // CONTAIN: Fits the whole image centered, with a blurred ambient backdrop of the same photo
          ctx.save();
          ctx.filter = "blur(24px) brightness(0.6)";
          const bgScale = Math.max(TARGET_W / img.width, TARGET_H / img.height) * 1.15;
          const bgW = img.width * bgScale;
          const bgH = img.height * bgScale;
          ctx.drawImage(img, (TARGET_W - bgW) / 2, (TARGET_H - bgH) / 2, bgW, bgH);
          ctx.restore();

          // Draw sharp original image centered
          const scale = Math.min(TARGET_W / img.width, TARGET_H / img.height);
          const drawW = img.width * scale;
          const drawH = img.height * scale;
          const drawX = (TARGET_W - drawW) / 2;
          const drawY = (TARGET_H - drawH) / 2;
          ctx.drawImage(img, drawX, drawY, drawW, drawH);
        }

        const dataUrl = canvas.toDataURL("image/jpeg", 0.78);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File(
                [blob],
                file.name.replace(/\.[^.]+$/, ".jpg"),
                { type: "image/jpeg", lastModified: Date.now() }
              );
              resolve({ file: compressedFile, dataUrl, isWide: true });
            } else {
              resolve({ file, dataUrl, isWide: true });
            }
          },
          "image/jpeg",
          0.78
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

export default function NewOfferModal({
  isOpen,
  onClose,
  onCreated,
}: NewOfferModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [imageUrl, setImageUrl] = useState("");
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [fitMode, setFitMode] = useState<"crop169" | "contain">("crop169");

  // Form details
  const [title, setTitle] = useState("");
  const [mrp, setMrp] = useState("");
  const [priceText, setPriceText] = useState("");
  const [durationSec, setDurationSec] = useState(10);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  // Confirmation & progress states
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStep, setPublishStep] = useState<"optimizing" | "saving" | "broadcasting" | "done" | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Handle native or user image selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRawFile(file);
    try {
      const { file: processed, dataUrl } = await processImageTo16by9(file, fitMode);
      setImageFile(processed);
      setImageUrl(dataUrl);
    } catch {
      setImageFile(file);
      setImageUrl(URL.createObjectURL(file));
    } finally {
      e.target.value = "";
    }
  };

  // Re-process when fit mode changes
  const handleToggleFitMode = async (mode: "crop169" | "contain") => {
    setFitMode(mode);
    if (rawFile) {
      const { file: processed, dataUrl } = await processImageTo16by9(rawFile, mode);
      setImageFile(processed);
      setImageUrl(dataUrl);
    }
  };

  // Sample quick images for testing / demo
  const sampleImages = [
    {
      title: "Desi Tamatar",
      price: "₹25 / kg",
      url: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?q=80&w=1280&auto=format&fit=crop",
    },
    {
      title: "Nashik Onion",
      price: "₹38 / kg",
      url: "https://images.unsplash.com/photo-1508747703725-719777637510?q=80&w=1280&auto=format&fit=crop",
    },
    {
      title: "Royal Apple",
      price: "₹120 / kg",
      url: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?q=80&w=1280&auto=format&fit=crop",
    },
    {
      title: "Fresh Cauliflower",
      price: "₹30 / pc",
      url: "https://images.unsplash.com/photo-1568584711075-3d021a7c3ca3?q=80&w=1280&auto=format&fit=crop",
    },
  ];

  const handleSelectSample = (sample: (typeof sampleImages)[0]) => {
    setImageUrl(sample.url);
    setTitle(sample.title);
    setPriceText(sample.price);
  };

  const handleOpenSource = (isCamera: boolean) => {
    // In Android APK, use bridge if available
    if (typeof window !== "undefined" && (window as any).AndroidSignage) {
      if (isCamera && typeof (window as any).AndroidSignage.openCamera === "function") {
        (window as any).AndroidSignage.openCamera();
        return;
      }
      if (!isCamera && typeof (window as any).AndroidSignage.openImagePicker === "function") {
        (window as any).AndroidSignage.openImagePicker();
        return;
      }
    }

    // Direct browser file input activation
    const id = isCamera ? "new-offer-camera-input" : "new-offer-gallery-input";
    const el = document.getElementById(id) as HTMLInputElement | null;
    el?.click();
  };

  const handleSave = async (publishImmediately: boolean) => {
    if (!title.trim()) {
      setSaveError("Please enter an offer title");
      return;
    }
    setIsPublishing(true);
    setSaveError(null);
    setPublishStep("optimizing");

    // Instant optimistic save locally so TV displays immediately in 0ms!
    const tempId = "promo-" + Date.now();
    const optimisticPromo = {
      id: tempId,
      title: title.trim(),
      price_text: priceText.trim() || null,
      mrp: mrp.trim() ? (mrp.startsWith("₹") ? mrp.trim() : `₹${mrp.trim()}`) : null,
      duration_sec: durationSec || 8,
      status: publishImmediately ? "live" : "draft",
      enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      media_id: imageUrl,
      media: {
        id: "media-" + tempId,
        storage_path: imageUrl,
        thumb_path: imageUrl,
        mime: "image/jpeg",
        bytes: 50000,
        sha256: "optimistic",
        kind: "image",
      },
    };

    try {
      const cached = localStorage.getItem("kathua_signage_promotions");
      const list = cached ? JSON.parse(cached) : [];
      const updated = [optimisticPromo, ...(Array.isArray(list) ? list.filter((p: any) => p.id !== "demo-onion" && p.id !== "demo-apple") : [])];
      localStorage.setItem("kathua_signage_promotions", JSON.stringify(updated));
      localStorage.setItem("signage_force_refresh", Date.now().toString());

      const syncChannel = new BroadcastChannel("kathua_tv_sync");
      syncChannel.postMessage({ type: "TV_SYNC", timestamp: Date.now() });
      syncChannel.close();
    } catch {}

    setPublishStep("saving");

    try {
      let finalMediaId: string | null = null;

      // 1. Upload image if file exists
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
          console.warn("Upload fallback to data URL", uploadErr);
        }

        if (!finalMediaId || finalMediaId.startsWith("blob:")) {
          finalMediaId = imageUrl;
        }
      } else {
        finalMediaId = imageUrl;
      }

      // 2. Create promotion in database
      const promoRes = await fetch("/api/signage/admin/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          price_text: priceText.trim() || null,
          mrp: mrp.trim() ? (mrp.startsWith("₹") ? mrp.trim() : `₹${mrp.trim()}`) : null,
          media_id: finalMediaId || "/kathua-fresh-logo.jpg",
          duration_sec: durationSec,
          starts_at: startsAt ? new Date(startsAt).toISOString() : null,
          ends_at: endsAt ? new Date(endsAt).toISOString() : null,
          status: publishImmediately ? "live" : "draft",
          enabled: true,
          notes: null,
        }),
      });

      if (!promoRes.ok) {
        const errData = await promoRes.json().catch(() => ({}));
        const errMessage =
          errData.error?.message ||
          errData.message ||
          (typeof errData.error === "string" ? errData.error : null) ||
          "Failed to create promotion";
        throw new Error(errMessage);
      }

      const promoData = await promoRes.json();
      const promotionId = promoData.promotion?.id || promoData.id || promoData.data?.id;

      if (promotionId) {
        // Add to default playlist
        await fetch("/api/signage/admin/playlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            promotion_id: promotionId,
            position: 1,
          }),
        }).catch(() => {});
      }

      setPublishStep("broadcasting");

      // 3. Publish to live version snapshot
      if (publishImmediately) {
        await fetch("/api/signage/admin/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notes: `Published offer: ${title}`,
          }),
        }).catch(() => {});
      }

      // 4. Live Broadcast to all screens
      try {
        const syncChannel = new BroadcastChannel("kathua_tv_sync");
        syncChannel.postMessage({ type: "TV_SYNC", timestamp: Date.now() });
        syncChannel.close();
        localStorage.setItem("signage_force_refresh", Date.now().toString());
      } catch {}

      setPublishStep("done");
      setTimeout(() => {
        setIsPublishing(false);
        setPublishStep(null);
        onCreated();
      }, 500);
    } catch (err: any) {
      console.error(err);
      setIsPublishing(false);
      setPublishStep(null);
      setSaveError(err.message || "Failed to publish offer");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] shadow-2xl relative">
        {/* Animated Progress Overlay */}
        {publishStep && (
          <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-50 animate-in fade-in">
            <div className="w-16 h-16 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin mb-4 shadow-lg shadow-emerald-500/30" />
            <h3 className="text-lg font-bold text-white mb-2">
              {publishStep === "done" ? "✓ Offer Published!" : "Publishing to TV Screens..."}
            </h3>
            <div className="space-y-2 text-xs text-left w-full max-w-xs bg-slate-900/90 p-4 rounded-2xl border border-slate-800 shadow-md">
              <div
                className={`flex items-center gap-2 ${
                  publishStep !== "optimizing"
                    ? "text-emerald-400 font-bold"
                    : "text-slate-200 font-semibold animate-pulse"
                }`}
              >
                <span>{publishStep !== "optimizing" ? "✓" : "●"}</span>
                <span>1. Image 16:9 TV optimization</span>
              </div>
              <div
                className={`flex items-center gap-2 ${
                  publishStep === "broadcasting" || publishStep === "done"
                    ? "text-emerald-400 font-bold"
                    : publishStep === "saving"
                    ? "text-slate-200 font-semibold animate-pulse"
                    : "text-slate-500"
                }`}
              >
                <span>
                  {publishStep === "broadcasting" || publishStep === "done"
                    ? "✓"
                    : "○"}
                </span>
                <span>2. Saved to Kathua Fresh Catalog</span>
              </div>
              <div
                className={`flex items-center gap-2 ${
                  publishStep === "done"
                    ? "text-emerald-400 font-bold"
                    : publishStep === "broadcasting"
                    ? "text-slate-200 font-semibold animate-pulse"
                    : "text-slate-500"
                }`}
              >
                <span>{publishStep === "done" ? "✓" : "○"}</span>
                <span>3. Live broadcast sent to Shop TV 1</span>
              </div>
            </div>
          </div>
        )}

        {/* Native inputs (sr-only with layout presence for full Android WebView compatibility) */}
        <input
          id="new-offer-gallery-input"
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
          id="new-offer-camera-input"
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
            <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center">
              {step}/3
            </span>
            <h2 className="text-base font-bold text-white">
              {step === 1 && "Choose Offer Image"}
              {step === 2 && "Offer Details"}
              {step === 3 && "Preview & Publish"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* STEP 1: CHOOSE IMAGE */}
          {step === 1 && (
            <div className="space-y-4">
              {imageUrl ? (
                <div className="space-y-3">
                  <div className="relative aspect-video rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 group shadow-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt="Selected"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2.5 left-2.5 px-2.5 py-1 bg-black/75 backdrop-blur-md rounded-lg text-[11px] font-bold text-emerald-400 flex items-center gap-1.5 border border-emerald-500/30">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>16:9 TV Ready</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setImageUrl("");
                        setRawFile(null);
                        setImageFile(null);
                      }}
                      title="Remove image"
                      className="absolute top-2 right-2 p-1.5 bg-black/75 hover:bg-red-600 rounded-full text-white transition-colors z-30"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 16:9 Aspect Ratio Adjustment Toggle */}
                  <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                    <div className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-emerald-400">
                        <Crop className="w-3.5 h-3.5" />
                        <span>TV Screen Aspect Ratio Framing:</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">16:9 Widescreen</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => handleToggleFitMode("crop169")}
                        className={`p-2 rounded-xl border flex items-center justify-center gap-1.5 font-bold transition-all ${
                          fitMode === "crop169"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm"
                            : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                        }`}
                      >
                        <Crop className="w-3.5 h-3.5" />
                        <span>16:9 Smart Fill (Best)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleFitMode("contain")}
                        className={`p-2 rounded-xl border flex items-center justify-center gap-1.5 font-bold transition-all ${
                          fitMode === "contain"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm"
                            : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                        }`}
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Fit Entire Photo</span>
                      </button>
                    </div>
                  </div>

                  {/* Change Picture Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleOpenSource(false)}
                      className="py-3 px-3 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md text-center select-none"
                    >
                      <Upload className="w-4 h-4 shrink-0" />
                      <span>Change Picture</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenSource(true)}
                      className="py-3 px-3 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2 cursor-pointer transition-all text-center select-none"
                    >
                      <Camera className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Take New Photo</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Direct Native Touch Targets */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleOpenSource(true)}
                      className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border-2 border-emerald-500/40 hover:border-emerald-400 active:scale-95 flex flex-col items-center justify-center text-center cursor-pointer transition-all shadow-lg"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center mb-2 shadow-md">
                        <Camera className="w-6 h-6" />
                      </div>
                      <div className="text-sm font-black text-white">
                        📷 Take Photo
                      </div>
                      <div className="text-[10px] text-emerald-300 font-semibold mt-0.5">
                        Open Phone Camera
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenSource(false)}
                      className="p-5 rounded-2xl bg-slate-950 border-2 border-slate-800 hover:border-slate-700 active:scale-95 flex flex-col items-center justify-center text-center cursor-pointer transition-all shadow-lg"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-slate-800 text-emerald-400 flex items-center justify-center mb-2">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                      <div className="text-sm font-black text-white">
                        🖼️ Choose Gallery
                      </div>
                      <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                        Select from Files / Album
                      </div>
                    </button>
                  </div>

                  {/* Android Permission Shortcut Banner */}
                  <div className="flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== "undefined" && (window as any).AndroidSignage?.openAppSettings) {
                          (window as any).AndroidSignage.openAppSettings();
                        } else if (typeof window !== "undefined" && (window as any).AndroidSignage?.requestPermissions) {
                          (window as any).AndroidSignage.requestPermissions();
                        }
                      }}
                      className="text-[11px] text-slate-400 hover:text-emerald-400 active:text-emerald-300 transition-colors flex items-center gap-1.5 py-0.5 underline underline-offset-4"
                    >
                      <span>🔒 Android App: Permission blocked? Tap to Open Settings</span>
                    </button>
                  </div>

                  {/* 16:9 Camera ratio hint */}
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex items-center gap-2.5 text-xs text-slate-300">
                    <Crop className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      <strong>TV Ratio Guide:</strong> Any photo you click or select is automatically formatted to fit full 16:9 widescreen TV.
                    </span>
                  </div>

                  {/* Quick Preset Samples */}
                  <div className="pt-1">
                    <div className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Or Pick a Quick Store Sample:</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {sampleImages.map((s) => (
                        <button
                          key={s.title}
                          type="button"
                          onClick={() => handleSelectSample(s)}
                          className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 flex items-center gap-2.5 text-left transition-all group"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={s.url}
                            alt={s.title}
                            className="w-12 h-10 rounded-lg object-cover border border-slate-800 shrink-0 group-hover:scale-105 transition-transform"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-white truncate">
                              {s.title}
                            </div>
                            <div className="text-[11px] font-black text-amber-400">
                              {s.price}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: DETAILS */}
          {step === 2 && (
            <div className="space-y-4">
              {imageUrl && (
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt="Selected"
                      className="w-10 h-10 rounded-lg object-cover border border-slate-700 shrink-0"
                    />
                    <div className="truncate text-xs text-slate-300 font-medium">
                      16:9 Formatted Photo
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-emerald-400 flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Change Picture</span>
                  </button>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Offer Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Kurkure Tedhe Medhe"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>Original MRP (Optional)</span>
                    <span className="text-[10px] text-red-400 font-bold">कटेगा (Strikethrough)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">₹</span>
                    <input
                      type="text"
                      placeholder="e.g. 30"
                      value={mrp}
                      onChange={(e) => setMrp(e.target.value.replace(/[^0-9.]/g, ""))}
                      className="w-full pl-7 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-300 line-through font-bold placeholder-slate-600 text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">TV par crossed-out dikhega</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>Offer / Deal Price *</span>
                    <span className="text-[10px] text-emerald-400 font-bold">Big & Glowing</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 25 rs or ₹25"
                    value={priceText}
                    onChange={(e) => setPriceText(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-amber-300 font-black placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-amber-400/80 mt-1 block">Customer deal price</span>
                </div>
              </div>

              {/* Discount Calculator Live Preview */}
              {mrp && priceText && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <span className="line-through text-slate-400 font-bold">MRP ₹{mrp}</span>
                    <span className="text-emerald-400 font-extrabold">➜ Deal: {priceText}</span>
                  </div>
                  {(() => {
                    const numMrp = parseFloat(mrp);
                    const numPrice = parseFloat(priceText.replace(/[^0-9.]/g, ""));
                    if (numMrp > 0 && numPrice > 0 && numMrp > numPrice) {
                      const saving = Math.round(numMrp - numPrice);
                      const pct = Math.round(((numMrp - numPrice) / numMrp) * 100);
                      return (
                        <span className="px-2 py-0.5 rounded-lg bg-red-500 text-white font-black text-[10px] uppercase tracking-wider shadow-sm">
                          {pct}% OFF • SAVE ₹{saving}
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Display Duration on TV
                </label>
                <div className="flex gap-2">
                  {[6, 8, 10, 15, 20].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setDurationSec(sec)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${
                        durationSec === sec
                          ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20"
                          : "bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Start Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW & PUBLISH */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="text-xs font-semibold text-slate-400">
                Live TV Layout Preview (16:9 Screen):
              </div>

              {/* Exact TV Mockup (16:9 ratio with zones) */}
              <div className="relative aspect-video rounded-2xl overflow-hidden border-2 border-emerald-500/50 bg-slate-950 shadow-2xl">
                {imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl}
                    alt={title}
                    className="w-full h-full object-cover"
                  />
                )}

                {/* Simulated Price Tag */}
                {priceText && (
                  <div className="absolute bottom-6 left-3 bg-slate-950/90 backdrop-blur-md border border-amber-400/80 px-3 py-1.5 rounded-xl shadow-lg">
                    <div className="text-[9px] text-emerald-400 font-bold uppercase leading-none">
                      {title}
                    </div>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      {mrp && (
                        <span className="text-[10px] line-through text-red-400 font-bold">
                          MRP ₹{mrp}
                        </span>
                      )}
                      <span className="text-sm font-black text-amber-300 leading-tight">
                        {priceText}
                      </span>
                    </div>
                  </div>
                )}

                {/* Brand Badge */}
                <div className="absolute top-2.5 right-2.5 bg-emerald-600/90 backdrop-blur-md px-2.5 py-1 rounded-lg text-[9px] font-black text-white border border-emerald-400/30">
                  KATHUA FRESH TV
                </div>

                {/* Simulated Bottom Ticker */}
                <div className="absolute bottom-0 inset-x-0 bg-slate-950/95 border-t border-emerald-500/30 px-3 py-1 text-[8px] text-white flex justify-between">
                  <span>www.kathuafresh.in</span>
                  <span className="text-emerald-400 font-bold">● LIVE DISPLAY</span>
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl space-y-1.5 text-xs border border-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-400">Offer Title:</span>
                  <span className="font-bold text-white">{title}</span>
                </div>
                {mrp && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Original MRP:</span>
                    <span className="font-bold text-slate-400 line-through">₹{mrp}</span>
                  </div>
                )}
                {priceText && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Deal Price:</span>
                    <span className="font-black text-amber-300">{priceText}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">Slide Time:</span>
                  <span className="text-emerald-400 font-semibold">{durationSec} seconds</span>
                </div>
              </div>

              {saveError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{saveError}</span>
                </div>
              )}

              {/* Confirmation Dialog inside Step 3 */}
              {showConfirm && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Publish live to Shop TV 1?</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    This will immediately broadcast the update to the shop TV
                    screen in real-time.
                  </p>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setShowConfirm(false)}
                      className="flex-1 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={isPublishing}
                      onClick={() => handleSave(true)}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold active:scale-95 transition-all shadow-md shadow-emerald-500/20"
                    >
                      {isPublishing ? "Publishing..." : "Yes, Publish Now"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation Buttons */}
        {!showConfirm && (
          <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as 1 | 2)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
            )}

            {step === 1 && (
              <button
                type="button"
                disabled={!imageUrl}
                onClick={() => setStep(2)}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20 active:scale-95"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                disabled={!title.trim()}
                onClick={() => setStep(3)}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20 active:scale-95"
              >
                <span>Preview</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {step === 3 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isPublishing}
                  onClick={() => handleSave(false)}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirm(true)}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                >
                  Publish Now
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

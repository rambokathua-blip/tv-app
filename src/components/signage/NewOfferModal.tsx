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
} from "lucide-react";

interface NewOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function NewOfferModal({
  isOpen,
  onClose,
  onCreated,
}: NewOfferModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [aspectWarning, setAspectWarning] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Form details
  const [title, setTitle] = useState("");
  const [priceText, setPriceText] = useState("");
  const [durationSec, setDurationSec] = useState(10);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  // Confirmation state
  const [isPublishing, setIsPublishing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle image selection & aspect ratio inspection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    const objectUrl = URL.createObjectURL(file);
    setImageUrl(objectUrl);

    // Check image dimensions & aspect ratio
    const img = new Image();
    img.onload = () => {
      const ratio = img.width / img.height;
      // 16:9 is ~1.777. Warn if outside 1.6 to 1.95
      if (ratio < 1.6 || ratio > 1.95) {
        setAspectWarning(true);
      } else {
        setAspectWarning(false);
      }
    };
    img.src = objectUrl;
  };

  // Sample quick images for testing / demo
  const sampleImages = [
    {
      title: "Nashik Onion",
      price: "₹38 / kg",
      url: "https://images.unsplash.com/photo-1508747703725-719777637510?q=80&w=1920&auto=format&fit=crop",
    },
    {
      title: "Shimla Apple",
      price: "₹120 / kg",
      url: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?q=80&w=1920&auto=format&fit=crop",
    },
    {
      title: "Desi Tomato",
      price: "₹25 / kg",
      url: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?q=80&w=1920&auto=format&fit=crop",
    },
    {
      title: "Fresh Cauliflower",
      price: "₹30 / pc",
      url: "https://images.unsplash.com/photo-1568584711075-3d021a7c3ca3?q=80&w=1920&auto=format&fit=crop",
    },
  ];

  const handleSelectSample = (sample: (typeof sampleImages)[0]) => {
    setImageUrl(sample.url);
    setTitle(sample.title);
    setPriceText(sample.price);
    setAspectWarning(false);
  };

  const handleSave = async (publishImmediately: boolean) => {
    setIsPublishing(true);
    try {
      let finalMediaId: string | null = null;

      // If file uploaded, send to upload API
      if (imageFile) {
        const formData = new FormData();
        formData.append("file", imageFile);
        formData.append("kind", "image");
        const uploadRes = await fetch("/api/signage/admin/media/upload", {
          method: "POST",
          body: formData,
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          finalMediaId = uploadData.media?.id || null;
        }
      }

      // Create promotion
      const promoRes = await fetch("/api/signage/admin/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          price_text: priceText || null,
          media_id: finalMediaId,
          duration_sec: durationSec,
          starts_at: startsAt ? new Date(startsAt).toISOString() : null,
          ends_at: endsAt ? new Date(endsAt).toISOString() : null,
          status: publishImmediately ? "live" : "draft",
          enabled: true,
        }),
      });

      if (promoRes.ok) {
        const promoData = await promoRes.json();
        // Add to default playlist
        await fetch("/api/signage/admin/playlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            promotion_id: promoData.promotion.id,
            position: 999,
          }),
        });

        // If publish immediately requested
        if (publishImmediately) {
          await fetch("/api/signage/admin/publish", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              notes: `Published offer: ${title}`,
            }),
          });
        }

        onCreated();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] shadow-2xl">
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
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />

              {imageUrl ? (
                <div className="space-y-3">
                  <div className="relative aspect-video rounded-2xl overflow-hidden border border-slate-700 bg-slate-950">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt="Selected"
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => setImageUrl("")}
                      className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black rounded-full text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {aspectWarning && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5 text-xs text-amber-300">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <strong>Notice:</strong> This image is not 16:9 aspect
                        ratio. It will automatically fit onto the TV screen with
                        letterboxing.
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-950/50 hover:bg-slate-950"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
                      <Upload className="w-7 h-7" />
                    </div>
                    <div className="font-semibold text-slate-200 text-sm">
                      Upload from Gallery or Camera
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      JPG, PNG, WebP (16:9 recommended)
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      Or pick a quick store item
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {sampleImages.map((s) => (
                        <button
                          key={s.title}
                          type="button"
                          onClick={() => handleSelectSample(s)}
                          className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-left transition-colors"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={s.url}
                            alt={s.title}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                          <div>
                            <div className="text-xs font-bold text-white leading-tight">
                              {s.title}
                            </div>
                            <div className="text-[11px] text-emerald-400 font-semibold">
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
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Offer Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Fresh Nashik Onion"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Price Overlay (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. ₹38 / kg"
                  value={priceText}
                  onChange={(e) => setPriceText(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-emerald-400 font-bold placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

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
                TV Layout Preview:
              </div>

              {/* Exact TV Mockup (16:9 ratio with zones) */}
              <div className="relative aspect-video rounded-2xl overflow-hidden border-2 border-emerald-500/50 bg-slate-950 shadow-xl">
                {/* Promo Zone */}
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
                  <div className="absolute bottom-6 left-3 bg-slate-900/90 backdrop-blur-sm border border-emerald-500 px-2.5 py-1 rounded-lg">
                    <div className="text-[9px] text-emerald-400 font-bold uppercase leading-none">
                      {title}
                    </div>
                    <div className="text-xs font-extrabold text-amber-300 leading-tight">
                      {priceText}
                    </div>
                  </div>
                )}

                {/* Simulated Brand Badge */}
                <div className="absolute top-2 right-2 bg-emerald-700/80 backdrop-blur-sm px-2 py-0.5 rounded text-[8px] font-black text-white">
                  KATHUA FRESH
                </div>

                {/* Simulated Bottom Ticker */}
                <div className="absolute bottom-0 inset-x-0 bg-emerald-950/90 border-t border-emerald-500/30 px-2 py-0.5 text-[8px] text-white flex justify-between">
                  <span>www.kathuafresh.in</span>
                  <span className="text-amber-300">Daily Deals Available</span>
                </div>
              </div>

              <div className="p-3 bg-slate-800/50 rounded-xl space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Offer Title:</span>
                  <span className="font-semibold text-white">{title}</span>
                </div>
                {priceText && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Price text:</span>
                    <span className="font-bold text-emerald-400">
                      {priceText}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">Duration:</span>
                  <span className="text-slate-300">{durationSec} seconds</span>
                </div>
              </div>

              {/* Confirmation Dialog inside Step 3 */}
              {showConfirm && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Publish to Shop TV 1?</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    This will immediately broadcast the update to the shop TV
                    screen within seconds.
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
                      className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold"
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
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 text-xs font-bold transition-all"
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
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 text-xs font-bold transition-all"
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
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-lg shadow-emerald-500/20"
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

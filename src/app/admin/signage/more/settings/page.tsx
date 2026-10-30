"use client";

import React, { useState } from "react";
import {
  Palette,
  Save,
  CheckCircle2,
  Tv,
  Globe,
  Sliders,
} from "lucide-react";

export default function BrandingSettingsPage() {
  const [websiteText, setWebsiteText] = useState("www.kathuafresh.in");
  const [tagline, setTagline] = useState("Quality Assured | Always Fresh");
  const [tickerText, setTickerText] = useState(
    "Welcome to Kathua Fresh • Fresh Farm Fruits & Vegetables Daily • 100% Quality Guaranteed • Scan QR Code to Join WhatsApp Channel for Daily Special Offers"
  );
  const [tickerEnabled, setTickerEnabled] = useState(true);
  const [layoutProfile, setLayoutProfile] = useState<"standard" | "immersive">(
    "standard"
  );

  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await fetch("/api/signage/admin/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_text: websiteText,
          tagline,
          ticker_text: tickerText,
          ticker_enabled: tickerEnabled,
          layout_profile: layoutProfile,
        }),
      });

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch {
      // ignore
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Branding & Layout</h1>
          <p className="text-xs text-slate-400">
            TV screen headers, ticker text, and theme
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? "Saving..." : "Save Settings"}</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-2 text-xs text-emerald-400 font-semibold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>Branding settings updated and applied to TV!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        {/* Layout Profile Selection (PRD 10.1 & 10.2) */}
        <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            TV Layout Profile
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setLayoutProfile("standard")}
              className={`p-3 rounded-2xl border text-left transition-all ${
                layoutProfile === "standard"
                  ? "bg-emerald-500/10 border-emerald-500 text-emerald-400"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="text-xs font-bold text-white">Standard (16:9)</div>
              <div className="text-[11px] text-slate-400 mt-1">
                61% promotion, dedicated QR panel & bottom ticker (Recommended)
              </div>
            </button>

            <button
              type="button"
              onClick={() => setLayoutProfile("immersive")}
              className={`p-3 rounded-2xl border text-left transition-all ${
                layoutProfile === "immersive"
                  ? "bg-emerald-500/10 border-emerald-500 text-emerald-400"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="text-xs font-bold text-white">Immersive</div>
              <div className="text-[11px] text-slate-400 mt-1">
                Full-bleed 1080p promotion image with overlay bar & corner QR
              </div>
            </button>
          </div>
        </div>

        {/* Website & Tagline */}
        <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-3.5">
          <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Brand Identity & Logo
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex items-center gap-3.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/kathua-fresh-logo.jpg"
              alt="Official Logo"
              className="w-16 h-16 rounded-xl object-contain bg-emerald-950 border border-emerald-500/30 shrink-0"
            />
            <div>
              <div className="text-xs font-bold text-white">
                Official Kathua Fresh Brand Logo
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Permanently featured in Zone B of the 1920x1080 Smart TV screen
              </p>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Store Website Display Text
            </label>
            <input
              type="text"
              value={websiteText}
              onChange={(e) => setWebsiteText(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-bold focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Store Tagline
            </label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Bottom Ticker Marquee */}
        <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Bottom Bar Ticker Marquee
            </div>
            <button
              type="button"
              onClick={() => setTickerEnabled(!tickerEnabled)}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-xl border ${
                tickerEnabled
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : "bg-slate-800 text-slate-400 border-slate-700"
              }`}
            >
              {tickerEnabled ? "Enabled" : "Disabled"}
            </button>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Scrolling Announcement Text
            </label>
            <textarea
              rows={3}
              value={tickerText}
              onChange={(e) => setTickerText(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-amber-300 text-xs leading-relaxed focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </form>
    </div>
  );
}

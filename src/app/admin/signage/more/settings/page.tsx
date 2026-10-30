"use client";

import React, { useState, useEffect } from "react";
import {
  Palette,
  Save,
  CheckCircle2,
  Tv,
  Globe,
  Sliders,
  Sparkles,
  RefreshCw,
  ExternalLink,
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

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Fetch current live branding settings from backend on mount
  useEffect(() => {
    fetch("/api/signage/admin/branding")
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          if (data.website_text) setWebsiteText(data.website_text);
          if (data.tagline) setTagline(data.tagline);
          if (data.ticker_text) setTickerText(data.ticker_text);
          if (typeof data.ticker_enabled === "boolean") setTickerEnabled(data.ticker_enabled);
          if (data.layout_profile) setLayoutProfile(data.layout_profile);
        }
      })
      .catch((err) => console.error("Failed to load branding:", err))
      .finally(() => setIsLoading(false));
  }, []);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch("/api/signage/admin/branding", {
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

      if (!res.ok) throw new Error("Failed to save branding");

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // Ticker Quick Presets
  const tickerPresets = [
    {
      label: "🌟 Standard Store Welcome",
      text: "Welcome to Kathua Fresh • Quality Assured | Always Fresh • Farm Fresh Fruits & Vegetables Daily • 100% Quality Guaranteed • Scan WhatsApp QR for Wholesale Rates",
    },
    {
      label: "🍎 Special Deals Announcement",
      text: "आज के विशेष ऑफर्स • कश्मीरी सेब ₹120/kg • नासिक प्याज़ ₹38/kg • ताज़ा सब्ज़ियाँ रोज़ाना उपलब्ध • Kathua Fresh",
    },
    {
      label: "📲 Wholesale Mandi Rates",
      text: "दुकान के टीवी पर दिया गया WhatsApp QR कोड स्कैन करें और रोज़ाना मंडी रेट्स सीधे अपने फोन पर पाएं • Order Online at www.kathuafresh.in",
    },
  ];

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Branding & Layout</h1>
          <p className="text-xs text-slate-400">
            TV screen headers, bottom ticker marquee, and layout profile
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/tv?preview=true"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-colors"
          >
            <span>Live TV</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            onClick={() => handleSave()}
            disabled={isSaving || isLoading}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{isSaving ? "Saving to TV..." : "Save Settings"}</span>
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex items-center gap-2 text-xs text-emerald-300 font-bold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Ticker & Branding settings updated! TV screen par turant apply ho gaya.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        {/* Bottom Ticker Marquee Card */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-2xl ${
                  tickerEnabled
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                    : "bg-slate-800 text-slate-500"
                }`}
              >
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-black text-white flex items-center gap-2">
                  <span>Bottom Bar Ticker Marquee</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      tickerEnabled
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {tickerEnabled ? "Active on TV" : "Disabled / Hidden"}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  TV screen ke sabse neeche continuous horizontal scrolling announcement line
                </p>
              </div>
            </div>

            {/* Interactive Toggle Switch */}
            <button
              type="button"
              onClick={() => setTickerEnabled(!tickerEnabled)}
              className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
                tickerEnabled ? "bg-emerald-500 justify-end" : "bg-slate-700 justify-start"
              }`}
            >
              <div className="bg-slate-950 w-4 h-4 rounded-full shadow-md transform transition-transform" />
            </button>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between text-xs">
              <label className="font-bold text-slate-300">
                Scrolling Ticker Text (Hindi / English)
              </label>
              <span className="text-[11px] text-slate-500">
                {tickerText.length} characters
              </span>
            </div>

            <textarea
              rows={3}
              value={tickerText}
              onChange={(e) => setTickerText(e.target.value)}
              placeholder="TV ke bottom bar par scroll hone wala text yahan likhein..."
              className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-amber-300 text-xs leading-relaxed focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Quick Presets */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span>Ready-Made Ticker Presets (Click to apply):</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {tickerPresets.map((preset, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setTickerText(preset.text)}
                  className="shrink-0 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 text-xs text-slate-300 font-semibold transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Live Marquee Preview Box */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Live TV Screen Preview (Zone D):
            </div>
            <div className="bg-gradient-to-r from-emerald-950 via-slate-950 to-emerald-950 border border-emerald-500/30 rounded-2xl p-3 overflow-hidden shadow-inner">
              {tickerEnabled ? (
                <div className="overflow-hidden whitespace-nowrap">
                  <div className="inline-block animate-pulse text-xs font-bold text-amber-300 tracking-wide">
                    {tickerText || "No ticker text configured"}
                  </div>
                </div>
              ) : (
                <div className="text-center text-xs text-slate-500 italic py-1">
                  Ticker marquee is currently disabled (hidden on TV)
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Layout Profile Selection */}
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
                Zone A (Promo) + Zone B (Logo) + Zone C (QR) + Zone D (Bottom Ticker)
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
              Store Website Display Text (Zone D)
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

        {/* Floating Save Button on Mobile */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSaving || isLoading}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-sm font-black rounded-2xl shadow-xl shadow-emerald-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{isSaving ? "Saving changes..." : "Save & Update TV Screen"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

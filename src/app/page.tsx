import Link from "next/link";
import {
  Tv,
  Smartphone,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Sliders,
} from "lucide-react";

import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Kathua Fresh TV",
  description: "Smart Digital Signage Platform for Kathua Fresh Store TV",
};

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans selection:bg-emerald-500 selection:text-white">
      {/* Hero Header */}
      <header className="px-6 py-6 border-b border-slate-800/80 flex items-center justify-between max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/kathua-fresh-logo.jpg"
            alt="Kathua Fresh Logo"
            className="w-12 h-12 rounded-2xl object-cover shadow-lg shadow-emerald-500/25 border border-emerald-500/30"
          />
          <div>
            <div className="text-base font-extrabold tracking-tight text-white leading-none">
              Kathua Fresh
            </div>
            <div className="text-xs text-emerald-400 font-semibold mt-1">
              Smart Digital Signage Platform
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold text-slate-300">
            System Ready
          </span>
        </div>
      </header>

      {/* Main Action Portal */}
      <main className="max-w-4xl mx-auto px-6 py-12 flex-1 flex flex-col justify-center">
        <div className="text-center space-y-4 mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Xiaomi MiTV-AXSO0 Compatible • Android 9</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white max-w-2xl mx-auto leading-tight">
            Control Shop TV Offers in{" "}
            <span className="text-emerald-400">Under 60 Seconds</span>
          </h1>

          <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto leading-relaxed">
            Upload daily farm-fresh prices and promotions from your phone.
            Instant publish, permanent QR codes, voice announcements, and
            fail-safe offline playback.
          </p>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto w-full">
          {/* Card 1: Mobile Admin PWA */}
          <Link
            href="/admin/signage"
            className="group p-6 rounded-3xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900/80 transition-all shadow-xl flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/20 group-hover:scale-110 transition-transform">
                <Smartphone className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">
                Mobile Admin PWA
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Add new offers, adjust prices, reorder playlist, manage voice
                announcements, and publish instantly.
              </p>
            </div>

            <div className="pt-6 flex items-center gap-2 text-xs font-bold text-emerald-400 group-hover:translate-x-1 transition-transform">
              <span>Open Admin Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </Link>

          {/* Card 2: TV Display Player */}
          <Link
            href="/tv"
            target="_blank"
            className="group p-6 rounded-3xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900/80 transition-all shadow-xl flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/15 text-blue-400 flex items-center justify-center border border-blue-500/20 group-hover:scale-110 transition-transform">
                <Tv className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                TV Screen Player
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Dedicated 1920x1080 display screen for shop Smart TV. Shows
                promotions, QR codes, and scrolling ticker.
              </p>
            </div>

            <div className="pt-6 flex items-center gap-2 text-xs font-bold text-blue-400 group-hover:translate-x-1 transition-transform">
              <span>Launch TV Display</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </Link>
        </div>

        {/* Android TV APK Download Banner */}
        <div className="mt-4 max-w-2xl mx-auto w-full">
          <a
            href="/KathuaFreshTV.apk"
            download="KathuaFreshTV.apk"
            className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/60 to-slate-900 border border-emerald-500/30 hover:border-emerald-400 flex items-center justify-between transition-all group shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                APK
              </div>
              <div>
                <div className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                  Download Kathua Fresh TV APK
                </div>
                <div className="text-xs text-slate-400">
                  Native Android TV player app (.apk) for Xiaomi MiTV & Android devices
                </div>
              </div>
            </div>
            <div className="text-xs font-bold text-emerald-400 flex items-center gap-1 shrink-0 bg-emerald-500/15 px-3 py-1.5 rounded-lg border border-emerald-500/30">
              <span>Download</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </a>
        </div>

        {/* Feature Checkpoints */}
        <div className="mt-12 max-w-2xl mx-auto w-full pt-8 border-t border-slate-900 flex flex-wrap items-center justify-around gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Zero impact on store database</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Works 100% offline</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Instant &lt;5s sync</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 border-t border-slate-900 text-center text-xs text-slate-500">
        Kathua Fresh Smart Digital Signage System v1.0 • Built for Xiaomi
        MiTV-AXSO0
      </footer>
    </div>
  );
}

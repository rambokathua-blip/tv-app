"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Tv,
  Play,
  Pause,
  SkipForward,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ExternalLink,
  Volume2,
  VolumeX,
} from "lucide-react";
import NewOfferModal from "@/components/signage/NewOfferModal";

export default function SignageDashboardPage() {
  const [isTvOnline, setIsTvOnline] = useState(true);
  const [isTvPaused, setIsTvPaused] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("kathua_audio_enabled");
        if (cached !== null) return JSON.parse(cached);
      } catch {}
    }
    return false;
  });
  const [currentVersion, setCurrentVersion] = useState(1);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [stats, setStats] = useState({
    liveOffers: 3,
    draftOffers: 1,
    expiringToday: 0,
    errors: 0,
    totalDevices: 1,
    lastSyncText: "Just now",
  });
  const [recentPublishes, setRecentPublishes] = useState<
    Array<{ id: string; time: string; note: string; version: number }>
  >([
    {
      id: "pub-1",
      time: "2 mins ago",
      note: "Added Fresh Nashik Onion ₹38/kg",
      version: 1,
    },
  ]);
  const [showNewOfferModal, setShowNewOfferModal] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Load live statistics
  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch("/api/signage/admin/monitoring");
        if (res.ok) {
          const data = await res.json();
          setStats((prev) => ({
            ...prev,
            liveOffers: data.active_promotions_count ?? prev.liveOffers,
            draftOffers: data.draft_promotions_count ?? prev.draftOffers,
            errors: data.recent_errors_count ?? 0,
          }));
          if (data.active_device) {
            setIsTvOnline(data.active_device.status === "active");
            setCurrentVersion(data.active_device.current_version || 1);
          }
        }
      } catch {
        // use fallback initial values
      }
    }
    loadStats();

    // Load initial audio status
    fetch("/api/signage/admin/audio")
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.enabled === "boolean") {
          setIsAudioEnabled(data.enabled);
          try {
            localStorage.setItem("kathua_audio_enabled", JSON.stringify(data.enabled));
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  const handleTvCommand = async (command: "pause" | "resume" | "next") => {
    try {
      if (command === "pause") setIsTvPaused(true);
      if (command === "resume") setIsTvPaused(false);
      setActionMessage(
        command === "next"
          ? "Skipped to next slide"
          : isTvPaused
          ? "TV resumed"
          : "TV paused"
      );
      setTimeout(() => setActionMessage(null), 3000);
    } catch {
      // ignore
    }
  };

  const handleToggleAudio = async () => {
    const nextState = !isAudioEnabled;
    setIsAudioEnabled(nextState);
    try {
      localStorage.setItem("kathua_audio_enabled", JSON.stringify(nextState));
    } catch {}

    // Immediately notify embedded iframe to silence audio
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: "TV_AUDIO_TOGGLE", enabled: nextState },
        "*"
      );
    }

    setActionMessage(nextState ? "Store Audio: ON (TV Syncing)" : "Store Audio: MUTED (TV Syncing)");
    setTimeout(() => setActionMessage(null), 3000);
    try {
      await fetch("/api/signage/admin/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextState }),
      });
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-5">
      {/* TV Status Hero Card (PRD 9.1) */}
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-900/60 border border-slate-800 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div
              className={`w-3.5 h-3.5 rounded-full ${
                isTvOnline
                  ? "bg-emerald-500 shadow-md shadow-emerald-500/50"
                  : "bg-red-500"
              }`}
            />
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Shop TV 1</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                  {isTvOnline ? "ONLINE" : "OFFLINE"}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                <span>Last sync {stats.lastSyncText}</span>
                <span>•</span>
                <span className="text-slate-300">v{currentVersion} Live</span>
              </div>
            </div>
          </div>

          <Link
            href="/admin/signage/more/devices"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
          >
            Manage
          </Link>
        </div>

        {/* Quick Action Controls */}
        <div className="grid grid-cols-3 gap-2 pt-3.5">
          <button
            onClick={() => handleTvCommand(isTvPaused ? "resume" : "pause")}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-2xl text-[11px] font-bold transition-colors ${
              isTvPaused
                ? "bg-amber-500 hover:bg-amber-400 text-slate-950"
                : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
            }`}
          >
            {isTvPaused ? (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Resume TV</span>
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause TV</span>
              </>
            )}
          </button>

          <button
            onClick={() => handleTvCommand("next")}
            className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-bold transition-colors"
          >
            <SkipForward className="w-3.5 h-3.5" />
            <span>Next Slide</span>
          </button>

          <button
            onClick={handleToggleAudio}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-2xl text-[11px] font-bold transition-colors ${
              isAudioEnabled
                ? "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40"
                : "bg-slate-800/80 hover:bg-slate-800 text-slate-400 border border-slate-700"
            }`}
          >
            {isAudioEnabled ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Audio: ON</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-red-400" />
                <span>Audio: OFF</span>
              </>
            )}
          </button>
        </div>

        {actionMessage && (
          <div className="mt-2 text-center text-xs font-semibold text-emerald-400 bg-emerald-500/10 py-1.5 rounded-xl border border-emerald-500/20 animate-in fade-in">
            {actionMessage}
          </div>
        )}
      </div>

      {/* Primary KPI Grid (PRD 9.1) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Link
          href="/admin/signage/offers"
          className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors"
        >
          <div className="text-[11px] font-semibold text-slate-400">Live Offers</div>
          <div className="text-2xl font-black text-emerald-400 mt-1">
            {stats.liveOffers}
          </div>
        </Link>

        <Link
          href="/admin/signage/offers"
          className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors"
        >
          <div className="text-[11px] font-semibold text-slate-400">Drafts</div>
          <div className="text-2xl font-black text-amber-400 mt-1">
            {stats.draftOffers}
          </div>
        </Link>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="text-[11px] font-semibold text-slate-400">Expiring Today</div>
          <div className="text-2xl font-black text-slate-200 mt-1">
            {stats.expiringToday}
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="text-[11px] font-semibold text-slate-400">Errors</div>
          <div
            className={`text-2xl font-black mt-1 ${
              stats.errors > 0 ? "text-red-400" : "text-slate-400"
            }`}
          >
            {stats.errors}
          </div>
        </div>
      </div>

      {/* Mini Live TV Preview (PRD 9.1 & 9.8) */}
      <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tv className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              Live TV Screen (16:9)
            </h2>
          </div>
          <Link
            href="/tv?preview=true"
            target="_blank"
            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
          >
            <span>Full Screen</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Embedded 16:9 Preview Frame (strictly muted in admin preview) */}
        <div className="relative aspect-video rounded-2xl overflow-hidden border border-slate-800 bg-black shadow-inner">
          <iframe
            ref={iframeRef}
            src="/tv?preview=true&muted=true"
            title="TV Preview"
            className="w-full h-full border-0 pointer-events-none"
          />
        </div>
        <p className="text-[11px] text-slate-400 text-center">
          Tap Full Screen to preview on any tablet, TV, or browser.
        </p>
      </div>

      {/* Recent Activity / Publishes (PRD 9.1) */}
      <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Recent Publish Activity
            </h3>
          </div>
        </div>

        <div className="space-y-2">
          {recentPublishes.map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between"
            >
              <div>
                <div className="text-xs font-bold text-white">{item.note}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Version {item.version} • {item.time}
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                Applied
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* New Offer Modal */}
      {showNewOfferModal && (
        <NewOfferModal
          isOpen={showNewOfferModal}
          onClose={() => setShowNewOfferModal(false)}
          onCreated={() => {
            setShowNewOfferModal(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

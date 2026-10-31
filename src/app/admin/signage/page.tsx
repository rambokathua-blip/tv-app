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
  Clock,
  Sparkles,
  ExternalLink,
  Volume2,
  VolumeX,
  AlertCircle,
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
    return true;
  });
  const [currentVersion, setCurrentVersion] = useState(1);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [stats, setStats] = useState({
    liveOffers: 2,
    draftOffers: 0,
    expiringToday: 0,
    errors: 0,
    totalDevices: 1,
    lastSyncText: "Just now",
  });
  const [recentPublishes, setRecentPublishes] = useState<
    Array<{ id: string; time: string; note: string; version: number }>
  >([]);
  const [showNewOfferModal, setShowNewOfferModal] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Load live statistics and monitoring data
  const loadStats = async () => {
    try {
      const res = await fetch("/api/signage/admin/monitoring");
      if (res.ok) {
        const data = await res.json();
        const promos = data.promotions || {};
        setStats({
          liveOffers: promos.live ?? promos.total ?? 2,
          draftOffers: promos.draft ?? 0,
          expiringToday: promos.expired ?? 0,
          errors: Array.isArray(data.recent_errors) ? data.recent_errors.length : 0,
          totalDevices: Array.isArray(data.devices) ? Math.max(1, data.devices.length) : 1,
          lastSyncText: "Just now",
        });

        if (data.latest_version) {
          setCurrentVersion(data.latest_version.version_no || 1);
        }

        if (Array.isArray(data.recent_audit) && data.recent_audit.length > 0) {
          setRecentPublishes(
            data.recent_audit.slice(0, 4).map((a: any, idx: number) => ({
              id: a.id || `audit-${idx}`,
              time: a.at || a.created_at ? new Date(a.at || a.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Just now",
              note: a.details?.message || a.action || "Live Content Updated & Synced",
              version: data.latest_version?.version_no || 1,
            }))
          );
        } else {
          setRecentPublishes([
            {
              id: "pub-init",
              time: "Just now",
              note: "TV Display Snapshot Live & Active",
              version: data.latest_version?.version_no || 1,
            },
          ]);
        }
      }
    } catch {
      // fallback
    }
  };

  useEffect(() => {
    loadStats();

    // Check audio status
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

    // Check version & pause state from latest version
    fetch("/api/signage/device/version")
      .then((res) => res.json())
      .then((data) => {
        if (data.version) setCurrentVersion(data.version);
        if (typeof data.is_paused === "boolean") setIsTvPaused(data.is_paused);
      })
      .catch(() => {});
  }, []);

  // Send TV commands: Pause, Resume, Next Slide
  const handleTvCommand = async (command: "pause" | "resume" | "next") => {
    try {
      const nextPaused = command === "pause" ? true : command === "resume" ? false : isTvPaused;
      if (command !== "next") {
        setIsTvPaused(nextPaused);
      }

      // 1. Send to embedded preview iframe
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          {
            type: command === "pause" ? "PAUSE_TV" : command === "resume" ? "RESUME_TV" : "NEXT_SLIDE",
          },
          "*"
        );
      }

      // 2. Broadcast to local tabs/windows on the same machine
      try {
        const ch = new BroadcastChannel("kathua_tv_sync");
        ch.postMessage({
          type: command === "pause" ? "PAUSE_TV" : command === "resume" ? "RESUME_TV" : "NEXT_SLIDE",
          timestamp: Date.now(),
        });
        ch.close();
      } catch {}

      // 3. Post to Cloud API for remote TV devices across internet
      fetch("/api/signage/admin/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: command, is_paused: nextPaused }),
      }).catch(() => {});

      setActionMessage(
        command === "next"
          ? "⏭️ Skipped to next slide on TV"
          : command === "pause"
          ? "⏸️ TV slideshow paused"
          : "▶️ TV slideshow resumed"
      );
      setTimeout(() => setActionMessage(null), 3000);
    } catch (e) {
      console.error("TV command error:", e);
    }
  };

  // Toggle Background Audio for the TV
  const handleToggleAudio = async () => {
    const nextState = !isAudioEnabled;
    setIsAudioEnabled(nextState);
    try {
      localStorage.setItem("kathua_audio_enabled", JSON.stringify(nextState));
    } catch {}

    // 1. Post to embedded iframe
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: "TV_AUDIO_TOGGLE", enabled: nextState },
        "*"
      );
    }

    // 2. Broadcast to other tabs
    try {
      const ch = new BroadcastChannel("kathua_tv_sync");
      ch.postMessage({ type: "TV_AUDIO_TOGGLE", enabled: nextState, timestamp: Date.now() });
      ch.close();
    } catch {}

    // 3. Post to Supabase Cloud API
    fetch("/api/signage/admin/audio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: nextState }),
    }).catch(() => {});

    setActionMessage(nextState ? "🔊 Store Audio: ON (TV Synced)" : "🔇 Store Audio: MUTED (TV Synced)");
    setTimeout(() => setActionMessage(null), 3000);
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
                  ? "bg-emerald-500 shadow-md shadow-emerald-500/50 animate-pulse"
                  : "bg-red-500"
              }`}
            />
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Shop TV 1</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                  {isTvOnline ? "ONLINE" : "OFFLINE"}
                </span>
                {isTvPaused && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">
                    PAUSED
                  </span>
                )}
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
            className="p-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-bold transition-all border border-slate-700/80"
          >
            Manage
          </Link>
        </div>

        {/* Quick Action Controls */}
        <div className="grid grid-cols-3 gap-2 pt-3.5">
          {/* Pause / Resume Button */}
          <button
            onClick={() => handleTvCommand(isTvPaused ? "resume" : "pause")}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-2xl text-[11px] font-bold transition-all active:scale-95 cursor-pointer shadow-sm ${
              isTvPaused
                ? "bg-amber-500 hover:bg-amber-400 text-slate-950 font-black"
                : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
            }`}
          >
            {isTvPaused ? (
              <>
                <Play className="w-3.5 h-3.5 fill-current text-slate-950" />
                <span>Resume TV</span>
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5 fill-current text-amber-400" />
                <span>Pause TV</span>
              </>
            )}
          </button>

          {/* Next Slide Button */}
          <button
            onClick={() => handleTvCommand("next")}
            className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 text-[11px] font-bold transition-all cursor-pointer shadow-sm"
          >
            <SkipForward className="w-3.5 h-3.5 text-emerald-400" />
            <span>Next Slide</span>
          </button>

          {/* Audio Toggle Button */}
          <button
            onClick={handleToggleAudio}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-2xl text-[11px] font-bold transition-all active:scale-95 cursor-pointer shadow-sm ${
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
          <div className="mt-2.5 text-center text-xs font-bold text-emerald-300 bg-emerald-500/15 py-1.5 rounded-xl border border-emerald-500/30 animate-in fade-in">
            {actionMessage}
          </div>
        )}
      </div>

      {/* Primary KPI Grid (PRD 9.1) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Link
          href="/admin/signage/offers"
          className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 hover:bg-slate-900/80 active:scale-95 transition-all group"
        >
          <div className="text-[11px] font-semibold text-slate-400 group-hover:text-emerald-400 transition-colors">
            Live Offers
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-1">
            {stats.liveOffers}
          </div>
        </Link>

        <Link
          href="/admin/signage/offers"
          className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-500/40 hover:bg-slate-900/80 active:scale-95 transition-all group"
        >
          <div className="text-[11px] font-semibold text-slate-400 group-hover:text-amber-400 transition-colors">
            Drafts
          </div>
          <div className="text-2xl font-black text-amber-400 mt-1">
            {stats.draftOffers}
          </div>
        </Link>

        <Link
          href="/admin/signage/offers"
          className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 active:scale-95 transition-all group"
        >
          <div className="text-[11px] font-semibold text-slate-400 group-hover:text-slate-300 transition-colors">
            Expiring Today
          </div>
          <div className="text-2xl font-black text-slate-200 mt-1">
            {stats.expiringToday}
          </div>
        </Link>

        <Link
          href="/admin/signage/more/devices"
          className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 active:scale-95 transition-all group"
        >
          <div className="text-[11px] font-semibold text-slate-400 group-hover:text-slate-300 transition-colors">
            Errors
          </div>
          <div
            className={`text-2xl font-black mt-1 ${
              stats.errors > 0 ? "text-red-400" : "text-slate-400"
            }`}
          >
            {stats.errors}
          </div>
        </Link>
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
            href="/tv"
            target="_blank"
            className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1.5 py-1 px-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 active:scale-95 transition-all"
          >
            <span>Full Screen</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Embedded 16:9 Preview Frame (Click to open full TV display) */}
        <div
          onClick={() => window.open("/tv", "_blank")}
          className="relative aspect-video rounded-2xl overflow-hidden border border-slate-800 bg-black shadow-inner cursor-pointer group"
          title="Click to view full screen TV"
        >
          <iframe
            ref={iframeRef}
            src="/tv?preview=true&muted=true"
            title="TV Preview"
            className="w-full h-full border-0 pointer-events-none"
          />
          <div className="absolute inset-0 bg-emerald-500/0 group-hover:bg-emerald-500/10 transition-colors flex items-center justify-center">
            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold px-3 py-1.5 rounded-full bg-slate-950/80 text-white border border-emerald-500/40 backdrop-blur-sm shadow-lg flex items-center gap-1.5">
              <span>Open Full Screen TV</span>
              <ExternalLink className="w-3 h-3 text-emerald-400" />
            </span>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 text-center">
          Tap preview or Full Screen to launch on TV screen, monitor, or tablet.
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
          <button
            onClick={loadStats}
            title="Refresh activity"
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
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
            loadStats();
          }}
        />
      )}
    </div>
  );
}

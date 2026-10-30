"use client";

import React, { useState, useEffect } from "react";
import {
  Tv,
  Plus,
  Wifi,
  HardDrive,
  Cpu,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  X,
} from "lucide-react";
import type { SignageDevice } from "@/lib/signage/types";

export default function TvDevicesPage() {
  const [devices, setDevices] = useState<SignageDevice[]>([
    {
      id: "dev-shop-1",
      name: "Shop TV 1 (Front Counter)",
      status: "active",
      app_version: "1.0.0",
      webview_version: "138.0.7204.179",
      android_sdk: 28,
      free_storage_mb: 2048,
      cache_mb: 140,
      current_version: 1,
      last_seen_at: "2026-10-30T00:00:00.000Z",
      created_at: "2026-10-30T00:00:00.000Z",
    },
  ]);

  const [showPairModal, setShowPairModal] = useState(false);
  const [pairCode, setPairCode] = useState("");
  const [isPairing, setIsPairing] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);
  const [pairSuccess, setPairSuccess] = useState(false);

  // Auto-read ?code=... from URL if scanned from TV
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      setPairCode(code);
      setShowPairModal(true);
    }
  }, []);

  const handlePairSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairCode.trim()) return;

    setIsPairing(true);
    setPairError(null);

    try {
      const res = await fetch("/api/signage/admin/pair/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: pairCode.trim().toUpperCase(),
        }),
      });

      if (res.ok) {
        setPairSuccess(true);
        setTimeout(() => {
          setPairSuccess(false);
          setShowPairModal(false);
          setPairCode("");
        }, 2000);
      } else {
        const data = await res.json();
        setPairError(data.error || "Invalid or expired pairing code");
      }
    } catch {
      setPairError("Network connection error");
    } finally {
      setIsPairing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">TV Devices</h1>
          <p className="text-xs text-slate-400">
            Registered displays and Android TV players
          </p>
        </div>

        <button
          onClick={() => setShowPairModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition-transform active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Pair New TV</span>
        </button>
      </div>

      {/* Device Cards List (PRD 9.7) */}
      <div className="space-y-3">
        {devices.map((device) => (
          <div
            key={device.id}
            className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                  <Tv className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{device.name}</h3>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-emerald-400 font-semibold uppercase">
                      {device.status}
                    </span>
                    <span>•</span>
                    <span>v{device.current_version} Active</span>
                  </div>
                </div>
              </div>

              <span className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-slate-800 text-slate-300">
                Xiaomi Mi TV
              </span>
            </div>

            {/* Hardware & Diagnostics stats */}
            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="p-2 rounded-xl bg-slate-950 border border-slate-800/80">
                <div className="text-[10px] text-slate-400">WebView</div>
                <div className="text-xs font-bold text-slate-200 mt-0.5 truncate">
                  v138
                </div>
              </div>
              <div className="p-2 rounded-xl bg-slate-950 border border-slate-800/80">
                <div className="text-[10px] text-slate-400">Storage Free</div>
                <div className="text-xs font-bold text-slate-200 mt-0.5">
                  {device.free_storage_mb ? `${device.free_storage_mb} MB` : "2.0 GB"}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-slate-950 border border-slate-800/80">
                <div className="text-[10px] text-slate-400">Image Cache</div>
                <div className="text-xs font-bold text-slate-200 mt-0.5">
                  {device.cache_mb ? `${device.cache_mb} MB` : "140 MB"}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pair New TV Modal (PRD 9.7 & FR-DV-01) */}
      {showPairModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tv className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Pair Smart TV</h3>
              </div>
              <button
                onClick={() => setShowPairModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Open the TV screen. Enter the <strong>6-character pairing code</strong>{" "}
              shown on the screen below:
            </p>

            <form onSubmit={handlePairSubmit} className="space-y-3">
              <div>
                <input
                  type="text"
                  maxLength={6}
                  autoFocus
                  placeholder="e.g. KTH-842"
                  value={pairCode}
                  onChange={(e) => setPairCode(e.target.value.toUpperCase())}
                  className="w-full text-center text-2xl font-mono font-black tracking-widest px-4 py-3 rounded-2xl bg-slate-950 border-2 border-emerald-500/50 text-emerald-400 placeholder-slate-700 focus:outline-none focus:border-emerald-400"
                />
              </div>

              {pairError && (
                <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 text-center font-semibold">
                  {pairError}
                </div>
              )}

              {pairSuccess && (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 text-center font-bold flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>TV Paired Successfully!</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isPairing || !pairCode.trim()}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-lg shadow-emerald-500/20"
              >
                {isPairing ? "Pairing TV..." : "Claim & Connect TV"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

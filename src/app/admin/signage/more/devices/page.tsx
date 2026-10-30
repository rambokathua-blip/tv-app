"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import jsQR from "jsqr";
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
  Camera,
  QrCode,
  ScanLine,
  Image as ImageIcon,
  Sparkles,
  Keyboard,
} from "lucide-react";
import type { SignageDevice } from "@/lib/signage/types";

function playBeep() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // AudioContext blocked or not supported
  }
}

function extractPairCode(raw: string): string | null {
  try {
    if (raw.includes("code=")) {
      const match = raw.match(/code=([A-Z0-9-]+)/i);
      if (match && match[1]) {
        const clean = match[1].replace(/[^A-Z0-9]/gi, "").toUpperCase();
        if (clean.length === 6) return clean;
      }
    }
    const dashMatch = raw.match(/([A-Z0-9]{3})-?([A-Z0-9]{3})/i);
    if (dashMatch) {
      return (dashMatch[1] + dashMatch[2]).toUpperCase();
    }
    const clean = raw.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    if (clean.length === 6) return clean;
  } catch {
    // ignore
  }
  return null;
}

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
  const [activeTab, setActiveTab] = useState<"camera" | "manual">("camera");
  const [pairCode, setPairCode] = useState("");
  const [isPairing, setIsPairing] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);
  const [pairSuccess, setPairSuccess] = useState(false);
  const [scannedCodeSuccess, setScannedCodeSuccess] = useState<string | null>(null);

  // Camera scanner refs & state
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const claimDeviceCode = useCallback(async (codeToClaim: string) => {
    const cleanCode = codeToClaim.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    if (!cleanCode || cleanCode.length !== 6) {
      setPairError("Invalid pairing code format (must be 6 alphanumeric characters)");
      return;
    }

    setIsPairing(true);
    setPairError(null);
    setScannedCodeSuccess(cleanCode);

    try {
      const res = await fetch("/api/signage/admin/pair/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: cleanCode }),
      });

      if (res.ok) {
        setPairSuccess(true);
        setPairCode(cleanCode);
        setTimeout(() => {
          setPairSuccess(false);
          setShowPairModal(false);
          setPairCode("");
          setScannedCodeSuccess(null);
          stopCamera();
        }, 2200);
      } else {
        const data = await res.json().catch(() => ({}));
        const errorMessage =
          typeof data?.error === "string"
            ? data.error
            : data?.error?.message || "Invalid or expired pairing code";
        setPairError(errorMessage);
        setScannedCodeSuccess(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error. Please try again.";
      setPairError(msg);
      setScannedCodeSuccess(null);
    } finally {
      setIsPairing(false);
    }
  }, [stopCamera]);

  const tickScan = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code && code.data) {
          const extracted = extractPairCode(code.data);
          if (extracted) {
            playBeep();
            stopCamera();
            claimDeviceCode(extracted);
            return;
          }
        }
      }
    }

    animFrameRef.current = requestAnimationFrame(tickScan);
  }, [stopCamera, claimDeviceCode]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error("Camera not supported on this browser");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
        animFrameRef.current = requestAnimationFrame(tickScan);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.name === "NotAllowedError"
          ? "Camera permission denied. Please allow camera permissions in your browser or enter the code manually."
          : "Camera not available. Please enter the code manually or upload a QR screenshot.";
      setCameraError(msg);
    }
  }, [tickScan]);

  // Handle active camera lifecycle
  useEffect(() => {
    if (showPairModal && activeTab === "camera" && !pairSuccess && !isPairing) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [showPairModal, activeTab, pairSuccess, isPairing, startCamera, stopCamera]);

  // Auto-read ?code=... from URL if scanned directly from TV's QR
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      const clean = code.replace(/[^A-Z0-9]/gi, "").toUpperCase();
      setPairCode(clean);
      setShowPairModal(true);
      setActiveTab("manual");
    }
  }, []);

  const handlePairSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairCode.trim()) return;
    claimDeviceCode(pairCode);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsPairing(true);
    setPairError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        // Limit dimensions to 1000px so mobile phone memory doesn't get exhausted
        const maxDim = 1000;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          setIsPairing(false);
          setPairError("Failed to process image canvas");
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "attemptBoth",
        });
        if (code && code.data) {
          const extracted = extractPairCode(code.data);
          if (extracted) {
            playBeep();
            stopCamera();
            claimDeviceCode(extracted);
          } else {
            setIsPairing(false);
            setPairError(`QR code found (${code.data.slice(0, 24)}...), but no valid 6-char code found.`);
          }
        } else {
          setIsPairing(false);
          setPairError("No QR code detected in this photo. Please try a closer, clearer picture or enter code.");
        }
      };
      img.onerror = () => {
        setIsPairing(false);
        setPairError("Could not load image file.");
      };
      img.src = reader.result as string;
    };
    reader.onerror = () => {
      setIsPairing(false);
      setPairError("Could not read file from device.");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Tv className="w-5 h-5 text-emerald-400" />
            <span>TV Devices & Displays</span>
          </h1>
          <p className="text-xs text-slate-400">
            Registered displays and Android TV signage players
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Scanner Button */}
          <button
            onClick={() => {
              setActiveTab("camera");
              setShowPairModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-500/20 active:scale-95"
          >
            <Camera className="w-4 h-4 stroke-[2.5]" />
            <span>Scan TV QR</span>
          </button>

          {/* Manual Code Button */}
          <button
            onClick={() => {
              setActiveTab("manual");
              setShowPairModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-all border border-slate-700/80 active:scale-95"
          >
            <Keyboard className="w-4 h-4 text-slate-400" />
            <span>Enter Code</span>
          </button>
        </div>
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

      {/* Pair New TV Modal with Live QR Scanner */}
      {showPairModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl relative">
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                  <ScanLine className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Pair Smart TV</h3>
                  <p className="text-[11px] text-slate-400">Connect TV screen to store</p>
                </div>
              </div>
              <button
                onClick={() => {
                  stopCamera();
                  setShowPairModal(false);
                }}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switch Tabs */}
            <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab("camera")}
                className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl transition-all ${
                  activeTab === "camera"
                    ? "bg-emerald-500 text-slate-950 shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Scan with Camera</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("manual")}
                className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl transition-all ${
                  activeTab === "manual"
                    ? "bg-emerald-500 text-slate-950 shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Keyboard className="w-3.5 h-3.5" />
                <span>Enter 6-char Code</span>
              </button>
            </div>

            {/* TAB 1: LIVE CAMERA SCANNER */}
            {activeTab === "camera" && (
              <div className="space-y-3">
                {cameraError ? (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-center space-y-3">
                    <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto" />
                    <p className="text-xs text-amber-200 leading-relaxed font-medium">
                      {cameraError}
                    </p>
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={startCamera}
                        className="px-3 py-1.5 bg-amber-500 text-slate-950 font-bold text-xs rounded-lg"
                      >
                        Try Again
                      </button>
                      <label
                        htmlFor="qr-file-upload-error-input"
                        className="cursor-pointer px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs rounded-lg inline-flex items-center gap-1.5"
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Upload Photo</span>
                        <input
                          id="qr-file-upload-error-input"
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="sr-only"
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="relative w-full aspect-square bg-black rounded-2xl overflow-hidden border-2 border-emerald-500/40 shadow-inner">
                    {/* Hidden canvas for jsQR analysis */}
                    <canvas ref={canvasRef} className="hidden" />

                    {/* Camera Feed */}
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      playsInline
                      muted
                    />

                    {/* Laser Scanner Viewfinder Overlay */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      {/* Dark vignette corners */}
                      <div className="w-48 h-48 relative border-2 border-emerald-400/60 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                        {/* 4 Corner Targeting Marks */}
                        <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                        <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                        <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

                        {/* Animated Laser Beam */}
                        <div
                          className="absolute left-0 right-0 h-0.5 bg-emerald-400 shadow-[0_0_12px_#34d399]"
                          style={{
                            animation: "laser 2s cubic-bezier(0.4, 0, 0.2, 1) infinite",
                          }}
                        />
                      </div>
                    </div>

                    <div className="absolute bottom-2 inset-x-0 text-center">
                      <span className="text-[11px] font-semibold text-white/90 bg-black/60 px-3 py-1 rounded-full backdrop-blur-sm">
                        Point camera at TV screen QR
                      </span>
                    </div>
                  </div>
                )}

                {/* Upload Photo Option */}
                <div className="text-center pt-2">
                  <label
                    htmlFor="qr-file-upload-input"
                    className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700/80 text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition-all shadow-sm"
                  >
                    <ImageIcon className="w-4 h-4 text-emerald-400" />
                    <span>Upload QR Screenshot / Photo</span>
                    <input
                      id="qr-file-upload-input"
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* TAB 2: MANUAL CODE ENTRY */}
            {activeTab === "manual" && (
              <form onSubmit={handlePairSubmit} className="space-y-3">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Enter the <strong>6-character pairing code</strong> shown on your TV screen:
                </p>

                <div>
                  <input
                    type="text"
                    maxLength={8}
                    autoFocus
                    placeholder="e.g. KTH-842"
                    value={pairCode}
                    onChange={(e) => setPairCode(e.target.value.toUpperCase())}
                    className="w-full text-center text-2xl font-mono font-black tracking-widest px-4 py-3 rounded-2xl bg-slate-950 border-2 border-emerald-500/50 text-emerald-400 placeholder-slate-700 focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isPairing || !pairCode.trim()}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                >
                  {isPairing ? "Pairing TV..." : "Claim & Connect TV"}
                </button>
              </form>
            )}

            {/* Status Messages */}
            {pairError && (
              <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 text-center font-semibold">
                {pairError}
              </div>
            )}

            {isPairing && scannedCodeSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 text-center font-bold flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                <span>Scanned {scannedCodeSuccess} — Pairing with TV...</span>
              </div>
            )}

            {pairSuccess && (
              <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 text-center font-bold flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>TV Paired Successfully! Starting Signage...</span>
              </div>
            )}

            <style jsx>{`
              @keyframes laser {
                0% {
                  top: 10%;
                  opacity: 0.8;
                }
                50% {
                  top: 85%;
                  opacity: 1;
                }
                100% {
                  top: 10%;
                  opacity: 0.8;
                }
              }
            `}</style>
          </div>
        </div>
      )}
    </div>
  );
}


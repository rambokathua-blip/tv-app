"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import QRCode from "qrcode";
import type { SignageManifest, ManifestSlide } from "@/lib/signage/types";

// Fallback demo manifest for preview or cold start before any network fetch
const FALLBACK_MANIFEST: SignageManifest = {
  version: 1,
  generated_at: "2026-10-30T00:00:00.000Z",
  branding: {
    website_text: "www.kathuafresh.in",
    tagline: "Always Pure, Always Fresh",
    ticker_text:
      "Welcome to Kathua Fresh • Fresh Farm Fruits & Vegetables Daily • 100% Quality Guaranteed • Scan QR Code to Join WhatsApp Channel for Daily Special Offers",
    ticker_enabled: true,
    layout_profile: "standard",
  },
  qr_codes: [
    {
      id: "qr-wa",
      label: "WhatsApp Channel",
      target_url: "https://whatsapp.com/channel/kathuafresh",
      caption: "Scan for daily wholesale rates & deals",
    },
    {
      id: "qr-ig",
      label: "Instagram",
      target_url: "https://instagram.com/kathuafresh",
      caption: "Follow us @kathuafresh",
    },
  ],
  slides: [
    {
      id: "welcome-slide",
      promotion_id: "promo-welcome",
      title: "Welcome to Kathua Fresh",
      price_text: "Fresh & Organic Daily",
      duration_sec: 10,
      image_url:
        "https://images.unsplash.com/photo-1610832958506-aa56368176cf?q=80&w=1920&auto=format&fit=crop",
    },
    {
      id: "demo-onion",
      promotion_id: "promo-onion",
      title: "Fresh Nashik Onions",
      price_text: "₹38 / kg",
      duration_sec: 10,
      image_url:
        "https://images.unsplash.com/photo-1508747703725-719777637510?q=80&w=1920&auto=format&fit=crop",
    },
    {
      id: "demo-apple",
      promotion_id: "promo-apple",
      title: "Kashmiri Royal Apples",
      price_text: "₹120 / kg",
      duration_sec: 10,
      image_url:
        "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?q=80&w=1920&auto=format&fit=crop",
    },
  ],
};

declare global {
  interface Window {
    AndroidSignage?: {
      speak: (text: string, lang: string) => void;
      playAudio: (url: string) => void;
      getStorageInfo: () => string;
    };
  }
}

export default function TvPlayerPage() {
  const [token, setToken] = useState<string | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pollSecret, setPollSecret] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<number>(300);
  const [pairingQrSvg, setPairingQrSvg] = useState<string>("");

  const [manifest, setManifest] = useState<SignageManifest>(FALLBACK_MANIFEST);
  const [qrSvgMap, setQrSvgMap] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const [slideProgress, setSlideProgress] = useState(0);
  const [isOffline, setIsOffline] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Initialize and check token or preview mode
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paramToken = params.get("token");
    const previewMode = params.get("preview") === "true";

    setIsPreview(previewMode);

    const savedToken =
      paramToken || localStorage.getItem("signage_device_token");
    if (savedToken) {
      setToken(savedToken);
      localStorage.setItem("signage_device_token", savedToken);
    }

    const cachedManifest = localStorage.getItem("signage_cached_manifest");
    if (cachedManifest) {
      try {
        setManifest(JSON.parse(cachedManifest));
      } catch {
        // use fallback
      }
    }
  }, []);

  // Pairing Flow: if no token and not preview, request pairing code
  const startPairing = useCallback(async () => {
    try {
      const res = await fetch("/api/signage/device/pair/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_version: "1.0.0",
          android_sdk: 28,
          webview_version: navigator.userAgent,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPairingCode(data.code);
        setPollSecret(data.poll_secret);
        setExpiresIn(data.expires_in_sec || 300);

        // Generate QR code for admin quick pair URL
        const adminPairUrl = `${window.location.origin}/admin/signage/more/devices?code=${data.code}`;
        const svg = await QRCode.toString(adminPairUrl, {
          type: "svg",
          margin: 1,
          color: { dark: "#0f172a", light: "#ffffff" },
        });
        setPairingQrSvg(svg);
      }
    } catch {
      // Offline or network error
      setIsOffline(true);
    }
  }, []);

  useEffect(() => {
    if (!token && !isPreview) {
      startPairing();
    }
  }, [token, isPreview, startPairing]);

  // Poll pairing status
  useEffect(() => {
    if (!pollSecret || token || isPreview) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/signage/device/pair/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ poll_secret: pollSecret }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.status === "claimed" && data.token) {
            localStorage.setItem("signage_device_token", data.token);
            setToken(data.token);
            setPairingCode(null);
            setPollSecret(null);
          } else if (data.status === "expired") {
            startPairing();
          }
        }
      } catch {
        // network issue
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [pollSecret, token, isPreview, startPairing]);

  // Countdown timer for pairing code
  useEffect(() => {
    if (!pairingCode) return;
    const timer = setInterval(() => {
      setExpiresIn((prev) => {
        if (prev <= 1) {
          startPairing();
          return 300;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [pairingCode, startPairing]);

  // Manifest Fetching
  const fetchManifest = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/signage/device/manifest", { headers });
      if (res.ok) {
        const data = await res.json();
        setManifest(data);
        localStorage.setItem("signage_cached_manifest", JSON.stringify(data));
        setIsOffline(false);
      }
    } catch {
      setIsOffline(true);
    }
  }, [token]);

  useEffect(() => {
    if (token || isPreview) {
      fetchManifest();
    }
  }, [token, isPreview, fetchManifest]);

  // Periodic Version Check & Heartbeat
  useEffect(() => {
    if (!token && !isPreview) return;

    // Version polling every 20 seconds
    const versionPoll = setInterval(async () => {
      try {
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch("/api/signage/device/version", { headers });
        if (res.ok) {
          const data = await res.json();
          if (data.version && data.version > manifest.version) {
            fetchManifest();
          }
          setIsOffline(false);
        }
      } catch {
        setIsOffline(true);
      }
    }, 20000);

    // Heartbeat every 60 seconds
    const heartbeatTimer = setInterval(async () => {
      if (!token) return;
      try {
        const currentSlide = manifest.slides[currentIndex]?.id;
        await fetch("/api/signage/device/heartbeat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            current_slide_id: currentSlide,
            current_version: manifest.version,
            app_version: "1.0.0",
            android_sdk: 28,
            webview_version: navigator.userAgent,
            free_storage_mb: 2048,
            cache_mb: 120,
          }),
        });
      } catch {
        // Ignore heartbeat error
      }
    }, 60000);

    return () => {
      clearInterval(versionPoll);
      clearInterval(heartbeatTimer);
    };
  }, [token, isPreview, manifest.version, manifest.slides, currentIndex, fetchManifest]);

  // Generate SVG QR codes for manifest QR items
  useEffect(() => {
    async function generateQrs() {
      const map: Record<string, string> = {};
      for (const qr of manifest.qr_codes) {
        try {
          const svg = await QRCode.toString(qr.target_url, {
            type: "svg",
            margin: 1,
            color: { dark: "#0f172a", light: "#ffffff" },
          });
          map[qr.id] = svg;
        } catch {
          // ignore error
        }
      }
      setQrSvgMap(map);
    }
    if (manifest.qr_codes && manifest.qr_codes.length > 0) {
      generateQrs();
    }
  }, [manifest.qr_codes]);

  // Slideshow Cycle
  const slides = manifest.slides && manifest.slides.length > 0 ? manifest.slides : FALLBACK_MANIFEST.slides;

  useEffect(() => {
    if (slides.length <= 1 || isPaused) return;

    const currentSlide = slides[currentIndex] || slides[0];
    const duration = (currentSlide.duration_sec || 10) * 1000;
    const startTime = Date.now();

    // Progress bar update
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / duration) * 100, 100);
      setSlideProgress(progress);
    }, 50);

    // Slide transition timer
    const slideTimer = setTimeout(() => {
      const next = (currentIndex + 1) % slides.length;
      setNextIndex(next);
      setIsFading(true);

      setTimeout(() => {
        setCurrentIndex(next);
        setIsFading(false);
        setSlideProgress(0);
      }, 600); // 600ms cross-fade matching PRD FR-PL-05
    }, duration);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(slideTimer);
    };
  }, [slides, currentIndex, isPaused]);

  // Speech Announcement trigger
  const triggerAnnouncement = useCallback(
    (text: string, lang = "hi-IN") => {
      if (window.AndroidSignage?.speak) {
        window.AndroidSignage.speak(text, lang);
      } else if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        window.speechSynthesis.speak(utterance);
      }
    },
    []
  );

  // Keyboard shortcut for TV testing or remote controls: Space = Pause, Right = Next, Left = Prev
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsPaused((p) => !p);
      } else if (e.code === "ArrowRight") {
        setCurrentIndex((prev) => (prev + 1) % slides.length);
        setSlideProgress(0);
      } else if (e.code === "ArrowLeft") {
        setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
        setSlideProgress(0);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [slides.length]);

  // If Pairing Mode is required
  if (!token && !isPreview && pairingCode) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #064e3b 0%, #022c22 100%)",
          color: "#fff",
          position: "relative",
          textAlign: "center",
        }}
      >
        <div style={{ position: "absolute", top: 40, left: 60, display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: "50%",
              backgroundColor: "#22c55e",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 24,
              color: "#064e3b",
            }}
          >
            KF
          </div>
          <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: "0.05em" }}>
            KATHUA FRESH TV
          </span>
        </div>

        <div
          style={{
            background: "rgba(255, 255, 255, 0.07)",
            backdropFilter: "blur(20px)",
            borderRadius: 28,
            padding: "50px 70px",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            maxWidth: 900,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          }}
        >
          <div style={{ fontSize: 24, color: "#86efac", textTransform: "uppercase", letterSpacing: 3, fontWeight: 600 }}>
            Device Registration
          </div>
          <h1 style={{ fontSize: 52, fontWeight: 800, margin: "16px 0 32px 0", letterSpacing: "-0.02em" }}>
            Pair this TV Screen
          </h1>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 50,
              margin: "20px 0",
            }}
          >
            <div
              style={{
                backgroundColor: "#fff",
                padding: 16,
                borderRadius: 20,
                width: 220,
                height: 220,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              dangerouslySetInnerHTML={{ __html: pairingQrSvg }}
            />

            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 20, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>
                Or enter this 6-character code in your phone:
              </div>
              <div
                style={{
                  fontSize: 76,
                  fontWeight: 900,
                  letterSpacing: 12,
                  color: "#4ade80",
                  fontFamily: "monospace",
                  background: "rgba(0,0,0,0.3)",
                  padding: "10px 28px",
                  borderRadius: 16,
                  border: "2px solid #22c55e",
                  display: "inline-block",
                }}
              >
                {pairingCode}
              </div>
              <div style={{ marginTop: 14, fontSize: 18, color: "#cbd5e1" }}>
                Code expires in: <strong style={{ color: "#facc15" }}>{expiresIn}s</strong>
              </div>
            </div>
          </div>

          <p style={{ fontSize: 20, color: "rgba(255, 255, 255, 0.75)", marginTop: 30, maxWidth: 640 }}>
            Open <strong>Kathua Fresh Admin</strong> on your phone &rarr; Tap <strong>More</strong> &rarr; <strong>TV Devices</strong> &rarr; <strong>Pair TV</strong>
          </p>
        </div>

        {isOffline && (
          <div
            style={{
              position: "absolute",
              bottom: 24,
              backgroundColor: "rgba(239, 68, 68, 0.8)",
              padding: "8px 20px",
              borderRadius: 30,
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            ● Waiting for network connection...
          </div>
        )}
      </div>
    );
  }

  // Active Slideshow Rendering
  const currentSlide: ManifestSlide = slides[currentIndex] || slides[0];
  const nextSlide: ManifestSlide = slides[nextIndex] || slides[0];

  return (
    <div
      style={{
        width: "1920px",
        height: "1080px",
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#09090b",
        transformOrigin: "top left",
        transform: `scale(${typeof window !== "undefined" ? window.innerWidth / 1920 : 1})`,
      }}
    >
      {/* ============================================================ */}
      {/* ZONE A: PROMOTION AREA (1500 x 844, 16:9)                   */}
      {/* ============================================================ */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1500,
          height: 844,
          backgroundColor: "#000",
          overflow: "hidden",
        }}
      >
        {/* Current Slide */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: isFading ? 0 : 1,
            transition: "opacity 600ms ease-in-out",
          }}
        >
          {currentSlide.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentSlide.image_url}
              alt={currentSlide.title}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "radial-gradient(circle, #065f46 0%, #022c22 100%)",
              }}
            >
              <h2 style={{ fontSize: 64, fontWeight: 800, color: "#fff" }}>
                {currentSlide.title}
              </h2>
            </div>
          )}

          {/* Price overlay banner (if specified in promotion) */}
          {currentSlide.price_text && (
            <div
              style={{
                position: "absolute",
                bottom: 40,
                left: 40,
                backgroundColor: "rgba(15, 23, 42, 0.88)",
                backdropFilter: "blur(12px)",
                padding: "16px 36px",
                borderRadius: 20,
                border: "2px solid #22c55e",
                boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
              }}
            >
              <div style={{ fontSize: 28, color: "#86efac", fontWeight: 700, textTransform: "uppercase" }}>
                {currentSlide.title}
              </div>
              <div style={{ fontSize: 68, fontWeight: 900, color: "#facc15", letterSpacing: "-0.02em" }}>
                {currentSlide.price_text}
              </div>
            </div>
          )}
        </div>

        {/* Next Slide (pre-decoded for smooth crossfade) */}
        {isFading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: 1,
            }}
          >
            {nextSlide.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={nextSlide.image_url}
                alt={nextSlide.title}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            )}
          </div>
        )}

        {/* Slide Progress Line at bottom of promo area */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: `${slideProgress}%`,
            height: 6,
            backgroundColor: "#22c55e",
            boxShadow: "0 0 12px #22c55e",
            transition: "width 50ms linear",
            zIndex: 10,
          }}
        />
      </div>

      {/* ============================================================ */}
      {/* ZONE B: BRAND PANEL (Top-right, 420 x 150)                   */}
      {/* ============================================================ */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 420,
          height: 150,
          background: "linear-gradient(180deg, #064e3b 0%, #065f46 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: "0 24px",
          borderBottom: "2px solid rgba(255, 255, 255, 0.1)",
          boxShadow: "-10px 0 25px rgba(0,0,0,0.4)",
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 20,
            backgroundColor: "#22c55e",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 8px 16px rgba(0,0,0,0.3)",
          }}
        >
          <span style={{ fontSize: 36, fontWeight: 900, color: "#064e3b" }}>KF</span>
        </div>
        <div>
          <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: "0.04em", color: "#ffffff", lineHeight: 1.1 }}>
            KATHUA FRESH
          </div>
          <div style={{ fontSize: 16, color: "#86efac", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {manifest.branding?.tagline || "Farm Fresh Daily"}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* ZONE C: QR PANEL (Right side, 420 x 694)                     */}
      {/* ============================================================ */}
      <div
        style={{
          position: "absolute",
          top: 150,
          right: 0,
          width: 420,
          height: 694,
          backgroundColor: "#0f172a",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-evenly",
          padding: "24px 20px",
          borderLeft: "2px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "-10px 0 30px rgba(0,0,0,0.5)",
        }}
      >
        {manifest.qr_codes?.slice(0, 2).map((qr) => (
          <div
            key={qr.id}
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              borderRadius: 24,
              padding: "16px 20px",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: 370,
              boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
            }}
          >
            <div
              style={{
                backgroundColor: "#ffffff",
                padding: 10,
                borderRadius: 16,
                width: 220,
                height: 220,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              dangerouslySetInnerHTML={{ __html: qrSvgMap[qr.id] || "" }}
            />
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: "#22c55e",
                marginTop: 12,
                textAlign: "center",
              }}
            >
              {qr.label}
            </div>
            {qr.caption && (
              <div
                style={{
                  fontSize: 16,
                  color: "#cbd5e1",
                  marginTop: 4,
                  textAlign: "center",
                  lineHeight: 1.2,
                }}
              >
                {qr.caption}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ============================================================ */}
      {/* ZONE D: BOTTOM BAR & TICKER (1920 x 236)                     */}
      {/* ============================================================ */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: 1920,
          height: 236,
          background: "linear-gradient(90deg, #022c22 0%, #064e3b 50%, #022c22 100%)",
          borderTop: "3px solid #22c55e",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "20px 48px",
          boxShadow: "0 -10px 30px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
            <span style={{ fontSize: 24, color: "#86efac", fontWeight: 700, textTransform: "uppercase" }}>
              Order Online / Visit:
            </span>
            <span
              style={{
                fontSize: 64,
                fontWeight: 900,
                color: "#ffffff",
                letterSpacing: "0.02em",
                textShadow: "0 4px 12px rgba(0,0,0,0.5)",
              }}
            >
              {manifest.branding?.website_text || "www.kathuafresh.in"}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                padding: "8px 20px",
                borderRadius: 30,
                backgroundColor: "rgba(34, 197, 94, 0.2)",
                border: "1px solid #22c55e",
                color: "#4ade80",
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              STORE OPEN • FRESH STOCK ARRIVED
            </div>
          </div>
        </div>

        {/* Ticker marquee */}
        {manifest.branding?.ticker_enabled && (
          <div
            style={{
              backgroundColor: "rgba(0, 0, 0, 0.4)",
              borderRadius: 12,
              padding: "10px 20px",
              overflow: "hidden",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
            }}
          >
            <style>{`
              @keyframes signageTicker {
                0% { transform: translateX(100%); }
                100% { transform: translateX(-100%); }
              }
            `}</style>
            <div
              style={{
                display: "inline-block",
                animation: "signageTicker 35s linear infinite",
                fontSize: 26,
                fontWeight: 600,
                color: "#fef08a",
                letterSpacing: "0.03em",
              }}
            >
              {manifest.branding.ticker_text}
            </div>
          </div>
        )}
      </div>

      {/* Discrete Offline Indicator Dot (PRD 10.4) */}
      {isOffline && (
        <div
          title="Offline mode: playing cached playlist"
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            width: 12,
            height: 12,
            borderRadius: "50%",
            backgroundColor: "#ef4444",
            boxShadow: "0 0 10px #ef4444",
            zIndex: 999,
          }}
        />
      )}

      {/* Preview Label (PRD 9.8) */}
      {isPreview && (
        <div
          style={{
            position: "absolute",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "rgba(234, 88, 12, 0.95)",
            color: "#ffffff",
            padding: "8px 24px",
            borderRadius: 20,
            fontWeight: 800,
            fontSize: 20,
            letterSpacing: 2,
            textTransform: "uppercase",
            boxShadow: "0 8px 20px rgba(0,0,0,0.5)",
            zIndex: 1000,
          }}
        >
          PREVIEW MODE — NOT LIVE ON TV
        </div>
      )}
    </div>
  );
}

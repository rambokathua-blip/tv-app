"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import QRCode from "qrcode";
import type { SignageManifest, ManifestSlide } from "@/lib/signage/types";

// Fallback demo manifest for preview or cold start before any network fetch
const FALLBACK_MANIFEST: SignageManifest = {
  version: 1,
  generated_at: "2026-10-30T00:00:00.000Z",
  branding: {
    logo_url: "/kathua-fresh-logo.jpg",
    website_text: "www.kathuafresh.in",
    tagline: "Quality Assured | Always Fresh",
    ticker_text:
      "Welcome to Kathua Fresh • Quality Assured | Always Fresh • Farm Fresh Fruits & Vegetables Daily • 100% Guaranteed • Scan WhatsApp QR for Daily Mandi Rates",
    ticker_enabled: true,
    layout_profile: "standard",
  },
  qr_codes: [
    {
      id: "qr-wa",
      label: "WhatsApp Channel",
      target_url: "https://whatsapp.com/channel/0029Vb6WRPz2UPBI3hSeQE1B",
      caption: "Join for daily wholesale rates & deals",
    },
    {
      id: "qr-ig",
      label: "Instagram",
      target_url: "https://www.instagram.com/kathua_fresh/",
      caption: "Follow @kathua_fresh for daily offers",
    },
  ],
  slides: [
    {
      id: "welcome-slide",
      promotion_id: "promo-welcome",
      title: "Welcome to Kathua Fresh",
      price_text: "Fresh & Organic Daily",
      duration_sec: 10,
      image_url: "/kathua-fresh-logo.jpg",
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
  audio: {
    enabled: true,
    url: "/store-audio.mp3",
    volume: 0.8,
    loop: true,
  },
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
  const [windowScale, setWindowScale] = useState(() => {
    if (typeof window !== "undefined") {
      return Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    }
    return 1;
  });

  // Dynamic uniform scaling to fit 1920x1080 canvas into any screen or window without cropping
  useEffect(() => {
    const updateScale = () => {
      const scaleX = window.innerWidth / 1920;
      const scaleY = window.innerHeight / 1080;
      setWindowScale(Math.min(scaleX, scaleY));
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  // Live Broadcast Announcement State
  const [activeBroadcast, setActiveBroadcast] = useState<{
    id: string;
    text: string;
    lang: string;
    audio_url?: string | null;
  } | null>(null);
  const lastBroadcastIdRef = useRef<string | null>(null);
  const announcementAudioRef = useRef<HTMLAudioElement | null>(null);
  const wasBgPlayingRef = useRef<boolean>(false);

  // Background Audio State & Controls
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  // Sync background audio with manifest and user preference
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const audioConfig = manifest.audio ?? FALLBACK_MANIFEST.audio;
    const isRemotelyEnabled = audioConfig?.enabled ?? true;
    const shouldPlay = isRemotelyEnabled && !isAudioMuted;

    if (audioConfig?.volume !== undefined) {
      audio.volume = Math.max(0, Math.min(1, audioConfig.volume));
    }

    // Do not resume background audio if a live announcement is currently broadcasting
    if (activeBroadcast) return;

    if (shouldPlay) {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsAudioPlaying(true);
            setAutoplayBlocked(false);
          })
          .catch(() => {
            // Browser autoplay restrictions blocked audio
            setIsAudioPlaying(false);
            setAutoplayBlocked(true);
          });
      }
    } else {
      audio.pause();
      setIsAudioPlaying(false);
    }
  }, [manifest.audio, isAudioMuted, activeBroadcast]);

  // Click / Key gesture to unblock autoplay
  useEffect(() => {
    const handleGesture = () => {
      if (autoplayBlocked && audioRef.current && !isAudioMuted) {
        audioRef.current
          .play()
          .then(() => {
            setIsAudioPlaying(true);
            setAutoplayBlocked(false);
          })
          .catch(() => {});
      }
    };
    window.addEventListener("click", handleGesture);
    window.addEventListener("keydown", handleGesture);
    return () => {
      window.removeEventListener("click", handleGesture);
      window.removeEventListener("keydown", handleGesture);
    };
  }, [autoplayBlocked, isAudioMuted]);

  const toggleTvAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isAudioMuted || audio.paused) {
      audio.muted = false;
      audio
        .play()
        .then(() => {
          setIsAudioMuted(false);
          setIsAudioPlaying(true);
          setAutoplayBlocked(false);
        })
        .catch(() => {});
    } else {
      audio.pause();
      setIsAudioMuted(true);
      setIsAudioPlaying(false);
    }
  };

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
        const dataUrl = await QRCode.toDataURL(adminPairUrl, {
          margin: 1,
          width: 300,
          color: { dark: "#0f172a", light: "#ffffff" },
        });
        setPairingQrSvg(dataUrl);
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

    // Version polling every 3.5 seconds for instant real-time broadcasts
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
    }, 3500);

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

        // Background ping to Supabase keep-alive endpoint
        fetch("/api/keep-alive").catch(() => {});
      } catch {
        // Ignore heartbeat error
      }
    }, 60000);

    return () => {
      clearInterval(versionPoll);
      clearInterval(heartbeatTimer);
    };
  }, [token, isPreview, manifest.version, manifest.slides, currentIndex, fetchManifest]);

  // Listen for Live Broadcast Announcements
  useEffect(() => {
    const ann = manifest.active_announcement;
    if (!ann || !ann.id || ann.id === lastBroadcastIdRef.current) return;

    lastBroadcastIdRef.current = ann.id;
    setActiveBroadcast(ann);

    // ZERO-COLLISION: Completely pause background audio while broadcast plays
    const bgAudio = audioRef.current;
    if (bgAudio && !bgAudio.paused) {
      wasBgPlayingRef.current = true;
      bgAudio.pause();
    } else {
      wasBgPlayingRef.current = false;
    }

    const speechVolume = manifest.voice?.settings?.volume ? manifest.voice.settings.volume / 100 : 1;

    // Helper to safely restore background audio after announcement completes fully
    const resumeBackground = () => {
      setTimeout(() => {
        setActiveBroadcast(null);
        const audioConfig = manifest.audio ?? FALLBACK_MANIFEST.audio;
        const isRemotelyEnabled = audioConfig?.enabled ?? true;
        if (wasBgPlayingRef.current && isRemotelyEnabled && !isAudioMuted && audioRef.current) {
          audioRef.current.play().catch(() => {});
        }
      }, 800);
    };

    // Realistic Natural Voice URL
    const langCode = (ann.lang || "hi").toLowerCase().startsWith("hi") ? "hi" : "en";
    const ttsUrl =
      ann.audio_url ||
      `/api/signage/admin/voice/tts?text=${encodeURIComponent(ann.text)}&lang=${langCode}`;

    const annAudio = announcementAudioRef.current;
    if (annAudio) {
      annAudio.pause();
      annAudio.src = ttsUrl;
      annAudio.volume = Math.max(0.1, Math.min(1, speechVolume));

      annAudio.onended = () => {
        resumeBackground();
      };

      annAudio.onerror = () => {
        // Fallback to browser SpeechSynthesis if network stream fails
        if ("speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(ann.text);
          utterance.lang = ann.lang || "hi-IN";
          utterance.rate = 0.95;
          utterance.volume = speechVolume;
          utterance.onend = resumeBackground;
          utterance.onerror = resumeBackground;
          window.speechSynthesis.speak(utterance);
        } else if ((window as any).AndroidSignage?.speak) {
          (window as any).AndroidSignage.speak(ann.text, ann.lang || "hi-IN");
          setTimeout(resumeBackground, 6000);
        } else {
          resumeBackground();
        }
      };

      const playPromise = annAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          if ("speechSynthesis" in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(ann.text);
            utterance.lang = ann.lang || "hi-IN";
            utterance.rate = 0.95;
            utterance.volume = speechVolume;
            utterance.onend = resumeBackground;
            utterance.onerror = resumeBackground;
            window.speechSynthesis.speak(utterance);
          } else {
            resumeBackground();
          }
        });
      }
    } else {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(ann.text);
        utterance.lang = ann.lang || "hi-IN";
        utterance.rate = 0.95;
        utterance.volume = speechVolume;
        utterance.onend = resumeBackground;
        utterance.onerror = resumeBackground;
        window.speechSynthesis.speak(utterance);
      } else {
        resumeBackground();
      }
    }
  }, [manifest.active_announcement, isAudioMuted, manifest.audio, manifest.voice?.settings]);

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
        <div style={{ position: "absolute", top: 40, left: 60, display: "flex", alignItems: "center", gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/kathua-fresh-logo.jpg"
            alt="Kathua Fresh Logo"
            style={{
              width: 60,
              height: 60,
              borderRadius: 16,
              objectFit: "cover",
              boxShadow: "0 6px 16px rgba(0,0,0,0.4)",
              border: "1px solid rgba(255,255,255,0.2)",
            }}
          />
          <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: "0.05em" }}>
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
                padding: 12,
                borderRadius: 20,
                width: 220,
                height: 220,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {pairingQrSvg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={pairingQrSvg}
                  alt="Pairing QR Code"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    display: "block",
                  }}
                />
              ) : (
                <div style={{ color: "#64748b", fontSize: 13, fontWeight: 600 }}>
                  Generating QR...
                </div>
              )}
            </div>

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
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#000000",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: "1920px",
          height: "1080px",
          position: "relative",
          overflow: "hidden",
          backgroundColor: "#09090b",
          transformOrigin: "center center",
          transform: `scale(${windowScale})`,
          flexShrink: 0,
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
              onError={(e) => {
                if (e.currentTarget.src !== "/kathua-fresh-logo.jpg") {
                  e.currentTarget.src = "/kathua-fresh-logo.jpg";
                }
              }}
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
                onError={(e) => {
                  if (e.currentTarget.src !== "/kathua-fresh-logo.jpg") {
                    e.currentTarget.src = "/kathua-fresh-logo.jpg";
                  }
                }}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            )}
          </div>
        )}

        {/* On-Air Live Announcement Overlay Banner */}
        {activeBroadcast && (
          <div
            style={{
              position: "absolute",
              top: 28,
              left: 36,
              right: 36,
              zIndex: 40,
              backgroundColor: "rgba(2, 44, 34, 0.94)",
              backdropFilter: "blur(24px)",
              border: "3px solid #22c55e",
              borderRadius: 24,
              padding: "20px 32px",
              boxShadow: "0 25px 60px rgba(0,0,0,0.85), 0 0 35px rgba(34, 197, 94, 0.4)",
              display: "flex",
              alignItems: "center",
              gap: 24,
            }}
          >
            {/* Pulsing Speaker Icon */}
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 20,
                backgroundColor: "#22c55e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 30px #22c55e",
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 40 }}>📢</span>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "#86efac",
                  }}
                >
                  Live Store Announcement • दुकान सूचना
                </span>
                <span
                  style={{
                    backgroundColor: "#ef4444",
                    color: "#ffffff",
                    fontSize: 11,
                    fontWeight: 900,
                    padding: "3px 10px",
                    borderRadius: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      backgroundColor: "#fff",
                    }}
                  />
                  Broadcasting Now
                </span>
              </div>

              <div
                style={{
                  fontSize: 32,
                  fontWeight: 900,
                  color: "#ffffff",
                  lineHeight: 1.25,
                  textShadow: "0 2px 8px rgba(0,0,0,0.6)",
                }}
              >
                &ldquo;{activeBroadcast.text}&rdquo;
              </div>
            </div>
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
      {/* ============================================================ */}
      {/* ZONE B & C: CREATIVE BRAND & IRRESISTIBLE SMART QR SIDEBAR   */}
      {/* ============================================================ */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 420,
          height: 844,
          background: "linear-gradient(180deg, #021a12 0%, #06281e 20%, #081d2a 60%, #05121b 100%)",
          borderLeft: "2px solid rgba(34, 197, 94, 0.32)",
          boxShadow: "-12px 0 35px rgba(0, 0, 0, 0.65), inset 1px 0 0 rgba(255, 255, 255, 0.08)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "16px 16px 14px",
          overflow: "hidden",
          zIndex: 20,
        }}
      >
        {/* Ambient Neon Glow Backlight */}
        <div
          style={{
            position: "absolute",
            top: -50,
            left: "50%",
            transform: "translateX(-50%)",
            width: 380,
            height: 260,
            background: "radial-gradient(ellipse at center, rgba(34, 197, 94, 0.25) 0%, transparent 70%)",
            pointerEvents: "none",
            filter: "blur(24px)",
          }}
        />

        {/* ========================================================== */}
        {/* 1. CREATIVE BRAND HEADER: CIRCULAR LOGO & STORE SHOWCASE   */}
        {/* ========================================================== */}
        <div
          style={{
            width: "100%",
            borderRadius: 20,
            background: "linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)",
            border: "1px solid rgba(34, 197, 94, 0.3)",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
            backdropFilter: "blur(14px)",
            padding: "12px 14px",
            marginBottom: 12,
            position: "relative",
          }}
        >
          {/* Circular Logo & Brand Info Row */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* Glowing Circular Avatar Frame */}
            <div
              style={{
                position: "relative",
                width: 82,
                height: 82,
                borderRadius: "50%",
                padding: 3,
                background: "linear-gradient(135deg, #22c55e 0%, #10b981 50%, #facc15 100%)",
                boxShadow: "0 0 24px rgba(34, 197, 94, 0.6), inset 0 0 10px rgba(255, 255, 255, 0.4)",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  overflow: "hidden",
                  backgroundColor: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "inset 0 2px 6px rgba(0, 0, 0, 0.2)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={manifest.branding?.logo_url || "/kathua-fresh-logo.jpg"}
                  alt="Kathua Fresh Logo"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              </div>

              {/* Verified Green Checkmark Badge */}
              <div
                style={{
                  position: "absolute",
                  bottom: -1,
                  right: -1,
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  backgroundColor: "#22c55e",
                  border: "2px solid #06281e",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.6)",
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            </div>

            {/* Brand Title & Live Beacon */}
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: "#ffffff",
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  lineHeight: 1.1,
                  textShadow: "0 2px 10px rgba(0, 0, 0, 0.6)",
                }}
              >
                Kathua Fresh
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#86efac",
                  letterSpacing: 1.8,
                  textTransform: "uppercase",
                  marginTop: 3,
                }}
              >
                Always Fresh • Direct Mandi
              </div>

              {/* Live Store Beacon Pill */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 6,
                  alignSelf: "flex-start",
                  padding: "3px 10px",
                  borderRadius: 12,
                  backgroundColor: "rgba(34, 197, 94, 0.16)",
                  border: "1px solid rgba(34, 197, 94, 0.4)",
                  boxShadow: "0 0 12px rgba(34, 197, 94, 0.2)",
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    backgroundColor: "#22c55e",
                    boxShadow: "0 0 8px #22c55e",
                    display: "inline-block",
                    animation: "pulse 2s infinite",
                  }}
                />
                <span style={{ fontSize: 10, fontWeight: 900, color: "#4ade80", letterSpacing: 1.2 }}>
                  LIVE STORE TV
                </span>
              </div>
            </div>
          </div>

          {/* Quick Perks Pill Bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              marginTop: 10,
              paddingTop: 8,
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            <div
              style={{
                flex: 1,
                fontSize: 10,
                fontWeight: 800,
                color: "#e2e8f0",
                backgroundColor: "rgba(0, 0, 0, 0.25)",
                padding: "4px 8px",
                borderRadius: 8,
                textAlign: "center",
                border: "1px solid rgba(255, 255, 255, 0.06)",
              }}
            >
              🌱 100% Farm Fresh
            </div>
            <div
              style={{
                flex: 1,
                fontSize: 10,
                fontWeight: 800,
                color: "#fef08a",
                backgroundColor: "rgba(0, 0, 0, 0.25)",
                padding: "4px 8px",
                borderRadius: 8,
                textAlign: "center",
                border: "1px solid rgba(255, 255, 255, 0.06)",
              }}
            >
              🏷️ Wholesale Rates
            </div>
          </div>
        </div>

        {/* ========================================================== */}
        {/* 2. CREATIVE IRRESISTIBLE SMART QR CARDS (WA & IG)          */}
        {/* ========================================================== */}
        <div
          style={{
            width: "100%",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          {manifest.qr_codes?.slice(0, 2).map((qr) => {
            const isWhatsApp =
              qr.label.toLowerCase().includes("whatsapp") ||
              qr.target_url.toLowerCase().includes("wa") ||
              qr.target_url.toLowerCase().includes("whatsapp");

            const isInstagram =
              qr.label.toLowerCase().includes("instagram") ||
              qr.target_url.toLowerCase().includes("instagram") ||
              qr.target_url.toLowerCase().includes("ig");

            const theme = isWhatsApp
              ? {
                  cardBg:
                    "linear-gradient(155deg, rgba(7, 94, 84, 0.42) 0%, rgba(18, 140, 126, 0.22) 45%, rgba(4, 20, 15, 0.9) 100%)",
                  cardBorder: "rgba(37, 211, 102, 0.45)",
                  cardGlow: "rgba(37, 211, 102, 0.22)",
                  badgeBg: "#25D366",
                  badgeShadow: "0 4px 14px rgba(37, 211, 102, 0.45)",
                  cornerColor: "#25D366",
                  btnBg: "linear-gradient(90deg, #128C7E 0%, #25D366 100%)",
                  btnShadow: "0 4px 16px rgba(37, 211, 102, 0.35)",
                  title: "WHATSAPP CHANNEL",
                  subtitle: "Daily Wholesale Mandi Rates",
                  chip: "JOIN FREE",
                  chipColor: "#25D366",
                  ctaText: "Point Camera to Join",
                  fallbackImg: "/qr-whatsapp.png",
                  logoSvg: (
                    <svg viewBox="0 0 32 32" width="22" height="22" fill="#ffffff">
                      <path d="M16 2C8.28 2 2 8.28 2 16c0 2.72.78 5.26 2.12 7.42L2 30l6.76-2.08C10.84 29.18 13.34 30 16 30c7.72 0 14-6.28 14-14S23.72 2 16 2zm8.16 20.12c-.34.96-1.7 1.76-2.78 1.98-.74.16-1.72.28-4.96-1.06-4.16-1.72-6.84-5.96-7.04-6.24-.22-.28-1.7-2.26-1.7-4.32s1.08-3.08 1.46-3.5c.38-.42.84-.52 1.12-.52.28 0 .56 0 .8.02.26.02.6-.1.94.72.34.84 1.18 2.88 1.28 3.08.1.22.16.48.02.76-.14.28-.22.46-.42.7-.2.24-.44.52-.62.7-.2.24-.42.42-.18.82.24.4 1.06 1.76 2.3 2.86 1.58 1.42 2.92 1.86 3.34 2.06.42.2.66.18.9-.1.26-.28 1.08-1.26 1.36-1.7.3-.42.58-.36.98-.2.4.16 2.54 1.2 2.98 1.42.44.22.74.34.84.52.12.2.12 1.14-.22 2.1z" />
                    </svg>
                  ),
                  centerLogo: (
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: "50%",
                        backgroundColor: "#25D366",
                        border: "2.5px solid #ffffff",
                        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.4)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <svg viewBox="0 0 32 32" width="18" height="18" fill="#ffffff">
                        <path d="M16 2C8.28 2 2 8.28 2 16c0 2.72.78 5.26 2.12 7.42L2 30l6.76-2.08C10.84 29.18 13.34 30 16 30c7.72 0 14-6.28 14-14S23.72 2 16 2zm8.16 20.12c-.34.96-1.7 1.76-2.78 1.98-.74.16-1.72.28-4.96-1.06-4.16-1.72-6.84-5.96-7.04-6.24-.22-.28-1.7-2.26-1.7-4.32s1.08-3.08 1.46-3.5c.38-.42.84-.52 1.12-.52.28 0 .56 0 .8.02.26.02.6-.1.94.72.34.84 1.18 2.88 1.28 3.08.1.22.16.48.02.76-.14.28-.22.46-.42.7-.2.24-.44.52-.62.7-.2.24-.42.42-.18.82.24.4 1.06 1.76 2.3 2.86 1.58 1.42 2.92 1.86 3.34 2.06.42.2.66.18.9-.1.26-.28 1.08-1.26 1.36-1.7.3-.42.58-.36.98-.2.4.16 2.54 1.2 2.98 1.42.44.22.74.34.84.52.12.2.12 1.14-.22 2.1z" />
                      </svg>
                    </div>
                  ),
                }
              : isInstagram
              ? {
                  cardBg:
                    "linear-gradient(155deg, rgba(131, 58, 180, 0.38) 0%, rgba(253, 29, 29, 0.22) 45%, rgba(20, 10, 28, 0.9) 100%)",
                  cardBorder: "rgba(253, 29, 29, 0.45)",
                  cardGlow: "rgba(253, 29, 29, 0.22)",
                  badgeBg: "linear-gradient(135deg, #833AB4 0%, #FD1D1D 50%, #FCB045 100%)",
                  badgeShadow: "0 4px 14px rgba(253, 29, 29, 0.45)",
                  cornerColor: "#FD1D1D",
                  btnBg: "linear-gradient(90deg, #833AB4 0%, #FD1D1D 50%, #FCB045 100%)",
                  btnShadow: "0 4px 16px rgba(253, 29, 29, 0.35)",
                  title: "INSTAGRAM REELS",
                  subtitle: "@kathua_fresh • Offers & Stories",
                  chip: "FOLLOW",
                  chipColor: "#FD1D1D",
                  ctaText: "Point Camera to Follow",
                  fallbackImg: "/qr-instagram.jpg",
                  logoSvg: (
                    <svg viewBox="0 0 32 32" width="22" height="22" fill="#ffffff">
                      <path d="M16 4.9c3.6 0 4 .02 5.4.08 3.5.16 5.1 1.74 5.2 5.2.06 1.4.08 1.8.08 5.4s-.02 4-.08 5.4c-.16 3.5-1.74 5.1-5.2 5.2-1.4.06-1.8.08-5.4.08s-4-.02-5.4-.08c-3.5-.16-5.1-1.74-5.2-5.2-.06-1.4-.08-1.8-.08-5.4s.02-4 .08-5.4c.16-3.5 1.74-5.1 5.2-5.2 1.4-.06 1.8-.08 5.4-.08m0-2.9c-3.7 0-4.1.02-5.6.08-4.8.22-7.4 2.83-7.6 7.6-.07 1.5-.09 1.9-.09 5.6s.02 4.1.08 5.6c.22 4.8 2.83 7.4 7.6 7.6 1.5.07 1.9.09 5.6.09s4.1-.02 5.6-.08c4.8-.22 7.4-2.83 7.6-7.6.07-1.5.09-1.9.09-5.6s-.02-4.1-.08-5.6c-.22-4.8-2.83-7.4-7.6-7.6-1.5-.07-1.9-.09-5.6-.09z" />
                      <path d="M16 9.3c-3.7 0-6.7 3-6.7 6.7s3 6.7 6.7 6.7 6.7-3 6.7-6.7-3-6.7-6.7-6.7zm0 10.7c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z" />
                      <circle cx="23" cy="9" r="1.6" />
                    </svg>
                  ),
                  centerLogo: (
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        background: "linear-gradient(135deg, #833AB4 0%, #FD1D1D 50%, #FCB045 100%)",
                        border: "2.5px solid #ffffff",
                        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.4)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <svg viewBox="0 0 32 32" width="18" height="18" fill="#ffffff">
                        <path d="M16 4.9c3.6 0 4 .02 5.4.08 3.5.16 5.1 1.74 5.2 5.2.06 1.4.08 1.8.08 5.4s-.02 4-.08 5.4c-.16 3.5-1.74 5.1-5.2 5.2-1.4.06-1.8.08-5.4.08s-4-.02-5.4-.08c-3.5-.16-5.1-1.74-5.2-5.2-.06-1.4-.08-1.8-.08-5.4s.02-4 .08-5.4c.16-3.5 1.74-5.1 5.2-5.2 1.4-.06 1.8-.08 5.4-.08m0-2.9c-3.7 0-4.1.02-5.6.08-4.8.22-7.4 2.83-7.6 7.6-.07 1.5-.09 1.9-.09 5.6s.02 4.1.08 5.6c.22 4.8 2.83 7.4 7.6 7.6 1.5.07 1.9.09 5.6.09s4.1-.02 5.6-.08c4.8-.22 7.4-2.83 7.6-7.6.07-1.5.09-1.9.09-5.6s-.02-4.1-.08-5.6c-.22-4.8-2.83-7.4-7.6-7.6-1.5-.07-1.9-.09-5.6-.09z" />
                        <path d="M16 9.3c-3.7 0-6.7 3-6.7 6.7s3 6.7 6.7 6.7 6.7-3 6.7-6.7-3-6.7-6.7-6.7zm0 10.7c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z" />
                        <circle cx="23" cy="9" r="1.6" />
                      </svg>
                    </div>
                  ),
                }
              : {
                  cardBg:
                    "linear-gradient(155deg, rgba(6, 78, 59, 0.4) 0%, rgba(13, 148, 136, 0.2) 45%, rgba(6, 20, 25, 0.9) 100%)",
                  cardBorder: "rgba(16, 185, 129, 0.4)",
                  cardGlow: "rgba(16, 185, 129, 0.2)",
                  badgeBg: "linear-gradient(135deg, #059669 0%, #0d9488 100%)",
                  badgeShadow: "0 4px 14px rgba(5, 150, 105, 0.4)",
                  cornerColor: "#10b981",
                  btnBg: "linear-gradient(90deg, #059669 0%, #10b981 100%)",
                  btnShadow: "0 4px 16px rgba(16, 185, 129, 0.35)",
                  title: qr.label.toUpperCase(),
                  subtitle: qr.caption || "Scan with phone camera",
                  chip: "SCAN",
                  chipColor: "#10b981",
                  ctaText: "Point Camera to Scan",
                  fallbackImg: undefined,
                  logoSvg: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5">
                      <rect width="18" height="18" x="3" y="3" rx="2" />
                      <path d="M7 7h.01M17 7h.01M7 17h.01M17 17h.01" />
                    </svg>
                  ),
                  centerLogo: undefined,
                };

            return (
              <div
                key={qr.id}
                style={{
                  width: "100%",
                  borderRadius: 22,
                  background: theme.cardBg,
                  border: `1.5px solid ${theme.cardBorder}`,
                  boxShadow: `0 14px 30px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.15), 0 0 22px ${theme.cardGlow}`,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: "12px 14px 10px",
                  position: "relative",
                  backdropFilter: "blur(14px)",
                }}
              >
                {/* 1. Card Header with Big Authentic App Logo & Details */}
                <div
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 10,
                  }}
                >
                  {/* Big Authentic Logo Icon Badge */}
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: isInstagram ? 12 : "50%",
                      background: theme.badgeBg,
                      boxShadow: theme.badgeShadow,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {theme.logoSvg}
                  </div>

                  {/* Header Title & Subtext */}
                  <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 900,
                        color: "#ffffff",
                        letterSpacing: 0.8,
                        lineHeight: 1.15,
                        textTransform: "uppercase",
                      }}
                    >
                      {theme.title}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: isWhatsApp ? "#86efac" : isInstagram ? "#f9a8d4" : "#cbd5e1",
                        fontWeight: 700,
                        lineHeight: 1.2,
                        marginTop: 2,
                      }}
                    >
                      {theme.subtitle}
                    </div>
                  </div>

                  {/* Top-Right Action Chip */}
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 900,
                      color: "#ffffff",
                      backgroundColor: "rgba(0, 0, 0, 0.4)",
                      border: `1px solid ${theme.chipColor}`,
                      padding: "3px 8px",
                      borderRadius: 10,
                      letterSpacing: 1,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        backgroundColor: theme.chipColor,
                        display: "inline-block",
                      }}
                    />
                    {theme.chip}
                  </div>
                </div>

                {/* 2. QR Code Frame with Camera Viewfinder Brackets & Center Logo */}
                <div
                  style={{
                    position: "relative",
                    width: 172,
                    height: 172,
                    padding: 8,
                    backgroundColor: "#ffffff",
                    borderRadius: 18,
                    boxShadow: "0 10px 26px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(0, 0, 0, 0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {/* Viewfinder Top-Left Bracket */}
                  <div
                    style={{
                      position: "absolute",
                      top: -4,
                      left: -4,
                      width: 20,
                      height: 20,
                      borderTop: `3.5px solid ${theme.cornerColor}`,
                      borderLeft: `3.5px solid ${theme.cornerColor}`,
                      borderTopLeftRadius: 8,
                    }}
                  />
                  {/* Viewfinder Top-Right Bracket */}
                  <div
                    style={{
                      position: "absolute",
                      top: -4,
                      right: -4,
                      width: 20,
                      height: 20,
                      borderTop: `3.5px solid ${theme.cornerColor}`,
                      borderRight: `3.5px solid ${theme.cornerColor}`,
                      borderTopRightRadius: 8,
                    }}
                  />
                  {/* Viewfinder Bottom-Left Bracket */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: -4,
                      left: -4,
                      width: 20,
                      height: 20,
                      borderBottom: `3.5px solid ${theme.cornerColor}`,
                      borderLeft: `3.5px solid ${theme.cornerColor}`,
                      borderBottomLeftRadius: 8,
                    }}
                  />
                  {/* Viewfinder Bottom-Right Bracket */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: -4,
                      right: -4,
                      width: 20,
                      height: 20,
                      borderBottom: `3.5px solid ${theme.cornerColor}`,
                      borderRight: `3.5px solid ${theme.cornerColor}`,
                      borderBottomRightRadius: 8,
                    }}
                  />

                  {/* QR SVG Render / Fallback Image */}
                  {qrSvgMap[qr.id] ? (
                    <div
                      className="tv-qr-container"
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      dangerouslySetInnerHTML={{ __html: qrSvgMap[qr.id] }}
                    />
                  ) : theme.fallbackImg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={theme.fallbackImg}
                      alt={qr.label}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        borderRadius: 8,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                        fontSize: 12,
                        color: "#64748b",
                        fontWeight: 700,
                      }}
                    >
                      Loading QR...
                    </div>
                  )}

                  {/* Centered Brand Watermark Badge Inside QR Code */}
                  {theme.centerLogo && (
                    <div
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        zIndex: 5,
                        pointerEvents: "none",
                      }}
                    >
                      {theme.centerLogo}
                    </div>
                  )}
                </div>

                {/* 3. Irresistible Call-To-Action Button Pill */}
                <div
                  style={{
                    width: "100%",
                    marginTop: 10,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      padding: "6px 12px",
                      borderRadius: 14,
                      background: theme.btnBg,
                      boxShadow: theme.btnShadow,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      color: "#ffffff",
                    }}
                  >
                    <span style={{ fontSize: 13 }}>📷</span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 900,
                        letterSpacing: 0.8,
                        textTransform: "uppercase",
                      }}
                    >
                      {theme.ctaText}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#cbd5e1",
                      fontWeight: 600,
                      lineHeight: 1.1,
                      textAlign: "center",
                    }}
                  >
                    Open phone camera to scan instantly
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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
            {/* TV Audio Mute / Unmute Toggle Button */}
            <button
              onClick={toggleTvAudio}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 24px",
                borderRadius: 30,
                backgroundColor: !isAudioMuted && isAudioPlaying
                  ? "rgba(16, 185, 129, 0.25)"
                  : "rgba(239, 68, 68, 0.2)",
                border: `2px solid ${!isAudioMuted && isAudioPlaying ? "#10b981" : "#f87171"}`,
                color: !isAudioMuted && isAudioPlaying ? "#34d399" : "#fca5a5",
                fontSize: 18,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: !isAudioMuted && isAudioPlaying
                  ? "0 0 20px rgba(16, 185, 129, 0.4)"
                  : "none",
                outline: "none",
                transition: "all 0.2s ease",
              }}
            >
              {!isAudioMuted && isAudioPlaying ? (
                <>
                  <span style={{ fontSize: 22 }}>🔊</span>
                  <span>AUDIO ON</span>
                  <span style={{ display: "inline-flex", gap: 3, alignItems: "flex-end", height: 16, marginLeft: 2 }}>
                    <span style={{ width: 3, height: "100%", backgroundColor: "#34d399", borderRadius: 2 }} />
                    <span style={{ width: 3, height: "60%", backgroundColor: "#34d399", borderRadius: 2 }} />
                    <span style={{ width: 3, height: "85%", backgroundColor: "#34d399", borderRadius: 2 }} />
                  </span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 22 }}>🔇</span>
                  <span>AUDIO MUTED (Click to Play)</span>
                </>
              )}
            </button>

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
              @keyframes pulse {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.4; transform: scale(0.85); }
              }
              .tv-qr-container svg {
                width: 100% !important;
                height: 100% !important;
                display: block;
                border-radius: 6px;
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

      {/* Autoplay prompt banner if browser blocked audio initially */}
      {autoplayBlocked && (
        <button
          onClick={toggleTvAudio}
          style={{
            position: "absolute",
            top: 24,
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#f59e0b",
            color: "#0f172a",
            padding: "14px 32px",
            borderRadius: 30,
            fontWeight: 900,
            fontSize: 22,
            cursor: "pointer",
            boxShadow: "0 10px 30px rgba(245, 158, 11, 0.6)",
            display: "flex",
            alignItems: "center",
            gap: 12,
            zIndex: 1000,
            border: "none",
          }}
        >
          <span style={{ fontSize: 26 }}>🔊</span>
          <span>Click to Unmute / आवाज़ शुरू करें</span>
        </button>
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
            zIndex: 999,
          }}
        >
          PREVIEW MODE — NOT LIVE ON TV
        </div>
      )}

      {/* Background Audio Player */}
      <audio
        ref={audioRef}
        src={manifest.audio?.url || "/store-audio.mp3"}
        loop={manifest.audio?.loop ?? true}
        preload="auto"
        onPlay={() => {
          setIsAudioPlaying(true);
          setAutoplayBlocked(false);
        }}
        onPause={() => setIsAudioPlaying(false)}
      />

      {/* Dedicated Announcement Player for Zero-Collision & Natural Voice */}
      <audio
        ref={announcementAudioRef}
        preload="auto"
        style={{ display: "none" }}
      />
      </div>
    </div>
  );
}

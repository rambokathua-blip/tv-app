"use client";

import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import QRCode from "qrcode";
import {
  MoreVertical,
  Smartphone,
  ShieldCheck,
  Maximize2,
  RefreshCw,
  LogOut,
  X,
  ExternalLink,
  Volume2,
  VolumeX,
  Tv,
  Sparkles,
} from "lucide-react";
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
      id: "welcome-slide-1",
      promotion_id: "promo-welcome-1",
      title: "Welcome to Kathua Fresh",
      price_text: "Fresh & Organic Daily",
      duration_sec: 8,
      image_url: "/kathua-fresh-logo.jpg",
    },
    {
      id: "welcome-slide-2",
      promotion_id: "promo-welcome-2",
      title: "Farm Fresh Fruits & Vegetables",
      price_text: "100% Quality Assured",
      duration_sec: 8,
      image_url: "/kathua-fresh-logo.jpg",
    },
  ],
  audio: {
    enabled: true,
    url: "/store-audio.mp3",
    volume: 0.8,
    loop: true,
    interval_sec: 120,
  },
};

declare global {
  interface Window {
    AndroidSignage?: {
      speak: (text: string, lang: string) => void;
      playAudio: (url: string) => void;
      getStorageInfo: () => string;
      switchMode?: (mode: string) => void;
      getAppMode?: () => string;
    };
  }
}

export default function TvPlayerPage() {
  const [token, setToken] = useState<string | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const [hidePreviewBanner, setHidePreviewBanner] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pollSecret, setPollSecret] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<number>(300);
  const [pairingQrSvg, setPairingQrSvg] = useState<string>("");

  const [manifest, setManifest] = useState<SignageManifest>(FALLBACK_MANIFEST);
  const [qrSvgMap, setQrSvgMap] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState<number | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionStyle, setTransitionStyle] = useState<"cinematic" | "slide">("cinematic");
  const [slideProgress, setSlideProgress] = useState(0);

  // Load saved transition style from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("tv_transition_style");
      if (saved === "slide" || saved === "cinematic") {
        setTransitionStyle(saved);
      }
    }
  }, []);
  const [isOffline, setIsOffline] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [windowScale, setWindowScale] = useState(1);

  // Dynamic uniform scaling with TV-Safe Area (98%) to fit 1920x1080 canvas without ANY clipping
  useEffect(() => {
    const applyScale = () => {
      const vw = window.innerWidth || document.documentElement.clientWidth || 1920;
      const vh = window.innerHeight || document.documentElement.clientHeight || 1080;
      // 98% safe-margin to account for TV overscan and window borders
      const scaleX = (vw * 0.98) / 1920;
      const scaleY = (vh * 0.98) / 1080;
      const finalScale = Math.min(scaleX, scaleY);
      setWindowScale(finalScale);

      if (canvasRef.current) {
        canvasRef.current.style.transform = `scale(${finalScale})`;
        canvasRef.current.style.transformOrigin = "center center";
      }
    };

    applyScale();
    window.addEventListener("resize", applyScale);
    window.addEventListener("orientationchange", applyScale);
    const observer = new ResizeObserver(applyScale);
    observer.observe(document.body);

    return () => {
      window.removeEventListener("resize", applyScale);
      window.removeEventListener("orientationchange", applyScale);
      observer.disconnect();
    };
  }, []);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

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

  // Background Audio State & Controls with Interval Timer
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const isMutedParam = params.get("muted") === "true";
      const isInIframe = window.self !== window.top;
      const userPref = localStorage.getItem("kathua_tv_audio_muted");
      if (userPref !== null) {
        return userPref === "true" || isMutedParam || isInIframe;
      }
      return isMutedParam || isInIframe;
    }
    return false;
  });
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  // Audio Interval State (0 = continuous loop, 30 = 30s, 60 = 1m, 120 = 2m, 180 = 3m, 300 = 5m)
  const [audioIntervalSec, setAudioIntervalSec] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("kathua_tv_audio_interval");
      if (saved !== null) {
        const val = Number(saved);
        if (!isNaN(val)) return val;
      }
    }
    return 120; // Default: every 2 minutes
  });
  const [audioIntervalCountdown, setAudioIntervalCountdown] = useState<number | null>(null);
  const intervalCountdownRef = useRef<NodeJS.Timeout | null>(null);

  // Listen for audio control messages from parent window (e.g. Admin Dashboard)
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (
        e.data?.type === "MUTE_AUDIO" ||
        (e.data?.type === "TV_AUDIO_TOGGLE" && !e.data?.enabled)
      ) {
        setIsAudioMuted(true);
        if (audioRef.current) {
          audioRef.current.muted = true;
          audioRef.current.pause();
        }
        if (announcementAudioRef.current) {
          announcementAudioRef.current.pause();
        }
        if (intervalCountdownRef.current) {
          clearInterval(intervalCountdownRef.current);
        }
        setAudioIntervalCountdown(null);
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
      } else if (
        e.data?.type === "UNMUTE_AUDIO" ||
        (e.data?.type === "TV_AUDIO_TOGGLE" && e.data?.enabled)
      ) {
        const isInIframe = typeof window !== "undefined" && window.self !== window.top;
        if (!isInIframe) {
          setIsAudioMuted(false);
          if (audioRef.current) {
            audioRef.current.muted = false;
            audioRef.current.play().catch(() => {});
          }
        }
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Handler when audio playback finishes (triggers interval countdown for next play)
  const handleAudioEnded = useCallback(() => {
    if (isAudioMuted || activeBroadcast) return;

    if (audioIntervalSec === 0) {
      // Continuous loop mode: immediately loop back
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
      return;
    }

    // Interval mode: Pause, then start countdown until next trigger
    setIsAudioPlaying(false);
    let remaining = audioIntervalSec;
    setAudioIntervalCountdown(remaining);

    if (intervalCountdownRef.current) clearInterval(intervalCountdownRef.current);
    intervalCountdownRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (intervalCountdownRef.current) clearInterval(intervalCountdownRef.current);
        setAudioIntervalCountdown(null);
        const audio = audioRef.current;
        if (audio && !isAudioMuted && !activeBroadcast) {
          audio.currentTime = 0;
          audio
            .play()
            .then(() => setIsAudioPlaying(true))
            .catch(() => {});
        }
      } else {
        setAudioIntervalCountdown(remaining);
      }
    }, 1000);
  }, [audioIntervalSec, isAudioMuted, activeBroadcast]);

  // Adjust audio trigger interval
  const changeAudioInterval = useCallback((sec: number) => {
    setAudioIntervalSec(sec);
    try {
      localStorage.setItem("kathua_tv_audio_interval", sec.toString());
    } catch {}

    fetch("/api/signage/admin/audio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interval_sec: sec }),
    }).catch(() => {});

    if (intervalCountdownRef.current) clearInterval(intervalCountdownRef.current);
    setAudioIntervalCountdown(null);

    const audio = audioRef.current;
    if (audio && !isAudioMuted && !activeBroadcast) {
      if (sec === 0) {
        audio.loop = true;
        audio.play().catch(() => {});
      } else {
        audio.loop = false;
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    }
  }, [isAudioMuted, activeBroadcast]);

  // Sync background audio with manifest and user preference
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const audioConfig = manifest.audio ?? FALLBACK_MANIFEST.audio;
    if (audioConfig?.volume !== undefined) {
      audio.volume = Math.max(0, Math.min(1, audioConfig.volume));
    }

    // Do not resume background audio if a live announcement is currently broadcasting
    if (activeBroadcast) return;

    if (!isAudioMuted) {
      audio.muted = false;
      audio.loop = audioIntervalSec === 0;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsAudioPlaying(true);
            setAutoplayBlocked(false);
          })
          .catch(() => {
            setIsAudioPlaying(false);
            setAutoplayBlocked(true);
          });
      }
    } else {
      audio.pause();
      audio.muted = true;
      setIsAudioPlaying(false);
      if (intervalCountdownRef.current) clearInterval(intervalCountdownRef.current);
      setAudioIntervalCountdown(null);
    }
  }, [manifest.audio, isAudioMuted, activeBroadcast, audioIntervalSec]);

  // Click / Key gesture to unblock autoplay
  useEffect(() => {
    const handleGesture = () => {
      if (autoplayBlocked && audioRef.current && !isAudioMuted) {
        audioRef.current.muted = false;
        audioRef.current.loop = audioIntervalSec === 0;
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
  }, [autoplayBlocked, isAudioMuted, audioIntervalSec]);

  // Direct 1-tap Toggle for User Screen Audio (Always responsive, zero blocking)
  const toggleTvAudio = (forceState?: boolean) => {
    const audio = audioRef.current;
    if (!audio) return;

    const willPlay = forceState !== undefined ? forceState : (isAudioMuted || audio.paused);

    if (willPlay) {
      if (intervalCountdownRef.current) clearInterval(intervalCountdownRef.current);
      setAudioIntervalCountdown(null);

      audio.muted = false;
      audio.loop = audioIntervalSec === 0;
      audio.currentTime = 0;
      audio
        .play()
        .then(() => {
          setIsAudioMuted(false);
          setIsAudioPlaying(true);
          setAutoplayBlocked(false);
          try {
            localStorage.setItem("kathua_tv_audio_muted", "false");
          } catch {}
        })
        .catch(() => {
          setAutoplayBlocked(true);
        });
    } else {
      audio.pause();
      audio.muted = true;
      setIsAudioMuted(true);
      setIsAudioPlaying(false);
      if (intervalCountdownRef.current) clearInterval(intervalCountdownRef.current);
      setAudioIntervalCountdown(null);
      try {
        localStorage.setItem("kathua_tv_audio_muted", "true");
      } catch {}
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
    let baseManifest: SignageManifest = FALLBACK_MANIFEST;
    if (cachedManifest) {
      try {
        baseManifest = JSON.parse(cachedManifest);
      } catch {}
    }

    try {
      const rawPromos = localStorage.getItem("kathua_signage_promotions");
      if (rawPromos) {
        const localList = JSON.parse(rawPromos);
        if (Array.isArray(localList) && localList.length > 0) {
          const livePromos = localList.filter((p: any) => p.status === "live" && p.enabled !== false);
          if (livePromos.length > 0) {
            const localSlides: ManifestSlide[] = livePromos.map((p: any) => ({
              id: p.id,
              promotion_id: p.id,
              title: p.title || "Offer",
              price_text: p.price_text,
              duration_sec: p.duration_sec || 10,
              image_url:
                (p.media_id && (p.media_id.startsWith("/") || p.media_id.startsWith("http") || p.media_id.startsWith("data:"))
                  ? p.media_id
                  : null) ||
                p.media?.storage_path ||
                p.media?.thumb_path ||
                "/kathua-fresh-logo.jpg",
            }));
            const localIds = new Set(localSlides.map((s) => s.id));
            const otherSlides = (baseManifest.slides || []).filter(
              (s) => !localIds.has(s.id) && s.id !== "demo-onion" && s.id !== "demo-apple"
            );
            baseManifest = {
              ...baseManifest,
              slides: [...localSlides, ...otherSlides],
            };
          }
        }
      }
    } catch {}

    setManifest(baseManifest);
  }, []);

  const manifestVersionRef = useRef(manifest.version);
  useEffect(() => {
    manifestVersionRef.current = manifest.version;
  }, [manifest.version]);

  // Helper to enrich manifest with custom uploaded offers from local storage (offline fallback only)
  const enrichWithLocalPromotions = useCallback((manifestData: SignageManifest): SignageManifest => {
    // If server manifest already has slides from the cloud database, use them directly (cloud is source of truth)
    if (manifestData.slides && manifestData.slides.length > 0) {
      const validSlides = manifestData.slides.filter(
        (s) => s.id !== "demo-onion" && s.id !== "demo-apple"
      );
      if (validSlides.length === 1) {
        return {
          ...manifestData,
          slides: [
            validSlides[0],
            {
              id: "welcome-slide-brand",
              promotion_id: "promo-welcome-brand",
              title: "Kathua Fresh Store",
              price_text: "Quality Assured | Always Fresh",
              duration_sec: 8,
              image_url: "/kathua-fresh-logo.jpg",
            },
          ],
        };
      }
      if (validSlides.length > 1) {
        return {
          ...manifestData,
          slides: validSlides,
        };
      }
    }

    // Only if server has 0 slides, check offline local storage fallback
    try {
      if (typeof window === "undefined") return manifestData;
      const raw = localStorage.getItem("kathua_signage_promotions");
      if (raw) {
        const localList = JSON.parse(raw);
        if (Array.isArray(localList) && localList.length > 0) {
          const livePromos = localList.filter((p: any) => p.status === "live" && p.enabled !== false);
          if (livePromos.length > 0) {
            const localSlides: ManifestSlide[] = livePromos.map((p: any) => ({
              id: p.id,
              promotion_id: p.id,
              title: p.title || "Offer",
              price_text: p.price_text,
              duration_sec: p.duration_sec || 8,
              image_url:
                (p.media_id && (p.media_id.startsWith("/") || p.media_id.startsWith("http") || p.media_id.startsWith("data:"))
                  ? p.media_id
                  : null) ||
                p.media?.storage_path ||
                p.media?.thumb_path ||
                "/kathua-fresh-logo.jpg",
            }));

            const finalSlides =
              localSlides.length === 1
                ? [
                    localSlides[0],
                    {
                      id: "welcome-slide-brand",
                      promotion_id: "promo-welcome-brand",
                      title: "Kathua Fresh Store",
                      price_text: "Quality Assured | Always Fresh",
                      duration_sec: 8,
                      image_url: "/kathua-fresh-logo.jpg",
                    },
                  ]
                : localSlides;

            return {
              ...manifestData,
              slides: finalSlides,
            };
          }
        }
      }
    } catch {}
    return manifestData;
  }, []);

  // Manifest Fetching (User Screen Display Mode — No Pairing Required)
  const fetchManifest = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/signage/device/manifest?_t=${Date.now()}`, {
        headers,
        cache: "no-store",
      });
      if (res.ok) {
        const rawData = await res.json();
        const data = enrichWithLocalPromotions(rawData);
        setManifest(data);
        localStorage.setItem("signage_cached_manifest", JSON.stringify(data));
        setIsOffline(false);
        setCurrentIndex((prev) => (data.slides && data.slides.length > 0 && prev < data.slides.length ? prev : 0));
        return;
      }
    } catch {
      setIsOffline(true);
    }

    // Fallback: check localStorage for cached manifest or local promotions
    try {
      const cached = localStorage.getItem("signage_cached_manifest");
      const base = cached ? JSON.parse(cached) : FALLBACK_MANIFEST;
      const enriched = enrichWithLocalPromotions(base);
      setManifest(enriched);
      setCurrentIndex((prev) => (enriched.slides && enriched.slides.length > 0 && prev < enriched.slides.length ? prev : 0));
    } catch {}
  }, [token, enrichWithLocalPromotions]);

  // Initial load
  useEffect(() => {
    fetchManifest();
  }, [fetchManifest]);

  // Real-Time Synchronization (Version Polling + BroadcastChannel + LocalStorage)
  useEffect(() => {
    // 1. Version polling every 2 seconds for instant updates across different devices & networks
    const versionPoll = setInterval(async () => {
      try {
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(`/api/signage/device/version?_t=${Date.now()}`, {
          headers,
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          if (data.version && data.version !== manifestVersionRef.current) {
            manifestVersionRef.current = data.version;
            fetchManifest();
          }
          setIsOffline(false);
        }
      } catch {
        // network issue
      }
    }, 2000);

    // 2. BroadcastChannel for instant 0ms real-time sync across browser tabs/windows
    let syncChannel: BroadcastChannel | null = null;
    try {
      syncChannel = new BroadcastChannel("kathua_tv_sync");
      syncChannel.onmessage = (event) => {
        if (event.data?.type === "TV_SYNC" || event.data?.type === "SYNC_OFFERS") {
          fetchManifest();
        }
      };
    } catch {}

    // 3. Storage event for cross-tab sync
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "signage_force_refresh" || e.key === "kathua_signage_promotions") {
        fetchManifest();
      }
    };
    window.addEventListener("storage", handleStorage);

    // 4. Heartbeat every 60 seconds (optional background telemetry)
    const heartbeatTimer = setInterval(async () => {
      try {
        const currentSlide = manifest.slides[currentIndex]?.id;
        if (token) {
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
        }
        fetch("/api/keep-alive").catch(() => {});
      } catch {
        // Ignore heartbeat error
      }
    }, 60000);

    return () => {
      clearInterval(versionPoll);
      clearInterval(heartbeatTimer);
      if (syncChannel) syncChannel.close();
      window.removeEventListener("storage", handleStorage);
    };
  }, [token, fetchManifest]);

  // Listen for Live Broadcast Announcements
  useEffect(() => {
    const ann = manifest.active_announcement;
    if (!ann || !ann.id || ann.id === lastBroadcastIdRef.current) return;

    // Do not play voice announcement if muted, in an iframe preview, or voice is disabled
    const isInIframe = typeof window !== "undefined" && window.self !== window.top;
    const isVoiceDisabled = manifest.voice?.settings?.master_enabled === false;
    const isAudioDisabled = manifest.audio?.enabled === false;
    if (isAudioMuted || isInIframe || isVoiceDisabled || isAudioDisabled) return;

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

  // Slideshow Cycle (Always ensures >= 2 slides, alternating with store branding if 1 offer)
  const slides = useMemo(() => {
    const raw = (manifest.slides && manifest.slides.length > 0 ? manifest.slides : FALLBACK_MANIFEST.slides)
      .filter((s) => s.id !== "demo-onion" && s.id !== "demo-apple");
    if (raw.length === 1) {
      return [
        raw[0],
        {
          id: "welcome-slide-brand",
          promotion_id: "promo-welcome-brand",
          title: "Kathua Fresh Store",
          price_text: "Quality Assured | Always Fresh",
          duration_sec: 8,
          image_url: "/kathua-fresh-logo.jpg",
        },
      ];
    }
    return raw.length > 0 ? raw : FALLBACK_MANIFEST.slides;
  }, [manifest.slides]);

  // Smooth slide navigator: handles dual-buffer transition timing
  const goToSlide = useCallback((targetIndex: number) => {
    if (slides.length <= 1 || isTransitioning) return;
    const safeTarget = (targetIndex + slides.length) % slides.length;
    if (safeTarget === currentIndex) return;

    setPrevIndex(currentIndex);
    setCurrentIndex(safeTarget);
    setIsTransitioning(true);
    setSlideProgress(0);

    setTimeout(() => {
      setIsTransitioning(false);
      setPrevIndex(null);
    }, 950);
  }, [slides.length, isTransitioning, currentIndex]);

  useEffect(() => {
    if (slides.length <= 1 || isPaused) return;

    const safeIndex = currentIndex % slides.length;
    const currentItem = slides[safeIndex] || slides[0];
    const duration = Math.max(4, currentItem.duration_sec || 8) * 1000;
    const startTime = Date.now();

    // Progress bar update
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / duration) * 100, 100);
      setSlideProgress(progress);
    }, 50);

    // Slide transition timer
    const slideTimer = setTimeout(() => {
      goToSlide(safeIndex + 1);
    }, duration);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(slideTimer);
    };
  }, [currentIndex, slides.length, isPaused, goToSlide]);

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
        goToSlide(currentIndex + 1);
      } else if (e.code === "ArrowLeft") {
        goToSlide(currentIndex - 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, goToSlide]);

  // Active Slideshow Rendering
  const safeCurrentIndex = slides.length > 0 ? currentIndex % slides.length : 0;
  const currentSlide: ManifestSlide = slides[safeCurrentIndex] || slides[0];
  const outgoingSlide: ManifestSlide | null = (prevIndex !== null && slides[prevIndex]) ? slides[prevIndex] : null;
  const nextPreloadSlide: ManifestSlide = slides[(safeCurrentIndex + 1) % slides.length] || slides[0];

  // Helper to render slide content with silky-smooth GPU-accelerated transition
  const renderSlideContent = (slide: ManifestSlide, role: "current" | "outgoing" | "static") => {
    if (!slide) return null;
    const isOutgoing = role === "outgoing";
    const isCurrent = role === "current";

    let animStyle = "";
    if (isTransitioning) {
      if (isOutgoing) {
        animStyle = transitionStyle === "slide"
          ? "slideGlideOutLeft 900ms cubic-bezier(0.25, 1, 0.5, 1) forwards"
          : "slideCinematicOut 950ms cubic-bezier(0.4, 0, 0.2, 1) forwards";
      } else if (isCurrent) {
        animStyle = transitionStyle === "slide"
          ? "slideGlideInRight 900ms cubic-bezier(0.25, 1, 0.5, 1) forwards"
          : "slideCinematicIn 950ms cubic-bezier(0.25, 1, 0.5, 1) forwards";
      }
    }

    const isLogo = slide.image_url?.includes("logo");

    return (
      <div
        key={`${slide.id}-${role}`}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: isCurrent ? 20 : 10,
          animation: animStyle || undefined,
          overflow: "hidden",
          backgroundColor: "#000",
          willChange: isTransitioning ? "opacity, transform" : "auto",
        }}
      >
        {slide.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={slide.image_url}
            alt={slide.title}
            onError={(e) => {
              if (e.currentTarget.src !== "/kathua-fresh-logo.jpg") {
                e.currentTarget.src = "/kathua-fresh-logo.jpg";
              }
            }}
            style={{
              width: "100%",
              height: "100%",
              objectFit: isLogo ? "contain" : "cover",
              padding: isLogo ? "36px 48px" : "0",
              animation: !isLogo && !isTransitioning && role === "static" ? "kenBurnsSlow 10s ease-out forwards" : undefined,
              willChange: "transform",
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
              {slide.title}
            </h2>
          </div>
        )}

        {/* Price overlay banner */}
        {slide.price_text && (
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
              animation: isCurrent && isTransitioning ? "priceBadgeReveal 600ms cubic-bezier(0.16, 1, 0.3, 1) 200ms backwards" : undefined,
            }}
          >
            <div style={{ fontSize: 28, color: "#86efac", fontWeight: 700, textTransform: "uppercase" }}>
              {slide.title}
            </div>
            <div style={{ fontSize: 68, fontWeight: 900, color: "#facc15", letterSpacing: "-0.02em" }}>
              {slide.price_text}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      onDoubleClick={toggleFullScreen}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#000000",
        overflow: "hidden",
        zIndex: 9999,
      }}
    >
      <div
        ref={canvasRef}
        style={{
          width: "1920px",
          height: "1080px",
          position: "relative",
          overflow: "hidden",
          backgroundColor: "#09090b",
          transformOrigin: "center center",
          transform: `scale(${windowScale})`,
          flexShrink: 0,
          boxShadow: "0 0 60px rgba(0, 0, 0, 0.95)",
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
        {/* Outgoing Slide during smooth transition */}
        {isTransitioning && outgoingSlide && renderSlideContent(outgoingSlide, "outgoing")}

        {/* Active/Incoming Slide */}
        {renderSlideContent(currentSlide, isTransitioning ? "current" : "static")}

        {/* Hidden Pre-Decoder for Next Slide to prevent frame drops */}
        {nextPreloadSlide?.image_url && nextPreloadSlide.image_url !== currentSlide?.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={nextPreloadSlide.image_url}
            alt="pre-decode"
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              opacity: 0.001,
              pointerEvents: "none",
            }}
          />
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
              onClick={() => toggleTvAudio()}
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

            {/* Audio Interval Selector Pill */}
            {!isAudioMuted && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 18px",
                  borderRadius: 30,
                  backgroundColor: "rgba(15, 23, 42, 0.85)",
                  border: "1.5px solid rgba(34, 197, 94, 0.4)",
                  color: "#86efac",
                  fontSize: 16,
                  fontWeight: 800,
                  backdropFilter: "blur(8px)",
                }}
              >
                <span>⏱️</span>
                <span>
                  {audioIntervalSec === 0
                    ? "Loop: Continuous"
                    : audioIntervalCountdown !== null
                    ? `Next Sound: in ${audioIntervalCountdown}s`
                    : `Sound Gap: ${audioIntervalSec >= 60 ? audioIntervalSec / 60 + " min" : audioIntervalSec + " sec"}`}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const intervals = [0, 30, 60, 120, 180, 300];
                    const next = (intervals.indexOf(audioIntervalSec) + 1) % intervals.length;
                    changeAudioInterval(intervals[next]);
                  }}
                  title="Click to cycle sound interval"
                  style={{
                    backgroundColor: "rgba(34, 197, 94, 0.25)",
                    border: "1px solid #22c55e",
                    color: "#ffffff",
                    borderRadius: 16,
                    padding: "3px 10px",
                    fontSize: 12,
                    fontWeight: 900,
                    cursor: "pointer",
                    textTransform: "uppercase",
                  }}
                >
                  Adjust ▾
                </button>
              </div>
            )}

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
              /* Ultra-smooth cinematic dissolve with subtle scale */
              @keyframes slideCinematicIn {
                0% {
                  opacity: 0;
                  transform: scale(1.045);
                }
                100% {
                  opacity: 1;
                  transform: scale(1.0);
                }
              }
              @keyframes slideCinematicOut {
                0% {
                  opacity: 1;
                  transform: scale(1.0);
                }
                100% {
                  opacity: 0;
                  transform: scale(0.97);
                }
              }
              /* Silky smooth slide transition */
              @keyframes slideGlideInRight {
                0% {
                  opacity: 0.5;
                  transform: translateX(100%);
                }
                100% {
                  opacity: 1;
                  transform: translateX(0);
                }
              }
              @keyframes slideGlideOutLeft {
                0% {
                  opacity: 1;
                  transform: translateX(0);
                }
                100% {
                  opacity: 0.5;
                  transform: translateX(-100%);
                }
              }
              /* Gentle Ken Burns breathing effect on resting image */
              @keyframes kenBurnsSlow {
                0% {
                  transform: scale(1.0);
                }
                100% {
                  transform: scale(1.035);
                }
              }
              /* Luxury Price Badge reveal */
              @keyframes priceBadgeReveal {
                0% {
                  opacity: 0;
                  transform: translateY(28px) scale(0.96);
                }
                100% {
                  opacity: 1;
                  transform: translateY(0) scale(1);
                }
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
          onClick={() => toggleTvAudio()}
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

      {/* Preview Label (PRD 9.8) - Click to dismiss */}
      {isPreview && !hidePreviewBanner && (
        <div
          onClick={() => setHidePreviewBanner(true)}
          title="Tap to hide banner / बैनर छिपाएं"
          style={{
            position: "absolute",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "rgba(234, 88, 12, 0.95)",
            color: "#ffffff",
            padding: "8px 20px",
            borderRadius: 24,
            fontWeight: 800,
            fontSize: 18,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            boxShadow: "0 8px 20px rgba(0,0,0,0.5)",
            zIndex: 999,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 12,
            userSelect: "none",
            transition: "all 0.2s ease",
          }}
        >
          <span>PREVIEW MODE — NOT LIVE ON TV</span>
          <span
            style={{
              fontSize: 11,
              letterSpacing: 0,
              backgroundColor: "rgba(0,0,0,0.3)",
              padding: "3px 8px",
              borderRadius: 12,
              fontWeight: 700,
            }}
          >
            ✕ Hide
          </span>
        </div>
      )}

      {/* Background Audio Player */}
      <audio
        ref={audioRef}
        src={manifest.audio?.url || "/store-audio.mp3"}
        loop={audioIntervalSec === 0}
        preload="auto"
        muted={isAudioMuted}
        onPlay={() => {
          setIsAudioPlaying(true);
          setAutoplayBlocked(false);
        }}
        onEnded={handleAudioEnded}
        onPause={() => setIsAudioPlaying(false)}
      />

      {/* Dedicated Announcement Player for Zero-Collision & Natural Voice */}
      <audio
        ref={announcementAudioRef}
        preload="none"
        muted={isAudioMuted}
        style={{ display: "none" }}
      />
      </div>

      {/* ============================================================ */}
      {/* FLOATING 3-DOT QUICK ACTION MENU (ADMIN & PHONE CONNECT)     */}
      {/* ============================================================ */}
      <div
        style={{
          position: "fixed",
          top: 20,
          right: 20,
          zIndex: 10000,
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowQuickMenu(!showQuickMenu);
          }}
          title="TV Settings, Connect Phone & Admin Mode"
          style={{
            width: 46,
            height: 46,
            borderRadius: "50%",
            backgroundColor: showQuickMenu ? "#22c55e" : "rgba(15, 23, 42, 0.8)",
            color: showQuickMenu ? "#022c22" : "#ffffff",
            border: "1.5px solid rgba(255, 255, 255, 0.2)",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all 0.2s ease",
            outline: "none",
          }}
        >
          {showQuickMenu ? <X size={22} /> : <MoreVertical size={22} />}
        </button>

        {/* Quick Menu Flyout Popup */}
        {showQuickMenu && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              top: 56,
              right: 0,
              width: 310,
              backgroundColor: "rgba(15, 23, 42, 0.95)",
              border: "1px solid rgba(34, 197, 94, 0.35)",
              borderRadius: 24,
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.85), 0 0 25px rgba(34, 197, 94, 0.2)",
              backdropFilter: "blur(20px)",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              color: "#fff",
              fontFamily: "system-ui, -apple-system, sans-serif",
              animation: "fadeIn 0.15s ease-out",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", letterSpacing: "0.02em" }}>
                  Kathua Fresh TV
                </div>
                <div style={{ fontSize: 11, color: "#86efac", fontWeight: 600 }}>
                  Device & Control Hub
                </div>
              </div>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 12, backgroundColor: "rgba(34, 197, 94, 0.2)", color: "#4ade80", fontWeight: 700 }}>
                {token ? "PAIRED" : "PREVIEW"}
              </span>
            </div>

            {/* Action 1: Open Admin Panel */}
            <button
              onClick={() => {
                setShowQuickMenu(false);
                if (typeof window !== "undefined" && (window as any).AndroidSignage?.switchMode) {
                  (window as any).AndroidSignage.switchMode("admin");
                } else {
                  setShowConnectModal(true);
                }
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                borderRadius: 16,
                backgroundColor: "rgba(34, 197, 94, 0.14)",
                border: "1px solid rgba(34, 197, 94, 0.35)",
                color: "#86efac",
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
                transition: "all 0.15s ease",
              }}
            >
              <Smartphone size={20} style={{ flexShrink: 0, color: "#4ade80" }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#ffffff" }}>
                  Open Admin Mode (Upload Offers)
                </div>
                <div style={{ fontSize: 10, color: "rgba(255, 255, 255, 0.65)", marginTop: 2 }}>
                  Manage offers & images on phone or device
                </div>
              </div>
            </button>

            {/* Action 2: Refresh Products & Sync Offers */}
            <button
              disabled={isSyncing}
              onClick={async () => {
                setIsSyncing(true);
                try {
                  await fetchManifest();
                  setSyncToast("Products & Offers Synced!");
                  setTimeout(() => setSyncToast(null), 3000);
                } catch {
                  window.location.reload();
                } finally {
                  setIsSyncing(false);
                  setShowQuickMenu(false);
                }
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                borderRadius: 16,
                backgroundColor: "rgba(56, 189, 248, 0.14)",
                border: "1px solid rgba(56, 189, 248, 0.35)",
                color: "#38bdf8",
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
                transition: "all 0.15s ease",
              }}
            >
              <RefreshCw size={20} style={{ flexShrink: 0, color: "#38bdf8" }} className={isSyncing ? "animate-spin" : ""} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#ffffff" }}>
                  {isSyncing ? "Syncing..." : "Refresh Products & Offers"}
                </div>
                <div style={{ fontSize: 10, color: "rgba(255, 255, 255, 0.65)", marginTop: 2 }}>
                  Fetch latest new items & prices
                </div>
              </div>
            </button>

            {/* Action: Switch to 100% Live Mode (Hide Preview Banner) */}
            {isPreview && (
              <button
                onClick={() => {
                  const liveToken = "live-screen-" + Date.now();
                  localStorage.setItem("signage_device_token", liveToken);
                  setToken(liveToken);
                  setIsPreview(false);
                  setHidePreviewBanner(true);
                  const cleanUrl = window.location.pathname;
                  window.history.replaceState({}, document.title, cleanUrl);
                  setShowQuickMenu(false);
                  setSyncToast("Switched to 100% Live TV Mode!");
                  setTimeout(() => setSyncToast(null), 3000);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 16,
                  backgroundColor: "rgba(234, 88, 12, 0.16)",
                  border: "1px solid rgba(234, 88, 12, 0.4)",
                  color: "#fb923c",
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                  transition: "all 0.15s ease",
                }}
              >
                <Tv size={20} style={{ flexShrink: 0, color: "#f97316" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#ffffff" }}>
                    Go 100% Live (Remove Banner)
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255, 255, 255, 0.65)", marginTop: 2 }}>
                    Hide orange &quot;Preview Mode&quot; badge
                  </div>
                </div>
              </button>
            )}

            {/* Action 3: Switch to Admin Mode */}
            <button
              onClick={() => {
                setShowQuickMenu(false);
                if (typeof window !== "undefined" && (window as any).AndroidSignage?.switchMode) {
                  (window as any).AndroidSignage.switchMode("admin");
                } else {
                  window.location.href = "/admin/signage";
                }
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                borderRadius: 16,
                backgroundColor: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "#ffffff",
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
                transition: "all 0.15s ease",
              }}
            >
              <ShieldCheck size={20} style={{ flexShrink: 0, color: "#38bdf8" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#ffffff" }}>
                  Switch to Admin Mode
                </div>
                <div style={{ fontSize: 10, color: "rgba(255, 255, 255, 0.65)", marginTop: 2 }}>
                  Manage slides, voice & TV settings
                </div>
              </div>
              <ExternalLink size={14} style={{ color: "rgba(255,255,255,0.4)" }} />
            </button>

            {/* Action 3: TV Devices Management */}
            <a
              href="/admin/signage/more/devices"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                borderRadius: 14,
                backgroundColor: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                color: "#ffffff",
                textDecoration: "none",
                cursor: "pointer",
              }}
            >
              <Tv size={18} style={{ flexShrink: 0, color: "#a78bfa" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>Manage TV Devices</div>
              </div>
              <ExternalLink size={12} style={{ color: "rgba(255,255,255,0.3)" }} />
            </a>

            {/* Action 4: Toggle Fullscreen */}
            <button
              onClick={() => {
                toggleFullScreen();
                setShowQuickMenu(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                borderRadius: 14,
                backgroundColor: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                color: "#ffffff",
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
              }}
            >
              <Maximize2 size={18} style={{ flexShrink: 0, color: "#facc15" }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>Toggle Fullscreen</div>
              </div>
            </button>

            {/* Action: Slide Transition Style (Cinematic Fade / Smooth Slide) */}
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 14,
                backgroundColor: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Sparkles size={16} style={{ color: "#facc15" }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
                    Slide Transition
                  </span>
                </div>
                <span style={{ fontSize: 10, color: "#86efac", fontWeight: 700, textTransform: "uppercase" }}>
                  {transitionStyle === "cinematic" ? "Cinematic" : "Slide"}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <button
                  onClick={() => {
                    setTransitionStyle("cinematic");
                    localStorage.setItem("tv_transition_style", "cinematic");
                    setSyncToast("Cinematic Fade Transition Applied ✨");
                    setTimeout(() => setSyncToast(null), 2500);
                  }}
                  style={{
                    padding: "7px 10px",
                    borderRadius: 10,
                    fontSize: 11,
                    fontWeight: 700,
                    backgroundColor: transitionStyle === "cinematic" ? "rgba(34, 197, 94, 0.25)" : "rgba(255, 255, 255, 0.05)",
                    border: transitionStyle === "cinematic" ? "1px solid #22c55e" : "1px solid rgba(255, 255, 255, 0.1)",
                    color: transitionStyle === "cinematic" ? "#86efac" : "#94a3b8",
                    cursor: "pointer",
                    textAlign: "center",
                    transition: "all 0.15s ease",
                  }}
                >
                  ✨ Smooth Fade
                </button>
                <button
                  onClick={() => {
                    setTransitionStyle("slide");
                    localStorage.setItem("tv_transition_style", "slide");
                    setSyncToast("Smooth Slide Transition Applied ➡️");
                    setTimeout(() => setSyncToast(null), 2500);
                  }}
                  style={{
                    padding: "7px 10px",
                    borderRadius: 10,
                    fontSize: 11,
                    fontWeight: 700,
                    backgroundColor: transitionStyle === "slide" ? "rgba(56, 189, 248, 0.25)" : "rgba(255, 255, 255, 0.05)",
                    border: transitionStyle === "slide" ? "1px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.1)",
                    color: transitionStyle === "slide" ? "#7dd3fc" : "#94a3b8",
                    cursor: "pointer",
                    textAlign: "center",
                    transition: "all 0.15s ease",
                  }}
                >
                  ➡️ Smooth Slide
                </button>
              </div>
            </div>

            {/* Action 5: Audio & Interval Timer Settings Card */}
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 16,
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {isAudioMuted ? (
                    <VolumeX size={18} style={{ color: "#f87171" }} />
                  ) : (
                    <Volume2 size={18} style={{ color: "#4ade80" }} />
                  )}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                      Store Background Music
                    </div>
                    <div style={{ fontSize: 10, color: !isAudioMuted ? "#86efac" : "#fca5a5" }}>
                      {!isAudioMuted
                        ? isAudioPlaying
                          ? "Playing Now 🔊"
                          : audioIntervalCountdown !== null
                          ? `Next Sound: in ${audioIntervalCountdown}s ⏱️`
                          : "Active"
                        : "Sound Muted 🔇"}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => toggleTvAudio()}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 20,
                    backgroundColor: !isAudioMuted ? "#22c55e" : "rgba(239, 68, 68, 0.3)",
                    border: `1px solid ${!isAudioMuted ? "#22c55e" : "#ef4444"}`,
                    color: !isAudioMuted ? "#022c22" : "#ffffff",
                    fontSize: 11,
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  {!isAudioMuted ? "ON" : "OFF"}
                </button>
              </div>

              {/* Interval Timer Trigger Options */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 4, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>
                  Trigger Interval (Kitne der baad baje):
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                  {[
                    { label: "Loop (Continuous)", sec: 0 },
                    { label: "30 Sec", sec: 30 },
                    { label: "1 Min", sec: 60 },
                    { label: "2 Min", sec: 120 },
                    { label: "3 Min", sec: 180 },
                    { label: "5 Min", sec: 300 },
                  ].map((item) => {
                    const isSelected = audioIntervalSec === item.sec;
                    return (
                      <button
                        key={item.sec}
                        onClick={() => changeAudioInterval(item.sec)}
                        style={{
                          padding: "6px 4px",
                          borderRadius: 10,
                          fontSize: 10,
                          fontWeight: 700,
                          backgroundColor: isSelected ? "rgba(34, 197, 94, 0.25)" : "rgba(255,255,255,0.04)",
                          border: `1px solid ${isSelected ? "#22c55e" : "rgba(255,255,255,0.1)"}`,
                          color: isSelected ? "#4ade80" : "rgba(255,255,255,0.7)",
                          cursor: "pointer",
                          textAlign: "center",
                        }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Action 6: Hard Reload TV App */}
            <button
              onClick={() => window.location.reload()}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 14px",
                borderRadius: 12,
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                color: "rgba(255,255,255,0.7)",
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              <RefreshCw size={14} style={{ color: "rgba(255,255,255,0.4)" }} />
              <span>Hard Reload TV App</span>
            </button>

            {/* Action 7: Reset & Refresh Display */}
            {token && (
              <button
                onClick={() => {
                  if (confirm("Reset TV Display cache?")) {
                    localStorage.removeItem("signage_device_token");
                    setToken(null);
                    setShowQuickMenu(false);
                    fetchManifest();
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 14px",
                  borderRadius: 14,
                  backgroundColor: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.25)",
                  color: "#fca5a5",
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                  marginTop: 4,
                }}
              >
                <LogOut size={16} style={{ flexShrink: 0, color: "#ef4444" }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#ef4444" }}>
                    Reset Display Cache
                  </div>
                </div>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* PHONE CONNECT / PAIRING POPUP MODAL                          */}
      {/* ============================================================ */}
      {showConnectModal && (
        <div
          onClick={() => setShowConnectModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(16px)",
            zIndex: 10002,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#06281e",
              border: "2px solid rgba(34, 197, 94, 0.4)",
              borderRadius: 32,
              padding: "36px 44px",
              maxWidth: 620,
              width: "100%",
              boxShadow: "0 25px 70px rgba(0, 0, 0, 0.9), 0 0 40px rgba(34, 197, 94, 0.3)",
              color: "#ffffff",
              textAlign: "center",
              position: "relative",
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowConnectModal(false)}
              style={{
                position: "absolute",
                top: 20,
                right: 20,
                width: 40,
                height: 40,
                borderRadius: "50%",
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                border: "none",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <X size={20} />
            </button>

            <div style={{ fontSize: 13, color: "#86efac", textTransform: "uppercase", letterSpacing: 3, fontWeight: 700 }}>
              Kathua Fresh Management
            </div>
            <h2 style={{ fontSize: 30, fontWeight: 800, margin: "10px 0 20px 0", color: "#ffffff" }}>
              Shop Admin Controller
            </h2>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 32, margin: "20px 0" }}>
              {/* QR Code linking to Admin Mode */}
              <div
                style={{
                  backgroundColor: "#ffffff",
                  padding: 12,
                  borderRadius: 20,
                  width: 190,
                  height: 190,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
                    typeof window !== "undefined"
                      ? `${window.location.origin}/admin/signage`
                      : "https://tv-app-5wzh.vercel.app/admin/signage"
                  )}`}
                  alt="Scan to Open Admin"
                  style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                />
              </div>

              {/* Instructions */}
              <div style={{ textAlign: "left", maxWidth: 280 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#4ade80", marginBottom: 6 }}>
                  📱 Open on your Phone
                </div>
                <div style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.8)", lineHeight: 1.5 }}>
                  Point your phone camera at the QR code to open <strong>Kathua Fresh Admin</strong>. Any image you upload or price you change updates this screen in real-time!
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24 }}>
              <button
                onClick={() => {
                  setShowConnectModal(false);
                  if (typeof window !== "undefined" && (window as any).AndroidSignage?.switchMode) {
                    (window as any).AndroidSignage.switchMode("admin");
                  } else {
                    window.location.href = "/admin/signage";
                  }
                }}
                style={{
                  padding: "12px 24px",
                  borderRadius: 14,
                  backgroundColor: "#22c55e",
                  color: "#022c22",
                  fontWeight: 700,
                  fontSize: 13,
                  border: "none",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <ExternalLink size={16} />
                <span>Switch to Admin on this Device</span>
              </button>
              <button
                onClick={() => setShowConnectModal(false)}
                style={{
                  padding: "12px 24px",
                  borderRadius: 14,
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: 13,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Close & Return to TV
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Sync Toast Notification */}
      {syncToast && (
        <div
          style={{
            position: "fixed",
            top: 24,
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "rgba(6, 78, 59, 0.95)",
            border: "2px solid #22c55e",
            borderRadius: 30,
            padding: "12px 28px",
            color: "#ffffff",
            fontWeight: 800,
            fontSize: 18,
            boxShadow: "0 10px 35px rgba(0, 0, 0, 0.85), 0 0 25px rgba(34, 197, 94, 0.5)",
            backdropFilter: "blur(12px)",
            zIndex: 10005,
            display: "flex",
            alignItems: "center",
            gap: 12,
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <span style={{ fontSize: 22 }}>✅</span>
          <span>{syncToast}</span>
        </div>
      )}
    </div>
  );
}

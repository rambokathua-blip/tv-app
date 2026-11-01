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
  ChevronUp,
  ChevronDown,
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
  const [showCustomIntervalModal, setShowCustomIntervalModal] = useState(false);
  const [customIntervalValue, setCustomIntervalValue] = useState<number>(2);
  const [customIntervalUnit, setCustomIntervalUnit] = useState<"sec" | "min">("min");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const menuScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [windowScale, setWindowScale] = useState(1);

  const goToSlideRef = useRef<((idx: number) => void) | null>(null);
  const isPausedRef = useRef(false);
  const currentIndexRef = useRef(0);
  const lastCommandTimeRef = useRef<number>(Date.now());
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

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
      if (e.data?.type === "PAUSE_TV") {
        setIsPaused(true);
      } else if (e.data?.type === "RESUME_TV") {
        setIsPaused(false);
      } else if (e.data?.type === "NEXT_SLIDE") {
        goToSlideRef.current?.(currentIndexRef.current + 1);
      } else if (e.data?.type === "PREV_SLIDE") {
        goToSlideRef.current?.(currentIndexRef.current - 1);
      } else if (
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
              mrp: p.mrp || null,
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

      const rawQrs = localStorage.getItem("kathua_tv_qrs");
      if (rawQrs) {
        const localQrs = JSON.parse(rawQrs);
        if (Array.isArray(localQrs) && localQrs.length > 0) {
          baseManifest = {
            ...baseManifest,
            qr_codes: localQrs,
          };
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
      let validSlides = manifestData.slides.filter(
        (s) => s.id !== "demo-onion" && s.id !== "demo-apple"
      );

      // Merge local promotions MRP if server slide is missing MRP
      try {
        if (typeof window !== "undefined") {
          const raw = localStorage.getItem("kathua_signage_promotions");
          if (raw) {
            const localList = JSON.parse(raw);
            if (Array.isArray(localList) && localList.length > 0) {
              const localMap = new Map<string, any>(
                localList.map((p: any) => [p.title?.toLowerCase()?.trim(), p])
              );
              validSlides = validSlides.map((sl: any) => {
                if (!sl.mrp && sl.title) {
                  const match = localMap.get(sl.title.toLowerCase().trim());
                  if (match && match.mrp) {
                    return { ...sl, mrp: match.mrp };
                  }
                }
                return sl;
              });
            }
          }
        }
      } catch {}

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
              mrp: p.mrp || null,
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

            let res = {
              ...manifestData,
              slides: finalSlides,
            };
            const rawQrs = localStorage.getItem("kathua_tv_qrs");
            if (rawQrs) {
              const localQrs = JSON.parse(rawQrs);
              if (Array.isArray(localQrs) && localQrs.length > 0) {
                res.qr_codes = localQrs;
              }
            }
            return res;
          }
        }
      }
    } catch {}

    try {
      const rawQrs = localStorage.getItem("kathua_tv_qrs");
      if (rawQrs) {
        const localQrs = JSON.parse(rawQrs);
        if (Array.isArray(localQrs) && localQrs.length > 0) {
          return {
            ...manifestData,
            qr_codes: localQrs,
          };
        }
      }
    } catch {}

    return manifestData;
  }, []);

  // Manifest Fetching (User Screen Display Mode — No Pairing Required)
  const fetchManifest = useCallback(async (jumpToFirst = false) => {
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
        if (jumpToFirst) {
          setCurrentIndex(0);
          setSlideProgress(0);
        } else {
          setCurrentIndex((prev) => (data.slides && data.slides.length > 0 && prev < data.slides.length ? prev : 0));
        }
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
      if (jumpToFirst) {
        setCurrentIndex(0);
        setSlideProgress(0);
      } else {
        setCurrentIndex((prev) => (enriched.slides && enriched.slides.length > 0 && prev < enriched.slides.length ? prev : 0));
      }
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
            fetchManifest(true);
          }
          if (typeof data.is_paused === "boolean" && data.is_paused !== isPausedRef.current) {
            isPausedRef.current = data.is_paused;
            setIsPaused(data.is_paused);
          }
          if (data.last_command && data.last_command.timestamp > lastCommandTimeRef.current) {
            lastCommandTimeRef.current = data.last_command.timestamp;
            if (data.last_command.action === "next") {
              goToSlideRef.current?.(currentIndexRef.current + 1);
            } else if (data.last_command.action === "pause") {
              setIsPaused(true);
            } else if (data.last_command.action === "resume") {
              setIsPaused(false);
            }
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
          fetchManifest(true);
        } else if (event.data?.type === "PAUSE_TV") {
          setIsPaused(true);
        } else if (event.data?.type === "RESUME_TV") {
          setIsPaused(false);
        } else if (event.data?.type === "NEXT_SLIDE") {
          goToSlideRef.current?.(currentIndexRef.current + 1);
        } else if (event.data?.type === "PREV_SLIDE") {
          goToSlideRef.current?.(currentIndexRef.current - 1);
        } else if (event.data?.type === "TV_AUDIO_TOGGLE") {
          const enabled = event.data.enabled;
          const isInIframe = typeof window !== "undefined" && window.self !== window.top;
          if (!isInIframe) {
            setIsAudioMuted(!enabled);
            if (audioRef.current) {
              audioRef.current.muted = !enabled;
              if (enabled) {
                audioRef.current.play().catch(() => {});
              } else {
                audioRef.current.pause();
              }
            }
          }
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
    goToSlideRef.current = goToSlide;
  }, [goToSlide]);

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

  // Helper to programmatically scroll the TV 3-dot drawer
  const scrollMenu = useCallback((delta: number) => {
    if (menuScrollContainerRef.current) {
      menuScrollContainerRef.current.scrollBy({ top: delta, behavior: "smooth" });
    }
  }, []);

  // TV Remote D-Pad Navigation inside the Quick Menu Drawer
  const navigateDrawerFocus = useCallback((delta: number) => {
    const drawer = document.getElementById("tv-quick-menu-drawer");
    if (!drawer) return;
    const focusables = Array.from(
      drawer.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href]:not([disabled]), [tabindex="0"]:not([disabled])'
      )
    ).filter((el) => {
      const style = window.getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden" && el.offsetParent !== null;
    });

    if (focusables.length === 0) return;

    const activeIdx = focusables.findIndex((el) => el === document.activeElement);
    let nextIdx = 0;
    if (activeIdx !== -1) {
      nextIdx = (activeIdx + delta + focusables.length) % focusables.length;
    } else {
      nextIdx = delta > 0 ? 0 : focusables.length - 1;
    }

    const target = focusables[nextIdx];
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, []);

  // Automatically focus first item when Quick Menu opens so TV cursor is visible
  useEffect(() => {
    if (showQuickMenu) {
      const timer = setTimeout(() => {
        const drawer = document.getElementById("tv-quick-menu-drawer");
        if (drawer) {
          const firstFocusable = drawer.querySelector<HTMLElement>(
            'button:not([disabled]), a[href]:not([disabled]), [tabindex="0"]'
          );
          firstFocusable?.focus();
        }
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [showQuickMenu]);

  // Comprehensive TV Remote Control (D-Pad) and Keyboard navigation handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      const key = e.key;
      const keyCode = e.keyCode;

      // 1. Handle Quick Menu D-pad navigation when open
      if (showQuickMenu) {
        if (key === "Escape" || key === "Back" || keyCode === 27 || keyCode === 4) {
          e.preventDefault();
          setShowQuickMenu(false);
          setTimeout(() => {
            document.getElementById("tv-three-dots-btn")?.focus();
          }, 60);
          return;
        }
        if (key === "ArrowDown" || keyCode === 40 || keyCode === 20) {
          e.preventDefault();
          navigateDrawerFocus(1);
          return;
        }
        if (key === "ArrowUp" || keyCode === 38 || keyCode === 19) {
          e.preventDefault();
          navigateDrawerFocus(-1);
          return;
        }
        // Prevent background slide transitions while inside menu
        if (key === "ArrowRight" || key === "ArrowLeft" || code === "Space") {
          return;
        }
      }

      // 2. Handle Dialog Modals
      if (showConnectModal) {
        if (key === "Escape" || key === "Back" || keyCode === 27 || keyCode === 4) {
          e.preventDefault();
          setShowConnectModal(false);
          return;
        }
      }
      if (showCustomIntervalModal) {
        if (key === "Escape" || key === "Back" || keyCode === 27 || keyCode === 4) {
          e.preventDefault();
          setShowCustomIntervalModal(false);
          return;
        }
      }

      // 3. Quick menu open via Remote Menu key or M key
      if (key === "Menu" || key === "ContextMenu" || keyCode === 82 || code === "KeyM") {
        e.preventDefault();
        setShowQuickMenu((prev) => !prev);
        return;
      }

      // 4. Remote ArrowUp on main TV screen: focus the 3-dots button
      if (key === "ArrowUp" || keyCode === 38 || keyCode === 19) {
        const threeDotsBtn = document.getElementById("tv-three-dots-btn");
        if (threeDotsBtn && document.activeElement !== threeDotsBtn) {
          e.preventDefault();
          threeDotsBtn.focus();
          return;
        }
      }

      // 5. Standard Playback Controls
      if (code === "Space") {
        setIsPaused((p) => !p);
      } else if (key === "ArrowRight" || code === "ArrowRight" || keyCode === 39 || keyCode === 22) {
        goToSlide(currentIndex + 1);
      } else if (key === "ArrowLeft" || code === "ArrowLeft" || keyCode === 37 || keyCode === 21) {
        goToSlide(currentIndex - 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, goToSlide, showQuickMenu, showConnectModal, showCustomIntervalModal, navigateDrawerFocus]);

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
        {/* Ambient Backlight Glow (OLED Aura) */}
        {!isLogo && slide.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={slide.image_url}
            alt=""
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: -60,
              width: "calc(100% + 120px)",
              height: "calc(100% + 120px)",
              objectFit: "cover",
              filter: "blur(45px) brightness(0.35)",
              zIndex: 1,
              pointerEvents: "none",
            }}
          />
        )}

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
              position: "relative",
              zIndex: 2,
              width: "100%",
              height: "100%",
              objectFit: isLogo ? "contain" : "cover",
              padding: isLogo ? "36px 48px" : "0",
              animation: !isLogo && !isTransitioning ? "kenBurnsCinematic 14s ease-in-out infinite alternate" : undefined,
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

        {/* Irresistible Animated Floating Price & MRP Badge */}
        {(() => {
          let displayMrp = slide.mrp || null;
          let displayPrice = slide.price_text || "";

          // Smart fallback: if slide.mrp is not set directly, but price_text contains "MRP: 30 TODAY price: 25 rs" or similar
          if (!displayMrp && displayPrice) {
            const mrpMatch = displayPrice.match(/mrp[:\s]*([0-9₹]+)/i);
            if (mrpMatch) {
              displayMrp = mrpMatch[1].startsWith("₹") ? mrpMatch[1] : `₹${mrpMatch[1]}`;
              const dealMatch = displayPrice.match(/(?:today price|deal|offer price|price|@)[:\s]*([0-9₹\s\w/]+)/i);
              if (dealMatch) {
                displayPrice = dealMatch[1].trim();
              }
            }
          }

          // Calculate discount badge
          let discountText: string | null = null;
          if (displayMrp && displayPrice) {
            const numMrp = parseFloat(displayMrp.replace(/[^0-9.]/g, ""));
            const numPrice = parseFloat(displayPrice.replace(/[^0-9.]/g, ""));
            if (numMrp > 0 && numPrice > 0 && numMrp > numPrice) {
              const saving = Math.round(numMrp - numPrice);
              const pct = Math.round(((numMrp - numPrice) / numMrp) * 100);
              discountText = `${pct}% OFF • SAVE ₹${saving}`;
            }
          }

          if (!displayPrice && !displayMrp) return null;

          return (
            <div
              style={{
                position: "absolute",
                bottom: 44,
                left: 44,
                zIndex: 15,
                background: "linear-gradient(135deg, rgba(15, 23, 42, 0.94) 0%, rgba(6, 40, 30, 0.94) 100%)",
                backdropFilter: "blur(16px)",
                padding: "18px 40px",
                borderRadius: 24,
                border: "2.5px solid #facc15",
                boxShadow: "0 20px 50px rgba(0,0,0,0.85), 0 0 35px rgba(250, 204, 21, 0.45)",
                animation: "priceBadgeFloat 3.5s ease-in-out infinite, priceBadgeGlow 3s ease-in-out infinite",
              }}
            >
              {/* Offer Title */}
              <div
                style={{
                  fontSize: 26,
                  color: "#86efac",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", backgroundColor: "#4ade80", boxShadow: "0 0 10px #4ade80" }} />
                <span>{slide.title}</span>
              </div>

              {/* Crossed-out MRP & Discount Badge */}
              {displayMrp && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginTop: 6,
                    marginBottom: 2,
                  }}
                >
                  <span
                    style={{
                      fontSize: 28,
                      fontWeight: 700,
                      color: "rgba(255, 255, 255, 0.55)",
                      textDecoration: "line-through",
                      textDecorationColor: "#ef4444",
                      textDecorationThickness: 3,
                    }}
                  >
                    MRP {displayMrp.startsWith("₹") ? displayMrp : `₹${displayMrp}`}
                  </span>
                  {discountText && (
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 900,
                        padding: "3px 12px",
                        borderRadius: 10,
                        background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
                        color: "#ffffff",
                        boxShadow: "0 4px 14px rgba(239, 68, 68, 0.5)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {discountText}
                    </span>
                  )}
                </div>
              )}

              {/* Big Glowing Deal Price */}
              {displayPrice && (
                <div
                  style={{
                    fontSize: displayMrp ? 64 : 72,
                    fontWeight: 900,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.1,
                    marginTop: 2,
                    background: "linear-gradient(90deg, #fef08a 0%, #facc15 35%, #ffffff 50%, #facc15 65%, #f59e0b 100%)",
                    backgroundSize: "200% auto",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    animation: "shimmerSweep 4s linear infinite",
                    textShadow: "0 4px 20px rgba(250, 204, 21, 0.4)",
                  }}
                >
                  {displayPrice}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    );
  };

  const isImmersive = manifest.branding?.layout_profile === "immersive";
  const promoWidth = isImmersive ? 1920 : 1500;
  const promoHeight = isImmersive ? 960 : 844;

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
      {/* ZONE A: PROMOTION AREA (1500 x 844 or Full 16:9 Immersive)   */}
      {/* ============================================================ */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: promoWidth,
          height: promoHeight,
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

        {/* Paused Indicator Overlay */}
        {isPaused && (
          <div
            style={{
              position: "absolute",
              top: 24,
              left: 24,
              backgroundColor: "rgba(15, 23, 42, 0.9)",
              border: "2px solid #f59e0b",
              borderRadius: 20,
              padding: "10px 22px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              zIndex: 35,
              boxShadow: "0 10px 25px rgba(0,0,0,0.7), 0 0 20px rgba(245, 158, 11, 0.4)",
              backdropFilter: "blur(12px)",
            }}
          >
            <span style={{ fontSize: 20 }}>⏸️</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Slideshow Paused
              </div>
              <div style={{ fontSize: 10, color: "#cbd5e1" }}>
                Controlled by Shop Admin
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
        style={
          isImmersive
            ? {
                position: "absolute",
                top: 24,
                right: 24,
                width: 380,
                maxHeight: 880,
                background: "linear-gradient(180deg, rgba(2, 26, 18, 0.88) 0%, rgba(6, 40, 30, 0.85) 40%, rgba(5, 18, 27, 0.94) 100%)",
                border: "2px solid rgba(34, 197, 94, 0.45)",
                borderRadius: 28,
                boxShadow: "0 25px 60px rgba(0, 0, 0, 0.85), inset 1px 0 0 rgba(255, 255, 255, 0.15)",
                backdropFilter: "blur(24px)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "16px 16px 14px",
                overflow: "hidden",
                zIndex: 30,
              }
            : {
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
              }
        }
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
        {/* 2. CREATIVE IRRESISTIBLE SMART QR CARDS (WA, IG, CUSTOM)   */}
        {/* ========================================================== */}
        {(() => {
          const activeQrs = (manifest.qr_codes || []).filter((q: any) => q.enabled !== false);
          const qrCount = activeQrs.length;
          const isCompact = qrCount >= 3;

          return (
            <div
              style={{
                width: "100%",
                flex: 1,
                display: "flex",
                flexDirection: "column",
                justifyContent: isCompact ? "space-around" : "space-between",
                gap: isCompact ? 8 : 12,
                overflowY: qrCount > 3 ? "auto" : "visible",
                maxHeight: "100%",
                scrollbarWidth: "none",
              }}
            >
              {activeQrs.map((qr) => {
                const isWhatsApp =
                  qr.label.toLowerCase().includes("whatsapp") ||
                  qr.target_url.toLowerCase().includes("wa") ||
                  qr.target_url.toLowerCase().includes("whatsapp");

                const isInstagram =
                  qr.label.toLowerCase().includes("instagram") ||
                  qr.target_url.toLowerCase().includes("instagram") ||
                  qr.target_url.toLowerCase().includes("ig");

                const isYouTube =
                  qr.label.toLowerCase().includes("youtube") ||
                  qr.target_url.toLowerCase().includes("youtube") ||
                  qr.target_url.toLowerCase().includes("youtu.be");

                const isPay =
                  qr.label.toLowerCase().includes("pay") ||
                  qr.label.toLowerCase().includes("upi") ||
                  qr.target_url.toLowerCase().includes("upi") ||
                  qr.target_url.toLowerCase().includes("gpay") ||
                  qr.target_url.toLowerCase().includes("phonepe");

                const isReview =
                  qr.label.toLowerCase().includes("review") ||
                  qr.label.toLowerCase().includes("rating") ||
                  qr.label.toLowerCase().includes("google") ||
                  qr.label.toLowerCase().includes("maps");

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
                            width: isCompact ? 24 : 34,
                            height: isCompact ? 24 : 34,
                            borderRadius: "50%",
                            backgroundColor: "#25D366",
                            border: `${isCompact ? 1.5 : 2.5}px solid #ffffff`,
                            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.4)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <svg viewBox="0 0 32 32" width={isCompact ? 13 : 18} height={isCompact ? 13 : 18} fill="#ffffff">
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
                            width: isCompact ? 24 : 34,
                            height: isCompact ? 24 : 34,
                            borderRadius: isCompact ? 7 : 10,
                            background: "linear-gradient(135deg, #833AB4 0%, #FD1D1D 50%, #FCB045 100%)",
                            border: `${isCompact ? 1.5 : 2.5}px solid #ffffff`,
                            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.4)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <svg viewBox="0 0 32 32" width={isCompact ? 13 : 18} height={isCompact ? 13 : 18} fill="#ffffff">
                            <path d="M16 4.9c3.6 0 4 .02 5.4.08 3.5.16 5.1 1.74 5.2 5.2.06 1.4.08 1.8.08 5.4s-.02 4-.08 5.4c-.16 3.5-1.74 5.1-5.2 5.2-1.4.06-1.8.08-5.4.08s-4-.02-5.4-.08c-3.5-.16-5.1-1.74-5.2-5.2-.06-1.4-.08-1.8-.08-5.4s.02-4 .08-5.4c.16-3.5 1.74-5.1 5.2-5.2 1.4-.06 1.8-.08 5.4-.08m0-2.9c-3.7 0-4.1.02-5.6.08-4.8.22-7.4 2.83-7.6 7.6-.07 1.5-.09 1.9-.09 5.6s.02 4.1.08 5.6c.22 4.8 2.83 7.4 7.6 7.6 1.5.07 1.9.09 5.6.09s4.1-.02 5.6-.08c4.8-.22 7.4-2.83 7.6-7.6.07-1.5.09-1.9.09-5.6s-.02-4.1-.08-5.6c-.22-4.8-2.83-7.4-7.6-7.6-1.5-.07-1.9-.09-5.6-.09z" />
                            <path d="M16 9.3c-3.7 0-6.7 3-6.7 6.7s3 6.7 6.7 6.7 6.7-3 6.7-6.7-3-6.7-6.7-6.7zm0 10.7c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z" />
                            <circle cx="23" cy="9" r="1.6" />
                          </svg>
                        </div>
                      ),
                    }
                  : isYouTube
                  ? {
                      cardBg:
                        "linear-gradient(155deg, rgba(220, 38, 38, 0.4) 0%, rgba(185, 28, 28, 0.22) 45%, rgba(20, 5, 5, 0.9) 100%)",
                      cardBorder: "rgba(239, 68, 68, 0.45)",
                      cardGlow: "rgba(239, 68, 68, 0.22)",
                      badgeBg: "#FF0000",
                      badgeShadow: "0 4px 14px rgba(239, 68, 68, 0.45)",
                      cornerColor: "#ef4444",
                      btnBg: "linear-gradient(90deg, #dc2626 0%, #ef4444 100%)",
                      btnShadow: "0 4px 16px rgba(239, 68, 68, 0.35)",
                      title: qr.label.toUpperCase(),
                      subtitle: qr.caption || "Subscribe for recipes & deals",
                      chip: "WATCH",
                      chipColor: "#ef4444",
                      ctaText: "Point Camera to Watch",
                      fallbackImg: undefined,
                      logoSvg: (
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="#ffffff">
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                        </svg>
                      ),
                      centerLogo: (
                        <div
                          style={{
                            width: isCompact ? 24 : 34,
                            height: isCompact ? 24 : 34,
                            borderRadius: isCompact ? 7 : 10,
                            backgroundColor: "#FF0000",
                            border: `${isCompact ? 1.5 : 2.5}px solid #ffffff`,
                            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.4)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <svg viewBox="0 0 24 24" width={isCompact ? 13 : 18} height={isCompact ? 13 : 18} fill="#ffffff">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      ),
                    }
                  : isPay
                  ? {
                      cardBg:
                        "linear-gradient(155deg, rgba(2, 132, 199, 0.42) 0%, rgba(14, 165, 233, 0.22) 45%, rgba(5, 15, 30, 0.9) 100%)",
                      cardBorder: "rgba(56, 189, 248, 0.45)",
                      cardGlow: "rgba(56, 189, 248, 0.22)",
                      badgeBg: "#0284c7",
                      badgeShadow: "0 4px 14px rgba(2, 132, 199, 0.45)",
                      cornerColor: "#38bdf8",
                      btnBg: "linear-gradient(90deg, #0284c7 0%, #38bdf8 100%)",
                      btnShadow: "0 4px 16px rgba(2, 132, 199, 0.35)",
                      title: qr.label.toUpperCase(),
                      subtitle: qr.caption || "GPay • PhonePe • Paytm • UPI",
                      chip: "PAY",
                      chipColor: "#38bdf8",
                      ctaText: "Point Camera to Pay",
                      fallbackImg: undefined,
                      logoSvg: (
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ffffff" strokeWidth="2.5">
                          <rect width="20" height="14" x="2" y="5" rx="2" />
                          <line x1="2" x2="22" y1="10" y2="10" />
                        </svg>
                      ),
                      centerLogo: (
                        <div
                          style={{
                            width: isCompact ? 24 : 34,
                            height: isCompact ? 24 : 34,
                            borderRadius: "50%",
                            backgroundColor: "#0284c7",
                            border: `${isCompact ? 1.5 : 2.5}px solid #ffffff`,
                            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.4)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <span style={{ fontSize: isCompact ? 12 : 16, color: "#ffffff", fontWeight: 900 }}>₹</span>
                        </div>
                      ),
                    }
                  : isReview
                  ? {
                      cardBg:
                        "linear-gradient(155deg, rgba(217, 119, 6, 0.4) 0%, rgba(245, 158, 11, 0.22) 45%, rgba(25, 15, 5, 0.9) 100%)",
                      cardBorder: "rgba(251, 191, 36, 0.45)",
                      cardGlow: "rgba(251, 191, 36, 0.22)",
                      badgeBg: "linear-gradient(135deg, #4285F4 0%, #EA4335 33%, #FBBC05 66%, #34A853 100%)",
                      badgeShadow: "0 4px 14px rgba(251, 191, 36, 0.45)",
                      cornerColor: "#f59e0b",
                      btnBg: "linear-gradient(90deg, #d97706 0%, #f59e0b 100%)",
                      btnShadow: "0 4px 16px rgba(245, 158, 11, 0.35)",
                      title: qr.label.toUpperCase(),
                      subtitle: qr.caption || "Rate us on Google Maps",
                      chip: "5.0 ★",
                      chipColor: "#fbbf24",
                      ctaText: "Point Camera to Rate",
                      fallbackImg: undefined,
                      logoSvg: (
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="#ffffff">
                          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                        </svg>
                      ),
                      centerLogo: (
                        <div
                          style={{
                            width: isCompact ? 24 : 34,
                            height: isCompact ? 24 : 34,
                            borderRadius: "50%",
                            backgroundColor: "#f59e0b",
                            border: `${isCompact ? 1.5 : 2.5}px solid #ffffff`,
                            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.4)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <span style={{ fontSize: isCompact ? 11 : 15, color: "#ffffff" }}>⭐</span>
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
                      centerLogo: (
                        <div
                          style={{
                            width: isCompact ? 24 : 34,
                            height: isCompact ? 24 : 34,
                            borderRadius: isCompact ? 6 : 8,
                            backgroundColor: "#10b981",
                            border: `${isCompact ? 1.5 : 2.5}px solid #ffffff`,
                            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.4)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <span style={{ fontSize: isCompact ? 10 : 13 }}>🛒</span>
                        </div>
                      ),
                    };

                return (
                  <div
                    key={qr.id}
                    style={{
                      width: "100%",
                      borderRadius: isCompact ? 16 : 22,
                      background: theme.cardBg,
                      border: `1.5px solid ${theme.cardBorder}`,
                      boxShadow: isCompact
                        ? `0 6px 18px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.15), 0 0 14px ${theme.cardGlow}`
                        : `0 14px 30px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.15), 0 0 22px ${theme.cardGlow}`,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      padding: isCompact ? "7px 10px 6px" : "12px 14px 10px",
                      position: "relative",
                      backdropFilter: "blur(14px)",
                    }}
                  >
                    {/* 1. Card Header */}
                    <div
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: isCompact ? 8 : 12,
                        marginBottom: isCompact ? 5 : 10,
                      }}
                    >
                      {/* Logo Icon Badge */}
                      <div
                        style={{
                          width: isCompact ? 28 : 40,
                          height: isCompact ? 28 : 40,
                          borderRadius: isInstagram ? (isCompact ? 8 : 12) : "50%",
                          background: theme.badgeBg,
                          boxShadow: theme.badgeShadow,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {isCompact ? (
                          <div style={{ transform: "scale(0.72)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {theme.logoSvg}
                          </div>
                        ) : (
                          theme.logoSvg
                        )}
                      </div>

                      {/* Header Title & Subtext */}
                      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: isCompact ? 11 : 15,
                            fontWeight: 900,
                            color: "#ffffff",
                            letterSpacing: isCompact ? 0.4 : 0.8,
                            lineHeight: 1.15,
                            textTransform: "uppercase",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {theme.title}
                        </div>
                        <div
                          style={{
                            fontSize: isCompact ? 9 : 11,
                            color: isWhatsApp ? "#86efac" : isInstagram ? "#f9a8d4" : isYouTube ? "#fca5a5" : isPay ? "#7dd3fc" : isReview ? "#fde68a" : "#cbd5e1",
                            fontWeight: 700,
                            lineHeight: 1.2,
                            marginTop: isCompact ? 1 : 2,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {theme.subtitle}
                        </div>
                      </div>

                      {/* Top-Right Action Chip */}
                      <div
                        style={{
                          fontSize: isCompact ? 8 : 10,
                          fontWeight: 900,
                          color: "#ffffff",
                          backgroundColor: "rgba(0, 0, 0, 0.4)",
                          border: `1px solid ${theme.chipColor}`,
                          padding: isCompact ? "2px 6px" : "3px 8px",
                          borderRadius: isCompact ? 6 : 10,
                          letterSpacing: isCompact ? 0.5 : 1,
                          display: "flex",
                          alignItems: "center",
                          gap: isCompact ? 3 : 4,
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{
                            width: isCompact ? 4 : 6,
                            height: isCompact ? 4 : 6,
                            borderRadius: "50%",
                            backgroundColor: theme.chipColor,
                            display: "inline-block",
                          }}
                        />
                        {theme.chip}
                      </div>
                    </div>

                    {/* 2. QR Code Frame */}
                    <div
                      style={{
                        position: "relative",
                        width: isCompact ? 112 : 172,
                        height: isCompact ? 112 : 172,
                        padding: isCompact ? 5 : 8,
                        backgroundColor: "#ffffff",
                        borderRadius: isCompact ? 12 : 18,
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
                          top: isCompact ? -2.5 : -4,
                          left: isCompact ? -2.5 : -4,
                          width: isCompact ? 14 : 20,
                          height: isCompact ? 14 : 20,
                          borderTop: `${isCompact ? 2.5 : 3.5}px solid ${theme.cornerColor}`,
                          borderLeft: `${isCompact ? 2.5 : 3.5}px solid ${theme.cornerColor}`,
                          borderTopLeftRadius: isCompact ? 5 : 8,
                        }}
                      />
                      {/* Viewfinder Top-Right Bracket */}
                      <div
                        style={{
                          position: "absolute",
                          top: isCompact ? -2.5 : -4,
                          right: isCompact ? -2.5 : -4,
                          width: isCompact ? 14 : 20,
                          height: isCompact ? 14 : 20,
                          borderTop: `${isCompact ? 2.5 : 3.5}px solid ${theme.cornerColor}`,
                          borderRight: `${isCompact ? 2.5 : 3.5}px solid ${theme.cornerColor}`,
                          borderTopRightRadius: isCompact ? 5 : 8,
                        }}
                      />
                      {/* Viewfinder Bottom-Left Bracket */}
                      <div
                        style={{
                          position: "absolute",
                          bottom: isCompact ? -2.5 : -4,
                          left: isCompact ? -2.5 : -4,
                          width: isCompact ? 14 : 20,
                          height: isCompact ? 14 : 20,
                          borderBottom: `${isCompact ? 2.5 : 3.5}px solid ${theme.cornerColor}`,
                          borderLeft: `${isCompact ? 2.5 : 3.5}px solid ${theme.cornerColor}`,
                          borderBottomLeftRadius: isCompact ? 5 : 8,
                        }}
                      />
                      {/* Viewfinder Bottom-Right Bracket */}
                      <div
                        style={{
                          position: "absolute",
                          bottom: isCompact ? -2.5 : -4,
                          right: isCompact ? -2.5 : -4,
                          width: isCompact ? 14 : 20,
                          height: isCompact ? 14 : 20,
                          borderBottom: `${isCompact ? 2.5 : 3.5}px solid ${theme.cornerColor}`,
                          borderRight: `${isCompact ? 2.5 : 3.5}px solid ${theme.cornerColor}`,
                          borderBottomRightRadius: isCompact ? 5 : 8,
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
                            borderRadius: isCompact ? 6 : 8,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            height: "100%",
                            fontSize: isCompact ? 10 : 12,
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
                            transform: `translate(-50%, -50%) scale(${isCompact ? 0.72 : 1})`,
                            zIndex: 5,
                            pointerEvents: "none",
                          }}
                        >
                          {theme.centerLogo}
                        </div>
                      )}
                    </div>

                    {/* 3. Call-To-Action Button Pill */}
                    <div
                      style={{
                        width: "100%",
                        marginTop: isCompact ? 5 : 10,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: isCompact ? 1 : 3,
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          padding: isCompact ? "4px 8px" : "6px 12px",
                          borderRadius: isCompact ? 9 : 14,
                          background: theme.btnBg,
                          boxShadow: theme.btnShadow,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: isCompact ? 4 : 6,
                          color: "#ffffff",
                        }}
                      >
                        <span style={{ fontSize: isCompact ? 10 : 13 }}>📷</span>
                        <span
                          style={{
                            fontSize: isCompact ? 9.5 : 12,
                            fontWeight: 900,
                            letterSpacing: 0.6,
                            textTransform: "uppercase",
                          }}
                        >
                          {theme.ctaText}
                        </span>
                      </div>
                      {!isCompact && (
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
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 32 }}>
          {/* Left: Branding & Website */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexShrink: 0, whiteSpace: "nowrap" }}>
            <span style={{ fontSize: 20, color: "#86efac", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Order Online / Visit:
            </span>
            <span
              style={{
                fontSize: 48,
                fontWeight: 900,
                color: "#ffffff",
                letterSpacing: "0.02em",
                textShadow: "0 4px 12px rgba(0,0,0,0.5)",
              }}
            >
              {manifest.branding?.website_text || "www.kathuafresh.in"}
            </span>
          </div>

          {/* Right: Audio Capsule & Store Status */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
            {/* Unified Sleek Audio Capsule (No Overlap) */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                borderRadius: 28,
                backgroundColor: !isAudioMuted
                  ? "rgba(6, 78, 59, 0.75)"
                  : "rgba(239, 68, 68, 0.16)",
                border: `1.5px solid ${!isAudioMuted ? "#10b981" : "#f87171"}`,
                boxShadow: !isAudioMuted ? "0 0 16px rgba(16, 185, 129, 0.25)" : "none",
                backdropFilter: "blur(12px)",
                overflow: "hidden",
                transition: "all 0.2s ease",
              }}
            >
              {/* Audio Toggle (Mute / Unmute) */}
              <button
                onClick={() => toggleTvAudio()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 16px",
                  backgroundColor: "transparent",
                  border: "none",
                  color: !isAudioMuted ? "#34d399" : "#fca5a5",
                  fontSize: 15,
                  fontWeight: 800,
                  cursor: "pointer",
                  outline: "none",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                }}
              >
                {!isAudioMuted ? (
                  <>
                    <span style={{ fontSize: 18 }}>🔊</span>
                    <span>AUDIO ON</span>
                    <span style={{ display: "inline-flex", gap: 2.5, alignItems: "flex-end", height: 13, marginLeft: 2 }}>
                      <span style={{ width: 2.5, height: "100%", backgroundColor: "#34d399", borderRadius: 2 }} />
                      <span style={{ width: 2.5, height: "60%", backgroundColor: "#34d399", borderRadius: 2 }} />
                      <span style={{ width: 2.5, height: "85%", backgroundColor: "#34d399", borderRadius: 2 }} />
                    </span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 18 }}>🔇</span>
                    <span>AUDIO MUTED</span>
                  </>
                )}
              </button>

              {/* Sound Gap Selector (when unmuted) */}
              {!isAudioMuted && (
                <>
                  <div style={{ width: 1, height: 22, backgroundColor: "rgba(16, 185, 129, 0.35)" }} />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCustomIntervalModal(true);
                    }}
                    title="Click to set custom sound gap"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 14px",
                      backgroundColor: "rgba(0, 0, 0, 0.25)",
                      border: "none",
                      color: "#86efac",
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: "pointer",
                      outline: "none",
                      whiteSpace: "nowrap",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span>⏱️</span>
                    <span>
                      {audioIntervalSec === 0
                        ? "Continuous"
                        : audioIntervalCountdown !== null
                        ? `In ${audioIntervalCountdown}s`
                        : `Gap: ${audioIntervalSec >= 60 ? audioIntervalSec / 60 + "m" : audioIntervalSec + "s"}`}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 8,
                        backgroundColor: "rgba(34, 197, 94, 0.3)",
                        border: "1px solid rgba(34, 197, 94, 0.5)",
                        color: "#ffffff",
                        fontWeight: 800,
                        marginLeft: 2,
                      }}
                    >
                      CUSTOM ▾
                    </span>
                  </button>
                </>
              )}
            </div>

            {/* Store Status Pill */}
            <div
              style={{
                padding: "8px 18px",
                borderRadius: 28,
                backgroundColor: "rgba(34, 197, 94, 0.18)",
                border: "1px solid #22c55e",
                color: "#4ade80",
                fontSize: 15,
                fontWeight: 700,
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#4ade80", display: "inline-block", boxShadow: "0 0 8px #4ade80" }} />
              <span>STORE OPEN • FRESH STOCK ARRIVED</span>
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
              /* Custom Vertical Scrolling Slider for 3-Dot Menu */
              .tv-menu-scrollbar {
                scrollbar-width: thin;
                scrollbar-color: #22c55e rgba(15, 23, 42, 0.95);
                -webkit-overflow-scrolling: touch;
                overscroll-behavior-y: contain;
              }
              .tv-menu-scrollbar::-webkit-scrollbar {
                width: 12px;
                display: block !important;
              }
              .tv-menu-scrollbar::-webkit-scrollbar-track {
                background: rgba(15, 23, 42, 0.95);
                border-radius: 10px;
                margin: 4px 0;
                border: 1px solid rgba(34, 197, 94, 0.25);
              }
              .tv-menu-scrollbar::-webkit-scrollbar-thumb {
                background: linear-gradient(180deg, #4ade80 0%, #22c55e 50%, #16a34a 100%);
                border-radius: 10px;
                border: 2px solid rgba(10, 18, 30, 0.98);
                box-shadow: 0 0 14px rgba(34, 197, 94, 0.7);
              }
              .tv-menu-scrollbar::-webkit-scrollbar-thumb:hover,
              .tv-menu-scrollbar::-webkit-scrollbar-thumb:active {
                background: #86efac;
                box-shadow: 0 0 20px rgba(134, 239, 172, 1);
              }

              /* High-Visibility TV Remote Cursor & Focus Styling */
              .tv-focusable {
                outline: none !important;
                transition: all 0.16s cubic-bezier(0.16, 1, 0.3, 1) !important;
                position: relative !important;
              }
              .tv-focusable:focus,
              .tv-focusable:focus-visible {
                outline: none !important;
                border-color: #22c55e !important;
                background-color: rgba(34, 197, 94, 0.24) !important;
                box-shadow: 0 0 0 3px #22c55e, 0 0 28px rgba(34, 197, 94, 0.95), inset 0 0 12px rgba(34, 197, 94, 0.3) !important;
                transform: scale(1.025) !important;
                z-index: 20 !important;
              }
              .tv-cursor-badge {
                display: none;
              }
              .tv-focusable:focus .tv-cursor-badge,
              .tv-focusable:focus-visible .tv-cursor-badge {
                display: inline-flex !important;
                align-items: center;
                gap: 4px;
                font-size: 10px;
                font-weight: 900;
                letter-spacing: 0.04em;
                background: #22c55e;
                color: #022c22;
                padding: 2px 8px;
                border-radius: 9999px;
                box-shadow: 0 0 12px rgba(34, 197, 94, 0.95);
                animation: tvBadgePulse 1s infinite alternate;
              }
              #tv-three-dots-btn:focus,
              #tv-three-dots-btn:focus-visible {
                outline: none !important;
                border: 3px solid #22c55e !important;
                background-color: #15803d !important;
                color: #ffffff !important;
                box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.6), 0 0 35px #22c55e, 0 8px 30px rgba(0, 0, 0, 0.9) !important;
                transform: scale(1.2) !important;
                animation: tvPulseFocus 1.5s infinite ease-in-out;
              }
              .tv-three-dots-hint {
                display: none;
                position: absolute;
                right: 56px;
                top: 8px;
                white-space: nowrap;
                background: rgba(15, 23, 42, 0.95);
                border: 2px solid #22c55e;
                box-shadow: 0 0 20px rgba(34, 197, 94, 0.6);
                color: #86efac;
                font-size: 12px;
                font-weight: 800;
                padding: 6px 12px;
                border-radius: 8px;
                pointer-events: none;
                z-index: 10001;
              }
              #tv-three-dots-btn:focus + .tv-three-dots-hint,
              #tv-three-dots-btn:focus-visible + .tv-three-dots-hint {
                display: block;
              }
              @keyframes tvBadgePulse {
                0% { transform: scale(0.96); opacity: 0.85; }
                100% { transform: scale(1.06); opacity: 1; }
              }
              @keyframes tvPulseFocus {
                0%, 100% { box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.6), 0 0 30px #22c55e; }
                50% { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.9), 0 0 45px #4ade80; }
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
          id="tv-three-dots-btn"
          tabIndex={0}
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
        <span className="tv-three-dots-hint">Press [OK] for TV Settings</span>
      </div>

      {/* 3-Dot Menu Slider Drawer from Right */}
      {showQuickMenu && (
        <>
          {/* Darkened Backdrop for outside-click close */}
          <div
            onClick={() => setShowQuickMenu(false)}
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0, 0, 0, 0.65)",
              backdropFilter: "blur(8px)",
              zIndex: 99998,
              animation: "fadeIn 0.2s ease-out",
            }}
          />

          {/* Slide-out Drawer Panel with Scrollable List and Custom Green Slider */}
          <div
            id="tv-quick-menu-drawer"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: 440,
              maxWidth: "92vw",
              backgroundColor: "rgba(10, 18, 30, 0.98)",
              borderLeft: "2px solid rgba(34, 197, 94, 0.4)",
              boxShadow: "-25px 0 70px rgba(0, 0, 0, 0.95), 0 0 40px rgba(34, 197, 94, 0.25)",
              backdropFilter: "blur(30px)",
              display: "flex",
              flexDirection: "column",
              color: "#fff",
              fontFamily: "system-ui, -apple-system, sans-serif",
              zIndex: 99999,
              overflow: "hidden",
              animation: "slideGlideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {/* Pinned Drawer Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px 12px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
                backgroundColor: "rgba(15, 23, 42, 0.95)",
                flexShrink: 0,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 900,
                    color: "#ffffff",
                    letterSpacing: "0.03em",
                    textTransform: "uppercase",
                  }}
                >
                  Kathua Fresh TV Hub
                </div>
                <div style={{ fontSize: 11, color: "#86efac", fontWeight: 700, marginTop: 2 }}>
                  Live TV Controller & Quick Settings
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontSize: 10,
                    padding: "3px 10px",
                    borderRadius: 14,
                    backgroundColor: "rgba(34, 197, 94, 0.2)",
                    color: "#4ade80",
                    fontWeight: 800,
                    border: "1px solid rgba(34, 197, 94, 0.4)",
                  }}
                >
                  {token ? "PAIRED" : "LIVE"}
                </span>
                <button
                  id="tv-close-menu-btn"
                  tabIndex={0}
                  className="tv-focusable"
                  onClick={() => setShowQuickMenu(false)}
                  aria-label="Close TV Menu"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    color: "#fff",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* TV Remote Guidance Banner */}
            <div
              style={{
                padding: "8px 16px",
                backgroundColor: "rgba(34, 197, 94, 0.12)",
                borderBottom: "1px solid rgba(34, 197, 94, 0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 11,
                color: "#86efac",
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              <span>🎮 Remote D-Pad: ▲ ▼ move/scroll • [OK] select</span>
              <span style={{ fontSize: 10, opacity: 0.85 }}>Back/ESC: Close</span>
            </div>

            {/* Helper Scroll Up Button */}
            <div style={{ padding: "8px 16px 0 18px", flexShrink: 0 }}>
              <button
                type="button"
                tabIndex={0}
                className="tv-focusable"
                onClick={() => scrollMenu(-220)}
                style={{
                  width: "100%",
                  padding: "6px 12px",
                  borderRadius: 12,
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  color: "#86efac",
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <ChevronUp size={15} />
                <span>▲ Scroll Up</span>
                <span className="tv-cursor-badge">▶ ACTIVE</span>
              </button>
            </div>

            {/* Fully Scrollable Options Body with Custom Green Slider (Scrollbar) */}
            <div
              ref={menuScrollContainerRef}
              id="tv-menu-scrollable-body"
              className="tv-menu-scrollbar"
              style={{
                flex: 1,
                overflowY: "auto",
                overflowX: "hidden",
                padding: "12px 16px 20px 18px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                WebkitOverflowScrolling: "touch",
                overscrollBehaviorY: "contain",
              }}
            >
              {/* 1. TV Background Audio Toggle */}
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 16,
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {isAudioMuted ? (
                    <VolumeX size={18} style={{ color: "#f87171" }} />
                  ) : (
                    <Volume2 size={18} style={{ color: "#4ade80" }} />
                  )}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>
                      Store TV Audio
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255, 255, 255, 0.6)" }}>
                      {isAudioMuted ? "Background voice currently muted" : "Playing promotional audio"}
                    </div>
                  </div>
                </div>
                <button
                  tabIndex={0}
                  className="tv-focusable"
                  onClick={() => toggleTvAudio()}
                  onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest" })}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 14,
                    fontSize: 11,
                    fontWeight: 900,
                    backgroundColor: !isAudioMuted ? "#22c55e" : "rgba(239, 68, 68, 0.25)",
                    border: `1px solid ${!isAudioMuted ? "#22c55e" : "#ef4444"}`,
                    color: !isAudioMuted ? "#022c22" : "#ffffff",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span>{!isAudioMuted ? "AUDIO ON" : "MUTED"}</span>
                  <span className="tv-cursor-badge">▶ OK</span>
                </button>
              </div>

              {/* 2. Sound Gap Trigger Duration */}
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 16,
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>
                    ⏱️ Voice Trigger Gap
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#86efac" }}>
                    {audioIntervalSec === 0
                      ? "Continuous Loop"
                      : audioIntervalSec >= 60
                      ? `${audioIntervalSec / 60} min`
                      : `${audioIntervalSec} sec`}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                  {[
                    { label: "Loop (0s)", sec: 0 },
                    { label: "30s", sec: 30 },
                    { label: "1 min", sec: 60 },
                    { label: "2 min", sec: 120 },
                    { label: "3 min", sec: 180 },
                    { label: "5 min", sec: 300 },
                  ].map((item) => {
                    const isSelected = audioIntervalSec === item.sec;
                    return (
                      <button
                        key={item.sec}
                        tabIndex={0}
                        className="tv-focusable"
                        onClick={() => changeAudioInterval(item.sec)}
                        onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest" })}
                        style={{
                          padding: "6px 4px",
                          borderRadius: 10,
                          fontSize: 10,
                          fontWeight: 800,
                          backgroundColor: isSelected ? "rgba(34, 197, 94, 0.25)" : "rgba(255,255,255,0.05)",
                          border: `1px solid ${isSelected ? "#22c55e" : "rgba(255,255,255,0.1)"}`,
                          color: isSelected ? "#4ade80" : "rgba(255,255,255,0.75)",
                          cursor: "pointer",
                          textAlign: "center",
                        }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                  <button
                    tabIndex={0}
                    className="tv-focusable"
                    onClick={() => {
                      setShowQuickMenu(false);
                      setShowCustomIntervalModal(true);
                    }}
                    onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest" })}
                    style={{
                      gridColumn: "span 3",
                      padding: "7px 10px",
                      borderRadius: 10,
                      fontSize: 11,
                      fontWeight: 800,
                      backgroundColor: "rgba(34, 197, 94, 0.15)",
                      border: "1px dashed #22c55e",
                      color: "#86efac",
                      cursor: "pointer",
                      textAlign: "center",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <span>⏱️ Set Custom Seconds / Minutes...</span>
                    <span className="tv-cursor-badge">▶ OK</span>
                  </button>
                </div>
              </div>

              {/* 3. TV Layout Profile Toggle (Standard vs Immersive) */}
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 16,
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>
                    📺 TV Screen Layout
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 800, color: "#38bdf8", textTransform: "uppercase" }}>
                    {isImmersive ? "Immersive (16:9)" : "Standard Split"}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <button
                    tabIndex={0}
                    className="tv-focusable"
                    onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest" })}
                    onClick={() => {
                      const updated = {
                        ...manifest,
                        branding: {
                          ...manifest.branding,
                          layout_profile: "standard" as const,
                        },
                      };
                      setManifest(updated);
                      fetch("/api/signage/admin/branding", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ layout_profile: "standard" }),
                      }).catch(() => {});
                    }}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 800,
                      backgroundColor: !isImmersive ? "rgba(34, 197, 94, 0.25)" : "rgba(255,255,255,0.05)",
                      border: !isImmersive ? "1px solid #22c55e" : "1px solid rgba(255,255,255,0.1)",
                      color: !isImmersive ? "#86efac" : "rgba(255,255,255,0.6)",
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    Standard (Split TV)
                  </button>
                  <button
                    tabIndex={0}
                    className="tv-focusable"
                    onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest" })}
                    onClick={() => {
                      const updated = {
                        ...manifest,
                        branding: {
                          ...manifest.branding,
                          layout_profile: "immersive" as const,
                        },
                      };
                      setManifest(updated);
                      fetch("/api/signage/admin/branding", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ layout_profile: "immersive" }),
                      }).catch(() => {});
                    }}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 800,
                      backgroundColor: isImmersive ? "rgba(56, 189, 248, 0.25)" : "rgba(255,255,255,0.05)",
                      border: isImmersive ? "1px solid #38bdf8" : "1px solid rgba(255,255,255,0.1)",
                      color: isImmersive ? "#7dd3fc" : "rgba(255,255,255,0.6)",
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    Immersive (Full 16:9)
                  </button>
                </div>
              </div>

              {/* 4. Slide Transition Effect */}
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 16,
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>
                    ✨ Slide Animation
                  </span>
                  <span style={{ fontSize: 10, color: "#facc15", fontWeight: 800, textTransform: "uppercase" }}>
                    {transitionStyle === "cinematic" ? "Cinematic Fade" : "Smooth Slide"}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <button
                    tabIndex={0}
                    className="tv-focusable"
                    onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest" })}
                    onClick={() => {
                      setTransitionStyle("cinematic");
                      localStorage.setItem("tv_transition_style", "cinematic");
                    }}
                    style={{
                      padding: "7px 10px",
                      borderRadius: 10,
                      fontSize: 11,
                      fontWeight: 800,
                      backgroundColor: transitionStyle === "cinematic" ? "rgba(34, 197, 94, 0.25)" : "rgba(255,255,255,0.05)",
                      border: transitionStyle === "cinematic" ? "1px solid #22c55e" : "1px solid rgba(255,255,255,0.1)",
                      color: transitionStyle === "cinematic" ? "#86efac" : "rgba(255,255,255,0.6)",
                      cursor: "pointer",
                    }}
                  >
                    ✨ Smooth Fade
                  </button>
                  <button
                    tabIndex={0}
                    className="tv-focusable"
                    onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest" })}
                    onClick={() => {
                      setTransitionStyle("slide");
                      localStorage.setItem("tv_transition_style", "slide");
                    }}
                    style={{
                      padding: "7px 10px",
                      borderRadius: 10,
                      fontSize: 11,
                      fontWeight: 800,
                      backgroundColor: transitionStyle === "slide" ? "rgba(56, 189, 248, 0.25)" : "rgba(255,255,255,0.05)",
                      border: transitionStyle === "slide" ? "1px solid #38bdf8" : "1px solid rgba(255,255,255,0.1)",
                      color: transitionStyle === "slide" ? "#7dd3fc" : "rgba(255,255,255,0.6)",
                      cursor: "pointer",
                    }}
                  >
                    ➡️ Glide Slide
                  </button>
                </div>
              </div>

              {/* 5. Action: Open Admin Mode */}
              <button
                tabIndex={0}
                className="tv-focusable"
                onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest" })}
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
                  backgroundColor: "rgba(34, 197, 94, 0.16)",
                  border: "1px solid rgba(34, 197, 94, 0.4)",
                  color: "#86efac",
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                }}
              >
                <Smartphone size={20} style={{ flexShrink: 0, color: "#4ade80" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#ffffff" }}>
                    Open Admin Mode (Upload Offers)
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255, 255, 255, 0.65)" }}>
                    Add new products & prices on mobile/TV
                  </div>
                </div>
                <span className="tv-cursor-badge">▶ SELECT</span>
              </button>

              {/* 6. Action: Refresh & Sync */}
              <button
                tabIndex={0}
                className="tv-focusable"
                onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest" })}
                disabled={isSyncing}
                onClick={async () => {
                  setIsSyncing(true);
                  try {
                    await fetchManifest();
                    setSyncToast("TV Display Synced!");
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
                  backgroundColor: "rgba(56, 189, 248, 0.16)",
                  border: "1px solid rgba(56, 189, 248, 0.4)",
                  color: "#38bdf8",
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                }}
              >
                <RefreshCw size={20} style={{ flexShrink: 0, color: "#38bdf8" }} className={isSyncing ? "animate-spin" : ""} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#ffffff" }}>
                    {isSyncing ? "Syncing..." : "Refresh Products & Offers"}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255, 255, 255, 0.65)" }}>
                    Fetch latest products & updated prices
                  </div>
                </div>
                <span className="tv-cursor-badge">▶ SELECT</span>
              </button>

              {/* 7. Action: Toggle Fullscreen */}
              <button
                tabIndex={0}
                className="tv-focusable"
                onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest" })}
                onClick={() => {
                  toggleFullScreen();
                  setShowQuickMenu(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 16,
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  color: "#ffffff",
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                }}
              >
                <Maximize2 size={18} style={{ flexShrink: 0, color: "#facc15" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Toggle Fullscreen Mode</div>
                  <div style={{ fontSize: 10, color: "rgba(255, 255, 255, 0.55)" }}>
                    Fill entire TV or mobile display
                  </div>
                </div>
                <span className="tv-cursor-badge">▶ SELECT</span>
              </button>

              {/* 8. Action: Connect Phone */}
              <button
                tabIndex={0}
                className="tv-focusable"
                onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest" })}
                onClick={() => {
                  setShowQuickMenu(false);
                  setShowConnectModal(true);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 16,
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  color: "#ffffff",
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                }}
              >
                <Tv size={18} style={{ flexShrink: 0, color: "#a78bfa" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Connect Phone / Remote</div>
                  <div style={{ fontSize: 10, color: "rgba(255, 255, 255, 0.55)" }}>
                    Scan QR code with phone to control TV
                  </div>
                </div>
                <span className="tv-cursor-badge">▶ SELECT</span>
              </button>

              {/* 9. Action: Manage TV Devices */}
              <a
                tabIndex={0}
                className="tv-focusable"
                onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest" })}
                href="/admin/signage/more/devices"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 16,
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  color: "#ffffff",
                  textDecoration: "none",
                  cursor: "pointer",
                }}
              >
                <ShieldCheck size={18} style={{ flexShrink: 0, color: "#38bdf8" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Manage TV Devices</div>
                  <div style={{ fontSize: 10, color: "rgba(255, 255, 255, 0.55)" }}>
                    View paired screens & health status
                  </div>
                </div>
                <ExternalLink size={14} style={{ color: "rgba(255,255,255,0.4)" }} />
                <span className="tv-cursor-badge">▶ SELECT</span>
              </a>

              {/* 10. Action: Switch to 100% Live Mode (Hide Preview Banner) */}
              {isPreview && (
                <button
                  tabIndex={0}
                  className="tv-focusable"
                  onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest" })}
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
                  }}
                >
                  <Tv size={18} style={{ flexShrink: 0, color: "#f97316" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#ffffff" }}>
                      Go 100% Live (Remove Banner)
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255, 255, 255, 0.65)" }}>
                      Hide &quot;Preview Mode&quot; badge
                    </div>
                  </div>
                  <span className="tv-cursor-badge">▶ SELECT</span>
                </button>
              )}

              {/* 11. Action: Reset TV Cache */}
              <button
                tabIndex={0}
                className="tv-focusable"
                onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest" })}
                onClick={() => {
                  if (confirm("Reset TV Display cache?")) {
                    localStorage.removeItem("signage_device_token");
                    localStorage.removeItem("kathua_signage_promotions");
                    setToken(null);
                    setShowQuickMenu(false);
                    window.location.reload();
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 16,
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
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#ef4444" }}>
                    Reset Display Cache
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255, 255, 255, 0.55)" }}>
                    Clear local tokens and reload fresh
                  </div>
                </div>
                <span className="tv-cursor-badge">▶ SELECT</span>
              </button>

              {/* Helper Scroll Down Button */}
              <button
                type="button"
                tabIndex={0}
                className="tv-focusable"
                onClick={() => scrollMenu(220)}
                onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest" })}
                style={{
                  padding: "8px 12px",
                  borderRadius: 12,
                  backgroundColor: "rgba(34, 197, 94, 0.15)",
                  border: "1px solid rgba(34, 197, 94, 0.3)",
                  color: "#86efac",
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  width: "100%",
                  marginTop: 6,
                }}
              >
                <ChevronDown size={15} />
                <span>▼ Scroll Down for More Settings</span>
                <span className="tv-cursor-badge">▶ ACTIVE</span>
              </button>
            </div>

            {/* Pinned Bottom Footer with Scrolling Guidance */}
            <div
              style={{
                padding: "10px 18px",
                borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                backgroundColor: "rgba(6, 11, 20, 0.95)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 11,
                color: "rgba(255, 255, 255, 0.55)",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: "#22c55e", fontWeight: 800 }}>↕</span>
                <span>Use Remote ▲ ▼ or Scroll buttons</span>
              </div>
              <span style={{ color: "#4ade80", fontWeight: 800 }}>Kathua Fresh</span>
            </div>
          </div>
        </>
      )}

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
              tabIndex={0}
              className="tv-focusable"
              onClick={() => setShowConnectModal(false)}
              style={{
                position: "absolute",
                top: 20,
                right: 20,
                width: 40,
                height: 40,
                borderRadius: "50%",
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
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
                tabIndex={0}
                className="tv-focusable"
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
                tabIndex={0}
                className="tv-focusable"
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

      {/* ============================================================ */}
      {/* CUSTOM AUDIO INTERVAL POPUP MODAL                            */}
      {/* ============================================================ */}
      {showCustomIntervalModal && (
        <div
          onClick={() => setShowCustomIntervalModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(16px)",
            zIndex: 10006,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#06281e",
              border: "2px solid rgba(34, 197, 94, 0.4)",
              borderRadius: 30,
              padding: "32px 36px",
              width: "100%",
              maxWidth: 500,
              boxShadow: "0 25px 60px rgba(0,0,0,0.85), 0 0 40px rgba(34,197,94,0.15)",
              color: "#fff",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 28 }}>⏱️</span>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>
                    Audio Trigger Duration
                  </div>
                  <div style={{ fontSize: 13, color: "#86efac", fontWeight: 600 }}>
                    Kitni der baad background voice/music baje
                  </div>
                </div>
              </div>
              <button
                tabIndex={0}
                className="tv-focusable"
                onClick={() => setShowCustomIntervalModal(false)}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  color: "#cbd5e1",
                  cursor: "pointer",
                  borderRadius: "50%",
                  padding: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Quick Presets */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
                Quick Preset Times:
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {[
                  { label: "Continuous (Loop)", sec: 0 },
                  { label: "30 Seconds", sec: 30 },
                  { label: "1 Minute", sec: 60 },
                  { label: "2 Minutes", sec: 120 },
                  { label: "3 Minutes", sec: 180 },
                  { label: "5 Minutes", sec: 300 },
                ].map((item) => (
                  <button
                    key={item.sec}
                    tabIndex={0}
                    className="tv-focusable"
                    onClick={() => {
                      changeAudioInterval(item.sec);
                      setShowCustomIntervalModal(false);
                      setSyncToast(`Audio interval: ${item.label}!`);
                      setTimeout(() => setSyncToast(null), 2500);
                    }}
                    style={{
                      padding: "10px 8px",
                      borderRadius: 14,
                      fontSize: 12,
                      fontWeight: 800,
                      backgroundColor: audioIntervalSec === item.sec ? "rgba(34, 197, 94, 0.3)" : "rgba(255,255,255,0.05)",
                      border: `1.5px solid ${audioIntervalSec === item.sec ? "#22c55e" : "rgba(255,255,255,0.1)"}`,
                      color: audioIntervalSec === item.sec ? "#4ade80" : "#e2e8f0",
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Exact Time Form */}
            <div style={{ padding: "18px 20px", borderRadius: 20, backgroundColor: "rgba(0, 0, 0, 0.4)", border: "1.5px solid rgba(34, 197, 94, 0.3)" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#86efac", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                <span>✨</span>
                <span>Enter Any Custom Duration:</span>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const totalSec = customIntervalUnit === "min" ? customIntervalValue * 60 : customIntervalValue;
                  if (isNaN(totalSec) || totalSec < 0) return;
                  changeAudioInterval(totalSec);
                  setShowCustomIntervalModal(false);
                  setSyncToast(`Audio Interval set to ${customIntervalValue} ${customIntervalUnit === "min" ? "Minutes" : "Seconds"}!`);
                  setTimeout(() => setSyncToast(null), 2500);
                }}
                style={{ display: "flex", gap: 10, alignItems: "center" }}
              >
                <input
                  type="number"
                  min="1"
                  max="7200"
                  value={customIntervalValue || ""}
                  onChange={(e) => setCustomIntervalValue(Math.max(1, parseInt(e.target.value) || 0))}
                  placeholder="e.g. 45"
                  style={{
                    flex: 1,
                    padding: "12px 16px",
                    borderRadius: 14,
                    backgroundColor: "rgba(15, 23, 42, 0.95)",
                    border: "2px solid #22c55e",
                    color: "#fff",
                    fontSize: 16,
                    fontWeight: 800,
                    outline: "none",
                  }}
                />
                <select
                  value={customIntervalUnit}
                  onChange={(e) => setCustomIntervalUnit(e.target.value as "sec" | "min")}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 14,
                    backgroundColor: "rgba(15, 23, 42, 0.95)",
                    border: "2px solid rgba(255,255,255,0.2)",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 800,
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="sec" style={{ backgroundColor: "#0f172a" }}>Seconds</option>
                  <option value="min" style={{ backgroundColor: "#0f172a" }}>Minutes</option>
                </select>
                <button
                  type="submit"
                  tabIndex={0}
                  className="tv-focusable"
                  style={{
                    padding: "12px 22px",
                    borderRadius: 14,
                    backgroundColor: "#22c55e",
                    border: "none",
                    color: "#052e16",
                    fontSize: 15,
                    fontWeight: 900,
                    cursor: "pointer",
                    boxShadow: "0 4px 15px rgba(34, 197, 94, 0.4)",
                  }}
                >
                  Set Time
                </button>
              </form>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 10 }}>
                💡 Example: 45 seconds, 90 seconds, 10 minutes ya 15 minutes daal sakte hain.
              </div>
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

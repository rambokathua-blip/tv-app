import fs from "fs";
import path from "path";
import type {
  Promotion,
  PlaylistItem,
  SignageManifest,
  Branding,
  QrCode,
  Announcement,
  VoiceSettings,
} from "./types";

function getStoreFilePath(): string {
  // If running on Vercel, AWS Lambda, or production container, process.cwd() is strictly read-only.
  // Writing to process.cwd() throws EROFS. Always use /tmp in serverless/production.
  if (
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NODE_ENV === "production"
  ) {
    const tmpPath = path.join("/tmp", "signage-store.json");
    if (!fs.existsSync(tmpPath)) {
      try {
        const seedPath = path.join(process.cwd(), "data", "signage-store.json");
        if (fs.existsSync(seedPath)) {
          fs.copyFileSync(seedPath, tmpPath);
        }
      } catch {}
    }
    return tmpPath;
  }

  try {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    return path.join(dataDir, "signage-store.json");
  } catch {
    return path.join("/tmp", "signage-store.json");
  }
}

// In-memory persistent state backed by disk JSON for local development and dev fallback
class DevStore {
  constructor() {
    this.load();
  }

  load() {
    try {
      const filePath = getStoreFilePath();
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf-8");
        const data = JSON.parse(raw);
        if (data.promotions && Array.isArray(data.promotions)) {
          this.promotions = data.promotions.filter(
            (p: any) => p && p.id !== "demo-onion" && p.id !== "demo-apple"
          );
        }
        if (data.playlist && Array.isArray(data.playlist)) {
          this.playlist = data.playlist.filter(
            (item: any) => item && item.promotion_id !== "demo-onion" && item.promotion_id !== "demo-apple"
          );
        }
        if (data.branding) {
          this.branding = data.branding;
        }
        if (data.qrCodes && Array.isArray(data.qrCodes) && data.qrCodes.length > 0) {
          this.qrCodes = data.qrCodes;
        }
        if (data.mediaMap && typeof data.mediaMap === "object") {
          this.mediaMap = { ...this.mediaMap, ...data.mediaMap };
        }
        if (data.audioSettings) {
          this.audioSettings = data.audioSettings;
        }
        if (data.voiceSettings) {
          this.voiceSettings = data.voiceSettings;
        }
        if (data.announcements && Array.isArray(data.announcements) && data.announcements.length > 0) {
          this.announcements = data.announcements;
        }
        if (typeof data.version === "number") {
          this.version = data.version;
        }
      }
    } catch (err) {
      console.warn("DevStore load warning:", err);
    }
  }

  save() {
    const payload = {
      version: this.version,
      promotions: this.promotions,
      playlist: this.playlist,
      branding: this.branding,
      qrCodes: this.qrCodes,
      mediaMap: this.mediaMap,
      audioSettings: this.audioSettings,
      voiceSettings: this.voiceSettings,
      announcements: this.announcements,
      updated_at: new Date().toISOString(),
    };
    try {
      const filePath = getStoreFilePath();
      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf-8");
    } catch (err) {
      console.warn("DevStore save initial path failed, attempting /tmp fallback:", err);
      try {
        const tmpPath = path.join("/tmp", "signage-store.json");
        fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), "utf-8");
      } catch (tmpErr) {
        console.warn("DevStore tmp save failed:", tmpErr);
      }
    }
  }

  setMedia(id: string, url: string) {
    if (!this.mediaMap) this.mediaMap = {};
    this.mediaMap[id] = url;
    this.save();
  }
  promotions: Promotion[] = [];

  playlist: PlaylistItem[] = [];

  branding: Branding = {
    id: "branding-default",
    logo_url: "/kathua-fresh-logo.jpg",
    website_text: "www.kathuafresh.in",
    tagline: "Quality Assured | Always Fresh",
    ticker_text:
      "Welcome to Kathua Fresh • Quality Assured | Always Fresh • Farm Fresh Fruits & Vegetables Daily • 100% Quality Guaranteed • Scan WhatsApp QR for Wholesale Rates",
    ticker_enabled: true,
    layout_profile: "standard",
    updated_at: "2026-10-30T00:00:00.000Z",
  };

  qrCodes: QrCode[] = [
    {
      id: "qr-wa",
      label: "WhatsApp Channel",
      target_url: "https://whatsapp.com/channel/kathuafresh",
      caption: "Scan for daily wholesale rates & deals",
      position: 1,
      enabled: true,
      created_at: "2026-10-30T00:00:00.000Z",
    },
    {
      id: "qr-ig",
      label: "Instagram",
      target_url: "https://instagram.com/kathuafresh",
      caption: "Follow us @kathuafresh",
      position: 2,
      enabled: true,
      created_at: "2026-10-30T00:00:00.000Z",
    },
  ];

  mediaMap: Record<string, string> = {};

  audioSettings: {
    enabled: boolean;
    url: string;
    volume: number;
    loop: boolean;
    interval_sec?: number;
  } = {
    enabled: true,
    url: "/store-audio.mp3",
    volume: 80, // 0 - 100
    loop: true,
    interval_sec: 120,
  };

  voiceSettings: VoiceSettings = {
    master_enabled: true,
    volume: 85,
    quiet_hours_start: "21:00",
    quiet_hours_end: "08:00",
    default_gap_minutes: 3,
  };

  announcements: Announcement[] = [
    {
      id: "ann-1",
      title: "Store Welcome Announcement",
      kind: "welcome",
      source: "tts",
      tts_text: "कथुआ फ्रेश में आपका स्वागत है। आज की ताज़ा सब्ज़ियाँ और फल विशेष छूट पर उपलब्ध हैं।",
      tts_lang: "hi-IN",
      frequency_minutes: 3,
      enabled: true,
      created_at: "2026-10-30T00:00:00.000Z",
    },
    {
      id: "ann-2",
      title: "WhatsApp Channel Mandi Rates",
      kind: "marketing",
      source: "tts",
      tts_text: "दुकान के टीवी पर दिया गया क्यूआर कोड स्कैन करें और रोज़ाना मंडी रेट्स सीधे व्हाट्सएप पर पाएं।",
      tts_lang: "hi-IN",
      frequency_minutes: 5,
      enabled: true,
      created_at: "2026-10-30T00:00:00.000Z",
    },
    {
      id: "ann-3",
      title: "Fresh Farm Deals Alert",
      kind: "offer",
      source: "tts",
      tts_text: "Welcome to Kathua Fresh! Check out today's special farm-fresh offers on our screens.",
      tts_lang: "en-IN",
      frequency_minutes: 10,
      enabled: true,
      created_at: "2026-10-30T00:00:00.000Z",
    },
  ];

  activeAnnouncement: {
    id: string;
    text: string;
    lang: "hi-IN" | "en-IN";
    audio_url?: string | null;
    created_at: string;
    volume?: number;
  } | null = null;

  version: number = 1;

  updateAudio(settings: Partial<{ enabled: boolean; url: string; volume: number; loop: boolean; interval_sec?: number }>) {
    this.audioSettings = {
      ...this.audioSettings,
      ...settings,
    };
    this.publish();
    return this.audioSettings;
  }

  broadcastAnnouncement(text: string, lang: "hi-IN" | "en-IN" = "hi-IN") {
    const cleanLang = lang.startsWith("en") ? "en" : "hi";
    const audioUrl = `/api/signage/admin/voice/tts?text=${encodeURIComponent(text)}&lang=${cleanLang}`;
    this.activeAnnouncement = {
      id: "ann-" + Date.now(),
      text,
      lang,
      audio_url: audioUrl,
      created_at: new Date().toISOString(),
      volume: this.voiceSettings?.volume ?? 85,
    };
    this.publish();
    return this.activeAnnouncement;
  }

  updateVoiceSettings(settings: Partial<VoiceSettings>) {
    this.voiceSettings = {
      ...this.voiceSettings,
      ...settings,
    };
    this.publish();
    return this.voiceSettings;
  }

  addAnnouncement(ann: Omit<Announcement, "id" | "created_at">) {
    const newAnn: Announcement = {
      ...ann,
      id: "ann-" + Date.now(),
      created_at: new Date().toISOString(),
    };
    this.announcements.unshift(newAnn);
    this.publish();
    return newAnn;
  }

  deleteAnnouncement(id: string) {
    this.announcements = this.announcements.filter((a) => a.id !== id);
    this.publish();
    return true;
  }

  addPromotion(promo: Omit<Promotion, "id" | "created_at" | "updated_at">): Promotion {
    this.load();
    const id = "promo-" + Date.now();
    let media = promo.media;
    if (promo.media_id) {
      const resolvedPath =
        this.mediaMap[promo.media_id] ||
        (promo.media_id.startsWith("data:") || promo.media_id.startsWith("http") || promo.media_id.startsWith("/")
          ? promo.media_id
          : "/kathua-fresh-logo.jpg");

      media = {
        id: promo.media_id,
        kind: "image",
        storage_path: resolvedPath,
        mime: "image/jpeg",
        bytes: 200000,
        sha256: "dev-hash",
        created_at: new Date().toISOString(),
        thumb_path: resolvedPath,
      };
    } else if (media && (media.storage_path || media.thumb_path)) {
      promo.media_id = media.storage_path !== "demo" ? media.storage_path : media.thumb_path;
    }

    const newPromo: Promotion = {
      ...promo,
      id,
      media,
      media_id: promo.media_id || media?.storage_path || media?.thumb_path,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.promotions.unshift(newPromo);

    // Auto-add to top of playlist (position 1) so it plays immediately on the TV
    this.playlist.forEach((p) => {
      p.position += 1;
    });
    this.playlist.unshift({
      id: "pl-" + Date.now(),
      playlist_id: "default",
      promotion_id: id,
      position: 1,
      enabled: true,
      promotion: newPromo,
    });

    this.publish();
    return newPromo;
  }

  updatePromotion(id: string, updates: Partial<Promotion>): Promotion {
    this.load();
    const index = this.promotions.findIndex((p) => p.id === id);
    let resolvedMedia = updates.media || null;
    if (updates.media_id) {
      const rawId = updates.media_id;
      const resolvedPath =
        this.mediaMap[rawId] ||
        (!rawId.startsWith("blob:") &&
        (rawId.startsWith("data:") ||
          rawId.startsWith("http") ||
          rawId.startsWith("/"))
          ? rawId
          : "/kathua-fresh-logo.jpg");

      resolvedMedia = {
        id: rawId,
        kind: "image" as const,
        storage_path: resolvedPath,
        mime: "image/jpeg",
        bytes: 200000,
        sha256: "dev-hash",
        created_at: new Date().toISOString(),
        thumb_path: resolvedPath,
      };
    }

    if (index >= 0) {
      const current = this.promotions[index];
      const updatedPromo: Promotion = {
        ...current,
        ...updates,
        media_id: updates.media_id || current.media_id || resolvedMedia?.storage_path,
        media: resolvedMedia || current.media,
        updated_at: new Date().toISOString(),
      };
      this.promotions[index] = updatedPromo;

      // Update in playlist as well
      const plItem = this.playlist.find((pl) => pl.promotion_id === id);
      if (plItem) {
        plItem.promotion = updatedPromo;
      }
      this.publish();
      return updatedPromo;
    } else {
      // Upsert if not found
      const newPromo: Promotion = {
        id,
        title: updates.title || "Offer",
        price_text: updates.price_text,
        duration_sec: updates.duration_sec || 10,
        status: updates.status || "live",
        enabled: updates.enabled ?? true,
        media: resolvedMedia,
        media_id: updates.media_id || resolvedMedia?.storage_path,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.promotions.unshift(newPromo);
      this.playlist.unshift({
        id: "pl-" + Date.now(),
        playlist_id: "default",
        promotion_id: id,
        position: 1,
        enabled: true,
        promotion: newPromo,
      });
      this.publish();
      return newPromo;
    }
  }

  deletePromotion(id: string): boolean {
    this.load();
    this.promotions = this.promotions.filter((p) => p.id !== id);
    this.playlist = this.playlist.filter((p) => p.promotion_id !== id);
    this.publish();
    return true;
  }

  getManifest(): SignageManifest {
    this.load();
    const activePromos = this.playlist
      .filter((item) => item.enabled)
      .map((item) => {
        const promo =
          this.promotions.find((p) => p.id === item.promotion_id) ||
          item.promotion;
        if (!promo || !promo.enabled) return null;

        let imgUrl =
          (promo.media_id && (promo.media_id.startsWith("/") || promo.media_id.startsWith("http") || promo.media_id.startsWith("data:"))
            ? promo.media_id
            : null) ||
          (promo.media?.thumb_path && !promo.media.thumb_path.includes("photo-1610832958506-aa56368176cf")
            ? promo.media.thumb_path
            : null) ||
          (promo.media?.storage_path && promo.media.storage_path !== "demo"
            ? promo.media.storage_path
            : null) ||
          promo.media?.thumb_path ||
          promo.media_id ||
          "";

        if (imgUrl && this.mediaMap && this.mediaMap[imgUrl]) {
          imgUrl = this.mediaMap[imgUrl];
        }

        if (
          !imgUrl ||
          imgUrl.startsWith("blob:") ||
          (!imgUrl.startsWith("http") &&
            !imgUrl.startsWith("data:") &&
            !imgUrl.startsWith("/"))
        ) {
          imgUrl = "/kathua-fresh-logo.jpg";
        }

        return {
          id: promo.id,
          promotion_id: promo.id,
          title: promo.title,
          price_text: promo.price_text,
          duration_sec:
            item.duration_override_sec || promo.duration_sec || 10,
          image_url: imgUrl,
        };
      })
      .filter((s): s is NonNullable<typeof s> => Boolean(s));

    // Also include any active live promotions that aren't yet in playlist
    const playlistPromoIds = new Set(activePromos.map((p) => p.id));
    const livePromosNotInPlaylist = this.promotions
      .filter((p) => p.enabled !== false && p.status === "live" && !playlistPromoIds.has(p.id))
      .map((promo) => {
        let imgUrl =
          (promo.media_id && (promo.media_id.startsWith("/") || promo.media_id.startsWith("http") || promo.media_id.startsWith("data:"))
            ? promo.media_id
            : null) ||
          (promo.media?.thumb_path && !promo.media.thumb_path.includes("photo-1610832958506-aa56368176cf")
            ? promo.media.thumb_path
            : null) ||
          (promo.media?.storage_path && promo.media.storage_path !== "demo"
            ? promo.media.storage_path
            : null) ||
          promo.media?.thumb_path ||
          promo.media_id ||
          "/kathua-fresh-logo.jpg";

        if (imgUrl && this.mediaMap && this.mediaMap[imgUrl]) {
          imgUrl = this.mediaMap[imgUrl];
        }

        return {
          id: promo.id,
          promotion_id: promo.id,
          title: promo.title,
          price_text: promo.price_text,
          duration_sec: promo.duration_sec || 10,
          image_url: imgUrl,
        };
      });

    const allSlides = [...activePromos, ...livePromosNotInPlaylist];

    return {
      version: this.version,
      generated_at: new Date().toISOString(),
      branding: {
        logo_url: this.branding.logo_url,
        website_text: this.branding.website_text,
        tagline: this.branding.tagline,
        ticker_text: this.branding.ticker_text,
        ticker_enabled: this.branding.ticker_enabled,
        layout_profile: this.branding.layout_profile,
      },
      qr_codes: this.qrCodes.filter((q) => q.enabled),
      slides: allSlides as any,
      voice: {
        settings: this.voiceSettings || {
          master_enabled: true,
          volume: 85,
          quiet_hours_start: "21:00",
          quiet_hours_end: "08:00",
          default_gap_minutes: 3,
        },
        announcements: (this.announcements || []).filter((a) => a.enabled),
      },
      audio: {
        enabled: this.audioSettings?.enabled ?? true,
        url: this.audioSettings?.url ?? "/store-audio.mp3",
        volume: (this.audioSettings?.volume ?? 80) / 100,
        loop: this.audioSettings?.loop ?? true,
        interval_sec: this.audioSettings?.interval_sec ?? 120,
      },
      active_announcement: this.activeAnnouncement,
    };
  }

  publish(): number {
    this.version += 1;
    this.save();
    return this.version;
  }
}

// Global singleton across hot reloads in dev mode
const globalForDev = globalThis as unknown as { devStore?: DevStore };
let instance: DevStore;
if (globalForDev.devStore) {
  // Always update prototype so modified methods run immediately without server restart
  Object.setPrototypeOf(globalForDev.devStore, DevStore.prototype);
  instance = globalForDev.devStore;

  // Defensive migration of fields on old in-memory instances
  if (!instance.voiceSettings) {
    instance.voiceSettings = {
      master_enabled: true,
      volume: 85,
      quiet_hours_start: "21:00",
      quiet_hours_end: "08:00",
      default_gap_minutes: 3,
    };
  }
  if (!instance.announcements || instance.announcements.length === 0) {
    instance.announcements = [
      {
        id: "ann-1",
        title: "Store Welcome Announcement",
        kind: "welcome",
        source: "tts",
        tts_text: "कथुआ फ्रेश में आपका स्वागत है। आज की ताज़ा सब्ज़ियाँ और फल विशेष छूट पर उपलब्ध हैं।",
        tts_lang: "hi-IN",
        frequency_minutes: 3,
        enabled: true,
        created_at: "2026-10-30T00:00:00.000Z",
      },
      {
        id: "ann-2",
        title: "WhatsApp Channel Mandi Rates",
        kind: "marketing",
        source: "tts",
        tts_text: "दुकान के टीवी पर दिया गया क्यूआर कोड स्कैन करें और रोज़ाना मंडी रेट्स सीधे व्हाट्सएप पर पाएं।",
        tts_lang: "hi-IN",
        frequency_minutes: 5,
        enabled: true,
        created_at: "2026-10-30T00:00:00.000Z",
      },
      {
        id: "ann-3",
        title: "Fresh Farm Deals Alert",
        kind: "offer",
        source: "tts",
        tts_text: "Welcome to Kathua Fresh! Check out today's special farm-fresh offers on our screens.",
        tts_lang: "en-IN",
        frequency_minutes: 10,
        enabled: true,
        created_at: "2026-10-30T00:00:00.000Z",
      },
    ];
  }
  if (!instance.audioSettings) {
    instance.audioSettings = {
      enabled: true,
      url: "/store-audio.mp3",
      volume: 80,
      loop: true,
    };
  }
  if (!instance.mediaMap) instance.mediaMap = {};
  if (!instance.promotions) instance.promotions = [];
  if (!instance.playlist) instance.playlist = [];
  if (!instance.branding) {
    instance.branding = {
      id: "branding-default",
      logo_url: "/kathua-fresh-logo.jpg",
      website_text: "www.kathuafresh.in",
      tagline: "Quality Assured | Always Fresh",
      ticker_text:
        "Welcome to Kathua Fresh • Quality Assured | Always Fresh • Farm Fresh Fruits & Vegetables Daily • 100% Quality Guaranteed • Scan WhatsApp QR for Wholesale Rates",
      ticker_enabled: true,
      layout_profile: "standard",
      updated_at: "2026-10-30T00:00:00.000Z",
    };
  }
  if (!instance.qrCodes || instance.qrCodes.length === 0) {
    instance.qrCodes = [
      {
        id: "qr-wa",
        label: "WhatsApp Channel",
        target_url: "https://whatsapp.com/channel/kathuafresh",
        caption: "Scan for daily wholesale rates & deals",
        position: 1,
        enabled: true,
        created_at: "2026-10-30T00:00:00.000Z",
      },
      {
        id: "qr-ig",
        label: "Instagram",
        target_url: "https://instagram.com/kathuafresh",
        caption: "Follow us @kathuafresh",
        position: 2,
        enabled: true,
        created_at: "2026-10-30T00:00:00.000Z",
      },
    ];
  }
} else {
  instance = new DevStore();
  globalForDev.devStore = instance;
}

// Clean up lingering test demo item promo-1793332970189 ("Test Offer ₹50/kg") that used the fruit basket
instance.promotions = instance.promotions.filter(
  (p) => p.id !== "promo-1793332970189"
);
instance.playlist = instance.playlist.filter(
  (p) => p.promotion_id !== "promo-1793332970189"
);

// Synchronize all playlist item promotions with latest promotions data
instance.promotions.forEach((promo) => {
  // If promo has an uploaded media_id (like /uploads/xxx), ensure media reflects it
  if (promo.media_id && (promo.media_id.startsWith("/") || promo.media_id.startsWith("http") || promo.media_id.startsWith("data:"))) {
    // Always keep media object in sync with media_id — even if media already exists
    // This ensures uploaded images persist correctly after server restarts
    const currentThumb = promo.media?.thumb_path || "";
    const needsSync =
      !promo.media ||
      promo.media.storage_path === "demo" ||
      (promo.media.storage_path && promo.media.storage_path.includes("photo-1610832958506-aa56368176cf")) ||
      (currentThumb !== promo.media_id && !currentThumb.startsWith("/uploads/") && !currentThumb.startsWith("http") && !currentThumb.startsWith("data:"));

    if (needsSync) {
      promo.media = {
        id: promo.media_id,
        kind: "image",
        storage_path: promo.media_id,
        mime: "image/jpeg",
        bytes: 200000,
        sha256: "dev-hash",
        created_at: new Date().toISOString(),
        thumb_path: promo.media_id,
      };
    }
  }

  // Update in playlist
  const plItem = instance.playlist.find((pl) => pl.promotion_id === promo.id);
  if (plItem) {
    plItem.promotion = promo;
  }
});

instance.save();

export const devStore = instance;

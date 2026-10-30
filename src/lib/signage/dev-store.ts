import type {
  Promotion,
  PlaylistItem,
  SignageManifest,
  Branding,
  QrCode,
  Announcement,
  VoiceSettings,
} from "./types";

// In-memory persistent state for local development when Supabase DB is unconfigured or in dev mode
class DevStore {
  promotions: Promotion[] = [
    {
      id: "demo-onion",
      title: "Fresh Nashik Onion",
      price_text: "₹38 / kg",
      duration_sec: 10,
      status: "live",
      enabled: true,
      created_at: "2026-10-30T00:00:00.000Z",
      updated_at: "2026-10-30T00:00:00.000Z",
      media: {
        id: "m-1",
        kind: "image",
        storage_path: "demo",
        mime: "image/jpeg",
        bytes: 400000,
        sha256: "abc",
        created_at: "2026-10-30T00:00:00.000Z",
        thumb_path:
          "https://images.unsplash.com/photo-1508747703725-719777637510?q=80&w=1920&auto=format&fit=crop",
      },
    },
    {
      id: "demo-apple",
      title: "Kashmiri Royal Apples",
      price_text: "₹120 / kg",
      duration_sec: 12,
      status: "live",
      enabled: true,
      created_at: "2026-10-30T00:00:00.000Z",
      updated_at: "2026-10-30T00:00:00.000Z",
      media: {
        id: "m-2",
        kind: "image",
        storage_path: "demo",
        mime: "image/jpeg",
        bytes: 500000,
        sha256: "def",
        created_at: "2026-10-30T00:00:00.000Z",
        thumb_path:
          "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?q=80&w=1920&auto=format&fit=crop",
      },
    },
  ];

  playlist: PlaylistItem[] = [
    {
      id: "pl-1",
      playlist_id: "default",
      promotion_id: "demo-onion",
      position: 1,
      enabled: true,
    },
    {
      id: "pl-2",
      playlist_id: "default",
      promotion_id: "demo-apple",
      position: 2,
      enabled: true,
    },
  ];

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

  audioSettings = {
    enabled: true,
    url: "/store-audio.mp3",
    volume: 80, // 0 - 100
    loop: true,
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

  updateAudio(settings: Partial<{ enabled: boolean; url: string; volume: number; loop: boolean }>) {
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
    }

    const newPromo: Promotion = {
      ...promo,
      id,
      media,
      media_id: promo.media_id || media?.storage_path,
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

  getManifest(): SignageManifest {
    const activePromos = this.playlist
      .filter((item) => item.enabled)
      .map((item) => {
        const promo =
          this.promotions.find((p) => p.id === item.promotion_id) ||
          item.promotion;
        if (!promo || !promo.enabled) return null;

        let imgUrl =
          promo.media_id ||
          (promo.media?.storage_path && promo.media.storage_path !== "demo"
            ? promo.media.storage_path
            : promo.media?.thumb_path || "");

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
      .filter(Boolean);

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
      slides: activePromos as any,
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
      },
      active_announcement: this.activeAnnouncement,
    };
  }

  publish(): number {
    this.version += 1;
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
    if (!promo.media || (promo.media.storage_path && promo.media.storage_path.includes("photo-1610832958506-aa56368176cf"))) {
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

instance.publish();

export const devStore = instance;

import type {
  Promotion,
  PlaylistItem,
  SignageManifest,
  Branding,
  QrCode,
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
      target_url: "https://whatsapp.com/channel/0029Vb6WRPz2UPBI3hSeQE1B",
      caption: "Join for daily wholesale rates & deals",
      position: 1,
      enabled: true,
      created_at: "2026-10-30T00:00:00.000Z",
    },
    {
      id: "qr-ig",
      label: "Instagram",
      target_url: "https://www.instagram.com/kathua_fresh/",
      caption: "Follow @kathua_fresh for daily offers",
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

  version: number = 1;

  updateAudio(settings: Partial<{ enabled: boolean; url: string; volume: number; loop: boolean }>) {
    this.audioSettings = {
      ...this.audioSettings,
      ...settings,
    };
    this.publish();
    return this.audioSettings;
  }

  addPromotion(promo: Omit<Promotion, "id" | "created_at" | "updated_at">): Promotion {
    const id = "promo-" + Date.now();
    let media = promo.media;
    if (promo.media_id) {
      const resolvedPath =
        this.mediaMap[promo.media_id] ||
        (promo.media_id.startsWith("data:") || promo.media_id.startsWith("http") || promo.media_id.startsWith("/")
          ? promo.media_id
          : "https://images.unsplash.com/photo-1610832958506-aa56368176cf?q=80&w=1920&auto=format&fit=crop");

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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.promotions.unshift(newPromo);

    // Auto-add to playlist
    this.playlist.push({
      id: "pl-" + Date.now(),
      playlist_id: "default",
      promotion_id: id,
      position: this.playlist.length + 1,
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
          promo.media?.storage_path && promo.media.storage_path !== "demo"
            ? promo.media.storage_path
            : promo.media?.thumb_path || "";

        if (imgUrl && this.mediaMap[imgUrl]) {
          imgUrl = this.mediaMap[imgUrl];
        }

        if (
          !imgUrl ||
          (!imgUrl.startsWith("http") &&
            !imgUrl.startsWith("data:") &&
            !imgUrl.startsWith("/"))
        ) {
          imgUrl =
            this.mediaMap[imgUrl] ||
            "https://images.unsplash.com/photo-1610832958506-aa56368176cf?q=80&w=1920&auto=format&fit=crop";
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
      audio: {
        enabled: this.audioSettings.enabled,
        url: this.audioSettings.url,
        volume: this.audioSettings.volume / 100,
        loop: this.audioSettings.loop,
      },
    };
  }

  publish(): number {
    this.version += 1;
    return this.version;
  }
}

// Global singleton across hot reloads in dev mode
const globalForDev = globalThis as unknown as { devStore?: DevStore };
export const devStore = globalForDev.devStore || new DevStore();
if (process.env.NODE_ENV !== "production") globalForDev.devStore = devStore;

export type PromotionStatus =
  | "draft"
  | "scheduled"
  | "live"
  | "paused"
  | "expired"
  | "archived";

export interface MediaItem {
  id: string;
  kind: "image" | "audio" | "video";
  storage_path: string;
  mime: string;
  bytes: number;
  width?: number | null;
  height?: number | null;
  sha256: string;
  thumb_path?: string | null;
  created_at: string;
}

export interface Promotion {
  id: string;
  title: string;
  price_text?: string | null;
  media_id?: string | null;
  media?: MediaItem | null;
  duration_sec: number;
  starts_at?: string | null;
  ends_at?: string | null;
  status: PromotionStatus;
  enabled: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlaylistItem {
  id: string;
  playlist_id: string;
  promotion_id: string;
  position: number;
  duration_override_sec?: number | null;
  enabled: boolean;
  promotion?: Promotion;
}

export interface Playlist {
  id: string;
  name: string;
  is_default: boolean;
  items?: PlaylistItem[];
  created_at: string;
  updated_at: string;
}

export interface Branding {
  id: string;
  logo_media_id?: string | null;
  logo_url?: string | null;
  website_text: string;
  tagline?: string | null;
  ticker_text?: string | null;
  ticker_enabled: boolean;
  theme?: Record<string, unknown>;
  layout_profile: "standard" | "immersive";
  updated_at: string;
}

export interface QrCode {
  id: string;
  label: string;
  target_url: string;
  caption?: string | null;
  position: number;
  enabled: boolean;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  kind: "welcome" | "offer" | "marketing";
  source: "tts" | "mp3";
  tts_text?: string | null;
  tts_lang: "hi-IN" | "en-IN";
  audio_media_id?: string | null;
  audio_url?: string | null;
  linked_promotion_id?: string | null;
  frequency_minutes: number;
  enabled: boolean;
  created_at: string;
}

export interface VoiceSettings {
  master_enabled: boolean;
  volume: number; // 0-100
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  default_gap_minutes: number;
}

export interface SignageDevice {
  id: string;
  name: string;
  status: "pending" | "active" | "disconnected" | "removed";
  channel_key?: string;
  paired_at?: string | null;
  last_seen_at?: string | null;
  last_sync_at?: string | null;
  current_version?: number | null;
  app_version?: string | null;
  android_sdk?: number | null;
  webview_version?: string | null;
  mem_class?: number | null;
  free_storage_mb?: number | null;
  cache_mb?: number | null;
  current_slide_id?: string | null;
  last_error?: string | null;
  created_at: string;
}

export interface ManifestSlide {
  id: string;
  promotion_id: string;
  title: string;
  price_text?: string | null;
  duration_sec: number;
  image_url: string;
  image_sha256?: string;
  starts_at?: string | null;
  ends_at?: string | null;
}

export interface SignageManifest {
  version: number;
  generated_at: string;
  branding: {
    logo_url?: string | null;
    website_text: string;
    tagline?: string | null;
    ticker_text?: string | null;
    ticker_enabled: boolean;
    layout_profile: "standard" | "immersive";
  };
  qr_codes: Array<{
    id: string;
    label: string;
    target_url: string;
    caption?: string | null;
  }>;
  slides: ManifestSlide[];
  voice?: {
    settings: VoiceSettings;
    announcements: Announcement[];
  };
}

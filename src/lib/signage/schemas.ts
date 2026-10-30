import { z } from "zod";

// ============================================================
// Promotion schemas
// ============================================================

export const promotionStatusEnum = z.enum([
  "draft",
  "scheduled",
  "live",
  "paused",
  "expired",
  "archived",
]);

export const createPromotionSchema = z.object({
  title: z.string().min(1).max(200),
  price_text: z.string().max(100).optional().nullable(),
  media_id: z.string().uuid().optional().nullable(),
  duration_sec: z.number().int().min(3).max(60).default(10),
  starts_at: z.string().datetime().optional().nullable(),
  ends_at: z.string().datetime().optional().nullable(),
  status: promotionStatusEnum.default("draft"),
  enabled: z.boolean().default(true),
  notes: z.string().max(500).optional().nullable(),
});

export const updatePromotionSchema = createPromotionSchema.partial();

// ============================================================
// Playlist schemas
// ============================================================

export const reorderPlaylistSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid(),
      position: z.number().int().min(0),
    })
  ),
});

export const updatePlaylistItemSchema = z.object({
  duration_override_sec: z.number().int().min(3).max(60).optional().nullable(),
  enabled: z.boolean().optional(),
});

// ============================================================
// Branding schemas
// ============================================================

export const updateBrandingSchema = z.object({
  logo_media_id: z.string().uuid().optional().nullable(),
  website_text: z.string().max(200).optional(),
  tagline: z.string().max(300).optional().nullable(),
  ticker_text: z.string().max(500).optional().nullable(),
  ticker_enabled: z.boolean().optional(),
  theme: z.record(z.string(), z.unknown()).optional(),
  layout_profile: z.enum(["standard", "immersive"]).optional(),
});

// ============================================================
// QR Code schemas
// ============================================================

export const createQrSchema = z.object({
  label: z.string().min(1).max(50),
  target_url: z.string().url().max(500),
  caption: z.string().max(200).optional().nullable(),
  position: z.number().int().min(0).default(0),
  enabled: z.boolean().default(true),
});

export const updateQrSchema = createQrSchema.partial();

// ============================================================
// Announcement schemas
// ============================================================

export const announcementTypeEnum = z.enum(["welcome", "offer", "marketing"]);
export const langEnum = z.enum(["hi-IN", "en-IN"]);

export const createAnnouncementSchema = z.object({
  type: announcementTypeEnum,
  title: z.string().min(1).max(200),
  text: z.string().max(1000).optional().nullable(),
  lang: langEnum.default("hi-IN"),
  audio_media_id: z.string().uuid().optional().nullable(),
  promotion_id: z.string().uuid().optional().nullable(),
  enabled: z.boolean().default(true),
  repeat_every_sec: z.number().int().min(60).max(3600).default(300),
});

export const updateAnnouncementSchema = createAnnouncementSchema.partial();

// ============================================================
// Voice settings schema
// ============================================================

export const updateVoiceSettingsSchema = z.object({
  master_enabled: z.boolean().optional(),
  volume: z.number().min(0).max(1).optional(),
  min_gap_sec: z.number().int().min(30).max(3600).optional(),
  quiet_start: z.string().optional().nullable(),
  quiet_end: z.string().optional().nullable(),
  welcome_on_start: z.boolean().optional(),
});

// ============================================================
// Device schemas
// ============================================================

export const deviceStatusEnum = z.enum([
  "pending",
  "active",
  "disconnected",
  "removed",
]);

export const updateDeviceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

export const claimPairingSchema = z.object({
  code: z
    .string()
    .length(6)
    .regex(/^[A-Z2-9]{6}$/),
});

export const deviceCommandEnum = z.enum([
  "pause",
  "resume",
  "next",
  "prev",
  "reload",
  "clear_cache",
  "speak_test",
]);

export const sendCommandSchema = z.object({
  command: deviceCommandEnum,
  payload: z.record(z.string(), z.unknown()).optional(),
});

// ============================================================
// Publish schemas
// ============================================================

export const publishSchema = z.object({
  note: z.string().max(500).optional(),
});

export const rollbackSchema = z.object({
  version_no: z.number().int().min(1),
});

// ============================================================
// Heartbeat schema (from device)
// ============================================================

export const heartbeatSchema = z.object({
  app_version: z.string().optional(),
  android_sdk: z.number().int().optional(),
  webview_version: z.string().optional(),
  mem_class: z.number().int().optional(),
  free_storage_mb: z.number().int().optional(),
  cache_mb: z.number().int().optional(),
  current_slide_id: z.string().uuid().optional().nullable(),
  last_error: z.string().max(1000).optional().nullable(),
  current_version: z.number().int().optional(),
});

// ============================================================
// Device event schema
// ============================================================

export const deviceEventSchema = z.object({
  events: z.array(
    z.object({
      level: z.enum(["info", "warn", "error"]).default("info"),
      type: z.string().min(1).max(100),
      message: z.string().max(1000).optional(),
      at: z.string().datetime().optional(),
    })
  ),
});

// ============================================================
// Type exports
// ============================================================

export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;
export type UpdatePromotionInput = z.infer<typeof updatePromotionSchema>;
export type CreateQrInput = z.infer<typeof createQrSchema>;
export type UpdateQrInput = z.infer<typeof updateQrSchema>;
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;
export type UpdateBrandingInput = z.infer<typeof updateBrandingSchema>;
export type UpdateVoiceSettingsInput = z.infer<typeof updateVoiceSettingsSchema>;
export type HeartbeatInput = z.infer<typeof heartbeatSchema>;
export type DeviceEventInput = z.infer<typeof deviceEventSchema>;
export type SendCommandInput = z.infer<typeof sendCommandSchema>;
export type ClaimPairingInput = z.infer<typeof claimPairingSchema>;
export type PublishInput = z.infer<typeof publishSchema>;
export type RollbackInput = z.infer<typeof rollbackSchema>;

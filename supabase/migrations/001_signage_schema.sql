-- Migration: 001_signage_schema.sql
-- Description: Create all signage system tables for Kathua Fresh Digital Signage
-- Date: 2026-10-30
-- Status: APPROVED

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE signage_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Unnamed TV',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'disconnected', 'removed')),
  token_hash TEXT UNIQUE,
  channel_key TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  paired_at TIMESTAMPTZ,
  paired_by UUID,
  last_seen_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  current_version INTEGER,
  app_version TEXT,
  android_sdk INTEGER,
  webview_version TEXT,
  mem_class INTEGER,
  free_storage_mb INTEGER,
  cache_mb INTEGER,
  current_slide_id UUID,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE signage_pairing_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  device_id UUID REFERENCES signage_devices(id) ON DELETE CASCADE,
  poll_secret_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  claimed_by UUID,
  claimed_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE signage_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('image', 'audio', 'video')),
  storage_path TEXT NOT NULL,
  mime TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  sha256 TEXT NOT NULL,
  thumb_path TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE signage_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  price_text TEXT,
  media_id UUID REFERENCES signage_media(id),
  duration_sec INTEGER NOT NULL DEFAULT 10
    CHECK (duration_sec >= 3 AND duration_sec <= 60),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'live', 'paused', 'expired', 'archived')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE signage_playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Default',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE signage_playlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES signage_playlists(id) ON DELETE CASCADE,
  promotion_id UUID NOT NULL REFERENCES signage_promotions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  duration_override_sec INTEGER,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE signage_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  logo_media_id UUID REFERENCES signage_media(id),
  website_text TEXT NOT NULL DEFAULT 'www.kathuafresh.in',
  tagline TEXT,
  ticker_text TEXT,
  ticker_enabled BOOLEAN NOT NULL DEFAULT true,
  theme JSONB NOT NULL DEFAULT '{}',
  layout_profile TEXT NOT NULL DEFAULT 'standard'
    CHECK (layout_profile IN ('standard', 'immersive')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE signage_qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  target_url TEXT NOT NULL,
  caption TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE signage_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('welcome', 'offer', 'marketing')),
  title TEXT NOT NULL,
  text TEXT,
  lang TEXT NOT NULL DEFAULT 'hi-IN' CHECK (lang IN ('hi-IN', 'en-IN')),
  audio_media_id UUID REFERENCES signage_media(id),
  promotion_id UUID REFERENCES signage_promotions(id),
  enabled BOOLEAN NOT NULL DEFAULT true,
  repeat_every_sec INTEGER DEFAULT 300,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE signage_voice_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_enabled BOOLEAN NOT NULL DEFAULT false,
  volume REAL NOT NULL DEFAULT 0.7 CHECK (volume >= 0 AND volume <= 1),
  min_gap_sec INTEGER NOT NULL DEFAULT 180,
  quiet_start TIME,
  quiet_end TIME,
  welcome_on_start BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE signage_publish_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_no INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  note TEXT,
  published_by UUID,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE signage_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES signage_devices(id) ON DELETE CASCADE,
  command TEXT NOT NULL
    CHECK (command IN ('pause', 'resume', 'next', 'prev', 'reload', 'clear_cache', 'speak_test')),
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ
);

CREATE TABLE signage_device_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES signage_devices(id) ON DELETE CASCADE,
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warn', 'error')),
  type TEXT NOT NULL,
  message TEXT,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE signage_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id UUID,
  meta JSONB,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_signage_promotions_status_dates
  ON signage_promotions (status, starts_at, ends_at);

CREATE INDEX idx_signage_playlist_items_playlist_position
  ON signage_playlist_items (playlist_id, position);

CREATE UNIQUE INDEX idx_signage_devices_token_hash
  ON signage_devices (token_hash) WHERE token_hash IS NOT NULL;

CREATE UNIQUE INDEX idx_signage_pairing_codes_active
  ON signage_pairing_codes (code)
  WHERE claimed_at IS NULL AND expires_at > now();

CREATE INDEX idx_signage_commands_device_pending
  ON signage_commands (device_id, created_at)
  WHERE delivered_at IS NULL;

CREATE INDEX idx_signage_device_events_device_at
  ON signage_device_events (device_id, at);

CREATE INDEX idx_signage_publish_versions_version
  ON signage_publish_versions (version_no DESC);

CREATE INDEX idx_signage_audit_log_at
  ON signage_audit_log (at DESC);

-- ============================================================
-- ROW LEVEL SECURITY — enabled, no client policies
-- ============================================================

ALTER TABLE signage_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE signage_pairing_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE signage_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE signage_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE signage_playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE signage_playlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE signage_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE signage_qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE signage_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE signage_voice_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE signage_publish_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE signage_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE signage_device_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE signage_audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SEED DATA
-- ============================================================

-- Default playlist
INSERT INTO signage_playlists (name, is_default) VALUES ('Default', true);

-- Default branding
INSERT INTO signage_branding (website_text, tagline, ticker_text, ticker_enabled, layout_profile)
VALUES (
  'www.kathuafresh.in',
  'Fresh vegetables daily!',
  'Visit www.kathuafresh.in for home delivery | Fresh vegetables at your doorstep',
  true,
  'standard'
);

-- Default QR codes
INSERT INTO signage_qr_codes (label, target_url, caption, position, enabled) VALUES
  ('WhatsApp Channel', 'https://whatsapp.com/channel/0029Vb6WRPz2UPBI3hSeQE1B', 'Join for daily wholesale rates & deals', 0, true),
  ('Instagram', 'https://www.instagram.com/kathua_fresh/', 'Follow @kathua_fresh for daily offers', 1, true);

-- Default voice settings
INSERT INTO signage_voice_settings (master_enabled, volume, min_gap_sec, welcome_on_start)
VALUES (false, 0.7, 180, true);

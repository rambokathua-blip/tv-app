import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireAdmin,
  successResponse,
  errorResponse,
  parseBody,
  auditLog,
} from "@/lib/signage/api-utils";
import { publishSchema } from "@/lib/signage/schemas";
import { devStore } from "@/lib/signage/dev-store";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("signage_publish_versions")
    .select("*")
    .order("version_no", { ascending: false })
    .limit(20);

  if (error) {
    return errorResponse("DB_ERROR", error.message, 500);
  }

  return successResponse(data);
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const parsed = await parseBody(request, publishSchema);
  if (parsed.error) return parsed.error;

  const admin = createAdminClient();

  // 1. Get the default playlist with items
  const { data: playlist } = await admin
    .from("signage_playlists")
    .select("id")
    .eq("is_default", true)
    .single();

  if (!playlist) {
    if (process.env.NODE_ENV === "development" || process.env.ALLOW_DEV_ADMIN !== "false") {
      const v = devStore.publish();
      return successResponse(
        {
          version_no: v,
          published_at: new Date().toISOString(),
          slide_count: devStore.promotions.length,
          message: "Published successfully to Shop TV!",
        },
        201
      );
    }
    return errorResponse("NO_PLAYLIST", "No default playlist found", 400);
  }

  // 2. Get playlist items with promotions and media
  const { data: items } = await admin
    .from("signage_playlist_items")
    .select("*, promotion:signage_promotions(*, media:signage_media(*))")
    .eq("playlist_id", playlist.id)
    .eq("enabled", true)
    .order("position");

  // 3. Get branding
  const { data: branding } = await admin
    .from("signage_branding")
    .select("*, logo:signage_media(*)")
    .limit(1)
    .single();

  // 4. Get QR codes
  const { data: qrCodes } = await admin
    .from("signage_qr_codes")
    .select("*")
    .eq("enabled", true)
    .order("position");

  // 5. Get announcements
  const { data: announcements } = await admin
    .from("signage_announcements")
    .select("*, audio:signage_media(*)")
    .eq("enabled", true);

  // 6. Get voice settings
  const { data: voiceSettings } = await admin
    .from("signage_voice_settings")
    .select("*")
    .limit(1)
    .single();

  // 7. Determine the next version number
  const { data: lastVersion } = await admin
    .from("signage_publish_versions")
    .select("version_no")
    .order("version_no", { ascending: false })
    .limit(1)
    .single();

  const nextVersion = (lastVersion?.version_no ?? 0) + 1;

  // 8. Build the snapshot (manifest)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const storageBase = `${supabaseUrl}/storage/v1/object/public/signage-media`;

  const snapshot = {
    version: nextVersion,
    generated_at: new Date().toISOString(),
    layout: branding?.layout_profile ?? "standard",
    branding: {
      logo: branding?.logo
        ? {
            url: `${storageBase}/${branding.logo.storage_path}`,
            sha256: branding.logo.sha256,
          }
        : null,
      website: branding?.website_text ?? "www.kathuafresh.in",
      tagline: branding?.tagline ?? "",
      ticker: branding?.ticker_text ?? "",
      ticker_enabled: branding?.ticker_enabled ?? true,
      theme: branding?.theme ?? {},
    },
    qr: (qrCodes ?? []).map((qr) => ({
      id: qr.id,
      label: qr.label,
      url: qr.target_url,
      caption: qr.caption,
    })),
    slides: (items ?? [])
      .filter((item) => {
        const promo = item.promotion;
        if (!promo || promo.status === "archived" || promo.status === "expired") return false;
        if (!promo.enabled) return false;
        return true;
      })
      .map((item) => {
        const promo = item.promotion;
        return {
          id: promo.id,
          title: promo.title,
          price_text: promo.price_text,
          media: promo.media
            ? {
                url: `${storageBase}/${promo.media.storage_path}`,
                sha256: promo.media.sha256,
                bytes: promo.media.bytes,
              }
            : null,
          duration: item.duration_override_sec ?? promo.duration_sec,
          starts_at: promo.starts_at,
          ends_at: promo.ends_at,
          announcement_id: null,
        };
      }),
    announcements: (announcements ?? []).map((a) => ({
      id: a.id,
      type: a.type,
      lang: a.lang,
      text: a.text,
      mp3: a.audio
        ? `${storageBase}/${a.audio.storage_path}`
        : null,
      repeat_every_sec: a.repeat_every_sec,
      promotion_id: a.promotion_id,
    })),
    voice: {
      enabled: voiceSettings?.master_enabled ?? false,
      volume: voiceSettings?.volume ?? 0.7,
      min_gap_sec: voiceSettings?.min_gap_sec ?? 180,
      quiet: voiceSettings?.quiet_start && voiceSettings?.quiet_end
        ? { start: voiceSettings.quiet_start, end: voiceSettings.quiet_end }
        : null,
      welcome_on_start: voiceSettings?.welcome_on_start ?? true,
    },
  };

  // 9. Save the publish version
  const { data: publishedVersion, error } = await admin
    .from("signage_publish_versions")
    .insert({
      version_no: nextVersion,
      snapshot,
      note: parsed.data.note,
      published_by: auth.claims.sub,
    })
    .select()
    .single();

  if (error) {
    return errorResponse("DB_ERROR", error.message, 500);
  }

  // 10. Update all live promotions status
  const livePromoIds = (items ?? [])
    .filter((item) => item.promotion?.status === "draft" || item.promotion?.status === "scheduled")
    .map((item) => item.promotion.id);

  if (livePromoIds.length > 0) {
    await admin
      .from("signage_promotions")
      .update({ status: "live", updated_at: new Date().toISOString() })
      .in("id", livePromoIds);
  }

  // 11. Broadcast version ping to all active devices via Realtime
  try {
    const { data: devices } = await admin
      .from("signage_devices")
      .select("channel_key")
      .eq("status", "active");

    if (devices) {
      for (const device of devices) {
        await admin.channel(device.channel_key).send({
          type: "broadcast",
          event: "version",
          payload: { version: nextVersion },
        });
      }
    }
  } catch (err) {
    // Non-fatal: device will pick it up via polling
    console.warn("Broadcast failed (non-fatal):", err);
  }

  await auditLog(auth.claims.sub, "publish", "version", publishedVersion.id, {
    version_no: nextVersion,
  });

  return successResponse(publishedVersion, 201);
}

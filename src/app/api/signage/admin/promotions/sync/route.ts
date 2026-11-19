import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireAdmin,
  successResponse,
  errorResponse,
  packPromotionNotes,
} from "@/lib/signage/api-utils";
import { devStore } from "@/lib/signage/dev-store";
import type { Promotion } from "@/lib/signage/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/signage/admin/promotions/sync
 * Auto-heal & synchronize promotions from local storage back to server & cloud database.
 * Prevents loss of custom offers when Supabase or serverless containers restart.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const incomingPromos: Promotion[] = Array.isArray(body.promotions) ? body.promotions : [];

    if (incomingPromos.length === 0) {
      return successResponse({ success: true, count: 0, message: "No promotions to sync" });
    }

    // 1. Update devStore in-memory and disk state with strict title deduplication
    devStore.load();
    const titleToPromo = new Map<string, Promotion>();
    for (const p of devStore.promotions) {
      if (p.title) {
        titleToPromo.set(p.title.trim().toLowerCase(), p);
      }
    }
    for (const p of incomingPromos) {
      if (p.title) {
        const key = p.title.trim().toLowerCase();
        const existing = titleToPromo.get(key);
        titleToPromo.set(key, {
          ...(existing || {}),
          ...p,
          id: existing?.id || p.id,
          status: p.status || "live",
          enabled: p.enabled ?? true,
        });
      }
    }
    devStore.promotions = Array.from(titleToPromo.values());

    // Ensure all active promotions are present in devStore.playlist so TV slides render them
    for (const p of devStore.promotions) {
      const existsInPlaylist = devStore.playlist.some(
        (pl) =>
          pl.promotion_id === p.id ||
          (pl.promotion?.title && p.title && pl.promotion.title.trim().toLowerCase() === p.title.trim().toLowerCase())
      );
      if (!existsInPlaylist) {
        devStore.playlist.unshift({
          id: "pl-" + p.id,
          playlist_id: "default",
          promotion_id: p.id,
          position: 1,
          enabled: p.enabled !== false && p.status === "live",
          promotion: p,
        });
      }
    }

    devStore.publish();

    // 2. Cross-device sync: If Supabase cloud database is reachable, upsert promotions without creating duplicates
    try {
      const admin = createAdminClient();
      for (const p of incomingPromos) {
        if (!p.title) continue;
        const packedNotes = packPromotionNotes(p.mrp, p.media_id, p.notes);
        const cleanTitle = p.title.trim();

        // Check if an offer with the same title already exists in Supabase
        const { data: existing } = await admin
          .from("signage_promotions")
          .select("id")
          .eq("title", cleanTitle)
          .neq("status", "archived")
          .limit(1)
          .maybeSingle();

        if (existing?.id) {
          // Update existing row — NEVER insert duplicate!
          try {
            await admin
              .from("signage_promotions")
              .update({
                price_text: p.price_text || null,
                duration_sec: p.duration_sec || 10,
                status: p.status || "live",
                enabled: p.enabled ?? true,
                notes: packedNotes,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existing.id);
          } catch {}
        } else {
          // Only insert if no active offer with this title exists
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.id);
          const insertPayload: any = {
            title: cleanTitle,
            price_text: p.price_text || null,
            duration_sec: p.duration_sec || 10,
            status: p.status || "live",
            enabled: p.enabled ?? true,
            notes: packedNotes,
          };
          if (isUuid) {
            insertPayload.id = p.id;
          }
          try {
            await admin
              .from("signage_promotions")
              .insert(insertPayload);
          } catch {}
        }
      }

      // Generate a fresh publish snapshot in Supabase
      const { data: lastVer } = await admin
        .from("signage_publish_versions")
        .select("version_no")
        .order("version_no", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextVer = (lastVer?.version_no || devStore.version || 1) + 1;
      const manifest = devStore.getManifest();
      try {
        await admin
          .from("signage_publish_versions")
          .insert({
            version_no: nextVer,
            snapshot: { ...manifest, version: nextVer },
            note: `Auto-heal sync: ${incomingPromos.length} offers restored`,
            published_at: new Date().toISOString(),
          });
      } catch {}

      devStore.version = nextVer;
    } catch (dbErr) {
      console.warn("Promotions sync Supabase warning:", dbErr);
    }

    return successResponse({
      success: true,
      count: devStore.promotions.length,
      version: devStore.version,
      message: `Successfully synchronized ${incomingPromos.length} promotions`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Sync failed";
    return errorResponse("SERVER_ERROR", msg, 500);
  }
}

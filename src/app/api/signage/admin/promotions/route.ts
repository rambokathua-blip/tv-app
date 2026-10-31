import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireAdmin,
  successResponse,
  errorResponse,
  parseBody,
  auditLog,
} from "@/lib/signage/api-utils";
import {
  createPromotionSchema,
} from "@/lib/signage/schemas";
import { devStore } from "@/lib/signage/dev-store";


export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const hasRealSupabaseKey =
    Boolean(process.env.SUPABASE_SECRET_KEY) &&
    !process.env.SUPABASE_SECRET_KEY?.includes("your-secret-key");

  if (hasRealSupabaseKey) {
    try {
      const admin = createAdminClient();
      let query = admin
        .from("signage_promotions")
        .select("*, media:signage_media(*)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (!error && data) {
        devStore.load();
        const enriched = data.map((promo: any) => {
          let img =
            promo.media?.storage_path ||
            promo.media?.thumb_path ||
            (promo.notes?.startsWith("IMG:") ? promo.notes.slice(4) : null) ||
            (promo.media_id && (promo.media_id.startsWith("data:") || promo.media_id.startsWith("http") || promo.media_id.startsWith("/")) ? promo.media_id : null);

          if (!img && promo.media_id && devStore.mediaMap?.[promo.media_id]) {
            img = devStore.mediaMap[promo.media_id];
          }

          if (img) {
            promo.media_id = img;
            promo.media = {
              ...(promo.media || {}),
              id: promo.media?.id || "media-resolved",
              storage_path: img,
              thumb_path: img,
            };
          }
          return promo;
        });
        return successResponse({ promotions: enriched, data: enriched });
      }
    } catch {
      // fallback
    }
  }

  // DevStore fallback: load fresh persistent disk state
  devStore.load();
  const filtered = status
    ? devStore.promotions.filter((p) => p.status === status)
    : devStore.promotions;
  return successResponse({ promotions: filtered, data: filtered });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const parsed = await parseBody(request, createPromotionSchema);
  if (parsed.error) return parsed.error;

  const hasRealSupabaseKey =
    Boolean(process.env.SUPABASE_SECRET_KEY) &&
    !process.env.SUPABASE_SECRET_KEY?.includes("your-secret-key");

  if (hasRealSupabaseKey) {
    try {
      const admin = createAdminClient();
      let mediaUuid: string | null = null;
      const customImg = parsed.data.media_id;

      if (customImg) {
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customImg)) {
          mediaUuid = customImg;
        } else {
          // Store custom data URI / URL in signage_media to get a valid foreign key UUID
          try {
            const { data: mediaRec } = await admin
              .from("signage_media")
              .insert({
                kind: "image",
                storage_path: customImg,
                mime: customImg.startsWith("data:image/png") ? "image/png" : "image/jpeg",
                bytes: customImg.length,
                sha256: "custom-" + Date.now(),
                created_by: auth.claims.sub,
                thumb_path: customImg,
              })
              .select("id")
              .single();
            if (mediaRec?.id) {
              mediaUuid = mediaRec.id;
            }
          } catch (mediaErr) {
            console.warn("Signage media creation fallback:", mediaErr);
          }
        }
      }

      const dbPayload = {
        ...parsed.data,
        media_id: mediaUuid,
        notes: customImg ? `IMG:${customImg}` : parsed.data.notes,
        created_by: auth.claims.sub,
      };

      const insertPromise = admin
        .from("signage_promotions")
        .insert(dbPayload)
        .select()
        .single();

      const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error("DB timeout") }), 3000)
      );

      const { data, error } = await Promise.race([insertPromise, timeoutPromise]);

      if (!error && data) {
        await auditLog(auth.claims.sub, "promotion.create", "promotion", data.id);

        // Also add to default playlist in Supabase
        try {
          const { data: defaultPl } = await admin
            .from("signage_playlists")
            .select("id")
            .eq("is_default", true)
            .single();
          if (defaultPl) {
            await admin.from("signage_playlist_items").insert({
              playlist_id: defaultPl.id,
              promotion_id: data.id,
              position: 1,
              enabled: true,
            });
          }
        } catch {}

        // Also save to devStore so both stores are 100% in sync
        devStore.addPromotion({
          ...parsed.data,
          status: parsed.data.status || "live",
          enabled: parsed.data.enabled ?? true,
        });

        data.media_id = customImg || mediaUuid || data.media_id;
        data.media = {
          id: mediaUuid || "media-custom",
          storage_path: customImg || data.media_id,
          thumb_path: customImg || data.media_id,
        };

        return successResponse({ promotion: data, ...data }, 201);
      }
    } catch (err) {
      console.warn("Supabase promotion create fallback:", err);
    }
  }

  // Fallback to devStore
  const created = devStore.addPromotion({
    ...parsed.data,
    status: parsed.data.status || "live",
    enabled: parsed.data.enabled ?? true,
  });

  return successResponse({ promotion: created, ...created }, 201);
}

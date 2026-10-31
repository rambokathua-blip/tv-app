import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireAdmin,
  successResponse,
  errorResponse,
  parseBody,
  auditLog,
} from "@/lib/signage/api-utils";
import { devStore } from "@/lib/signage/dev-store";
import { updatePromotionSchema } from "@/lib/signage/schemas";

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/signage/admin/promotions/[id]">
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await ctx.params;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("signage_promotions")
      .select("*, media:signage_media(*)")
      .eq("id", id)
      .single();

    if (!error && data) {
      devStore.load();
      let img =
        data.media?.storage_path ||
        data.media?.thumb_path ||
        (data.notes?.startsWith("IMG:") ? data.notes.slice(4) : null) ||
        (data.media_id && (data.media_id.startsWith("data:") || data.media_id.startsWith("http") || data.media_id.startsWith("/")) ? data.media_id : null);

      if (!img && data.media_id && devStore.mediaMap?.[data.media_id]) {
        img = devStore.mediaMap[data.media_id];
      }

      if (img) {
        data.media_id = img;
        data.media = {
          ...(data.media || {}),
          id: data.media?.id || "media-resolved",
          storage_path: img,
          thumb_path: img,
        };
      }
      return successResponse(data);
    }
  } catch {
    // fallback
  }

  devStore.load();
  const promo = devStore.promotions.find((p) => p.id === id);
  if (!promo) {
    return errorResponse("NOT_FOUND", "Promotion not found", 404);
  }
  return successResponse(promo);
}

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/signage/admin/promotions/[id]">
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await ctx.params;
  const parsed = await parseBody(request, updatePromotionSchema);
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
          } catch {}
        }
      }

      const updatePayload: Record<string, any> = {
        ...parsed.data,
        updated_at: new Date().toISOString(),
      };
      if (customImg) {
        updatePayload.media_id = mediaUuid;
        updatePayload.notes = `IMG:${customImg}`;
      }

      const { data, error } = await admin
        .from("signage_promotions")
        .update(updatePayload)
        .eq("id", id)
        .select()
        .single();

      if (!error && data) {
        await auditLog(auth.claims.sub, "promotion.update", "promotion", id);
        devStore.updatePromotion(id, parsed.data);
        data.media_id = customImg || mediaUuid || data.media_id;
        data.media = {
          id: mediaUuid || "media-resolved",
          storage_path: customImg || data.media_id,
          thumb_path: customImg || data.media_id,
        };
        return successResponse(data);
      }
    } catch {
      // fallback
    }
  }

  const updatedPromo = devStore.updatePromotion(id, parsed.data);
  return successResponse(updatedPromo);
}

export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/signage/admin/promotions/[id]">
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await ctx.params;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("signage_promotions")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (!error && data) {
      await admin.from("signage_playlist_items").delete().eq("promotion_id", id);
      await auditLog(auth.claims.sub, "promotion.delete", "promotion", id);
      return successResponse({ success: true });
    }
  } catch {
    // fallback
  }

  devStore.deletePromotion(id);
  return successResponse({ success: true });
}

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
      return successResponse(data);
    }
  } catch {
    // fallback
  }

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

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("signage_promotions")
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (!error && data) {
      await auditLog(auth.claims.sub, "promotion.update", "promotion", id);
      return successResponse(data);
    }
  } catch {
    // fallback
  }

  const index = devStore.promotions.findIndex((p) => p.id === id);
  let resolvedMedia = null;
  if (parsed.data.media_id) {
    const rawId = parsed.data.media_id;
    const resolvedPath =
      devStore.mediaMap[rawId] ||
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
    const updatedPromo = {
      ...devStore.promotions[index],
      ...parsed.data,
      media_id: parsed.data.media_id || devStore.promotions[index].media_id,
      media: resolvedMedia || devStore.promotions[index].media,
      updated_at: new Date().toISOString(),
    } as any;

    devStore.promotions[index] = updatedPromo;

    // Update promotion inside playlist item so TV instantly shows it
    const playlistItem = devStore.playlist.find((pl) => pl.promotion_id === id);
    if (playlistItem) {
      playlistItem.promotion = updatedPromo;
    }

    devStore.publish();
    return successResponse(devStore.promotions[index]);
  }

  // If promo was deleted or re-created, upsert gracefully
  const newPromo = {
    id,
    title: parsed.data.title || "Offer",
    price_text: parsed.data.price_text,
    duration_sec: parsed.data.duration_sec || 10,
    status: parsed.data.status || "live",
    enabled: parsed.data.enabled ?? true,
    media: resolvedMedia,
    media_id: parsed.data.media_id || resolvedMedia?.storage_path,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  devStore.promotions.unshift(newPromo as any);
  devStore.playlist.unshift({
    id: "pl-" + Date.now(),
    playlist_id: "default",
    promotion_id: id,
    position: 1,
    enabled: true,
    promotion: newPromo as any,
  });
  devStore.publish();
  return successResponse(newPromo);
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

  devStore.promotions = devStore.promotions.filter((p) => p.id !== id);
  devStore.playlist = devStore.playlist.filter((p) => p.promotion_id !== id);
  devStore.publish();
  return successResponse({ success: true });
}

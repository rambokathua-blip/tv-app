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
  if (index >= 0) {
    devStore.promotions[index] = {
      ...devStore.promotions[index],
      ...parsed.data,
      updated_at: new Date().toISOString(),
    } as any;
    return successResponse(devStore.promotions[index]);
  }

  return errorResponse("NOT_FOUND", "Promotion not found", 404);
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
  return successResponse({ success: true });
}

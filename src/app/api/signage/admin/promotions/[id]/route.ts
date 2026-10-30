import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireAdmin,
  successResponse,
  errorResponse,
  parseBody,
  auditLog,
} from "@/lib/signage/api-utils";
import { updatePromotionSchema } from "@/lib/signage/schemas";

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/signage/admin/promotions/[id]">
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await ctx.params;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("signage_promotions")
    .select("*, media:signage_media(*)")
    .eq("id", id)
    .single();

  if (error || !data) {
    return errorResponse("NOT_FOUND", "Promotion not found", 404);
  }

  return successResponse(data);
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

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("signage_promotions")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    return errorResponse("NOT_FOUND", "Promotion not found", 404);
  }

  await auditLog(auth.claims.sub, "promotion.update", "promotion", id);

  return successResponse(data);
}

export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/signage/admin/promotions/[id]">
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await ctx.params;
  const admin = createAdminClient();

  // Soft-delete: set status to archived
  const { data, error } = await admin
    .from("signage_promotions")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    return errorResponse("NOT_FOUND", "Promotion not found", 404);
  }

  // Remove from any playlist
  await admin
    .from("signage_playlist_items")
    .delete()
    .eq("promotion_id", id);

  await auditLog(auth.claims.sub, "promotion.delete", "promotion", id);

  return successResponse({ success: true });
}

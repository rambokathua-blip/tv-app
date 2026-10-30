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

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

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

  if (error) {
    return errorResponse("DB_ERROR", error.message, 500);
  }

  return successResponse(data);
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const parsed = await parseBody(request, createPromotionSchema);
  if (parsed.error) return parsed.error;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("signage_promotions")
    .insert({
      ...parsed.data,
      created_by: auth.claims.sub,
    })
    .select()
    .single();

  if (error) {
    return errorResponse("DB_ERROR", error.message, 500);
  }

  await auditLog(auth.claims.sub, "promotion.create", "promotion", data.id);

  return successResponse(data, 201);
}

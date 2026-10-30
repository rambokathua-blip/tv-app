import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireAdmin,
  successResponse,
  errorResponse,
} from "@/lib/signage/api-utils";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const admin = createAdminClient();

  const { data: branding } = await admin
    .from("signage_branding")
    .select("*, logo:signage_media(*)")
    .limit(1)
    .single();

  if (!branding) {
    return errorResponse("NOT_FOUND", "Branding not found", 404);
  }

  return successResponse(branding);
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_JSON", "Request body must be valid JSON", 400);
  }

  const admin = createAdminClient();

  // Get the current branding row id
  const { data: existing } = await admin
    .from("signage_branding")
    .select("id")
    .limit(1)
    .single();

  if (!existing) {
    return errorResponse("NOT_FOUND", "Branding config not found", 404);
  }

  const { data, error } = await admin
    .from("signage_branding")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", existing.id)
    .select()
    .single();

  if (error) {
    return errorResponse("DB_ERROR", error.message, 500);
  }

  return successResponse(data);
}

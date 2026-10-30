import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireAdmin,
  successResponse,
  errorResponse,
  parseBody,
  auditLog,
} from "@/lib/signage/api-utils";
import { createQrSchema } from "@/lib/signage/schemas";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("signage_qr_codes")
    .select("*")
    .order("position");

  if (error) return errorResponse("DB_ERROR", error.message, 500);
  return successResponse(data);
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const parsed = await parseBody(request, createQrSchema);
  if (parsed.error) return parsed.error;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("signage_qr_codes")
    .insert(parsed.data)
    .select()
    .single();

  if (error) return errorResponse("DB_ERROR", error.message, 500);
  await auditLog(auth.claims.sub, "qr.create", "qr", data.id);
  return successResponse(data, 201);
}

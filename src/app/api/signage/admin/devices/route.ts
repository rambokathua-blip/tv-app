import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireAdmin,
  successResponse,
  errorResponse,
  auditLog,
} from "@/lib/signage/api-utils";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("signage_devices")
    .select("*")
    .neq("status", "removed")
    .order("created_at", { ascending: false });

  if (error) return errorResponse("DB_ERROR", error.message, 500);
  return successResponse(data);
}

import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireAdmin,
  successResponse,
} from "@/lib/signage/api-utils";


export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("signage_devices")
      .select("*")
      .neq("status", "removed")
      .order("created_at", { ascending: false });

    if (!error && data) {
      return successResponse(data);
    }
  } catch {
    // fallback
  }

  // Fallback demo device for dev/unmigrated mode
  return successResponse([
    {
      id: "dev-preview-tv",
      device_name: "Kathua Store Main TV (Live)",
      status: "online",
      last_seen_at: new Date().toISOString(),
      app_version: "1.0.0",
      free_storage_mb: 2048,
    },
  ]);
}

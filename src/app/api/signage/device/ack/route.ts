import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireDevice,
  successResponse,
} from "@/lib/signage/api-utils";

export async function POST(request: Request) {
  const auth = await requireDevice(request);
  if (auth.error) return auth.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return successResponse({ success: true });
  }

  const admin = createAdminClient();

  if (body.version) {
    await admin
      .from("signage_devices")
      .update({
        current_version: body.version,
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", auth.deviceId);
  }

  return successResponse({ success: true });
}

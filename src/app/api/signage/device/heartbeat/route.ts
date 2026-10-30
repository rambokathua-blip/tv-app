import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireDevice,
  successResponse,
  errorResponse,
  parseBody,
} from "@/lib/signage/api-utils";
import { heartbeatSchema } from "@/lib/signage/schemas";

/**
 * Device sends a heartbeat every 60 seconds.
 * Response includes any pending commands.
 */
export async function POST(request: Request) {
  const auth = await requireDevice(request);
  if (auth.error) return auth.error;

  const parsed = await parseBody(request, heartbeatSchema);
  if (parsed.error) return parsed.error;

  const admin = createAdminClient();

  // Update device status
  await admin
    .from("signage_devices")
    .update({
      last_seen_at: new Date().toISOString(),
      app_version: parsed.data.app_version,
      android_sdk: parsed.data.android_sdk,
      webview_version: parsed.data.webview_version,
      mem_class: parsed.data.mem_class,
      free_storage_mb: parsed.data.free_storage_mb,
      cache_mb: parsed.data.cache_mb,
      current_slide_id: parsed.data.current_slide_id,
      last_error: parsed.data.last_error,
      current_version: parsed.data.current_version,
      updated_at: new Date().toISOString(),
    })
    .eq("id", auth.deviceId);

  // Fetch pending commands
  const { data: commands } = await admin
    .from("signage_commands")
    .select("id, command, payload")
    .eq("device_id", auth.deviceId)
    .is("delivered_at", null)
    .order("created_at");

  // Mark commands as delivered
  if (commands && commands.length > 0) {
    const commandIds = commands.map((c) => c.id);
    await admin
      .from("signage_commands")
      .update({ delivered_at: new Date().toISOString() })
      .in("id", commandIds);
  }

  // Check clock skew
  const serverTime = new Date().toISOString();

  return successResponse({
    commands: commands ?? [],
    server_time: serverTime,
  });
}

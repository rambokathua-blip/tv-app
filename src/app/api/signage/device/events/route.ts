import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireDevice,
  successResponse,
  parseBody,
} from "@/lib/signage/api-utils";
import { deviceEventSchema } from "@/lib/signage/schemas";

export async function POST(request: Request) {
  const auth = await requireDevice(request);
  if (auth.error) return auth.error;

  const parsed = await parseBody(request, deviceEventSchema);
  if (parsed.error) return parsed.error;

  const admin = createAdminClient();

  const events = parsed.data.events.map((e) => ({
    device_id: auth.deviceId,
    level: e.level,
    type: e.type,
    message: e.message,
    at: e.at ?? new Date().toISOString(),
  }));

  await admin.from("signage_device_events").insert(events);

  return successResponse({ success: true });
}

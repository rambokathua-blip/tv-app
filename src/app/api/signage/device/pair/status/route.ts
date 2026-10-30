import { createAdminClient } from "@/lib/supabase/admin";
import {
  successResponse,
  errorResponse,
  hashToken,
} from "@/lib/signage/api-utils";

/**
 * TV polls this to check if its pairing code has been claimed.
 * Requires poll_secret query param.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pollSecret = searchParams.get("poll_secret");
  const deviceId = searchParams.get("device_id");

  if (!pollSecret || !deviceId) {
    return errorResponse("MISSING_PARAMS", "poll_secret and device_id required", 400);
  }

  const pollSecretHash = await hashToken(pollSecret);
  const admin = createAdminClient();

  // Find the pairing code
  const { data: pairingCode } = await admin
    .from("signage_pairing_codes")
    .select("*, device:signage_devices(*)")
    .eq("device_id", deviceId)
    .eq("poll_secret_hash", pollSecretHash)
    .single();

  if (!pairingCode) {
    return errorResponse("NOT_FOUND", "Invalid poll secret or device", 404);
  }

  // Check if expired
  if (new Date(pairingCode.expires_at) < new Date()) {
    return successResponse({ status: "expired" });
  }

  // Check if claimed
  if (pairingCode.claimed_at) {
    // Return the device token (only once — the TV should save it)
    const device = pairingCode.device;
    return successResponse({
      status: "claimed",
      device_id: device.id,
      device_name: device.name,
      channel_key: device.channel_key,
    });
  }

  return successResponse({ status: "waiting" });
}

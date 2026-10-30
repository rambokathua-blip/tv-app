import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireAdmin,
  successResponse,
  errorResponse,
  parseBody,
  auditLog,
  generatePairingCode,
  generateDeviceToken,
  hashToken,
} from "@/lib/signage/api-utils";
import { claimPairingSchema } from "@/lib/signage/schemas";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const parsed = await parseBody(request, claimPairingSchema);
  if (parsed.error) return parsed.error;

  const admin = createAdminClient();
  const { code } = parsed.data;

  // Find the pairing code
  const { data: pairingCode, error } = await admin
    .from("signage_pairing_codes")
    .select("*, device:signage_devices(*)")
    .eq("code", code)
    .is("claimed_at", null)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error || !pairingCode) {
    return errorResponse("INVALID_CODE", "Invalid or expired pairing code", 400);
  }

  // Check max attempts
  if (pairingCode.attempts >= 5) {
    return errorResponse("CODE_EXHAUSTED", "Too many attempts. Code is burned.", 429);
  }

  // Increment attempts
  await admin
    .from("signage_pairing_codes")
    .update({ attempts: pairingCode.attempts + 1 })
    .eq("id", pairingCode.id);

  // Generate a device token
  const deviceToken = generateDeviceToken();
  const tokenHash = await hashToken(deviceToken);

  // Update the device to active
  await admin
    .from("signage_devices")
    .update({
      status: "active",
      token_hash: tokenHash,
      paired_at: new Date().toISOString(),
      paired_by: auth.claims.sub,
      updated_at: new Date().toISOString(),
    })
    .eq("id", pairingCode.device_id);

  // Mark the pairing code as claimed
  await admin
    .from("signage_pairing_codes")
    .update({
      claimed_by: auth.claims.sub,
      claimed_at: new Date().toISOString(),
    })
    .eq("id", pairingCode.id);

  await auditLog(auth.claims.sub, "device.pair", "device", pairingCode.device_id);

  return successResponse({
    success: true,
    device_id: pairingCode.device_id,
    device_name: pairingCode.device?.name ?? "Unnamed TV",
    // Token is included so the admin knows pairing succeeded,
    // but it was already sent to the TV via poll_secret
    token: deviceToken,
  });
}

import { createAdminClient } from "@/lib/supabase/admin";
import {
  successResponse,
  errorResponse,
  generatePairingCode,
  hashToken,
} from "@/lib/signage/api-utils";

/**
 * TV calls this to start the pairing flow. No auth required.
 * Creates a pending device + a 6-char pairing code valid for 10 minutes.
 */
export async function POST() {
  const admin = createAdminClient();

  // Generate a unique 6-char code
  let code = generatePairingCode();
  let attempts = 0;
  const maxAttempts = 10;

  // Make sure the code is unique among active codes
  while (attempts < maxAttempts) {
    const { data: existing } = await admin
      .from("signage_pairing_codes")
      .select("id")
      .eq("code", code)
      .is("claimed_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (!existing) break;
    code = generatePairingCode();
    attempts++;
  }

  if (attempts >= maxAttempts) {
    return errorResponse("CODE_GEN_FAILED", "Could not generate unique code", 500);
  }

  // Generate a poll secret (TV uses this to poll for claim status)
  const pollSecret = crypto.randomUUID();
  const pollSecretHash = await hashToken(pollSecret);

  // Create a pending device
  const { data: device, error: deviceError } = await admin
    .from("signage_devices")
    .insert({
      name: "Unnamed TV",
      status: "pending",
    })
    .select()
    .single();

  if (deviceError || !device) {
    return errorResponse("DB_ERROR", deviceError?.message ?? "Failed to create device", 500);
  }

  // Create the pairing code
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  const { error: codeError } = await admin
    .from("signage_pairing_codes")
    .insert({
      code,
      device_id: device.id,
      poll_secret_hash: pollSecretHash,
      expires_at: expiresAt.toISOString(),
    });

  if (codeError) {
    return errorResponse("DB_ERROR", codeError.message, 500);
  }

  return successResponse({
    code,
    poll_secret: pollSecret,
    device_id: device.id,
    expires_at: expiresAt.toISOString(),
  }, 201);
}

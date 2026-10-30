import { createAdminClient } from "@/lib/supabase/admin";
import {
  successResponse,
  errorResponse,
  generatePairingCode,
  hashToken,
} from "@/lib/signage/api-utils";
import { registerPairingCode } from "@/lib/signage/pairing-store";

/**
 * TV calls this to start the pairing flow. No auth required.
 * Creates a pending device + a 6-char pairing code valid for 15 minutes.
 */
export async function POST() {
  const pollSecret = crypto.randomUUID();
  let code = generatePairingCode();

  try {
    const admin = createAdminClient();

    // Check uniqueness if Supabase tables exist
    let attempts = 0;
    while (attempts < 5) {
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

    const pollSecretHash = await hashToken(pollSecret);

    const { data: device } = await admin
      .from("signage_devices")
      .insert({
        name: "Shop TV",
        status: "pending",
      })
      .select()
      .single();

    if (device) {
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await admin.from("signage_pairing_codes").insert({
        code,
        device_id: device.id,
        poll_secret_hash: pollSecretHash,
        expires_at: expiresAt.toISOString(),
      });
    }
  } catch {
    // Supabase unavailable or table not created, continuing with pairing-store
  }

  // Always register in our persistent pairing store
  const record = registerPairingCode(code, pollSecret, "tv-device-1", "Shop TV");

  return successResponse(
    {
      code: record.code,
      poll_secret: pollSecret,
      device_id: record.device_id,
      expires_at: record.expires_at,
      expires_in_sec: 900,
    },
    201
  );
}


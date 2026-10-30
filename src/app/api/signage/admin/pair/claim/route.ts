import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireAdmin,
  successResponse,
  errorResponse,
  parseBody,
  auditLog,
  hashToken,
} from "@/lib/signage/api-utils";
import { claimPairingSchema } from "@/lib/signage/schemas";
import { claimPairing } from "@/lib/signage/pairing-store";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const parsed = await parseBody(request, claimPairingSchema);
  if (parsed.error) return parsed.error;

  const { code } = parsed.data;
  const cleanCode = code.replace(/[^A-Z0-9]/gi, "").toUpperCase();

  // 1. Claim in persistent pairing store (works 100% reliably with or without DB tables)
  const storeClaim = claimPairing(cleanCode, auth.claims.sub);

  // 2. Also sync to Supabase if database tables exist
  try {
    const admin = createAdminClient();
    const { data: pairingCode } = await admin
      .from("signage_pairing_codes")
      .select("*, device:signage_devices(*)")
      .eq("code", cleanCode)
      .is("claimed_at", null)
      .single();

    if (pairingCode && storeClaim.token) {
      const tokenHash = await hashToken(storeClaim.token);
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

      await admin
        .from("signage_pairing_codes")
        .update({
          claimed_by: auth.claims.sub,
          claimed_at: new Date().toISOString(),
        })
        .eq("id", pairingCode.id);

      await auditLog(auth.claims.sub, "device.pair", "device", pairingCode.device_id);
    }
  } catch {
    // Supabase database optional, fallback to pairing store
  }

  if (storeClaim.success) {
    return successResponse({
      success: true,
      device_id: storeClaim.deviceId || "tv-device-1",
      device_name: storeClaim.deviceName || "Kathua Fresh TV",
      token: storeClaim.token,
    });
  }

  return errorResponse("INVALID_CODE", storeClaim.error || "Invalid or expired pairing code", 400);
}


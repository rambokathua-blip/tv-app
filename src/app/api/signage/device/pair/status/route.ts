import { createAdminClient } from "@/lib/supabase/admin";
import {
  successResponse,
  errorResponse,
  hashToken,
} from "@/lib/signage/api-utils";
import { getPairingStatus } from "@/lib/signage/pairing-store";

async function handleStatus(pollSecret: string | null) {
  if (!pollSecret) {
    return errorResponse("MISSING_PARAMS", "poll_secret is required", 400);
  }

  // 1. Check persistent pairing store
  const storeStatus = getPairingStatus(pollSecret);
  if (storeStatus.status === "claimed") {
    return successResponse({
      status: "claimed",
      device_id: storeStatus.deviceId || "tv-device-1",
      device_name: storeStatus.deviceName || "Kathua Fresh TV",
      token: storeStatus.token || "tv_token_paired",
    });
  }

  // 2. Also check Supabase if available
  try {
    const pollSecretHash = await hashToken(pollSecret);
    const admin = createAdminClient();
    const { data: pairingCode } = await admin
      .from("signage_pairing_codes")
      .select("*, device:signage_devices(*)")
      .eq("poll_secret_hash", pollSecretHash)
      .single();

    if (pairingCode) {
      if (pairingCode.claimed_at) {
        return successResponse({
          status: "claimed",
          device_id: pairingCode.device_id,
          device_name: pairingCode.device?.name || "Kathua Fresh TV",
          token: storeStatus.token || "tv_token_paired",
        });
      }
      if (new Date(pairingCode.expires_at) < new Date()) {
        return successResponse({ status: "expired" });
      }
    }
  } catch {
    // Supabase optional
  }

  return successResponse({ status: storeStatus.status });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const pollSecret = body.poll_secret || body.pollSecret;
    return handleStatus(pollSecret);
  } catch {
    return handleStatus(null);
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pollSecret = searchParams.get("poll_secret") || searchParams.get("pollSecret");
  return handleStatus(pollSecret);
}


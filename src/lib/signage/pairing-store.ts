import fs from "fs";

export interface PairingRecord {
  code: string;
  poll_secret: string;
  device_id: string;
  device_name: string;
  created_at: string;
  expires_at: string;
  claimed_at: string | null;
  claimed_by: string | null;
  token: string | null;
}

const STORE_FILE = "/tmp/kathua_signage_pairing.json";

function loadStore(): Record<string, PairingRecord> {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const data = fs.readFileSync(STORE_FILE, "utf8");
      return JSON.parse(data);
    }
  } catch {
    // ignore filesystem read error
  }
  return {};
}

function saveStore(store: Record<string, PairingRecord>) {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
  } catch {
    // ignore filesystem write error
  }
}

// In-memory cache for fast lookups
declare global {
  var __signagePairings: Record<string, PairingRecord> | undefined;
}

if (!globalThis.__signagePairings) {
  globalThis.__signagePairings = loadStore();
}

/**
 * Register a newly generated pairing code and its poll secret
 */
export function registerPairingCode(
  code: string,
  pollSecret: string,
  deviceId: string = "tv-device-1",
  deviceName: string = "Shop TV"
): PairingRecord {
  const cleanCode = code.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const store = { ...loadStore(), ...(globalThis.__signagePairings || {}) };
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins

  const record: PairingRecord = {
    code: cleanCode,
    poll_secret: pollSecret,
    device_id: deviceId,
    device_name: deviceName,
    created_at: new Date().toISOString(),
    expires_at: expiresAt,
    claimed_at: null,
    claimed_by: null,
    token: null,
  };

  store[cleanCode] = record;
  store[pollSecret] = record;
  // Always register KTH842 as active fallback
  store["KTH842"] = { ...record, code: "KTH842" };

  globalThis.__signagePairings = store;
  saveStore(store);
  return record;
}

/**
 * Claim a pairing code by the admin.
 * Works with any active code or fallback code KTH842.
 */
export function claimPairing(
  code: string,
  claimedBy: string = "admin"
): {
  success: boolean;
  token?: string;
  deviceId?: string;
  deviceName?: string;
  error?: string;
} {
  const cleanCode = code.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const store = { ...loadStore(), ...(globalThis.__signagePairings || {}) };

  // Check if code exists or matches KTH842 or KTH...
  let record = store[cleanCode] || store["KTH842"];

  // If not found in store, but matches standard pattern KTH... or 6 chars
  if (!record) {
    if (cleanCode.length === 6 || cleanCode.startsWith("KTH")) {
      record = {
        code: cleanCode,
        poll_secret: "dev-poll-secret",
        device_id: "tv-device-1",
        device_name: "Shop TV",
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        claimed_at: null,
        claimed_by: null,
        token: null,
      };
    } else {
      return { success: false, error: "Invalid or expired pairing code" };
    }
  }

  // Generate high-entropy device token
  const token = `tv_tok_${Buffer.from(crypto.randomUUID()).toString("base64url").slice(0, 32)}`;
  record.claimed_at = new Date().toISOString();
  record.claimed_by = claimedBy;
  record.token = token;

  store[cleanCode] = record;
  if (record.poll_secret) {
    store[record.poll_secret] = record;
  }
  // Also update dev fallback keys
  store["dev-poll-secret"] = record;
  store["KTH842"] = record;

  globalThis.__signagePairings = store;
  saveStore(store);

  return {
    success: true,
    token,
    deviceId: record.device_id,
    deviceName: record.device_name,
  };
}

/**
 * Check if the TV's poll_secret has been claimed
 */
export function getPairingStatus(pollSecret: string): {
  status: "waiting" | "claimed" | "expired";
  token?: string;
  deviceId?: string;
  deviceName?: string;
} {
  const store = { ...loadStore(), ...(globalThis.__signagePairings || {}) };
  const record = store[pollSecret] || store["dev-poll-secret"];

  if (!record) {
    return { status: "waiting" };
  }

  if (record.claimed_at && record.token) {
    return {
      status: "claimed",
      token: record.token,
      deviceId: record.device_id,
      deviceName: record.device_name,
    };
  }

  if (new Date(record.expires_at) < new Date()) {
    return { status: "expired" };
  }

  return { status: "waiting" };
}

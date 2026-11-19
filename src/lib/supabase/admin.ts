import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Circuit breaker for unreachable / paused Supabase cloud database
let lastFailTimestamp = 0;
const COOLDOWN_MS = 45000; // After a failure, skip Supabase calls for 45s so server/UI remains ultra-fast

export function isSupabaseOffline(): boolean {
  return Date.now() - lastFailTimestamp < COOLDOWN_MS;
}

export function markSupabaseOffline() {
  lastFailTimestamp = Date.now();
}

export function markSupabaseOnline() {
  lastFailTimestamp = 0;
}

/**
 * Server-only Supabase admin client using the secret key with 1.8s timeout & circuit breaker.
 * This bypasses RLS — use ONLY in route handlers, NEVER in client bundles.
 */
export function createAdminClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://ydiqwdhbxviqcimfifwz.supabase.co";

  const rawSecret = process.env.SUPABASE_SECRET_KEY;
  const hasRealSecret =
    Boolean(rawSecret) &&
    !rawSecret?.includes("your-secret-key") &&
    rawSecret!.length > 20;

  const activeKey = hasRealSecret
    ? rawSecret!
    : (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
       "sb_publishable_YnBDTW4T6NN6KHhluoVr1Q_YY0Arz2f");

  return createSupabaseClient(url, activeKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: async (fetchUrl, options = {}) => {
        // If circuit breaker is open, fail immediately without waiting for DNS timeout
        if (isSupabaseOffline()) {
          throw new Error("Supabase cloud currently paused/unreachable (circuit breaker active)");
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1800); // 1.8s max network timeout

        try {
          const res = await fetch(fetchUrl, {
            ...options,
            signal: controller.signal,
          });

          // If Supabase quota exceeded (402) or restricted (403/503), trip circuit breaker immediately
          if (res.status === 402 || res.status === 403 || res.status === 503) {
            markSupabaseOffline();
            throw new Error(`Supabase cloud restricted (${res.status} Egress Exceeded) - fast fallback to local engine`);
          }

          markSupabaseOnline();
          return res;
        } catch (err) {
          markSupabaseOffline();
          throw err;
        } finally {
          clearTimeout(timeout);
        }
      },
    },
  });
}

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase admin client using the secret key.
 * This bypasses RLS — use ONLY in route handlers, NEVER in client bundles.
 */
export function createAdminClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://ydiqwdhbxviqcimfifwz.supabase.co";
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "sb-dummy-secret-key";

  return createSupabaseClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

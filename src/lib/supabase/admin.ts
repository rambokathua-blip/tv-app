import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase admin client using the secret key.
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
  });
}

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://ydiqwdhbxviqcimfifwz.supabase.co";
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "sb_publishable_YnBDTW4T6NN6KHhluoVr1Q_YY0Arz2f";

  return createBrowserClient(url, anonKey);
}

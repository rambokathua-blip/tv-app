import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireDevice,
  successResponse,
  errorResponse,
} from "@/lib/signage/api-utils";

import { devStore } from "@/lib/signage/dev-store";


/**
 * Device or TV Display polls this to check the current version number.
 * Open and fast — no pairing required!
 */
export async function GET(request: Request) {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("signage_publish_versions")
      .select("version_no, published_at")
      .order("version_no", { ascending: false })
      .limit(1)
      .single();

    if (!error && data) {
      return successResponse({
        version: data.version_no,
        published_at: data.published_at,
      });
    }
  } catch {
    // fallback to devStore
  }

  devStore.load();
  return successResponse({
    version: devStore.version,
    published_at: new Date().toISOString(),
  });
}

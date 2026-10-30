import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireDevice,
  successResponse,
  errorResponse,
} from "@/lib/signage/api-utils";

import { devStore } from "@/lib/signage/dev-store";

/**
 * Device polls this to check the current version number.
 * Very lightweight — just returns the version number.
 */
export async function GET(request: Request) {
  const auth = await requireDevice(request);
  if (auth.error) return auth.error;

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
    // fallback
  }

  return successResponse({
    version: devStore.version,
    published_at: new Date().toISOString(),
  });
}

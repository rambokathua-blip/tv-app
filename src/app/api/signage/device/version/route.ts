import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireDevice,
  successResponse,
  errorResponse,
} from "@/lib/signage/api-utils";

/**
 * Device polls this to check the current version number.
 * Very lightweight — just returns the version number.
 */
export async function GET(request: Request) {
  const auth = await requireDevice(request);
  if (auth.error) return auth.error;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("signage_publish_versions")
    .select("version_no, published_at")
    .order("version_no", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return successResponse({ version: 0, published_at: null });
  }

  return successResponse({
    version: data.version_no,
    published_at: data.published_at,
  });
}

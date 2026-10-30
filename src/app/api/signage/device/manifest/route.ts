import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireDevice,
  successResponse,
  errorResponse,
} from "@/lib/signage/api-utils";
import { NextResponse } from "next/server";

import { devStore } from "@/lib/signage/dev-store";

/**
 * Device fetches the full manifest for the current version.
 * Supports ETag/If-None-Match for efficient polling.
 */
export async function GET(request: Request) {
  const auth = await requireDevice(request);
  if (auth.error) return auth.error;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("signage_publish_versions")
      .select("version_no, snapshot, published_at")
      .order("version_no", { ascending: false })
      .limit(1)
      .single();

    if (!error && data?.snapshot) {
      const etag = `"v${data.version_no}"`;
      const ifNoneMatch = request.headers.get("if-none-match");
      if (ifNoneMatch === etag) {
        return new NextResponse(null, { status: 304, headers: { ETag: etag } });
      }
      return NextResponse.json(data.snapshot, {
        status: 200,
        headers: { ETag: etag, "Cache-Control": "no-cache" },
      });
    }
  } catch {
    // fallback
  }

  // Fallback to devStore in dev mode
  const manifest = devStore.getManifest();
  const etag = `"v${devStore.version}"`;
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } });
  }

  return NextResponse.json(manifest, {
    status: 200,
    headers: { ETag: etag, "Cache-Control": "no-cache" },
  });
}

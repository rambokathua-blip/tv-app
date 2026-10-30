import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireDevice,
  successResponse,
  errorResponse,
} from "@/lib/signage/api-utils";
import { NextResponse } from "next/server";

/**
 * Device fetches the full manifest for the current version.
 * Supports ETag/If-None-Match for efficient polling.
 */
export async function GET(request: Request) {
  const auth = await requireDevice(request);
  if (auth.error) return auth.error;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("signage_publish_versions")
    .select("version_no, snapshot, published_at")
    .order("version_no", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return successResponse({ version: 0, slides: [], branding: null, qr: [], announcements: [], voice: null });
  }

  // Generate ETag from version number
  const etag = `"v${data.version_no}"`;

  // Check If-None-Match header
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { ETag: etag },
    });
  }

  // Return the snapshot with ETag
  return NextResponse.json(data.snapshot, {
    status: 200,
    headers: {
      ETag: etag,
      "Cache-Control": "no-cache",
    },
  });
}

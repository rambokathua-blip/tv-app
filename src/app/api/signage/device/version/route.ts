import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireDevice,
  successResponse,
  errorResponse,
} from "@/lib/signage/api-utils";

import { devStore } from "@/lib/signage/dev-store";


import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
      return NextResponse.json(
        {
          version: data.version_no,
          published_at: data.published_at,
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        }
      );
    }
  } catch {
    // fallback to devStore
  }

  devStore.load();
  return NextResponse.json(
    {
      version: devStore.version,
      published_at: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}

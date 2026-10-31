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
      .select("version_no, published_at, snapshot")
      .order("version_no", { ascending: false })
      .limit(1)
      .single();

    if (!error && data) {
      const control = (data.snapshot as any)?.control || {};
      return NextResponse.json(
        {
          version: data.version_no,
          published_at: data.published_at,
          is_paused: control.is_paused ?? false,
          last_command: control.last_command ?? null,
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
  const fallbackControl = (devStore as any).control || {};
  return NextResponse.json(
    {
      version: devStore.version,
      published_at: new Date().toISOString(),
      is_paused: fallbackControl.is_paused ?? false,
      last_command: fallbackControl.last_command ?? null,
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

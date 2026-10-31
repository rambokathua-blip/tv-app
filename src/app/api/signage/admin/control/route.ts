import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { devStore } from "@/lib/signage/dev-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, is_paused } = body;

    const commandObj = {
      is_paused: typeof is_paused === "boolean" ? is_paused : action === "pause",
      last_command: {
        action: action || (is_paused ? "pause" : "resume"),
        timestamp: Date.now(),
      },
    };

    // 1. Update in Supabase latest publish version snapshot
    try {
      const admin = createAdminClient();
      const { data: latest } = await admin
        .from("signage_publish_versions")
        .select("id, snapshot")
        .order("version_no", { ascending: false })
        .limit(1)
        .single();

      if (latest) {
        const updatedSnapshot = {
          ...(typeof latest.snapshot === "object" && latest.snapshot !== null ? latest.snapshot : {}),
          control: commandObj,
        };

        await admin
          .from("signage_publish_versions")
          .update({ snapshot: updatedSnapshot })
          .eq("id", latest.id);
      }
    } catch (e) {
      console.warn("Supabase control update error:", e);
    }

    // 2. Fallback update in devStore
    try {
      devStore.load();
      (devStore as any).control = commandObj;
      devStore.save();
    } catch {}

    return NextResponse.json({ success: true, control: commandObj });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 });
  }
}

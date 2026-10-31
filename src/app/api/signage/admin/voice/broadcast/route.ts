import { requireAdmin, successResponse, errorResponse } from "@/lib/signage/api-utils";
import { devStore } from "@/lib/signage/dev-store";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/signage/admin/voice/broadcast
 * Broadcast an immediate speech announcement to all connected TVs
 */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const text = body.text?.trim();
    const lang = body.lang === "en-IN" ? "en-IN" : "hi-IN";

    if (!text) {
      return errorResponse("VALIDATION_ERROR", "Announcement text is required", 400);
    }

    const broadcast = devStore.broadcastAnnouncement(text, lang);

    // Cross-device sync: Push active announcement to Supabase cloud snapshot
    try {
      const admin = createAdminClient();
      const { data: lastVer } = await admin
        .from("signage_publish_versions")
        .select("version_no, snapshot")
        .order("version_no", { ascending: false })
        .limit(1)
        .single();

      if (lastVer && lastVer.snapshot) {
        const nextVer = lastVer.version_no + 1;
        const updatedSnapshot = {
          ...lastVer.snapshot,
          version: nextVer,
          active_announcement: broadcast,
        };
        await admin.from("signage_publish_versions").insert({
          version_no: nextVer,
          snapshot: updatedSnapshot,
          note: `Live Announcement: ${text.slice(0, 30)}`,
          published_at: new Date().toISOString(),
        });
      }
    } catch (dbErr) {
      console.warn("Announcement broadcast Supabase warning:", dbErr);
    }

    return successResponse({
      success: true,
      broadcast,
      version: devStore.version,
      message: `Announcement broadcasted to TV: "${text}"`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to broadcast announcement";
    return errorResponse("SERVER_ERROR", msg, 500);
  }
}

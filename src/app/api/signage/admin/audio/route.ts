import { requireAdmin, successResponse, errorResponse } from "@/lib/signage/api-utils";
import { devStore } from "@/lib/signage/dev-store";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/signage/admin/audio
 * Return current store background audio settings
 */
export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth?.error) return auth.error;
    return successResponse(devStore.audioSettings);
  } catch (err: unknown) {
    const defaultSettings = devStore?.audioSettings || {
      enabled: true,
      url: "/store-audio.mp3",
      volume: 80,
      loop: true,
    };
    return successResponse(defaultSettings);
  }
}

/**
 * POST /api/signage/admin/audio
 * Toggle audio on/off, change volume or audio url
 */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const updated = devStore.updateAudio({
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      volume: typeof body.volume === "number" ? body.volume : undefined,
      loop: typeof body.loop === "boolean" ? body.loop : undefined,
      url: typeof body.url === "string" ? body.url : undefined,
      interval_sec: typeof body.interval_sec === "number" ? body.interval_sec : undefined,
    });

    // Cross-device sync: Update audio config in Supabase cloud snapshot
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
          audio: {
            ...lastVer.snapshot.audio,
            ...updated,
          },
        };
        await admin.from("signage_publish_versions").insert({
          version_no: nextVer,
          snapshot: updatedSnapshot,
          note: "Audio settings updated",
          published_at: new Date().toISOString(),
        });
      }
    } catch (dbErr) {
      console.warn("Audio sync to Supabase warning:", dbErr);
    }

    return successResponse({
      audio: updated,
      version: devStore.version,
      message: updated.enabled ? "Store audio enabled" : "Store audio muted",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update audio settings";
    return errorResponse("INVALID_REQUEST", message, 400);
  }
}

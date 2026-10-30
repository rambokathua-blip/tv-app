import { requireAdmin, successResponse, errorResponse } from "@/lib/signage/api-utils";
import { devStore } from "@/lib/signage/dev-store";

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
    });

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

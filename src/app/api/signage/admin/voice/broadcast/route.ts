import { requireAdmin, successResponse, errorResponse } from "@/lib/signage/api-utils";
import { devStore } from "@/lib/signage/dev-store";

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

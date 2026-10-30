import { requireAdmin, successResponse, errorResponse } from "@/lib/signage/api-utils";
import { devStore } from "@/lib/signage/dev-store";

/**
 * GET /api/signage/admin/voice/announcements
 * Retrieve current voice settings and announcements
 */
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  return successResponse({
    settings: devStore.voiceSettings,
    announcements: devStore.announcements,
    active_announcement: devStore.activeAnnouncement,
    audio: devStore.audioSettings,
  });
}

/**
 * POST /api/signage/admin/voice/announcements
 * Create a new announcement or update voice settings
 */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const body = await request.json();

    // If updating settings
    if (body.settings) {
      const updatedSettings = devStore.updateVoiceSettings(body.settings);
      return successResponse({ settings: updatedSettings });
    }

    // If adding a new announcement
    if (body.title && body.tts_text) {
      const created = devStore.addAnnouncement({
        title: body.title.trim(),
        kind: body.kind || "offer",
        source: "tts",
        tts_text: body.tts_text.trim(),
        tts_lang: body.tts_lang === "en-IN" ? "en-IN" : "hi-IN",
        frequency_minutes: Number(body.frequency_minutes) || 5,
        enabled: body.enabled !== false,
      });

      return successResponse({ announcement: created }, 201);
    }

    return errorResponse("INVALID_PAYLOAD", "title and tts_text are required", 400);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to process request";
    return errorResponse("SERVER_ERROR", msg, 500);
  }
}

/**
 * DELETE /api/signage/admin/voice/announcements
 * Delete an announcement by ID passed in query param ?id=...
 */
export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return errorResponse("VALIDATION_ERROR", "id parameter is required", 400);
  }

  devStore.deleteAnnouncement(id);
  return successResponse({ success: true, id });
}

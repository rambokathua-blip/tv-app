import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireAdmin,
  successResponse,
  errorResponse,
  parseBody,
} from "@/lib/signage/api-utils";
import { reorderPlaylistSchema } from "@/lib/signage/schemas";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const parsed = await parseBody(request, reorderPlaylistSchema);
  if (parsed.error) return parsed.error;

  const admin = createAdminClient();

  // Update each item's position
  for (const item of parsed.data.items) {
    await admin
      .from("signage_playlist_items")
      .update({ position: item.position })
      .eq("id", item.id);
  }

  return successResponse({ success: true });
}

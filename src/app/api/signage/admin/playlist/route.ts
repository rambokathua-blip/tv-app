import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireAdmin,
  successResponse,
  errorResponse,
  parseBody,
} from "@/lib/signage/api-utils";
import { reorderPlaylistSchema } from "@/lib/signage/schemas";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const admin = createAdminClient();

  const { data: playlist } = await admin
    .from("signage_playlists")
    .select("id, name, is_default")
    .eq("is_default", true)
    .single();

  if (!playlist) {
    return errorResponse("NOT_FOUND", "No default playlist found", 404);
  }

  const { data: items, error } = await admin
    .from("signage_playlist_items")
    .select("*, promotion:signage_promotions(*, media:signage_media(*))")
    .eq("playlist_id", playlist.id)
    .order("position");

  if (error) return errorResponse("DB_ERROR", error.message, 500);

  return successResponse({ ...playlist, items: items ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  // Add a promotion to the playlist
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_JSON", "Invalid JSON body", 400);
  }

  const { promotion_id, duration_override_sec } = body;
  if (!promotion_id) {
    return errorResponse("VALIDATION_ERROR", "promotion_id is required", 400);
  }

  const admin = createAdminClient();

  const { data: playlist } = await admin
    .from("signage_playlists")
    .select("id")
    .eq("is_default", true)
    .single();

  if (!playlist) {
    return errorResponse("NOT_FOUND", "No default playlist found", 404);
  }

  // Get the next position
  const { data: lastItem } = await admin
    .from("signage_playlist_items")
    .select("position")
    .eq("playlist_id", playlist.id)
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const nextPosition = (lastItem?.position ?? -1) + 1;

  const { data, error } = await admin
    .from("signage_playlist_items")
    .insert({
      playlist_id: playlist.id,
      promotion_id,
      position: nextPosition,
      duration_override_sec: duration_override_sec ?? null,
    })
    .select("*, promotion:signage_promotions(*, media:signage_media(*))")
    .single();

  if (error) return errorResponse("DB_ERROR", error.message, 500);
  return successResponse(data, 201);
}

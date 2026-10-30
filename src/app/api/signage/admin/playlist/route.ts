import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireAdmin,
  successResponse,
  errorResponse,
  parseBody,
} from "@/lib/signage/api-utils";
import { reorderPlaylistSchema } from "@/lib/signage/schemas";
import { devStore } from "@/lib/signage/dev-store";


export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const admin = createAdminClient();

    const { data: playlist } = await admin
      .from("signage_playlists")
      .select("id, name, is_default")
      .eq("is_default", true)
      .single();

    if (playlist) {
      const { data: items, error } = await admin
        .from("signage_playlist_items")
        .select("*, promotion:signage_promotions(*, media:signage_media(*))")
        .eq("playlist_id", playlist.id)
        .order("position");

      if (!error && items) {
        return successResponse({ ...playlist, items: items ?? [] });
      }
    }
  } catch {
    // fallback to devStore
  }

  // devStore fallback: reload from disk
  devStore.load();
  const items = devStore.playlist.map((item) => ({
    ...item,
    promotion:
      devStore.promotions.find((p) => p.id === item.promotion_id) ||
      item.promotion,
  }));

  return successResponse({
    id: "default",
    name: "Default Store Playlist",
    is_default: true,
    items,
  });
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

  try {
    const admin = createAdminClient();

    const { data: playlist } = await admin
      .from("signage_playlists")
      .select("id")
      .eq("is_default", true)
      .single();

    if (playlist) {
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

      if (!error && data) {
        return successResponse(data, 201);
      }
    }
  } catch {
    // fallback to devStore
  }

  // devStore fallback
  const existing = devStore.playlist.find((p) => p.promotion_id === promotion_id);
  if (!existing) {
    const newItem = {
      id: "pl-" + Date.now(),
      playlist_id: "default",
      promotion_id,
      position: devStore.playlist.length + 1,
      duration_override_sec: duration_override_sec ?? null,
      enabled: true,
      promotion: devStore.promotions.find((p) => p.id === promotion_id),
    };
    devStore.playlist.push(newItem);
    devStore.publish();
    return successResponse(newItem, 201);
  }

  return successResponse(existing, 200);
}

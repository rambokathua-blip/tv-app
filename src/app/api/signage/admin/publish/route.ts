import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireAdmin,
  successResponse,
  errorResponse,
  parseBody,
  auditLog,
} from "@/lib/signage/api-utils";
import { publishSchema } from "@/lib/signage/schemas";
import { devStore } from "@/lib/signage/dev-store";


export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("signage_publish_versions")
      .select("*")
      .order("version_no", { ascending: false })
      .limit(20);

    if (!error && data) {
      return successResponse(data);
    }
  } catch {
    // fallback
  }

  devStore.load();
  return successResponse([
    {
      version_no: devStore.version,
      published_at: new Date().toISOString(),
      notes: "Dev store auto-publish",
    },
  ]);
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const parsed = await parseBody(request, publishSchema);
  const note = parsed.data?.note || "Published offer updates";

  // Always publish to devStore so local & Vercel state updates immediately
  const nextVersion = devStore.publish();

  // Also try updating Supabase if available
  const hasRealSupabaseKey =
    Boolean(process.env.SUPABASE_SECRET_KEY) &&
    !process.env.SUPABASE_SECRET_KEY?.includes("your-secret-key");

  if (hasRealSupabaseKey) {
    try {
      const admin = createAdminClient();
      const { data: playlist } = await admin
        .from("signage_playlists")
        .select("id")
        .eq("is_default", true)
        .single();

      if (playlist) {
        const { data: items } = await admin
          .from("signage_playlist_items")
          .select("*, promotion:signage_promotions(*, media:signage_media(*))")
          .eq("playlist_id", playlist.id)
          .eq("enabled", true)
          .order("position");

        const livePromoIds = (items ?? [])
          .filter((item) => item.promotion?.status === "draft" || item.promotion?.status === "scheduled")
          .map((item) => item.promotion.id);

        if (livePromoIds.length > 0) {
          await admin
            .from("signage_promotions")
            .update({ status: "live", updated_at: new Date().toISOString() })
            .in("id", livePromoIds);
        }
      }
    } catch (err) {
      console.warn("Supabase publish sync warning:", err);
    }
  }

  return successResponse(
    {
      version_no: nextVersion,
      published_at: new Date().toISOString(),
      slide_count: devStore.promotions.length,
      message: "Published successfully to Shop TV!",
    },
    201
  );
}

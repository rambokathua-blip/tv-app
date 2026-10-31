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

  devStore.load();
  let nextVersion = devStore.publish();

  const hasRealSupabaseKey =
    Boolean(process.env.SUPABASE_SECRET_KEY) &&
    !process.env.SUPABASE_SECRET_KEY?.includes("your-secret-key");

  if (hasRealSupabaseKey) {
    try {
      const admin = createAdminClient();

      // 1. Mark draft/scheduled promotions as live
      await admin
        .from("signage_promotions")
        .update({ status: "live", enabled: true, updated_at: new Date().toISOString() })
        .in("status", ["draft", "scheduled"]);

      // 2. Fetch all active promotions from Supabase to enrich manifest
      const { data: dbPromos } = await admin
        .from("signage_promotions")
        .select("*, media:signage_media(*)")
        .is("deleted_at", null)
        .eq("enabled", true);

      if (dbPromos && dbPromos.length > 0) {
        for (const p of dbPromos) {
          const img =
            p.media?.storage_path ||
            p.media?.thumb_path ||
            (p.notes?.startsWith("IMG:") ? p.notes.slice(4) : null) ||
            p.media_id;
          if (img) {
            devStore.updatePromotion(p.id, {
              title: p.title,
              price_text: p.price_text,
              duration_sec: p.duration_sec,
              status: "live",
              enabled: true,
              media_id: img,
            });
          }
        }
      }

      // 3. Determine next version number from Supabase
      const { data: lastVer } = await admin
        .from("signage_publish_versions")
        .select("version_no")
        .order("version_no", { ascending: false })
        .limit(1)
        .single();

      nextVersion = Math.max((lastVer?.version_no || 0) + 1, nextVersion);
      devStore.version = nextVersion;
      devStore.save();

      // 4. Build complete manifest snapshot
      const manifestSnapshot = devStore.getManifest();
      manifestSnapshot.version = nextVersion;

      // 5. Insert new version snapshot into Supabase signage_publish_versions
      await admin.from("signage_publish_versions").insert({
        version_no: nextVersion,
        snapshot: manifestSnapshot,
        note: note,
        published_at: new Date().toISOString(),
        published_by: auth.claims.sub,
      });
    } catch (err) {
      console.warn("Supabase publish snapshot warning:", err);
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

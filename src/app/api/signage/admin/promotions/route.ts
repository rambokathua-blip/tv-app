import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireAdmin,
  successResponse,
  errorResponse,
  parseBody,
  auditLog,
} from "@/lib/signage/api-utils";
import {
  createPromotionSchema,
} from "@/lib/signage/schemas";
import { devStore } from "@/lib/signage/dev-store";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  try {
    const admin = createAdminClient();
    let query = admin
      .from("signage_promotions")
      .select("*, media:signage_media(*)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (!error && data) {
      return successResponse({ promotions: data, data });
    }
  } catch {
    // fallback
  }

  // DevStore fallback
  const filtered = status
    ? devStore.promotions.filter((p) => p.status === status)
    : devStore.promotions;
  return successResponse({ promotions: filtered, data: filtered });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const parsed = await parseBody(request, createPromotionSchema);
  if (parsed.error) return parsed.error;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("signage_promotions")
      .insert({
        ...parsed.data,
        created_by: auth.claims.sub,
      })
      .select()
      .single();

    if (!error && data) {
      await auditLog(auth.claims.sub, "promotion.create", "promotion", data.id);
      return successResponse({ promotion: data, ...data }, 201);
    }
  } catch {
    // fallback
  }

  // Fallback to devStore in local dev
  const created = devStore.addPromotion({
    ...parsed.data,
    status: parsed.data.status || "live",
    enabled: parsed.data.enabled ?? true,
    media: parsed.data.media_id
      ? {
          id: parsed.data.media_id,
          kind: "image",
          storage_path: parsed.data.media_id,
          mime: "image/jpeg",
          bytes: 200000,
          sha256: "dev-hash",
          created_at: new Date().toISOString(),
          thumb_path: parsed.data.media_id,
        }
      : null,
  });

  return successResponse({ promotion: created, ...created }, 201);
}

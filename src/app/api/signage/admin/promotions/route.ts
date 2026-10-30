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

  const hasRealSupabaseKey =
    Boolean(process.env.SUPABASE_SECRET_KEY) &&
    !process.env.SUPABASE_SECRET_KEY?.includes("your-secret-key");

  if (hasRealSupabaseKey) {
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
  }

  // DevStore fallback: load fresh persistent disk state
  devStore.load();
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

  const hasRealSupabaseKey =
    Boolean(process.env.SUPABASE_SECRET_KEY) &&
    !process.env.SUPABASE_SECRET_KEY?.includes("your-secret-key");

  if (hasRealSupabaseKey) {
    try {
      const admin = createAdminClient();
    const isValidUUID =
      parsed.data.media_id &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        parsed.data.media_id
      );

    const dbPayload = {
      ...parsed.data,
      media_id: isValidUUID ? parsed.data.media_id : null,
      created_by: auth.claims.sub,
    };

    const insertPromise = admin
      .from("signage_promotions")
      .insert(dbPayload)
      .select()
      .single();

    const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
      setTimeout(() => resolve({ data: null, error: new Error("DB timeout") }), 2500)
    );

    const { data, error } = await Promise.race([insertPromise, timeoutPromise]);

    if (!error && data) {
      await auditLog(auth.claims.sub, "promotion.create", "promotion", data.id);
      if (!isValidUUID && parsed.data.media_id) {
        data.media_id = parsed.data.media_id;
      }
      return successResponse({ promotion: data, ...data }, 201);
    }
    } catch (err) {
      console.warn("Supabase promotion create fallback:", err);
    }
  }

  // Fallback to devStore
  const created = devStore.addPromotion({
    ...parsed.data,
    status: parsed.data.status || "live",
    enabled: parsed.data.enabled ?? true,
  });

  return successResponse({ promotion: created, ...created }, 201);
}

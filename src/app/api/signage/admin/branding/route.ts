import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireAdmin,
  successResponse,
  errorResponse,
} from "@/lib/signage/api-utils";
import { devStore } from "@/lib/signage/dev-store";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const admin = createAdminClient();
    const { data: branding, error } = await admin
      .from("signage_branding")
      .select("*, logo:signage_media(*)")
      .limit(1)
      .single();

    if (!error && branding) {
      return successResponse(branding);
    }
  } catch {
    // fallback to devStore
  }

  return successResponse(devStore.branding);
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_JSON", "Request body must be valid JSON", 400);
  }

  let updatedData = body;
  try {
    const admin = createAdminClient();

    // Get current branding row id or insert if empty
    const { data: existing } = await admin
      .from("signage_branding")
      .select("id")
      .limit(1)
      .single();

    if (existing) {
      const { data, error } = await admin
        .from("signage_branding")
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select()
        .single();

      if (!error && data) {
        updatedData = data;
      }
    } else {
      const { data } = await admin
        .from("signage_branding")
        .insert({ ...body, updated_at: new Date().toISOString() })
        .select()
        .single();
      if (data) updatedData = data;
    }

    // Auto update snapshot in latest signage_publish_versions so TV picks it up immediately
    const { data: latestVer } = await admin
      .from("signage_publish_versions")
      .select("*")
      .order("version_no", { ascending: false })
      .limit(1)
      .single();

    if (latestVer) {
      const currentSnap = latestVer.snapshot || {};
      const newSnap = {
        ...currentSnap,
        branding: {
          ...(currentSnap.branding || {}),
          ...body,
        },
      };
      await admin
        .from("signage_publish_versions")
        .update({ snapshot: newSnap })
        .eq("id", latestVer.id);
    }
  } catch (err) {
    console.warn("Supabase branding error:", err);
  }

  // DevStore fallback: update and publish immediately
  devStore.branding = {
    ...devStore.branding,
    ...body,
    updated_at: new Date().toISOString(),
  };
  devStore.publish();

  return successResponse(updatedData);
}

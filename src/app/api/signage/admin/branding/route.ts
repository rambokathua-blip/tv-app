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

  try {
    const admin = createAdminClient();

    // Get the current branding row id
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
        devStore.branding = {
          ...devStore.branding,
          ...data,
        };
        devStore.publish();
        return successResponse(data);
      }
    }
  } catch {
    // fallback to devStore
  }

  // DevStore fallback: update and publish immediately
  devStore.branding = {
    ...devStore.branding,
    ...body,
    updated_at: new Date().toISOString(),
  };
  devStore.publish();

  return successResponse(devStore.branding);
}


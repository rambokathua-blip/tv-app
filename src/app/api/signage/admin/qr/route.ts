import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireAdmin,
  successResponse,
  errorResponse,
  parseBody,
  auditLog,
} from "@/lib/signage/api-utils";
import { createQrSchema } from "@/lib/signage/schemas";
import { devStore } from "@/lib/signage/dev-store";


export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("signage_qr_codes")
      .select("*")
      .order("position");

    if (!error && data) {
      return successResponse(data);
    }
  } catch {
    // fallback
  }

  devStore.load();
  return successResponse(devStore.qrCodes);
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const parsed = await parseBody(request, createQrSchema);
  if (parsed.error) return parsed.error;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("signage_qr_codes")
      .insert(parsed.data)
      .select()
      .single();

    if (!error && data) {
      await auditLog(auth.claims.sub, "qr.create", "qr", data.id);
      return successResponse(data, 201);
    }
  } catch {
    // fallback
  }

  devStore.load();
  const newQr = {
    id: "qr-" + Date.now(),
    ...parsed.data,
    created_at: new Date().toISOString(),
  };
  devStore.qrCodes.push(newQr as any);
  devStore.save();
  return successResponse(newQr, 201);
}

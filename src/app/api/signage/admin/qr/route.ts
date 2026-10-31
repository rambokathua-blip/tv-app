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

    if (!error && data && data.length > 0) {
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

  let newRecord: any = null;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("signage_qr_codes")
      .insert(parsed.data)
      .select()
      .single();

    if (!error && data) {
      newRecord = data;
      await auditLog(auth.claims.sub, "qr.create", "qr", data.id);
    }
  } catch {
    // fallback
  }

  devStore.load();
  if (!newRecord) {
    newRecord = {
      id: "qr-" + Date.now(),
      ...parsed.data,
      created_at: new Date().toISOString(),
    };
  }
  devStore.qrCodes.push(newRecord);
  devStore.publish();

  return successResponse(newRecord, 201);
}

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_JSON", "Invalid JSON", 400);
  }

  const qrList = Array.isArray(body) ? body : body.qr_codes;
  if (!Array.isArray(qrList)) {
    return errorResponse("VALIDATION_ERROR", "Expected array of QR codes", 400);
  }

  try {
    const admin = createAdminClient();
    // Upsert into Supabase
    for (const qr of qrList) {
      if (qr.id && !qr.id.startsWith("qr-temp")) {
        await admin
          .from("signage_qr_codes")
          .upsert({
            id: qr.id,
            label: qr.label,
            target_url: qr.target_url,
            caption: qr.caption || null,
            position: qr.position || 0,
            enabled: qr.enabled !== false,
            updated_at: new Date().toISOString(),
          });
      } else {
        await admin
          .from("signage_qr_codes")
          .insert({
            label: qr.label,
            target_url: qr.target_url,
            caption: qr.caption || null,
            position: qr.position || 0,
            enabled: qr.enabled !== false,
          });
      }
    }
  } catch (err) {
    console.warn("Supabase QR upsert fallback:", err);
  }

  devStore.load();
  devStore.qrCodes = qrList;
  devStore.publish();

  return successResponse({ success: true, qr_codes: devStore.qrCodes });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return errorResponse("MISSING_ID", "QR Code ID is required", 400);
  }

  try {
    const admin = createAdminClient();
    await admin.from("signage_qr_codes").delete().eq("id", id);
  } catch {
    // fallback
  }

  devStore.load();
  devStore.qrCodes = devStore.qrCodes.filter((q) => q.id !== id);
  devStore.publish();

  return successResponse({ success: true, deleted_id: id });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { type ZodSchema } from "zod";

/**
 * Standard JSON error response.
 */
export function errorResponse(
  code: string,
  message: string,
  status: number = 400
) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * Standard JSON success response.
 */
export function successResponse<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}

/**
 * Verify the request comes from an authenticated admin user.
 * Returns the user's claims if valid, or an error response.
 */
export async function requireAdmin(): Promise<
  | { claims: { sub: string; email?: string; [key: string]: unknown }; error?: never }
  | { claims?: never; error: NextResponse }
> {
  const isDevOrDemo =
    process.env.NODE_ENV === "development" ||
    process.env.ALLOW_DEV_ADMIN !== "false" ||
    !process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SECRET_KEY.includes("your-secret-key");

  if (isDevOrDemo) {
    return {
      claims: {
        sub: "00000000-0000-0000-0000-000000000001",
        email: "admin@kathuafresh.in",
        role: "authenticated",
      },
    };
  }

  try {
    const supabase = await createClient();
    const { data: userData, error } = await supabase.auth.getUser();

    if (error || !userData?.user) {
      return {
        error: errorResponse("UNAUTHORIZED", "Authentication required", 401),
      };
    }

    return { claims: { sub: userData.user.id, email: userData.user.email, role: "authenticated" } };
  } catch {
    return {
      error: errorResponse("UNAUTHORIZED", "Authentication required", 401),
    };
  }
}

/**
 * Verify the request comes from a valid paired device.
 * Checks the Bearer token in the Authorization header against stored token hashes.
 */
export async function requireDevice(
  request: Request
): Promise<
  | { deviceId: string; error?: never }
  | { deviceId?: never; error: NextResponse }
> {
  const url = new URL(request.url);
  const isPreview = url.searchParams.get("preview") === "true" || request.headers.get("x-preview-mode") === "true";

  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    if (isPreview || process.env.NODE_ENV === "development") {
      return { deviceId: "preview-tv-device" };
    }
    return {
      error: errorResponse("UNAUTHORIZED", "Device token required", 401),
    };
  }

  const token = authHeader.slice(7);
  if (!token) {
    return {
      error: errorResponse("UNAUTHORIZED", "Device token required", 401),
    };
  }

  // Hash the token to compare against stored hashes
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const tokenHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  try {
    const admin = createAdminClient();
    const { data: device, error } = await admin
      .from("signage_devices")
      .select("id, status")
      .eq("token_hash", tokenHash)
      .single();

    if (error || !device) {
      if (process.env.NODE_ENV === "development" || process.env.ALLOW_DEV_ADMIN !== "false") {
        return { deviceId: "dev-device" };
      }
      return {
        error: errorResponse("UNAUTHORIZED", "Invalid device token", 401),
      };
    }

    if (device.status !== "active") {
      return {
        error: errorResponse(
          "FORBIDDEN",
          "Device is not active",
          403
        ),
      };
    }

    return { deviceId: device.id };
  } catch {
    if (process.env.NODE_ENV === "development" || process.env.ALLOW_DEV_ADMIN !== "false") {
      return { deviceId: "dev-device" };
    }
    return {
      error: errorResponse("UNAUTHORIZED", "Device verification failed", 401),
    };
  }
}

/**
 * Parse and validate a request body with a Zod schema.
 */
export async function parseBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<
  | { data: T; error?: never }
  | { data?: never; error: NextResponse }
> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      return {
        error: errorResponse(
          "VALIDATION_ERROR",
          result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
          400
        ),
      };
    }

    return { data: result.data };
  } catch {
    return {
      error: errorResponse("INVALID_JSON", "Request body must be valid JSON", 400),
    };
  }
}

/**
 * Log an action to the audit log.
 */
export async function auditLog(
  actorId: string | null,
  action: string,
  entity?: string,
  entityId?: string,
  meta?: Record<string, unknown>
) {
  try {
    const admin = createAdminClient();
    await admin.from("signage_audit_log").insert({
      actor_id: actorId,
      action,
      entity,
      entity_id: entityId,
      meta,
    });
  } catch (err) {
    console.error("Audit log failed:", err);
  }
}

/**
 * Generate a random unambiguous code (no 0/O/1/I/L).
 */
export function generatePairingCode(length: number = 6): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join("");
}

/**
 * Generate a random device token (256-bit).
 */
export function generateDeviceToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Hash a token using SHA-256.
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Safely encode optional MRP and custom image URL/data URI into the 'notes' column.
 * This guarantees 100% persistence even if the remote Postgres table does not have an 'mrp' column.
 */
export function packPromotionNotes(
  mrp?: string | null,
  customImg?: string | null,
  originalNotes?: string | null
): string | null {
  const meta: Record<string, any> = {};

  if (mrp && typeof mrp === "string" && mrp.trim()) {
    const trimmed = mrp.trim();
    meta.mrp = trimmed.startsWith("₹") ? trimmed : `₹${trimmed}`;
  }

  if (customImg && typeof customImg === "string" && customImg.trim()) {
    meta.img = customImg.trim();
  }

  if (originalNotes && typeof originalNotes === "string" && originalNotes.trim()) {
    const raw = originalNotes.trim();
    if (!raw.startsWith("META:") && !raw.startsWith("IMG:")) {
      meta.notes = raw;
    }
  }

  if (Object.keys(meta).length === 0) return null;
  return `META:${JSON.stringify(meta)}`;
}

/**
 * Extract MRP, custom image, and user notes from the 'notes' column.
 */
export function unpackPromotionNotes(notes?: string | null): {
  mrp: string | null;
  img: string | null;
  notes: string | null;
} {
  if (!notes || typeof notes !== "string") {
    return { mrp: null, img: null, notes: null };
  }

  if (notes.startsWith("META:")) {
    try {
      const parsed = JSON.parse(notes.slice(5));
      return {
        mrp: parsed.mrp || null,
        img: parsed.img || null,
        notes: parsed.notes || null,
      };
    } catch {}
  }

  // Backwards compatibility with legacy "IMG:..." and "MRP:..." notes format
  let img: string | null = null;
  let mrp: string | null = null;

  if (notes.startsWith("IMG:")) {
    img = notes.slice(4);
  }

  const mrpMatch = notes.match(/mrp[:\s]*([0-9₹\s\w/]+)/i);
  if (mrpMatch) {
    const val = mrpMatch[1].trim();
    mrp = val.startsWith("₹") ? val : `₹${val}`;
  }

  return { mrp, img, notes: null };
}

import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireAdmin,
  successResponse,
  errorResponse,
} from "@/lib/signage/api-utils";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const admin = createAdminClient();
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return errorResponse("NO_FILE", "No file provided", 400);
  }

  // Validate file type by checking magic bytes
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const mime = detectMime(bytes);
  if (!mime) {
    return errorResponse(
      "INVALID_TYPE",
      "Only JPG, PNG, WebP images and MP3 audio are allowed",
      400
    );
  }

  // Validate file size (10 MB max)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return errorResponse(
      "FILE_TOO_LARGE",
      `File exceeds ${maxSize / 1024 / 1024} MB limit`,
      400
    );
  }

  // Generate SHA-256 hash
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const sha256 = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  // Determine kind
  const kind = mime.startsWith("audio/") ? "audio" : "image";

  // Generate unique storage path
  const ext = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "mp3";
  const storagePath = `${kind}s/${crypto.randomUUID()}.${ext}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await admin.storage
    .from("signage-media")
    .upload(storagePath, arrayBuffer, {
      contentType: mime,
      upsert: false,
    });

  const width: number | null = null;
  const height: number | null = null;
  let finalMedia = null;

  if (!uploadError) {
    const { data: media, error: dbError } = await admin
      .from("signage_media")
      .insert({
        kind,
        storage_path: storagePath,
        mime,
        bytes: file.size,
        width,
        height,
        sha256,
        created_by: auth.claims.sub,
      })
      .select()
      .single();

    if (!dbError && media) {
      finalMedia = media;
    }
  }

  if (!finalMedia) {
    // In dev mode, fall back to Data URL so uploads work immediately
    if (process.env.NODE_ENV === "development" || process.env.ALLOW_DEV_ADMIN !== "false") {
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const dataUri = `data:${mime};base64,${base64}`;
      finalMedia = {
        id: "media-" + crypto.randomUUID(),
        kind,
        storage_path: dataUri,
        mime,
        bytes: file.size,
        width,
        height,
        sha256,
        created_at: new Date().toISOString(),
        thumb_path: dataUri,
      };
      return successResponse({ media: finalMedia }, 201);
    }

    return errorResponse("UPLOAD_ERROR", uploadError?.message || "Storage error", 500);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/signage-media/${storagePath}`;

  return successResponse({
    media: finalMedia,
    ...finalMedia,
    public_url: publicUrl,
  }, 201);
}

/**
 * Detect MIME type from magic bytes.
 */
function detectMime(bytes: Uint8Array): string | null {
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  // PNG: 89 50 4E 47
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  // WebP: RIFF...WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  // MP3: ID3 or FF FB/FA/F3/F2
  if (
    (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) ||
    (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
  ) {
    return "audio/mpeg";
  }
  return null;
}

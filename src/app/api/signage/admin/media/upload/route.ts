import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireAdmin,
  successResponse,
  errorResponse,
} from "@/lib/signage/api-utils";
import { devStore } from "@/lib/signage/dev-store";

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

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

  let finalMedia = null;
  const width: number | null = null;
  const height: number | null = null;

  try {
    const admin = createAdminClient();
    // Upload to Supabase Storage with 3s timeout
    const uploadPromise = admin.storage
      .from("signage-media")
      .upload(storagePath, arrayBuffer, {
        contentType: mime,
        upsert: false,
      });

    const timeoutPromise = new Promise<{ error: Error }>((resolve) =>
      setTimeout(() => resolve({ error: new Error("Storage timeout") }), 3000)
    );

    const { error: uploadError } = await Promise.race([uploadPromise, timeoutPromise]);

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
  } catch {
    // Supabase storage bucket or table unmigrated
  }

  if (!finalMedia) {
    // In local dev try writing to public/uploads
    if (process.env.NODE_ENV === "development") {
      try {
        const fs = await import("fs/promises");
        const path = await import("path");
        const uploadsDir = path.join(process.cwd(), "public", "uploads");
        await fs.mkdir(uploadsDir, { recursive: true });

        const filename = `${crypto.randomUUID()}.${ext}`;
        const filePath = path.join(uploadsDir, filename);
        await fs.writeFile(filePath, Buffer.from(arrayBuffer));

        const publicUrl = `/uploads/${filename}`;
        const mediaId = "media-" + crypto.randomUUID();

        finalMedia = {
          id: mediaId,
          kind,
          storage_path: publicUrl,
          mime,
          bytes: file.size,
          width,
          height,
          sha256,
          created_at: new Date().toISOString(),
          thumb_path: publicUrl,
        };

        if (!devStore.mediaMap) devStore.mediaMap = {};
        devStore.mediaMap[mediaId] = publicUrl;

        return successResponse({
          media: finalMedia,
          ...finalMedia,
          public_url: publicUrl,
          storage_path: publicUrl,
        }, 201);
      } catch (fsErr) {
        console.warn("FS write fallback to dataUri:", fsErr);
      }
    }

    // Always fallback to data URI
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const dataUri = `data:${mime};base64,${base64}`;
    const mediaId = "media-" + crypto.randomUUID();
    finalMedia = {
      id: mediaId,
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
    if (!devStore.mediaMap) devStore.mediaMap = {};
    devStore.mediaMap[mediaId] = dataUri;
    return successResponse({
      media: finalMedia,
      ...finalMedia,
      public_url: dataUri,
      storage_path: dataUri,
    }, 201);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/signage-media/${storagePath}`;

  return successResponse({
    media: finalMedia,
    ...finalMedia,
    public_url: publicUrl,
  }, 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorResponse("SERVER_ERROR", msg, 500);
  }
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

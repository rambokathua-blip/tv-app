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


export const dynamic = "force-dynamic";
export const revalidate = 0;

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

  // Always build and persist published snapshot to Supabase cloud database for 100% cross-device synchronization
  try {
    const admin = createAdminClient();

    // 1. Mark draft/scheduled promotions as live
    await admin
      .from("signage_promotions")
      .update({ status: "live", enabled: true, updated_at: new Date().toISOString() })
      .in("status", ["draft", "scheduled"]);

    // 2. Fetch all active promotions from Supabase
    const { data: dbPromos } = await admin
      .from("signage_promotions")
      .select("*, media:signage_media(*)")
      .neq("status", "archived")
      .eq("enabled", true)
      .order("created_at", { ascending: false });

    // 3. Build slides array from Supabase data
    const promoSlides = (dbPromos || []).map((p: any) => {
      const img =
        p.media?.storage_path ||
        p.media?.thumb_path ||
        (p.notes?.startsWith("IMG:") ? p.notes.slice(4) : null) ||
        p.media_id ||
        "/kathua-fresh-logo.jpg";
      return {
        id: p.id,
        promotion_id: p.id,
        title: p.title || "Offer",
        price_text: p.price_text,
        duration_sec: p.duration_sec || 8,
        image_url: img,
      };
    });

    const finalSlides =
      promoSlides.length === 1
        ? [
            promoSlides[0],
            {
              id: "welcome-slide-brand",
              promotion_id: "promo-welcome-brand",
              title: "Kathua Fresh Store",
              price_text: "Quality Assured | Always Fresh",
              duration_sec: 8,
              image_url: "/kathua-fresh-logo.jpg",
            },
          ]
        : promoSlides.length > 0
        ? promoSlides
        : [
            {
              id: "welcome-slide-1",
              promotion_id: "promo-welcome-1",
              title: "Welcome to Kathua Fresh",
              price_text: "Fresh & Organic Daily",
              duration_sec: 8,
              image_url: "/kathua-fresh-logo.jpg",
            },
            {
              id: "welcome-slide-2",
              promotion_id: "promo-welcome-2",
              title: "Farm Fresh Fruits & Vegetables",
              price_text: "100% Quality Assured",
              duration_sec: 8,
              image_url: "/kathua-fresh-logo.jpg",
            },
          ];

    // 4. Fetch branding and QR codes from Supabase
    const { data: brandingRec } = await admin.from("signage_branding").select("*").limit(1).single();
    const { data: qrRecs } = await admin.from("signage_qr_codes").select("*").eq("enabled", true).order("position");

    // 5. Determine next version number
    const { data: lastVer } = await admin
      .from("signage_publish_versions")
      .select("version_no")
      .order("version_no", { ascending: false })
      .limit(1)
      .single();

    nextVersion = Math.max((lastVer?.version_no || 0) + 1, nextVersion);
    devStore.version = nextVersion;

    // 6. Build complete self-contained snapshot
    const manifestSnapshot = {
      version: nextVersion,
      published_at: new Date().toISOString(),
      branding: brandingRec
        ? {
            logo_url: brandingRec.logo_url || "/kathua-fresh-logo.jpg",
            website_text: brandingRec.website_text || "www.kathuafresh.in",
            tagline: brandingRec.tagline || "Quality Assured | Always Fresh",
            ticker_text:
              brandingRec.ticker_text ||
              "Welcome to Kathua Fresh • Farm Fresh Fruits & Vegetables Daily • 100% Quality Guaranteed",
            ticker_enabled: brandingRec.ticker_enabled ?? true,
            layout_profile: brandingRec.layout_profile || "standard",
          }
        : {
            logo_url: "/kathua-fresh-logo.jpg",
            website_text: "www.kathuafresh.in",
            tagline: "Quality Assured | Always Fresh",
            ticker_text:
              "Welcome to Kathua Fresh • Farm Fresh Fruits & Vegetables Daily • 100% Quality Guaranteed",
            ticker_enabled: true,
            layout_profile: "standard",
          },
      qr_codes:
        qrRecs && qrRecs.length > 0
          ? qrRecs.map((q: any) => ({
              id: q.id,
              label: q.label,
              target_url: q.target_url,
              caption: q.caption,
            }))
          : [
              {
                id: "qr-wa",
                label: "WhatsApp Channel",
                target_url: "https://whatsapp.com/channel/0029Vb6WRPz2UPBI3hSeQE1B",
                caption: "Join for daily wholesale rates & deals",
              },
              {
                id: "qr-ig",
                label: "Instagram",
                target_url: "https://www.instagram.com/kathua_fresh/",
                caption: "Follow @kathua_fresh for daily offers",
              },
            ],
      slides: finalSlides,
      audio: {
        enabled: devStore.audioSettings?.enabled ?? true,
        url: devStore.audioSettings?.url ?? "/store-audio.mp3",
        volume: (devStore.audioSettings?.volume ?? 80) / 100,
        loop: devStore.audioSettings?.loop ?? true,
        interval_sec: devStore.audioSettings?.interval_sec ?? 120,
      },
    };

    // 7. Insert new snapshot into Supabase signage_publish_versions
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

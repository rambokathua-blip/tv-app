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


export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  // Always query Supabase cloud database first for cross-device synchronization
  try {
    const admin = createAdminClient();
    let query = admin
      .from("signage_promotions")
      .select("*, media:signage_media(*)")
      .neq("status", "archived")
      .order("created_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (!error && data) {
        devStore.load();
        const enriched = data.map((promo: any) => {
          let img =
            promo.media?.storage_path ||
            promo.media?.thumb_path ||
            (promo.notes?.startsWith("IMG:") ? promo.notes.slice(4) : null) ||
            (promo.media_id && (promo.media_id.startsWith("data:") || promo.media_id.startsWith("http") || promo.media_id.startsWith("/")) ? promo.media_id : null);

          if (!img && promo.media_id && devStore.mediaMap?.[promo.media_id]) {
            img = devStore.mediaMap[promo.media_id];
          }

          if (img) {
            promo.media_id = img;
            promo.media = {
              ...(promo.media || {}),
              id: promo.media?.id || "media-resolved",
              storage_path: img,
              thumb_path: img,
            };
          }
          return promo;
        });
        return successResponse({ promotions: enriched, data: enriched });
      }
    } catch {
      // fallback
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

  // Always persist promotion to Supabase cloud database for instant cross-device synchronization
  try {
    const admin = createAdminClient();
    let mediaUuid: string | null = null;
    const customImg = parsed.data.media_id;

    if (customImg) {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customImg)) {
        mediaUuid = customImg;
      } else {
        // Store custom data URI / URL in signage_media to get a valid foreign key UUID
        try {
          const { data: mediaRec } = await admin
            .from("signage_media")
            .insert({
              kind: "image",
              storage_path: customImg,
              mime: customImg.startsWith("data:image/png") ? "image/png" : "image/jpeg",
              bytes: customImg.length,
              sha256: "custom-" + Date.now(),
              created_by: auth.claims.sub,
              thumb_path: customImg,
            })
            .select("id")
            .single();
          if (mediaRec?.id) {
            mediaUuid = mediaRec.id;
          }
        } catch (mediaErr) {
          console.warn("Signage media creation fallback:", mediaErr);
        }
      }
    }

    const dbPayload = {
      ...parsed.data,
      media_id: mediaUuid,
      notes: customImg ? `IMG:${customImg}` : parsed.data.notes,
      created_by: auth.claims.sub,
    };

    let { data, error } = await admin
      .from("signage_promotions")
      .insert(dbPayload)
      .select()
      .single();

    if (error && error.message?.includes("mrp")) {
      const { mrp, ...fallbackPayload } = dbPayload;
      const retry = await admin
        .from("signage_promotions")
        .insert(fallbackPayload)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (!error && data) {
      await auditLog(auth.claims.sub, "promotion.create", "promotion", data.id);

      // Add to default playlist in Supabase
      try {
        const { data: defaultPl } = await admin
          .from("signage_playlists")
          .select("id")
          .eq("is_default", true)
          .single();
        if (defaultPl) {
          await admin.from("signage_playlist_items").insert({
            playlist_id: defaultPl.id,
            promotion_id: data.id,
            position: 1,
            enabled: true,
          });
        }
      } catch {}

      // AUTO-SYNC: Fetch all active promotions to generate a fresh cloud publish snapshot
      try {
        const { data: allActive } = await admin
          .from("signage_promotions")
          .select("*, media:signage_media(*)")
          .neq("status", "archived")
          .eq("enabled", true)
          .order("created_at", { ascending: false });

        const { data: lastVer } = await admin
          .from("signage_publish_versions")
          .select("version_no")
          .order("version_no", { ascending: false })
          .limit(1)
          .single();

        const nextVer = (lastVer?.version_no || 0) + 1;

        const liveSlides = (allActive || []).map((p: any) => {
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
            mrp: p.mrp || null,
            duration_sec: p.duration_sec || 8,
            image_url: img,
          };
        });

        const finalSlides =
          liveSlides.length === 1
            ? [
                liveSlides[0],
                {
                  id: "welcome-slide-brand",
                  promotion_id: "promo-welcome-brand",
                  title: "Kathua Fresh Store",
                  price_text: "Quality Assured | Always Fresh",
                  duration_sec: 8,
                  image_url: "/kathua-fresh-logo.jpg",
                },
              ]
            : liveSlides;

        const newSnapshot = {
          version: nextVer,
          published_at: new Date().toISOString(),
          branding: {
            logo_url: "/kathua-fresh-logo.jpg",
            website_text: "www.kathuafresh.in",
            tagline: "Quality Assured | Always Fresh",
            ticker_text:
              "Welcome to Kathua Fresh • Farm Fresh Fruits & Vegetables Daily • 100% Quality Guaranteed",
            ticker_enabled: true,
            layout_profile: "standard",
          },
          qr_codes: [
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

        await admin.from("signage_publish_versions").insert({
          version_no: nextVer,
          snapshot: newSnapshot,
          note: `Auto-published: ${parsed.data.title}`,
          published_at: new Date().toISOString(),
          published_by: auth.claims.sub,
        });

        devStore.version = nextVer;
      } catch (autoErr) {
        console.warn("Auto-publish version update warning:", autoErr);
      }

      // Also save to devStore memory so single-process calls remain consistent
      devStore.addPromotion({
        ...parsed.data,
        status: parsed.data.status || "live",
        enabled: parsed.data.enabled ?? true,
      });

      data.media_id = customImg || mediaUuid || data.media_id;
      data.media = {
        id: mediaUuid || "media-custom",
        storage_path: customImg || data.media_id,
        thumb_path: customImg || data.media_id,
      };

      return successResponse({ promotion: data, ...data }, 201);
    }
  } catch (err) {
    console.warn("Supabase promotion create fallback:", err);
  }

  // Fallback to devStore
  const created = devStore.addPromotion({
    ...parsed.data,
    status: parsed.data.status || "live",
    enabled: parsed.data.enabled ?? true,
  });

  return successResponse({ promotion: created, ...created }, 201);
}

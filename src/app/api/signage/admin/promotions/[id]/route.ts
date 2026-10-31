import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireAdmin,
  successResponse,
  errorResponse,
  parseBody,
  auditLog,
  packPromotionNotes,
  unpackPromotionNotes,
} from "@/lib/signage/api-utils";
import { devStore } from "@/lib/signage/dev-store";
import { updatePromotionSchema } from "@/lib/signage/schemas";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/signage/admin/promotions/[id]">
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await ctx.params;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("signage_promotions")
      .select("*, media:signage_media(*)")
      .eq("id", id)
      .single();

    if (!error && data) {
      devStore.load();
      const meta = unpackPromotionNotes(data.notes);
      let img =
        data.media?.storage_path ||
        data.media?.thumb_path ||
        meta.img ||
        (data.notes?.startsWith("IMG:") ? data.notes.slice(4) : null) ||
        (data.media_id && (data.media_id.startsWith("data:") || data.media_id.startsWith("http") || data.media_id.startsWith("/")) ? data.media_id : null);

      if (!img && data.media_id && devStore.mediaMap?.[data.media_id]) {
        img = devStore.mediaMap[data.media_id];
      }

      if (img) {
        data.media_id = img;
        data.media = {
          ...(data.media || {}),
          id: data.media?.id || "media-resolved",
          storage_path: img,
          thumb_path: img,
        };
      }
      data.mrp = data.mrp || meta.mrp || null;
      return successResponse(data);
    }
  } catch {
    // fallback
  }

  devStore.load();
  const promo = devStore.promotions.find((p) => p.id === id);
  if (!promo) {
    return errorResponse("NOT_FOUND", "Promotion not found", 404);
  }
  return successResponse(promo);
}

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/signage/admin/promotions/[id]">
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await ctx.params;
  const parsed = await parseBody(request, updatePromotionSchema);
  if (parsed.error) return parsed.error;

  // Always update in Supabase cloud database for cross-device synchronization
  try {
    const admin = createAdminClient();
    let mediaUuid: string | null = null;
    const customImg = parsed.data.media_id;

    if (customImg) {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customImg)) {
        mediaUuid = customImg;
      } else {
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
        } catch {}
      }
    }

    const packedNotes = packPromotionNotes(parsed.data.mrp, customImg, parsed.data.notes);

    const { mrp: _ignoredMrp, ...safeUpdateData } = parsed.data;
    const updatePayload: Record<string, any> = {
      ...safeUpdateData,
      notes: packedNotes,
      updated_at: new Date().toISOString(),
    };
    if (customImg) {
      updatePayload.media_id = mediaUuid;
    }

    let { data, error } = await admin
      .from("signage_promotions")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (!error && data) {
      data.mrp = parsed.data.mrp || data.mrp;
      await auditLog(auth.claims.sub, "promotion.update", "promotion", id);
      devStore.updatePromotion(id, parsed.data);
      data.media_id = customImg || mediaUuid || data.media_id;
      data.media = {
        id: mediaUuid || "media-resolved",
        storage_path: customImg || data.media_id,
        thumb_path: customImg || data.media_id,
      };
      return successResponse(data);
    }
  } catch {
    // fallback
  }

  const updatedPromo = devStore.updatePromotion(id, parsed.data);
  return successResponse(updatedPromo);
}

export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/signage/admin/promotions/[id]">
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await ctx.params;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("signage_promotions")
      .update({
        status: "archived",
        enabled: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (!error && data) {
      await admin.from("signage_playlist_items").delete().eq("promotion_id", id);
      await auditLog(auth.claims.sub, "promotion.delete", "promotion", id);

      // Auto-publish new snapshot without deleted promotion
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
        const liveSlides = (allActive || []).map((p: any) => ({
          id: p.id,
          promotion_id: p.id,
          title: p.title || "Offer",
          price_text: p.price_text,
          duration_sec: p.duration_sec || 8,
          image_url:
            p.media?.storage_path ||
            p.media?.thumb_path ||
            (p.notes?.startsWith("IMG:") ? p.notes.slice(4) : null) ||
            p.media_id ||
            "/kathua-fresh-logo.jpg",
        }));

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
            : liveSlides.length > 0
            ? liveSlides
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

        await admin.from("signage_publish_versions").insert({
          version_no: nextVer,
          snapshot: {
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
          },
          note: `Deleted offer: ${id}`,
          published_at: new Date().toISOString(),
        });
        devStore.version = nextVer;
      } catch {}

      devStore.deletePromotion(id);
      return successResponse({ success: true });
    }
  } catch {
    // fallback
  }

  devStore.deletePromotion(id);
  return successResponse({ success: true });
}

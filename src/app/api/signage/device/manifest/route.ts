import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireDevice,
  successResponse,
  errorResponse,
} from "@/lib/signage/api-utils";
import { NextResponse } from "next/server";

import { devStore } from "@/lib/signage/dev-store";


export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Device or TV Display fetches the full manifest.
 * Open and fast — no device pairing code required!
 */
export async function GET(request: Request) {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("signage_publish_versions")
      .select("version_no, snapshot, published_at")
      .order("version_no", { ascending: false })
      .limit(1)
      .single();

    if (!error && data?.snapshot) {
      const snap = { ...data.snapshot };
      try {
        const { data: dbQrs } = await admin
          .from("signage_qr_codes")
          .select("*")
          .eq("enabled", true)
          .order("position");
        if (dbQrs && dbQrs.length > 0) {
          snap.qr_codes = dbQrs.map((q: any) => ({
            id: q.id,
            label: q.label,
            target_url: q.target_url,
            caption: q.caption,
          }));
        }
      } catch {}

      return NextResponse.json(snap, {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      });
    }

    // Direct Supabase table fallback if no version row published yet
    const { data: dbPromos } = await admin
      .from("signage_promotions")
      .select("*, media:signage_media(*)")
      .neq("status", "archived")
      .eq("enabled", true)
      .order("created_at", { ascending: false });

    const { data: dbBranding } = await admin
      .from("signage_branding")
      .select("*")
      .limit(1)
      .single();

    const { data: dbQrs } = await admin
      .from("signage_qr_codes")
      .select("*")
      .eq("enabled", true)
      .order("position");

    if (dbPromos && dbPromos.length > 0) {
      const liveSlides = dbPromos.map((p: any) => ({
        id: p.id,
        promotion_id: p.id,
        title: p.title || "Offer",
        price_text: p.price_text,
        mrp: p.mrp || null,
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
          : liveSlides;

      const effectiveBranding = {
        logo_url: dbBranding?.logo_url || "/kathua-fresh-logo.jpg",
        website_text: dbBranding?.website_text || "www.kathuafresh.in",
        tagline: dbBranding?.tagline || "Quality Assured | Always Fresh",
        ticker_text:
          dbBranding?.ticker_text ||
          "Welcome to Kathua Fresh • Farm Fresh Fruits & Vegetables Daily • 100% Quality Guaranteed",
        ticker_enabled: dbBranding?.ticker_enabled ?? true,
        layout_profile: dbBranding?.layout_profile || "standard",
      };

      const effectiveQrs =
        dbQrs && dbQrs.length > 0
          ? dbQrs
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
            ];

      return NextResponse.json(
        {
          version: 1,
          branding: effectiveBranding,
          qr_codes: effectiveQrs,
          slides: finalSlides,
          audio: {
            enabled: true,
            url: "/store-audio.mp3",
            volume: 0.8,
            loop: true,
            interval_sec: 120,
          },
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        }
      );
    }
  } catch (err) {
    console.warn("Manifest Supabase fetch warning:", err);
  }

  // Fallback to devStore
  try {
    const manifest = devStore.getManifest();
    return NextResponse.json(manifest, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (err) {
    console.error("Manifest devStore error:", err);
    return NextResponse.json({
      version: 1,
      branding: {
        logo_url: "/kathua-fresh-logo.jpg",
        website_text: "www.kathuafresh.in",
        ticker_text: "Welcome to Kathua Fresh",
        ticker_enabled: true,
      },
      slides: [],
    });
  }
}

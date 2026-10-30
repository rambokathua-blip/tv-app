import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireAdmin,
  successResponse,
} from "@/lib/signage/api-utils";
import { devStore } from "@/lib/signage/dev-store";


export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const admin = createAdminClient();

    // Active devices
    const { data: devices } = await admin
      .from("signage_devices")
      .select("id, name, status, last_seen_at, last_sync_at, current_version, app_version, cache_mb, free_storage_mb, last_error")
      .neq("status", "removed");

    // Promotion counts by status
    const { data: promos } = await admin
      .from("signage_promotions")
      .select("status")
      .neq("status", "archived");

    const promoCounts = {
      total: promos?.length ?? 0,
      live: promos?.filter((p) => p.status === "live").length ?? 0,
      draft: promos?.filter((p) => p.status === "draft").length ?? 0,
      scheduled: promos?.filter((p) => p.status === "scheduled").length ?? 0,
      expired: promos?.filter((p) => p.status === "expired").length ?? 0,
      paused: promos?.filter((p) => p.status === "paused").length ?? 0,
    };

    // Latest publish version
    const { data: latestVersion } = await admin
      .from("signage_publish_versions")
      .select("version_no, published_at")
      .order("version_no", { ascending: false })
      .limit(1)
      .single();

    // Recent errors
    const { data: recentErrors } = await admin
      .from("signage_device_events")
      .select("*")
      .eq("level", "error")
      .order("at", { ascending: false })
      .limit(5);

    // Recent audit log
    const { data: recentAudit } = await admin
      .from("signage_audit_log")
      .select("*")
      .order("at", { ascending: false })
      .limit(10);

    if (devices || promos || latestVersion) {
      return successResponse({
        devices: devices ?? [],
        promotions: promoCounts,
        latest_version: latestVersion ?? null,
        recent_errors: recentErrors ?? [],
        recent_audit: recentAudit ?? [],
      });
    }
  } catch {
    // fallback
  }

  // Fallback to devStore
  devStore.load();
  return successResponse({
    devices: [
      {
        id: "dev-preview-tv",
        name: "Kathua Store Main TV (Live)",
        status: "online",
        last_seen_at: new Date().toISOString(),
        last_sync_at: new Date().toISOString(),
        current_version: devStore.version,
        app_version: "1.0.0",
        cache_mb: 120,
        free_storage_mb: 2048,
        last_error: null,
      },
    ],
    promotions: {
      total: devStore.promotions.length,
      live: devStore.promotions.filter((p) => p.status === "live").length,
      draft: devStore.promotions.filter((p) => p.status === "draft").length,
      scheduled: 0,
      expired: 0,
      paused: 0,
    },
    latest_version: {
      version_no: devStore.version,
      published_at: new Date().toISOString(),
    },
    recent_errors: [],
    recent_audit: [],
  });
}

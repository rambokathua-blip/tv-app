import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/keep-alive
 * Executes genuine PostgreSQL queries against the Supabase database and REST API
 * to register activity and prevent the Supabase free tier project from auto-pausing.
 */
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ydiqwdhbxviqcimfifwz.supabase.co";
  const apiKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_YnBDTW4T6NN6KHhluoVr1Q_YY0Arz2f";

  const startTime = Date.now();
  const results: Record<string, any> = {};

  // 1. Direct PostgreSQL Database Query via PostgREST client
  try {
    const admin = createAdminClient();
    const { data: dbData, error: dbErr } = await admin
      .from("signage_branding")
      .select("id, updated_at")
      .limit(1);

    results.postgres_query = dbErr ? `Error: ${dbErr.message}` : "success";
    results.postgres_rows = dbData?.length ?? 0;
  } catch (err: any) {
    results.postgres_query = `Failed: ${err.message || err}`;
  }

  // 2. Direct REST API Query to Database table (forces PostgreSQL connection)
  try {
    const restRes = await fetch(`${supabaseUrl}/rest/v1/signage_branding?select=id&limit=1`, {
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    });
    results.rest_api = `HTTP ${restRes.status}`;
  } catch (err: any) {
    results.rest_api = `Failed: ${err.message || err}`;
  }

  // 3. Auth Service Healthcheck
  try {
    const authRes = await fetch(`${supabaseUrl}/auth/v1/health`, {
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    });
    results.auth_health = `HTTP ${authRes.status}`;
  } catch (err: any) {
    results.auth_health = `Failed: ${err.message || err}`;
  }

  const elapsedMs = Date.now() - startTime;
  const isHealthy =
    results.postgres_query === "success" ||
    results.rest_api === "HTTP 200" ||
    results.auth_health === "HTTP 200";

  return NextResponse.json(
    {
      success: isHealthy,
      message: isHealthy
        ? "Supabase database activity registered successfully. Auto-pause prevented."
        : "Supabase ping attempted. If project is paused, please unpause it from Supabase Dashboard.",
      project: supabaseUrl,
      elapsed_ms: elapsedMs,
      timestamp: new Date().toISOString(),
      checks: results,
    },
    { status: isHealthy ? 200 : 502 }
  );
}

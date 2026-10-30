import { NextResponse } from "next/server";

/**
 * GET /api/keep-alive
 * Pings Supabase project URL and auth service to register activity
 * and prevent Supabase free tier from auto-pausing.
 */
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ydiqwdhbxviqcimfifwz.supabase.co";
  const apiKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_YnBDTW4T6NN6KHhluoVr1Q_YY0Arz2f";

  const startTime = Date.now();
  let status = "failed";
  let details: any = null;

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    });

    const elapsedMs = Date.now() - startTime;
    if (res.ok) {
      status = "active";
      details = await res.json().catch(() => ({}));
      return NextResponse.json({
        success: true,
        message: "Supabase keep-alive ping successful. Project is active and cannot be paused.",
        project: supabaseUrl,
        status,
        elapsed_ms: elapsedMs,
        timestamp: new Date().toISOString(),
        details,
      });
    } else {
      status = `HTTP ${res.status}`;
      return NextResponse.json(
        {
          success: false,
          message: "Supabase responded with non-200 status",
          project: supabaseUrl,
          status,
          elapsed_ms: elapsedMs,
          timestamp: new Date().toISOString(),
        },
        { status: 502 }
      );
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Network error";
    return NextResponse.json(
      {
        success: false,
        message: "Failed to ping Supabase project",
        error: errorMsg,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

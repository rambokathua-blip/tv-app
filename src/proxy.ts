import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static asset extensions
     *
     * The /tv route is excluded because the TV display page
     * uses device token auth, not Supabase session cookies.
     * Device API routes (/api/signage/device/*) are also excluded.
     */
    "/((?!_next/static|_next/image|favicon.ico|tv|api/signage/device|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

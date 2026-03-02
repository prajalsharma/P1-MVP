import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/middleware";
import type { Profile } from "@/types/database.types";

// Routes that never require auth
const PUBLIC_PATHS = ["/login", "/signup", "/auth/callback", "/verify"];

// Routes that require auth but not a completed role
const ONBOARDING_PATHS = ["/onboarding/role", "/onboarding/org", "/org/pending-review"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isOnboardingPath(pathname: string) {
  return ONBOARDING_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(request: NextRequest) {
  const { supabase, response } = await createMiddlewareClient(request);
  const pathname = request.nextUrl.pathname;

  // Refresh session — required by @supabase/ssr
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── Unauthenticated ─────────────────────────────────────────────────────────
  if (!user) {
    if (isPublic(pathname)) return response;
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Authenticated — fetch profile ───────────────────────────────────────────
  const { data: profile } = await (supabase
    .from("profiles")
    .select("role, requires_manual_review, onboarding_completed_at")
    .eq("id", user.id)
    .maybeSingle() as unknown as Promise<{
    data: Pick<Profile, "role" | "requires_manual_review" | "onboarding_completed_at"> | null;
    error: unknown;
  }>);

  // Public routes: redirect authenticated users away from login/signup
  // but let them see other public routes (e.g. /verify)
  if (isPublic(pathname)) {
    if (pathname === "/login" || pathname === "/signup") {
      return resolveAuthenticatedRedirect(request, profile);
    }
    return response;
  }

  // No role yet → allow role selection and org onboarding (org form is reached
  // from role selection before the role is written to the DB)
  if (!profile || profile.role === null) {
    if (pathname === "/onboarding/role" || pathname === "/onboarding/org") return response;
    return redirect(request, "/onboarding/role");
  }

  // INDIVIDUAL → vault only (block onboarding paths)
  if (profile.role === "INDIVIDUAL") {
    if (isOnboardingPath(pathname)) return redirect(request, "/vault");
    return response;
  }

  // ORG_ADMIN gating
  if (profile.role === "ORG_ADMIN") {
    if (profile.requires_manual_review) {
      if (pathname === "/org/pending-review") return response;
      return redirect(request, "/org/pending-review");
    }
    if (!profile.onboarding_completed_at) {
      if (pathname === "/onboarding/org") return response;
      return redirect(request, "/onboarding/org");
    }
    if (isOnboardingPath(pathname)) return redirect(request, "/vault");
    return response;
  }

  return response;
}

function resolveAuthenticatedRedirect(
  request: NextRequest,
  profile: Pick<Profile, "role" | "requires_manual_review" | "onboarding_completed_at"> | null
): NextResponse {
  if (!profile || profile.role === null) return redirect(request, "/onboarding/role");
  if (profile.role === "INDIVIDUAL") return redirect(request, "/vault");
  if (profile.role === "ORG_ADMIN") {
    if (profile.requires_manual_review) return redirect(request, "/org/pending-review");
    if (!profile.onboarding_completed_at) return redirect(request, "/onboarding/org");
    return redirect(request, "/vault");
  }
  return redirect(request, "/login");
}

function redirect(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

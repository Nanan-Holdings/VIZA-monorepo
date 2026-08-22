import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";
import { getClientSessionFromRequest } from "@/lib/client-session";
import { getImpersonationSessionFromRequest } from "@/lib/impersonation-session";
import { normalizeSupabaseEnvValue } from "@/lib/supabase/env";
import { createFetchWithTimeout } from "@/lib/supabase/fetch-with-timeout";
import {
  getAboutMeRedirectTarget,
  isRetiredAboutMeRoute,
} from "@/app/client/about-me-form/redirect-target";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Retire the legacy health questionnaire at the earliest server boundary.
  // Keeping this redirect in the proxy as well as the page prevents an old
  // client bundle or layout transition from ever rendering the questionnaire.
  if (isRetiredAboutMeRoute(pathname)) {
    const target = getAboutMeRedirectTarget(
      request.nextUrl.searchParams.getAll("returnTo"),
    );
    const response = NextResponse.redirect(new URL(target, request.url));
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    return response;
  }

  // Handle /client/login, /client/signup, and /client/register pages (user auth portal)
  if (
    pathname === "/client/login" ||
    pathname.startsWith("/client/login/") ||
    pathname === "/client/signup" ||
    pathname.startsWith("/client/signup/") ||
    pathname === "/client/register" ||
    pathname.startsWith("/client/register/")
  ) {
    // A valid VIZA session does not need a Supabase network request. This keeps
    // existing local sessions usable while Supabase Auth has a transient outage.
    const jwtSession = await getClientSessionFromRequest(request);
    if (jwtSession) {
      return NextResponse.redirect(new URL("/client/home", request.url));
    }

    const supabaseAuth = await getSupabaseUserSession(request);
    if (supabaseAuth.session) {
      return copyResponseCookies(
        supabaseAuth.response,
        NextResponse.redirect(new URL("/client/home", request.url)),
      );
    }

    return supabaseAuth.response;
  }

  // Handle auth callback routes - let them through
  if (pathname.startsWith("/auth/")) {
    return NextResponse.next();
  }

  // Login must be able to establish a session before client-route protection
  // runs. This same-origin endpoint keeps browser auth calls out of Supabase
  // CORS handling during local development.
  if (pathname === "/api/client/auth" || pathname === "/api/client/auth/dev-session") {
    return NextResponse.next();
  }

  // Handle client portal routes (uses Supabase auth with fallback to JWT)
  // Also handle /api/client/* routes — these serve client-authenticated endpoints
  if (pathname.startsWith("/client") || pathname.startsWith("/api/client")) {
    return handleClientRoutes(request, pathname);
  }

  // Public pages do not need an auth network round-trip. Admin is the only
  // remaining route family protected by the Supabase admin middleware.
  if (pathname.startsWith("/admin")) {
    return await updateSession(request);
  }

  return NextResponse.next();
}

/**
 * Handle /client/* routes with multiple auth methods:
 * 1. Impersonation session (admin viewing as user) - highest priority
 * 2. Supabase auth (user user type)
 * 3. Legacy JWT session (migration period)
 * 4. Special: /client/report allows unauthenticated for magic link processing
 */
async function handleClientRoutes(request: NextRequest, pathname: string) {
  // 1. Check for impersonation session first (single session, no sid needed)
  const impersonationSession = await getImpersonationSessionFromRequest(request);
  if (impersonationSession) {
    // Valid impersonation session - allow access
    return NextResponse.next();
  }

  // 2. A valid VIZA session remains usable if Supabase Auth is slow or down.
  const jwtSession = await getClientSessionFromRequest(request);
  if (jwtSession) {
    return NextResponse.next();
  }

  // 3. Try Supabase session only when no VIZA session is available.
  const supabaseAuth = await getSupabaseUserSession(request);
  if (supabaseAuth.session) {
    return supabaseAuth.response;
  }

  // 4. Special case: Allow /client/report without auth
  // This page handles magic link hash tokens (#access_token=...) client-side
  // The page itself will redirect to login if no valid session after processing tokens
  if (pathname === "/client/report") {
    return supabaseAuth.response;
  }

  // No valid session - redirect to new client login portal
  return copyResponseCookies(
    supabaseAuth.response,
    NextResponse.redirect(new URL("/client/login", request.url)),
  );
}

function copyResponseCookies(source: NextResponse, target: NextResponse): NextResponse {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  return target;
}

/**
 * Get Supabase session for the client portal.
 *
 * VIZA client auth now supports applicant OTP logins that may not carry the
 * legacy `user` metadata yet. If Supabase has an authenticated user for
 * this request, allow the client portal to handle the rest.
 */
async function getSupabaseUserSession(request: NextRequest): Promise<{
  session: { userId: string; email: string } | null;
  response: NextResponse;
}> {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  try {
    const supabase = createServerClient(
      normalizeSupabaseEnvValue(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        "NEXT_PUBLIC_SUPABASE_URL"
      ),
      normalizeSupabaseEnvValue(
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        "NEXT_PUBLIC_SUPABASE_ANON_KEY"
      ),
      {
        global: {
          fetch: createFetchWithTimeout(2_500),
        },
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: claimsData } = await supabase.auth.getClaims();
    const claims = claimsData?.claims;

    const userId = typeof claims?.sub === "string" ? claims.sub : null;
    const email = typeof claims?.email === "string" ? claims.email : null;
    if (!userId || !email) {
      return { session: null, response };
    }

    return {
      session: { userId, email },
      response,
    };
  } catch {
    return { session: null, response };
  }
}

export const config = {
  matcher: [
    "/client/:path*",
    "/api/client/:path*",
    "/admin/:path*",
    "/auth/:path*",
  ],
};

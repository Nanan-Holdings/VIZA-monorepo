import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";
import { getClientSessionFromRequest } from "@/lib/client-session";
import { getImpersonationSessionFromRequest } from "@/lib/impersonation-session";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Handle /client/login, /client/signup, and /client/register pages (user auth portal)
  if (
    pathname === "/client/login" ||
    pathname.startsWith("/client/login/") ||
    pathname === "/client/signup" ||
    pathname.startsWith("/client/signup/") ||
    pathname === "/client/register" ||
    pathname.startsWith("/client/register/")
  ) {
    // Check for Supabase session first
    const supabaseSession = await getSupabaseUserSession(request);
    if (supabaseSession) {
      return NextResponse.redirect(new URL("/client/home", request.url));
    }

    // Fallback: Check for legacy JWT session
    const jwtSession = await getClientSessionFromRequest(request);
    if (jwtSession) {
      return NextResponse.redirect(new URL("/client/home", request.url));
    }

    return NextResponse.next();
  }

  // Handle auth callback routes - let them through
  if (pathname.startsWith("/auth/")) {
    return NextResponse.next();
  }

  // Handle client portal routes (uses Supabase auth with fallback to JWT)
  // Also handle /api/client/* routes — these serve client-authenticated endpoints
  if (pathname.startsWith("/client") || pathname.startsWith("/api/client")) {
    return handleClientRoutes(request, pathname);
  }

  // For all other routes, use Supabase auth middleware
  return await updateSession(request);
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

  // 2. Try Supabase session
  const supabaseSession = await getSupabaseUserSession(request);
  if (supabaseSession) {
    // Valid Supabase user session - allow access
    return NextResponse.next();
  }

  // 3. Fallback: Try legacy JWT session (for migration period)
  const jwtSession = await getClientSessionFromRequest(request);
  if (jwtSession) {
    // Valid legacy JWT session - allow access
    return NextResponse.next();
  }

  // 4. Special case: Allow /client/report without auth
  // This page handles magic link hash tokens (#access_token=...) client-side
  // The page itself will redirect to login if no valid session after processing tokens
  if (pathname === "/client/report") {
    return NextResponse.next();
  }

  // No valid session - redirect to new client login portal
  return NextResponse.redirect(new URL("/client/login", request.url));
}

/**
 * Get Supabase session for the client portal.
 *
 * VIZA client auth now supports applicant OTP logins that may not carry the
 * legacy `user` metadata yet. If Supabase has an authenticated user for
 * this request, allow the client portal to handle the rest.
 */
async function getSupabaseUserSession(request: NextRequest): Promise<{
  userId: string;
  email: string;
} | null> {
  try {
    const response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
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

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !user.email) {
      return null;
    }

    return {
      userId: user.id,
      email: user.email,
    };
  } catch (error) {
    console.error("Error checking Supabase client session:", error);
    return null;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

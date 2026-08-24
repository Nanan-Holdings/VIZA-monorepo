import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasActiveAdminMembership } from "@/lib/admin-membership";
import { normalizeSupabaseEnvValue } from "./env";
import { createFetchWithTimeout } from "./fetch-with-timeout";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

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
          cookiesToSet.forEach(({ name, value, options: _options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const pathname = request.nextUrl.pathname;

  // Note: /client routes are handled by separate JWT session middleware
  // This middleware only handles Supabase auth for admin routes

  // All paths that require an admin role in the `users` table
  const isAdminLogin = pathname === "/admin/login";
  // Registration is a token-gated public surface. The action itself validates
  // the SHA-256 token and verified email; do not require an existing admin
  // membership before an invite can be accepted.
  const isAdminRegistration = pathname === "/admin/register";
  const isProtectedPath = pathname.startsWith("/admin") && !isAdminLogin && !isAdminRegistration;

  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const userId = typeof claims?.sub === "string" ? claims.sub : null;

  // Protect authenticated routes - redirect to login if not authenticated
  if (!userId && isProtectedPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  // Role-based routing for authenticated users
  if (userId) {
    // Fetch user role from database
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .is("deleted_at", null)
      .single();

    const userRole = userData?.role;
    const hasAdminAccess =
      userRole === "admin" && (await hasActiveAdminMembership(supabase, userId));

    // Block users with no role in the `users` table from accessing any protected path.
    if (!userRole && isProtectedPath) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }

    // /admin/* is admin-only — redirect others to admin login
    if (!hasAdminAccess && isProtectedPath) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }

    // Redirect authenticated admins away from admin login page
    if (hasAdminAccess && isAdminLogin) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }

    // Local admin/staff access uses account-password login only. TOTP can still
    // be configured from /account/security, but it is not required for the
    // admin happy path.
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}


// @ts-nocheck - needs refactoring after domain migration

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";

/**
 * Build redirect URL using forwarded host for Cloud Run compatibility.
 * Cloud Run internally uses 0.0.0.0:8080, so we need to use x-forwarded-host
 * to get the actual public domain.
 */
function buildRedirectUrl(request: NextRequest, path: string): string {
  const { origin } = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocalEnv = process.env.NODE_ENV === "development";

  if (isLocalEnv) {
    return `${origin}${path}`;
  } else if (forwardedHost) {
    return `https://${forwardedHost}${path}`;
  } else {
    return `${origin}${path}`;
  }
}

/**
 * Client (user) auth callback handler for magic link authentication.
 *
 * This handles the callback when a user clicks a magic link in their email.
 * It validates that the user is a user (via app_metadata.user_type) and
 * redirects them to view their lab report.
 *
 * Supports two flows:
 * 1. PKCE flow: Supabase sends ?code= parameter, we exchange it server-side
 * 2. Implicit flow: Supabase sends #access_token= hash, we redirect to client
 *    page which handles it client-side
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/client/home";
  const redirectPath = next.startsWith("/") ? next : `/${next}`;

  // If no code, this might be implicit flow with hash tokens
  // Redirect to the destination page which can handle hash tokens client-side
  if (!code) {
    return NextResponse.redirect(buildRedirectUrl(request, redirectPath));
  }

  // PKCE flow: exchange code for session
  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      buildRedirectUrl(request, "/client/login?error=auth_failed")
    );
  }

  // Get user and verify they're a user
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.redirect(
      buildRedirectUrl(request, "/client/login?error=auth_failed")
    );
  }

  // Check if user is a user via app_metadata
  const userType = user.app_metadata?.user_type;

  if (userType === "user") {
    // Valid user - redirect to client portal
    return NextResponse.redirect(buildRedirectUrl(request, redirectPath));
  }

  // User is not a user - check if they might be a user by email
  // This handles the case where app_metadata wasn't set correctly
  if (!authUser.email) {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      buildRedirectUrl(request, "/client/login?error=auth_failed")
    );
  }

  const adminClient = createAdminClient();
  const { data: user } = await adminClient
    .from("users")
    .select("id")
    .eq("email", authUser.email)
    .maybeSingle();

  if (user) {
    // User email matches a user - update app_metadata and allow access
    await supabase.auth.updateUser({
      data: { user_type: "user" },
    });

    // Also link auth_user_id if not already linked
    await adminClient
      .from("users")
      .update({ auth_user_id: authUser.id })
      .eq("id", authUser.id)
      .is("auth_user_id", null);

    return NextResponse.redirect(buildRedirectUrl(request, redirectPath));
  }

  // Not a user - sign them out and redirect to client login with error
  await supabase.auth.signOut();
  return NextResponse.redirect(
    buildRedirectUrl(request, "/client/login?error=not_a_user")
  );
}


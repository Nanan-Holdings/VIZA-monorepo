// @ts-nocheck - needs refactoring after domain migration

import { createAdminClient } from "@/lib/supabase/admin";
import { createImpersonationCookie } from "@/lib/impersonation-session";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Build redirect URL handling Cloud Run forwarded host
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
 * Impersonation callback handler
 * Validates token, creates impersonation session cookie, redirects to client portal
 *
 * NOTE: This does NOT create a Supabase session. Instead, it sets a custom
 * impersonation cookie that the client portal recognizes. This preserves
 * the admin's existing Supabase session in /manage.
 *
 * SINGLE SESSION: Starting a new impersonation overwrites any existing one.
 * Only one impersonation can be active per browser at a time.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(
      buildRedirectUrl(request, "/manage/impersonate?error=missing_token")
    );
  }

  const adminClient = createAdminClient();

  // 1. Look up and validate the token
  const { data: tokenRecord, error: tokenError } = await adminClient
    .from("impersonation_tokens")
    .select(
      `
      id,
      user_id,
      audit_log_id,
      expires_at,
      used_at,
      users:user_id (id, email, name)
    `
    )
    .eq("token", token)
    .single();

  if (tokenError || !tokenRecord) {
    return NextResponse.redirect(
      buildRedirectUrl(request, "/manage/impersonate?error=invalid_token")
    );
  }

  // 2. Check if token is expired
  if (new Date(tokenRecord.expires_at) < new Date()) {
    return NextResponse.redirect(
      buildRedirectUrl(request, "/manage/impersonate?error=token_expired")
    );
  }

  // 3. Check if token was already used
  if (tokenRecord.used_at) {
    return NextResponse.redirect(
      buildRedirectUrl(request, "/manage/impersonate?error=token_already_used")
    );
  }

  const user = tokenRecord.users as {
    id: string;
    email: string;
    name: string;
  } | null;

  if (!user || !user.email) {
    return NextResponse.redirect(
      buildRedirectUrl(request, "/manage/impersonate?error=user_not_found")
    );
  }

  // 4. Mark token as used
  await adminClient
    .from("impersonation_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", tokenRecord.id);

  // 5. Update audit log with token usage
  await adminClient
    .from("impersonation_audit_log")
    .update({ token_used_at: new Date().toISOString() })
    .eq("id", tokenRecord.audit_log_id);

  // 6. Create redirect response
  const redirectTo = buildRedirectUrl(request, "/client/home");
  const response = NextResponse.redirect(redirectTo);

  // 7. Set the impersonation session cookie (overwrites any existing session)
  await createImpersonationCookie(response, {
    userId: user.id,
    userEmail: user.email,
    userName: user.name || "Unknown User",
    auditLogId: tokenRecord.audit_log_id,
  });

  return response;
}

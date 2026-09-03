import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Server-to-server Stripe Identity writers/readers (PRODUCT-007).
 *
 * These are NOT client-invokable actions. `recordStripeIdentityEvent`
 * mutates identity/verification state via the service-role client with no
 * user session, so it must only ever be reached from trusted server-side
 * contexts (the Stripe Identity webhook). Keeping it in a plain module — not
 * a `"use server"` action file — prevents Next.js from exposing it as a
 * public POST endpoint, which would let anyone forge verification status for
 * an arbitrary session id.
 */

export async function recordStripeIdentityEvent(input: {
  sessionId: string;
  status: string;
  lastErrorCode?: string | null;
  lastReportId?: string | null;
}): Promise<void> {
  const adminClient = createAdminClient();
  await adminClient
    .from("stripe_identity_session")
    .update({
      status: input.status,
      last_error_code: input.lastErrorCode ?? null,
      last_report_id: input.lastReportId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("session_id", input.sessionId);
}

/**
 * Submission-gate helper: whether the given application has cleared the
 * Stripe Identity requirement. Server-side only (queries by arbitrary
 * application id via the service-role client), so it lives here rather than
 * as a public action.
 */
export async function isApplicationIdentityVerified(applicationId: string): Promise<boolean> {
  const adminClient = createAdminClient();
  const { data: app } = await adminClient
    .from("applications")
    .select("id, visa_package_id")
    .eq("id", applicationId)
    .maybeSingle();
  if (!app) return false;
  const { data: pkg } = await adminClient
    .from("visa_packages")
    .select("requires_stripe_identity")
    .eq("id", app.visa_package_id)
    .maybeSingle();
  if (!pkg?.requires_stripe_identity) return true; // gate not required
  const { data: session } = await adminClient
    .from("stripe_identity_session")
    .select("status")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return session?.status === "verified";
}

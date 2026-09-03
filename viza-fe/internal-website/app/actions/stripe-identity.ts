"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Stripe Identity gate (PRODUCT-007).
 *
 * For applicants whose package has `requires_stripe_identity=true`, we
 * block submission_queue enqueue until a verified Stripe Identity
 * session exists. The verification flow itself runs in the Stripe-
 * hosted modal; we only persist the session id + status here.
 */

const dynamicRequire: (specifier: string) => Promise<unknown> = (specifier) =>
  // eslint-disable-next-line no-new-func
  new Function("s", "return import(s)")(specifier) as Promise<unknown>;

interface StripeShape {
  default: new (apiKey: string, opts?: Record<string, unknown>) => {
    identity: {
      verificationSessions: {
        create: (args: Record<string, unknown>) => Promise<{ id: string; client_secret: string; url: string | null }>;
      };
    };
  };
}

export interface StartIdentityResult {
  ok: boolean;
  sessionId?: string;
  clientSecret?: string;
  hostedUrl?: string | null;
  reason?: string;
}

export async function startStripeIdentitySession(
  applicationId: string,
): Promise<StartIdentityResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "Not authenticated" };

  const adminClient = createAdminClient();
  const { data: app } = await adminClient
    .from("applications")
    .select("id, applicant_id, visa_package_id")
    .eq("id", applicationId)
    .maybeSingle();
  if (!app) return { ok: false, reason: "Application not found" };

  // Ownership check (IDOR): only the applicant who owns this application may
  // start an identity session for it. Mirrors the pattern in
  // document-upload/face-match actions.
  const { data: profile } = await adminClient
    .from("applicant_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!profile || profile.id !== app.applicant_id) {
    return { ok: false, reason: "Unauthorized" };
  }

  const { data: pkg } = await adminClient
    .from("visa_packages")
    .select("requires_stripe_identity")
    .eq("id", app.visa_package_id)
    .maybeSingle();
  if (!pkg?.requires_stripe_identity) {
    return { ok: false, reason: "Package does not require Stripe Identity" };
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return { ok: false, reason: "STRIPE_SECRET_KEY not set" };
  }
  const mod = (await dynamicRequire("stripe")) as StripeShape;
  const stripe = new mod.default(process.env.STRIPE_SECRET_KEY);
  const session = await stripe.identity.verificationSessions.create({
    type: "document",
    metadata: { application_id: app.id, applicant_id: app.applicant_id },
    options: { document: { require_live_capture: true, require_matching_selfie: true } },
  });

  await adminClient.from("stripe_identity_session").insert({
    applicant_id: app.applicant_id,
    application_id: app.id,
    session_id: session.id,
    status: "requires_input",
  });

  return {
    ok: true,
    sessionId: session.id,
    clientSecret: session.client_secret,
    hostedUrl: session.url,
  };
}

// `recordStripeIdentityEvent` (webhook-only writer) and
// `isApplicationIdentityVerified` (server-side submission gate) were moved out
// of this `"use server"` module into `lib/stripe/identity-events.ts` so they
// are no longer exposed as public, client-invokable server actions. Import
// them from there in trusted server-side contexts (the Stripe Identity
// webhook and the submission-enqueue gate).

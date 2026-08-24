"use server";

import { randomUUID } from "node:crypto";
import { withAdmin } from "@/lib/auth/with-admin";
import { createClient } from "@/lib/supabase/server";
import {
  createCheckoutSession,
  retrieveCheckoutSession,
} from "@/lib/stripe/client";
import {
  evaluateSubmissionAccess,
  type SubmissionAccessDecision,
} from "@/lib/payments/submission-access";

/**
 * Stripe Checkout for the application-scoped final-submission balance.
 *
 * Flow:
 *   1. Client calls `startCheckoutForApplication(applicationId)`.
 *   2. The canonical evaluator calculates the unpaid agency/official lines;
 *      one database RPC creates or reuses the exact order and payment record.
 *   3. Stripe redirects the user back to `success_url`/`cancel_url`.
 *   4. The webhook atomically confirms the order, entitlement and any exact
 *      government-fee allocation on `checkout.session.completed`.
 *   5. The applicant returns to Review and explicitly submits again; every
 *      enqueue boundary re-evaluates the persisted entitlement.
 */

export interface CheckoutOutput {
  url: string;
  orderId: string | null;
  amountCents: number;
  currency: string;
  decision: SubmissionAccessDecision;
}

const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "TWD", "CLP", "ISK"]);
function stripeAmount(amountCents: number, currency: string): number {
  // Stripe expects minor units except for zero-decimal currencies, where
  // amount is whole units. Our config stores cents-equivalent (i.e.
  // already-minor units); convert back when the destination is zero-decimal.
  return ZERO_DECIMAL.has(currency.toUpperCase())
    ? Math.round(amountCents / 100)
    : amountCents;
}

export async function startCheckoutForApplication(
  applicationId: string,
  requestedReturnTo?: string,
): Promise<CheckoutOutput> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  return withAdmin("system", "actions/payments:startCheckout", async (admin) => {
    const { data: app, error: appErr } = await admin
      .from("applications")
      .select("id, applicant_id, country, visa_type, group_id")
      .eq("id", applicationId)
      .single();
    if (appErr || !app) throw new Error("Application not found");

    const { data: profile } = await admin
      .from("applicant_profiles")
      .select("auth_user_id, dependant_of_user_id")
      .eq("id", app.applicant_id)
      .maybeSingle();
    let groupPayerId: string | null = null;
    if (app.group_id) {
      const { data: group } = await admin
        .from("application_group")
        .select("payer_user_id")
        .eq("id", app.group_id)
        .maybeSingle();
      groupPayerId = group?.payer_user_id ? String(group.payer_user_id) : null;
    }
    const ownerId = groupPayerId ?? profile?.auth_user_id ?? profile?.dependant_of_user_id;
    if (!profile || ownerId !== user.id) {
      throw new Error("Unauthorized");
    }

    const returnTo = requestedReturnTo?.startsWith("/client/application")
      ? requestedReturnTo
      : `/client/application/long-form?applicationId=${encodeURIComponent(applicationId)}&step=review`;
    const decision = await evaluateSubmissionAccess(admin, applicationId, {
      payerAuthUserId: user.id,
      lockHighAccess: true,
      returnTo,
    });
    if (decision.status === "review_required") {
      throw new Error("Payment evidence requires manual review before checkout can continue.");
    }

    const totalForCheckout =
      decision.agencyFee.amountDueCents + decision.officialFee.amountDueCents;
    const currency = decision.agencyFee.currency;
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.viza.it.com";
    if (decision.status === "ready" || totalForCheckout <= 0) {
      return {
        url: new URL(returnTo, origin).toString(),
        orderId: decision.orderId,
        amountCents: 0,
        currency,
        decision,
      };
    }

    // The quote, open order, fee lines and pending payment record are created
    // or reused under one application-scoped database lock. Concurrent clicks
    // therefore converge on one provider session instead of double charging.
    const checkoutClaimToken = randomUUID();
    const { data: ensuredRows, error: ensureError } = await admin.rpc(
      "ensure_submission_checkout_order",
      {
        p_application_id: applicationId,
        p_checkout_claim_token: checkoutClaimToken,
        p_payer_auth_user_id: user.id,
        p_return_to: returnTo,
      },
    );
    const ensured = Array.isArray(ensuredRows) ? ensuredRows[0] : ensuredRows;
    if (ensureError || !ensured?.order_id) {
      throw new Error(`submission checkout order: ${ensureError?.message ?? "no row"}`);
    }
    const orderId = String(ensured.order_id);
    let existingSessionId = ensured.stripe_checkout_session_id;

    // Another request may own the short checkout-session lease. Give it a
    // bounded window to persist the Stripe session, then reuse that session.
    if (!existingSessionId && !ensured.checkout_claimed) {
      for (let attempt = 0; attempt < 10 && !existingSessionId; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        const { data: concurrentOrder } = await admin
          .from("order")
          .select("stripe_checkout_session_id")
          .eq("id", orderId)
          .maybeSingle();
        existingSessionId = concurrentOrder?.stripe_checkout_session_id ?? null;
      }
      if (!existingSessionId) {
        throw new Error("Checkout is already being prepared. Please try again shortly.");
      }
    }

    if (existingSessionId) {
      try {
        const reusable = await retrieveCheckoutSession(existingSessionId);
        if (reusable.status === "open" && reusable.url) {
          return {
            url: reusable.url,
            orderId: orderId ?? null,
            amountCents: totalForCheckout,
            currency,
            decision: { ...decision, orderId: orderId ?? null },
          };
        }
      } catch {
        // The lease owner may replace an unavailable/expired Stripe session.
      }
      if (!ensured.checkout_claimed) {
        const previousSessionId = existingSessionId;
        for (let attempt = 0; attempt < 10; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 250));
          const { data: concurrentOrder } = await admin
            .from("order")
            .select("stripe_checkout_session_id")
            .eq("id", orderId)
            .maybeSingle();
          const replacementId = concurrentOrder?.stripe_checkout_session_id ?? null;
          if (replacementId && replacementId !== previousSessionId) {
            const replacement = await retrieveCheckoutSession(replacementId);
            if (replacement.status === "open" && replacement.url) {
              return {
                url: replacement.url,
                orderId,
                amountCents: totalForCheckout,
                currency,
                decision: { ...decision, orderId },
              };
            }
          }
        }
        throw new Error("Checkout is already being refreshed. Please try again shortly.");
      }
    }

    const successUrl = new URL(returnTo, origin);
    successUrl.searchParams.set("payment", "confirmed");
    successUrl.searchParams.set("orderId", orderId);
    const cancelUrl = new URL(returnTo, origin);
    cancelUrl.searchParams.set("payment", "cancelled");
    const session = await createCheckoutSession({
      amountCents: stripeAmount(totalForCheckout, currency),
      currency,
      productName: `VIZA — ${app.country}/${app.visa_type}`,
      applicationId: applicationId,
      orderId: orderId,
      customerEmail: user.email ?? undefined,
      successUrl: successUrl.toString(),
      cancelUrl: cancelUrl.toString(),
      submissionCheckout: true,
    });

    const now = new Date().toISOString();
    const [{ error: orderUpdateError }, { error: paymentUpdateError }, { error: entitlementUpdateError }] =
      await Promise.all([
        admin
          .from("order")
          .update({ stripe_checkout_session_id: session.id, updated_at: now })
          .eq("id", orderId),
        admin
          .from("payment_records")
          .update({ provider_session_id: session.id, updated_at: now })
          .eq("order_id", orderId)
          .eq("status", "pending"),
        admin
          .from("application_submission_entitlements")
          .update({ order_id: orderId, updated_at: now })
          .eq("application_id", applicationId),
      ]);
    if (orderUpdateError) throw new Error(`order checkout update: ${orderUpdateError.message}`);
    if (paymentUpdateError) throw new Error(`payment checkout update: ${paymentUpdateError.message}`);
    if (entitlementUpdateError) {
      throw new Error(`submission entitlement order update: ${entitlementUpdateError.message}`);
    }

    return {
      url: session.url,
      orderId,
      amountCents: totalForCheckout,
      currency,
      decision: { ...decision, orderId },
    };
  });
}

/**
 * Runner gate: returns true if the application has a paid order. The
 * submission queue worker calls this before flipping a row to
 * `*_pending`. Keeps the gate in one well-known place.
 */
export async function applicationIsPaidFor(
  applicationId: string,
): Promise<boolean> {
  return withAdmin("system", "actions/payments:isPaidFor", async (admin) => {
    const decision = await evaluateSubmissionAccess(admin, applicationId, {
      lockHighAccess: false,
    });
    return decision.status === "ready";
  });
}

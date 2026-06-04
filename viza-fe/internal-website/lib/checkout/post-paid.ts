import { withAdmin } from "@/lib/auth/with-admin";
import { provisionAccountAndMagicLink } from "@/app/actions/wechat-provisioning";
import { enqueueRunnerJob } from "@/lib/queue/enqueue";

/**
 * Post-payment side-effects shared by every guest-checkout rail
 * (WeChat Pay Native + guest card via Stripe).
 *
 * Fire-and-forget by design: the webhook caller acks the provider
 * regardless, so a failed mail/enqueue must never bubble into a non-2xx
 * response (providers retry, and our writes are idempotent). Mirrors the
 * behaviour the WeChat notify route had inline.
 *
 *   1. provisionAccountAndMagicLink — create the Supabase auth user (if
 *      new) and email a magic-link sign-in. Self-guards on
 *      `order.guest_checkout`, so it is a no-op mail for authenticated
 *      purchases.
 *   2. enqueueRunnerJob — kick the submission runner. Idempotent on
 *      application_id.
 *
 * @param provider short tag used only for the runner correlation id and
 *                 log lines (e.g. "wechat", "card").
 */
export function runPostPaidSideEffects(orderId: string, provider: string): void {
  provisionAccountAndMagicLink(orderId).catch((err) => {
    console.error(`[${provider}] provisionAccountAndMagicLink failed`, err);
  });

  withAdmin(
    "system",
    `checkout/post-paid:${provider}:enqueue`,
    async (admin) => {
      const { data: order } = await admin
        .from("order")
        .select("application_id")
        .eq("id", orderId)
        .maybeSingle();
      if (!order?.application_id) return;
      const { data: app } = await admin
        .from("applications")
        .select("country")
        .eq("id", order.application_id)
        .maybeSingle();
      if (!app?.country) return;
      await enqueueRunnerJob(order.application_id, app.country, {
        correlationId: `${provider}:${orderId}`,
      });
    },
  ).catch((err) => {
    console.error(`[${provider}] enqueueRunnerJob failed`, err);
  });
}

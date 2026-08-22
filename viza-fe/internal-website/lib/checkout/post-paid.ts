import { withAdmin } from "@/lib/auth/with-admin";
import {
  recordCommercialPaymentPaid,
  runPaymentProvisioningWorker,
  type CommercialPaymentProvider,
} from "@/lib/checkout/payment-provisioning";

/**
 * Publishes the verified paid event before attempting one worker pass. The
 * event and job are durable, so a provider retry, a scheduled worker call, or
 * a worker restart can recover any step that failed after the webhook ack.
 */
export async function runPostPaidSideEffects(
  orderId: string,
  provider: CommercialPaymentProvider,
  providerEventId = `${provider}:${orderId}`,
  payloadRedacted: Record<string, unknown> = {},
): Promise<void> {
  await withAdmin("system", `checkout/post-paid:${provider}:record`, async (admin) => {
    const recorded = await recordCommercialPaymentPaid(admin, {
      orderId,
      provider,
      providerEventId,
      payloadRedacted,
    });

    if (!recorded.jobId) return;

    // This is only an eager attempt. The durable job remains the source of
    // truth when a mail, alias, database, or runner wake fails.
    try {
      await runPaymentProvisioningWorker(admin, 1);
    } catch (error) {
      console.error(
        `[${provider}] payment provisioning worker kick failed`,
        error instanceof Error ? error.message : error,
      );
    }
  });
}

/**
 * Webhook idempotency contract (PAYP-008).
 *
 * Every payment webhook is keyed by its provider event id so a replay is a
 * no-op. `webhookIdempotencyKey` produces the stable dedup key. The
 * downstream side-effect (runner_job) is ALSO idempotent: enqueueRunnerJob
 * reuses an existing queued/running row for the same application_id, so even
 * if a duplicate `paid` event slips past the event-id guard, no duplicate
 * runner_job is created. Documented in docs/payments/webhooks.md.
 */
export type PaymentProvider = "stripe" | "wechat" | "airwallex" | "alipay";

export function webhookIdempotencyKey(provider: PaymentProvider, externalEventId: string): string {
  return `${provider}:${externalEventId.trim()}`;
}

/** True when this event id has already been processed (caller supplies the seen-set). */
export function isReplay(key: string, processed: ReadonlySet<string>): boolean {
  return processed.has(key);
}

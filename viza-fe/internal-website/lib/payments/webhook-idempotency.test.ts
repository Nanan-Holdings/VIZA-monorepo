import { describe, it, expect } from "vitest";
import { webhookIdempotencyKey, isReplay } from "./webhook-idempotency";

/**
 * PAYP-008: a replayed webhook is deduped by its event-id key and does not
 * trigger the side-effect twice (the runner_job enqueue is itself idempotent
 * on application_id — see lib/queue/enqueue.ts).
 */
describe("webhook idempotency", () => {
  it("produces a stable provider:eventId key", () => {
    expect(webhookIdempotencyKey("stripe", "evt_123")).toBe("stripe:evt_123");
    expect(webhookIdempotencyKey("stripe", "evt_123")).toBe(webhookIdempotencyKey("stripe", " evt_123 "));
  });

  it("detects a replayed event (no duplicate processing)", () => {
    const processed = new Set<string>();
    const key = webhookIdempotencyKey("wechat", "out_trade_no_9");
    expect(isReplay(key, processed)).toBe(false);
    processed.add(key);
    // Replay of the same event → recognized, side-effect skipped.
    expect(isReplay(key, processed)).toBe(true);
  });
});

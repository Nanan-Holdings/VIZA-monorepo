import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import {
  mergePayoutState,
  parsePhotonPayFundingEvent,
  recordPhotonPayFundingEvent,
  recordStripePayoutEvent,
  stripePayoutEventFromStripe,
} from "./reconciliation";

describe("treasury evidence adapters", () => {
  it("does not let a delayed payout event regress the current state", () => {
    const current = {
      status: "paid" as const,
      eventCreatedAt: "2026-08-01T10:00:00.000Z",
      bankReference: "po_1",
      payloadRedacted: { status: "paid" },
    };
    expect(mergePayoutState(current, {
      status: "failed",
      eventCreatedAt: "2026-08-01T09:00:00.000Z",
      bankReference: null,
      payloadRedacted: { status: "failed" },
    })).toEqual(current);
  });

  it("maps only redacted Stripe payout fields", () => {
    const event = stripePayoutEventFromStripe({
      id: "evt_payout_paid",
      type: "payout.paid",
      created: 1_735_776_000,
      data: {
        object: {
          id: "po_test_1",
          object: "payout",
          amount: 2500,
          arrival_date: 1_735_862_400,
          created: 1_735_776_000,
          currency: "usd",
          status: "paid",
          destination: { fingerprint: "fp_test", last4: "6789" },
        },
      },
      livemode: false,
      api_version: "2025-03-31.basil",
      pending_webhooks: 1,
      request: null,
    } as unknown as Stripe.Event);
    expect(event?.stripePayoutId).toBe("po_test_1");
    expect(event?.destinationLast4).toBe("6789");
    expect(event?.payloadRedacted).not.toHaveProperty("destination_fingerprint");
  });

  it("uses a deterministic body hash when a PhotonPay recovery event omits an id", () => {
    const parsed = parsePhotonPayFundingEvent('{"status":"confirmed","amount":12.5}', {
      status: "confirmed",
      amount: 12.5,
      currency: "USD",
    });
    const same = parsePhotonPayFundingEvent('{"status":"confirmed","amount":12.5}', {
      status: "confirmed",
      amount: 12.5,
      currency: "USD",
    });
    expect(parsed.providerEventId).toBe(same.providerEventId);
    expect(parsed.status).toBe("confirmed");
    expect(parsed.payloadRedacted).not.toHaveProperty("raw");
  });

  it("passes provider event ids to idempotent RPCs", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ payout_row_id: "payout-row", funding_event_row_id: "funding-row", event_replayed: true }],
      error: null,
    });
    const admin = { rpc } as never;
    const payout = stripePayoutEventFromStripe({
      id: "evt_1",
      type: "payout.created",
      created: 1_735_776_000,
      data: { object: { id: "po_1", amount: 100, currency: "usd", status: "pending", created: 1_735_776_000 } },
    } as unknown as Stripe.Event);
    if (!payout) throw new Error("fixture did not produce payout");
    await recordStripePayoutEvent(admin, payout);
    await recordPhotonPayFundingEvent(admin, parsePhotonPayFundingEvent("{}", { id: "funding-1", status: "confirmed" }));
    expect(rpc).toHaveBeenNthCalledWith(1, "record_treasury_payout_event", expect.objectContaining({ p_provider_event_id: "evt_1" }));
    expect(rpc).toHaveBeenNthCalledWith(2, "record_treasury_funding_event", expect.objectContaining({ p_provider_event_id: "funding-1" }));
  });
});

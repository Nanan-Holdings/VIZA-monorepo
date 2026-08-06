import { describe, expect, it } from "vitest";
import {
  buildTreasuryExceptions,
  mergePayoutState,
  payoutInputFromStripe,
} from "./treasury-reconciliation";

describe("treasury reconciliation", () => {
  it("keeps a newer paid payout from being regressed by a delayed failed event", () => {
    const paid = {
      status: "paid" as const,
      eventCreatedAt: "2026-08-01T10:00:00.000Z",
      bankReference: "bank-1",
    };
    expect(mergePayoutState(paid, {
      status: "failed",
      eventCreatedAt: "2026-08-01T09:00:00.000Z",
      bankReference: null,
    })).toEqual(paid);
  });

  it("joins a payout with its balance transaction without persisting provider secrets", () => {
    const input = payoutInputFromStripe({
      id: "po_test_1",
      amount: 10000,
      status: "paid",
      currency: "USD",
      arrival_date: 1_735_776_000,
      created: 1_735_689_600,
      balance_transaction: "txn_test_1",
      destination: { fingerprint: "fp_test", last4: "6789" },
    }, {
      id: "txn_test_1",
      amount: -10000,
      fee: 100,
      net: -10100,
      currency: "usd",
      type: "payout",
      source: "po_test_1",
    });
    expect(input.netCents).toBe(-10100);
    expect(input.destinationLast4).toBe("6789");
    expect(input.payloadRedacted).not.toHaveProperty("secret");
  });

  it("creates stable finance exceptions for pool shortfall, failed events, and aging", () => {
    const exceptions = buildTreasuryExceptions({
      now: new Date("2026-08-02T12:00:00.000Z"),
      reservedAmount: 100,
      reconciledPoolBalance: 50,
      currency: "USD",
      unreconciledPayouts: [{ id: "po_old", createdAt: "2026-07-31T00:00:00.000Z" }],
      failedEvents: [{ id: "evt_failed", provider: "stripe", status: "failed" }],
      agedAllocations: [{ id: "alloc_old", ageHours: 30 }],
      payoutAgeHours: 24,
      allocationAgeHours: 24,
    });
    expect(exceptions.map((exception) => exception.kind)).toEqual([
      "pool_below_reserved",
      "failed_provider_event",
      "unreconciled_payout_age",
      "allocation_age",
    ]);
  });
});

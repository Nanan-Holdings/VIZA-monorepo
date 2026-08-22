import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import {
  GENERIC_MANAGED_FEE_EXPECTATIONS,
  executeManagedPaymentBoundary,
  unavailableManagedPaymentBoundary,
  type ManagedPaymentCard,
} from "./managed-payment-boundary.js";

const card: ManagedPaymentCard = {
  attemptId: "attempt-1",
  pan: "4111111111111111",
  expiry: "12/30",
  cvv: "123",
  holderName: "VIZA",
};

const currentDir = path.resolve(process.cwd(), "src/runners");

test("catalogs all generic electronic routes with exact positive amounts and currencies", () => {
  assert.equal(GENERIC_MANAGED_FEE_EXPECTATIONS.length, 12);
  assert.deepEqual(
    new Set(GENERIC_MANAGED_FEE_EXPECTATIONS.map((entry) => entry.country)),
    new Set([
      "egypt", "saudi_arabia", "malaysia", "thailand",
      "united_arab_emirates", "turkey", "canada", "india",
      "cambodia", "laos", "sri_lanka", "south_africa",
    ]),
  );
  for (const entry of GENERIC_MANAGED_FEE_EXPECTATIONS) {
    assert.ok(entry.amountCents > 0);
    assert.match(entry.currency, /^[A-Z]{3}$/);
  }
});

test("an unavailable adapter returns staff review without acquiring or finalizing a card", async () => {
  let acquired = 0;
  let finalized = 0;
  const result = await unavailableManagedPaymentBoundary({
    country: "egypt",
    visaType: "EG_E_VISA",
    hooks: {
      takePaymentCard: async () => {
        acquired += 1;
        return card;
      },
      finalizePaymentCard: async () => {
        finalized += 1;
      },
    },
  });
  assert.equal(result.status, "managed_payment_adapter_unavailable");
  assert.match(result.reason, /staff review required/);
  assert.doesNotMatch(result.reason, /https?:\/\/|applicant|pay (?:directly|yourself)/i);
  assert.equal(acquired, 0);
  assert.equal(finalized, 0);
});

test("all generic runner implementations bind the staff-review boundary without applicant payment copy", () => {
  const sources = [
    path.join(currentDir, "standard-evisa.ts"),
    path.join(currentDir, "../egypt/runner.ts"),
    path.join(currentDir, "../sa/runner.ts"),
    path.join(currentDir, "../my/runner.ts"),
    path.join(currentDir, "../in/runner.ts"),
    path.join(currentDir, "../kh/runner.ts"),
    path.join(currentDir, "../la/runner.ts"),
    path.join(currentDir, "../lk/runner.ts"),
    path.join(currentDir, "../za/runner.ts"),
  ];
  for (const sourcePath of sources) {
    const source = fs.readFileSync(sourcePath, "utf8");
    assert.match(source, /unavailableManagedPaymentBoundary/);
    assert.doesNotMatch(
      source,
      /applicant.{0,80}(?:pay|payment)|(?:pay|payment).{0,80}applicant|pay (?:directly|yourself)/i,
    );
  }
});

test("amount or currency uncertainty stops before lazy card acquisition", async () => {
  let acquired = 0;
  const result = await executeManagedPaymentBoundary({
    country: "canada",
    visaType: "CA_TRV",
    observedAmountCents: 10_000,
    observedCurrency: "USD",
    adapter: { pay: async () => ({ status: "paid", receiptId: "receipt" }) },
    hooks: {
      takePaymentCard: async () => {
        acquired += 1;
        return card;
      },
    },
  });
  assert.equal(result.status, "managed_payment_review_required");
  assert.match(result.reason, /amount_or_currency_mismatch/);
  assert.equal(acquired, 0);
});

test("acquires the card lazily and consumes it only with official evidence", async () => {
  const events: string[] = [];
  const result = await executeManagedPaymentBoundary({
    country: "india",
    visaType: "IN_E_VISA",
    observedAmountCents: 2_500,
    observedCurrency: "USD",
    adapter: {
      pay: async (input) => {
        events.push(`pay:${input.amountCents}:${input.currency}:${input.card.attemptId}`);
        return { status: "paid", receiptId: "IN-RECEIPT-1" };
      },
    },
    hooks: {
      takePaymentCard: async () => {
        events.push("take");
        return card;
      },
      finalizePaymentCard: async (_card, outcome) => {
        events.push(`finalize:${outcome}`);
      },
    },
  });
  assert.equal(result.status, "paid");
  assert.equal(result.receiptId, "IN-RECEIPT-1");
  assert.deepEqual(events, ["take", "pay:2500:USD:attempt-1", "finalize:consumed"]);
});

test("decline, 3DS, layout uncertainty, and missing receipt finalize for review", async () => {
  for (const portalResult of [
    { status: "declined" as const },
    { status: "three_ds_required" as const },
    { status: "layout_uncertain" as const },
    { status: "unknown" as const },
    { status: "paid" as const },
  ]) {
    const outcomes: string[] = [];
    const result = await executeManagedPaymentBoundary({
      country: "thailand",
      visaType: "TH_TOURIST_E_VISA",
      observedAmountCents: 4_000,
      observedCurrency: "USD",
      adapter: { pay: async () => portalResult },
      hooks: {
        takePaymentCard: async () => card,
        finalizePaymentCard: async (_card, outcome) => {
          outcomes.push(outcome);
        },
      },
    });
    assert.equal(result.status, "managed_payment_review_required");
    assert.deepEqual(outcomes, ["review_required"]);
  }
});

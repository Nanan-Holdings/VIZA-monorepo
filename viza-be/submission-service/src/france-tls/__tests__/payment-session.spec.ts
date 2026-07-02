import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createFranceTlsPaymentSessionStore,
  redactFranceTlsPaymentInput,
} from "../payment-session";

describe("France TLS payment sessions", () => {
  it("redacts card data and only exposes non-sensitive metadata", () => {
    const redacted = redactFranceTlsPaymentInput({
      cardNumber: "4111 1111 1111 1234",
      cvc: "123",
      expMonth: "09",
      expYear: "2030",
      holderName: "Test User",
    });

    assert.deepEqual(redacted, {
      brand: "visa",
      last4: "1234",
      expMonth: "09",
      expYear: "2030",
      holderNamePresent: true,
    });
  });

  it("consumes a one-time payment session and clears sensitive fields", () => {
    const store = createFranceTlsPaymentSessionStore({ now: () => 1_000 });
    const created = store.create({
      jobId: "job-1",
      ttlMs: 60_000,
      payment: {
        cardNumber: "5555 5555 5555 4444",
        cvc: "987",
        expMonth: "10",
        expYear: "2031",
        holderName: "Applicant",
      },
    });

    assert.deepEqual(created.redacted, {
      brand: "mastercard",
      last4: "4444",
      expMonth: "10",
      expYear: "2031",
      holderNamePresent: true,
    });

    const consumed = store.consume(created.id, "job-1");
    assert.equal(consumed?.cardNumber, "5555555555554444");
    assert.equal(consumed?.cvc, "987");
    assert.equal(store.consume(created.id, "job-1"), null);
    assert.equal(JSON.stringify(store.snapshot()).includes("5555"), false);
    assert.equal(JSON.stringify(store.snapshot()).includes("987"), false);
  });
});

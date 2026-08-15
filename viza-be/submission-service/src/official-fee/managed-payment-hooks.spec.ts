import assert from "node:assert/strict";
import { test } from "node:test";

import type { ManagedOfficialFeeCard } from "../issuing/managed-card-provider.js";
import type { ManagedOfficialFeeExecutionContext } from "./execution-context.js";
import { createManagedPaymentHooks } from "./managed-payment-hooks.js";

const execution = {
  applicationId: "application-1",
  allocationId: "allocation-1",
  officialFeePaymentIntentId: "intent-1",
  intent: {},
  allocation: { currency: "USD" },
} as ManagedOfficialFeeExecutionContext;

const issuedCard: ManagedOfficialFeeCard = {
  issuer: "photonpay",
  attemptId: "attempt-1",
  cardId: "card-1",
  pan: "4111111111111111",
  expiry: "12/30",
  cvv: "123",
  holderName: "VIZA",
};

test("managed payment hooks remain lazy and reuse one issuer card", async () => {
  const events: string[] = [];
  const hooks = createManagedPaymentHooks(
    {
      applicationId: "application-1",
      workerId: "worker-1",
      country: "egypt",
      visaType: "EG_E_VISA",
    },
    {
      loadExecutionContext: async () => {
        events.push("load");
        return execution;
      },
      ensureCard: async (context) => {
        events.push(`ensure:${context.country}:${context.visaType}`);
        return issuedCard;
      },
      finalizeCard: async (card, workerId, outcome) => {
        events.push(`finalize:${card.attemptId}:${workerId}:${outcome}`);
      },
    },
  );

  assert.deepEqual(events, []);
  const first = await hooks.takePaymentCard?.();
  const second = await hooks.takePaymentCard?.();
  assert.equal(first?.attemptId, "attempt-1");
  assert.deepEqual(second, first);
  assert.deepEqual(events, ["load", "ensure:egypt:EG_E_VISA"]);
  await hooks.finalizePaymentCard?.(first!, "review_required");
  assert.deepEqual(events, [
    "load",
    "ensure:egypt:EG_E_VISA",
    "finalize:attempt-1:worker-1:review_required",
  ]);
});

test("managed payment finalizer rejects a card from another attempt", async () => {
  const hooks = createManagedPaymentHooks(
    {
      applicationId: "application-1",
      workerId: "worker-1",
      country: "india",
      visaType: "IN_E_VISA",
    },
    {
      loadExecutionContext: async () => execution,
      ensureCard: async () => issuedCard,
    },
  );
  await hooks.takePaymentCard?.();
  await assert.rejects(
    async () => {
      await hooks.finalizePaymentCard?.(
        { ...issuedCard, attemptId: "attempt-other" },
        "review_required",
      );
    },
    /unknown card attempt/,
  );
});

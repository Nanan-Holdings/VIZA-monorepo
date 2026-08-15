import assert from "node:assert/strict";
import { test } from "node:test";

import {
  loadManagedOfficialFeeExecutionContext,
  OfficialFeeExecutionContextError,
  type GovernmentFeeAllocation,
  type ManagedOfficialFeeIntent,
  type OfficialFeeExecutionContextRepository,
} from "./execution-context.js";

const applicationId = "11111111-1111-4111-8111-111111111111";
const intentId = "22222222-2222-4222-8222-222222222222";
const allocationId = "33333333-3333-4333-8333-333333333333";

function intent(overrides: Partial<ManagedOfficialFeeIntent> = {}): ManagedOfficialFeeIntent {
  return {
    id: intentId,
    application_id: applicationId,
    user_id: "44444444-4444-4444-8444-444444444444",
    fee_quote_id: null,
    country_code: "VN",
    mode: "live",
    provider: "vietnam_evisa_official_fee",
    payment_method_type: "viza_managed_virtual_card",
    official_fee_amount: 25,
    official_fee_currency: "USD",
    status: "admin_approved",
    user_consented_at: "2026-08-15T00:00:00.000Z",
    user_consent_snapshot_json: { authorized_to_pay_on_behalf: true },
    created_at: "2026-08-15T00:00:00.000Z",
    ...overrides,
  };
}

function allocation(
  overrides: Partial<GovernmentFeeAllocation> = {},
): GovernmentFeeAllocation {
  return {
    id: allocationId,
    application_id: applicationId,
    official_fee_payment_intent_id: null,
    amount_cents: 2500,
    currency: "USD",
    state: "issuable",
    created_at: "2026-08-15T00:00:00.000Z",
    ...overrides,
  };
}

function repository(input: {
  applicationPackage?: { country: string; visa_type: string } | null;
  intent?: ManagedOfficialFeeIntent | null;
  allocations?: GovernmentFeeAllocation[];
} = {}): OfficialFeeExecutionContextRepository {
  return {
    async loadApplicationPackage() {
      return input.applicationPackage === undefined
        ? { country: "vietnam", visa_type: "VN_E_VISA" }
        : input.applicationPackage;
    },
    async loadLatestManagedIntent() {
      return input.intent === undefined ? intent() : input.intent;
    },
    async loadAllocations() {
      return input.allocations ?? [allocation()];
    },
  };
}

test("loads one exact issuable allocation for a consented managed intent", async () => {
  const context = await loadManagedOfficialFeeExecutionContext(
    applicationId,
    repository(),
  );

  assert.equal(context.officialFeePaymentIntentId, intentId);
  assert.equal(context.allocationId, allocationId);
});

test("rejects a jointly forged intent and allocation amount against canonical routing", async () => {
  await assert.rejects(
    loadManagedOfficialFeeExecutionContext(
      applicationId,
      repository({
        intent: intent({ official_fee_amount: 99 }),
        allocations: [allocation({ amount_cents: 9900 })],
      }),
    ),
    (error: unknown) =>
      error instanceof OfficialFeeExecutionContextError &&
      error.code === "canonical_amount_mismatch",
  );
});

test("rejects an intent amount with sub-cent precision", async () => {
  await assert.rejects(
    loadManagedOfficialFeeExecutionContext(
      applicationId,
      repository({ intent: intent({ official_fee_amount: 25.001 }) }),
    ),
    (error: unknown) =>
      error instanceof OfficialFeeExecutionContextError &&
      error.code === "allocation_amount_invalid",
  );
});

test("rejects a jointly forged intent and allocation currency against canonical routing", async () => {
  await assert.rejects(
    loadManagedOfficialFeeExecutionContext(
      applicationId,
      repository({
        intent: intent({ official_fee_currency: "GBP" }),
        allocations: [allocation({ currency: "GBP" })],
      }),
    ),
    (error: unknown) =>
      error instanceof OfficialFeeExecutionContextError &&
      error.code === "canonical_currency_mismatch",
  );
});

test("rejects an intent country outside the canonical application package", async () => {
  await assert.rejects(
    loadManagedOfficialFeeExecutionContext(
      applicationId,
      repository({ intent: intent({ country_code: "GB" }) }),
    ),
    (error: unknown) =>
      error instanceof OfficialFeeExecutionContextError &&
      error.code === "canonical_country_mismatch",
  );
});

test("fails closed when durable consent is absent", async () => {
  await assert.rejects(
    loadManagedOfficialFeeExecutionContext(
      applicationId,
      repository({ intent: intent({ user_consented_at: null }) }),
    ),
    (error: unknown) =>
      error instanceof OfficialFeeExecutionContextError &&
      error.code === "managed_intent_not_consented",
  );
});

test("does not issue while a managed intent is under manual review", async () => {
  await assert.rejects(
    loadManagedOfficialFeeExecutionContext(
      applicationId,
      repository({ intent: intent({ status: "manual_review" }) }),
    ),
    (error: unknown) =>
      error instanceof OfficialFeeExecutionContextError &&
      error.code === "managed_intent_not_executable",
  );
});

test("does not substitute an allocation bound to a different intent", async () => {
  await assert.rejects(
    loadManagedOfficialFeeExecutionContext(
      applicationId,
      repository({
        allocations: [
          allocation({
            official_fee_payment_intent_id:
              "55555555-5555-4555-8555-555555555555",
          }),
        ],
      }),
    ),
    (error: unknown) =>
      error instanceof OfficialFeeExecutionContextError &&
      error.code === "allocation_missing",
  );
});

test("fails closed when the exact allocation is not issuer-ready", async () => {
  await assert.rejects(
    loadManagedOfficialFeeExecutionContext(
      applicationId,
      repository({
        allocations: [
          allocation({
            official_fee_payment_intent_id: intentId,
            state: "reserved_pending_treasury",
          }),
        ],
      }),
    ),
    (error: unknown) =>
      error instanceof OfficialFeeExecutionContextError &&
      error.code === "allocation_not_issuable",
  );
});

test("fails closed when multiple unbound issuable allocations are ambiguous", async () => {
  await assert.rejects(
    loadManagedOfficialFeeExecutionContext(
      applicationId,
      repository({
        allocations: [
          allocation(),
          allocation({ id: "66666666-6666-4666-8666-666666666666" }),
        ],
      }),
    ),
    (error: unknown) =>
      error instanceof OfficialFeeExecutionContextError &&
      error.code === "allocation_ambiguous",
  );
});

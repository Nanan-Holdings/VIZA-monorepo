import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, test } from "node:test";

import {
  ensureAirwallexEscrowCard,
  finalizeAirwallexEscrowCard,
  type AirwallexClientLike,
} from "./airwallex-card-provider.js";
import type {
  IssuerCardAttempt,
  IssuerCardRepository,
} from "./issuer-card-repository.js";

const savedEnv = {
  cardholder: process.env.AIRWALLEX_ISSUING_CARDHOLDER_ID,
  holderName: process.env.AIRWALLEX_ISSUING_CARDHOLDER_NAME,
  supportedCurrencies: process.env.AIRWALLEX_ISSUING_SUPPORTED_CURRENCIES,
  maxGbp: process.env.AIRWALLEX_ISSUING_MAX_CARD_AMOUNT_GBP,
  expiryMinutes: process.env.AIRWALLEX_ISSUING_CARD_EXPIRY_MINUTES,
};

before(() => {
  process.env.AIRWALLEX_ISSUING_CARDHOLDER_ID = "holder-test";
  process.env.AIRWALLEX_ISSUING_CARDHOLDER_NAME = "VIZA TEST";
  process.env.AIRWALLEX_ISSUING_SUPPORTED_CURRENCIES = "GBP";
  process.env.AIRWALLEX_ISSUING_MAX_CARD_AMOUNT_GBP = "500";
  process.env.AIRWALLEX_ISSUING_CARD_EXPIRY_MINUTES = "120";
});

after(() => {
  for (const [name, value] of [
    ["AIRWALLEX_ISSUING_CARDHOLDER_ID", savedEnv.cardholder],
    ["AIRWALLEX_ISSUING_CARDHOLDER_NAME", savedEnv.holderName],
    ["AIRWALLEX_ISSUING_SUPPORTED_CURRENCIES", savedEnv.supportedCurrencies],
    ["AIRWALLEX_ISSUING_MAX_CARD_AMOUNT_GBP", savedEnv.maxGbp],
    ["AIRWALLEX_ISSUING_CARD_EXPIRY_MINUTES", savedEnv.expiryMinutes],
  ] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

const context = {
  applicationId: "11111111-1111-4111-8111-111111111111",
  allocationId: "22222222-2222-4222-8222-222222222222",
  officialFeePaymentIntentId: "33333333-3333-4333-8333-333333333333",
  workerId: "worker-airwallex",
  country: "united_kingdom",
  visaType: "UK_STANDARD_VISITOR",
};

function attempt(overrides: Partial<IssuerCardAttempt> = {}): IssuerCardAttempt {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    allocation_id: context.allocationId,
    application_id: context.applicationId,
    official_fee_payment_intent_id: context.officialFeePaymentIntentId,
    attempt_number: 1,
    issuer: "airwallex",
    issuer_request_id: `viza-airwallex-${context.applicationId}-${context.allocationId}-1`,
    issuer_card_id: null,
    status: "issuing",
    currency: "GBP",
    limit_amount: 135,
    masked_pan: null,
    claim_count: 1,
    ...overrides,
  };
}

function repository(input: {
  attempt?: IssuerCardAttempt;
  onFinish?: (outcome: string, code?: string) => void;
} = {}): IssuerCardRepository {
  return {
    async claim(claimContext) {
      assert.equal(claimContext.issuer, "airwallex");
      return input.attempt ?? attempt();
    },
    async markIssued(_attemptId, _workerId, cardId, maskedPan) {
      assert.equal(cardId, "air-card-1");
      assert.equal(maskedPan, "411111******1111");
      return attempt({ issuer_card_id: cardId, masked_pan: maskedPan });
    },
    async markPortalProcessing() {},
    async finish(_attemptId, _workerId, outcome, code) {
      input.onFinish?.(outcome, code);
    },
  };
}

function client(overrides: Partial<AirwallexClientLike> = {}): AirwallexClientLike {
  return {
    async getIssuingConfig() {
      return {
        remoteAuthEnabled: true,
        remoteAuthDefaultAction: "DECLINED",
        remoteAuthVersion: 2,
      };
    },
    async createApplicationFeeCard() {
      return {
        cardId: "air-card-1",
        cardStatus: "ACTIVE",
        maskedNumber: "411111******1111",
      };
    },
    async getSensitiveDetails() {
      return {
        pan: "4111111111111111",
        cvv: "123",
        expiryMonth: "07",
        expiryYear: "2030",
      };
    },
    async freezeCard() {},
    ...overrides,
  };
}

for (const remoteAuth of [
  { remoteAuthEnabled: false, remoteAuthDefaultAction: "DECLINED" as const, remoteAuthVersion: 2 },
  { remoteAuthEnabled: true, remoteAuthDefaultAction: "AUTHORIZED" as const, remoteAuthVersion: 2 },
  { remoteAuthEnabled: true, remoteAuthDefaultAction: null, remoteAuthVersion: 2 },
  { remoteAuthEnabled: true, remoteAuthDefaultAction: "DECLINED" as const, remoteAuthVersion: 1 },
  { remoteAuthEnabled: true, remoteAuthDefaultAction: "DECLINED" as const, remoteAuthVersion: null },
]) {
  test(`Remote Auth gate rejects ${JSON.stringify(remoteAuth)} before durable claim`, async () => {
    let claimCalls = 0;
    let createCalls = 0;
    const guardedRepository = repository();
    await assert.rejects(
      ensureAirwallexEscrowCard(context, {
        client: client({
          async getIssuingConfig() {
            return remoteAuth;
          },
          async createApplicationFeeCard(input) {
            createCalls += 1;
            return client().createApplicationFeeCard(input);
          },
        }),
        repository: {
          ...guardedRepository,
          async claim(claimContext) {
            claimCalls += 1;
            return guardedRepository.claim(claimContext);
          },
        },
      }),
      /Remote Auth version=2.*DECLINED/i,
    );
    assert.equal(claimCalls, 0);
    assert.equal(createCalls, 0);
  });
}

test("issues a currency-locked one-use card and keeps secrets in memory", async () => {
  const createInputs: Record<string, unknown>[] = [];
  const card = await ensureAirwallexEscrowCard(context, {
    client: client({
      async createApplicationFeeCard(input) {
        createInputs.push(input as unknown as Record<string, unknown>);
        return client().createApplicationFeeCard(input);
      },
    }),
    repository: repository(),
    now: () => new Date("2026-08-15T00:00:00.000Z"),
  });

  assert.equal(card?.pan, "4111111111111111");
  assert.equal(card?.cvv, "123");
  assert.equal(card?.expiry, "07/30");
  assert.equal(card?.holderName, "VIZA TEST");
  assert.equal(createInputs[0]?.currency, "GBP");
  assert.equal(createInputs[0]?.exactAmount, 135);
  assert.equal(createInputs[0]?.requestId, attempt().issuer_request_id);
  assert.equal(createInputs[0]?.applicationId, context.applicationId);
  assert.equal(createInputs[0]?.allocationId, context.allocationId);
  assert.equal(createInputs[0]?.officialFeePaymentIntentId, context.officialFeePaymentIntentId);
});

test("a retry recovers the durable Airwallex card without creating another", async () => {
  let createCalls = 0;
  const card = await ensureAirwallexEscrowCard(context, {
    client: client({
      async createApplicationFeeCard(input) {
        createCalls += 1;
        return client().createApplicationFeeCard(input);
      },
    }),
    repository: repository({
      attempt: attempt({ issuer_card_id: "air-card-1", claim_count: 2 }),
    }),
  });

  assert.equal(card?.cardId, "air-card-1");
  assert.equal(createCalls, 0);
});

test("an uncertain create enters durable review instead of minting a replacement", async () => {
  const finishes: Array<[string, string | undefined]> = [];
  await assert.rejects(
    ensureAirwallexEscrowCard(context, {
      client: client({ async createApplicationFeeCard() { throw new Error("timeout"); } }),
      repository: repository({
        onFinish: (outcome, code) => finishes.push([outcome, code]),
      }),
    }),
    /recovery was inconclusive/i,
  );
  assert.deepEqual(finishes, [["review_required", "issuer_transport_uncertain"]]);
});

for (const scenario of [
  {
    name: "a request id not bound to the application and allocation",
    attempt: attempt({ issuer_request_id: "generic-retry-key" }),
  },
  {
    name: "an allocation currency outside the explicit allowlist",
    attempt: attempt({ currency: "USD" }),
  },
  {
    name: "an amount above the configured per-card maximum",
    attempt: attempt({ limit_amount: 500.01 }),
  },
  {
    name: "an amount with sub-cent precision",
    attempt: attempt({ limit_amount: 135.001 }),
  },
] as const) {
  test(`guardrails reject ${scenario.name} before card creation`, async () => {
    let createCalls = 0;
    const finishes: Array<[string, string | undefined]> = [];
    await assert.rejects(
      ensureAirwallexEscrowCard(context, {
        client: client({
          async createApplicationFeeCard(input) {
            createCalls += 1;
            return client().createApplicationFeeCard(input);
          },
        }),
        repository: repository({
          attempt: scenario.attempt,
          onFinish: (outcome, code) => finishes.push([outcome, code]),
        }),
      }),
      /guardrails/i,
    );
    assert.equal(createCalls, 0);
    assert.deepEqual(finishes, [["review_required", "issuer_guardrail_rejected"]]);
  });
}

test("finalization freezes the card and consumes the same durable attempt", async () => {
  let frozen = false;
  const finishes: string[] = [];
  await finalizeAirwallexEscrowCard(
    { attemptId: attempt().id, cardId: "air-card-1" },
    context.workerId,
    "consumed",
    {
      client: client({ async freezeCard() { frozen = true; } }),
      repository: repository({ onFinish: (outcome) => finishes.push(outcome) }),
    },
  );
  assert.equal(frozen, true);
  assert.deepEqual(finishes, ["consumed"]);
});

test("missing cleanup client durably moves portal processing to review", async () => {
  const finishes: Array<[string, string | undefined]> = [];
  await assert.rejects(
    finalizeAirwallexEscrowCard(
      { attemptId: attempt().id, cardId: "air-card-1" },
      context.workerId,
      "consumed",
      {
        client: null,
        repository: repository({
          onFinish: (outcome, code) => finishes.push([outcome, code]),
        }),
      },
    ),
    /cleanup client is unavailable/i,
  );
  assert.deepEqual(finishes, [["review_required", "card_cleanup_client_unavailable"]]);
});

test("a freeze failure durably requires review even after portal consumption", async () => {
  const finishes: Array<[string, string | undefined]> = [];
  await assert.rejects(
    finalizeAirwallexEscrowCard(
      { attemptId: attempt().id, cardId: "air-card-1" },
      context.workerId,
      "consumed",
      {
        client: client({ async freezeCard() { throw new Error("freeze timeout"); } }),
        repository: repository({
          onFinish: (outcome, code) => finishes.push([outcome, code]),
        }),
      },
    ),
    /freeze timeout/i,
  );
  assert.deepEqual(finishes, [["review_required", "card_freeze_failed"]]);
});

test("durable Airwallex adapter never imports the applicant vault", () => {
  const source = readFileSync(
    path.join(process.cwd(), "src/issuing/airwallex-card-provider.ts"),
    "utf8",
  );
  assert.equal(source.includes("applicant-vault"), false);
  assert.equal(source.includes("setApplicantSecret"), false);
});

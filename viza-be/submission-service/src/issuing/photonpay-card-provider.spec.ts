import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import {
  ensurePhotonPayEscrowCard,
  finalizePhotonPayEscrowCard,
  type IssuerCardRepository,
  type PhotonPayClientLike,
  type PhotonPayEscrowContext,
} from "./photonpay-card-provider.js";

const savedEnv = {
  enabled: process.env.PHOTONPAY_ENABLED,
  bin: process.env.PHOTONPAY_ISSUING_BIN,
  account: process.env.PHOTONPAY_ISSUING_ACCOUNT,
  currency: process.env.PHOTONPAY_ISSUING_CURRENCY,
  holder: process.env.PHOTONPAY_ISSUING_CARDHOLDER_NAME,
};

before(() => {
  process.env.PHOTONPAY_ENABLED = "true";
  process.env.PHOTONPAY_ISSUING_BIN = "52298927";
  process.env.PHOTONPAY_ISSUING_ACCOUNT = "FA-USD-test";
  process.env.PHOTONPAY_ISSUING_CURRENCY = "USD";
  process.env.PHOTONPAY_ISSUING_CARDHOLDER_NAME = "VIZA TEST";
});

after(() => {
  for (const [name, value] of [
    ["PHOTONPAY_ENABLED", savedEnv.enabled],
    ["PHOTONPAY_ISSUING_BIN", savedEnv.bin],
    ["PHOTONPAY_ISSUING_ACCOUNT", savedEnv.account],
    ["PHOTONPAY_ISSUING_CURRENCY", savedEnv.currency],
    ["PHOTONPAY_ISSUING_CARDHOLDER_NAME", savedEnv.holder],
  ] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

const context: PhotonPayEscrowContext = {
  applicationId: "11111111-1111-4111-8111-111111111111",
  allocationId: "44444444-4444-4444-8444-444444444444",
  officialFeePaymentIntentId: "22222222-2222-4222-8222-222222222222",
  workerId: "worker-test",
  country: "vietnam",
  visaType: "VN_E_VISA",
};

function attempt(claimCount = 1, cardId: string | null = null) {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    allocation_id: context.allocationId,
    application_id: context.applicationId,
    official_fee_payment_intent_id: context.officialFeePaymentIntentId,
    attempt_number: 1,
    issuer: "photonpay" as const,
    issuer_request_id: "viza-44444444-4444-4444-8444-444444444444-1",
    issuer_card_id: cardId,
    status: cardId ? "issued" : "issuing",
    currency: "USD",
    limit_amount: 25,
    masked_pan: cardId ? "522989******1340" : null,
    claim_count: claimCount,
  };
}

function fakeRepository(input: {
  claim?: () => ReturnType<typeof attempt>;
  onIssued?: (evidence: Record<string, unknown>) => void;
  onFinish?: (
    outcome: string,
    code?: string,
    errorMessage?: string,
    evidence?: Record<string, unknown>,
  ) => void;
} = {}): IssuerCardRepository {
  return {
    async claim() {
      return input.claim?.() ?? attempt();
    },
    async markIssued(_attemptId, _workerId, cardId, maskedPan, evidence) {
      input.onIssued?.(evidence);
      assert.equal(cardId, "card-1");
      assert.equal(maskedPan, "522989******1340");
      return attempt(1, cardId);
    },
    async markPortalProcessing() {},
    async finish(_attemptId, _workerId, outcome, code, errorMessage, evidence) {
      input.onFinish?.(outcome, code, errorMessage, evidence);
    },
  };
}

function fakeClient(overrides: Partial<PhotonPayClientLike> = {}): PhotonPayClientLike {
  return {
    async openCard() {
      return {
        status: "succeed",
        card: {
          cardId: "card-1",
          cardNo: "5229890000001340",
          expirationDate: "12/29",
          cvv: "123",
        },
        raw: {},
      };
    },
    async getRequestResult() {
      return { status: "succeed", card: { cardId: "card-1" }, raw: {} };
    },
    async getCardDetail() {
      return {
        cardId: "card-1",
        cardNo: "5229890000001340",
        expirationDate: "12/29",
      };
    },
    async getCvv() {
      return "123";
    },
    async freezeCard() {},
    async cancelCard() {},
    ...overrides,
  };
}

test("issues a limited shared card and persists no card secrets", async () => {
  const captured: { openInput?: Record<string, unknown> } = {};
  let persistedEvidence: Record<string, unknown> | null = null;
  const client = fakeClient({
    async openCard(input) {
      captured.openInput = input as unknown as Record<string, unknown>;
      return fakeClient().openCard(input);
    },
  });

  const card = await ensurePhotonPayEscrowCard(context, {
    client,
    repository: fakeRepository({ onIssued: (value) => { persistedEvidence = value; } }),
  });

  assert.equal(card?.pan, "5229890000001340");
  assert.equal(card?.cvv, "123");
  assert.equal(card?.holderName, "VIZA TEST");
  assert.equal(captured.openInput?.cardType, "share");
  assert.equal(captured.openInput?.transactionLimitType, "limited");
  assert.equal(captured.openInput?.transactionLimit, 25);
  assert.equal("rechargeAmount" in (captured.openInput ?? {}), false);
  const persisted = JSON.stringify(persistedEvidence);
  assert.equal(persisted.includes("5229890000001340"), false);
  assert.equal(persisted.includes("123"), false);
  assert.equal(persisted.includes("12/29"), false);
});

test("a duplicate claim or worker restart recovers the same card without opening another", async () => {
  let openCalls = 0;
  let requestResultCalls = 0;
  const card = await ensurePhotonPayEscrowCard(context, {
    client: fakeClient({
      async openCard() {
        openCalls += 1;
        throw new Error("must not open another card");
      },
      async getRequestResult() {
        requestResultCalls += 1;
        return {
          status: "succeed",
          card: {
            cardId: "card-1",
            cardNo: "5229890000001340",
            expirationDate: "12/29",
            cvv: "123",
          },
          raw: {},
        };
      },
    }),
    repository: fakeRepository({ claim: () => attempt(2) }),
  });

  assert.equal(card?.cardId, "card-1");
  assert.equal(openCalls, 0);
  assert.equal(requestResultCalls, 1);
});

test("rejects a claim that resolves to a different allocation", async () => {
  let openCalls = 0;
  await assert.rejects(
    ensurePhotonPayEscrowCard(context, {
      client: fakeClient({
        async openCard(input) {
          openCalls += 1;
          return fakeClient().openCard(input);
        },
      }),
      repository: fakeRepository({
        claim: () => ({
          ...attempt(),
          allocation_id: "77777777-7777-4777-8777-777777777777",
        }),
      }),
    }),
    /outside the requested execution context/i,
  );
  assert.equal(openCalls, 0);
});

test("a transport failure recovers by request id before quarantining", async () => {
  let recoverCalls = 0;
  const card = await ensurePhotonPayEscrowCard(context, {
    client: fakeClient({
      async openCard() {
        throw new Error("socket reset after request body was sent");
      },
      async getRequestResult() {
        recoverCalls += 1;
        return {
          status: "succeed",
          card: {
            cardId: "card-1",
            cardNo: "5229890000001340",
            expirationDate: "12/29",
            cvv: "123",
          },
          raw: {},
        };
      },
    }),
    repository: fakeRepository(),
  });

  assert.equal(card?.cardId, "card-1");
  assert.equal(recoverCalls, 1);
});

test("an inconclusive partial failure enters review and never creates a second request", async () => {
  let openCalls = 0;
  const finishes: Array<[string, string | undefined]> = [];
  await assert.rejects(
    ensurePhotonPayEscrowCard(context, {
      client: fakeClient({
        async openCard() {
          openCalls += 1;
          throw new Error("timeout");
        },
        async getRequestResult() {
          return { status: "processing", raw: {} };
        },
      }),
      repository: fakeRepository({
        onFinish: (outcome, code) => finishes.push([outcome, code]),
      }),
    }),
    /recovery was inconclusive/i,
  );
  assert.equal(openCalls, 1);
  assert.deepEqual(finishes, [["review_required", "issuer_transport_uncertain"]]);
});

test("UK managed payment can issue its allocation-bound VIZA card", async () => {
  let openCalls = 0;
  const card = await ensurePhotonPayEscrowCard(
    { ...context, country: "united_kingdom", visaType: "UK_STANDARD_VISITOR" },
    {
      client: fakeClient({
        async openCard(input) {
          openCalls += 1;
          return fakeClient().openCard(input);
        },
      }),
      repository: fakeRepository(),
    },
  );
  assert.equal(openCalls, 1);
  assert.equal(card?.cardId, "card-1");
});

test("paper-only packages cannot issue a VIZA card", async () => {
  await assert.rejects(
    ensurePhotonPayEscrowCard(
      { ...context, country: "japan", visaType: "JP_TOURIST" },
      { client: fakeClient(), repository: fakeRepository() },
    ),
    /issuing is forbidden/i,
  );
});

test("unsupported allocation currency fails before opening a card", async () => {
  let openCalls = 0;
  const finishes: Array<[string, string | undefined]> = [];
  await assert.rejects(
    ensurePhotonPayEscrowCard(context, {
      client: fakeClient({
        async openCard(input) {
          openCalls += 1;
          return fakeClient().openCard(input);
        },
      }),
      repository: fakeRepository({
        claim: () => ({ ...attempt(), currency: "GBP" }),
        onFinish: (outcome, code) => finishes.push([outcome, code]),
      }),
    }),
    /currency unsupported/i,
  );
  assert.equal(openCalls, 0);
  assert.deepEqual(finishes, [["failed", "issuer_currency_unsupported"]]);
});

test("paid cards are cancelled and the allocation is consumed", async () => {
  const finishes: string[] = [];
  let cancelled = false;
  await finalizePhotonPayEscrowCard(
    { attemptId: attempt().id, cardId: "card-1" },
    context.workerId,
    "consumed",
    {
      client: fakeClient({ async cancelCard() { cancelled = true; } }),
      repository: fakeRepository({ onFinish: (outcome) => finishes.push(outcome) }),
    },
  );
  assert.equal(cancelled, true);
  assert.deepEqual(finishes, ["consumed"]);
});

test("a consumed payment remains durably consumed when the PhotonPay client disappears", async () => {
  const finishes: Array<{
    outcome: string;
    code?: string;
    evidence?: Record<string, unknown>;
  }> = [];
  await finalizePhotonPayEscrowCard(
    { attemptId: attempt().id, cardId: "card-1" },
    context.workerId,
    "consumed",
    {
      client: null,
      repository: fakeRepository({
        onFinish: (outcome, code, _message, evidence) => {
          finishes.push({ outcome, code, evidence });
        },
      }),
    },
  );

  assert.deepEqual(finishes, [{
    outcome: "consumed",
    code: undefined,
    evidence: {
      provider_card_cancel_requested: false,
      provider_client_unavailable: true,
    },
  }]);
});

for (const requestedOutcome of ["cancelled", "review_required"] as const) {
  test(`missing PhotonPay client persists review_required for ${requestedOutcome}`, async () => {
    const finishes: Array<{
      outcome: string;
      code?: string;
      message?: string;
      evidence?: Record<string, unknown>;
    }> = [];
    await finalizePhotonPayEscrowCard(
      { attemptId: attempt().id, cardId: "card-1" },
      context.workerId,
      requestedOutcome,
      {
        client: null,
        repository: fakeRepository({
          onFinish: (outcome, code, message, evidence) => {
            finishes.push({ outcome, code, message, evidence });
          },
        }),
      },
    );

    assert.deepEqual(finishes, [{
      outcome: "review_required",
      code: "provider_client_unavailable",
      message: "PhotonPay client is unavailable; the issued card requires reconciliation",
      evidence: {
        provider_card_action_requested: false,
        provider_client_unavailable: true,
        requested_outcome: requestedOutcome,
      },
    }]);
  });
}

test("missing PhotonPay configuration cannot skip durable finalization", async () => {
  const envNames = [
    "PHOTONPAY_APP_ID",
    "PHOTONPAY_APP_SECRET",
    "PHOTONPAY_PRIVATE_KEY",
    "PHOTONPAY_PRIVATE_KEY_PATH",
  ] as const;
  const saved = new Map(envNames.map((name) => [name, process.env[name]]));
  const finishes: string[] = [];
  try {
    process.env.PHOTONPAY_ENABLED = "true";
    for (const name of envNames) delete process.env[name];
    await finalizePhotonPayEscrowCard(
      { attemptId: attempt().id, cardId: "card-1" },
      context.workerId,
      "review_required",
      {
        repository: fakeRepository({
          onFinish: (outcome) => finishes.push(outcome),
        }),
      },
    );
  } finally {
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }

  assert.deepEqual(finishes, ["review_required"]);
});

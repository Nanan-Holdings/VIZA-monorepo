import assert from "node:assert/strict";
import test from "node:test";

import {
  AirwallexIssuanceGuardError,
  AirwallexIssuingClient,
  readAirwallexCurrencyMaximums,
  type CreateApplicationFeeCardInput,
} from "./airwallex-issuing.js";

const input: CreateApplicationFeeCardInput = {
  applicationId: "11111111-1111-4111-8111-111111111111",
  allocationId: "22222222-2222-4222-8222-222222222222",
  officialFeePaymentIntentId: "33333333-3333-4333-8333-333333333333",
  attemptNumber: 1,
  requestId:
    "viza-airwallex-11111111-1111-4111-8111-111111111111-22222222-2222-4222-8222-222222222222-1",
  cardholderId: "holder-test",
  createdBy: "VIZA TEST",
  currency: "GBP",
  exactAmount: 135,
  activeFrom: "2026-08-15T00:00:00.000+0000",
  activeTo: "2026-08-15T02:00:00.000+0000",
};

function client(fetchImpl: typeof fetch): AirwallexIssuingClient {
  return new AirwallexIssuingClient(
    {
      baseUrl: "https://api-demo.airwallex.invalid",
      clientId: "test-client",
      apiKey: "test-key",
      currencyMaximums: { GBP: 500 },
    },
    fetchImpl,
  );
}

test("application-fee creation sends one exact amount with single-use controls", async () => {
  const calls: Array<{ url: string; body: Record<string, unknown> | null }> = [];
  const fakeFetch = (async (request: string | URL | Request, init?: RequestInit) => {
    const url = String(request);
    const body = typeof init?.body === "string"
      ? JSON.parse(init.body) as Record<string, unknown>
      : null;
    calls.push({ url, body });
    if (url.endsWith("/authentication/login")) {
      return new Response(JSON.stringify({ token: "test-token" }), { status: 200 });
    }
    return new Response(JSON.stringify({
      card_id: "air-card-1",
      card_status: "ACTIVE",
      card_number: "411111******1111",
    }), { status: 200 });
  }) as typeof fetch;

  await client(fakeFetch).createApplicationFeeCard(input);
  assert.equal(calls.length, 2);
  const payload = calls[1]?.body as {
    request_id: string;
    program: Record<string, string>;
    authorization_controls: {
      allowed_transaction_count: string;
      allowed_currencies: string[];
      transaction_limits: { limits: Array<{ amount: number; interval: string }> };
    };
  };
  assert.equal(payload.request_id, input.requestId);
  assert.deepEqual(payload.program, { purpose: "COMMERCIAL" });
  assert.equal(payload.authorization_controls.allowed_transaction_count, "SINGLE");
  assert.deepEqual(payload.authorization_controls.allowed_currencies, ["GBP"]);
  assert.deepEqual(payload.authorization_controls.transaction_limits.limits, [
    { amount: 135, interval: "PER_TRANSACTION" },
    { amount: 135, interval: "ALL_TIME" },
  ]);
  assert.doesNotMatch(JSON.stringify(payload), /pan|cvv|card_number/i);
});

test("application-fee creation sends only explicitly configured program fields", async () => {
  const payloads: Array<Record<string, unknown>> = [];
  const fakeFetch = (async (request: string | URL | Request, init?: RequestInit) => {
    if (String(request).endsWith("/authentication/login")) {
      return new Response(JSON.stringify({ token: "test-token" }), { status: 200 });
    }
    if (typeof init?.body === "string") {
      payloads.push(JSON.parse(init.body) as Record<string, unknown>);
    }
    return new Response(JSON.stringify({
      card_id: "air-card-1",
      card_status: "ACTIVE",
      card_number: "411111******1111",
    }), { status: 200 });
  }) as typeof fetch;
  const configured = new AirwallexIssuingClient(
    {
      baseUrl: "https://api-demo.airwallex.invalid",
      clientId: "test-client",
      apiKey: "test-key",
      currencyMaximums: { GBP: 500 },
      programType: "CREDIT",
      programSubType: "GOOD_FUNDS_CREDIT",
    },
    fakeFetch,
  );

  await configured.createApplicationFeeCard(input);
  assert.deepEqual(payloads[0]?.program, {
    purpose: "COMMERCIAL",
    type: "CREDIT",
    sub_type: "GOOD_FUNDS_CREDIT",
  });
});

test("Config Read exposes only the Remote Auth safety fields", async () => {
  const calls: string[] = [];
  const fakeFetch = (async (request: string | URL | Request) => {
    const url = String(request);
    calls.push(url);
    if (url.endsWith("/authentication/login")) {
      return new Response(JSON.stringify({ token: "test-token" }), { status: 200 });
    }
    return new Response(JSON.stringify({
      remote_auth_settings: {
        enabled: true,
        default_action: "DECLINED",
        version: 2,
        shared_secret: "must-not-leave-client-parser",
      },
    }), { status: 200 });
  }) as typeof fetch;
  const config = await client(fakeFetch).getIssuingConfig();
  assert.deepEqual(config, {
    remoteAuthEnabled: true,
    remoteAuthDefaultAction: "DECLINED",
    remoteAuthVersion: 2,
  });
  assert.equal(JSON.stringify(config).includes("shared_secret"), false);
  assert.equal(calls.at(-1)?.endsWith("/api/v1/issuing/config"), true);
});

test("invalid scope, currency, amount, and active window fail before fetch", async () => {
  let fetchCalls = 0;
  const guarded = client((async () => {
    fetchCalls += 1;
    throw new Error("fetch must not run");
  }) as typeof fetch);

  for (const override of [
    { requestId: "generic-retry-key" },
    { currency: "USD" },
    { exactAmount: 500.01 },
    { exactAmount: 135.001 },
    { activeTo: "2026-08-16T00:00:01.000+0000" },
  ]) {
    await assert.rejects(
      guarded.createApplicationFeeCard({ ...input, ...override }),
      AirwallexIssuanceGuardError,
    );
  }
  assert.equal(fetchCalls, 0);
});

test("legacy general-purpose card creation is disabled before fetch", async () => {
  let fetchCalls = 0;
  const guarded = client((async () => {
    fetchCalls += 1;
    throw new Error("fetch must not run");
  }) as typeof fetch);
  await assert.rejects(guarded.createCard({}), /general-purpose.*disabled/i);
  assert.equal(fetchCalls, 0);
});

test("freeze is a no-op when a single-use card is already closed", async () => {
  const methods: string[] = [];
  const fakeFetch = (async (request: string | URL | Request, init?: RequestInit) => {
    methods.push(init?.method ?? "GET");
    if (String(request).endsWith("/authentication/login")) {
      return new Response(JSON.stringify({ token: "test-token" }), { status: 200 });
    }
    return new Response(JSON.stringify({ card_status: "CLOSED" }), { status: 200 });
  }) as typeof fetch;

  await client(fakeFetch).freezeCard("air-card-1");
  assert.deepEqual(methods, ["POST", "GET"]);
});

test("freeze updates an active card to inactive", async () => {
  const calls: Array<{ url: string; method: string }> = [];
  const fakeFetch = (async (request: string | URL | Request, init?: RequestInit) => {
    const url = String(request);
    const method = init?.method ?? "GET";
    calls.push({ url, method });
    if (url.endsWith("/authentication/login")) {
      return new Response(JSON.stringify({ token: "test-token" }), { status: 200 });
    }
    if (method === "GET") {
      return new Response(JSON.stringify({ card_status: "ACTIVE" }), { status: 200 });
    }
    return new Response(JSON.stringify({ card_status: "INACTIVE" }), { status: 200 });
  }) as typeof fetch;

  await client(fakeFetch).freezeCard("air-card-1");
  assert.equal(calls.at(-1)?.url.endsWith("/api/v1/issuing/cards/air-card-1/update"), true);
  assert.equal(calls.at(-1)?.method, "POST");
});

test("currency allowlist requires one positive per-currency maximum", () => {
  assert.deepEqual(
    readAirwallexCurrencyMaximums({
      AIRWALLEX_ISSUING_SUPPORTED_CURRENCIES: "GBP, USD",
      AIRWALLEX_ISSUING_MAX_CARD_AMOUNT_GBP: "500",
      AIRWALLEX_ISSUING_MAX_CARD_AMOUNT_USD: "750.25",
    }),
    { GBP: 500, USD: 750.25 },
  );
  assert.throws(
    () => readAirwallexCurrencyMaximums({
      AIRWALLEX_ISSUING_SUPPORTED_CURRENCIES: "GBP",
    }),
    /MAX_CARD_AMOUNT_GBP/,
  );
});

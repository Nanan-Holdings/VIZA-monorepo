import assert from "node:assert/strict";
import { test } from "node:test";

import { PhotonPayConfigError } from "../clients/photonpay.js";
import type { ManagedOfficialFeeExecutionContext } from "../official-fee/execution-context.js";
import type { PhotonPayClientLike } from "./photonpay-card-provider.js";
import {
  airwallexSupportedCurrencies,
  ensureManagedOfficialFeeCard,
  ManagedCardIssuerError,
  selectManagedCardIssuer,
  type ManagedCardProviderDependencies,
} from "./managed-card-provider.js";

const photonpayFirstEnv = {
  PHOTONPAY_ENABLED: "true",
  PHOTONPAY_ISSUING_BIN_GBP: "bin-gbp",
  PHOTONPAY_ISSUING_ACCOUNT_GBP: "account-gbp",
  AIRWALLEX_ISSUING_ENABLED: "true",
  AIRWALLEX_ISSUING_SUPPORTED_CURRENCIES: "GBP,USD,JPY",
};

const managedContext = {
  execution: {
    applicationId: "11111111-1111-4111-8111-111111111111",
    applicationCountry: "united_kingdom",
    applicationVisaType: "UK_STANDARD_VISITOR",
    canonicalAmountCents: 13_500,
    canonicalCurrency: "GBP",
    allocationId: "44444444-4444-4444-8444-444444444444",
    officialFeePaymentIntentId: "22222222-2222-4222-8222-222222222222",
    intent: {
      id: "22222222-2222-4222-8222-222222222222",
      application_id: "11111111-1111-4111-8111-111111111111",
      user_id: "55555555-5555-4555-8555-555555555555",
      fee_quote_id: null,
      country_code: "GB",
      mode: "live",
      provider: "uk_visa_official_fee",
      payment_method_type: "viza_managed_virtual_card",
      official_fee_amount: 135,
      official_fee_currency: "GBP",
      status: "admin_approved",
      user_consented_at: "2026-08-15T00:00:00.000Z",
      user_consent_snapshot_json: { authorized_to_pay_on_behalf: true },
      created_at: "2026-08-15T00:00:00.000Z",
    },
    allocation: {
      id: "44444444-4444-4444-8444-444444444444",
      application_id: "11111111-1111-4111-8111-111111111111",
      official_fee_payment_intent_id: "22222222-2222-4222-8222-222222222222",
      amount_cents: 13_500,
      currency: "GBP",
      state: "issuable",
      created_at: "2026-08-15T00:00:00.000Z",
    },
  } satisfies ManagedOfficialFeeExecutionContext,
  workerId: "worker-test",
  country: "united_kingdom",
  visaType: "UK_STANDARD_VISITOR",
};

const canadaContext = {
  ...managedContext,
  country: "canada",
  visaType: "CA_TRV",
  execution: {
    ...managedContext.execution,
    applicationCountry: "canada",
    applicationVisaType: "CA_TRV",
    canonicalAmountCents: 10_000,
    canonicalCurrency: "CAD",
    intent: {
      ...managedContext.execution.intent,
      country_code: "CA",
      official_fee_amount: 100,
      official_fee_currency: "CAD",
    },
    allocation: {
      ...managedContext.execution.allocation,
      amount_cents: 10_000,
      currency: "CAD",
    },
  } satisfies ManagedOfficialFeeExecutionContext,
};

const providerCard = {
  attemptId: "33333333-3333-4333-8333-333333333333",
  cardId: "card-1",
  pan: "4111111111111111",
  expiry: "12/30",
  cvv: "123",
  holderName: "VIZA",
};

const photonpayClient = {} as PhotonPayClientLike;

function managedDependencies(
  overrides: Partial<ManagedCardProviderDependencies> = {},
): ManagedCardProviderDependencies {
  return {
    env: photonpayFirstEnv,
    loadExistingIssuer: async () => null,
    resolvePhotonPayClient: () => photonpayClient,
    ensurePhotonPayCard: async () => providerCard,
    ensureAirwallexCard: async () => providerCard,
    ...overrides,
  };
}

test("prefers an exact per-currency PhotonPay BIN/account over Airwallex", () => {
  const selection = selectManagedCardIssuer("GBP", {
    PHOTONPAY_ENABLED: "true",
    PHOTONPAY_ISSUING_BIN_GBP: "bin-gbp",
    PHOTONPAY_ISSUING_ACCOUNT_GBP: "account-gbp",
    AIRWALLEX_ISSUING_ENABLED: "true",
    AIRWALLEX_ISSUING_SUPPORTED_CURRENCIES: "GBP,USD",
  });

  assert.equal(selection.issuer, "photonpay");
  assert.deepEqual(selection.photonpayConfig, {
    currency: "GBP",
    bin: "bin-gbp",
    account: "account-gbp",
  });
  assert.equal(selection.fallbackReason, null);
});

test("uses legacy PhotonPay globals only when their currency matches", () => {
  assert.equal(
    selectManagedCardIssuer("USD", {
      PHOTONPAY_ENABLED: "true",
      PHOTONPAY_ISSUING_CURRENCY: "USD",
      PHOTONPAY_ISSUING_BIN: "legacy-bin",
      PHOTONPAY_ISSUING_ACCOUNT: "legacy-account",
    }).issuer,
    "photonpay",
  );

  assert.throws(
    () => selectManagedCardIssuer("GBP", {
      PHOTONPAY_ENABLED: "true",
      PHOTONPAY_ISSUING_CURRENCY: "USD",
      PHOTONPAY_ISSUING_BIN: "legacy-bin",
      PHOTONPAY_ISSUING_ACCOUNT: "legacy-account",
    }),
    (error: unknown) =>
      error instanceof ManagedCardIssuerError &&
      error.code === "issuer_currency_unsupported",
  );
});

test("falls back to Airwallex only for an explicitly allowed currency", () => {
  const env = {
    AIRWALLEX_ISSUING_ENABLED: "true",
    AIRWALLEX_ISSUING_SUPPORTED_CURRENCIES: "GBP, AUD, cad",
  };
  const selection = selectManagedCardIssuer("AUD", env);
  assert.equal(selection.issuer, "airwallex");
  assert.equal(selection.fallbackReason, "photonpay_currency_unsupported");
  assert.deepEqual([...airwallexSupportedCurrencies(env)], ["GBP", "AUD", "CAD"]);
  assert.throws(
    () => selectManagedCardIssuer("JPY", env),
    (error: unknown) =>
      error instanceof ManagedCardIssuerError &&
      error.code === "issuer_currency_unsupported",
  );
});

test("a pinned Airwallex attempt cannot switch back after configuration changes", () => {
  const env = {
    PHOTONPAY_ENABLED: "true",
    PHOTONPAY_ISSUING_BIN_GBP: "bin-gbp",
    PHOTONPAY_ISSUING_ACCOUNT_GBP: "account-gbp",
    AIRWALLEX_ISSUING_ENABLED: "true",
    AIRWALLEX_ISSUING_SUPPORTED_CURRENCIES: "GBP",
  };
  assert.equal(selectManagedCardIssuer("GBP", env, "airwallex").issuer, "airwallex");
});

test("an active PhotonPay attempt cannot switch when its configuration disappears", () => {
  assert.throws(
    () => selectManagedCardIssuer("GBP", {
      PHOTONPAY_ENABLED: "true",
      AIRWALLEX_ISSUING_ENABLED: "true",
      AIRWALLEX_ISSUING_SUPPORTED_CURRENCIES: "GBP",
    }, "photonpay"),
    (error: unknown) =>
      error instanceof ManagedCardIssuerError &&
      error.code === "issuer_currency_unsupported",
  );
});

test("classifies every permitted Airwallex fallback before issuance", () => {
  const cases = [
    {
      name: "provider unavailable",
      currency: "GBP",
      env: {
        AIRWALLEX_ISSUING_ENABLED: "true",
        AIRWALLEX_ISSUING_SUPPORTED_CURRENCIES: "GBP",
      },
      reason: "photonpay_provider_unavailable",
    },
    {
      name: "currency unsupported",
      currency: "JPY",
      env: {
        PHOTONPAY_ENABLED: "true",
        AIRWALLEX_ISSUING_ENABLED: "true",
        AIRWALLEX_ISSUING_SUPPORTED_CURRENCIES: "JPY",
      },
      reason: "photonpay_currency_unsupported",
    },
    {
      name: "configuration invalid",
      currency: "USD",
      env: {
        PHOTONPAY_ENABLED: "true",
        PHOTONPAY_ISSUING_BIN_USD: "bin-without-account",
        AIRWALLEX_ISSUING_ENABLED: "true",
        AIRWALLEX_ISSUING_SUPPORTED_CURRENCIES: "USD",
      },
      reason: "photonpay_configuration_invalid",
    },
  ] as const;

  for (const entry of cases) {
    const selection = selectManagedCardIssuer(entry.currency, entry.env);
    assert.equal(selection.issuer, "airwallex", entry.name);
    assert.equal(selection.fallbackReason, entry.reason, entry.name);
  }
});

test("malformed Airwallex fallback config cannot block configured PhotonPay", () => {
  const selection = selectManagedCardIssuer("GBP", {
    PHOTONPAY_ENABLED: "true",
    PHOTONPAY_ISSUING_BIN_GBP: "bin-gbp",
    PHOTONPAY_ISSUING_ACCOUNT_GBP: "account-gbp",
    AIRWALLEX_ISSUING_ENABLED: "true",
    AIRWALLEX_ISSUING_SUPPORTED_CURRENCIES: "not-a-currency",
  });
  assert.equal(selection.issuer, "photonpay");
  assert.equal(selection.fallbackReason, null);
});

test("rejects malformed Airwallex capability configuration", () => {
  assert.throws(
    () => airwallexSupportedCurrencies({
      AIRWALLEX_ISSUING_ENABLED: "true",
      AIRWALLEX_ISSUING_SUPPORTED_CURRENCIES: "USD,not-a-currency",
    }),
    (error: unknown) =>
      error instanceof ManagedCardIssuerError &&
      error.code === "issuer_capability_config_invalid",
  );
});

test("issues with PhotonPay first and never calls Airwallex on success", async () => {
  const calls: string[] = [];
  const card = await ensureManagedOfficialFeeCard(managedContext, managedDependencies({
    resolvePhotonPayClient: () => {
      calls.push("photonpay-preflight");
      return photonpayClient;
    },
    ensurePhotonPayCard: async () => {
      calls.push("photonpay-issue");
      return providerCard;
    },
    ensureAirwallexCard: async () => {
      calls.push("airwallex-issue");
      return providerCard;
    },
  }));

  assert.equal(card.issuer, "photonpay");
  assert.deepEqual(calls, ["photonpay-preflight", "photonpay-issue"]);
});

test("rejects a jointly forged intent and allocation before repository or provider calls", async () => {
  let repositoryCalls = 0;
  let providerCalls = 0;
  const forgedContext = {
    ...managedContext,
    execution: {
      ...managedContext.execution,
      intent: {
        ...managedContext.execution.intent,
        official_fee_amount: 999,
        official_fee_currency: "USD",
      },
      allocation: {
        ...managedContext.execution.allocation,
        amount_cents: 99_900,
        currency: "USD",
      },
    } satisfies ManagedOfficialFeeExecutionContext,
  };

  await assert.rejects(
    ensureManagedOfficialFeeCard(forgedContext, managedDependencies({
      loadExistingIssuer: async () => {
        repositoryCalls += 1;
        return null;
      },
      resolvePhotonPayClient: () => {
        providerCalls += 1;
        return photonpayClient;
      },
      ensurePhotonPayCard: async () => {
        providerCalls += 1;
        return providerCard;
      },
      ensureAirwallexCard: async () => {
        providerCalls += 1;
        return providerCard;
      },
    })),
    (error: unknown) =>
      error instanceof ManagedCardIssuerError &&
      error.code === "canonical_fee_binding_invalid",
  );
  assert.equal(repositoryCalls, 0);
  assert.equal(providerCalls, 0);
});

test("falls back when PhotonPay is explicitly unavailable before issuance", async () => {
  const calls: string[] = [];
  const card = await ensureManagedOfficialFeeCard(managedContext, managedDependencies({
    resolvePhotonPayClient: () => {
      calls.push("photonpay-preflight-unavailable");
      return null;
    },
    ensurePhotonPayCard: async () => {
      calls.push("unsafe-photonpay-issue");
      return providerCard;
    },
    ensureAirwallexCard: async () => {
      calls.push("airwallex-issue");
      return providerCard;
    },
  }));

  assert.equal(card.issuer, "airwallex");
  assert.deepEqual(calls, ["photonpay-preflight-unavailable", "airwallex-issue"]);
});

test("an explicit safe PhotonPay outcome still requires an Airwallex currency allowlist", async () => {
  let airwallexCalls = 0;
  await assert.rejects(
    ensureManagedOfficialFeeCard(managedContext, managedDependencies({
      env: {
        PHOTONPAY_ENABLED: "true",
        PHOTONPAY_ISSUING_BIN_GBP: "bin-gbp",
        PHOTONPAY_ISSUING_ACCOUNT_GBP: "account-gbp",
        AIRWALLEX_ISSUING_ENABLED: "true",
        AIRWALLEX_ISSUING_SUPPORTED_CURRENCIES: "USD",
      },
      resolvePhotonPayClient: () => null,
      ensureAirwallexCard: async () => {
        airwallexCalls += 1;
        return providerCard;
      },
    })),
    (error: unknown) =>
      error instanceof ManagedCardIssuerError &&
      error.code === "issuer_unavailable",
  );
  assert.equal(airwallexCalls, 0);
});

test("falls back on an explicit PhotonPay configuration error before issuance", async () => {
  const calls: string[] = [];
  const card = await ensureManagedOfficialFeeCard(managedContext, managedDependencies({
    resolvePhotonPayClient: () => {
      calls.push("photonpay-preflight-config");
      throw new PhotonPayConfigError("missing credential");
    },
    ensurePhotonPayCard: async () => {
      calls.push("unsafe-photonpay-issue");
      return providerCard;
    },
    ensureAirwallexCard: async () => {
      calls.push("airwallex-issue");
      return providerCard;
    },
  }));

  assert.equal(card.issuer, "airwallex");
  assert.deepEqual(calls, ["photonpay-preflight-config", "airwallex-issue"]);
});

test("unsupported PhotonPay currency selects Airwallex without starting PhotonPay", async () => {
  const calls: string[] = [];
  const card = await ensureManagedOfficialFeeCard(canadaContext, managedDependencies({
    env: {
      PHOTONPAY_ENABLED: "true",
      AIRWALLEX_ISSUING_ENABLED: "true",
      AIRWALLEX_ISSUING_SUPPORTED_CURRENCIES: "CAD",
    },
    resolvePhotonPayClient: () => {
      calls.push("unsafe-photonpay-preflight");
      return photonpayClient;
    },
    ensureAirwallexCard: async () => {
      calls.push("airwallex-issue");
      return providerCard;
    },
  }));

  assert.equal(card.issuer, "airwallex");
  assert.deepEqual(calls, ["airwallex-issue"]);
});

for (const failure of [
  "PhotonPay request timed out",
  "PhotonPay issuance response was ambiguous",
  "PhotonPay card may have been created but its id is unknown",
  "PhotonPay recovery state is unknown",
]) {
  test(`does not fall back after issuance starts: ${failure}`, async () => {
    let airwallexCalls = 0;
    await assert.rejects(
      ensureManagedOfficialFeeCard(managedContext, managedDependencies({
        ensurePhotonPayCard: async () => {
          throw new Error(failure);
        },
        ensureAirwallexCard: async () => {
          airwallexCalls += 1;
          return providerCard;
        },
      })),
      (error: unknown) => error instanceof Error && error.message === failure,
    );
    assert.equal(airwallexCalls, 0);
  });
}

test("treats a null PhotonPay result after preflight as ambiguous and blocks fallback", async () => {
  let airwallexCalls = 0;
  await assert.rejects(
    ensureManagedOfficialFeeCard(managedContext, managedDependencies({
      ensurePhotonPayCard: async () => null,
      ensureAirwallexCard: async () => {
        airwallexCalls += 1;
        return providerCard;
      },
    })),
    (error: unknown) =>
      error instanceof ManagedCardIssuerError &&
      error.code === "unsafe_provider_failover_blocked",
  );
  assert.equal(airwallexCalls, 0);
});

test("does not classify an arbitrary preflight exception as provider unavailable", async () => {
  let airwallexCalls = 0;
  await assert.rejects(
    ensureManagedOfficialFeeCard(managedContext, managedDependencies({
      resolvePhotonPayClient: () => {
        throw new Error("secret manager timeout");
      },
      ensureAirwallexCard: async () => {
        airwallexCalls += 1;
        return providerCard;
      },
    })),
    /secret manager timeout/,
  );
  assert.equal(airwallexCalls, 0);
});

test("never switches an existing PhotonPay attempt when preflight becomes unavailable", async () => {
  let airwallexCalls = 0;
  await assert.rejects(
    ensureManagedOfficialFeeCard(managedContext, managedDependencies({
      loadExistingIssuer: async () => "photonpay",
      resolvePhotonPayClient: () => null,
      ensureAirwallexCard: async () => {
        airwallexCalls += 1;
        return providerCard;
      },
    })),
    (error: unknown) =>
      error instanceof ManagedCardIssuerError &&
      error.code === "unsafe_provider_failover_blocked",
  );
  assert.equal(airwallexCalls, 0);
});

test("a pinned Airwallex attempt remains on Airwallex even when PhotonPay is configured", async () => {
  const calls: string[] = [];
  const card = await ensureManagedOfficialFeeCard(managedContext, managedDependencies({
    loadExistingIssuer: async () => "airwallex",
    resolvePhotonPayClient: () => {
      calls.push("unsafe-photonpay-preflight");
      return photonpayClient;
    },
    ensureAirwallexCard: async () => {
      calls.push("airwallex-recover");
      return providerCard;
    },
  }));

  assert.equal(card.issuer, "airwallex");
  assert.deepEqual(calls, ["airwallex-recover"]);
});

test("does not reverse-fallback to PhotonPay after Airwallex starts", async () => {
  let photonpayCalls = 0;
  await assert.rejects(
    ensureManagedOfficialFeeCard(canadaContext, managedDependencies({
      env: {
        PHOTONPAY_ENABLED: "true",
        AIRWALLEX_ISSUING_ENABLED: "true",
        AIRWALLEX_ISSUING_SUPPORTED_CURRENCIES: "CAD",
      },
      ensurePhotonPayCard: async () => {
        photonpayCalls += 1;
        return providerCard;
      },
      ensureAirwallexCard: async () => {
        throw new Error("Airwallex result ambiguous");
      },
    })),
    /Airwallex result ambiguous/,
  );
  assert.equal(photonpayCalls, 0);
});

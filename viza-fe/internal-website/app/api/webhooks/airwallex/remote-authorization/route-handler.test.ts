import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  decideAirwallexRemoteAuthorization,
  parseAirwallexDailyLimits,
  parseAirwallexRemoteAuthorizationRequest,
  verifyAirwallexRemoteAuthorizationSignature,
} from "./route-handler";

const now = 1_800_000_000_000;
const nonce = `${now}.random`;
const secret = "test-only-secret";
const signature = createHmac("sha256", secret).update(nonce).digest("base64");

const parsed = parseAirwallexRemoteAuthorizationRequest({
  version: 2,
  account_id: "acct_viza",
  card_id: "card_viza",
  card_transaction_event_id: "event_1",
  card_transaction_id: "transaction_1",
  card_transaction_lifecycle_id: "lifecycle_1",
  transaction_type: "AUTHORIZATION",
  transaction_category: "PURCHASE",
  transaction_amount: 135,
  transaction_currency: "GBP",
});

if (!parsed) throw new Error("test fixture must parse");

describe("Airwallex remote authorization safety", () => {
  it("accepts a timely official HMAC and rejects stale nonces", () => {
    expect(verifyAirwallexRemoteAuthorizationSignature({
      nonce,
      signature,
      sharedSecret: secret,
      now,
    })).toBe(true);
    expect(verifyAirwallexRemoteAuthorizationSignature({
      nonce,
      signature,
      sharedSecret: secret,
      now: now + 6 * 60_000,
    })).toBe(false);
  });

  it("authorizes only the exact managed card amount and currency", () => {
    const decision = decideAirwallexRemoteAuthorization({
      request: parsed,
      expectedAccountId: "acct_viza",
      dailyLimit: 500,
      dailyReservedAmount: 135,
      card: {
        issuer: "airwallex",
        attemptStatus: "portal_processing",
        allocationState: "portal_processing",
        currency: "GBP",
        limitAmount: 135,
      },
    });
    expect(decision.response_status).toBe("AUTHORIZED");
  });

  it.each([
    ["unknown card", null],
    ["wrong provider", { issuer: "photonpay", attemptStatus: "portal_processing", allocationState: "portal_processing", currency: "GBP", limitAmount: 135 }],
    ["not in portal", { issuer: "airwallex", attemptStatus: "issued", allocationState: "card_issued", currency: "GBP", limitAmount: 135 }],
    ["wrong currency", { issuer: "airwallex", attemptStatus: "portal_processing", allocationState: "portal_processing", currency: "USD", limitAmount: 135 }],
    ["wrong amount", { issuer: "airwallex", attemptStatus: "portal_processing", allocationState: "portal_processing", currency: "GBP", limitAmount: 136 }],
  ])("declines %s", (_label, card) => {
    expect(decideAirwallexRemoteAuthorization({
      request: parsed,
      expectedAccountId: "acct_viza",
      dailyLimit: 500,
      dailyReservedAmount: 135,
      card,
    }).response_status).toBe("DECLINED");
  });

  it("declines a different Airwallex account", () => {
    expect(decideAirwallexRemoteAuthorization({
      request: parsed,
      expectedAccountId: "acct_other",
      dailyLimit: 500,
      dailyReservedAmount: 135,
      card: {
        issuer: "airwallex",
        attemptStatus: "portal_processing",
        allocationState: "portal_processing",
        currency: "GBP",
        limitAmount: 135,
      },
    }).response_status).toBe("DECLINED");
  });

  it("accepts exact clearing only after portal processing or consumption", () => {
    const clearing = { ...parsed, transactionType: "CLEARING" as const };
    expect(decideAirwallexRemoteAuthorization({
      request: clearing,
      expectedAccountId: "acct_viza",
      dailyLimit: null,
      dailyReservedAmount: 0,
      card: {
        issuer: "airwallex",
        attemptStatus: "consumed",
        allocationState: "consumed",
        currency: "GBP",
        limitAmount: 135,
      },
    }).response_status).toBe("AUTHORIZED");
  });

  it("fails closed when the authorization daily ceiling is absent or exceeded", () => {
    const card = {
      issuer: "airwallex",
      attemptStatus: "portal_processing",
      allocationState: "portal_processing",
      currency: "GBP",
      limitAmount: 135,
    };
    expect(decideAirwallexRemoteAuthorization({
      request: parsed,
      expectedAccountId: "acct_viza",
      card,
      dailyLimit: null,
      dailyReservedAmount: 135,
    }).response_status).toBe("DECLINED");
    expect(decideAirwallexRemoteAuthorization({
      request: parsed,
      expectedAccountId: "acct_viza",
      card,
      dailyLimit: 200,
      dailyReservedAmount: 270,
    }).response_status).toBe("DECLINED");
  });

  it("parses strict per-currency daily ceilings", () => {
    expect(parseAirwallexDailyLimits("GBP:500,USD:750.25").get("USD")).toBe(750.25);
    expect(parseAirwallexDailyLimits("GBP:not-a-number").size).toBe(0);
  });
});

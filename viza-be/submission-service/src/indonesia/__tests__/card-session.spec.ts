import assert from "node:assert/strict";
import test from "node:test";
import {
  clearIndonesiaCardSessions,
  consumeIndonesiaCardSession,
  discardIndonesiaCardSession,
  hasIndonesiaCardSessions,
  peekIndonesiaCardSession,
  putIndonesiaCardSession,
} from "../card-session";

test("id.card-session: stores only in memory and returns redacted card metadata", () => {
  clearIndonesiaCardSessions();
  const result = putIndonesiaCardSession({
    applicationId: "app_123",
    referenceTimeMs: 1_000,
    card: {
      pan: "4111 1111 1111 1111",
      expiry: "12/30",
      cvv: "987",
      holderName: "VIZA USER",
    },
  });

  assert.equal(result.applicationId, "app_123");
  assert.equal(result.redactedCard.last4, "1111");
  assert.equal(result.redactedCard.expiryMonth, "12");
  assert.equal(result.redactedCard.expiryYear, "2030");
  assert.equal(result.redactedCard.holderNamePresent, true);
  assert.equal(peekIndonesiaCardSession("app_123", 1_001)?.card.pan, "4111111111111111");
});

test("id.card-session: consume returns the card once and deletes it", () => {
  clearIndonesiaCardSessions();
  putIndonesiaCardSession({
    applicationId: "app_456",
    referenceTimeMs: 2_000,
    card: {
      pan: "5555555555554444",
      expiry: "01/2031",
      cvv: "999",
      holderName: "CARD HOLDER",
    },
  });

  const card = consumeIndonesiaCardSession("app_456", 2_001);
  assert.equal(card?.cvv, "999");
  assert.equal(consumeIndonesiaCardSession("app_456", 2_002), null);
});

test("id.card-session: discard deletes an unused card without exposing it", () => {
  clearIndonesiaCardSessions();
  putIndonesiaCardSession({
    applicationId: "app_discard",
    referenceTimeMs: 2_000,
    card: {
      pan: "5555555555554444",
      expiry: "01/2031",
      cvv: "999",
      holderName: "CARD HOLDER",
    },
  });

  assert.equal(discardIndonesiaCardSession("app_discard", 2_001), true);
  assert.equal(peekIndonesiaCardSession("app_discard", 2_002), null);
  assert.equal(discardIndonesiaCardSession("app_discard", 2_003), false);
});

test("id.card-session: expired sessions are unavailable", () => {
  clearIndonesiaCardSessions();
  putIndonesiaCardSession({
    applicationId: "app_789",
    referenceTimeMs: 3_000,
    ttlMs: 30_000,
    card: {
      pan: "4111111111111111",
      expiry: "10/30",
      cvv: "999",
      holderName: "CARD HOLDER",
    },
  });

  assert.equal(peekIndonesiaCardSession("app_789", 32_999)?.applicationId, "app_789");
  assert.equal(hasIndonesiaCardSessions(32_999), true);
  assert.equal(peekIndonesiaCardSession("app_789", 33_000), null);
  assert.equal(hasIndonesiaCardSessions(33_000), false);
});

test("id.card-session: replacing the same application renews the one-time session", () => {
  clearIndonesiaCardSessions();
  putIndonesiaCardSession({
    applicationId: "app_renew",
    referenceTimeMs: 1_000,
    ttlMs: 30_000,
    card: {
      pan: "4111111111111111",
      expiry: "10/30",
      cvv: "111",
      holderName: "CARD HOLDER",
    },
  });
  const renewed = putIndonesiaCardSession({
    applicationId: "app_renew",
    referenceTimeMs: 20_000,
    ttlMs: 30_000,
    card: {
      pan: "5555555555554444",
      expiry: "11/31",
      cvv: "222",
      holderName: "CARD HOLDER",
    },
  });

  assert.equal(renewed.expiresAtIso, new Date(50_000).toISOString());
  assert.equal(peekIndonesiaCardSession("app_renew", 31_001)?.card.cvv, "222");
  assert.equal(consumeIndonesiaCardSession("app_renew", 31_002)?.pan, "5555555555554444");
});

test("id.card-session: rejects a missing or placeholder cardholder name", () => {
  clearIndonesiaCardSessions();
  assert.throws(
    () => putIndonesiaCardSession({
      applicationId: "app_missing_holder",
      card: {
        pan: "4111111111111111",
        expiry: "10/30",
        cvv: "999",
        holderName: "",
      },
    }),
    /holderName is required/i,
  );
});

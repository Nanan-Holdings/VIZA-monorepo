import assert from "node:assert/strict";
import test from "node:test";
import {
  clearIndonesiaCardSessions,
  consumeIndonesiaCardSession,
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
      holderName: "VIZA",
    },
  });

  const card = consumeIndonesiaCardSession("app_456", 2_001);
  assert.equal(card?.cvv, "999");
  assert.equal(consumeIndonesiaCardSession("app_456", 2_002), null);
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
      holderName: "VIZA",
    },
  });

  assert.equal(peekIndonesiaCardSession("app_789", 32_999)?.applicationId, "app_789");
  assert.equal(peekIndonesiaCardSession("app_789", 33_000), null);
});

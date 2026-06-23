import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clearVietnamCardSessions,
  consumeVietnamCardSession,
  peekVietnamCardSession,
  putVietnamCardSession,
} from "../card-session";

test("vn.card-session: stores only in memory and returns redacted card metadata", () => {
  clearVietnamCardSessions();
  const result = putVietnamCardSession({
    applicationId: "app_alpha",
    referenceTimeMs: 1_000,
    card: {
      pan: "4111 1111 1111 1111",
      expiry: "01/31",
      cvv: "987",
      holderName: "VIZA TEST",
    },
  });

  assert.equal(result.redactedCard.last4, "1111");
  assert.equal(result.redactedCard.expiryMonth, "01");
  assert.equal(result.redactedCard.expiryYear, "2031");
  assert.equal(JSON.stringify(result).includes("4111111111111111"), false);
  assert.equal(JSON.stringify(result).includes("987"), false);
});

test("vn.card-session: consume returns the card once and deletes it", () => {
  clearVietnamCardSessions();
  putVietnamCardSession({
    applicationId: "app_456",
    referenceTimeMs: 1_000,
    card: {
      pan: "4111111111111111",
      expiry: "02/32",
      cvv: "999",
    },
  });

  const card = consumeVietnamCardSession("app_456", 2_000);
  assert.equal(card?.pan, "4111111111111111");
  assert.equal(card?.cvv, "999");
  assert.equal(consumeVietnamCardSession("app_456", 2_000), null);
});

test("vn.card-session: expired sessions are unavailable", () => {
  clearVietnamCardSessions();
  putVietnamCardSession({
    applicationId: "app_789",
    referenceTimeMs: 1_000,
    ttlMs: 30_000,
    card: {
      pan: "4111111111111111",
      expiry: "02/32",
      cvv: "999",
    },
  });

  assert.equal(peekVietnamCardSession("app_789", 2_000)?.applicationId, "app_789");
  assert.equal(peekVietnamCardSession("app_789", 31_001), null);
});

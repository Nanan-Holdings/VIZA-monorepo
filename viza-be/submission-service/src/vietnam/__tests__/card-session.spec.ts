import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clearVietnamCardSessions,
  consumeVietnamCardSession,
  discardVietnamCardSession,
  hasVietnamCardSessions,
  peekVietnamCardSession,
  putVietnamCardSession,
  vietnamCardSessionsEnabled,
} from "../card-session";

test("vn.card-session: enables either local or cloud one-time handoff", () => {
  assert.equal(
    vietnamCardSessionsEnabled({ VN_LOCAL_CARD_SESSION_ENABLED: "true" }),
    true,
  );
  assert.equal(
    vietnamCardSessionsEnabled({ VN_CLOUD_CARD_SESSION_ENABLED: "1" }),
    true,
  );
  assert.equal(
    vietnamCardSessionsEnabled({
      VN_LOCAL_CARD_SESSION_ENABLED: "false",
      VN_CLOUD_CARD_SESSION_ENABLED: "off",
    }),
    false,
  );
});

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

test("vn.card-session: discard deletes an unused card without exposing it", () => {
  clearVietnamCardSessions();
  putVietnamCardSession({
    applicationId: "app_discard",
    referenceTimeMs: 2_000,
    card: {
      pan: "4111111111111111",
      expiry: "01/2031",
      cvv: "123",
      holderName: "CARD HOLDER",
    },
  });

  assert.equal(discardVietnamCardSession("app_discard", 2_001), true);
  assert.equal(peekVietnamCardSession("app_discard", 2_002), null);
  assert.equal(discardVietnamCardSession("app_discard", 2_003), false);
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
  assert.equal(hasVietnamCardSessions(2_000), true);
  assert.equal(peekVietnamCardSession("app_789", 31_001), null);
  assert.equal(hasVietnamCardSessions(31_001), false);
});

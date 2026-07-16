import assert from "node:assert/strict";
import test from "node:test";
import { consumeJapanVfsPaymentSession, putJapanVfsPaymentSession } from "./payment-session";

test("Japan VFS payment session is redacted and one-time", () => {
  const created = putJapanVfsPaymentSession({
    jobId: "job-1",
    card: { pan: "4111 1111 1111 1234", expiry: "09/30", cvv: "123", holderName: "Test User" },
  });
  assert.equal(created.redacted.last4, "1234");
  assert.equal(JSON.stringify(created).includes("4111111111111234"), false);
  assert.equal(consumeJapanVfsPaymentSession(created.sessionId, "wrong-job"), null);
  assert.equal(consumeJapanVfsPaymentSession(created.sessionId, "job-1"), null);
});

test("Japan VFS payment session returns the card once to its booking job", () => {
  const created = putJapanVfsPaymentSession({
    jobId: "job-2",
    card: { pan: "5555555555554444", expiry: "10/2031", cvv: "456", holderName: "Applicant" },
  });
  const card = consumeJapanVfsPaymentSession(created.sessionId, "job-2");
  assert.equal(card?.pan, "5555555555554444");
  assert.equal(consumeJapanVfsPaymentSession(created.sessionId, "job-2"), null);
});

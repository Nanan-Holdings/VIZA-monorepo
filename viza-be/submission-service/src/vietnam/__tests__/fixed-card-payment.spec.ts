import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractVietnamPaymentReceiptReference,
  loadVietnamFixedCardFromEnv,
  redactVietnamFixedCard,
  vietnamPaymentNeedsHuman,
} from "../fixed-card-payment";

test("vn.fixed-card-payment: disabled unless both fixed card and autopay flags are enabled", () => {
  assert.equal(loadVietnamFixedCardFromEnv({}), null);
  assert.equal(loadVietnamFixedCardFromEnv({ VN_FIXED_CARD_ENABLED: "true" }), null);
  assert.equal(loadVietnamFixedCardFromEnv({ VN_OFFICIAL_PAYMENT_AUTOPAY: "true" }), null);
});

test("vn.fixed-card-payment: loads and normalizes a fixed card from env", () => {
  const card = loadVietnamFixedCardFromEnv({
    VN_FIXED_CARD_ENABLED: "true",
    VN_OFFICIAL_PAYMENT_AUTOPAY: "true",
    VN_FIXED_CARD_PAN: "4111 1111 1111 1111",
    VN_FIXED_CARD_EXPIRY: "1/31",
    VN_FIXED_CARD_CVV: "123",
    VN_FIXED_CARD_HOLDER_NAME: "VIZA TEST",
  });

  assert.deepEqual(card, {
    pan: "4111111111111111",
    expiryMonth: "01",
    expiryYear: "2031",
    cvv: "123",
    holderName: "VIZA TEST",
  });
});

test("vn.fixed-card-payment: redaction never returns PAN or CVV", () => {
  const card = loadVietnamFixedCardFromEnv({
    VN_FIXED_CARD_ENABLED: "true",
    VN_OFFICIAL_PAYMENT_AUTOPAY: "true",
    VN_FIXED_CARD_PAN: "4111111111111111",
    VN_FIXED_CARD_EXPIRY: "02/2032",
    VN_FIXED_CARD_CVV: "123",
  });

  assert.deepEqual(redactVietnamFixedCard(card), {
    enabled: true,
    last4: "1111",
    expiryMonth: "02",
    expiryYear: "2032",
    holderNamePresent: true,
  });
  assert.equal(JSON.stringify(redactVietnamFixedCard(card)).includes("4111111111111111"), false);
  assert.equal(JSON.stringify(redactVietnamFixedCard(card)).includes("123"), false);
});

test("vn.fixed-card-payment: rejects malformed sensitive fields", () => {
  assert.throws(
    () => loadVietnamFixedCardFromEnv({
      VN_FIXED_CARD_ENABLED: "true",
      VN_OFFICIAL_PAYMENT_AUTOPAY: "true",
      VN_FIXED_CARD_PAN: "not-a-card",
      VN_FIXED_CARD_EXPIRY: "02/32",
      VN_FIXED_CARD_CVV: "123",
    }),
    /VN_FIXED_CARD_PAN/,
  );
  assert.throws(
    () => loadVietnamFixedCardFromEnv({
      VN_FIXED_CARD_ENABLED: "true",
      VN_OFFICIAL_PAYMENT_AUTOPAY: "true",
      VN_FIXED_CARD_PAN: "4111111111111111",
      VN_FIXED_CARD_EXPIRY: "13/31",
      VN_FIXED_CARD_CVV: "123",
    }),
    /VN_FIXED_CARD_EXPIRY/,
  );
  assert.throws(
    () => loadVietnamFixedCardFromEnv({
      VN_FIXED_CARD_ENABLED: "true",
      VN_OFFICIAL_PAYMENT_AUTOPAY: "true",
      VN_FIXED_CARD_PAN: "4111111111111111",
      VN_FIXED_CARD_EXPIRY: "02/32",
      VN_FIXED_CARD_CVV: "12",
    }),
    /VN_FIXED_CARD_CVV/,
  );
});

test("vn.fixed-card-payment: detects human-only payment challenges", () => {
  assert.equal(vietnamPaymentNeedsHuman("Please complete 3D Secure authentication"), true);
  assert.equal(vietnamPaymentNeedsHuman("Enter one-time password from your bank"), true);
  assert.equal(vietnamPaymentNeedsHuman("Payment amount 25 USD"), false);
});

test("vn.fixed-card-payment: extracts receipt references", () => {
  assert.equal(extractVietnamPaymentReceiptReference("Receipt: VN-ABC12345"), "VN-ABC12345");
  assert.equal(extractVietnamPaymentReceiptReference("Transaction reference # TX998877"), "TX998877");
  assert.equal(extractVietnamPaymentReceiptReference("No payment reference yet"), null);
});

import assert from "node:assert/strict";
import test from "node:test";
import { __INTERNALS, classifyUkPaymentPage, verifyUkPaymentAmount } from "./payment.js";

test("UK payment URLs accept only HTTPS UKVI and Worldpay hosts", () => {
  assert.equal(__INTERNALS.isAllowedPaymentUrl("https://visas-immigration.service.gov.uk/pay"), true);
  assert.equal(__INTERNALS.isAllowedPaymentUrl("https://secure.worldpay.com/payment"), true);
  assert.equal(__INTERNALS.isAllowedPaymentUrl("http://secure.worldpay.com/payment"), false);
  assert.equal(__INTERNALS.isAllowedPaymentUrl("https://worldpay.com.evil.example/payment"), false);
});

test("UK payment classification requires success evidence and an official reference", () => {
  assert.deepEqual(
    classifyUkPaymentPage({
      bodyText: "Payment has been successful. Your application reference number is GWF123456789.",
      finalUrl: "https://visas-immigration.service.gov.uk/next",
    }),
    {
      status: "paid",
      portalReceiptId: "GWF123456789",
      finalUrl: "https://visas-immigration.service.gov.uk/next",
    },
  );

  assert.equal(
    classifyUkPaymentPage({ bodyText: "Thank you", finalUrl: "https://secure.worldpay.com/result" }).status,
    "review_required",
  );
});

test("UK payment classification never treats 3DS or declines as paid", () => {
  assert.equal(
    classifyUkPaymentPage({ bodyText: "Approve this payment in your bank app", finalUrl: "https://secure.worldpay.com/3ds" }).status,
    "review_required",
  );
  assert.equal(
    classifyUkPaymentPage({ bodyText: "Payment declined", finalUrl: "https://secure.worldpay.com/result" }).status,
    "declined",
  );
});

test("UK expiry parsing accepts MM/YY and MM/YYYY without retaining card state", () => {
  assert.deepEqual(__INTERNALS.splitExpiry("8/29"), { month: "08", year: "2029", shortYear: "29" });
  assert.deepEqual(__INTERNALS.splitExpiry("08/2029"), { month: "08", year: "2029", shortYear: "29" });
  assert.equal(__INTERNALS.splitExpiry("2029-08"), null);
});

test("UK payment amount guard accepts the exact allocation amount in major units", () => {
  assert.deepEqual(
    verifyUkPaymentAmount({
      bodyText: "Visa fee Total to pay £135.00",
      expectedAmount: 135,
      expectedCurrency: "GBP",
    }),
    { ok: true, amount: 135, currency: "GBP" },
  );
});

test("UK payment amount guard rejects mismatch or an unobservable amount", () => {
  assert.equal(
    verifyUkPaymentAmount({
      bodyText: "Total to pay £140.00",
      expectedAmount: 135,
      expectedCurrency: "GBP",
    }).ok,
    false,
  );
  assert.equal(
    verifyUkPaymentAmount({
      bodyText: "Continue to secure payment",
      expectedAmount: 135,
      expectedCurrency: "GBP",
    }).ok,
    false,
  );
  assert.match(
    (verifyUkPaymentAmount({
      bodyText: "Total USD 135.00",
      expectedAmount: 135,
      expectedCurrency: "GBP",
    }) as { ok: false; reason: string }).reason,
    /currency did not match/i,
  );
});

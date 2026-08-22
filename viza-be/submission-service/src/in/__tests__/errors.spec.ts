import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyPage, isTrustedInOfficialUrl } from "../errors.js";

test("in.errors: cloudflare → human", () => {
  const err = classifyPage({ title: "Just a moment...", bodyText: "Checking your browser" });
  assert.equal(err?.code, "in.anti_bot.cloudflare");
  assert.equal(err?.disposition, "human");
});

test("in.errors: 429 → retry", () => {
  const err = classifyPage({ title: "X", bodyText: "Too many requests", httpStatus: 429 });
  assert.equal(err?.code, "in.anti_bot.ratelimit");
});

test("in.errors: invalid passport → fail", () => {
  const err = classifyPage({ title: "Apply", bodyText: "Invalid passport number." });
  assert.equal(err?.code, "in.validation.passport_invalid");
});

test("in.errors: payment transaction failed → human", () => {
  const err = classifyPage({ title: "Pay", bodyText: "Transaction failed" });
  assert.equal(err?.code, "in.validation.payment_declined");
});

test("in.errors: healthy → null", () => {
  const err = classifyPage({ title: "Apply for e-Visa", bodyText: "Personal information" });
  assert.equal(err, null);
});

test("India runner trusts only HTTPS on the exact official portal hosts", () => {
  assert.equal(isTrustedInOfficialUrl("https://indianvisaonline.gov.in/evisa/"), true);
  assert.equal(isTrustedInOfficialUrl("https://www.indianvisaonline.gov.in/evisa/Registration"), true);
  assert.equal(isTrustedInOfficialUrl("http://indianvisaonline.gov.in/evisa/"), false);
  assert.equal(isTrustedInOfficialUrl("https://indianvisaonline.gov.in.attacker.test/evisa/"), false);
  assert.equal(isTrustedInOfficialUrl("https://attacker.test/evisa/Registration"), false);
});

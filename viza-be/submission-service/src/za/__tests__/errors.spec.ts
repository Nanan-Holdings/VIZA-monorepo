import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyPage } from "../errors.js";

test("za.errors: cloudflare interstitial → human", () => {
  const err = classifyPage({ title: "Just a moment...", bodyText: "Checking your browser before accessing." });
  assert.equal(err?.code, "za.anti_bot.cloudflare");
  assert.equal(err?.disposition, "human");
});

test("za.errors: 429 ratelimit → retry", () => {
  const err = classifyPage({ title: "Too many", bodyText: "Too many requests", httpStatus: 429 });
  assert.equal(err?.code, "za.anti_bot.ratelimit");
  assert.equal(err?.disposition, "retry");
});

test("za.errors: invalid passport → fail", () => {
  const err = classifyPage({ title: "Apply", bodyText: "Invalid passport number. Please check." });
  assert.equal(err?.code, "za.validation.passport_invalid");
  assert.equal(err?.disposition, "fail");
});

test("za.errors: payment declined → human", () => {
  const err = classifyPage({ title: "Payment", bodyText: "Card declined by issuer." });
  assert.equal(err?.code, "za.validation.payment_declined");
  assert.equal(err?.disposition, "human");
});

test("za.errors: healthy → null", () => {
  const err = classifyPage({ title: "Apply for eVisa", bodyText: "Personal information" });
  assert.equal(err, null);
});

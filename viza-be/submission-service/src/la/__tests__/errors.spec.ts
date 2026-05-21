import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyPage } from "../errors";

test("cloudflare → la.anti_bot.cloudflare (human)", () => {
  const r = classifyPage({ title: "Just a moment...", bodyText: "Checking your browser before accessing laoevisa.gov.la" });
  assert.equal(r?.code, "la.anti_bot.cloudflare");
  assert.equal(r?.disposition, "human");
});

test("HTTP 429 → la.anti_bot.ratelimit (retry)", () => {
  const r = classifyPage({ title: "Too Many Requests", bodyText: "Too many requests", httpStatus: 429 });
  assert.equal(r?.code, "la.anti_bot.ratelimit");
});

test("invalid passport → la.validation.passport_invalid (fail)", () => {
  const r = classifyPage({ title: "Apply", bodyText: "Your passport number is invalid." });
  assert.equal(r?.code, "la.validation.passport_invalid");
  assert.equal(r?.disposition, "fail");
});

test("payment declined → la.validation.payment_declined (human)", () => {
  const r = classifyPage({ title: "Payment", bodyText: "Card declined by issuer." });
  assert.equal(r?.code, "la.validation.payment_declined");
  assert.equal(r?.disposition, "human");
});

test("healthy page → null", () => {
  const r = classifyPage({ title: "Lao e-Visa", bodyText: "Welcome." });
  assert.equal(r, null);
});

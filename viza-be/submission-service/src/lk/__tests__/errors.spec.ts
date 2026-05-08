import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyPage } from "../errors";

test("cloudflare → lk.anti_bot.cloudflare (human)", () => {
  const r = classifyPage({ title: "Just a moment...", bodyText: "Checking your browser before accessing eta.gov.lk" });
  assert.equal(r?.code, "lk.anti_bot.cloudflare");
  assert.equal(r?.disposition, "human");
});

test("HTTP 429 → lk.anti_bot.ratelimit (retry)", () => {
  const r = classifyPage({ title: "Too Many Requests", bodyText: "Too many requests", httpStatus: 429 });
  assert.equal(r?.code, "lk.anti_bot.ratelimit");
});

test("invalid passport → lk.validation.passport_invalid (fail)", () => {
  const r = classifyPage({ title: "Apply", bodyText: "Your passport number is invalid." });
  assert.equal(r?.code, "lk.validation.passport_invalid");
});

test("payment declined → lk.validation.payment_declined (human)", () => {
  const r = classifyPage({ title: "Payment", bodyText: "Card declined by issuer." });
  assert.equal(r?.code, "lk.validation.payment_declined");
});

test("healthy page → null", () => {
  assert.equal(classifyPage({ title: "Sri Lanka ETA", bodyText: "Welcome." }), null);
});

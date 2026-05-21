import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyPage } from "../errors.js";

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

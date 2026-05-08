import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyPage } from "../errors.js";

test("vn.errors: cloudflare → human", () => {
  const err = classifyPage({ title: "Just a moment...", bodyText: "Checking your browser" });
  assert.equal(err?.code, "vn.anti_bot.cloudflare");
});

test("vn.errors: 429 → retry", () => {
  const err = classifyPage({ title: "X", bodyText: "Too many requests", httpStatus: 429 });
  assert.equal(err?.code, "vn.anti_bot.ratelimit");
});

test("vn.errors: captcha → human", () => {
  const err = classifyPage({ title: "Apply", bodyText: "captcha is required to continue" });
  assert.equal(err?.code, "vn.validation.captcha_required");
  assert.equal(err?.disposition, "human");
});

test("vn.errors: invalid passport → fail", () => {
  const err = classifyPage({ title: "Apply", bodyText: "Invalid passport number." });
  assert.equal(err?.code, "vn.validation.passport_invalid");
});

test("vn.errors: healthy → null", () => {
  const err = classifyPage({ title: "evisa", bodyText: "Personal information" });
  assert.equal(err, null);
});

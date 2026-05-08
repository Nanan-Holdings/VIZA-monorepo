import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyPage } from "../errors.js";

test("au.errors: cloudflare → human", () => {
  const err = classifyPage({ title: "Just a moment...", bodyText: "Checking your browser" });
  assert.equal(err?.code, "au.anti_bot.cloudflare");
});

test("au.errors: 429 → retry", () => {
  const err = classifyPage({ title: "X", bodyText: "Too many requests", httpStatus: 429 });
  assert.equal(err?.code, "au.anti_bot.ratelimit");
});

test("au.errors: invalid login → human", () => {
  const err = classifyPage({ title: "ImmiAccount", bodyText: "Invalid username or password" });
  assert.equal(err?.code, "au.auth.invalid_credentials");
  assert.equal(err?.disposition, "human");
});

test("au.errors: account locked → human", () => {
  const err = classifyPage({ title: "Locked", bodyText: "Your account has been locked" });
  assert.equal(err?.code, "au.auth.account_locked");
});

test("au.errors: healthy → null", () => {
  const err = classifyPage({ title: "ImmiAccount", bodyText: "Welcome to ImmiAccount" });
  assert.equal(err, null);
});

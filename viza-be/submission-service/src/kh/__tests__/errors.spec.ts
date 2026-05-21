import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyPage } from "../errors";

test("cloudflare interstitial → anti_bot.cloudflare (human)", () => {
  const r = classifyPage({
    title: "Just a moment...",
    bodyText: "Checking your browser before accessing evisa.gov.kh",
  });
  assert.equal(r?.code, "kh.anti_bot.cloudflare");
  assert.equal(r?.disposition, "human");
});

test("HTTP 429 → anti_bot.ratelimit (retry)", () => {
  const r = classifyPage({
    title: "Too Many Requests",
    bodyText: "Too many requests have been issued from this IP",
    httpStatus: 429,
  });
  assert.equal(r?.code, "kh.anti_bot.ratelimit");
  assert.equal(r?.disposition, "retry");
});

test("invalid passport message → validation.passport_invalid (fail)", () => {
  const r = classifyPage({
    title: "Application",
    bodyText: "Your passport number is invalid. Please check and try again.",
  });
  assert.equal(r?.code, "kh.validation.passport_invalid");
  assert.equal(r?.disposition, "fail");
});

test("scheduled maintenance → portal.maintenance (retry)", () => {
  const r = classifyPage({
    title: "Maintenance",
    bodyText: "The portal is under scheduled maintenance until 02:00 UTC.",
  });
  assert.equal(r?.code, "kh.portal.maintenance");
});

test("HTTP 503 → portal.unreachable (retry)", () => {
  const r = classifyPage({
    title: "Service Unavailable",
    bodyText: "",
    httpStatus: 503,
  });
  assert.equal(r?.code, "kh.portal.unreachable");
});

test("healthy page → null", () => {
  const r = classifyPage({
    title: "Cambodia e-Visa Application",
    bodyText: "Welcome. Please fill in your personal details.",
  });
  assert.equal(r, null);
});

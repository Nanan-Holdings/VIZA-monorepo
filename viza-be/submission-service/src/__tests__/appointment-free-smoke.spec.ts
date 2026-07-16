import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyAppointmentPortalState,
  findMissingAppointmentFields,
  redactOfficialUrl,
} from "../appointment-free-smoke";

test("classifies a visible login entry as pass", () => {
  const result = classifyAppointmentPortalState({
    status: 200,
    url: "https://example.test/login",
    title: "Book an appointment",
    bodyText: "Sign in Register",
    expectedMarker: /sign in|register/i,
  });
  assert.equal(result.verdict, "pass");
  assert.equal(result.entryDetected, true);
});

test("classifies CAPTCHA as conditional instead of success", () => {
  const result = classifyAppointmentPortalState({
    status: 200,
    url: "https://example.test/login",
    title: "Verify",
    bodyText: "Complete the reCAPTCHA to sign in",
    expectedMarker: /sign in/i,
  });
  assert.equal(result.verdict, "conditional");
  assert.equal(result.captchaDetected, true);
});

test("classifies access denial as proxy required", () => {
  const result = classifyAppointmentPortalState({
    status: 403,
    url: "https://example.test/login",
    title: "Access denied",
    bodyText: "This service is not available in your region",
    expectedMarker: /sign in/i,
  });
  assert.equal(result.verdict, "proxy_required");
});

test("keeps a Cloudflare verification page conditional even when it responds 403", () => {
  const result = classifyAppointmentPortalState({
    status: 403,
    url: "https://example.test/login",
    title: "Just a moment...",
    bodyText: "Performing security verification while the site verifies you are not a bot.",
    expectedMarker: /sign in/i,
  });
  assert.equal(result.verdict, "conditional");
  assert.equal(result.wafDetected, true);
});

test("accepts the official entry after Browserbase solves an initial 403 challenge", () => {
  const state = classifyAppointmentPortalState({
    status: 403,
    url: "https://visas-fr.tlscontact.com/en-us",
    title: "French visa application centre | TLScontact",
    bodyText: "Welcome to the TLScontact visa application website for France. Book an appointment.",
    expectedMarker: /tlscontact|book an appointment/i,
  });
  assert.equal(state.verdict, "pass");
  assert.equal(state.entryDetected, true);
  assert.equal(state.wafDetected, false);
});

test("reports exact missing VIZA fields and strips URL secrets", () => {
  assert.deepEqual(
    findMissingAppointmentFields({ surname: "Chen", email: "" }, ["surname", "email", "passport_number"]),
    ["email", "passport_number"],
  );
  assert.equal(
    redactOfficialUrl("https://example.test/login?code=secret#token"),
    "https://example.test/login",
  );
  assert.equal(redactOfficialUrl("null"), "[REDACTED]");
  assert.equal(redactOfficialUrl("chrome-error://chromewebdata/"), "[REDACTED]");
});

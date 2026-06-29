import test from "node:test";
import assert from "node:assert/strict";
import {
  extractPhEtravelOtpFromMessage,
  extractPhEtravelVerificationUrlFromMessage,
} from "../mailbox-provider";

test("extractPhEtravelOtpFromMessage reads numeric verification codes", () => {
  const code = extractPhEtravelOtpFromMessage({
    subject: "Your eTravel verification code",
    text: "Use verification code 483920 to continue your eTravel registration.",
    html: null,
  });

  assert.equal(code, "483920");
});

test("extractPhEtravelVerificationUrlFromMessage reads official verification links", () => {
  const url = extractPhEtravelVerificationUrlFromMessage({
    subject: "Confirm your eTravel account",
    text: null,
    html: '<a href="https://etravel.gov.ph/verify-email?token=abc123&amp;source=email">Verify</a>',
  });

  assert.equal(url?.toString(), "https://etravel.gov.ph/verify-email?token=abc123&source=email");
});

test("extractPhEtravelVerificationUrlFromMessage ignores non-official links", () => {
  const url = extractPhEtravelVerificationUrlFromMessage({
    subject: "Confirm",
    text: "https://example.com/verify?token=abc123",
    html: null,
  });

  assert.equal(url, null);
});

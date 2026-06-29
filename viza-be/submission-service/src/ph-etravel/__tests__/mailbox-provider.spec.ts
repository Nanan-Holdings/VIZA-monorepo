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

test("extractPhEtravelOtpFromMessage ignores email template styling numbers", () => {
  const code = extractPhEtravelOtpFromMessage({
    subject: "eGovPH Verify Email",
    text: null,
    html: `
      <style>
        body { color: #323232; font-size: 16px; }
      </style>
      <p>Dear eGovPH User,</p>
      <p>We have generated an email code that you can use to login to your account.</p>
      <p>EMAIL CODE: 483920</p>
      <p>Please note that the email code is valid for 5 minutes.</p>
    `,
  });

  assert.equal(code, "483920");
});

test("extractPhEtravelOtpFromMessage decodes quoted-printable email codes", () => {
  const code = extractPhEtravelOtpFromMessage({
    subject: "eGovPH Verify Email",
    text: "EMAIL CODE: =34=38=33=39=32=30",
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

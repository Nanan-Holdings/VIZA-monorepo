import test from "node:test";
import assert from "node:assert/strict";
import {
  extractPhEtravelOtpFromMessage,
  extractPhEtravelVerificationUrlFromMessage,
  isPhEtravelExistingAccountNotice,
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

test("extractPhEtravelOtpFromMessage decodes base64 MIME email codes", () => {
  const body = "EMAIL CODE: 483920";
  const encoded = Buffer.from(body, "utf8").toString("base64");
  const code = extractPhEtravelOtpFromMessage({
    subject: "eGovPH Verify Email",
    text: `Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${encoded}\r\n--boundary`,
    html: null,
  });

  assert.equal(code, "483920");
});

test("extractPhEtravelOtpFromMessage reads an emphasized standalone eGovPH code", () => {
  const code = extractPhEtravelOtpFromMessage({
    subject: "eGovPH Verify Email",
    text: '<p>Your email code is below.</p><p><b style="font-size: 28px">483920</b></p><img src="https://tracking.example/123456/pixel">',
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

test("isPhEtravelExistingAccountNotice recognizes the official registration notice", () => {
  assert.equal(isPhEtravelExistingAccountNotice({
    subject: "Registration Attempt Notice",
    text: null,
    html: "<p>Our records indicate that an account is already registered using this email.</p>",
  }), true);
  assert.equal(isPhEtravelExistingAccountNotice({
    subject: "Your verification code",
    text: "Use the requested code to continue.",
    html: null,
  }), false);
});

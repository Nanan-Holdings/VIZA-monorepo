import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SA_PRIVACY_POLICY_SHA256,
  SA_PRIVACY_POLICY_URL,
  assertSaudiPrivacyAuthorization,
  hashSaudiPrivacyPolicyText,
  parseSaudiPrivacyAuthorization,
} from "../privacy-authorization.js";
import {
  extractSaudiActivationTrackerUrl,
  extractSaudiActivationUrl,
  isTrustedSaudiActivationMessage,
  resolveSaudiActivationUrl,
} from "../live-flow.js";

const APPLICATION_ID = "00000000-0000-4000-8000-000000000001";
const VALID_ROW = {
  id: "00000000-0000-4000-8000-000000000002",
  application_id: APPLICATION_ID,
  accepted: true,
  document_hash: SA_PRIVACY_POLICY_SHA256,
  consent_scope: {
    official_url: SA_PRIVACY_POLICY_URL,
    source: "viza_application_confirmation",
    account_registration_authorized: true,
    activation_authorized: true,
    login_authorized: true,
  },
  created_at: "2026-08-18T00:00:00.000Z",
  revoked_at: null,
};

test("sa privacy authorization is application-scoped, current, hashed, and auditable", () => {
  const parsed = parseSaudiPrivacyAuthorization(VALID_ROW);
  assert.ok(parsed);
  assert.equal(parsed.applicationId, APPLICATION_ID);
  assert.doesNotThrow(() => assertSaudiPrivacyAuthorization(parsed, APPLICATION_ID));
  assert.throws(
    () => assertSaudiPrivacyAuthorization(parsed, "00000000-0000-4000-8000-000000000099"),
    /explicit, current Privacy Policy authorization/,
  );
});

test("sa privacy authorization rejects revoked, stale-hash, and incomplete scope rows", () => {
  assert.equal(parseSaudiPrivacyAuthorization({ ...VALID_ROW, revoked_at: "2026-08-18T01:00:00.000Z" }), null);
  assert.equal(parseSaudiPrivacyAuthorization({ ...VALID_ROW, document_hash: "stale" }), null);
  assert.equal(parseSaudiPrivacyAuthorization({
    ...VALID_ROW,
    consent_scope: { ...VALID_ROW.consent_scope, login_authorized: false },
  }), null);
});

test("sa privacy snapshot hash normalizes whitespace", () => {
  assert.equal(hashSaudiPrivacyPolicyText(" Privacy   Policy\nText "), hashSaudiPrivacyPolicyText("Privacy Policy Text"));
});

test("sa activation extraction accepts only VisitSaudi HTTPS verification links", () => {
  const valid = extractSaudiActivationUrl(
    "Activate: https://visa.visitsaudi.com/Registration/Activate?token=redacted",
  );
  assert.equal(valid?.hostname, "visa.visitsaudi.com");
  assert.equal(extractSaudiActivationUrl("https://evil.example/activate?token=secret"), null);
  assert.equal(extractSaudiActivationUrl("http://visa.visitsaudi.com/Registration/Activate?token=secret"), null);
});

test("sa activation mail requires aligned receiver-authenticated VisitSaudi identity", () => {
  assert.equal(isTrustedSaudiActivationMessage({
    from_addr: "bounce@wrqvznpx.outbound-mail.sendgrid.net",
    subject: "Saudi eVisa account activation",
    headers: {
      "authentication-results": "mx.cloudflare.net; spf=none smtp.mailfrom=bounce@wrqvznpx.outbound-mail.sendgrid.net; dkim=pass header.d=visitsaudi.com; dmarc=pass header.from=visitsaudi.com",
      from: "Saudi eVisa <noreply@visitsaudi.com>",
    },
  }), true);
  assert.equal(isTrustedSaudiActivationMessage({
    from_addr: "bounce@mailer.invalid",
    subject: "Saudi eVisa account activation",
    headers: {
      "authentication-results": "attacker.example; dkim=pass header.d=visitsaudi.com; dmarc=pass header.from=visitsaudi.com",
      from: "Saudi eVisa <noreply@visitsaudi.com>",
    },
  }), false);
});

test("sa activation resolves one trusted SendGrid hop and revalidates the official destination", async () => {
  const tracker = "https://mail.ct.sendgrid.net/ls/click?upn=opaque";
  assert.equal(extractSaudiActivationTrackerUrl(tracker)?.hostname, "mail.ct.sendgrid.net");
  const resolved = await resolveSaudiActivationUrl(tracker, async () => new Response(null, {
    status: 302,
    headers: {
      location: "https://visa.visitsaudi.com/Registration/AddLoadActivation/redacted",
    },
  }));
  assert.equal(resolved?.hostname, "visa.visitsaudi.com");
  assert.equal(await resolveSaudiActivationUrl(tracker, async () => new Response(null, {
    status: 302,
    headers: { location: "https://evil.example/activate" },
  })), null);
});

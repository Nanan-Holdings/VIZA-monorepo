import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractTrVerificationUrl,
  hasTrustedTrMailAuthentication,
  isTrVerificationEmail,
} from "../email.js";
import type { InboundMessage } from "../../inbox/wait-for-message.js";

function message(overrides: Partial<InboundMessage> = {}): InboundMessage {
  return {
    id: "mail-1",
    to_addr: "managed@example.test",
    from_addr: "noreply@evisa.gov.tr",
    subject: "E-mail address verification message REF: TR-ABC123",
    message_id: null,
    text: null,
    html: null,
    headers: {
      from: "Türkiye e-Visa <noreply@evisa.gov.tr>",
      "authentication-results":
        "mx.cloudflare.net; dkim=pass header.d=evisa.gov.tr; " +
        "dmarc=pass header.from=evisa.gov.tr",
    },
    raw_size: 1,
    r2_key: null,
    spam_score: null,
    received_at: "2026-08-18T00:00:00.000Z",
    processed: false,
    ...overrides,
  };
}

test("Türkiye email parser accepts only trusted official verification links", () => {
  const official = message({
    html: '<a href="https://evisa.gov.tr/en/email/opaque-token?x=3D1&amp;y=3D2">Approve</a>',
  });
  assert.equal(
    extractTrVerificationUrl(official),
    "https://evisa.gov.tr/en/email/opaque-token?x=1&y=2",
  );
  assert.equal(isTrVerificationEmail(official, "TR-ABC123"), true);

  const phishing = message({
    from_addr: "noreply@attacker.test",
    headers: null,
    html: '<a href="https://evisa.gov.tr/en/email/attacker-token">Approve</a>',
  });
  assert.equal(isTrVerificationEmail(phishing, "TR-ABC123"), false);

  const duplicateAuthResults = message({
    headers: {
      from: "Türkiye e-Visa <noreply@evisa.gov.tr>",
      "authentication-results":
        "mx.cloudflare.net; dkim=fail header.d=evisa.gov.tr; dmarc=fail header.from=evisa.gov.tr\n" +
        "mx.cloudflare.net; dkim=pass header.d=evisa.gov.tr; dmarc=pass header.from=evisa.gov.tr",
    },
    html: '<a href="https://evisa.gov.tr/en/email/attacker-token">Approve</a>',
  });
  assert.equal(hasTrustedTrMailAuthentication(duplicateAuthResults), false);
  assert.equal(isTrVerificationEmail(duplicateAuthResults, "TR-ABC123"), false);

  const mixedSignatureResults = message({
    headers: {
      from: "Türkiye e-Visa <noreply@evisa.gov.tr>",
      "authentication-results":
        "mx.cloudflare.net; dkim=pass header.d=evil.example; " +
        "dkim=fail header.d=evisa.gov.tr; dmarc=fail header.from=evisa.gov.tr",
    },
    html: '<a href="https://evisa.gov.tr/en/email/attacker-token">Approve</a>',
  });
  assert.equal(hasTrustedTrMailAuthentication(mixedSignatureResults), false);
  assert.equal(isTrVerificationEmail(mixedSignatureResults, "TR-ABC123"), false);

  const mixedDmarcResults = message({
    headers: {
      from: "Türkiye e-Visa <noreply@evisa.gov.tr>",
      "authentication-results":
        "mx.cloudflare.net; dkim=pass header.d=evisa.gov.tr; " +
        "dmarc=pass header.from=evil.example; dmarc=fail header.from=evisa.gov.tr",
    },
    html: '<a href="https://evisa.gov.tr/en/email/attacker-token">Approve</a>',
  });
  assert.equal(hasTrustedTrMailAuthentication(mixedDmarcResults), false);
  assert.equal(isTrVerificationEmail(mixedDmarcResults, "TR-ABC123"), false);

  assert.equal(isTrVerificationEmail(official, "TR-OTHER999"), false);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import type { InboundMessage } from "../../inbox/wait-for-message.js";
import {
  classifyCanadaPasswordResetCandidate,
  extractCanadaPasswordResetCode,
  generateCanadaPortalPassword,
  isTrustedCanadaPasswordResetMessage,
} from "../password-recovery.js";

const TRUSTED_AUTHENTICATION_RESULTS =
  "mx.cloudflare.net; spf=pass smtp.mailfrom=bounce@amazonses.com; " +
  "dkim=pass header.d=notification.portal-portail.apps.cic.gc.ca; " +
  "dmarc=pass header.from=notification.portal-portail.apps.cic.gc.ca";

function message(overrides: Partial<InboundMessage> = {}): InboundMessage {
  return {
    id: "fixture-message",
    to_addr: "managed@example.test",
    from_addr: "bounce@amazonses.com",
    subject: "IRCC Portal - next steps",
    message_id: "fixture",
    text:
      "Confirmation of sign up to IRCC Portal/Forgot password/Lost verification code. " +
      "Enter this code [482731] on this page. To reset your password, enter the code noted above.",
    html: null,
    headers: {
      from: "IRCC Portal <notification@notification.portal-portail.apps.cic.gc.ca>",
      "authentication-results": TRUSTED_AUTHENTICATION_RESULTS,
    },
    raw_size: 500,
    r2_key: null,
    spam_score: null,
    received_at: "2026-08-18T00:00:00.000Z",
    processed: false,
    ...overrides,
  };
}

test("CA recovery accepts only authenticated official IRCC reset mail", () => {
  assert.equal(isTrustedCanadaPasswordResetMessage(message()), true);
  assert.equal(
    isTrustedCanadaPasswordResetMessage(
      message({ headers: { from: "attacker@example.test" } }),
    ),
    false,
  );
  assert.equal(
    isTrustedCanadaPasswordResetMessage(
      message({
        headers: {
          from: "IRCC Portal <notification@notification.portal-portail.apps.cic.gc.ca>",
          "authentication-results": TRUSTED_AUTHENTICATION_RESULTS.replace(
            "spf=pass",
            "spf=fail",
          ),
        },
      }),
    ),
    false,
  );
  assert.equal(
    isTrustedCanadaPasswordResetMessage(
      message({ from_addr: "attacker@amazonses.com.evil.example" }),
    ),
    false,
  );
});

test("CA recovery ignores forged and ambiguous Authentication-Results headers", () => {
  assert.equal(
    isTrustedCanadaPasswordResetMessage(
      message({
        headers: {
          from: "IRCC Portal <notification@notification.portal-portail.apps.cic.gc.ca>",
          "authentication-results":
            "attacker.invalid; spf=pass; " +
            "dkim=pass header.d=notification.portal-portail.apps.cic.gc.ca; " +
            "dmarc=pass header.from=notification.portal-portail.apps.cic.gc.ca",
        },
      }),
    ),
    false,
  );
  assert.equal(
    isTrustedCanadaPasswordResetMessage(
      message({
        headers: {
          from: "IRCC Portal <notification@notification.portal-portail.apps.cic.gc.ca>",
          "authentication-results":
            `${TRUSTED_AUTHENTICATION_RESULTS}\n` +
            "mx.cloudflare.net; spf=fail; dkim=fail; dmarc=fail",
        },
      }),
    ),
    false,
  );
  assert.equal(
    isTrustedCanadaPasswordResetMessage(
      message({
        headers: {
          from: "IRCC Portal <notification@notification.portal-portail.apps.cic.gc.ca>",
          "authentication-results": TRUSTED_AUTHENTICATION_RESULTS.replace(
            "header.d=notification.portal-portail.apps.cic.gc.ca",
            "header.d=amazonses.com",
          ),
        },
      }),
    ),
    false,
  );
});

test("CA mailbox matcher accepts only trusted mail with one unambiguous code", () => {
  const forged = message({
    headers: {
      from: "IRCC Portal <notification@notification.portal-portail.apps.cic.gc.ca>",
      "authentication-results":
        "attacker.invalid; spf=pass; dkim=pass header.d=notification.portal-portail.apps.cic.gc.ca; " +
        "dmarc=pass header.from=notification.portal-portail.apps.cic.gc.ca",
    },
  });
  assert.deepEqual(classifyCanadaPasswordResetCandidate(forged), {
    status: "untrusted",
  });
  assert.deepEqual(
    classifyCanadaPasswordResetCandidate(
      message({
        text:
          "IRCC Portal reset your password. Enter this code [482731]. " +
          "Confirmation code: 937155.",
      }),
    ),
    { status: "unreadable" },
  );
  assert.deepEqual(classifyCanadaPasswordResetCandidate(message()), {
    status: "ready",
    code: "482731",
  });
});

test("CA recovery extracts only one context-bound six-digit code", () => {
  assert.equal(extractCanadaPasswordResetCode(message()), "482731");
  assert.equal(
    extractCanadaPasswordResetCode(
      message({ text: "Reference 482731 created in 2026; no code instruction." }),
    ),
    null,
  );
  assert.equal(
    extractCanadaPasswordResetCode(
      message({ text: "Enter this code [482731]. Confirmation code: 937155." }),
    ),
    null,
  );
});

test("CA generated portal passwords satisfy the current IRCC policy", () => {
  for (let index = 0; index < 100; index += 1) {
    const password = generateCanadaPortalPassword();
    assert.match(password, /^[\x21-\x7e]{8,15}$/);
    assert.match(password, /[A-Z]/);
    assert.match(password, /[a-z]/);
    assert.match(password, /[0-9]/);
    assert.match(password, /[^A-Za-z0-9]/);
  }
});

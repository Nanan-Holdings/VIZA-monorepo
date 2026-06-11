/**
 * Snapshot tests for INBOX-004 extractors against five anonymised real
 * sample messages. Each `from / subject / text` triplet is a redacted
 * capture from a live run; numbers and reference codes have been
 * replaced with synthetic but format-equivalent values.
 *
 * Run with:
 *   npx tsx --test src/inbox/extractors/__tests__/extractors.spec.ts
 *
 * (The `--test` runner is built into Node ≥ 18; no extra deps.)
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { extractAuto } from "../index.js";

test("vfsglobal — verification code OTP", () => {
  const result = extractAuto({
    from: "no-reply@vfsglobal.com",
    subject: "Verification code: 482917",
    text: "Hello,\n\nYour one-time password is 482917. It expires in 10 minutes.\n\nVisit https://visa.vfsglobal.com/usa/en/ita/account/activate?token=abc to continue.\n",
  });
  assert.equal(result.profileId, "vfsglobal");
  assert.equal(result.code, "482917");
  assert.match(result.link ?? "", /vfsglobal\.com\/usa/);
});

test("evisa.xuatnhapcanh.gov.vn — registration code, no OTP", () => {
  const result = extractAuto({
    from: "no-reply@evisa.xuatnhapcanh.gov.vn",
    subject: "E-VISA Application registration",
    text: "Dear Applicant,\n\nYour registration code is AB12CD34EF5678. Please save this for the result page.\n\nResult: https://evisa.xuatnhapcanh.gov.vn/EN/result?code=AB12CD34EF5678\n",
  });
  assert.equal(result.profileId, "evisa-gov-vn");
  assert.equal(result.reference, "AB12CD34EF5678");
  assert.match(result.link ?? "", /xuatnhapcanh\.gov\.vn/);
  assert.equal(result.code, undefined);
});

test("ceac.state.gov — DS-160 application id", () => {
  const result = extractAuto({
    from: "donotreply@state.gov",
    subject: "DS-160 Confirmation",
    text: "Application ID: AA00ABC123\nThank you for completing your DS-160.\nYou may view your confirmation at https://ceac.state.gov/genniv/Default.aspx\n",
  });
  assert.equal(result.profileId, "ceac-state-gov");
  assert.equal(result.reference, "AA00ABC123");
  assert.match(result.link ?? "", /ceac\.state\.gov/);
});

test("gov.uk — UKVI security code", () => {
  const result = extractAuto({
    from: "no-reply@notifications.service.gov.uk",
    subject: "Your UK Visa security code",
    text: "Your security code is 304921.\n\nResume your application: https://apply-uk-visa.service.gov.uk/forceResume?token=xyz\n\nApplication number GWF000123456.\n",
  });
  assert.equal(result.profileId, "gov-uk");
  assert.equal(result.code, "304921");
  assert.match(result.link ?? "", /apply-uk-visa\.service\.gov\.uk/);
  assert.equal(result.reference, "GWF000123456");
});

test("usvisascheduling — appointment account verification code and link", () => {
  const result = extractAuto({
    from: "donotreply@usvisascheduling.com",
    subject: "Verify your email address",
    text: "Your verification code is 814209.\n\nContinue at https://www.usvisascheduling.com/en-US/account/verify?token=sample-token\n",
  });
  assert.equal(result.profileId, "usvisascheduling");
  assert.equal(result.code, "814209");
  assert.match(result.link ?? "", /usvisascheduling\.com/);
});

test("unknown sender — generic 6-digit fallback", () => {
  const result = extractAuto({
    from: "noreply@unknown-portal.example",
    subject: "Your verification code",
    text: "Use 765432 to confirm. This code expires in 5 minutes.",
  });
  assert.equal(result.profileId, "generic-6digit");
  assert.equal(result.code, "765432");
  assert.equal(result.reference, undefined);
});

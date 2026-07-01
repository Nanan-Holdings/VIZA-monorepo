import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertUSAppointmentAutoVerificationConfig,
  generateUSAppointmentAccountPassword,
  resolveUSAppointmentAccountEmail,
} from "../registration-script";
import { extractAuto } from "../../inbox/extractors";

test("US appointment registration uses applicant inbox alias when email is omitted", async () => {
  const result = await resolveUSAppointmentAccountEmail({
    explicitEmail: undefined,
    applicantId: "profile-1",
    ensureAlias: async (applicantId) => ({
      alias: `appl-${applicantId}@haggstorm.com`,
      created: true,
    }),
  });

  assert.deepEqual(result, {
    email: "appl-profile-1@haggstorm.com",
    source: "applicant_inbox_alias",
    aliasCreated: true,
  });
});

test("US appointment registration keeps explicit email ahead of applicant alias", async () => {
  let aliasCalled = false;
  const result = await resolveUSAppointmentAccountEmail({
    explicitEmail: " applicant@example.com ",
    applicantId: "profile-1",
    ensureAlias: async () => {
      aliasCalled = true;
      return { alias: "appl-profile-1@haggstorm.com", created: false };
    },
  });

  assert.equal(result.email, "applicant@example.com");
  assert.equal(result.source, "explicit");
  assert.equal(aliasCalled, false);
});

test("US appointment registration requires applicant-id for automatic email verification", () => {
  assert.throws(
    () => assertUSAppointmentAutoVerificationConfig({
      autoVerifyEmail: true,
      applicantId: undefined,
    }),
    /--applicant-id/,
  );
});

test("US appointment registration extracts Email Worker verification codes", () => {
  const parsed = extractAuto({
    from: "Do Not Reply <no-reply@do-not-reply.usvisascheduling.com>",
    subject: "Verify your USVisaScheduling account",
    text: "Your verification code is 654321. This code expires shortly.",
    html: null,
  });

  assert.equal(parsed.profileId, "usvisascheduling");
  assert.equal(parsed.code, "654321");
});

test("US appointment registration can generate a strong account password", () => {
  const password = generateUSAppointmentAccountPassword(() => Buffer.from("0123456789abcdef0123456789abcdef"));

  assert.match(password, /^VizaUS-/);
  assert.match(password, /[A-Z]/);
  assert.match(password, /[a-z]/);
  assert.match(password, /[0-9]/);
  assert.match(password, /[!#]/);
  assert.ok(password.length >= 8);
  assert.ok(password.length <= 16);
});

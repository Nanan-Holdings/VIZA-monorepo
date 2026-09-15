import { test, mock } from "node:test";
import assert from "node:assert/strict";
import type { InboundMessage } from "../../inbox/wait-for-message";

process.env.SUPABASE_URL ??= "http://127.0.0.1:1";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-key";

const request = {
  since: "2026-09-14T10:00:00.000Z", accountEmail: "appl-test@viza.it.com",
  applicationId: "application-1", accountId: "account-1",
};
const message: InboundMessage = {
  id: "message-1", to_addr: request.accountEmail,
  from_addr: "Microsoft <msonlineservicesteam@microsoftonline.com>",
  subject: "US Visa & American Citizen Services account email verification code",
  text: "Your verification code is 123456.", html: null, message_id: null,
  headers: null, raw_size: 100, r2_key: null, spam_score: null,
  received_at: "2026-09-14T10:00:01.000Z", processed: false,
};

test("registration inbox accepts official display-name senders and rejects stale, unrelated, or spoofed mail", async () => {
  const { isUSVisaSchedulingVerification } = await import("../inbox");
  assert.equal(isUSVisaSchedulingVerification(message, request), true);
  for (const override of [
    { received_at: "2026-09-14T09:59:59.000Z" },
    { to_addr: "another@viza.it.com" },
    { from_addr: "no-reply@evilusvisascheduling.com" },
    { from_addr: "no-reply@usvisascheduling.com.evil.test" },
    { subject: "Appointment confirmation 123456" },
    { text: "Continue at https://www.usvisascheduling.com/account/verify?token=example" },
  ]) {
    assert.equal(isUSVisaSchedulingVerification({ ...message, ...override }, request), false);
  }
});

test("registration mailbox reads the immutable account alias after the actual send action", async () => {
  const { inbox } = await import("../../inbox/wait-for-message");
  const { waitForUSAppointmentVerificationEmail } = await import("../inbox");
  const read = mock.method(inbox, "waitForAppointmentAccountMessage", async (
    ...[input, predicate, timeout, opts]: Parameters<typeof inbox.waitForAppointmentAccountMessage>
  ) => {
    assert.deepEqual(input, { applicantId: "applicant-1", applicationId: request.applicationId, accountId: request.accountId, portal: "usvisascheduling" });
    assert.equal(timeout, 500);
    assert.deepEqual(opts, { since: request.since, newestFirst: true });
    assert.equal(predicate(message), true);
    return message;
  });
  try {
    const result = await waitForUSAppointmentVerificationEmail("applicant-1", 500, request);
    assert.equal(result.code, "123456");
    assert.equal(read.mock.callCount(), 1);
    await assert.rejects(waitForUSAppointmentVerificationEmail("applicant-1", 500, { ...request, since: "invalid" }));
    assert.equal(read.mock.callCount(), 1);
  } finally { read.mock.restore(); }
});

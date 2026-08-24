import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL ??= "https://sgac-runner-email-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "sgac-runner-email-test-key";

test("SGAC routes every official email field through the managed application alias", async () => {
  const { routeSgacEmailAnswers } = await import("../runner.js");
  const routed = routeSgacEmailAnswers(
    {
      email: "personal@example.com",
      email_address: "personal@example.com",
      full_name: "Applicant Name",
    },
    "  APPL-TEST@VIZA.IT.COM ",
  );

  assert.equal(routed.email, "appl-test@viza.it.com");
  assert.equal(routed.email_address, "appl-test@viza.it.com");
  assert.equal(routed.full_name, "Applicant Name");
});

test("SGAC rejects an unusable managed alias before opening ICA", async () => {
  const { routeSgacEmailAnswers } = await import("../runner.js");
  assert.throws(
    () => routeSgacEmailAnswers({ email: "personal@example.com" }, "not-an-email"),
    /managed inbox alias is invalid/i,
  );
});

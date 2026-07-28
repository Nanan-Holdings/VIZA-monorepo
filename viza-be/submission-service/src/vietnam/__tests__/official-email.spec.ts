import assert from "node:assert/strict";
import { test } from "node:test";
import { applyVietnamOfficialLookupEmail } from "../official-email.js";

test("vn.official-email: overrides only official email fields with the VIZA alias", () => {
  const original = {
    email_address: "personal@example.com",
    re_enter_email_address: "personal@example.com",
    full_name: "Synthetic Applicant",
  };
  const result = applyVietnamOfficialLookupEmail(
    original,
    "  VN-ALIAS@INBOX.EXAMPLE  ",
  );
  assert.equal(result.email_address, "vn-alias@inbox.example");
  assert.equal(result.re_enter_email_address, "vn-alias@inbox.example");
  assert.equal(result.full_name, original.full_name);
  assert.equal(original.email_address, "personal@example.com");
  assert.equal("create_account_by_email" in result, false);
});

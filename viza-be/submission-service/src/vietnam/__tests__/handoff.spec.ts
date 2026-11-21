import assert from "node:assert/strict";
import test from "node:test";
import { extractVietnamHandoffReference, inspectVietnamHandoffSnapshot } from "../handoff";
import { isVietnamApplicantHandoffState } from "../run";

const at = "2026-11-19T00:00:00.000Z";

test("Vietnam handoff stops only at the review CAPTCHA or later official checkpoints", () => {
  assert.equal(isVietnamApplicantHandoffState("captcha_visible"), true);
  assert.equal(isVietnamApplicantHandoffState("final_submit_visible"), true);
  assert.equal(isVietnamApplicantHandoffState("registration_code_visible"), true);
  assert.equal(isVietnamApplicantHandoffState("payment_page_visible"), true);
  assert.equal(isVietnamApplicantHandoffState("application_form_visible"), false);
  assert.equal(isVietnamApplicantHandoffState("layout_changed"), false);
});

test("Vietnam review page without an electronic document code is not submitted", () => {
  const inspection = inspectVietnamHandoffSnapshot({
    url: "https://evisa.gov.vn/e-visa/foreigners",
    text: "Application number for reference ABCD12345 Please enter the verification code Next",
    capturedAt: at,
  });
  assert.equal(inspection.outcome, "pending");
});

test("Vietnam electronic document code after the applicant's submit is the receipt", () => {
  const inspection = inspectVietnamHandoffSnapshot({
    url: "https://evisa.gov.vn/e-visa/foreigners",
    text: "DECLARATION COMPLETED Electronic document code: E251119ABCD12345 Confirm",
    capturedAt: at,
  });
  assert.equal(inspection.outcome, "submitted");
  if (inspection.outcome !== "submitted") return;
  assert.equal(inspection.final, false);
  assert.equal(inspection.receipt.reference, "E251119ABCD12345");
  assert.equal(inspection.receipt.source, "official_portal_after_applicant_submit");
});

test("Vietnam payment success with the code closes the handoff", () => {
  const inspection = inspectVietnamHandoffSnapshot({
    url: "https://evisa.gov.vn/e-visa/payment",
    text: "Registration code: E251119ABCD12345 Payment successful",
    capturedAt: at,
  });
  assert.equal(inspection.outcome, "submitted");
  if (inspection.outcome === "submitted") assert.equal(inspection.final, true);
});

test("Vietnam handoff ignores non-official hosts and passport-like numbers", () => {
  assert.equal(
    inspectVietnamHandoffSnapshot({ url: "https://evil.example/", text: "Electronic document code: E251119ABCD12345", capturedAt: at }).outcome,
    "pending",
  );
  assert.equal(extractVietnamHandoffReference("Passport E12345678"), undefined);
});

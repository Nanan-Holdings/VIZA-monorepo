import { describe, expect, it } from "vitest";
import {
  AWAITING_APPLICANT_STATUS,
  buildResultObjectPath,
  customerStatusDetail,
  planOutcomeTransition,
  resultPathPrefix,
  submittedOnToTimestamp,
  validateOutcomeInput,
  type OutcomeApplicationState,
} from "./outcome-transitions";

// Mirrors the allowlists /client/status reads (app/client/status/status-data.ts).
const CLIENT_APPROVED = new Set(["approved", "approved_pending_document", "issued", "granted"]);
const CLIENT_REJECTED = new Set(["rejected", "refused", "denied"]);
const CLIENT_ATTENTION = new Set(["failed", "error", "needs_attention", "blocked", "rejected"]);
const CLIENT_EXTERNAL_ACTIVE = new Set(["submitted", "received", "in_review", "processing", "under_review"]);
// Statuses applications_one_ongoing_country_visa_idx treats as closed.
const INDEX_CLOSED = new Set(["submitted", "submitted_mock", "form_ready_for_agency", "completed", "approved", "rejected", "cancelled", "canceled", "archived", "failed", "stalled"]);

const APP_ID = "33333333-3333-4333-8333-333333333333";
const NOW = new Date("2026-10-19T08:00:00Z");
const base: OutcomeApplicationState = {
  id: APP_ID,
  status: "staff_action_required",
  external_status: null,
  external_reference: null,
  result_status: null,
  submitted_at: null,
};
const filePath = `${resultPathPrefix(APP_ID)}20261019T080000-evisa.pdf`;

describe("validateOutcomeInput", () => {
  it("requires a clean government reference and a non-future date for submitted", () => {
    expect(validateOutcomeInput(APP_ID, { kind: "submitted", reference: "" }, NOW).ok).toBe(false);
    expect(validateOutcomeInput(APP_ID, { kind: "submitted", reference: "<script>" }, NOW).ok).toBe(false);
    expect(validateOutcomeInput(APP_ID, { kind: "submitted", reference: "JP-2026/0099", submittedOn: "2026-13-01" }, NOW).ok).toBe(false);
    expect(validateOutcomeInput(APP_ID, { kind: "submitted", reference: "JP-2026/0099", submittedOn: "2026-11-30" }, NOW).ok).toBe(false);
    const ok = validateOutcomeInput(APP_ID, { kind: "submitted", reference: " JP-2026/0099 ", submittedOn: "2026-10-18" }, NOW);
    expect(ok).toEqual({ ok: true, value: { kind: "submitted", reference: "JP-2026/0099", submittedOn: "2026-10-18" } });
  });

  it("requires an uploaded file for approval, scoped to this application", () => {
    expect(validateOutcomeInput(APP_ID, { kind: "approved" }).ok).toBe(false);
    expect(validateOutcomeInput(APP_ID, { kind: "approved", resultStoragePath: "application-documents/results/other-app/x.pdf" }).ok).toBe(false);
    expect(validateOutcomeInput(APP_ID, { kind: "approved", resultStoragePath: `${resultPathPrefix(APP_ID)}../../x.pdf` }).ok).toBe(false);
    expect(validateOutcomeInput(APP_ID, { kind: "approved", resultStoragePath: filePath }).ok).toBe(true);
  });

  it("requires a reason for refusal and a message for needs-info", () => {
    expect(validateOutcomeInput(APP_ID, { kind: "refused", reason: "  " }).ok).toBe(false);
    expect(validateOutcomeInput(APP_ID, { kind: "refused", reason: "x".repeat(2001) }).ok).toBe(false);
    expect(validateOutcomeInput(APP_ID, { kind: "refused", reason: "Insufficient funds" }).ok).toBe(true);
    expect(validateOutcomeInput(APP_ID, { kind: "needs_info", message: "" }).ok).toBe(false);
    expect(validateOutcomeInput(APP_ID, { kind: "needs_info", message: "Bank statement" }).ok).toBe(true);
  });
});

describe("planOutcomeTransition", () => {
  it("submitted: records the reference and date in fields the client already shows", () => {
    const plan = planOutcomeTransition(base, { kind: "submitted", reference: "JP-1", submittedOn: "2026-10-18" }, "staff-1", NOW);
    expect(plan.toStatus).toBe("submitted");
    expect(plan.patch).toMatchObject({
      status: "submitted",
      external_status: "submitted",
      external_reference: "JP-1",
      submitted_at: submittedOnToTimestamp("2026-10-18"),
      staff_reviewed_by: "staff-1",
    });
    expect(plan.patch.submitted_at).toBe("2026-10-17T16:00:00.000Z");
    expect(CLIENT_EXTERNAL_ACTIVE.has(plan.patch.external_status as string)).toBe(true);
    expect(INDEX_CLOSED.has(plan.toStatus)).toBe(true);
    expect(plan.history).toMatchObject({ from_status: "staff_action_required", to_status: "submitted", actor_kind: "staff", reason: "submitted" });
    expect(plan.event.event_type).toBe("external_status_updated");
    expect(plan.notification.event).toBe("submitted");
    expect(plan.notification.detailByLocale?.en).toContain("JP-1");
    expect(plan.notification.detailByLocale?.["zh-CN"]).toContain("JP-1");
  });

  it("submitted after a needs-info request clears the attention flag", () => {
    const plan = planOutcomeTransition({ ...base, status: AWAITING_APPLICANT_STATUS, result_status: "needs_attention" }, { kind: "submitted", reference: "JP-2" }, "s", NOW);
    expect(plan.patch.result_status).toBeNull();
    expect(plan.patch.result_notes).toBeNull();
    expect(plan.patch.submitted_at).toBe(NOW.toISOString());
  });

  it("approved: attaches the file so the client lists it as the approved result", () => {
    const plan = planOutcomeTransition({ ...base, status: "submitted", submitted_at: "2026-10-01T00:00:00Z" }, { kind: "approved", resultStoragePath: filePath }, "s", NOW);
    expect(plan.patch).toMatchObject({ status: "approved", result_status: "approved", result_storage_path: filePath });
    expect(plan.patch.submitted_at).toBeUndefined();
    expect(CLIENT_APPROVED.has(plan.patch.result_status as string)).toBe(true);
    expect(CLIENT_APPROVED.has(plan.patch.status as string)).toBe(true);
    expect(plan.event.event_type).toBe("result_received");
    expect(plan.notification.event).toBe("visa_approved");
  });

  it("refused: stores the reason and emails it", () => {
    const plan = planOutcomeTransition({ ...base, status: "submitted" }, { kind: "refused", reason: "Insufficient funds" }, "s", NOW);
    expect(plan.patch).toMatchObject({ status: "rejected", result_status: "refused", result_notes: "Insufficient funds" });
    expect(plan.patch.result_storage_path).toBeUndefined();
    expect(CLIENT_REJECTED.has(plan.patch.result_status as string)).toBe(true);
    expect(CLIENT_REJECTED.has(plan.toStatus)).toBe(true);
    expect(plan.notification.event).toBe("visa_refused");
    expect(plan.notification.detailByLocale?.en).toContain("Insufficient funds");
  });

  it("needs_info: flags attention for the applicant and keeps the message", () => {
    const plan = planOutcomeTransition(base, { kind: "needs_info", message: "Upload a bank statement" }, "s", NOW);
    expect(plan.toStatus).toBe(AWAITING_APPLICANT_STATUS);
    expect(plan.patch).toMatchObject({ result_status: "needs_attention", result_notes: "Upload a bank statement" });
    expect(CLIENT_ATTENTION.has(plan.patch.result_status as string)).toBe(true);
    expect(plan.event.event_type).toBe("more_information_requested");
    expect(plan.notification).toEqual({ event: "info_requested", detailByLocale: { en: "Upload a bank statement", "zh-CN": "Upload a bank statement" } });
  });
});

describe("helpers", () => {
  it("builds a safe, unique object path inside the application's result folder", () => {
    const path = buildResultObjectPath(APP_ID, "../../My Visa (final).PDF", NOW);
    expect(path).toBe(`results/${APP_ID}/20261019T080000-My-Visa-final.pdf`);
    expect(`application-documents/${path}`.startsWith(resultPathPrefix(APP_ID))).toBe(true);
    expect(buildResultObjectPath(APP_ID, "签证.pdf", NOW)).toBe(`results/${APP_ID}/20261019T080000-result.pdf`);
  });

  it("gives a customer-safe status line in both languages", () => {
    expect(customerStatusDetail("external_submission").en).toContain("with the government");
    expect(customerStatusDetail("document_collection")["zh-CN"]).toContain("上传");
    expect(customerStatusDetail("unknown_state").en).toBe(customerStatusDetail("intake").en);
  });
});

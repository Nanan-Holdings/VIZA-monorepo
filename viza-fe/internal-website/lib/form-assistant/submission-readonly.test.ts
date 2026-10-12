import { describe, expect, it } from "vitest";
import type { FormAssistantState } from "@/types/form-assistant";
import {
  hasSuccessfulFormSubmission,
  toSubmittedFormAssistantProgress,
  toSubmittedFormAssistantState,
} from "./submission-readonly";

describe("hasSuccessfulFormSubmission", () => {
  it("locks a durable successful non-arrival-card result", () => {
    expect(hasSuccessfulFormSubmission({
      country: "united_states",
      visaType: "US_DS160",
      submissionResultStatus: "submitted",
      submissionResult: { country: "US", status: "submitted", applicationId: "AA00" },
    })).toBe(true);
  });

  it("does not lock from a status string without a durable result", () => {
    expect(hasSuccessfulFormSubmission({
      country: "united_states",
      visaType: "US_DS160",
      submissionResultStatus: "submitted",
      submissionResult: null,
    })).toBe(false);
  });

  it("keeps recoverable and handoff results editable", () => {
    expect(hasSuccessfulFormSubmission({
      country: "australia",
      visaType: "AU_SUBCLASS_600",
      submissionResultStatus: "stopped_at_review",
      submissionResult: { country: "AU", status: "stopped_at_review", trn: "TRN" },
    })).toBe(false);
  });

  it("prefers an explicit failed payload over a stale successful column status", () => {
    expect(hasSuccessfulFormSubmission({
      country: "australia",
      visaType: "AU_SUBCLASS_600",
      submissionResultStatus: "submitted",
      submissionResult: { country: "AU", status: "failed", error: "portal rejected" },
    })).toBe(false);
  });

  it.each([
    ["singapore", "SG_ARRIVAL_CARD", "SG"],
    ["malaysia", "MY_MDAC_ARRIVAL_CARD", "MY"],
    ["thailand", "TH_TDAC_ARRIVAL_CARD", "TH"],
  ])("locks a successful %s arrival-card result", (country, visaType, resultCountry) => {
    expect(hasSuccessfulFormSubmission({
      country,
      visaType,
      submissionResultStatus: "submitted",
      submissionResult: {
        country: resultCountry,
        visaType,
        status: "submitted",
        submitted: true,
      },
    })).toBe(true);
  });

  it("uses the dedicated Japan QR and Kenya reference evidence contracts", () => {
    expect(hasSuccessfulFormSubmission({
      country: "japan",
      visaType: "JP_VISIT_JAPAN_WEB",
      submissionResultStatus: "qr_ready",
      submissionResult: {
        visaType: "JP_VISIT_JAPAN_WEB",
        status: "qr_ready",
        qrReady: true,
        artifacts: { qrCodes: ["applications/japan/qr.png"] },
      },
    })).toBe(true);
    expect(hasSuccessfulFormSubmission({
      country: "japan",
      visaType: "JP_VISIT_JAPAN_WEB",
      submissionResultStatus: "qr_ready",
      submissionResult: {
        visaType: "JP_VISIT_JAPAN_WEB",
        status: "qr_ready",
        qrReady: true,
        artifacts: { qrCodes: [] },
      },
    })).toBe(false);
    expect(hasSuccessfulFormSubmission({
      country: "kenya",
      visaType: "KE_ETA",
      submissionResultStatus: "submitted",
      submissionResult: {
        visaType: "KE_ETA",
        status: "submitted",
        referenceNumber: "KE-REFERENCE",
      },
    })).toBe(true);
  });

  it("preserves Korea's issue-number, official-portal, and PDF evidence contract", () => {
    const base = {
      country: "south_korea",
      visaType: "KR_E_ARRIVAL_CARD",
      submissionResultStatus: "submitted",
    };
    expect(hasSuccessfulFormSubmission({
      ...base,
      submissionResult: {
        country: "KR",
        visaType: "KR_E_ARRIVAL_CARD",
        status: "submitted",
        submitted: true,
      },
    })).toBe(false);
    expect(hasSuccessfulFormSubmission({
      ...base,
      submissionResult: {
        country: "KR",
        visaType: "KR_E_ARRIVAL_CARD",
        status: "submitted",
        submitted: true,
        issueNumber: "EAC-123456",
        portalUrl: "https://www.e-arrivalcard.go.kr/portal/check",
        confirmationPdfStoragePath: "applications/result.pdf",
      },
    })).toBe(true);
  });

  it("freezes submitted assistant readiness without discarding its history", () => {
    const state: FormAssistantState = {
      sessionId: "session-id",
      assistantMessage: "Old current question",
      appliedPatches: [],
      skippedConflicts: [],
      missingFields: [{
        stepId: 2,
        stepName: "Trip",
        fieldName: "arrival_date",
        label: "Arrival date",
        reason: "invalid" as const,
      }],
      progress: { completed: 18, total: 20 },
      sources: [],
      canRunFinalCheck: true,
      messages: [{
        id: "message-id",
        role: "assistant" as const,
        content: "Saved historical question",
        createdAt: "2026-08-18T00:00:00.000Z",
      }],
      aiFilledFieldNames: ["arrival_date"],
      enabled: true,
    };

    expect(toSubmittedFormAssistantState(state)).toEqual({
      ...state,
      missingFields: [],
      progress: { completed: 20, total: 20 },
      canRunFinalCheck: false,
    });
  });

  it("marks the separately rendered readiness progress complete after submission", () => {
    expect(toSubmittedFormAssistantProgress({ completed: 30, total: 32 })).toEqual({
      completed: 32,
      total: 32,
    });
  });
});

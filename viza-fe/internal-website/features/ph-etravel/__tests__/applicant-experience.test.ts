import { describe, expect, test } from "vitest";

import {
  createPhEtravelApplicantExperience,
  createPhEtravelApplicantExperienceFromStatus,
  resolvePhEtravelRuntimeState,
} from "../applicant-experience";

describe("Philippines eTravel applicant experience adapter", () => {
  test("is fail-closed by default and presents final-confirmation boundaries", () => {
    const presentation = createPhEtravelApplicantExperience({});

    expect(presentation.finalConfirmation).toMatchObject({
      liveEnabled: false,
      canRequestOfficialProcessing: false,
      submitted: false,
      noQueueUntilRequested: true,
    });
    expect(presentation.finalConfirmation.boundaryCopy.join(" ")).toMatch(
      /free.*not a visa.*does not guarantee/i
    );
  });

  test("allows an official-processing request only for explicit true and complete input", () => {
    expect(
      createPhEtravelApplicantExperience({
        env: { NEXT_PUBLIC_PH_ETRAVEL_LIVE_SUBMISSION_ENABLED: "true" },
      }).finalConfirmation.canRequestOfficialProcessing
    ).toBe(true);
    expect(
      createPhEtravelApplicantExperience({
        env: { NEXT_PUBLIC_PH_ETRAVEL_LIVE_SUBMISSION_ENABLED: "TRUE" },
      }).finalConfirmation.canRequestOfficialProcessing
    ).toBe(false);
  });

  test("blocks incomplete fields and documents with actionable return targets", () => {
    const presentation = createPhEtravelApplicantExperience({
      missingItems: [
        {
          id: "travel-date",
          label: "Arrival date",
          target: { kind: "field", stepId: "travel", fieldName: "arrival_date" },
        },
        {
          id: "document",
          label: "Supporting document",
          target: { kind: "documents", documentKey: "travel_document" },
        },
      ],
    });

    expect(presentation).toMatchObject({
      state: "incomplete",
      submitted: false,
      noResubmit: true,
      finalConfirmation: { canRequestOfficialProcessing: false },
    });
    expect(presentation.actions).toEqual([
      {
        id: "return_to_field",
        target: { kind: "field", stepId: "travel", fieldName: "arrival_date" },
      },
      {
        id: "return_to_documents",
        target: { kind: "documents", documentKey: "travel_document" },
      },
    ]);
  });

  test("keeps refresh/recovery read-only across scheduled, processing, and ambiguous results", () => {
    for (const runtimeState of ["scheduled", "processing"] as const) {
      expect(
        createPhEtravelApplicantExperience({ runtimeState }).actions
      ).toEqual([{ id: "refresh_status", readOnly: true }]);
    }

    const ambiguous = createPhEtravelApplicantExperience({
      runtimeState: "submitted",
      resultEvidence: {
        finalSubmitHttpStatus: 200,
        localReferenceNumber: "local-only",
      },
    });
    expect(ambiguous).toMatchObject({
      state: "recovery_required",
      submitted: false,
      noResubmit: true,
      actions: [{ id: "reread_official_result", readOnly: true }],
    });
  });

  test("models action-required and failed states without adding a retry-submit action", () => {
    for (const runtimeState of ["action_required", "failed"] as const) {
      const presentation = createPhEtravelApplicantExperience({ runtimeState });

      expect(presentation).toMatchObject({
        state: runtimeState,
        submitted: false,
        noResubmit: true,
      });
      expect(presentation.actions).not.toContainEqual(
        expect.objectContaining({ id: "request_official_processing" })
      );
    }
  });

  test("shows reference, matching QR, and only supplied receipts after the authoritative gate", () => {
    const submitted = createPhEtravelApplicantExperience({
      runtimeState: "submitted",
      resultEvidence: {
        authoritativePostSubmitRead: true,
        authoritativeReferenceNumber: "ETR-123",
        derivedQrRenderStatus: "rendered",
        derivedQrReferenceValue: "ETR-123",
      },
      officialReceipt: { available: true, label: "Official confirmation" },
    });

    expect(submitted).toMatchObject({
      state: "submitted",
      submitted: true,
      noResubmit: true,
      result: {
        referenceNumber: "ETR-123",
        qrVisible: true,
        qrMatchesReference: true,
        receipt: "available",
      },
    });
    expect(submitted.actions).toEqual([]);
  });

  test("consumes the current runner resultEvidence shape without trusting local references", () => {
    const result = {
      country: "PH",
      resultEvidence: {
        authoritativeRead: {
          source: "official_registration_result_read",
          postSubmitRead: true,
          stableReference: true,
          referenceNumber: "ETR-123",
        },
        qrRender: {
          renderer: "official_client_reference_qr",
          rendered: true,
          renderedForReference: "ETR-123",
          referenceValueValidated: true,
        },
      },
    };

    expect(resolvePhEtravelRuntimeState({ status: "completed", result })).toBe(
      "submitted",
    );
    expect(
      createPhEtravelApplicantExperienceFromStatus({
        status: { status: "completed", result },
      }),
    ).toMatchObject({
      state: "submitted",
      submitted: true,
      result: { referenceNumber: "ETR-123", qrMatchesReference: true },
    });

    expect(
      resolvePhEtravelRuntimeState({
        status: "submitted",
        result: { referenceNumber: "LOCAL-ONLY" },
      }),
    ).toBe("recovery_required");
  });
});

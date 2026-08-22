import { describe, expect, test } from "vitest";

import { createPhEtravelStoredResultRecoveryPresentation } from "../result-recovery";

describe("Philippines eTravel stored result recovery", () => {
  test("does not accept HTTP, navigation, local reference, QR, or Review as submission evidence", () => {
    const presentation = createPhEtravelStoredResultRecoveryPresentation({
      finalSubmitHttpStatus: 200,
      navigatedToPreparing: true,
      summaryVisible: true,
      submitVisible: true,
      reviewReached: true,
      referenceNumber: "LOCAL-REF",
      localQrValue: "LOCAL-QR",
    });

    expect(presentation).toMatchObject({
      state: "action_required",
      submitted: false,
      noResubmit: true,
    });
  });

  test("requires an authoritative read, stable reference, and same-reference rendered QR", () => {
    const recovery = createPhEtravelStoredResultRecoveryPresentation({
      authoritativeRegistration: {
        read: true,
        referenceNumber: "ETRAVEL-123",
        derivedQrRenderStatus: "rendered",
        derivedQrReferenceValue: "DIFFERENT",
      },
    });
    const candidate = createPhEtravelStoredResultRecoveryPresentation({
      authoritativeRegistration: {
        read: true,
        referenceNumber: "ETRAVEL-123",
        derivedQrRenderStatus: "rendered",
        derivedQrReferenceValue: "ETRAVEL-123",
      },
    });

    expect(recovery.state).toBe("recovery_required");
    expect(candidate.state).toBe("submitted_candidate");
  });

  test("accepts the canonical runner resultEvidence shape", () => {
    const candidate = createPhEtravelStoredResultRecoveryPresentation({
      resultEvidence: {
        authoritativeRead: {
          source: "official_registration_result_read",
          postSubmitRead: true,
          referenceNumber: "ETRAVEL-456",
          stableReference: true,
        },
        qrRender: {
          renderer: "official_client_reference_qr",
          renderedForReference: "ETRAVEL-456",
          rendered: true,
          referenceValueValidated: true,
        },
      },
    });

    expect(candidate.state).toBe("submitted_candidate");
  });
});

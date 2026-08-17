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

  test("reads the current runner resultEvidence envelope", () => {
    const candidate = createPhEtravelStoredResultRecoveryPresentation({
      resultEvidence: {
        authoritativeRead: {
          source: "official_registration_result_read",
          postSubmitRead: true,
          stableReference: true,
          referenceNumber: "ETRAVEL-456",
        },
        qrRender: {
          renderer: "official_client_reference_qr",
          rendered: true,
          renderedForReference: "ETRAVEL-456",
          referenceValueValidated: true,
        },
      },
    });

    expect(candidate.state).toBe("submitted_candidate");
    expect(candidate.qr.referenceConsistent).toBe(true);
  });

  test("does not accept a runner QR render without reference validation", () => {
    const recovery = createPhEtravelStoredResultRecoveryPresentation({
      resultEvidence: {
        authoritativeRead: {
          postSubmitRead: true,
          stableReference: true,
          referenceNumber: "ETRAVEL-789",
        },
        qrRender: {
          rendered: true,
          renderedForReference: "ETRAVEL-789",
          referenceValueValidated: false,
        },
      },
    });

    expect(recovery.state).toBe("recovery_required");
    expect(recovery.qr.referenceConsistent).toBe(false);
  });
});

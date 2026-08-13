import { describe, expect, test } from "vitest";

import {
  classifyPhEtravelResultState,
  createPhEtravelResultRecoveryPresentation,
  createPhEtravelScheduledPortalSummary,
  createPhEtravelUserStatusMessage,
  hasPhEtravelAuthoritativePostSubmitReference,
  isPhEtravelClientLiveSubmissionEnabled,
  isPhEtravelDerivedQrReferenceConsistent,
  isPhEtravelSubmittedCandidate,
  isPhEtravelServerLiveSubmissionEnabled,
  PH_ETRAVEL_RESULT_CAPABILITY_EVIDENCE,
  PH_ETRAVEL_REFRESH_POLICY,
  phEtravelUserFacingError,
} from "../status";

describe("Philippines eTravel frontend status helpers", () => {
  test("keeps frontend and API live submission fail-closed", () => {
    expect(isPhEtravelClientLiveSubmissionEnabled({})).toBe(false);
    expect(
      isPhEtravelClientLiveSubmissionEnabled({
        NEXT_PUBLIC_PH_ETRAVEL_LIVE_SUBMISSION_ENABLED: "false",
      })
    ).toBe(false);
    expect(
      isPhEtravelClientLiveSubmissionEnabled({
        NEXT_PUBLIC_PH_ETRAVEL_LIVE_SUBMISSION_ENABLED: "true",
      })
    ).toBe(true);

    expect(
      isPhEtravelServerLiveSubmissionEnabled({
        NEXT_PUBLIC_PH_ETRAVEL_LIVE_SUBMISSION_ENABLED: "true",
      })
    ).toBe(false);
    expect(
      isPhEtravelServerLiveSubmissionEnabled({
        PH_ETRAVEL_LIVE_SUBMISSION_ENABLED: "true",
      })
    ).toBe(false);
    expect(
      isPhEtravelServerLiveSubmissionEnabled({
        PH_ETRAVEL_LIVE_SUBMISSION_ENABLED: "true",
        NEXT_PUBLIC_PH_ETRAVEL_LIVE_SUBMISSION_ENABLED: "true",
      })
    ).toBe(true);
  });

  test("creates Philippines-only scheduled copy without SG or ICA wording", () => {
    const message = createPhEtravelScheduledPortalSummary({
      travelDateLabel: "arrival",
      earliestSubmissionDate: "2026-08-10",
      daysUntilOpen: 2,
    });

    expect(message).toContain("Philippines eTravel");
    expect(message).toContain("72 hours");
    expect(message).toContain("free");
    expect(message).not.toContain("SG");
    expect(message).not.toContain("ICA");
  });

  test("keeps past-date errors applicant-safe", () => {
    expect(
      phEtravelUserFacingError({ code: "phetravel_arrival_date_past" })
    ).toContain("already in the past");
    expect(
      phEtravelUserFacingError({
        message: "Playwright provider stack /tmp/token",
      })
    ).not.toContain("Playwright");
  });

  test("never echoes unknown raw messages or unknown codes", () => {
    const unsafe =
      "Official response for Maria Santos passport P1234567: rejected by /tmp/provider";

    expect(
      phEtravelUserFacingError({ code: "official_rejected", message: unsafe })
    ).toBe(
      "The Philippines eTravel submission was not completed. Your answers are saved; retry later or contact support."
    );
    expect(phEtravelUserFacingError({ message: unsafe })).not.toContain(
      "Maria Santos"
    );
    expect(phEtravelUserFacingError({ message: unsafe })).not.toContain(
      "P1234567"
    );
    expect(phEtravelUserFacingError({ message: unsafe })).not.toContain(
      "Official response"
    );
  });

  test("documents refresh as status-only and not enqueueing", () => {
    expect(PH_ETRAVEL_REFRESH_POLICY.statusPollingCreatesQueue).toBe(false);
    expect(PH_ETRAVEL_REFRESH_POLICY.retryEndpointCreatesQueue).toBe(true);
    expect(createPhEtravelUserStatusMessage("queued")).toContain(
      "Refreshing this page checks status only"
    );
  });

  test("treats signature, family gate, companion confirmation, and Review reached as not submitted", () => {
    for (const state of [
      "signature_required",
      "family_gate",
      "companion_confirmation",
      "review_reached_not_submitted",
      "sea_manual_customs_forms",
      "sea_electronic_signature_required",
    ] as const) {
      const message = createPhEtravelUserStatusMessage(state);

      expect(message).toMatch(/not submitted|not submitted until/i);
      expect(message).not.toContain("reference and QR have been saved");
    }

    expect(classifyPhEtravelResultState({ code: "signature_required" })).toBe(
      "action_required"
    );
    expect(classifyPhEtravelResultState({ code: "family_gate" })).toBe(
      "action_required"
    );
    expect(
      classifyPhEtravelResultState({ code: "companion_confirmation" })
    ).toBe("action_required");
    expect(
      classifyPhEtravelResultState({ code: "sea_manual_customs_forms" })
    ).toBe("action_required");
    expect(
      classifyPhEtravelResultState({
        code: "sea_electronic_signature_required",
      })
    ).toBe("action_required");
    expect(
      classifyPhEtravelResultState({
        officialStatus: "review_reached_not_submitted",
      })
    ).toBe("action_required");
    expect(classifyPhEtravelResultState({ reviewReached: true })).toBe(
      "action_required"
    );
    expect(classifyPhEtravelResultState({ stoppedBeforeSubmit: true })).toBe(
      "action_required"
    );
  });

  test("does not describe signature as a universal SEA requirement", () => {
    const signature = createPhEtravelUserStatusMessage("signature_required");
    const seaManualCustoms = createPhEtravelUserStatusMessage(
      "sea_manual_customs_forms"
    );

    expect(signature).toContain("stopped at a signature step for this path");
    expect(signature).toContain("not shown on every verified SEA path");
    expect(seaManualCustoms).toContain(
      "manual Baggage and Currency declaration forms"
    );
    expect(seaManualCustoms).toContain(
      "not submitted until VIZA recovers an authoritative reference"
    );
  });

  test("describes SEA electronic signature stop without treating Family or Summary as submitted", () => {
    const message = createPhEtravelUserStatusMessage(
      "sea_electronic_signature_required"
    );

    expect(message).toContain("SEA electronic customs path");
    expect(message).toContain("signature page");
    expect(message).toContain("Family Member(s)");
    expect(message).toContain("Summary");
    expect(message).toContain("final Submit");
    expect(message).toContain("not submitted yet");
    expect(message).not.toContain("reference and QR have been saved");
  });

  test("requires an authoritative post-submit reference and a matching derived QR for a result candidate", () => {
    const candidate = {
      authoritativePostSubmitRead: true,
      authoritativeReferenceNumber: "PH-REF-123",
      derivedQrRenderStatus: "rendered" as const,
      derivedQrReferenceValue: "PH-REF-123",
    };

    expect(hasPhEtravelAuthoritativePostSubmitReference(candidate)).toBe(true);
    expect(isPhEtravelDerivedQrReferenceConsistent(candidate)).toBe(true);
    expect(isPhEtravelSubmittedCandidate(candidate)).toBe(true);
    expect(classifyPhEtravelResultState(candidate)).toBe("submitted_candidate");
    expect(createPhEtravelResultRecoveryPresentation(candidate)).toMatchObject({
      state: "submitted_candidate",
      submitted: false,
      noResubmit: true,
      resultSource: "authoritative_registration_read",
      qr: {
        source: "client_rendered_from_reference",
        referenceConsistent: true,
      },
    });
  });

  test("sends ambiguous submit and recovery failures to no-resubmit recovery", () => {
    const httpOnly = createPhEtravelResultRecoveryPresentation({
      finalSubmitHttpStatus: 200,
      navigatedToPreparing: true,
      summaryVisible: true,
      submitVisible: true,
      localReferenceNumber: "PH-REF-123",
      localQrValue: "PH-REF-123",
    });
    expect(httpOnly).toMatchObject({
      state: "recovery_required",
      noResubmit: true,
      submitted: false,
    });
    expect(httpOnly.reasons).toEqual(
      expect.arrayContaining([
        "http_200_or_navigation_only",
        "local_result_not_authoritative",
      ])
    );

    expect(
      createPhEtravelResultRecoveryPresentation({
        authoritativePostSubmitRead: true,
      })
    ).toMatchObject({
      state: "recovery_required",
      reasons: ["authoritative_reference_missing"],
    });
    expect(
      createPhEtravelResultRecoveryPresentation({
        authoritativePostSubmitRead: true,
        authoritativeReferenceNumber: "PH-REF-123",
        derivedQrRenderStatus: "failed",
      })
    ).toMatchObject({
      state: "recovery_required",
      reasons: ["derived_qr_render_failed"],
    });
    expect(
      createPhEtravelResultRecoveryPresentation({
        authoritativePostSubmitRead: true,
        authoritativeReferenceNumber: "PH-REF-123",
        derivedQrRenderStatus: "rendered",
        derivedQrReferenceValue: "PH-REF-456",
        reopenStateConsistent: false,
      })
    ).toMatchObject({
      state: "recovery_required",
      noResubmit: true,
      reasons: expect.arrayContaining([
        "derived_qr_reference_mismatch",
        "reopen_state_mismatch",
      ]),
    });
  });

  test("keeps dashboard and result capabilities evidence-tiered without user promises", () => {
    expect(PH_ETRAVEL_RESULT_CAPABILITY_EVIDENCE).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          capability: "dashboard_status",
          evidenceTier: "verified_public_bundle",
        }),
        expect.objectContaining({
          capability: "reopen_route",
          evidenceTier: "verified_public_bundle",
        }),
        expect.objectContaining({
          capability: "download",
          evidenceTier: "unknown",
        }),
        expect.objectContaining({
          capability: "print",
          evidenceTier: "unknown",
        }),
        expect.objectContaining({
          capability: "scanability",
          evidenceTier: "unknown",
        }),
      ])
    );
    expect(
      PH_ETRAVEL_RESULT_CAPABILITY_EVIDENCE.every(
        (item) => item.userPromise === false
      )
    ).toBe(true);
  });
});

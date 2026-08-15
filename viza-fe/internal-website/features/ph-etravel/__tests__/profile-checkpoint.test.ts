import { describe, expect, test } from "vitest";

import {
  createPhEtravelCheckpointPresentation,
  isPhEtravelRegistrationSubmittedCandidate,
  PH_ETRAVEL_SUBMIT_BOUNDARIES,
} from "../profile-checkpoint";

describe("Philippines eTravel profile and registration submit boundaries", () => {
  test("keeps profile-save copy and state separate from registration final submission", () => {
    const profile = createPhEtravelCheckpointPresentation({
      journey: "profile",
      stage: "profile_saved_dashboard",
    });
    const registration = createPhEtravelCheckpointPresentation({
      journey: "registration",
      stage: "final_submit",
    });

    expect(profile).toMatchObject({
      journey: "profile",
      submitted: false,
      noQueue: true,
      noBrowser: true,
      noResubmit: true,
    });
    expect(profile.userCopy.en).toMatch(/Personal Information/i);
    expect(registration).toMatchObject({
      journey: "registration",
      submitted: false,
      noQueue: true,
      noBrowser: true,
      noResubmit: true,
    });
    expect(registration.userCopy.en).toMatch(/final submission/i);
    expect(registration.userCopy.en).not.toBe(profile.userCopy.en);
  });

  test("treats Personal Information Review Submit as a separate profile write", () => {
    expect(PH_ETRAVEL_SUBMIT_BOUNDARIES.profile).toMatchObject({
      reviewStage: "profile_review_ready",
      submitStage: "profile_save_submit",
      successStage: "profile_saved_dashboard",
      officialWrite: true,
      requiresIndependentAuthorization: true,
      isRegistrationFinalSubmit: false,
      mayMarkSubmitted: false,
      httpSuccessMayMarkSubmitted: false,
      navigationMayMarkSubmitted: false,
    });
  });

  test("keeps stop-before-submit aimed at the registration final Submit", () => {
    expect(PH_ETRAVEL_SUBMIT_BOUNDARIES.registration).toMatchObject({
      reviewStage: "etravel_registration_review_ready",
      submitStage: "final_submit",
      stopBeforeSubmitDefaultTarget: "final_submit",
      isRegistrationFinalSubmit: true,
    });
  });

  test("never marks a profile HTTP success or dashboard navigation submitted", () => {
    for (const stage of [
      "profile_review_ready",
      "profile_save_submit",
      "profile_saved_dashboard",
    ] as const) {
      expect(
        isPhEtravelRegistrationSubmittedCandidate({
          stage,
          authoritativeRegistrationRead: true,
          stableReferenceNumber: true,
          sameReferenceQrRender: true,
        })
      ).toBe(false);
    }
  });

  test("requires authoritative registration read, reference, and matching QR", () => {
    expect(
      isPhEtravelRegistrationSubmittedCandidate({
        stage: "reference_qr_ready",
        authoritativeRegistrationRead: true,
        stableReferenceNumber: true,
        sameReferenceQrRender: true,
      })
    ).toBe(true);
    expect(
      isPhEtravelRegistrationSubmittedCandidate({
        stage: "reference_qr_ready",
        authoritativeRegistrationRead: false,
        stableReferenceNumber: true,
        sameReferenceQrRender: true,
      })
    ).toBe(false);
  });
});

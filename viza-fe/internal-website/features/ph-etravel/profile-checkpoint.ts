export type PhEtravelProfileCheckpointStage =
  "profile_review_ready" | "profile_save_submit" | "profile_saved_dashboard";

export type PhEtravelRegistrationCheckpointStage =
  | "etravel_registration_review_ready"
  | "final_submit"
  | "authoritative_registration_read"
  | "reference_qr_ready";

export const PH_ETRAVEL_SUBMIT_BOUNDARIES = {
  profile: {
    reviewStage: "profile_review_ready",
    submitStage: "profile_save_submit",
    successStage: "profile_saved_dashboard",
    officialWrite: true,
    requiresIndependentAuthorization: true,
    isRegistrationFinalSubmit: false,
    mayMarkSubmitted: false,
    httpSuccessMayMarkSubmitted: false,
    navigationMayMarkSubmitted: false,
  },
  registration: {
    reviewStage: "etravel_registration_review_ready",
    submitStage: "final_submit",
    authoritativeReadStage: "authoritative_registration_read",
    successStage: "reference_qr_ready",
    officialWrite: true,
    requiresIndependentAuthorization: true,
    isRegistrationFinalSubmit: true,
    stopBeforeSubmitDefaultTarget: "final_submit",
    successRequires: [
      "authoritative_registration_read",
      "stable_reference_number",
      "same_reference_qr_render",
    ],
  },
} as const;

export type PhEtravelCheckpointPresentation = {
  journey: "profile" | "registration";
  stage: PhEtravelProfileCheckpointStage | PhEtravelRegistrationCheckpointStage;
  submitted: boolean;
  noQueue: true;
  noBrowser: true;
  noResubmit: true;
  userCopy: { en: string; zh: string };
};

export type PhEtravelCheckpointPresentationInput =
  | {
      journey: "profile";
      stage: PhEtravelProfileCheckpointStage;
    }
  | {
      journey: "registration";
      stage: PhEtravelRegistrationCheckpointStage;
      authoritativeRegistrationRead?: boolean;
      stableReferenceNumber?: boolean;
      sameReferenceQrRender?: boolean;
    };

export function createPhEtravelCheckpointPresentation(
  input: PhEtravelCheckpointPresentationInput
): PhEtravelCheckpointPresentation {
  if (input.journey === "profile") {
    return {
      journey: "profile",
      stage: input.stage,
      submitted: false,
      noQueue: true,
      noBrowser: true,
      noResubmit: true,
      userCopy: {
        en: "Saving Personal Information does not submit an eTravel registration.",
        zh: "保存个人信息不等于提交 eTravel 入境申报。",
      },
    };
  }

  const submitted = isPhEtravelRegistrationSubmittedCandidate({
    stage: input.stage,
    authoritativeRegistrationRead: input.authoritativeRegistrationRead === true,
    stableReferenceNumber: input.stableReferenceNumber === true,
    sameReferenceQrRender: input.sameReferenceQrRender === true,
  });
  return {
    journey: "registration",
    stage: input.stage,
    submitted,
    noQueue: true,
    noBrowser: true,
    noResubmit: true,
    userCopy: submitted
      ? {
          en: "Registration confirmation is being verified from the authoritative record.",
          zh: "正在根据权威记录核验申报确认信息。",
        }
      : {
          en: "Review and final submission are separate from saving Personal Information.",
          zh: "审核与最终提交与保存个人信息是两个独立步骤。",
        },
  };
}

export function isPhEtravelRegistrationSubmittedCandidate(input: {
  stage: PhEtravelProfileCheckpointStage | PhEtravelRegistrationCheckpointStage;
  authoritativeRegistrationRead: boolean;
  stableReferenceNumber: boolean;
  sameReferenceQrRender: boolean;
}): boolean {
  return (
    input.stage === "reference_qr_ready" &&
    input.authoritativeRegistrationRead &&
    input.stableReferenceNumber &&
    input.sameReferenceQrRender
  );
}

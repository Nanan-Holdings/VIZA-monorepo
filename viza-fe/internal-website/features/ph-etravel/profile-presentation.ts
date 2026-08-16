import { PH_ETRAVEL_SUBMIT_BOUNDARIES } from "./profile-checkpoint";

export type PhEtravelPassportHolderType = "FILIPINO" | "FOREIGNER";

export type PhEtravelProfilePresentationInput = {
  passportHolderType: PhEtravelPassportHolderType;
  residenceCountryCode?: string | null;
};

export type PhEtravelProfileReviewField = {
  key:
    | "profile.photo_url"
    | "traveller.mobile_number"
    | "residence.country_code"
    | "residence.region_code"
    | "residence.province_code"
    | "residence.municipality_code"
    | "residence.barangay_code"
    | "residence.address_line1"
    | "residence.address_line2";
  clientContract: "verified_public_bundle";
  serverEvidence: "needs_review";
  mode: "profile_or_review_gate";
  visibleWhen: string;
  clientKnown: string;
  liveServerUnknown: string;
};

export type PhEtravelProfilePresentation = {
  passportHolderType: PhEtravelPassportHolderType;
  residenceBranch: "philippines" | "foreign" | "unresolved";
  fields: PhEtravelProfileReviewField[];
  clearOnChange: Record<string, readonly string[]>;
  gate: {
    authorization: "profile_save_checkpoint";
    checkpoint: "profile_review_ready";
    submitAction: "profile_save_submit";
    successStage: "profile_saved_dashboard";
    registrationStopBeforeSubmitTarget: "final_submit";
    requiresOfficialWriteAuthorization: true;
    isRegistrationFinalSubmit: false;
    submitted: false;
    noQueue: true;
    noBrowser: true;
    noResubmit: true;
    userCopy: {
      en: string;
      zh: string;
    };
  };
};

const profileGate = {
  authorization: "profile_save_checkpoint" as const,
  checkpoint: PH_ETRAVEL_SUBMIT_BOUNDARIES.profile.reviewStage,
  submitAction: PH_ETRAVEL_SUBMIT_BOUNDARIES.profile.submitStage,
  successStage: PH_ETRAVEL_SUBMIT_BOUNDARIES.profile.successStage,
  registrationStopBeforeSubmitTarget:
    PH_ETRAVEL_SUBMIT_BOUNDARIES.registration.stopBeforeSubmitDefaultTarget,
  requiresOfficialWriteAuthorization: true as const,
  isRegistrationFinalSubmit: false as const,
  submitted: false as const,
  noQueue: true as const,
  noBrowser: true as const,
  noResubmit: true as const,
  userCopy: {
    en: "Reviewing and saving this profile does not submit an eTravel registration.",
    zh: "审核并保存这份个人资料不等于提交 eTravel 入境申报。",
  },
};

function profileField(
  key: PhEtravelProfileReviewField["key"],
  visibleWhen: string,
  clientKnown: string,
  liveServerUnknown: string
): PhEtravelProfileReviewField {
  return {
    key,
    clientContract: "verified_public_bundle",
    serverEvidence: "needs_review",
    mode: "profile_or_review_gate",
    visibleWhen,
    clientKnown,
    liveServerUnknown,
  };
}

/**
 * E21 is client-bundle evidence only. This adapter records visible branching
 * without promoting a profile widget or local validation to server acceptance.
 */
export function createPhEtravelProfilePresentation(
  input: PhEtravelProfilePresentationInput
): PhEtravelProfilePresentation {
  const countryCode = input.residenceCountryCode?.trim().toUpperCase();
  const residenceBranch =
    countryCode === "PH"
      ? "philippines"
      : countryCode
        ? "foreign"
        : "unresolved";

  const fields: PhEtravelProfileReviewField[] = [
    profileField(
      "profile.photo_url",
      "Both ordinary passport-holder branches.",
      "The public client stores a returned URL and can be configured for file or camera-plus-file triggers.",
      "Live trigger mode, file type, size, camera/crop flow, upload timing, and server acceptance are unknown."
    ),
    profileField(
      "traveller.mobile_number",
      "Both ordinary passport-holder branches unless the official profile disables it.",
      "The public client uses a Philippines preset and removes spaces from its returned value.",
      "Live formatting, requiredness, country-code shape, and server acceptance are unknown."
    ),
    profileField(
      "residence.country_code",
      "Both ordinary passport-holder branches.",
      "The public client selects a residence country and clears dependent residence values when it changes.",
      "Live options, timing, requiredness, and server acceptance are unknown."
    ),
  ];

  if (residenceBranch === "philippines") {
    fields.push(
      profileField(
        "residence.region_code",
        "Residence country is Philippines.",
        "The public client derives this from selected province metadata rather than a standalone selector.",
        "Live metadata, requiredness, and server acceptance are unknown."
      ),
      profileField(
        "residence.province_code",
        "Residence country is Philippines.",
        "The public client requests provinces and clears municipality and barangay after a province change.",
        "Live options, request behavior, requiredness, and server acceptance are unknown."
      ),
      profileField(
        "residence.municipality_code",
        "Residence country is Philippines and a province is selected.",
        "The public client requests municipalities by province and clears barangay after a municipality change.",
        "Live options, request behavior, requiredness, and server acceptance are unknown."
      ),
      profileField(
        "residence.barangay_code",
        "Residence country is Philippines and a municipality is selected.",
        "The public client requests barangays by municipality.",
        "Live options, request behavior, requiredness, and server acceptance are unknown."
      )
    );
  }

  fields.push(
    profileField(
      "residence.address_line1",
      "Both residence-country branches; the public label changes by residence country.",
      "The public client uses the residence address branch and clears it when the residence country changes.",
      "Live label, requiredness, validation, and server acceptance are unknown."
    ),
    profileField(
      "residence.address_line2",
      "Both residence-country branches.",
      "The public client provides a second residence-address value and clears it when the residence country changes.",
      "Live optionality, validation, and server acceptance are unknown."
    )
  );

  return {
    passportHolderType: input.passportHolderType,
    residenceBranch,
    fields,
    clearOnChange: {
      "residence.country_code": [
        "residence.region_code",
        "residence.province_code",
        "residence.municipality_code",
        "residence.barangay_code",
        "residence.address_line1",
        "residence.address_line2",
      ],
      "residence.province_code": [
        "residence.municipality_code",
        "residence.barangay_code",
      ],
      "residence.municipality_code": ["residence.barangay_code"],
    },
    gate: profileGate,
  };
}

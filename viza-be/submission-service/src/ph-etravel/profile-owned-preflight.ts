export const PH_ETRAVEL_ARRIVAL_EVIDENCE_COUNTS = {
  canonical: 111,
  confirmedLive: 56,
  verifiedPublicBundle: 19,
  needsReview: 36,
  divertedUnsupported: 8,
} as const;

export const PH_ETRAVEL_PROFILE_OWNED_NEEDS_REVIEW_KEYS = [
  "profile.photo_url",
  "traveller.mobile_number",
  "traveller.passenger_type",
] as const;

export const PH_ETRAVEL_RESIDENCE_NEEDS_REVIEW_KEYS = [
  "residence.address_line1",
  "residence.address_line2",
  "residence.barangay_code",
  "residence.country_code",
  "residence.municipality_code",
  "residence.province_code",
  "residence.region_code",
] as const;

export interface PhEtravelProfileOwnedActionPlan {
  owner: "profile_owned";
  evidence: "verified_public_bundle";
  status: "action_required";
  canonicalKeys: string[];
  blockingCodes: [
    "ph_etravel_launch_profile_persona_review_required",
    "ph_etravel_launch_residence_review_required",
  ];
  actions: [];
  externalActions: {
    queue: "not_started";
    account: "not_started";
    browser: "not_started";
  };
  photoUploadResultIsApplicantAnswer: false;
  genericFiveMbDefaultIsProfileServerRule: false;
  mobilePhPresetIsServerAcceptance: false;
  residenceCascadeIsServerAcceptance: false;
  officialResubmitAllowed: false;
}

/**
 * E21 exposes only client wiring. This action plan is deliberately empty so
 * the bundle's image/mobile/residence behavior cannot become browser actions
 * until controlled live and server evidence close the corresponding P0 gaps.
 */
export function buildPhEtravelProfileOwnedActionPlan(): PhEtravelProfileOwnedActionPlan {
  return {
    owner: "profile_owned",
    evidence: "verified_public_bundle",
    status: "action_required",
    canonicalKeys: [
      ...PH_ETRAVEL_PROFILE_OWNED_NEEDS_REVIEW_KEYS,
      ...PH_ETRAVEL_RESIDENCE_NEEDS_REVIEW_KEYS,
    ].sort(),
    blockingCodes: [
      "ph_etravel_launch_profile_persona_review_required",
      "ph_etravel_launch_residence_review_required",
    ],
    actions: [],
    externalActions: {
      queue: "not_started",
      account: "not_started",
      browser: "not_started",
    },
    photoUploadResultIsApplicantAnswer: false,
    genericFiveMbDefaultIsProfileServerRule: false,
    mobilePhPresetIsServerAcceptance: false,
    residenceCascadeIsServerAcceptance: false,
    officialResubmitAllowed: false,
  };
}

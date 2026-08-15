export const PH_ETRAVEL_HEALTH_STATIC_NOTICE =
  "As of July 22, 2023, No Covid-19 test or Vaccination requirement when traveling to the Philippines.";

export const PH_ETRAVEL_HEALTH_SYMPTOM_OPTIONS = [
  { value: "SS015", label: "Altered Mental Status" },
  { value: "SS008", label: "Colds" },
  { value: "SS002", label: "Cough" },
  { value: "SS014", label: "Diarrhea" },
  { value: "SS017", label: "Difficulty of Breathing" },
  { value: "SS022", label: "Dizziness" },
  { value: "SS001", label: "Fever" },
  { value: "SS005", label: "Headache" },
  { value: "SS023", label: "Loss of appetite" },
  { value: "SS016", label: "Loss of smell" },
  { value: "SS018", label: "Loss of taste" },
  { value: "SS006", label: "Muscle Pain" },
  { value: "SS011", label: "Nausea" },
  { value: "SS021", label: "Rashes, vesicles or blisters" },
  { value: "SS007", label: "Sore throat" },
] as const;

export type PhEtravelHealthPresentationInput = {
  transportType?: "AIR" | "SEA" | null;
  passportHolderType?: "FILIPINO" | "FOREIGNER" | null;
  isFullyVaccinated?: boolean | null;
  ageYears?: number | null;
  hasRecentTravelHistory?: boolean | null;
  hasBeenSick?: boolean | null;
};

export type PhEtravelHealthCompletenessInput = {
  hasRecentTravelHistory?: boolean | null;
  hasExposureToSickPerson?: boolean | null;
  hasBeenSick?: boolean | null;
  visitedCountryCodes?: readonly string[] | null;
  sicknessSymptomCodes?: readonly string[] | null;
};

export type PhEtravelHealthMissingItem = {
  fieldName:
    | "has_recent_travel_history_30d"
    | "has_exposure_to_sick_person_30d"
    | "has_been_sick_30d"
    | "visited_country_30d"
    | "sickness_symptom";
  reason: "required" | "minimum_one_selection";
};

export type PhEtravelHealthReviewField = {
  key:
    | "health.with_negative_antigen"
    | "health.has_recent_travel_history_30d"
    | "health.visited_countries_30d"
    | "health.has_exposure_to_sick_person_30d"
    | "health.has_been_sick_30d"
    | "health.sickness_symptoms";
  officialKey: string;
  control: "yes_no" | "repeatable_country_select" | "multi_checkbox";
  mode: "review_gate";
  clientContract: "confirmed_user_screenshot" | "verified_public_bundle";
  required: boolean;
  visibleWhen: string;
  liveServerUnknown: string;
  repeatable?: {
    addControl: true;
    deleteControl: true;
    minimumRows: 1;
    eachRowRequired: true;
    optionSource: "all_official_countries";
    includesPhilippines: true;
  };
  multiSelect?: {
    minimumSelections: 1;
    options: typeof PH_ETRAVEL_HEALTH_SYMPTOM_OPTIONS;
  };
};

export type PhEtravelHealthPresentation = {
  staticNotices: readonly [
    {
      key: "health.notice_no_covid_requirement";
      copy: typeof PH_ETRAVEL_HEALTH_STATIC_NOTICE;
      isApplicantAnswer: false;
    },
  ];
  fields: PhEtravelHealthReviewField[];
  translationOnly: ["health.exposed_to_bats_or_sick_animals"];
  inheritedStateNotQuestions: [
    "is_fully_vaccinated",
    "is_single_dosage",
    "birth_date",
    "health_declaration",
  ];
  transportScope: "air_and_sea_same_health_declaration";
  passportHolderBoundary: "not_confirmed_by_health_screenshot";
  clearOnChange: Record<string, readonly string[]>;
  gate: {
    authorization: "stop_before_submit";
    submitted: false;
    noQueue: true;
    noBrowser: true;
    noResubmit: true;
    userCopy: { en: string; zh: string };
  };
};

const reviewGate = {
  authorization: "stop_before_submit" as const,
  submitted: false as const,
  noQueue: true as const,
  noBrowser: true as const,
  noResubmit: true as const,
  userCopy: {
    en: "Complete the Health Declaration before continuing.",
    zh: "请先完成健康申报后再继续。",
  },
};

function reviewField(
  key: PhEtravelHealthReviewField["key"],
  officialKey: string,
  control: PhEtravelHealthReviewField["control"],
  required: boolean,
  visibleWhen: string,
  liveServerUnknown: string
): PhEtravelHealthReviewField {
  return {
    key,
    officialKey,
    control,
    mode: "review_gate",
    clientContract: "confirmed_user_screenshot",
    required,
    visibleWhen,
    liveServerUnknown,
  };
}

function hasSelection(values: readonly string[] | null | undefined): boolean {
  return values?.some((value) => value.trim() !== "") ?? false;
}

/**
 * This page is confirmed by the supplied Health Declaration screenshot for
 * both AIR and SEA. It does not make any server payload or submit claim.
 */
export function createPhEtravelHealthPresentation(
  input: PhEtravelHealthPresentationInput
): PhEtravelHealthPresentation {
  const fields: PhEtravelHealthReviewField[] = [
    reviewField(
      "health.has_recent_travel_history_30d",
      "meta.with_recent_travel_history",
      "yes_no",
      true,
      "Always shown on the AIR and SEA Health Declaration page.",
      "Server payload and acceptance remain unknown."
    ),
    reviewField(
      "health.has_exposure_to_sick_person_30d",
      "is_with_history_exposure",
      "yes_no",
      true,
      "Always shown on the AIR and SEA Health Declaration page.",
      "No child question is confirmed for either answer; server acceptance remains unknown."
    ),
    reviewField(
      "health.has_been_sick_30d",
      "is_sicked_within_thirty_days",
      "yes_no",
      true,
      "Always shown on the AIR and SEA Health Declaration page.",
      "Server payload and acceptance remain unknown."
    ),
  ];

  if (input.isFullyVaccinated === false && (input.ageYears ?? -1) >= 15) {
    fields.unshift({
      ...reviewField(
        "health.with_negative_antigen",
        "with_negative_antigen",
        "yes_no",
        false,
        "Client-derived condition: not fully vaccinated and age is at least 15.",
        "Live eligibility, document behavior, and server acceptance are unknown."
      ),
      clientContract: "verified_public_bundle",
    });
  }
  if (input.hasRecentTravelHistory === true) {
    fields.splice(1, 0, {
      ...reviewField(
        "health.visited_countries_30d",
        "visited_countries",
        "repeatable_country_select",
        true,
        "Recent-travel answer is Yes.",
        "Server payload and option acceptance remain unknown."
      ),
      repeatable: {
        addControl: true,
        deleteControl: true,
        minimumRows: 1,
        eachRowRequired: true,
        optionSource: "all_official_countries",
        includesPhilippines: true,
      },
    });
  }
  if (input.hasBeenSick === true) {
    fields.push({
      ...reviewField(
        "health.sickness_symptoms",
        "sickness_symptoms",
        "multi_checkbox",
        true,
        "Sick-in-the-last-30-days answer is Yes.",
        "Server payload and option acceptance remain unknown."
      ),
      multiSelect: {
        minimumSelections: 1,
        options: PH_ETRAVEL_HEALTH_SYMPTOM_OPTIONS,
      },
    });
  }

  return {
    staticNotices: [
      {
        key: "health.notice_no_covid_requirement",
        copy: PH_ETRAVEL_HEALTH_STATIC_NOTICE,
        isApplicantAnswer: false,
      },
    ],
    fields,
    translationOnly: ["health.exposed_to_bats_or_sick_animals"],
    inheritedStateNotQuestions: [
      "is_fully_vaccinated",
      "is_single_dosage",
      "birth_date",
      "health_declaration",
    ],
    transportScope: "air_and_sea_same_health_declaration",
    passportHolderBoundary: "not_confirmed_by_health_screenshot",
    clearOnChange: {
      "health.has_recent_travel_history_30d=false": [
        "health.visited_countries_30d",
      ],
      "health.has_been_sick_30d=false": ["health.sickness_symptoms"],
    },
    gate: reviewGate,
  };
}

export function getPhEtravelHealthMissingItems(
  input: PhEtravelHealthCompletenessInput
): PhEtravelHealthMissingItem[] {
  const missing: PhEtravelHealthMissingItem[] = [];
  if (input.hasRecentTravelHistory === null || input.hasRecentTravelHistory === undefined) {
    missing.push({ fieldName: "has_recent_travel_history_30d", reason: "required" });
  }
  if (input.hasExposureToSickPerson === null || input.hasExposureToSickPerson === undefined) {
    missing.push({ fieldName: "has_exposure_to_sick_person_30d", reason: "required" });
  }
  if (input.hasBeenSick === null || input.hasBeenSick === undefined) {
    missing.push({ fieldName: "has_been_sick_30d", reason: "required" });
  }
  if (input.hasRecentTravelHistory === true && !hasSelection(input.visitedCountryCodes)) {
    missing.push({ fieldName: "visited_country_30d", reason: "minimum_one_selection" });
  }
  if (input.hasBeenSick === true && !hasSelection(input.sicknessSymptomCodes)) {
    missing.push({ fieldName: "sickness_symptom", reason: "minimum_one_selection" });
  }
  return missing;
}

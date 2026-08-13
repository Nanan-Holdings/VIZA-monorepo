export type PhEtravelHealthPresentationInput = {
  transportType?: "AIR" | "SEA" | null;
  passportHolderType?: "FILIPINO" | "FOREIGNER" | null;
  isFullyVaccinated?: boolean | null;
  ageYears?: number | null;
  hasRecentTravelHistory?: boolean | null;
  hasBeenSick?: boolean | null;
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
  mode: "review_gate";
  clientContract: "verified_public_bundle";
  visibleWhen: string;
  liveServerUnknown: string;
};

export type PhEtravelHealthPresentation = {
  fields: PhEtravelHealthReviewField[];
  translationOnly: ["health.exposed_to_bats_or_sick_animals"];
  inheritedStateNotQuestions: [
    "is_fully_vaccinated",
    "is_single_dosage",
    "birth_date",
    "health_declaration",
  ];
  contextBoundary: "no_component_local_air_sea_or_passport_holder_split";
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
    en: "This health information needs official review before you can continue.",
    zh: "这些健康信息需要官方复核后才能继续。",
  },
};

function reviewField(
  key: PhEtravelHealthReviewField["key"],
  officialKey: string,
  visibleWhen: string,
  liveServerUnknown: string
): PhEtravelHealthReviewField {
  return {
    key,
    officialKey,
    mode: "review_gate",
    clientContract: "verified_public_bundle",
    visibleWhen,
    liveServerUnknown,
  };
}

/**
 * E23 exposes client-side Health branching only. It never turns inherited
 * vaccine/age state, translation strings, or local schema rules into answers.
 */
export function createPhEtravelHealthPresentation(
  input: PhEtravelHealthPresentationInput
): PhEtravelHealthPresentation {
  const fields: PhEtravelHealthReviewField[] = [
    reviewField(
      "health.has_recent_travel_history_30d",
      "meta.with_recent_travel_history",
      "Current Health component branch.",
      "Live rendering, required marker, nested payload behavior, and server acceptance are unknown."
    ),
    reviewField(
      "health.has_exposure_to_sick_person_30d",
      "is_with_history_exposure",
      "Current Health component branch.",
      "Live rendering, required marker, and server acceptance are unknown."
    ),
    reviewField(
      "health.has_been_sick_30d",
      "is_sicked_within_thirty_days",
      "Current Health component branch.",
      "Live rendering, required marker, and server acceptance are unknown."
    ),
  ];

  if (input.isFullyVaccinated === false && (input.ageYears ?? -1) >= 15) {
    fields.unshift(
      reviewField(
        "health.with_negative_antigen",
        "with_negative_antigen",
        "Client-derived condition: not fully vaccinated and age is at least 15.",
        "Live eligibility, required marker, test-document behavior, and server acceptance are unknown."
      )
    );
  }
  if (input.hasRecentTravelHistory === true) {
    fields.splice(
      2,
      0,
      reviewField(
        "health.visited_countries_30d",
        "visited_countries",
        "Recent-travel answer is true.",
        "Live option behavior, required marker, payload handling, and server acceptance are unknown."
      )
    );
  }
  if (input.hasBeenSick === true) {
    fields.push(
      reviewField(
        "health.sickness_symptoms",
        "sickness_symptoms",
        "Sick-in-the-last-30-days answer is true.",
        "Live option behavior, required marker, payload handling, and server acceptance are unknown."
      )
    );
  }

  return {
    fields,
    translationOnly: ["health.exposed_to_bats_or_sick_animals"],
    inheritedStateNotQuestions: [
      "is_fully_vaccinated",
      "is_single_dosage",
      "birth_date",
      "health_declaration",
    ],
    contextBoundary: "no_component_local_air_sea_or_passport_holder_split",
    clearOnChange: {
      "health.has_recent_travel_history_30d=false": [
        "health.visited_countries_30d",
      ],
      "health.has_been_sick_30d": ["health.sickness_symptoms"],
      "health.with_negative_antigen": [
        "health.has_exposure_to_sick_person_30d",
      ],
    },
    gate: reviewGate,
  };
}

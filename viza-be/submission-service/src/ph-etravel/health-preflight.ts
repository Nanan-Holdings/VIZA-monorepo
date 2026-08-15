export const PH_ETRAVEL_HEALTH_S3_GAPS = [
  {
    id: "negative_antigen_visibility_and_acceptance",
    canonicalKeys: ["health.with_negative_antigen"],
  },
  {
    id: "recent_travel_history_live_server_parity",
    canonicalKeys: ["health.has_recent_travel_history_30d"],
  },
  {
    id: "recent_travel_countries_live_server_parity",
    canonicalKeys: ["health.visited_countries_30d"],
  },
  {
    id: "bats_or_sick_animals_translation_only",
    canonicalKeys: ["health.exposed_to_bats_or_sick_animals"],
  },
  {
    id: "sickness_symptoms_live_server_parity",
    canonicalKeys: ["health.sickness_symptoms"],
  },
] as const;

export const PH_ETRAVEL_HEALTH_S3_NEEDS_REVIEW_KEYS = PH_ETRAVEL_HEALTH_S3_GAPS
  .flatMap((gap) => gap.canonicalKeys)
  .sort();

export interface PhEtravelHealthActionPlan {
  owner: "health";
  evidence: "verified_public_bundle";
  status: "action_required";
  canonicalKeys: string[];
  blockingCodes: ["ph_etravel_launch_health_positive_review_required"];
  gaps: Array<{
    id: (typeof PH_ETRAVEL_HEALTH_S3_GAPS)[number]["id"];
    canonicalKeys: string[];
    status: "action_required" | "translation_only_not_actionable";
  }>;
  renderedControls: {
    negativeAntigen: {
      clientVisibility: "NOT_FULLY_VACCINATED_AND_AGE_AT_LEAST_15";
      vaccinationAndAgeAreNotHealthApplicantQuestions: true;
      noDocumentOrUploadAction: true;
      clientChangeClearsExposureOnly: true;
    };
    recentTravel: {
      positiveBranchPresent: boolean;
      clientNoClearsVisitedCountries: true;
      countriesRequireLiveServerReview: true;
    };
    exposure: {
      positiveBranchPresent: boolean;
      noObservedChildControl: true;
    };
    sickness: {
      positiveBranchPresent: boolean;
      clientChangeClearsSymptoms: true;
      symptomsRequireLiveServerReview: true;
    };
  };
  translationOnly: {
    batsOrSickAnimals: {
      renderedCurrentComponent: false;
      generatesBrowserAction: false;
      generatesOfficialPayloadAction: false;
    };
  };
  transportPersonaParity: {
    airSeaLiveVerified: true;
    filipinoForeignerLiveVerified: false;
  };
  staticHandlerPayloadMapping: "unknown_do_not_infer";
  actions: [];
  externalActions: {
    queue: "not_started";
    account: "not_started";
    browser: "not_started";
  };
  officialResubmitAllowed: false;
}

function normalized(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/[\s-]+/g, "_").toUpperCase() : "";
}

function isTrue(value: unknown): boolean {
  return ["YES", "Y", "TRUE", "1", "ON", "CHECKED"].includes(normalized(value));
}

/**
 * E23 is static component evidence. The plan deliberately captures only safe
 * branch states and never creates a selector, a health payload, or an action
 * that could advance an official declaration.
 */
export function buildPhEtravelHealthActionPlan(
  answers: Record<string, string>,
): PhEtravelHealthActionPlan {
  const hasRecentTravel = isTrue(answers.has_recent_travel_history_30d) ||
    isTrue(answers.with_recent_travel_history);
  const hasExposure = isTrue(answers.has_exposure_to_sick_person_30d) ||
    isTrue(answers.is_with_history_exposure);
  const hasBeenSick = isTrue(answers.has_been_sick_30d) ||
    isTrue(answers.is_sicked_within_thirty_days);
  return {
    owner: "health",
    evidence: "verified_public_bundle",
    status: "action_required",
    canonicalKeys: [...PH_ETRAVEL_HEALTH_S3_NEEDS_REVIEW_KEYS],
    blockingCodes: ["ph_etravel_launch_health_positive_review_required"],
    gaps: PH_ETRAVEL_HEALTH_S3_GAPS.map((gap) => ({
      id: gap.id,
      canonicalKeys: [...gap.canonicalKeys],
      status: gap.id === "bats_or_sick_animals_translation_only"
        ? "translation_only_not_actionable"
        : "action_required",
    })),
    renderedControls: {
      negativeAntigen: {
        clientVisibility: "NOT_FULLY_VACCINATED_AND_AGE_AT_LEAST_15",
        vaccinationAndAgeAreNotHealthApplicantQuestions: true,
        noDocumentOrUploadAction: true,
        clientChangeClearsExposureOnly: true,
      },
      recentTravel: {
        positiveBranchPresent: hasRecentTravel,
        clientNoClearsVisitedCountries: true,
        countriesRequireLiveServerReview: true,
      },
      exposure: {
        positiveBranchPresent: hasExposure,
        noObservedChildControl: true,
      },
      sickness: {
        positiveBranchPresent: hasBeenSick,
        clientChangeClearsSymptoms: true,
        symptomsRequireLiveServerReview: true,
      },
    },
    translationOnly: {
      batsOrSickAnimals: {
        renderedCurrentComponent: false,
        generatesBrowserAction: false,
        generatesOfficialPayloadAction: false,
      },
    },
    transportPersonaParity: {
      airSeaLiveVerified: true,
      filipinoForeignerLiveVerified: false,
    },
    staticHandlerPayloadMapping: "unknown_do_not_infer",
    actions: [],
    externalActions: {
      queue: "not_started",
      account: "not_started",
      browser: "not_started",
    },
    officialResubmitAllowed: false,
  };
}

export function phEtravelHealthPositiveBranchPresent(answers: Record<string, string>): boolean {
  return isTrue(answers.with_negative_antigen) ||
    isTrue(answers.has_recent_travel_history_30d) ||
    isTrue(answers.with_recent_travel_history) ||
    isTrue(answers.has_exposure_to_sick_person_30d) ||
    isTrue(answers.is_with_history_exposure) ||
    isTrue(answers.has_been_sick_30d) ||
    isTrue(answers.is_sicked_within_thirty_days);
}

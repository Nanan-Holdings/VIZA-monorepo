export const PH_ETRAVEL_AIR_DESTINATION_S2_GAPS = [
  {
    id: "airline_flight_dynamic_options",
    canonicalKeys: ["air.airline_code", "air.flight_number"],
  },
  {
    id: "special_flight_derived_ui_branch",
    canonicalKeys: ["air.is_special_flight", "air.special_flight_number"],
  },
  {
    id: "transit_conditional_fields",
    canonicalKeys: [
      "travel.transit_country_code",
      "travel.transit_date",
      "travel.transit_port",
      "travel.with_transit",
    ],
  },
  {
    id: "return_date_persona_purpose_condition",
    canonicalKeys: ["travel.return_date"],
  },
  {
    id: "destination_residence_branch",
    canonicalKeys: [
      "destination.address_text",
      "destination.same_as_residence",
      "destination.stay_location_type",
    ],
  },
  {
    id: "destination_hotel_or_transit_branch",
    canonicalKeys: [
      "destination.hotel_name_or_address",
      "destination.transit_destination_country_code",
      "destination.transit_port_code",
    ],
  },
  {
    id: "destination_port_customs_dependency",
    canonicalKeys: ["destination.destination_port_code"],
  },
] as const;

export const PH_ETRAVEL_AIR_DESTINATION_NEEDS_REVIEW_KEYS = PH_ETRAVEL_AIR_DESTINATION_S2_GAPS
  .flatMap((gap) => gap.canonicalKeys)
  .sort();

type PhEtravelAccommodationBranch = "RESIDENCE" | "HOTEL" | "TRANSIT" | "UNKNOWN";
type PhEtravelDestinationInputState = "exclusive" | "conflicting";

export interface PhEtravelAirDestinationActionPlan {
  owner: "air_destination";
  evidence: "verified_public_bundle";
  status: "action_required";
  canonicalKeys: string[];
  blockingCodes: ["ph_etravel_launch_air_travel_review_required"];
  gaps: Array<{
    id: (typeof PH_ETRAVEL_AIR_DESTINATION_S2_GAPS)[number]["id"];
    canonicalKeys: string[];
    status: "action_required";
  }>;
  specialFlight: {
    selected: boolean;
    derivedUiStateOnly: true;
    officialDetailKey: "flight_number_special";
    forbiddenOfficialPayloadKeys: ["is_special_flight"];
  };
  transit: {
    selected: boolean;
    childKeysRequireLiveServerReview: true;
  };
  returnDate: {
    clientCondition: "FOREIGNER_AIR_ARRIVAL_POV001_OR_POV007";
    renderAndSchemaParityLiveUnverified: true;
  };
  accommodation: {
    selected: PhEtravelAccommodationBranch;
    inputState: PhEtravelDestinationInputState;
    mutuallyExclusive: true;
    dynamicHotelSourceLiveOptionValuesUnverified: true;
    dynamicHotelSourceServerAcceptanceUnverified: true;
    transitPortOptionsServerAcceptanceUnverified: true;
  };
  destinationPort: {
    dynamicPortSourceLiveOptionValuesUnverified: true;
    dynamicSourceServerAcceptanceUnverified: true;
    withCustomDeclarationRequiresMetadataAndMatchingLivePage: true;
    withCustomDeclarationAloneSelectsAirCustomsFlow: false;
  };
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

function hasText(answers: Record<string, string>, keys: string[]): boolean {
  return keys.some((key) => Boolean(answers[key]?.trim()));
}

function accommodationBranch(answers: Record<string, string>): PhEtravelAccommodationBranch {
  const value = normalized(answers.destination_type ?? answers.stay_location_type);
  if (value === "RESIDENCE") return "RESIDENCE";
  if (value === "HOTEL" || value === "HOTEL_RESORT") return "HOTEL";
  if (value === "TRANSIT" || value === "TRANSIT_VIA_AIRPORT") return "TRANSIT";
  return "UNKNOWN";
}

function destinationInputState(
  answers: Record<string, string>,
  selected: PhEtravelAccommodationBranch,
): PhEtravelDestinationInputState {
  const hasHotel = hasText(answers, ["destination_hotel_name", "destination_hotel_address"]);
  const hasTransit = hasText(answers, ["destination_transit_airport", "destination_country"]);
  const hasResidence = hasText(answers, ["destination_residence_address"]);
  const branchCount = Number(hasHotel) + Number(hasTransit) + Number(hasResidence);
  if (branchCount > 1) return "conflicting";
  if (selected === "RESIDENCE" && (hasHotel || hasTransit)) return "conflicting";
  if (selected === "HOTEL" && (hasResidence || hasTransit)) return "conflicting";
  if (selected === "TRANSIT" && (hasResidence || hasHotel)) return "conflicting";
  return "exclusive";
}

/**
 * E22 documents public client wiring only. This plan never contains answer
 * values or selectors, so dynamic option sources and UI clear behavior cannot
 * accidentally become a browser action or an official-payload assumption.
 */
export function buildPhEtravelAirDestinationActionPlan(
  answers: Record<string, string>,
): PhEtravelAirDestinationActionPlan {
  const selectedAccommodation = accommodationBranch(answers);
  const selectedSpecialFlight = isTrue(answers.is_special_flight) ||
    normalized(answers.flight_number) === "SPECIAL_FLIGHT";
  return {
    owner: "air_destination",
    evidence: "verified_public_bundle",
    status: "action_required",
    canonicalKeys: [...PH_ETRAVEL_AIR_DESTINATION_NEEDS_REVIEW_KEYS],
    blockingCodes: ["ph_etravel_launch_air_travel_review_required"],
    gaps: PH_ETRAVEL_AIR_DESTINATION_S2_GAPS.map((gap) => ({
      id: gap.id,
      canonicalKeys: [...gap.canonicalKeys].sort(),
      status: "action_required",
    })),
    specialFlight: {
      selected: selectedSpecialFlight,
      derivedUiStateOnly: true,
      officialDetailKey: "flight_number_special",
      forbiddenOfficialPayloadKeys: ["is_special_flight"],
    },
    transit: {
      selected: isTrue(answers.with_transit),
      childKeysRequireLiveServerReview: true,
    },
    returnDate: {
      clientCondition: "FOREIGNER_AIR_ARRIVAL_POV001_OR_POV007",
      renderAndSchemaParityLiveUnverified: true,
    },
    accommodation: {
      selected: selectedAccommodation,
      inputState: destinationInputState(answers, selectedAccommodation),
      mutuallyExclusive: true,
      dynamicHotelSourceLiveOptionValuesUnverified: true,
      dynamicHotelSourceServerAcceptanceUnverified: true,
      transitPortOptionsServerAcceptanceUnverified: true,
    },
    destinationPort: {
      dynamicPortSourceLiveOptionValuesUnverified: true,
      dynamicSourceServerAcceptanceUnverified: true,
      withCustomDeclarationRequiresMetadataAndMatchingLivePage: true,
      withCustomDeclarationAloneSelectsAirCustomsFlow: false,
    },
    actions: [],
    externalActions: {
      queue: "not_started",
      account: "not_started",
      browser: "not_started",
    },
    officialResubmitAllowed: false,
  };
}

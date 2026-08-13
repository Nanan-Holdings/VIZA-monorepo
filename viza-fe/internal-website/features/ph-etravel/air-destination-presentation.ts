import type { PhEtravelPassportHolderType } from "./profile-presentation";

export type PhEtravelAirDestinationInput = {
  passportHolderType: PhEtravelPassportHolderType;
  transportType: "AIR" | "SEA";
  direction: "ARRIVAL" | "DEPARTURE";
  purposeCode?: string | null;
  flightNumber?: string | null;
  withTransit?: boolean;
  stayLocationType?: "RESIDENCE" | "HOTEL" | "TRANSIT" | null;
};

export type PhEtravelAirDestinationReviewField = {
  key:
    | "air.airline_code"
    | "air.flight_number"
    | "air.special_flight_number"
    | "travel.with_transit"
    | "travel.transit_country_code"
    | "travel.transit_port"
    | "travel.transit_date"
    | "travel.return_date"
    | "destination.stay_location_type"
    | "destination.same_as_residence"
    | "destination.address_text"
    | "destination.hotel_name_or_address"
    | "destination.transit_port_code"
    | "destination.transit_destination_country_code";
  officialKey: string;
  mode: "review_gate";
  clientContract: "verified_public_bundle";
  liveServerUnknown: string;
};

export type PhEtravelAirDestinationPresentation = {
  route: "air_review" | "not_applicable";
  fields: PhEtravelAirDestinationReviewField[];
  derived: {
    specialFlight: {
      active: boolean;
      condition: "flight_number === SPECIAL FLIGHT";
      isApplicantAnswer: false;
      excludedFromPayload: ["air.is_special_flight"];
    };
  };
  clearBehavior: readonly string[];
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
    en: "This travel detail needs official review before you can continue.",
    zh: "这项旅行信息需要官方复核后才能继续。",
  },
};

function reviewField(
  key: PhEtravelAirDestinationReviewField["key"],
  officialKey: string,
  liveServerUnknown: string
): PhEtravelAirDestinationReviewField {
  return {
    key,
    officialKey,
    mode: "review_gate",
    clientContract: "verified_public_bundle",
    liveServerUnknown,
  };
}

/**
 * E22 records client wiring only. It deliberately excludes the derived
 * Special Flight boolean from applicant answers and every branch stays gated.
 */
export function createPhEtravelAirDestinationPresentation(
  input: PhEtravelAirDestinationInput
): PhEtravelAirDestinationPresentation {
  const specialFlight =
    input.transportType === "AIR" &&
    input.flightNumber?.trim().toUpperCase() === "SPECIAL FLIGHT";
  if (input.transportType !== "AIR" || input.direction !== "ARRIVAL") {
    return {
      route: "not_applicable",
      fields: [],
      derived: {
        specialFlight: {
          active: false,
          condition: "flight_number === SPECIAL FLIGHT",
          isApplicantAnswer: false,
          excludedFromPayload: ["air.is_special_flight"],
        },
      },
      clearBehavior: [],
      gate: reviewGate,
    };
  }

  const fields: PhEtravelAirDestinationReviewField[] = [
    reviewField(
      "air.airline_code",
      "travel_company_code",
      "Live airline options, flight-to-port metadata, requiredness, and server acceptance are unknown."
    ),
    reviewField(
      "air.flight_number",
      "flight_number",
      "Live flight options, sentinel behavior, destination-port metadata, requiredness, and server acceptance are unknown."
    ),
    reviewField(
      "travel.with_transit",
      "with_transit",
      "Live control behavior, child-value handling, requiredness, and server acceptance are unknown."
    ),
    reviewField(
      "destination.stay_location_type",
      "stay_location_type",
      "Live branch rendering, requiredness, and server acceptance are unknown."
    ),
  ];

  if (specialFlight) {
    fields.push(
      reviewField(
        "air.special_flight_number",
        "flight_number_special",
        "The client sentinel branch and local minimum are known, but live validation and server acceptance are unknown."
      )
    );
  }
  if (input.withTransit) {
    fields.push(
      reviewField(
        "travel.transit_country_code",
        "transit_country_code",
        "Live country options, requiredness, and server acceptance are unknown."
      ),
      reviewField(
        "travel.transit_port",
        "transit_port",
        "Live transit-port validation and server acceptance are unknown."
      ),
      reviewField(
        "travel.transit_date",
        "transit_date",
        "Live date validation and server acceptance are unknown."
      )
    );
  }
  if (
    input.passportHolderType === "FOREIGNER" &&
    (input.purposeCode === "POV001" || input.purposeCode === "POV007")
  ) {
    fields.push(
      reviewField(
        "travel.return_date",
        "return_date",
        "The public renderer and schema differ on date minimum; live visibility, requiredness, and server acceptance are unknown."
      )
    );
  }
  if (input.stayLocationType === "RESIDENCE") {
    fields.push(
      reviewField(
        "destination.same_as_residence",
        "is_destination_same_as_permanent_address",
        "Client-side profile-address composition is known, but live format, editability, requiredness, and server acceptance are unknown."
      ),
      reviewField(
        "destination.address_text",
        "destination_upon_arrival_in_philippines",
        "Live label, requiredness, and server acceptance are unknown."
      )
    );
  }
  if (input.stayLocationType === "HOTEL") {
    fields.push(
      reviewField(
        "destination.hotel_name_or_address",
        "destination_upon_arrival_in_philippines",
        "Hotel suggestions are dynamic; no stable hotel code, live option behavior, or server acceptance is proven."
      )
    );
  }
  if (input.stayLocationType === "TRANSIT") {
    fields.push(
      reviewField(
        "destination.transit_port_code",
        "transit_port_code",
        "The public fixed airport list does not prove live rendering, requiredness, or server acceptance."
      ),
      reviewField(
        "destination.transit_destination_country_code",
        "transit_destination_country_code",
        "The public country source does not prove live options, requiredness, or server acceptance."
      )
    );
  }

  return {
    route: "air_review",
    fields,
    derived: {
      specialFlight: {
        active: specialFlight,
        condition: "flight_number === SPECIAL FLIGHT",
        isApplicantAnswer: false,
        excludedFromPayload: ["air.is_special_flight"],
      },
    },
    clearBehavior: [
      "Changing airline clears normal flight, special-flight detail, and AIR destination-port metadata.",
      "Changing destination type clears destination address, transit port/country, and same-as-residence state.",
      "Toggling transit does not clear client-side transit children in the inspected handler.",
    ],
    gate: reviewGate,
  };
}

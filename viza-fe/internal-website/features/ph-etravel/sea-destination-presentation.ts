import {
  resolvePhEtravelSeaDestinationPortFlow,
  type PhEtravelSeaDestinationPortSnapshot,
  type PhEtravelSeaPortFlowResolution,
} from "./port-flow";

export type PhEtravelSeaDestinationPresentationInput = {
  transportType: "AIR" | "SEA";
  flightType: "ARRIVAL" | "DEPARTURE";
  isDisembarking?: boolean | null;
  stayLocationType?: "RESIDENCE" | "HOTEL" | "TRAVEL_PORT" | null;
  destinationPortCode?: string | null;
  disembarkingPortCode?: string | null;
  portSnapshot?: PhEtravelSeaDestinationPortSnapshot | null;
  now?: Date;
};

export type PhEtravelSeaDestinationField = {
  key:
    | "sea.is_disembarking"
    | "sea.destination_port_code"
    | "destination.stay_location_type"
    | "destination.address_text"
    | "destination.hotel_name_or_address"
    | "destination.disembarking_port_code";
  clientContract: "verified_public_bundle";
  serverEvidence: "needs_review";
  mode: "review_gate";
};

export type PhEtravelSeaDestinationPresentation = {
  route: "sea_arrival" | "not_applicable";
  fields: PhEtravelSeaDestinationField[];
  falseyHidesStayDestination: boolean;
  destinationPortResolution: PhEtravelSeaPortFlowResolution | null;
  portIdentityBoundary:
    | "destination_port_code_is_independent_from_disembarking_port_code"
    | "not_applicable";
  clearBoundary: "no_disembarking_clear_rule_observed" | "not_applicable";
  gate: {
    authorization: "stop_before_submit";
    submitted: false;
    noQueue: true;
    noBrowser: true;
    noResubmit: true;
  };
};

const reviewField = (
  key: PhEtravelSeaDestinationField["key"]
): PhEtravelSeaDestinationField => ({
  key,
  clientContract: "verified_public_bundle",
  serverEvidence: "needs_review",
  mode: "review_gate",
});

const STOP_GATE = {
  authorization: "stop_before_submit" as const,
  submitted: false as const,
  noQueue: true as const,
  noBrowser: true as const,
  noResubmit: true as const,
};

export function createPhEtravelSeaDestinationPresentation(
  input: PhEtravelSeaDestinationPresentationInput
): PhEtravelSeaDestinationPresentation {
  if (input.transportType !== "SEA" || input.flightType !== "ARRIVAL") {
    return {
      route: "not_applicable",
      fields: [],
      falseyHidesStayDestination: false,
      destinationPortResolution: null,
      portIdentityBoundary: "not_applicable",
      clearBoundary: "not_applicable",
      gate: STOP_GATE,
    };
  }

  const fields: PhEtravelSeaDestinationField[] = [
    reviewField("sea.is_disembarking"),
    reviewField("sea.destination_port_code"),
  ];
  const isDisembarking = input.isDisembarking === true;

  if (isDisembarking) {
    fields.push(reviewField("destination.stay_location_type"));
    if (input.stayLocationType === "RESIDENCE") {
      fields.push(reviewField("destination.address_text"));
    }
    if (input.stayLocationType === "HOTEL") {
      fields.push(reviewField("destination.hotel_name_or_address"));
    }
    if (input.stayLocationType === "TRAVEL_PORT") {
      fields.push(reviewField("destination.disembarking_port_code"));
    }
  }

  return {
    route: "sea_arrival",
    fields,
    falseyHidesStayDestination: !isDisembarking,
    destinationPortResolution: resolvePhEtravelSeaDestinationPortFlow(
      input.destinationPortCode,
      input.portSnapshot,
      input.now
    ),
    portIdentityBoundary:
      "destination_port_code_is_independent_from_disembarking_port_code",
    clearBoundary: "no_disembarking_clear_rule_observed",
    gate: STOP_GATE,
  };
}

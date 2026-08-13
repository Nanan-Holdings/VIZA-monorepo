export const PH_ETRAVEL_SEA_FLOW_NEEDS_REVIEW_KEYS = [
  "destination.destination_port_code",
  "destination.disembarking_port_code",
  "sea.is_disembarking",
] as const;

type PhEtravelSeaDisembarkingState = "true" | "false_or_default" | "unknown";

export type PhEtravelSeaFlowActionPlan =
  | {
      owner: "sea_flow";
      evidence: "not_applicable";
      status: "not_applicable";
      actions: [];
      externalActions: {
        queue: "not_started";
        account: "not_started";
        browser: "not_started";
      };
      officialResubmitAllowed: false;
    }
  | {
      owner: "sea_flow";
      evidence: "verified_public_bundle";
      status: "action_required";
      canonicalKeys: string[];
      blockingCodes: [
        "ph_etravel_launch_sea_disembarking_review_required",
        "ph_etravel_launch_sea_customs_flow_review_required",
      ];
      disembarking: {
        state: PhEtravelSeaDisembarkingState;
        staticDefault: false;
        visibleOnlyForSeaArrival: true;
        switchingToAirOrDepartureClearsClientState: true;
        falseyHidesStayDestinationSubtree: true;
        explicitFalseLiveServerAccepted: false;
      };
      ports: {
        destinationPortKey: "destination_port_code";
        disembarkingPortKey: "disembarking_port_code";
        keysAreAliases: false;
        disembarkingPortDynamicOptionsLiveSemanticsUnverified: true;
        destinationPortToCustomsFlowMappingUnverified: true;
      };
      dynamicPageGate: {
        metadataKey: "with_custom_declaration";
        onlyControlsDynamicPageArrayInsertion: true;
        determinesManualOrElectronicCustomsFlow: false;
        mayBeReadFromDistinctRegularNestedAndTopLevelShapes: true;
      };
      routes: {
        regular: "/wizard/me";
        shortcut: "/wizard/declaration";
        routeSelectionLiveVerified: false;
        fixedWizardPageIndexAllowed: false;
        regularAndShortcutSequencesInterchangeable: false;
      };
      serverAcceptance: "unknown_do_not_infer";
      actions: [];
      externalActions: {
        queue: "not_started";
        account: "not_started";
        browser: "not_started";
      };
      officialResubmitAllowed: false;
    };

function normalized(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/[\s-]+/g, "_").toUpperCase() : "";
}

function disembarkingState(value: unknown): PhEtravelSeaDisembarkingState {
  const normalizedValue = normalized(value);
  if (["YES", "Y", "TRUE", "1", "ON", "CHECKED"].includes(normalizedValue)) return "true";
  if (["", "NO", "N", "FALSE", "0", "OFF", "UNCHECKED"].includes(normalizedValue)) return "false_or_default";
  return "unknown";
}

/**
 * E24 distinguishes client rendering from live continuation. It never emits
 * a port value, selector, or inferred manual/electronic flow.
 */
export function buildPhEtravelSeaFlowActionPlan(input: {
  transportType: string | null | undefined;
  answers: Record<string, string>;
}): PhEtravelSeaFlowActionPlan {
  if (normalized(input.transportType) !== "SEA") {
    return {
      owner: "sea_flow",
      evidence: "not_applicable",
      status: "not_applicable",
      actions: [],
      externalActions: { queue: "not_started", account: "not_started", browser: "not_started" },
      officialResubmitAllowed: false,
    };
  }
  return {
    owner: "sea_flow",
    evidence: "verified_public_bundle",
    status: "action_required",
    canonicalKeys: [...PH_ETRAVEL_SEA_FLOW_NEEDS_REVIEW_KEYS],
    blockingCodes: [
      "ph_etravel_launch_sea_disembarking_review_required",
      "ph_etravel_launch_sea_customs_flow_review_required",
    ],
    disembarking: {
      state: disembarkingState(input.answers.is_disembarking),
      staticDefault: false,
      visibleOnlyForSeaArrival: true,
      switchingToAirOrDepartureClearsClientState: true,
      falseyHidesStayDestinationSubtree: true,
      explicitFalseLiveServerAccepted: false,
    },
    ports: {
      destinationPortKey: "destination_port_code",
      disembarkingPortKey: "disembarking_port_code",
      keysAreAliases: false,
      disembarkingPortDynamicOptionsLiveSemanticsUnverified: true,
      destinationPortToCustomsFlowMappingUnverified: true,
    },
    dynamicPageGate: {
      metadataKey: "with_custom_declaration",
      onlyControlsDynamicPageArrayInsertion: true,
      determinesManualOrElectronicCustomsFlow: false,
      mayBeReadFromDistinctRegularNestedAndTopLevelShapes: true,
    },
    routes: {
      regular: "/wizard/me",
      shortcut: "/wizard/declaration",
      routeSelectionLiveVerified: false,
      fixedWizardPageIndexAllowed: false,
      regularAndShortcutSequencesInterchangeable: false,
    },
    serverAcceptance: "unknown_do_not_infer",
    actions: [],
    externalActions: { queue: "not_started", account: "not_started", browser: "not_started" },
    officialResubmitAllowed: false,
  };
}

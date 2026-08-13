export type PhEtravelSeaDestinationPort = {
  code: string;
  label: string;
  withCustomDeclaration: 0 | 1;
};

export type PhEtravelSeaDestinationPortSnapshot = {
  retrievedAt: string;
  ports: readonly PhEtravelSeaDestinationPort[];
};

/** E24 proves only a public wizard-array insertion predicate, not a customs flow. */
export type PhEtravelSeaDynamicPageArrayGate =
  "electronic_sections_inserted" | "electronic_sections_not_inserted" | null;
export type PhEtravelSeaPortFlowStatus =
  | "resolved"
  | "missing_destination_port"
  | "unknown_destination_port"
  | "invalid_port_metadata"
  | "stale_port_metadata";

export type PhEtravelSeaPortFlowResolution = {
  status: PhEtravelSeaPortFlowStatus;
  dynamicPageArrayGate: PhEtravelSeaDynamicPageArrayGate;
  port?: PhEtravelSeaDestinationPort;
  reason: string;
  requiresLiveContinuationReview: true;
};

export const PH_ETRAVEL_SEA_DESTINATION_PORT_METADATA_SOURCE = {
  endpoint: "/api/v1/common/travel_ports",
  query: {
    paginate: "0",
    q: "",
    order_by: "name",
    status_by: "asc",
    transportation_type: "SEA",
  },
  valueField: "code",
  labelField: "name",
  metadataField: "with_custom_declaration",
  evidence: "verified_public",
  observedCount: 53,
  retrievedAt: "2026-08-04",
} as const;

const MAX_PORT_METADATA_AGE_MS = 24 * 60 * 60 * 1000;

function isCurrentSnapshot(retrievedAt: string, now: Date): boolean {
  const timestamp = Date.parse(retrievedAt);
  return (
    Number.isFinite(timestamp) &&
    timestamp <= now.getTime() &&
    now.getTime() - timestamp <= MAX_PORT_METADATA_AGE_MS
  );
}

function isValidPort(port: PhEtravelSeaDestinationPort): boolean {
  return (
    port.code.trim().length > 0 &&
    port.label.trim().length > 0 &&
    (port.withCustomDeclaration === 0 || port.withCustomDeclaration === 1)
  );
}

export function resolvePhEtravelSeaDestinationPortFlow(
  destinationPortCode: string | null | undefined,
  snapshot: PhEtravelSeaDestinationPortSnapshot | null | undefined,
  now = new Date()
): PhEtravelSeaPortFlowResolution {
  if (!destinationPortCode?.trim()) {
    return {
      status: "missing_destination_port",
      dynamicPageArrayGate: null,
      reason:
        "The SEA destination-port page-array gate cannot be assessed until the official destination_port_code is available.",
      requiresLiveContinuationReview: true,
    };
  }

  if (!snapshot || !isCurrentSnapshot(snapshot.retrievedAt, now)) {
    return {
      status: "stale_port_metadata",
      dynamicPageArrayGate: null,
      reason:
        "SEA destination-port metadata is missing, invalid, or stale. Do not assume a customs continuation.",
      requiresLiveContinuationReview: true,
    };
  }

  const matches = snapshot.ports.filter(
    (port) => port.code === destinationPortCode
  );
  if (matches.length === 0) {
    return {
      status: "unknown_destination_port",
      dynamicPageArrayGate: null,
      reason:
        "The selected destination_port_code is not present in the current official SEA port metadata.",
      requiresLiveContinuationReview: true,
    };
  }

  if (matches.length !== 1 || !isValidPort(matches[0])) {
    return {
      status: "invalid_port_metadata",
      dynamicPageArrayGate: null,
      reason:
        "The selected SEA destination-port metadata is ambiguous or invalid. Do not choose a customs continuation.",
      requiresLiveContinuationReview: true,
    };
  }

  const port = matches[0];
  return {
    status: "resolved",
    dynamicPageArrayGate:
      port.withCustomDeclaration === 1
        ? "electronic_sections_inserted"
        : "electronic_sections_not_inserted",
    port,
    reason:
      port.withCustomDeclaration === 1
        ? "Official public metadata inserts an electronic page array for this destination_port_code. It does not prove a live customs flow or continuation."
        : "Official public metadata does not insert the electronic page array for this destination_port_code. It does not prove a manual customs notice or continuation.",
    requiresLiveContinuationReview: true,
  };
}

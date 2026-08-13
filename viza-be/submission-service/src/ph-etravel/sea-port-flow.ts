export const PH_ETRAVEL_OFFICIAL_COMMON_API = "https://ws.etravel.gov.ph/api/v1/common";
export const PH_ETRAVEL_SEA_TRAVEL_PORTS_PATH =
  "travel_ports?paginate=0&q=&order_by=name&status_by=asc&transportation_type=SEA";

export interface PhEtravelSeaTravelPortRecord {
  transportation_type: "SEA";
  code: string;
  with_custom_declaration: 0 | 1;
}

export type PhEtravelSeaPortFlowResolution =
  | {
    status: "dynamic_pages_enabled";
    destinationPortCode: string;
    source: "official_public_api";
  }
  | {
    status: "dynamic_pages_not_enabled";
    destinationPortCode: string;
    source: "official_public_api";
  }
  | {
    status: "action_required";
    code:
      | "sea_destination_port_code_required"
      | "sea_destination_port_metadata_unavailable"
      | "sea_destination_port_metadata_malformed"
      | "sea_destination_port_metadata_unknown";
  };

export interface PhEtravelSeaPortFlowFetchOptions {
  fetcher?: typeof fetch;
}

export type PhEtravelSeaCustomsPageFlow = "electronic" | "manual" | "shared_confirmation" | null;

export type PhEtravelSeaPortFlowPageGate =
  | { status: "matched"; flow: "electronic" | "manual" | "shared_confirmation" }
  | {
    status: "action_required";
    code:
      | "sea_destination_port_code_required"
      | "sea_destination_port_metadata_required"
      | "sea_destination_port_metadata_unavailable"
      | "sea_destination_port_metadata_malformed"
      | "sea_destination_port_metadata_unknown"
      | "sea_port_flow_metadata_page_mismatch"
      | "sea_dynamic_page_gate_live_content_required";
  };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readDestinationPortCode(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim();
  return /^[A-Z0-9][A-Z0-9-]{0,79}$/.test(code) ? code : null;
}

function parseSeaTravelPortRecord(value: unknown): PhEtravelSeaTravelPortRecord | null {
  if (!isRecord(value)) return null;
  const code = readDestinationPortCode(typeof value.code === "string" ? value.code : null);
  if (!code || value.transportation_type !== "SEA") return null;
  if (value.with_custom_declaration !== 0 && value.with_custom_declaration !== 1) return null;
  return {
    transportation_type: "SEA",
    code,
    with_custom_declaration: value.with_custom_declaration,
  };
}

export function resolvePhEtravelSeaPortFlowMetadata(input: {
  destinationPortCode: string | null | undefined;
  response: unknown;
}): PhEtravelSeaPortFlowResolution {
  const destinationPortCode = readDestinationPortCode(input.destinationPortCode);
  if (!destinationPortCode) return { status: "action_required", code: "sea_destination_port_code_required" };
  if (!isRecord(input.response) || !Array.isArray(input.response.data)) {
    return { status: "action_required", code: "sea_destination_port_metadata_malformed" };
  }

  const matches = input.response.data
    .filter((item): item is Record<string, unknown> => isRecord(item) && item.code === destinationPortCode)
    .map(parseSeaTravelPortRecord);
  if (matches.length === 0) {
    return { status: "action_required", code: "sea_destination_port_metadata_unknown" };
  }
  if (matches.length !== 1 || !matches[0]) {
    return { status: "action_required", code: "sea_destination_port_metadata_malformed" };
  }

  return matches[0].with_custom_declaration === 1
    ? { status: "dynamic_pages_enabled", destinationPortCode, source: "official_public_api" }
    : { status: "dynamic_pages_not_enabled", destinationPortCode, source: "official_public_api" };
}

export function verifyPhEtravelSeaPortFlowPage(input: {
  metadata: PhEtravelSeaPortFlowResolution | null | undefined;
  pageFlow: PhEtravelSeaCustomsPageFlow;
}): PhEtravelSeaPortFlowPageGate {
  if (!input.metadata) {
    return { status: "action_required", code: "sea_destination_port_metadata_required" };
  }
  if (input.metadata.status === "action_required") return input.metadata;
  if (input.metadata.status === "dynamic_pages_enabled" && input.pageFlow === "shared_confirmation") {
    return { status: "matched", flow: "shared_confirmation" };
  }
  if (input.metadata.status === "dynamic_pages_enabled" && input.pageFlow === "electronic") {
    return { status: "matched", flow: "electronic" };
  }
  if (input.metadata.status === "dynamic_pages_enabled" && input.pageFlow === "manual") {
    return { status: "action_required", code: "sea_port_flow_metadata_page_mismatch" };
  }
  // A false metadata flag means only that the static array does not insert
  // dynamic pages. It cannot be reinterpreted as a manual-port mapping.
  return { status: "action_required", code: "sea_dynamic_page_gate_live_content_required" };
}

/**
 * The port catalogue is a runtime public-option source, not a permanent
 * in-repo snapshot. Callers must fail closed when the current response cannot
 * identify the selected SEA destination port.
 */
export async function loadPhEtravelSeaPortFlowMetadata(
  destinationPortCode: string | null | undefined,
  options: PhEtravelSeaPortFlowFetchOptions = {},
): Promise<PhEtravelSeaPortFlowResolution> {
  const fetcher = options.fetcher ?? fetch;
  try {
    const response = await fetcher(`${PH_ETRAVEL_OFFICIAL_COMMON_API}/${PH_ETRAVEL_SEA_TRAVEL_PORTS_PATH}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      return { status: "action_required", code: "sea_destination_port_metadata_unavailable" };
    }
    return resolvePhEtravelSeaPortFlowMetadata({
      destinationPortCode,
      response: await response.json(),
    });
  } catch {
    return { status: "action_required", code: "sea_destination_port_metadata_unavailable" };
  }
}

import {
  evaluatePhEtravelArrivalLaunchPreflight,
  type PhEtravelArrivalLaunchPreflight,
  type PhEtravelLaunchPreflightCode,
} from "./launch-preflight";
import type { SubmissionPayload } from "../country-submissions/types";
import {
  PH_ETRAVEL_PROFILE_OWNED_NEEDS_REVIEW_KEYS,
  PH_ETRAVEL_RESIDENCE_NEEDS_REVIEW_KEYS,
} from "./profile-owned-preflight";
import { PH_ETRAVEL_AIR_DESTINATION_NEEDS_REVIEW_KEYS } from "./air-destination-preflight";
import { PH_ETRAVEL_HEALTH_S3_NEEDS_REVIEW_KEYS } from "./health-preflight";
import { PH_ETRAVEL_SEA_FLOW_NEEDS_REVIEW_KEYS } from "./sea-flow-preflight";

export const PH_ETRAVEL_LAUNCH_PREFLIGHT_CONTRACT_VERSION =
  "ph_etravel_launch_preflight_v1" as const;

export type PhEtravelLaunchPreflightEnvelopeStatus =
  | "allowed"
  | "action_required"
  | "diverted";

export type PhEtravelLaunchPreflightEnvelope =
  | {
    contractVersion: typeof PH_ETRAVEL_LAUNCH_PREFLIGHT_CONTRACT_VERSION;
    status: "allowed";
    code?: undefined;
    blockingCodes: [];
    canonicalKeys: [];
    officialResubmitAllowed: false;
  }
  | {
    contractVersion: typeof PH_ETRAVEL_LAUNCH_PREFLIGHT_CONTRACT_VERSION;
    status: "action_required" | "diverted";
    code: PhEtravelLaunchPreflightCode;
    blockingCodes: PhEtravelLaunchPreflightCode[];
    canonicalKeys: string[];
    officialResubmitAllowed: false;
  };

const PREFLIGHT_PROPERTIES = new Set([
  "status",
  "code",
  "blockingCodes",
  "missingKeys",
  "officialResubmitAllowed",
]);

const ENVELOPE_PROPERTIES = new Set([
  "contractVersion",
  "status",
  "code",
  "blockingCodes",
  "canonicalKeys",
  "officialResubmitAllowed",
]);

const CODE_CANONICAL_KEYS: Record<PhEtravelLaunchPreflightCode, readonly string[]> = {
  ph_etravel_arrival_diverted_unsupported: ["eligibility.ordinary_arrival"],
  ph_etravel_arrival_for_other_action_required: ["registration.application_for"],
  ph_etravel_launch_profile_persona_review_required: PH_ETRAVEL_PROFILE_OWNED_NEEDS_REVIEW_KEYS,
  ph_etravel_launch_residence_review_required: PH_ETRAVEL_RESIDENCE_NEEDS_REVIEW_KEYS,
  ph_etravel_launch_air_travel_review_required: PH_ETRAVEL_AIR_DESTINATION_NEEDS_REVIEW_KEYS,
  ph_etravel_launch_air_special_flight_review_required: [
    "air.is_special_flight",
    "air.special_flight_number",
  ],
  ph_etravel_launch_health_positive_review_required: PH_ETRAVEL_HEALTH_S3_NEEDS_REVIEW_KEYS,
  ph_etravel_launch_sea_disembarking_review_required: ["sea.is_disembarking"],
  ph_etravel_launch_sea_customs_flow_review_required: PH_ETRAVEL_SEA_FLOW_NEEDS_REVIEW_KEYS,
  ph_etravel_launch_sea_electronic_positive_review_required: [
    "attachments.travel_document",
    "currency.needs_currency_declaration",
  ],
  ph_etravel_launch_currency_positive_review_required: [
    "currency.bsp_authorization_date",
    "currency.needs_currency_declaration",
    "currency.owner_not_applicable",
  ],
  ph_etravel_launch_goods_amount_checklist_required: [
    "customs.amount_of_goods_acquired",
    "customs.check_lists_3_to_12",
  ],
  ph_etravel_launch_attachment_review_required: ["attachments.travel_document"],
  ph_etravel_launch_customs_signature_review_required: ["customs.signature"],
  ph_etravel_launch_final_result_recovery_required: [
    "result.official_reference",
    "result.reference_qr_render",
  ],
};

const PII_SHAPED_VALUE = /(?:\b[A-Z]\d{6,}\b|\b\d{6,}[A-Z]\b|@|passport)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function includesPiiLikeValue(value: unknown): boolean {
  if (typeof value === "string") return PII_SHAPED_VALUE.test(value);
  if (Array.isArray(value)) return value.some(includesPiiLikeValue);
  if (isRecord(value)) return Object.values(value).some(includesPiiLikeValue);
  return false;
}

function isStatus(value: unknown): value is PhEtravelLaunchPreflightEnvelopeStatus {
  return value === "allowed" || value === "action_required" || value === "diverted";
}

function isCode(value: unknown): value is PhEtravelLaunchPreflightCode {
  return typeof value === "string" && value in CODE_CANONICAL_KEYS;
}

function asStringArray(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : null;
}

function stableUnique(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort();
}

function fallbackEnvelope(): PhEtravelLaunchPreflightEnvelope {
  return {
    contractVersion: PH_ETRAVEL_LAUNCH_PREFLIGHT_CONTRACT_VERSION,
    status: "action_required",
    code: "ph_etravel_launch_final_result_recovery_required",
    blockingCodes: ["ph_etravel_launch_final_result_recovery_required"],
    canonicalKeys: ["result.official_reference", "result.reference_qr_render"],
    officialResubmitAllowed: false,
  };
}

function normalize(
  input: unknown,
  keysProperty: "missingKeys" | "canonicalKeys",
  requireVersion: boolean,
): PhEtravelLaunchPreflightEnvelope {
  if (!isRecord(input) || includesPiiLikeValue(input)) return fallbackEnvelope();
  const permittedProperties = requireVersion ? ENVELOPE_PROPERTIES : PREFLIGHT_PROPERTIES;
  if (Object.keys(input).some((key) => !permittedProperties.has(key))) return fallbackEnvelope();
  if (requireVersion && input.contractVersion !== PH_ETRAVEL_LAUNCH_PREFLIGHT_CONTRACT_VERSION) {
    return fallbackEnvelope();
  }
  if (!isStatus(input.status) || input.officialResubmitAllowed !== false) return fallbackEnvelope();

  const blockingCodes = asStringArray(input.blockingCodes);
  const canonicalKeys = asStringArray(input[keysProperty]);
  if (!blockingCodes || !canonicalKeys) return fallbackEnvelope();

  if (input.status === "allowed") {
    return input.code === undefined && blockingCodes.length === 0 && canonicalKeys.length === 0
      ? {
          contractVersion: PH_ETRAVEL_LAUNCH_PREFLIGHT_CONTRACT_VERSION,
          status: "allowed",
          code: undefined,
          blockingCodes: [],
          canonicalKeys: [],
          officialResubmitAllowed: false,
        }
      : fallbackEnvelope();
  }

  if (!isCode(input.code) || input.status === "diverted" && input.code !== "ph_etravel_arrival_diverted_unsupported") {
    return fallbackEnvelope();
  }
  if (blockingCodes.some((code) => !isCode(code))) return fallbackEnvelope();

  const normalizedCodes = stableUnique(blockingCodes) as PhEtravelLaunchPreflightCode[];
  if (!normalizedCodes.includes(input.code) || canonicalKeys.length === 0) return fallbackEnvelope();
  const permittedKeys = new Set(normalizedCodes.flatMap((code) => CODE_CANONICAL_KEYS[code]));
  if (canonicalKeys.some((key) => !permittedKeys.has(key))) return fallbackEnvelope();
  const normalizedKeys = stableUnique(canonicalKeys);
  if (
    requireVersion &&
    (normalizedCodes.length !== blockingCodes.length ||
      normalizedKeys.length !== canonicalKeys.length ||
      normalizedCodes.some((code, index) => code !== blockingCodes[index]) ||
      normalizedKeys.some((key, index) => key !== canonicalKeys[index]))
  ) {
    return fallbackEnvelope();
  }

  return {
    contractVersion: PH_ETRAVEL_LAUNCH_PREFLIGHT_CONTRACT_VERSION,
    status: input.status,
    code: input.code,
    blockingCodes: normalizedCodes,
    canonicalKeys: normalizedKeys,
    officialResubmitAllowed: false,
  };
}

/**
 * Converts the legacy internal preflight shape into the PH-D v1 consumer
 * envelope. It emits only stable safe codes and canonical field names.
 */
export function createPhEtravelLaunchPreflightEnvelope(
  preflight: PhEtravelArrivalLaunchPreflight | unknown,
): PhEtravelLaunchPreflightEnvelope {
  return normalize(preflight, "missingKeys", false);
}

/**
 * Evaluates the arrival-only P0 gate and immediately produces its public,
 * PII-free v1 envelope. This is a pure boundary and never starts queue,
 * browser, account, RPC, or final-submit work.
 */
export function evaluatePhEtravelArrivalLaunchPreflightEnvelope(input: {
  payload: SubmissionPayload;
  finalSubmitEnabled: boolean;
  existingResultRequiresRecovery?: boolean;
}): PhEtravelLaunchPreflightEnvelope {
  return createPhEtravelLaunchPreflightEnvelope(
    evaluatePhEtravelArrivalLaunchPreflight(input),
  );
}

/**
 * Consumers may validate a transported v1 envelope independently. Invalid,
 * stale, or value-bearing payloads always become a safe action-required gate.
 */
export function parsePhEtravelLaunchPreflightEnvelope(
  envelope: unknown,
): PhEtravelLaunchPreflightEnvelope {
  return normalize(envelope, "canonicalKeys", true);
}

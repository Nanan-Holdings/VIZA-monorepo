#!/usr/bin/env node

/**
 * Read-only, fixed-scope diagnostic for the retained UK submission worker.
 *
 * This module deliberately invokes only `fly machines list` and
 * `fly logs --no-tail --json` for the one production legacy app. It rebuilds a
 * small allowlisted report and never prints the command's raw stdout/stderr.
 */

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const FIXED_LEGACY_APP = "viza-prod-submission-legacy";

const ALLOWED_STATES = new Set([
  "created",
  "started",
  "starting",
  "stopped",
  "stopping",
  "suspended",
  "failed",
  "replacing",
]);

const ALLOWED_STAGES = new Set([
  "run",
  "browser_launch",
  "login",
  "registration",
  "page_goto",
  "page_fill",
  "page_save",
  "validation",
  "review",
  "documents",
  "inbox",
  "captcha",
  "cleanup",
]);

const ALLOWED_OUTCOMES = new Set(["success", "failed", "stopped", "skipped", "timeout"]);
const ALLOWED_DIAGNOSTIC_CODES = new Set([
  "radio_group_missing",
  "radio_label_missing",
  "radio_option_unmatched",
  "radio_disabled",
  "radio_check_failed",
  "unknown",
]);
const SAFE_ID = /^[A-Za-z0-9-]{4,80}$/u;
const SAFE_IMAGE = /^(?:registry\.fly\.io|ghcr\.io)\/[A-Za-z0-9._/-]+(?::[A-Za-z0-9._-]+|@sha256:[a-f0-9]{64})?$/u;
const TIMING_PREFIX = "[uk-timing]";
export const KNOWN_UK_PAGE_SLUGS = new Set([
  // The 49 keys in viza-be/submission-service/src/uk/page-bindings.ts.
  "standardApplicantsEmail",
  "hasAdditionalEmailEV",
  "standardTelephoneDetailsList.0",
  "standardTelephoneDetailsList",
  "standardContactingYouByTelephone",
  "identityNameForLeaveToEnterList.0",
  "identityNameForLeaveToEnterList",
  "standardGenderRelationshipOOC",
  "standardAddressOoC",
  "standardAboutYourHomeOoC",
  "travelDocumentIssueDetails",
  "standardIdentityCard",
  "standardNationalityDOBOoC",
  "standardOtherNationality",
  "adsAgreement",
  "immigrationStatus",
  "employmentStatus",
  "fundingEmploymentEmployerDetails",
  "fundingEmploymentJobDetails",
  "fundingOtherIncome",
  "plannedSpendOnVisitToUK",
  "monthlyOutgoings",
  "payingForYourVisit",
  "spokenLanguagePreference",
  "purposeOfVisitForVV",
  "purposeOfTourismVisitForVV",
  "aboutYourVisit",
  "hasDependants",
  "parentOneDetails",
  "parentTwoDetails",
  "familyInUk",
  "travellingWithOtherPeople",
  "travellingWithOtherPeopleDetails",
  "accommodationArrangements",
  "otherAccommodationDetailsList",
  "otherAccommodationDetailsList.0",
  "standardTimesTravelledToUK",
  "timesTravelledToOtherCountries",
  "standardWorldTravelHistory",
  "odwPlannedTravelInformation",
  "standardImmigrationProblems",
  "standardImmigrationBreach",
  "standardCriminalConvictions.0.standardCriminalConvictionType",
  "standardWarCrimes",
  "standardTerroristActivities",
  "standardExtremistActivities",
  "standardPersonOfGoodCharacter",
  "standardEmploymentHistory",
  "otherInformation",
]);
export const KNOWN_UK_TIMING_PHASE_SLUGS = new Set([
  "registration",
  "pre_auth",
  "form",
  "commit",
  "persist",
  "resume",
  "goto",
  "continue",
  "review",
  "documents",
]);
const ALLOWED_UK_SLUGS = new Set([
  ...KNOWN_UK_PAGE_SLUGS,
  ...KNOWN_UK_TIMING_PHASE_SLUGS,
]);

class DiagnosticFailure extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function boundedInteger(value, maximum) {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= maximum) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/u.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed) && parsed <= maximum) return parsed;
  }
  return null;
}

function parseFlag(value) {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return false;
  return /^(?:1|true|yes|on)$/iu.test(value.trim());
}

export function validateLegacyApp(value) {
  if (value !== FIXED_LEGACY_APP) {
    throw new DiagnosticFailure("legacy_app_not_configured");
  }
  return value;
}

function safeState(value) {
  return typeof value === "string" && ALLOWED_STATES.has(value) ? value : "unknown";
}

function safeImage(value) {
  return typeof value === "string" && SAFE_IMAGE.test(value) ? value : null;
}

function machineReport(machine) {
  if (!isRecord(machine) || typeof machine.id !== "string" || !SAFE_ID.test(machine.id)) {
    throw new DiagnosticFailure("machine_payload_invalid");
  }
  const config = isRecord(machine.config) ? machine.config : {};
  const guest = isRecord(config.guest) ? config.guest : {};
  const env = isRecord(config.env) ? config.env : {};
  return {
    id: machine.id,
    state: safeState(machine.state),
    image: safeImage(config.image),
    cpus: boundedInteger(guest.cpus, 64),
    memoryMb: boundedInteger(guest.memory_mb, 262_144),
    ukLive: parseFlag(env.UK_LIVE_SUBMISSION_ENABLED),
    ukHeadless: parseFlag(env.UK_PLAYWRIGHT_HEADLESS),
    idleExitMs: boundedInteger(env.SUBMISSION_SERVICE_IDLE_EXIT_MS, 86_400_000),
  };
}

export function parseMachineList(stdout) {
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new DiagnosticFailure("machine_payload_invalid");
  }
  if (!Array.isArray(parsed)) throw new DiagnosticFailure("machine_payload_invalid");
  return parsed.map(machineReport);
}

function logMessage(record) {
  if (!isRecord(record)) return null;
  const candidates = [
    record.message,
    record.msg,
    record.log,
    isRecord(record.event) ? record.event.message : undefined,
    isRecord(record.attributes) ? record.attributes.message : undefined,
    isRecord(record.fields) ? record.fields.message : undefined,
    isRecord(record.metadata) ? record.metadata.message : undefined,
  ];
  return candidates.find((candidate) => typeof candidate === "string") ?? null;
}

function parseJsonValues(stdout) {
  const text = String(stdout);
  const values = [];
  let start = -1;
  let stack = [];
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (start === -1) {
      // flyctl emits one object per pretty-printed record. Starting only at an
      // object also lets us recover records from an optional array or prefix.
      if (character === "{") {
        start = index;
        stack = [character];
      }
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === "{" || character === "[") {
      stack.push(character);
      continue;
    }
    if (character !== "}" && character !== "]") continue;

    const expected = character === "}" ? "{" : "[";
    if (stack[stack.length - 1] !== expected) {
      start = -1;
      stack = [];
      inString = false;
      escaped = false;
      continue;
    }

    stack.pop();
    if (stack.length !== 0) continue;

    try {
      values.push(JSON.parse(text.slice(start, index + 1)));
    } catch {
      // Ignore malformed or prefixed fragments without echoing their contents.
    }
    start = -1;
  }

  return values;
}

function timingRecord(value) {
  if (!isRecord(value) || typeof value.stage !== "string" || !ALLOWED_STAGES.has(value.stage)) {
    return null;
  }
  const slug = value.slug === undefined ? null : value.slug;
  if (slug !== null && (typeof slug !== "string" || !ALLOWED_UK_SLUGS.has(slug))) return null;
  const durationMs = value.durationMs === undefined ? null : boundedInteger(value.durationMs, 86_400_000);
  if (value.durationMs !== undefined && durationMs === null) return null;
  const outcome = value.outcome === undefined ? null : value.outcome;
  if (outcome !== null && (typeof outcome !== "string" || !ALLOWED_OUTCOMES.has(outcome))) return null;
  const count = value.count === undefined ? null : boundedInteger(value.count, 1_000_000);
  if (value.count !== undefined && count === null) return null;
  const report = { stage: value.stage, slug, durationMs, outcome, count };
  if (typeof value.diagnosticCode === "string" && ALLOWED_DIAGNOSTIC_CODES.has(value.diagnosticCode)) {
    report.diagnosticCode = value.diagnosticCode;
  }
  return report;
}

export function parseUkTimingLogs(stdout) {
  const reports = [];
  for (const parsed of parseJsonValues(stdout)) {
    const logRecords = Array.isArray(parsed) ? parsed : [parsed];
    for (const record of logRecords) {
      const message = logMessage(record);
      if (!message || !message.startsWith(TIMING_PREFIX)) continue;
      let payload;
      try {
        payload = JSON.parse(message.slice(TIMING_PREFIX.length).trim());
      } catch {
        continue;
      }
      if (!isRecord(payload) || !Array.isArray(payload.records)) continue;
      for (const timing of payload.records) {
        const sanitized = timingRecord(timing);
        if (sanitized) reports.push(sanitized);
      }
    }
  }
  return reports;
}

function runFly(args, failureCode) {
  const result = spawnSync("fly", args, {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
    timeout: 30_000,
    killSignal: "SIGTERM",
  });
  if (result.error || result.status !== 0) throw new DiagnosticFailure(failureCode);
  return result.stdout;
}

export function buildReport({ machineJson, logJson }) {
  return {
    ok: true,
    target: "legacy",
    machines: parseMachineList(machineJson),
    ukTiming: parseUkTimingLogs(logJson),
  };
}

export function main() {
  try {
    const app = validateLegacyApp(process.env.FLY_SUBMISSION_LEGACY_APP);
    const machineJson = runFly(["machines", "list", "--app", app, "--json"], "machine_list_failed");
    const logJson = runFly(["logs", "--app", app, "--no-tail", "--json"], "logs_read_failed");
    process.stdout.write(`${JSON.stringify(buildReport({ machineJson, logJson }), null, 2)}\n`);
  } catch (error) {
    const code = error instanceof DiagnosticFailure ? error.code : "diagnostic_failed";
    process.stdout.write(`${JSON.stringify({ ok: false, code })}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

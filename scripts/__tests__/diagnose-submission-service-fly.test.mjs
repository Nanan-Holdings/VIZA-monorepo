import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  FIXED_LEGACY_APP,
  KNOWN_UK_PAGE_SLUGS,
  KNOWN_UK_TIMING_PHASE_SLUGS,
  buildReport,
  parseMachineList,
  parseUkTimingLogs,
  validateLegacyApp,
} from "../diagnose-submission-service-fly.mjs";

test("diagnostic accepts only the configured production legacy app", () => {
  assert.equal(validateLegacyApp(FIXED_LEGACY_APP), FIXED_LEGACY_APP);
  assert.throws(() => validateLegacyApp("another-app"), /legacy_app_not_configured/);
});

test("slug allowlist is the fixed UK page and timing-phase inventory", () => {
  assert.equal(KNOWN_UK_PAGE_SLUGS.size, 49);
  assert.equal(KNOWN_UK_TIMING_PHASE_SLUGS.has("resume"), true);
  assert.equal(KNOWN_UK_TIMING_PHASE_SLUGS.has("private-token-123"), false);
});

test("machine report keeps only the fixed safe fields", () => {
  const report = parseMachineList(JSON.stringify([{
    id: "e286abc12345",
    name: "private-machine-name",
    state: "started",
    config: {
      image: "registry.fly.io/viza-prod-submission-legacy:abc123",
      guest: { cpus: 2, memory_mb: 4096, cpu_kind: "shared" },
      env: {
        UK_LIVE_SUBMISSION_ENABLED: "true",
        UK_PLAYWRIGHT_HEADLESS: "true",
        SUBMISSION_SERVICE_IDLE_EXIT_MS: "120000",
        SECRET: "must never be emitted",
      },
    },
  }]));
  assert.deepEqual(report, [{
    id: "e286abc12345",
    state: "started",
    image: "registry.fly.io/viza-prod-submission-legacy:abc123",
    cpus: 2,
    memoryMb: 4096,
    ukLive: true,
    ukHeadless: true,
    idleExitMs: 120000,
  }]);
  assert.equal(JSON.stringify(report).includes("SECRET"), false);
});

test("timing parser reconstructs only allowlisted fields and silently drops raw logs", () => {
  const logs = [
    JSON.stringify({ message: "unrelated https://private.example/token applicant@example.com" }),
    JSON.stringify({ message: `[uk-timing] ${JSON.stringify({
      runId: "private-run-id",
      records: [
        { stage: "page_fill", slug: "standardApplicantsEmail", durationMs: 42, outcome: "success", count: 1 },
        {
          stage: "page_fill",
          slug: "purposeOfVisitForVV",
          durationMs: 50,
          outcome: "failed",
          count: 1,
          diagnosticCode: "radio_option_unmatched",
        },
        {
          stage: "page_fill",
          slug: "purposeOfVisitForVV",
          durationMs: 50,
          outcome: "failed",
          count: 1,
          diagnosticCode: "private-example@example.com",
        },
        { stage: "page_fill", slug: "email@example.com", durationMs: 99, outcome: "success", count: 1 },
        { stage: "page_fill", slug: "private-token-123", durationMs: 99, outcome: "success", count: 1 },
        { stage: "page_fill", slug: "unknownPageSlug", durationMs: 99, outcome: "success", count: 1 },
        { stage: "unknown", slug: "safe", durationMs: 1, outcome: "success", count: 1 },
        { stage: "run", durationMs: 123, outcome: "failed", count: 1 },
      ],
    })}` }),
    "not json and should be ignored",
  ].join("\n");
  assert.deepEqual(parseUkTimingLogs(logs), [
    {
      stage: "page_fill",
      slug: "standardApplicantsEmail",
      durationMs: 42,
      outcome: "success",
      count: 1,
    },
    {
      stage: "page_fill",
      slug: "purposeOfVisitForVV",
      durationMs: 50,
      outcome: "failed",
      count: 1,
      diagnosticCode: "radio_option_unmatched",
    },
    {
      stage: "page_fill",
      slug: "purposeOfVisitForVV",
      durationMs: 50,
      outcome: "failed",
      count: 1,
    },
    {
      stage: "run",
      slug: null,
      durationMs: 123,
      outcome: "failed",
      count: 1,
    },
  ]);
  assert.equal(JSON.stringify(parseUkTimingLogs(logs)).includes("private-run-id"), false);
  assert.equal(JSON.stringify(parseUkTimingLogs(logs)).includes("example.com"), false);
});

test("timing parser accepts flyctl's pretty JSON log records without exposing raw fields", () => {
  const timingMessage = `[uk-timing] ${JSON.stringify({
    runId: "private-run-id",
    records: [
      { stage: "run", durationMs: 321, outcome: "failed", count: 1 },
    ],
  })}`;
  const logs = [
    JSON.stringify({ level: "info", message: "unrelated private text" }, null, 4),
    JSON.stringify({ level: "info", message: timingMessage, privateField: "secret" }, null, 4),
  ].join("\n");

  assert.deepEqual(parseUkTimingLogs(logs), [{
    stage: "run",
    slug: null,
    durationMs: 321,
    outcome: "failed",
    count: 1,
  }]);
  assert.equal(JSON.stringify(parseUkTimingLogs(logs)).includes("private-run-id"), false);
  assert.equal(JSON.stringify(parseUkTimingLogs(logs)).includes("privateField"), false);
});

test("timing parser recovers object records from array or prefixed JSON", () => {
  const logs = `[prefix] ${JSON.stringify([{
    message: `[uk-timing] ${JSON.stringify({
      records: [{ stage: "run", durationMs: 7, outcome: "success", count: 1 }],
    })}`,
  }], null, 4)}`;
  assert.deepEqual(parseUkTimingLogs(logs), [{
    stage: "run",
    slug: null,
    durationMs: 7,
    outcome: "success",
    count: 1,
  }]);
});

test("timing parser keeps malformed or empty JSON from producing timing records", () => {
  assert.deepEqual(parseUkTimingLogs(""), []);
  assert.deepEqual(parseUkTimingLogs('{\n    "message": "[uk-timing] not-json"\n}\n'), []);
  assert.deepEqual(parseUkTimingLogs('{\n    "message": "[uk-timing] {\\"records\\": [null]}"\n'), []);
});

test("report shape and workflow commands remain read-only and fixed", () => {
  const report = buildReport({ machineJson: "[]", logJson: "" });
  assert.deepEqual(report, { ok: true, target: "legacy", machines: [], ukTiming: [] });
  const script = readFileSync(new URL("../diagnose-submission-service-fly.mjs", import.meta.url), "utf8");
  const workflow = readFileSync(new URL("../../.github/workflows/diagnose-submission-service-fly.yml", import.meta.url), "utf8");
  assert.match(script, /\["machines", "list"/u);
  assert.match(script, /\["logs", "--app", app, "--no-tail", "--json"\]/u);
  assert.match(script, /pathToFileURL\(process\.argv\[1\]\)/u);
  assert.match(script, /timeout:\s*30_000/u);
  assert.match(script, /killSignal:\s*"SIGTERM"/u);
  assert.doesNotMatch(script, /machine (?:start|stop|update|destroy)|fly deploy|secrets?\s+(?:set|sync)/iu);
  assert.match(workflow, /environment:\s+production-submission_service/u);
  assert.match(workflow, /FLY_API_TOKEN:\s+\$\{\{ secrets\.FLY_API_TOKEN \}\}/u);
  assert.match(workflow, /FLY_SUBMISSION_LEGACY_APP:\s+\$\{\{ vars\.FLY_SUBMISSION_LEGACY_APP \}\}/u);
  assert.doesNotMatch(workflow, /workflow_dispatch:\s*\n\s+inputs:/u);
  assert.doesNotMatch(workflow, /fly\s+(?:machine|deploy|secrets?)/iu);
});

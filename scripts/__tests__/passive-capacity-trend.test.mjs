import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  assessPassiveCapacityTrend,
  loadPassiveCapacityHistory,
} from "../passive-capacity-trend.mjs";

const PROJECT_REF = "oyjxdzsoejraedqghndi";

function report({
  at,
  status = "green",
  utilization = 25,
  totalConnections = 12,
  activeConnections = 2,
  queryids = [],
  blockers = [],
  warnings = [],
} = {}) {
  const startedAt = new Date(at);
  const finishedAt = new Date(startedAt.getTime() + 10_000);
  return {
    schema_version: 1,
    project_ref: PROJECT_REF,
    sanitization_schema: "viza-passive-capacity-metadata-only-v1",
    performance_advisor: {
      lints: [
        { name: "unindexed_foreign_keys", level: "WARN" },
        { name: "unused_index", level: "INFO" },
      ],
    },
    samples: [
      { sample_at: startedAt.toISOString() },
      { sample_at: new Date(startedAt.getTime() + 5_000).toISOString() },
      { sample_at: finishedAt.toISOString() },
    ],
    assessment: {
      status,
      blockers,
      warnings,
      summary: {
        max_connection_utilization_percent: utilization,
        max_total_connections: totalConnections,
        max_active_connections: activeConnections,
        max_ungranted_locks: 0,
        max_idle_in_transaction_over_30s: 0,
        max_long_transactions_over_30s: 0,
        deadlock_delta: 0,
        commit_delta: 10,
        rollback_delta: 0,
      },
      optimization_candidates: queryids.map((queryid, index) => ({
        queryid,
        calls_per_day: 200 + index,
        total_exec_time_ms: 6_000 + index,
        mean_exec_time_ms: 60 + index,
      })),
    },
  };
}

test("24-hour trend stays incomplete until five observations span at least 22 hours", () => {
  const reports = [0, 6, 12, 18].map((hour) => report({
    at: `2026-08-2${4 + Math.floor(hour / 24)}T${String(hour % 24).padStart(2, "0")}:00:00.000Z`,
  }));

  const result = assessPassiveCapacityTrend(reports);

  assert.equal(result.assessment.status, "warn");
  assert.equal(result.window.complete_24h, false);
  assert.equal(result.window.observation_count, 4);
  assert.match(result.assessment.warnings.join("\n"), /five observations/u);

  const almost22Hours = [
    0,
    6,
    12,
    18,
    21 + 59 / 60 + 42 / 3_600,
  ].map((hour) => report({
    at: new Date(Date.parse("2026-08-24T00:00:00.000Z") + hour * 3_600_000).toISOString(),
  }));
  const roundedResult = assessPassiveCapacityTrend(almost22Hours);
  assert.equal(roundedResult.window.span_hours, 22);
  assert.equal(roundedResult.window.complete_24h, false);
});

test("24-hour trend aggregates only metadata and promotes persistent query IDs for review", () => {
  const reports = [0, 6, 12, 18, 24].map((hour, index) => report({
    at: new Date(Date.parse("2026-08-24T00:00:00.000Z") + hour * 3_600_000).toISOString(),
    utilization: 20 + index * 5,
    totalConnections: 10 + index,
    activeConnections: 1 + index,
    queryids: index < 4 ? ["42", String(100 + index)] : ["42"],
  }));

  const result = assessPassiveCapacityTrend(reports);
  const encoded = JSON.stringify(result);

  assert.equal(result.sanitization_schema, "viza-passive-capacity-trend-metadata-only-v1");
  assert.equal(result.window.complete_24h, true);
  assert.equal(result.window.observation_count, 5);
  assert.equal(result.window.span_hours, 24);
  assert.equal(result.window.sampling_mode, "sparse_10_second_observations");
  assert.equal(result.assessment.status, "green");
  assert.equal(result.assessment.summary.peak_connection_utilization_percent, 40);
  assert.equal(result.assessment.summary.median_connection_utilization_percent, 30);
  assert.equal(result.assessment.summary.peak_total_connections, 14);
  assert.deepEqual(result.review_candidates.map(({ queryid }) => queryid), ["42"]);
  assert.equal(result.review_candidates[0].observation_count, 5);
  assert.doesNotMatch(encoded, /query_text|statement_text|parameters|application_id|session_id/iu);
});

test("one red observation makes the complete trend red", () => {
  const reports = [0, 6, 12, 18, 24].map((hour, index) => report({
    at: new Date(Date.parse("2026-08-24T00:00:00.000Z") + hour * 3_600_000).toISOString(),
    status: index === 2 ? "red" : "green",
    blockers: index === 2 ? ["ungranted locks persisted across all samples"] : [],
  }));

  const result = assessPassiveCapacityTrend(reports);

  assert.equal(result.assessment.status, "red");
  assert.equal(result.assessment.summary.red_observation_count, 1);
  assert.match(result.assessment.blockers.join("\n"), /red passive observation/u);
});

test("trend rejects project drift and sensitive report fields", () => {
  const mismatched = report({ at: "2026-08-24T00:00:00.000Z" });
  mismatched.project_ref = "another-project";
  assert.throws(() => assessPassiveCapacityTrend([mismatched]), /project_ref/u);

  const sensitive = report({ at: "2026-08-24T00:00:00.000Z" });
  sensitive.pg_stat_statements = { query_text: "select applicant passport" };
  assert.throws(() => assessPassiveCapacityTrend([sensitive]), /forbidden metadata key/u);

  const inconsistent = report({ at: "2026-08-24T00:00:00.000Z" });
  inconsistent.assessment.warnings = ["unexpected warning"];
  assert.throws(() => assessPassiveCapacityTrend([inconsistent]), /status is inconsistent/u);
});

test("history loader recursively reads reports and de-duplicates observation windows", () => {
  const root = mkdtempSync(join(tmpdir(), "viza-passive-trend-"));
  const nested = join(root, "32700000000");
  const duplicateDirectory = join(root, "32700000001");
  mkdirSync(nested, { recursive: true });
  mkdirSync(duplicateDirectory, { recursive: true });
  const current = report({ at: "2026-08-24T00:00:00.000Z" });
  const previous = report({ at: "2026-08-23T18:00:00.000Z" });
  writeFileSync(join(root, "current.json"), JSON.stringify(current));
  writeFileSync(join(nested, "passive-capacity.json"), JSON.stringify(previous));
  writeFileSync(
    join(duplicateDirectory, "passive-capacity.json"),
    JSON.stringify(previous),
  );
  const evidenceManifestPath = join(root, "evidence.jsonl");
  writeFileSync(evidenceManifestPath, [
    {
      path: join(root, "current.json"),
      run_id: "32700000002",
      source: "current",
      run_created_at: "2026-08-23T23:59:00.000Z",
      evidence_created_at: "2026-08-24T00:01:00.000Z",
    },
    {
      path: join(nested, "passive-capacity.json"),
      run_id: "32700000000",
      source: "artifact",
      run_created_at: "2026-08-23T17:59:00.000Z",
      evidence_created_at: "2026-08-23T18:01:00.000Z",
    },
    {
      path: join(duplicateDirectory, "passive-capacity.json"),
      run_id: "32700000001",
      source: "artifact",
      run_created_at: "2026-08-23T17:59:30.000Z",
      evidence_created_at: "2026-08-23T18:01:30.000Z",
    },
  ].map((item) => JSON.stringify(item)).join("\n"));

  const reports = loadPassiveCapacityHistory({
    currentReportPath: join(root, "current.json"),
    historyRoot: root,
    evidenceManifestPath,
  });

  assert.equal(reports.length, 2);
  assert.equal(reports[0].samples[0].sample_at, "2026-08-23T18:00:00.000Z");
  assert.equal(reports[1].samples[0].sample_at, "2026-08-24T00:00:00.000Z");
  rmSync(root, { recursive: true, force: true });
});

test("history loader rejects replayed sample times that do not match GitHub run evidence", () => {
  const root = mkdtempSync(join(tmpdir(), "viza-passive-trend-replay-"));
  const currentPath = join(root, "current.json");
  const evidenceManifestPath = join(root, "evidence.jsonl");
  writeFileSync(currentPath, JSON.stringify(report({ at: "2026-08-24T00:00:00.000Z" })));
  writeFileSync(evidenceManifestPath, JSON.stringify({
    path: currentPath,
    run_id: "32700000003",
    source: "current",
    run_created_at: "2026-08-24T01:00:00.000Z",
    evidence_created_at: "2026-08-24T01:01:00.000Z",
  }));

  assert.throws(
    () => loadPassiveCapacityHistory({
      currentReportPath: currentPath,
      historyRoot: join(root, "history"),
      evidenceManifestPath,
    }),
    /predates its GitHub workflow run/u,
  );
  rmSync(root, { recursive: true, force: true });
});

test("trend rejects conflicting artifacts for the same observation window", () => {
  const original = report({ at: "2026-08-24T00:00:00.000Z", utilization: 20 });
  const conflict = report({ at: "2026-08-24T00:00:00.000Z", utilization: 90 });
  assert.throws(
    () => assessPassiveCapacityTrend([original, conflict]),
    /Conflicting passive capacity reports/u,
  );
});

test("scheduled workflow downloads only main passive artifacts and uploads the trend", () => {
  const workflow = new URL(
    "../../.github/workflows/passive-production-capacity.yml",
    import.meta.url,
  );
  const source = readFileSync(workflow, "utf8");

  assert.match(source, /actions: read/u);
  assert.match(source, /actions\/workflows\/passive-production-capacity\.yml\/runs\?branch=main/u);
  assert.match(source, /actions\/runs\/\$run_id\/artifacts\?per_page=100/u);
  assert.match(source, /gh run download/u);
  assert.match(source, /passive-capacity-evidence\.jsonl/u);
  assert.match(source, /actions\/runs\/\$\{GITHUB_RUN_ID\}/u);
  assert.match(source, /\.head_branch == "main" and \.path ==/u);
  assert.match(source, /passive-capacity-trend\.mjs/u);
  assert.match(source, /passive-capacity-trend\.json/u);
  assert.match(source, /test "\$trend_status" != "red"/u);
  const uploadBlock = source.slice(source.indexOf("- name: Upload metadata-only capacity report"));
  assert.doesNotMatch(uploadBlock, /passive-capacity-evidence/u);
});

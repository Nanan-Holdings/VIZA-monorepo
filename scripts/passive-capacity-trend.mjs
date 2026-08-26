import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const PRODUCTION_PROJECT_REF = "oyjxdzsoejraedqghndi";
const REPORT_SCHEMAS = new Set([
  "viza-passive-capacity-metadata-only-v1",
  "viza-passive-capacity-metadata-only-v2",
]);
const TABLE_ACTIVITY_REPORT_SCHEMA = "viza-passive-capacity-metadata-only-v2";
const TREND_SCHEMA = "viza-passive-capacity-trend-metadata-only-v2";
const LOOKBACK_HOURS = 30;
const MINIMUM_OBSERVATIONS = 5;
const MINIMUM_SPAN_HOURS = 22;
const MAXIMUM_EVIDENCE_DELAY_MS = 15 * 60 * 1_000;
const CLOCK_SKEW_MS = 60 * 1_000;
const FORBIDDEN_METADATA_KEYS = new Set([
  "application_id",
  "applicant_id",
  "email",
  "leased_by",
  "parameters",
  "params",
  "passport_number",
  "query",
  "query_text",
  "session_id",
  "sql",
  "statement_text",
  "user_id",
  "worker_id",
]);
const TABLE_ACTIVITY_COUNTERS = [
  "seq_scan",
  "seq_tup_read",
  "idx_scan",
  "idx_tup_fetch",
  "n_tup_ins",
  "n_tup_upd",
  "n_tup_del",
  "n_tup_hot_upd",
];

function finiteMetric(value, path) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Passive capacity trend metric ${path} is invalid`);
  }
  return value;
}

function timestamp(value, path) {
  const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN;
  if (!Number.isFinite(parsed)) {
    throw new Error(`Passive capacity trend timestamp ${path} is invalid`);
  }
  return parsed;
}

function stringArray(value, path) {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`Passive capacity trend ${path} is invalid`);
  }
  return value;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function assertNoForbiddenMetadataKeys(value, path = "report") {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenMetadataKeys(item, `${path}[${index}]`));
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if (FORBIDDEN_METADATA_KEYS.has(key.toLowerCase())) {
      throw new Error(`Passive capacity report contains forbidden metadata key ${path}.${key}`);
    }
    assertNoForbiddenMetadataKeys(item, `${path}.${key}`);
  }
}

function validateCandidate(candidate, index) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new Error(`Passive capacity optimization candidate ${index} is invalid`);
  }
  if (typeof candidate.queryid !== "string" || !/^-?\d+$/u.test(candidate.queryid)) {
    throw new Error(`Passive capacity optimization candidate ${index} queryid is invalid`);
  }
  return {
    queryid: candidate.queryid,
    calls_per_day: finiteMetric(candidate.calls_per_day, `candidate[${index}].calls_per_day`),
    total_exec_time_ms: finiteMetric(
      candidate.total_exec_time_ms,
      `candidate[${index}].total_exec_time_ms`,
    ),
    mean_exec_time_ms: finiteMetric(
      candidate.mean_exec_time_ms,
      `candidate[${index}].mean_exec_time_ms`,
    ),
  };
}

function validateAdvisor(performanceAdvisor) {
  const lints = performanceAdvisor?.lints;
  if (!Array.isArray(lints)) {
    throw new Error("Passive capacity performance advisor metadata is invalid");
  }
  return lints.map((lint, index) => {
    if (!lint || typeof lint !== "object" || Array.isArray(lint)) {
      throw new Error(`Passive capacity advisor lint ${index} is invalid`);
    }
    const name = typeof lint.name === "string" ? lint.name : "unknown";
    const level = typeof lint.level === "string" ? lint.level.toUpperCase() : "UNKNOWN";
    if (!/^[A-Za-z0-9_.-]{1,100}$/u.test(name) || !/^[A-Z]{1,20}$/u.test(level)) {
      throw new Error(`Passive capacity advisor lint ${index} metadata is invalid`);
    }
    return { name, level };
  });
}

function tableCounter(value, path) {
  if (typeof value !== "string" || !/^\d+$/u.test(value)) {
    throw new Error(`Passive capacity table activity counter ${path} is invalid`);
  }
  return BigInt(value);
}

function validateTableActivity(snapshot, path) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot) ||
      (snapshot.stats_reset !== null &&
        !Number.isFinite(Date.parse(snapshot.stats_reset))) ||
      !Array.isArray(snapshot.tables)) {
    throw new Error(`Passive capacity table activity ${path} is invalid`);
  }
  const expectedKeys = ["table", ...TABLE_ACTIVITY_COUNTERS].sort();
  const tables = new Map();
  let previous = "";
  for (const [index, table] of snapshot.tables.entries()) {
    if (!table || typeof table !== "object" || Array.isArray(table) ||
        typeof table.table !== "string" ||
        !/^[A-Za-z_][A-Za-z0-9_$]{0,62}$/u.test(table.table) ||
        tables.has(table.table) || table.table.localeCompare(previous) < 0 ||
        JSON.stringify(Object.keys(table).sort()) !== JSON.stringify(expectedKeys)) {
      throw new Error(`Passive capacity table activity ${path}.tables[${index}] is invalid`);
    }
    const counters = {};
    for (const key of TABLE_ACTIVITY_COUNTERS) {
      counters[key] = tableCounter(table[key], `${path}.tables[${index}].${key}`);
    }
    tables.set(table.table, counters);
    previous = table.table;
  }
  return { statsReset: snapshot.stats_reset, tables };
}

function validateReport(report) {
  assertNoForbiddenMetadataKeys(report);
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    throw new Error("Passive capacity report is invalid");
  }
  if (report.schema_version !== 1 || !REPORT_SCHEMAS.has(report.sanitization_schema)) {
    throw new Error("Passive capacity report sanitization schema is invalid");
  }
  if (report.project_ref !== PRODUCTION_PROJECT_REF) {
    throw new Error("Passive capacity report project_ref is invalid");
  }
  if (!Array.isArray(report.samples) || report.samples.length !== 3) {
    throw new Error("Passive capacity report must contain exactly three samples");
  }
  const sampleTimes = report.samples.map((sample, index) =>
    timestamp(sample?.sample_at, `samples[${index}].sample_at`));
  const tableActivity = report.sanitization_schema === TABLE_ACTIVITY_REPORT_SCHEMA
    ? report.samples.map((sample, index) =>
      validateTableActivity(sample?.table_activity, `samples[${index}].table_activity`))
    : [];
  if (sampleTimes.some((value, index) => index > 0 && value < sampleTimes[index - 1])) {
    throw new Error("Passive capacity report samples are not ordered");
  }
  const sampleDurationSeconds = (sampleTimes.at(-1) - sampleTimes[0]) / 1_000;
  if (sampleDurationSeconds < 8 || sampleDurationSeconds > 30) {
    throw new Error("Passive capacity report sample duration is invalid");
  }

  const assessment = report.assessment;
  if (!assessment || typeof assessment !== "object" || Array.isArray(assessment)) {
    throw new Error("Passive capacity report assessment is invalid");
  }
  if (!new Set(["green", "warn", "red"]).has(assessment.status)) {
    throw new Error("Passive capacity report assessment status is invalid");
  }
  const summary = assessment.summary;
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
    throw new Error("Passive capacity report assessment summary is invalid");
  }
  const metrics = {};
  for (const key of [
    "max_connection_utilization_percent",
    "max_total_connections",
    "max_active_connections",
    "max_ungranted_locks",
    "max_idle_in_transaction_over_30s",
    "max_long_transactions_over_30s",
    "deadlock_delta",
    "commit_delta",
    "rollback_delta",
  ]) {
    metrics[key] = finiteMetric(summary[key], `assessment.summary.${key}`);
  }

  const blockers = stringArray(assessment.blockers, "assessment.blockers");
  const warnings = stringArray(assessment.warnings, "assessment.warnings");
  if (
    (assessment.status === "green" && (blockers.length > 0 || warnings.length > 0)) ||
    (assessment.status === "warn" && (blockers.length > 0 || warnings.length === 0)) ||
    (assessment.status === "red" && blockers.length === 0)
  ) {
    throw new Error("Passive capacity report assessment status is inconsistent");
  }

  return {
    report,
    startedAt: sampleTimes[0],
    finishedAt: sampleTimes.at(-1),
    status: assessment.status,
    blockers,
    warnings,
    summary: metrics,
    candidates: Array.isArray(assessment.optimization_candidates)
      ? assessment.optimization_candidates.map(validateCandidate)
      : (() => { throw new Error("Passive capacity optimization candidates are invalid"); })(),
    advisor: validateAdvisor(report.performance_advisor),
    tableActivity: tableActivity.at(-1) ?? null,
  };
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function countBy(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) =>
    left.localeCompare(right)));
}

function emptyTableActivityTotals() {
  return Object.fromEntries(TABLE_ACTIVITY_COUNTERS.map((key) => [key, 0n]));
}

function tableActivityTrend(observations, complete24h) {
  const snapshots = observations.filter(({ tableActivity }) => tableActivity !== null);
  const totals = new Map();
  let validSegmentCount = 0;
  let resetSegmentCount = 0;
  for (let index = 1; index < snapshots.length; index += 1) {
    const previous = snapshots[index - 1].tableActivity;
    const current = snapshots[index].tableActivity;
    if (previous.statsReset === null || current.statsReset === null ||
        previous.statsReset !== current.statsReset) {
      resetSegmentCount += 1;
      continue;
    }
    let segmentValid = false;
    let segmentReset = false;
    for (const [table, currentCounters] of current.tables) {
      const previousCounters = previous.tables.get(table);
      if (!previousCounters) continue;
      if (TABLE_ACTIVITY_COUNTERS.some((key) => currentCounters[key] < previousCounters[key])) {
        segmentReset = true;
        continue;
      }
      const aggregate = totals.get(table) ?? {
        counters: emptyTableActivityTotals(),
        segmentCount: 0,
      };
      for (const key of TABLE_ACTIVITY_COUNTERS) {
        aggregate.counters[key] += currentCounters[key] - previousCounters[key];
      }
      aggregate.segmentCount += 1;
      totals.set(table, aggregate);
      segmentValid = true;
    }
    if (segmentReset) resetSegmentCount += 1;
    if (segmentValid) validSegmentCount += 1;
  }
  const requiredSegments = observations.length - 1;
  const activityComplete = complete24h && snapshots.length === observations.length &&
    snapshots.length >= MINIMUM_OBSERVATIONS && validSegmentCount >= requiredSegments;
  const candidates = activityComplete
    ? [...totals.entries()].filter(([, { segmentCount }]) =>
      segmentCount >= requiredSegments)
      .map(([table, { counters }]) => {
        const writeDelta = counters.n_tup_ins + counters.n_tup_upd + counters.n_tup_del;
        return {
          table,
          counters,
          writeDelta,
          averageSeqTuplesPerScan: counters.seq_scan > 0n
            ? round(Number(counters.seq_tup_read) / Number(counters.seq_scan))
            : 0,
        };
      }).filter(({ counters, writeDelta }) =>
      (counters.seq_scan >= 100n && counters.seq_tup_read >= 10_000n) ||
      writeDelta >= 1_000n)
      .sort((left, right) => {
        if (left.counters.seq_tup_read !== right.counters.seq_tup_read) {
          return left.counters.seq_tup_read > right.counters.seq_tup_read ? -1 : 1;
        }
        if (left.writeDelta !== right.writeDelta) {
          return left.writeDelta > right.writeDelta ? -1 : 1;
        }
        return left.table.localeCompare(right.table);
      })
      .slice(0, 20)
      .map(({ table, counters, writeDelta, averageSeqTuplesPerScan }) => ({
        table,
        seq_scan_delta: counters.seq_scan.toString(),
        seq_tup_read_delta: counters.seq_tup_read.toString(),
        idx_scan_delta: counters.idx_scan.toString(),
        idx_tup_fetch_delta: counters.idx_tup_fetch.toString(),
        write_delta: writeDelta.toString(),
        average_seq_tuples_per_scan: averageSeqTuplesPerScan,
      }))
    : [];
  return {
    window: {
      observation_count: snapshots.length,
      valid_segment_count: validSegmentCount,
      reset_segment_count: resetSegmentCount,
      complete_24h: activityComplete,
    },
    candidates,
  };
}

export function assessPassiveCapacityTrend(reports) {
  if (!Array.isArray(reports) || reports.length === 0) {
    throw new Error("Passive capacity trend requires at least one report");
  }
  const validated = reports.map(validateReport);
  const newestStartedAt = Math.max(...validated.map(({ startedAt }) => startedAt));
  const lookbackStart = newestStartedAt - LOOKBACK_HOURS * 3_600_000;
  const inWindow = validated
    .filter(({ startedAt }) => startedAt >= lookbackStart && startedAt <= newestStartedAt)
    .sort((left, right) => left.startedAt - right.startedAt);

  const unique = [];
  const seen = new Map();
  for (const observation of inWindow) {
    const key = `${observation.startedAt}:${observation.finishedAt}`;
    const encoded = stableJson(observation.report);
    if (seen.has(key)) {
      if (seen.get(key) !== encoded) {
        throw new Error("Conflicting passive capacity reports share an observation window");
      }
      continue;
    }
    seen.set(key, encoded);
    unique.push(observation);
  }
  if (unique.length === 0) throw new Error("Passive capacity trend window is empty");

  const first = unique[0];
  const last = unique.at(-1);
  const rawSpanHours = (last.startedAt - first.startedAt) / 3_600_000;
  const spanHours = round(rawSpanHours);
  const complete24h =
    unique.length >= MINIMUM_OBSERVATIONS && rawSpanHours >= MINIMUM_SPAN_HOURS;
  const redCount = unique.filter(({ status }) => status === "red").length;
  const warnCount = unique.filter(({ status }) => status === "warn").length;
  const blockers = [];
  const warnings = [];
  if (redCount > 0) blockers.push("one or more red passive observations were observed");
  if (!complete24h) {
    warnings.push(
      "24-hour evidence requires at least five observations spanning at least 22 hours",
    );
  }
  if (warnCount > 0) warnings.push("one or more passive observations reported warnings");

  const candidateMap = new Map();
  for (const observation of unique) {
    const seenInObservation = new Set();
    for (const candidate of observation.candidates) {
      if (seenInObservation.has(candidate.queryid)) continue;
      seenInObservation.add(candidate.queryid);
      const aggregate = candidateMap.get(candidate.queryid) ?? {
        queryid: candidate.queryid,
        observation_count: 0,
        max_calls_per_day: 0,
        max_total_exec_time_ms: 0,
        max_mean_exec_time_ms: 0,
      };
      aggregate.observation_count += 1;
      aggregate.max_calls_per_day = Math.max(
        aggregate.max_calls_per_day,
        candidate.calls_per_day,
      );
      aggregate.max_total_exec_time_ms = Math.max(
        aggregate.max_total_exec_time_ms,
        candidate.total_exec_time_ms,
      );
      aggregate.max_mean_exec_time_ms = Math.max(
        aggregate.max_mean_exec_time_ms,
        candidate.mean_exec_time_ms,
      );
      candidateMap.set(candidate.queryid, aggregate);
    }
  }
  const persistenceThreshold = Math.max(3, Math.ceil(unique.length / 2));
  const reviewCandidates = complete24h
    ? [...candidateMap.values()]
      .filter(({ observation_count: count }) => count >= persistenceThreshold)
      .sort((left, right) =>
        right.observation_count - left.observation_count ||
        right.max_total_exec_time_ms - left.max_total_exec_time_ms ||
        left.queryid.localeCompare(right.queryid))
      .slice(0, 20)
    : [];

  const utilization = unique.map(({ summary }) =>
    summary.max_connection_utilization_percent);
  const latestAdvisor = last.advisor;
  const activity = tableActivityTrend(unique, complete24h);
  return {
    schema_version: 1,
    project_ref: PRODUCTION_PROJECT_REF,
    sanitization_schema: TREND_SCHEMA,
    window: {
      lookback_hours: LOOKBACK_HOURS,
      sampling_mode: "sparse_10_second_observations",
      observation_count: unique.length,
      first_observed_at: new Date(first.startedAt).toISOString(),
      last_observed_at: new Date(last.finishedAt).toISOString(),
      span_hours: spanHours,
      complete_24h: complete24h,
    },
    assessment: {
      status: blockers.length > 0 ? "red" : warnings.length > 0 ? "warn" : "green",
      blockers,
      warnings,
      summary: {
        green_observation_count: unique.length - redCount - warnCount,
        warn_observation_count: warnCount,
        red_observation_count: redCount,
        peak_connection_utilization_percent: Math.max(...utilization),
        median_connection_utilization_percent: round(median(utilization)),
        peak_total_connections: Math.max(...unique.map(({ summary }) =>
          summary.max_total_connections)),
        peak_active_connections: Math.max(...unique.map(({ summary }) =>
          summary.max_active_connections)),
        peak_ungranted_locks: Math.max(...unique.map(({ summary }) =>
          summary.max_ungranted_locks)),
        peak_idle_in_transaction_over_30s: Math.max(...unique.map(({ summary }) =>
          summary.max_idle_in_transaction_over_30s)),
        peak_long_transactions_over_30s: Math.max(...unique.map(({ summary }) =>
          summary.max_long_transactions_over_30s)),
        sampled_deadlock_delta_sum: unique.reduce((sum, { summary }) =>
          sum + summary.deadlock_delta, 0),
        sampled_commit_delta_sum: unique.reduce((sum, { summary }) =>
          sum + summary.commit_delta, 0),
        sampled_rollback_delta_sum: unique.reduce((sum, { summary }) =>
          sum + summary.rollback_delta, 0),
      },
    },
    advisor_snapshot: {
      latest_lint_count: latestAdvisor.length,
      latest_levels: countBy(latestAdvisor.map(({ level }) => level)),
      latest_names: countBy(latestAdvisor.map(({ name }) => name)),
    },
    review_candidates: reviewCandidates,
    table_activity_window: activity.window,
    table_activity_review_candidates: activity.candidates,
  };
}

function collectReportPaths(directory) {
  if (!directory || !statSync(directory, { throwIfNoEntry: false })?.isDirectory()) return [];
  const paths = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) paths.push(...collectReportPaths(path));
    if (entry.isFile() && basename(path) === "passive-capacity.json") paths.push(path);
  }
  return paths;
}

function readReport(path) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Passive capacity report ${path} is not valid JSON`, { cause: error });
  }
  validateReport(parsed);
  return parsed;
}

export function validatePassiveCapacityReportFile(path) {
  readReport(resolve(path));
  return true;
}

function readEvidenceManifest(evidenceManifestPath) {
  const source = readFileSync(evidenceManifestPath, "utf8");
  const lines = source.split(/\r?\n/u).filter((line) => line.trim().length > 0);
  if (lines.length === 0) throw new Error("Passive capacity evidence manifest is empty");
  const evidence = new Map();
  const runIds = new Set();
  let currentCount = 0;
  for (const [index, line] of lines.entries()) {
    let item;
    try {
      item = JSON.parse(line);
    } catch (error) {
      throw new Error(`Passive capacity evidence line ${index + 1} is invalid JSON`, {
        cause: error,
      });
    }
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`Passive capacity evidence line ${index + 1} is invalid`);
    }
    if (typeof item.path !== "string" || !isAbsolute(item.path)) {
      throw new Error("Passive capacity evidence path must be absolute");
    }
    const path = resolve(item.path);
    const runId = typeof item.run_id === "string" ? item.run_id : "";
    if (!/^\d+$/u.test(runId) || runIds.has(runId)) {
      throw new Error("Passive capacity evidence run_id is invalid or duplicated");
    }
    if (evidence.has(path)) {
      throw new Error("Passive capacity evidence path is duplicated");
    }
    if (!new Set(["current", "artifact"]).has(item.source)) {
      throw new Error("Passive capacity evidence source is invalid");
    }
    const runCreatedAt = timestamp(item.run_created_at, "evidence.run_created_at");
    const evidenceCreatedAt = timestamp(
      item.evidence_created_at,
      "evidence.evidence_created_at",
    );
    if (evidenceCreatedAt < runCreatedAt) {
      throw new Error("Passive capacity evidence timestamps are inconsistent");
    }
    if (item.source === "current") currentCount += 1;
    runIds.add(runId);
    evidence.set(path, {
      source: item.source,
      runCreatedAt,
      evidenceCreatedAt,
    });
  }
  if (currentCount !== 1) {
    throw new Error("Passive capacity evidence must identify exactly one current report");
  }
  return evidence;
}

function validateEvidenceBinding({ report, path, evidence, currentReportPath }) {
  const binding = evidence.get(path);
  if (!binding) throw new Error("Passive capacity report is missing GitHub run evidence");
  const isCurrentPath = path === currentReportPath;
  if ((binding.source === "current") !== isCurrentPath) {
    throw new Error("Passive capacity current report evidence is mismatched");
  }
  const startedAt = timestamp(report.samples[0].sample_at, "samples[0].sample_at");
  const finishedAt = timestamp(report.samples.at(-1).sample_at, "samples[2].sample_at");
  if (startedAt < binding.runCreatedAt - CLOCK_SKEW_MS) {
    throw new Error("Passive capacity sample predates its GitHub workflow run");
  }
  const evidenceDelay = binding.evidenceCreatedAt - finishedAt;
  if (evidenceDelay < -CLOCK_SKEW_MS || evidenceDelay > MAXIMUM_EVIDENCE_DELAY_MS) {
    throw new Error("Passive capacity sample is not contemporaneous with its GitHub evidence");
  }
}

export function loadPassiveCapacityHistory({
  currentReportPath,
  historyRoot,
  evidenceManifestPath,
}) {
  const paths = [resolve(currentReportPath), ...collectReportPaths(historyRoot)];
  const resolvedCurrentReportPath = resolve(currentReportPath);
  const evidence = evidenceManifestPath ? readEvidenceManifest(evidenceManifestPath) : null;
  const reports = paths.map((path) => {
    const report = readReport(path);
    if (evidence) {
      validateEvidenceBinding({
        report,
        path,
        evidence,
        currentReportPath: resolvedCurrentReportPath,
      });
    }
    return report;
  });
  if (evidence && evidence.size !== paths.length) {
    throw new Error("Passive capacity evidence manifest contains an unexpected report path");
  }
  const unique = new Map();
  for (const current of reports) {
    const first = timestamp(current.samples[0].sample_at, "samples[0].sample_at");
    const last = timestamp(current.samples.at(-1).sample_at, "samples[2].sample_at");
    const key = `${first}:${last}`;
    if (unique.has(key) && stableJson(unique.get(key)) !== stableJson(current)) {
      throw new Error("Conflicting passive capacity reports share an observation window");
    }
    unique.set(key, current);
  }
  return [...unique.values()].sort((left, right) =>
    Date.parse(left.samples[0].sample_at) - Date.parse(right.samples[0].sample_at));
}

async function main() {
  if (process.argv[2] === "--validate-report" && process.argv[3] && process.argv.length === 4) {
    validatePassiveCapacityReportFile(process.argv[3]);
    return;
  }
  const [currentReportPath, historyRoot, evidenceManifestPath] = process.argv.slice(2);
  if (!currentReportPath || !historyRoot || !evidenceManifestPath || process.argv.length !== 5) {
    throw new Error(
      "Usage: node scripts/passive-capacity-trend.mjs <current-report.json> <history-root> <evidence.jsonl>",
    );
  }
  const reports = loadPassiveCapacityHistory({
    currentReportPath,
    historyRoot,
    evidenceManifestPath,
  });
  process.stdout.write(`${JSON.stringify(assessPassiveCapacityTrend(reports), null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

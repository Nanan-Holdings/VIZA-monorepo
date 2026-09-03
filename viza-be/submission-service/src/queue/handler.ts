import * as fs from "node:fs/promises";
import path from "node:path";
import type { JobHandler } from "./worker.js";
import type { RunnerJob } from "./worker.js";
import { getRunOne } from "./dispatch.js";
import type { DispatchOutcome } from "./types.js";
import { NeedsHumanError, UnsupportedCountryError } from "./types.js";
import { emitRunnerEvent } from "../metrics/emit.js";
import { isRunnerJobOwnershipLost } from "./worker.js";
import type { RunnerExecutionContext } from "./execution-context.js";
import { artifact } from "../artifact.js";
import { supabase } from "../supabase.js";
import type { SubmissionResult, SubmissionResultStatus } from "../submission-result.js";
import { writeRunnerPoolSubmissionResult } from "../result-writer.js";

type ArtifactCategory = "screenshots" | "pdfs" | "logs" | "traces";

interface PersistedApplicationResult {
  id: string;
  submission_result: Record<string, unknown> | null;
  submission_result_status: SubmissionResultStatus | null;
}

export interface DispatchArtifactPersistenceDependencies {
  readFile?: (localPath: string) => Promise<Buffer>;
  putArtifact?: (
    jobId: string,
    name: string,
    body: Buffer,
    options: { contentType: string; upsert: boolean },
  ) => Promise<{ path: string }>;
  loadApplicationResult?: (applicationId: string) => Promise<PersistedApplicationResult>;
  writeResult?: (
    execution: RunnerExecutionContext,
    result: SubmissionResult,
    status: SubmissionResultStatus,
  ) => Promise<void>;
}

export interface RunnerJobHandlerDependencies {
  persistOutcomeArtifacts?: (
    job: RunnerJob,
    execution: RunnerExecutionContext,
    outcome: DispatchOutcome,
  ) => Promise<void>;
}

function categoryForArtifact(storagePath: string): ArtifactCategory {
  const extension = path.extname(storagePath).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(extension)) {
    return "screenshots";
  }
  if (extension === ".pdf") return "pdfs";
  if ([".har", ".zip", ".trace"].includes(extension)) return "traces";
  return "logs";
}

function contentTypeForArtifact(localPath: string): string {
  const extension = path.extname(localPath).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  if (extension === ".pdf") return "application/pdf";
  if (extension === ".json" || extension === ".har") return "application/json";
  if (extension === ".txt" || extension === ".log") return "text/plain";
  if (extension === ".zip" || extension === ".trace") return "application/zip";
  return "application/octet-stream";
}

export function isScopedStoragePath(
  storagePath: string,
  jobId: string,
  applicationId: string,
): boolean {
  if (
    path.isAbsolute(storagePath)
    || path.win32.isAbsolute(storagePath)
    || storagePath.includes("://")
  ) {
    return false;
  }
  const segments = storagePath.split("/");
  if (segments.some((segment) => segment === "." || segment === "..")) {
    return false;
  }
  if (storagePath.startsWith(`jobs/${jobId}/`)) return true;
  return segments.includes(applicationId);
}

async function persistArtifactReference(
  artifactReference: string,
  index: number,
  job: RunnerJob,
  execution: RunnerExecutionContext,
  dependencies: Required<Pick<DispatchArtifactPersistenceDependencies, "readFile" | "putArtifact">>,
): Promise<string> {
  if (isScopedStoragePath(artifactReference, job.id, job.application_id)) {
    return artifactReference;
  }

  execution.assertOwned();
  const file = await dependencies.readFile(artifactReference);
  execution.assertOwned();
  const extension = path.extname(artifactReference).toLowerCase().replace(/[^.a-z0-9]/gu, "");
  const ref = await dependencies.putArtifact(
    job.id,
    `dispatch-outcome/artifact-${index}${extension}`,
    file,
    {
      contentType: contentTypeForArtifact(artifactReference),
      upsert: true,
    },
  );
  execution.assertOwned();
  return ref.path;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

/**
 * Add durable runner evidence without modifying the canonical result's
 * country or status. Artifact presence is evidence only and never upgrades a
 * pre-payment/review result to official success.
 */
export function mergeDispatchOutcomeArtifacts(
  currentResult: Record<string, unknown>,
  storagePaths: string[],
  evidenceKind?: DispatchOutcome["evidenceKind"],
): Record<string, unknown> {
  const currentArtifacts =
    currentResult.artifacts && typeof currentResult.artifacts === "object" && !Array.isArray(currentResult.artifacts)
      ? currentResult.artifacts as Record<string, unknown>
      : {};
  const mergedArtifacts: Record<string, unknown> = { ...currentArtifacts };

  for (const storagePath of storagePaths) {
    const category = categoryForArtifact(storagePath);
    mergedArtifacts[category] = Array.from(new Set([
      ...stringArray(currentArtifacts[category]),
      storagePath,
    ]));
  }

  const mergedResult: Record<string, unknown> = { ...currentResult, artifacts: mergedArtifacts };
  if (evidenceKind) {
    const currentEvidence = Array.isArray(currentResult.checkpointEvidence)
      ? currentResult.checkpointEvidence.filter(
          (item): item is Record<string, unknown> =>
            typeof item === "object" && item !== null && !Array.isArray(item),
        )
      : [];
    const evidence = [...currentEvidence];
    for (const screenshotStoragePath of storagePaths.filter(
      (storagePath) => categoryForArtifact(storagePath) === "screenshots",
    )) {
      if (
        evidence.some(
          (item) => item.kind === evidenceKind && item.screenshotStoragePath === screenshotStoragePath,
        )
      ) continue;
      evidence.push({
        kind: evidenceKind,
        screenshotStoragePath,
        capturedAt: new Date().toISOString(),
        authoritative: true,
      });
    }
    if (evidence.length > 0) mergedResult.checkpointEvidence = evidence;
  }
  return mergedResult;
}

async function loadCurrentApplicationResult(
  applicationId: string,
): Promise<PersistedApplicationResult> {
  const { data, error } = await supabase
    .from("applications")
    .select("id,submission_result,submission_result_status")
    .eq("id", applicationId)
    .maybeSingle();
  if (error) {
    throw new Error(`queue artifact result lookup failed: ${error.message}`);
  }
  if (!data || data.id !== applicationId) {
    throw new Error("queue artifact result lookup did not return the current application");
  }
  return data as PersistedApplicationResult;
}

export async function persistDispatchOutcomeArtifacts(
  job: RunnerJob,
  execution: RunnerExecutionContext,
  outcome: DispatchOutcome,
  dependencies: DispatchArtifactPersistenceDependencies = {},
): Promise<void> {
  if (outcome.artefacts.length === 0) return;
  const readFile = dependencies.readFile ?? ((localPath: string) => fs.readFile(localPath));
  const putArtifact = dependencies.putArtifact ?? ((jobId, name, body, options) =>
    artifact.put(jobId, name, body, options));
  const loadApplicationResult = dependencies.loadApplicationResult ?? loadCurrentApplicationResult;
  const writeResult = dependencies.writeResult ?? writeRunnerPoolSubmissionResult;
  execution.assertOwned();
  const current = await loadApplicationResult(job.application_id);
  execution.assertOwned();
  if (current.id !== job.application_id) {
    throw new Error("queue artifact result lookup did not return the current application");
  }
  if (!current.submission_result || !current.submission_result_status) {
    throw new Error("runner outcome artifacts require an existing application submission result");
  }

  const storagePaths: string[] = [];
  for (const [index, artifactReference] of outcome.artefacts.entries()) {
    if (!artifactReference.trim()) continue;
    storagePaths.push(await persistArtifactReference(
      artifactReference,
      index,
      job,
      execution,
      { readFile, putArtifact },
    ));
  }
  if (storagePaths.length === 0) return;

  const merged = mergeDispatchOutcomeArtifacts(
    current.submission_result,
    storagePaths,
    outcome.evidenceKind,
  );
  execution.assertOwned();
  await writeResult(
    execution,
    merged as unknown as SubmissionResult,
    current.submission_result_status,
  );
}

/**
 * runner_job JobHandler (QUE-003). Looks up the job's country in the
 * dispatch table and invokes its `runOne(applicationId)`. A normal return
 * lets the worker mark the job `succeeded` (including halt-before-pay
 * outcomes); a throw routes through the worker's retry/dead-letter logic.
 *
 * `UnsupportedCountryError` (unwired country) propagates as a throw so the
 * worker records `last_error` and dead-letters once retries are exhausted,
 * instead of silently dropping a paid order.
 *
 * OBSV-003: every log line carries the job's `correlation_id` (set by the
 * portal producer, lib/queue/enqueue.ts) so a run is traceable end-to-end
 * across portal → queue → runner. Format: docs/observability/logging.md.
 */
function requirePoolFlowKey(flowKey: string | null | undefined): string {
  if (typeof flowKey !== "string" || flowKey.trim().length === 0) {
    throw new UnsupportedCountryError("runner_job/missing flow_key");
  }
  return flowKey;
}

/** Build a queue handler with an injectable resolver for contract tests. */
export function createRunnerJobHandler(
  resolveRunOne: typeof getRunOne = getRunOne,
  dependencies: RunnerJobHandlerDependencies = {},
): JobHandler {
  const persistOutcomeArtifacts =
    dependencies.persistOutcomeArtifacts ?? persistDispatchOutcomeArtifacts;
  return async (job, execution) => {
    const cid = job.correlation_id ?? "-";
    emitRunnerEvent(job.country, "started", job.id);
    console.log(`[queue] cid=${cid} job=${job.id.slice(0, 8)} country=${job.country} dispatch`);
    try {
      // runner_job is the typed pool transport. A missing flow key must never
      // fall through to the legacy country dispatch table.
      const flowKey = requirePoolFlowKey(job.flow_key);
      const runOne = resolveRunOne(job.country, flowKey);
      const outcome = await runOne(job.application_id, job.id, execution);
      await persistOutcomeArtifacts(job, execution, outcome);
      emitRunnerEvent(job.country, outcome.outcome === "halted_before_pay" ? "halted" : "succeeded", job.id);
      console.log(
        `[queue] cid=${cid} job=${job.id.slice(0, 8)} country=${job.country} -> ${outcome.outcome} @ ${outcome.reachedStep}`,
      );
    } catch (err) {
      if (isRunnerJobOwnershipLost(err) || execution.signal.aborted) {
        emitRunnerEvent(job.country, "ownership_lost", job.id);
      } else if (err instanceof NeedsHumanError) {
        emitRunnerEvent(job.country, "needs_human", job.id);
      } else {
        emitRunnerEvent(job.country, "failed", job.id);
      }
      console.error(`[queue] cid=${cid} job=${job.id.slice(0, 8)} country=${job.country} threw`, err);
      throw err; // worker handles retry/dead-letter
    }
  };
}

export const runnerJobHandler: JobHandler = createRunnerJobHandler();

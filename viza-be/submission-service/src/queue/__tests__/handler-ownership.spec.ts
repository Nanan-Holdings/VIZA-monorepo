import assert from "node:assert/strict";
import test from "node:test";
import { RunnerJobOwnershipLostError } from "../execution-context.js";

process.env.SUPABASE_URL ??= "https://worker-runtime-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "worker-runtime-test-key";

test("runnerJobHandler emits ownership_lost instead of ordinary failed on cancellation", async () => {
  const { runnerJobHandler } = await import("../handler.js");
  const controller = new AbortController();
  const ownershipLost = new RunnerJobOwnershipLostError("lease lost during dispatch");
  controller.abort(ownershipLost);
  const events: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    const line = args.map((arg) => String(arg)).join(" ");
    if (line.includes('"metric":"runner_job_event"')) events.push(line);
  };
  try {
    await assert.rejects(
      () => runnerJobHandler(
        {
          id: "job-ownership",
          application_id: "app-ownership",
          country: "vietnam",
          flow_key: "vn_evisa",
          attempts: 0,
          max_attempts: 3,
          correlation_id: null,
          metadata: null,
        },
        {
          jobId: "job-ownership",
          workerId: "worker-handler-test",
          signal: controller.signal,
          assertOwned: () => {
            throw ownershipLost;
          },
          checkpoint: () => {
            throw ownershipLost;
          },
        },
      ),
      (error: unknown) => error === ownershipLost,
    );
  } finally {
    console.log = originalLog;
  }

  const eventNames = events.map((line) => {
    const parsed = JSON.parse(line) as { event?: unknown };
    return parsed.event;
  });
  assert.equal(eventNames.includes("ownership_lost"), true);
  assert.equal(eventNames.includes("failed"), false);
});

test("runnerJobHandler rejects a missing pool flow key before resolving any runner", async () => {
  const { createRunnerJobHandler } = await import("../handler.js");
  let resolverCalls = 0;
  const handler = createRunnerJobHandler(() => {
    resolverCalls += 1;
    return async () => ({
      outcome: "halted_before_pay" as const,
      reachedStep: "test",
      artefacts: [],
    });
  });
  const execution = {
    jobId: "job-missing-flow",
    workerId: "worker-handler-test",
    signal: new AbortController().signal,
    assertOwned: () => undefined,
    checkpoint: () => undefined,
  };

  for (const flowKey of [null, "   "] as const) {
    await assert.rejects(
      () => handler({
        id: "job-missing-flow",
        application_id: "app-missing-flow",
        country: "singapore",
        flow_key: flowKey,
        attempts: 0,
        max_attempts: 3,
        correlation_id: null,
        metadata: null,
      }, execution),
      /missing flow_key/,
    );
  }
  assert.equal(resolverCalls, 0);
});

test("runnerJobHandler persists DispatchOutcome artifacts for the exact current job", async () => {
  const { createRunnerJobHandler } = await import("../handler.js");
  const calls: Array<{
    applicationId: string;
    jobId: string;
    outcome: string;
    artefacts: string[];
  }> = [];
  const handler = createRunnerJobHandler(
    () => async () => ({
      outcome: "submitted_pending_pay",
      reachedStep: "official_confirmation",
      artefacts: ["jobs/job-artifacts/confirmation.pdf"],
    }),
    {
      persistOutcomeArtifacts: async (job, execution, outcome) => {
        calls.push({
          applicationId: job.application_id,
          jobId: execution.jobId,
          outcome: outcome.outcome,
          artefacts: outcome.artefacts,
        });
      },
    },
  );
  const execution = {
    jobId: "job-artifacts",
    workerId: "worker-handler-test",
    signal: new AbortController().signal,
    assertOwned: () => undefined,
    checkpoint: () => undefined,
  };

  await handler({
    id: "job-artifacts",
    application_id: "app-current",
    country: "singapore",
    flow_key: "sgac",
    attempts: 0,
    max_attempts: 3,
    correlation_id: null,
    metadata: null,
  }, execution);

  assert.deepEqual(calls, [{
    applicationId: "app-current",
    jobId: "job-artifacts",
    outcome: "submitted_pending_pay",
    artefacts: ["jobs/job-artifacts/confirmation.pdf"],
  }]);
});

test("DispatchOutcome artifact merge preserves prepayment status and existing evidence", async () => {
  const { mergeDispatchOutcomeArtifacts } = await import("../handler.js");
  const before = {
    country: "FR",
    status: "stopped_at_pay",
    applicationReference: "redacted-reference",
    artifacts: {
      screenshots: ["jobs/job-pay/existing.png"],
      qrCodes: ["jobs/job-pay/official-qr.png"],
    },
  };

  const merged = mergeDispatchOutcomeArtifacts(before, [
    "jobs/job-pay/payment-review.png",
    "jobs/job-pay/payment-review.png",
    "jobs/job-pay/draft.pdf",
  ]);

  assert.equal(merged.status, "stopped_at_pay");
  assert.equal(merged.country, "FR");
  assert.deepEqual(merged.artifacts, {
    screenshots: [
      "jobs/job-pay/existing.png",
      "jobs/job-pay/payment-review.png",
    ],
    qrCodes: ["jobs/job-pay/official-qr.png"],
    pdfs: ["jobs/job-pay/draft.pdf"],
  });
  assert.equal("submitted" in merged, false);
});

test("legacy local evidence is uploaded under the current job and merged with unchanged status", async () => {
  const { persistDispatchOutcomeArtifacts } = await import("../handler.js");
  const written: Array<{ result: Record<string, unknown>; status: string }> = [];
  const execution = {
    jobId: "job-current",
    workerId: "worker-handler-test",
    signal: new AbortController().signal,
    assertOwned: () => undefined,
    checkpoint: () => undefined,
  };

  await persistDispatchOutcomeArtifacts(
    {
      id: "job-current",
      application_id: "app-current",
      country: "france",
      flow_key: "france",
      attempts: 0,
      max_attempts: 3,
      correlation_id: null,
      metadata: null,
    },
    execution,
    {
      outcome: "halted_before_pay",
      reachedStep: "payment_review",
      artefacts: ["/tmp/private-payment-review.png"],
      evidenceKind: "pre_payment",
    },
    {
      readFile: async (localPath) => {
        assert.equal(localPath, "/tmp/private-payment-review.png");
        return Buffer.from("redacted-test-image");
      },
      putArtifact: async (jobId, name, _body, options) => {
        assert.equal(jobId, "job-current");
        assert.equal(name, "dispatch-outcome/artifact-0.png");
        assert.deepEqual(options, { contentType: "image/png", upsert: true });
        return { path: "jobs/job-current/dispatch-outcome/artifact-0.png" };
      },
      loadApplicationResult: async (applicationId) => {
        assert.equal(applicationId, "app-current");
        return {
          id: "app-current",
          submission_result: {
            country: "FR",
            status: "stopped_at_pay",
            applicationReference: "redacted-reference",
          },
          submission_result_status: "stopped_at_pay",
        };
      },
      writeResult: async (writeExecution, result, status) => {
        assert.equal(writeExecution, execution);
        written.push({ result: result as unknown as Record<string, unknown>, status });
      },
    },
  );

  assert.equal(written.length, 1);
  assert.equal(written[0]?.status, "stopped_at_pay");
  assert.equal(written[0]?.result.status, "stopped_at_pay");
  assert.deepEqual(written[0]?.result.artifacts, {
    screenshots: ["jobs/job-current/dispatch-outcome/artifact-0.png"],
  });
  assert.deepEqual(
    (written[0]?.result.checkpointEvidence as Array<Record<string, unknown>>).map(
      ({ kind, screenshotStoragePath, authoritative }) => ({
        kind,
        screenshotStoragePath,
        authoritative,
      }),
    ),
    [{
      kind: "pre_payment",
      screenshotStoragePath: "jobs/job-current/dispatch-outcome/artifact-0.png",
      authoritative: true,
    }],
  );
});

test("artifact persistence rejects a result loaded for another application", async () => {
  const { persistDispatchOutcomeArtifacts } = await import("../handler.js");
  let writes = 0;
  const execution = {
    jobId: "job-current",
    workerId: "worker-handler-test",
    signal: new AbortController().signal,
    assertOwned: () => undefined,
    checkpoint: () => undefined,
  };

  await assert.rejects(
    () => persistDispatchOutcomeArtifacts(
      {
        id: "job-current",
        application_id: "app-current",
        country: "france",
        flow_key: "france",
        attempts: 0,
        max_attempts: 3,
        correlation_id: null,
        metadata: null,
      },
      execution,
      {
        outcome: "halted_before_pay",
        reachedStep: "payment_review",
        artefacts: ["jobs/job-current/review.png"],
      },
      {
        loadApplicationResult: async () => ({
          id: "app-other",
          submission_result: { country: "FR", status: "submitted" },
          submission_result_status: "submitted",
        }),
        writeResult: async () => {
          writes += 1;
        },
      },
    ),
    /current application/,
  );
  assert.equal(writes, 0);
});

test("DispatchOutcome storage paths are accepted only for the current job or application", async () => {
  const { isScopedStoragePath } = await import("../handler.js");

  assert.equal(
    isScopedStoragePath("jobs/job-current/review.png", "job-current", "app-current"),
    true,
  );
  assert.equal(
    isScopedStoragePath("user-1/app-current/FR/review.png", "job-current", "app-current"),
    true,
  );
  assert.equal(
    isScopedStoragePath("jobs/job-other/review.png", "job-current", "app-current"),
    false,
  );
  assert.equal(
    isScopedStoragePath("user-1/app-other/FR/review.png", "job-current", "app-current"),
    false,
  );
  assert.equal(
    isScopedStoragePath("https://untrusted.invalid/app-current/review.png", "job-current", "app-current"),
    false,
  );
  assert.equal(
    isScopedStoragePath("/tmp/app-current/review.png", "job-current", "app-current"),
    false,
  );
  assert.equal(
    isScopedStoragePath("C:\\temp\\app-current\\review.png", "job-current", "app-current"),
    false,
  );
});

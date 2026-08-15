import { Pool, type PoolClient, type QueryResult } from "pg";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

const confirm = process.env.RUNNER_FENCE_DB_CONFIRM === "local-test";
const databaseUrl = process.env.RUNNER_FENCE_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? databaseUrl;
const nonProductionMarker = (process.env.RUNNER_FENCE_DB_NONPRODUCTION ?? "").toLowerCase();

const localHost = (() => {
  try {
    const host = new URL(supabaseUrl).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "supabase";
  } catch {
    return false;
  }
})();

const explicitNonProduction = ["1", "true", "local", "local-test", "non-production"].includes(
  nonProductionMarker,
);
const liveGateEnabled = Boolean(databaseUrl) && confirm && localHost && explicitNonProduction;

const suiteLockName = "viza-runner-concurrency-phase-two-integration";
const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

type Fixture = {
  applicantId: string;
  applicationId: string;
  jobId: string;
};

type FixtureOptions = {
  leaseUntil?: Date;
  workerId?: string;
  maxAttempts?: number;
  applicationStatus?: string;
  submissionResult?: Record<string, unknown> | null;
  submissionResultStatus?: string | null;
};

let pool: Pool | undefined;
let suiteLockClient: PoolClient | undefined;
const fixtureIds = new Set<string>();

const query = async <T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string,
  values: unknown[] = [],
): Promise<QueryResult<T>> => {
  if (!pool) throw new Error("integration pool is not initialized");
  return pool.query<T>(sql, values);
};

const createFixture = async (options: FixtureOptions = {}): Promise<Fixture> => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const applicant = await query<{ id: string }>(
    `INSERT INTO public.applicant_profiles (email, full_name)
     VALUES ($1, $2)
     RETURNING id`,
    [`runner-fence-${suffix}@invalid.test`, "Runner fence integration"],
  );
  const applicantId = applicant.rows[0].id;
  const application = await query<{ id: string }>(
    `INSERT INTO public.applications (
       applicant_id, country, visa_type, status, submission_result,
       submission_result_status, submission_result_updated_at
     )
     VALUES ($1, 'vietnam', 'vn_evisa', $2, $3::jsonb, $4, NULL)
     RETURNING id`,
    [
      applicantId,
      options.applicationStatus ?? "processing",
      JSON.stringify(options.submissionResult ?? null),
      options.submissionResultStatus ?? "waiting",
    ],
  );
  const applicationId = application.rows[0].id;
  const leaseUntil = options.leaseUntil ?? new Date(Date.now() + 30_000);
  const workerId = options.workerId ?? `runner-fence-worker-${suffix}`;
  const job = await query<{ id: string }>(
    `INSERT INTO public.runner_job (
       application_id, country, flow_key, status, attempts, max_attempts,
       leased_by, leased_until, started_at, available_at, metadata
     )
     VALUES ($1, 'vietnam', 'vn_evisa', 'running', 0, $2, $3, $4, NOW(), NOW(), $5::jsonb)
     RETURNING id`,
    [applicationId, options.maxAttempts ?? 3, workerId, leaseUntil, JSON.stringify({ synthetic: true })],
  );
  const jobId = job.rows[0].id;
  fixtureIds.add(jobId);
  fixtureIds.add(applicationId);
  fixtureIds.add(applicantId);
  return { applicantId, applicationId, jobId };
};

const cleanupFixture = async (fixture: Fixture): Promise<void> => {
  if (!pool) return;
  await pool.query("DELETE FROM public.runner_job WHERE id = $1", [fixture.jobId]);
  await pool.query("DELETE FROM public.applications WHERE id = $1", [fixture.applicationId]);
  await pool.query("DELETE FROM public.applicant_profiles WHERE id = $1", [fixture.applicantId]);
  fixtureIds.delete(fixture.jobId);
  fixtureIds.delete(fixture.applicationId);
  fixtureIds.delete(fixture.applicantId);
};

const backendPid = async (client: PoolClient): Promise<number> => {
  const result = await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
  return result.rows[0].pid;
};

const waitForLockWait = async (pid: number): Promise<void> => {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const activity = await query<{
      wait_event_type: string | null;
      wait_event: string | null;
      state: string;
    }>(
      `SELECT wait_event_type, wait_event, state
       FROM pg_catalog.pg_stat_activity
       WHERE pid = $1`,
      [pid],
    );
    const row = activity.rows[0];
    if (row?.wait_event_type === "Lock") return;
    await sleep(15);
  }
  throw new Error("runner fence RPC did not appear in pg_stat_activity waiting on a lock");
};

const invokeAfterLockWait = async <T extends Record<string, unknown>>(
  fixture: Fixture,
  sql: string,
  values: unknown[],
): Promise<QueryResult<T>> => {
  if (!pool) throw new Error("integration pool is not initialized");
  const blocker = await pool.connect();
  const waiter = await pool.connect();
  try {
    await blocker.query("BEGIN");
    await blocker.query("SELECT id FROM public.runner_job WHERE id = $1 FOR UPDATE", [fixture.jobId]);
    const waiterPid = await backendPid(waiter);
    const pending = waiter.query<T>(sql, values);
    await waitForLockWait(waiterPid);
    await sleep(350);
    await blocker.query("COMMIT");
    return await pending;
  } finally {
    await blocker.query("ROLLBACK").catch(() => undefined);
    blocker.release();
    waiter.release();
  }
};

const integrationSuite = describe.skipIf(!liveGateEnabled);

integrationSuite("runner pool concurrency phase two real Postgres fence", () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl, max: 8 });
    suiteLockClient = await pool.connect();
    await suiteLockClient.query("SELECT pg_advisory_lock(hashtext($1))", [suiteLockName]);
  });

  afterAll(async () => {
    if (pool) {
      for (const id of fixtureIds) {
        await pool.query("DELETE FROM public.runner_job WHERE id = $1", [id]).catch(() => undefined);
        await pool.query("DELETE FROM public.applications WHERE id = $1", [id]).catch(() => undefined);
        await pool.query("DELETE FROM public.applicant_profiles WHERE id = $1", [id]).catch(() => undefined);
      }
    }
    if (suiteLockClient) {
      await suiteLockClient
        .query("SELECT pg_advisory_unlock(hashtext($1))", [suiteLockName])
        .catch(() => undefined);
      suiteLockClient.release();
    }
    await pool?.end();
    pool = undefined;
  });

  it("renews an active owner and normalizes worker whitespace", async () => {
    const workerId = "runner-fence-active";
    const fixture = await createFixture({ workerId });
    try {
      const result = await query<{ leased_until: string }>(
        "SELECT * FROM public.renew_runner_pool_job($1::uuid, $2::text, 60000)",
        [fixture.jobId, `  ${workerId}  `],
      );
      expect(result.rows).toHaveLength(1);
      const row = await query<{ leased_by: string; status: string }>(
        "SELECT leased_by, status FROM public.runner_job WHERE id = $1",
        [fixture.jobId],
      );
      expect(row.rows[0]).toEqual({ leased_by: workerId, status: "running" });
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("returns zero for renew, complete, and fail after lock-wait lease expiry", async () => {
    const workerId = "runner-fence-expiring";
    const calls: Array<[string, unknown[]]> = [
      [
        "SELECT * FROM public.renew_runner_pool_job($1::uuid, $2::text, 60000)",
        ["JOB", workerId],
      ],
      [
        "SELECT * FROM public.complete_runner_pool_job($1::uuid, $2::text)",
        ["JOB", workerId],
      ],
      [
        "SELECT * FROM public.complete_runner_pool_job($1::uuid, $2::text, $3::timestamptz)",
        ["JOB", workerId, new Date(Date.now() - 60 * 60_000).toISOString()],
      ],
      [
        "SELECT * FROM public.fail_runner_pool_job($1::uuid, $2::text, 'failed', 1, 'expired', 0)",
        ["JOB", workerId],
      ],
    ];
    for (const [sql, valuesTemplate] of calls) {
      const fixture = await createFixture({
        workerId,
        leaseUntil: new Date(Date.now() + 200),
      });
      try {
        const values = valuesTemplate.map((value) => (value === "JOB" ? fixture.jobId : value));
        const result = await invokeAfterLockWait(fixture, sql, values);
        expect(result.rows).toHaveLength(0);
        const row = await query<{ status: string; leased_by: string }>(
          "SELECT status, leased_by FROM public.runner_job WHERE id = $1",
          [fixture.jobId],
        );
        expect(row.rows[0]).toEqual({ status: "running", leased_by: workerId });
      } finally {
        await cleanupFixture(fixture);
      }
    }
  });

  it("ignores stale explicit p_now for current completion ownership", async () => {
    const workerId = "runner-fence-current-complete";
    const fixture = await createFixture({ workerId });
    try {
      const staleNow = new Date(Date.now() - 60 * 60_000).toISOString();
      const result = await query<{ application_id: string }>(
        "SELECT * FROM public.complete_runner_pool_job($1::uuid, $2::text, $3::timestamptz)",
        [fixture.jobId, workerId, staleNow],
      );
      expect(result.rows).toHaveLength(1);
      const row = await query<{ status: string; finished_at: string }>(
        "SELECT status, finished_at FROM public.runner_job WHERE id = $1",
        [fixture.jobId],
      );
      expect(row.rows[0].status).toBe("succeeded");
      expect(new Date(row.rows[0].finished_at).toISOString()).toBe(staleNow);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("fails an active owner through the fenced failure RPC", async () => {
    const workerId = "runner-fence-active-failure";
    const fixture = await createFixture({ workerId });
    try {
      const result = await query<{ id: string; status: string }>(
        "SELECT * FROM public.fail_runner_pool_job($1::uuid, $2::text, 'failed', 1, 'synthetic active failure', 0)",
        [fixture.jobId, workerId],
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].status).toBe("failed");
      const row = await query<{ status: string; leased_by: string | null }>(
        "SELECT status, leased_by FROM public.runner_job WHERE id = $1",
        [fixture.jobId],
      );
      expect(row.rows[0]).toEqual({ status: "failed", leased_by: null });
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("writes active results atomically and advances application status only for submitted", async () => {
    const first = await createFixture({ applicationStatus: "processing" });
    const second = await createFixture({ applicationStatus: "processing" });
    try {
      const firstResult = await query<{ runner_job_id: string; application_id: string }>(
        "SELECT * FROM public.write_runner_pool_submission_result($1::uuid, $2::text, $3::jsonb, $4::text)",
        [first.jobId, (await query<{ leased_by: string }>("SELECT leased_by FROM public.runner_job WHERE id = $1", [first.jobId])).rows[0].leased_by, { phase: "processing" }, "processing"],
      );
      expect(firstResult.rows).toHaveLength(1);
      const firstApp = await query<{ status: string; submission_result_status: string; submission_result: Record<string, unknown> }>(
        "SELECT status, submission_result_status, submission_result FROM public.applications WHERE id = $1",
        [first.applicationId],
      );
      expect(firstApp.rows[0]).toMatchObject({ status: "processing", submission_result_status: "processing", submission_result: { phase: "processing" } });

      const secondWorker = await query<{ leased_by: string }>("SELECT leased_by FROM public.runner_job WHERE id = $1", [second.jobId]);
      const secondResult = await query<{ application_id: string }>(
        "SELECT * FROM public.write_runner_pool_submission_result($1::uuid, $2::text, $3::jsonb, $4::text)",
        [second.jobId, secondWorker.rows[0].leased_by, { phase: "submitted" }, "submitted"],
      );
      expect(secondResult.rows).toHaveLength(1);
      const secondApp = await query<{ status: string; submission_result_status: string }>(
        "SELECT status, submission_result_status FROM public.applications WHERE id = $1",
        [second.applicationId],
      );
      expect(secondApp.rows[0]).toEqual({ status: "submitted", submission_result_status: "submitted" });
    } finally {
      await cleanupFixture(first);
      await cleanupFixture(second);
    }
  });

  it("returns zero for an expired or reclaimed result owner without overwriting the application", async () => {
    const workerId = "runner-fence-old-owner";
    const fixture = await createFixture({
      workerId,
      leaseUntil: new Date(Date.now() - 1000),
      submissionResult: { keep: true },
      submissionResultStatus: "processing",
    });
    try {
      const expired = await query(
        "SELECT * FROM public.write_runner_pool_submission_result($1::uuid, $2::text, $3::jsonb, $4::text)",
        [fixture.jobId, workerId, { stale: true }, "submitted"],
      );
      expect(expired.rows).toHaveLength(0);
      await query(
        "UPDATE public.runner_job SET leased_by = 'new-owner', leased_until = NOW() + INTERVAL '1 minute' WHERE id = $1",
        [fixture.jobId],
      );
      const reclaimed = await query(
        "SELECT * FROM public.write_runner_pool_submission_result($1::uuid, $2::text, $3::jsonb, $4::text)",
        [fixture.jobId, workerId, { stale: true }, "submitted"],
      );
      expect(reclaimed.rows).toHaveLength(0);
      const app = await query<{ status: string; submission_result: Record<string, unknown> }>(
        "SELECT status, submission_result FROM public.applications WHERE id = $1",
        [fixture.applicationId],
      );
      expect(app.rows[0]).toMatchObject({ submission_result: { keep: true } });
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("drops stale direct lifecycle writes but permits metadata-only writes", async () => {
    const fixture = await createFixture({ leaseUntil: new Date(Date.now() - 1000) });
    try {
      const stale = await query(
        "UPDATE public.runner_job SET leased_until = NOW() + INTERVAL '1 minute' WHERE id = $1 RETURNING id",
        [fixture.jobId],
      );
      expect(stale.rows).toHaveLength(0);
      const metadata = await query(
        "UPDATE public.runner_job SET metadata = jsonb_build_object('synthetic', true, 'metadata_only', true) WHERE id = $1 RETURNING metadata",
        [fixture.jobId],
      );
      expect(metadata.rows).toHaveLength(1);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("recovers exactly one expired row with exact markers and clears them", async () => {
    const fixture = await createFixture({
      leaseUntil: new Date(Date.now() - 1000),
      maxAttempts: 3,
    });
    const client = await pool!.connect();
    try {
      const now = new Date().toISOString();
      await client.query(
        "SELECT * FROM public.claim_runner_pool_job($1::text, 60000, FALSE, $2::timestamptz)",
        [`runner-fence-recovery-${Date.now()}`, now],
      );
      const row = await client.query<{ status: string; attempts: number; leased_by: string | null; last_error: string; available_at: string }>(
        "SELECT status, attempts, leased_by, last_error, available_at FROM public.runner_job WHERE id = $1",
        [fixture.jobId],
      );
      expect(row.rows[0]).toMatchObject({ status: "queued", attempts: 1, leased_by: null });
      expect(row.rows[0].last_error).toContain("lease expired");
      const markers = await client.query<{ job_id: string; recovery_now: string }>(
        "SELECT current_setting('viza.runner_recovery_job_id', true) AS job_id, current_setting('viza.runner_recovery_now', true) AS recovery_now",
      );
      expect(markers.rows[0].job_id ?? "").toBe("");
      expect(markers.rows[0].recovery_now ?? "").toBe("");
    } finally {
      client.release();
      await cleanupFixture(fixture);
    }
  });
});

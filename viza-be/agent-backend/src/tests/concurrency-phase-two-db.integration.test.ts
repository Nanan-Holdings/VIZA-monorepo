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
const nonProductionMarker = (process.env.RUNNER_FENCE_DB_NONPRODUCTION ?? "").toLowerCase();
// Only these explicit database-side markers may unlock synthetic writes.
const allowedDatabaseEnvironments = new Set([
  "local",
  "local-test",
  "test",
  "development",
]);

const localHost = (() => {
  try {
    const host = new URL(databaseUrl).hostname.toLowerCase();
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
       VALUES ($1, 'vietnam', 'vn_prearrival', $2, $3::jsonb, $4, NULL)
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
       available_at, metadata
     )
     VALUES ($1, 'vietnam', 'vn_prearrival', 'queued', 0, $2, NOW(), $3::jsonb)
     RETURNING id`,
    [applicationId, options.maxAttempts ?? 3, JSON.stringify({ synthetic: true })],
  );
  const jobId = job.rows[0].id;
  const claimed = await query<{ id: string }>(
    "SELECT id FROM public.claim_runner_pool_job($1::text, 60000, FALSE, NOW() + INTERVAL '1 day')",
    [workerId],
  );
  if (claimed.rows[0]?.id !== jobId) {
    throw new Error("runner fence integration could not claim its synthetic queued fixture");
  }
  if (options.leaseUntil) {
    // Local gated tests need deterministic expired/live lease shapes. The
    // canonical claim above proves the initial queued tuple; this narrowly
    // scoped local-only adjustment avoids bypassing the production claim path.
    const adjuster = await pool!.connect();
    try {
      await adjuster.query("BEGIN");
      await adjuster.query("SET LOCAL session_replication_role = 'replica'");
      await adjuster.query(
        "UPDATE public.runner_job SET leased_until = $2 WHERE id = $1",
        [jobId, leaseUntil],
      );
      await adjuster.query("COMMIT");
    } finally {
      await adjuster.query("ROLLBACK").catch(() => undefined);
      adjuster.release();
    }
  }
  fixtureIds.add(jobId);
  fixtureIds.add(applicationId);
  fixtureIds.add(applicantId);
  return { applicantId, applicationId, jobId };
};

const createTaiwanFixture = async (options: {
  workerId?: string;
  maxAttempts?: number;
  leaseUntil?: Date;
} = {}): Promise<Fixture> => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const applicant = await query<{ id: string }>(
    `INSERT INTO public.applicant_profiles (email, full_name)
     VALUES ($1, $2)
     RETURNING id`,
    [`runner-fence-tw-${suffix}@invalid.test`, "Taiwan runner fence integration"],
  );
  const applicantId = applicant.rows[0].id;
  const application = await query<{ id: string }>(
    `INSERT INTO public.applications (
       applicant_id, country, visa_type, status, submission_result,
       submission_result_status, submission_result_updated_at
     ) VALUES ($1, 'taiwan', 'tw_entry_permit', 'processing',
       '{"country":"TW","status":"stopped_at_captcha"}'::jsonb,
       'needs_user_action', NULL)
     RETURNING id`,
    [applicantId],
  );
  const applicationId = application.rows[0].id;
  const workerId = options.workerId ?? `runner-fence-tw-worker-${suffix}`;
  const job = await query<{ id: string }>(
    `INSERT INTO public.runner_job (
       application_id, country, flow_key, status, attempts, max_attempts,
       available_at, metadata
     ) VALUES ($1, 'taiwan', 'tw_entry_permit', 'queued', 0, $2, NOW(), $3::jsonb)
     RETURNING id`,
    [applicationId, options.maxAttempts ?? 3, JSON.stringify({ synthetic: true })],
  );
  const jobId = job.rows[0].id;
  const claimed = await query<{ id: string }>(
    "SELECT id FROM public.claim_runner_pool_job($1::text, 60000, FALSE, NOW())",
    [workerId],
  );
  if (claimed.rows[0]?.id !== jobId) {
    throw new Error("runner fence integration could not claim its synthetic Taiwan fixture");
  }
  if (options.leaseUntil) {
    const adjuster = await pool!.connect();
    try {
      await adjuster.query("BEGIN");
      await adjuster.query("SET LOCAL session_replication_role = 'replica'");
      await adjuster.query(
        "UPDATE public.runner_job SET leased_until = $2 WHERE id = $1",
        [jobId, options.leaseUntil],
      );
      await adjuster.query("COMMIT");
    } finally {
      await adjuster.query("ROLLBACK").catch(() => undefined);
      adjuster.release();
    }
  }
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

const invokeAfterApplicationLockWait = async <T extends Record<string, unknown>>(
  fixture: Fixture,
  sql: string,
  values: unknown[],
): Promise<QueryResult<T>> => {
  if (!pool) throw new Error("integration pool is not initialized");
  const blocker = await pool.connect();
  const waiter = await pool.connect();
  try {
    await blocker.query("BEGIN");
    await blocker.query(
      "SELECT id FROM public.applications WHERE id = $1 FOR UPDATE",
      [fixture.applicationId],
    );
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
    const environment = await suiteLockClient.query<{ viza_environment: string | null }>(
      "SELECT current_setting('app.viza_environment', true) AS viza_environment",
    );
    const databaseEnvironment = environment.rows[0]?.viza_environment ?? "";
    if (!allowedDatabaseEnvironments.has(databaseEnvironment)) {
      throw new Error(
        `runner fence integration requires app.viza_environment in ${[...allowedDatabaseEnvironments].join(", ")}`,
      );
    }
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
      expect(new Date(row.rows[0].finished_at).getTime()).toBeGreaterThan(
        Date.now() - 5_000,
      );
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("fails an active owner through the fenced failure RPC", async () => {
    const workerId = "runner-fence-active-failure";
    const fixture = await createFixture({ workerId, maxAttempts: 1 });
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

  it("returns zero when takeover waits on the application lock past lease expiry", async () => {
    const workerId = "runner-fence-takeover-lock-expiry";
    const fixture = await createFixture({
      workerId,
      leaseUntil: new Date(Date.now() + 200),
    });
    try {
      const result = await invokeAfterApplicationLockWait(
        fixture,
        "SELECT * FROM public.open_runner_job_takeover($1::uuid, $2::text, $3::uuid, $4::uuid, $5::text, $6::text, $7::text)",
        [
          fixture.jobId,
          workerId,
          fixture.applicationId,
          fixture.applicantId,
          "synthetic lock expiry",
          "wss://runner.invalid/debug",
          null,
        ],
      );
      expect(result.rows).toHaveLength(0);
      const row = await query<{ status: string; leased_by: string | null }>(
        "SELECT status, leased_by FROM public.runner_job WHERE id = $1",
        [fixture.jobId],
      );
      expect(row.rows[0]).toEqual({ status: "running", leased_by: workerId });
      const takeover = await query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM public.takeover_session WHERE job_id = $1",
        [fixture.jobId],
      );
      expect(takeover.rows[0].count).toBe("0");
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("rejects a failure transition whose status does not match attempts", async () => {
    const workerId = "runner-fence-fail-shape";
    const fixture = await createFixture({ workerId });
    try {
      await expect(
        query(
          "SELECT * FROM public.fail_runner_pool_job($1::uuid, $2::text, 'failed', 1, 'bad shape', 0)",
          [fixture.jobId, workerId],
        ),
      ).rejects.toMatchObject({ code: "22023" });
      const row = await query<{
        status: string;
        attempts: number;
        leased_by: string | null;
      }>(
        "SELECT status, attempts, leased_by FROM public.runner_job WHERE id = $1",
        [fixture.jobId],
      );
      expect(row.rows[0]).toEqual({ status: "running", attempts: 0, leased_by: workerId });
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

  it("returns zero when the application-row lock wait crosses the lease expiry", async () => {
    const workerId = "runner-fence-app-lock-expiry";
    const fixture = await createFixture({
      workerId,
      leaseUntil: new Date(Date.now() + 200),
      submissionResult: { keep: true },
      submissionResultStatus: "processing",
    });
    try {
      const result = await invokeAfterApplicationLockWait(
        fixture,
        "SELECT * FROM public.write_runner_pool_submission_result($1::uuid, $2::text, $3::jsonb, $4::text)",
        [fixture.jobId, workerId, { stale: true }, "submitted"],
      );
      expect(result.rows).toHaveLength(0);
      const app = await query<{ status: string; submission_result: Record<string, unknown> }>(
        "SELECT status, submission_result FROM public.applications WHERE id = $1",
        [fixture.applicationId],
      );
      expect(app.rows[0]).toMatchObject({ status: "processing", submission_result: { keep: true } });
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("ignores a future claim p_now and leaves an active lease and capability table unchanged", async () => {
    const workerId = "runner-fence-claim-clock";
    const fixture = await createFixture({
      workerId,
      leaseUntil: new Date(Date.now() + 30_000),
    });
    const client = await pool!.connect();
    try {
      const before = await client.query<{
        status: string;
        leased_by: string | null;
        leased_until: string;
      }>(
        "SELECT status, leased_by, leased_until FROM public.runner_job WHERE id = $1",
        [fixture.jobId],
      );
      const future = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
      await client.query(
        "SELECT * FROM public.claim_runner_pool_job($1::text, 60000, FALSE, $2::timestamptz)",
        [workerId, future],
      );
      const after = await client.query<{
        status: string;
        leased_by: string | null;
        leased_until: string;
      }>(
        "SELECT status, leased_by, leased_until FROM public.runner_job WHERE id = $1",
        [fixture.jobId],
      );
      expect(after.rows[0].status).toBe("running");
      expect(after.rows[0].leased_by).toBe(workerId);
      expect(new Date(after.rows[0].leased_until).getTime()).toBe(
        new Date(before.rows[0].leased_until).getTime(),
      );
      const capabilities = await client.query<{ allowed: boolean }>(
        "SELECT has_table_privilege(current_user, 'runner_private.runner_job_update_capability', 'SELECT') AS allowed",
      );
      expect(capabilities.rows[0].allowed).toBe(false);
    } finally {
      client.release();
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
      const identity = await query(
        "UPDATE public.runner_job SET country = 'singapore' WHERE id = $1 RETURNING id",
        [fixture.jobId],
      );
      expect(identity.rows).toHaveLength(0);
      const metadata = await query(
        "UPDATE public.runner_job SET metadata = jsonb_build_object('synthetic', true, 'metadata_only', true) WHERE id = $1 RETURNING metadata",
        [fixture.jobId],
      );
      expect(metadata.rows).toHaveLength(1);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("recovers exactly one expired row with an exact one-time capability", async () => {
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
      const capabilities = await client.query<{ allowed: boolean }>(
        "SELECT has_table_privilege(current_user, 'runner_private.runner_job_update_capability', 'SELECT') AS allowed",
      );
      expect(capabilities.rows[0].allowed).toBe(false);
    } finally {
      client.release();
      await cleanupFixture(fixture);
    }
  });

  it("blocks BASE direct lifecycle writes on an active row", async () => {
    const workerId = "runner-fence-direct-active";
    const updates = [
      "UPDATE public.runner_job SET leased_until = leased_until + INTERVAL '1 minute' WHERE id = $1 RETURNING id",
      "UPDATE public.runner_job SET status = 'succeeded' WHERE id = $1 RETURNING id",
      "UPDATE public.runner_job SET last_error = 'direct stale failure' WHERE id = $1 RETURNING id",
    ];
    for (const update of updates) {
      const fixture = await createFixture({ workerId });
      try {
        const result = await query(update, [fixture.jobId]);
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

  it("appends fingerprints only through the exact live-owner RPC", async () => {
    const workerId = "runner-fence-fingerprint";
    const fixture = await createFixture({ workerId });
    try {
      const direct = await query(
        "UPDATE public.runner_job SET fingerprint_history = jsonb_build_array(jsonb_build_object('forged', true)) WHERE id = $1 RETURNING id",
        [fixture.jobId],
      );
      expect(direct.rows).toHaveLength(0);
      const result = await query<{ job_id: string; fingerprint_history: Array<Record<string, unknown>> }>(
        "SELECT * FROM public.append_runner_job_fingerprint($1::uuid, $2::text, $3::jsonb)",
        [fixture.jobId, ` ${workerId} `, { challenge: "turnstile", at: "synthetic" }],
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].fingerprint_history).toEqual([
        { challenge: "turnstile", at: "synthetic" },
      ]);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("exposes no capability schema/table/function privileges to the runtime role", async () => {
    const privileges = await query<{
      schema_usage: boolean;
      table_select: boolean;
      trigger_execute: boolean;
    }>(
      `SELECT
         has_schema_privilege(current_user, 'runner_private', 'USAGE') AS schema_usage,
         has_table_privilege(current_user, 'runner_private.runner_job_update_capability', 'SELECT') AS table_select,
         has_function_privilege(current_user, 'runner_private.guard_expired_runner_job_lifecycle_update()', 'EXECUTE') AS trigger_execute`,
    );
    expect(privileges.rows[0]).toEqual({
      schema_usage: false,
      table_select: false,
      trigger_execute: false,
    });
  });

  it("never claims or counts a null/retired flow tuple", async () => {
    const fixture = await createFixture({ workerId: "runner-fence-invalid-flow" });
    try {
      await query(
        "SELECT * FROM public.fail_runner_pool_job($1::uuid, $2::text, 'failed', 1, 'synthetic invalid-flow setup', 0)",
        [fixture.jobId, "runner-fence-invalid-flow"],
      );
      await expect(query(
        `INSERT INTO public.runner_job (
           application_id, country, flow_key, status, attempts, max_attempts,
           available_at, enqueued_at, metadata
         ) VALUES ($1, 'vietnam', NULL, 'queued', 0, 3, NOW(), NOW(), '{}'::jsonb)`,
        [fixture.applicationId],
      )).rejects.toMatchObject({ code: "23514" });
      const claimed = await query(
        "SELECT * FROM public.claim_runner_pool_job($1::text, 60000, FALSE, NOW() + INTERVAL '1 day')",
        ["runner-fence-invalid-claim"],
      );
      expect(claimed.rows).toHaveLength(0);
      const depth = await query<{ claimable: number; scheduled: number; running: number }>(
        "SELECT claimable, scheduled, running FROM public.runner_pool_depth WHERE country = 'vietnam'",
      );
      expect(depth.rows[0]).toMatchObject({ claimable: 0, scheduled: 0, running: 0 });
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("rejects direct running inserts and queued-to-running writes while canonical claim succeeds", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const applicant = await query<{ id: string }>(
      `INSERT INTO public.applicant_profiles (email, full_name)
       VALUES ($1, $2) RETURNING id`,
      [`runner-fence-claim-guard-${suffix}@invalid.test`, "Runner claim guard"],
    );
    const applicantId = applicant.rows[0].id;
    const application = await query<{ id: string }>(
      `INSERT INTO public.applications (applicant_id, country, visa_type, status)
       VALUES ($1, 'vietnam', 'vn_prearrival', 'processing') RETURNING id`,
      [applicantId],
    );
    const applicationId = application.rows[0].id;
    fixtureIds.add(applicantId);
    fixtureIds.add(applicationId);
    try {
      await expect(query(
        `INSERT INTO public.runner_job (
           application_id, country, flow_key, status, attempts, max_attempts,
           available_at, enqueued_at, metadata
         ) VALUES ($1, 'vietnam', 'vn_prearrival', 'running', 0, 3, NOW(), NOW(), '{}'::jsonb)`,
        [applicationId],
      )).rejects.toMatchObject({ code: "23514" });

      const queued = await query<{ id: string; status: string }>(
        `INSERT INTO public.runner_job (
           application_id, country, flow_key, status, attempts, max_attempts,
           available_at, enqueued_at, metadata
         ) VALUES ($1, 'vietnam', 'vn_prearrival', 'queued', 0, 3, NOW(), NOW(), '{}'::jsonb)
         RETURNING id, status`,
        [applicationId],
      );
      const jobId = queued.rows[0].id;
      fixtureIds.add(jobId);
      expect(queued.rows[0].status).toBe("queued");
      const direct = await query(
        "UPDATE public.runner_job SET status = 'running' WHERE id = $1 RETURNING id",
        [jobId],
      );
      expect(direct.rows).toHaveLength(0);
      const claimed = await query<{ id: string; status: string }>(
        "SELECT id, 'running'::text AS status FROM public.claim_runner_pool_job($1::text, 60000, FALSE, NOW() + INTERVAL '1 day') WHERE id = $2",
        [`runner-fence-claim-guard-${suffix}`, jobId],
      );
      expect(claimed.rows).toEqual([{ id: jobId, status: "running" }]);
    } finally {
      await query("DELETE FROM public.runner_job WHERE application_id = $1", [applicationId]);
      await query("DELETE FROM public.applications WHERE id = $1", [applicationId]);
      await query("DELETE FROM public.applicant_profiles WHERE id = $1", [applicantId]);
      fixtureIds.delete(applicantId);
      fixtureIds.delete(applicationId);
    }
  });

  it("skips staff-review candidates, fences staff requeues, and claims after review clears", async () => {
    const workerId = `runner-fence-review-claim-${Date.now()}`;
    const fixture = await createFixture({ workerId, maxAttempts: 1 });
    try {
      await query(
        "SELECT * FROM public.fail_runner_pool_job($1::uuid, $2::text, 'failed', 1, 'review setup', 0)",
        [fixture.jobId, workerId],
      );
      await query(
        "UPDATE public.runner_job SET status = 'queued' WHERE id = $1",
        [fixture.jobId],
      );
      await query(
        "UPDATE public.applications SET status = 'staff_action_required' WHERE id = $1",
        [fixture.applicationId],
      );

      const skipped = await query(
        "SELECT * FROM public.claim_runner_pool_job($1::text, 60000, FALSE, NOW() + INTERVAL '1 day')",
        [workerId],
      );
      expect(skipped.rows).toHaveLength(0);

      // A staff-review skip must not leave a claim capability behind that a
      // later direct queued -> running update could consume.
      await query(
        "UPDATE public.applications SET status = 'processing' WHERE id = $1",
        [fixture.applicationId],
      );
      const forged = await query(
        "UPDATE public.runner_job SET status = 'running' WHERE id = $1 RETURNING id",
        [fixture.jobId],
      );
      expect(forged.rows).toHaveLength(0);
      await query(
        "UPDATE public.applications SET status = 'staff_action_required' WHERE id = $1",
        [fixture.applicationId],
      );

      await query(
        "UPDATE public.runner_job SET status = 'failed' WHERE id = $1",
        [fixture.jobId],
      );
      await expect(
        query("UPDATE public.runner_job SET status = 'queued' WHERE id = $1", [fixture.jobId]),
      ).rejects.toMatchObject({ code: "55000" });
      const failed = await query<{ status: string }>(
        "SELECT status FROM public.runner_job WHERE id = $1",
        [fixture.jobId],
      );
      expect(failed.rows[0].status).toBe("failed");

      await query(
        "UPDATE public.applications SET status = 'processing' WHERE id = $1",
        [fixture.applicationId],
      );
      await query(
        "UPDATE public.runner_job SET status = 'queued' WHERE id = $1",
        [fixture.jobId],
      );
      const claimed = await query<{ id: string }>(
        "SELECT id FROM public.claim_runner_pool_job($1::text, 60000, FALSE, NOW() + INTERVAL '1 day') WHERE id = $2",
        [workerId, fixture.jobId],
      );
      expect(claimed.rows).toEqual([{ id: fixture.jobId }]);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("rejects a claim that races a held application mutex before consuming capability", async () => {
    const workerId = `runner-fence-review-lock-${Date.now()}`;
    const fixture = await createFixture({ workerId, maxAttempts: 1 });
    const blocker = await pool!.connect();
    const waiter = await pool!.connect();
    try {
      await query(
        "SELECT * FROM public.fail_runner_pool_job($1::uuid, $2::text, 'failed', 1, 'review lock setup', 0)",
        [fixture.jobId, workerId],
      );
      await query(
        "UPDATE public.runner_job SET status = 'queued' WHERE id = $1",
        [fixture.jobId],
      );
      await blocker.query("BEGIN");
      await blocker.query(
        "SELECT id FROM public.applications WHERE id = $1 FOR UPDATE",
        [fixture.applicationId],
      );
      await expect(
        waiter.query(
          "SELECT * FROM public.claim_runner_pool_job($1::text, 60000, FALSE, NOW() + INTERVAL '1 day')",
          [workerId],
        ),
      ).rejects.toMatchObject({ code: "55P03" });
      await blocker.query("COMMIT");
      const unchanged = await query<{ status: string }>(
        "SELECT status FROM public.runner_job WHERE id = $1",
        [fixture.jobId],
      );
      expect(unchanged.rows[0].status).toBe("queued");
      const forged = await query(
        "UPDATE public.runner_job SET status = 'running' WHERE id = $1 RETURNING id",
        [fixture.jobId],
      );
      expect(forged.rows).toHaveLength(0);
    } finally {
      await blocker.query("ROLLBACK").catch(() => undefined);
      blocker.release();
      waiter.release();
      await cleanupFixture(fixture);
    }
  });

  it("cancels runner and legacy transports atomically and leaves the app untouched on conflict", async () => {
    const runnerWorker = `runner-fence-cancel-runner-${Date.now()}`;
    const runner = await createFixture({
      workerId: runnerWorker,
      maxAttempts: 1,
      submissionResult: { keep: true },
      submissionResultStatus: "processing",
    });
    try {
      await query(
        "SELECT * FROM public.fail_runner_pool_job($1::uuid, $2::text, 'failed', 1, 'cancel setup', 0)",
        [runner.jobId, runnerWorker],
      );
      await query("UPDATE public.runner_job SET status = 'queued' WHERE id = $1", [runner.jobId]);
      const cancelled = await query<{ cancelled: boolean; queue_id: string; queue_transport: string }>(
        "SELECT * FROM public.cancel_application_submission($1::uuid, $2::uuid, 'runner_job')",
        [runner.applicationId, runner.jobId],
      );
      expect(cancelled.rows).toEqual([
        { cancelled: true, queue_id: runner.jobId, queue_transport: "runner_job", cancelled_at: expect.any(String) },
      ]);
      const runnerState = await query<{ status: string; app_status: string; submission_result: Record<string, unknown> | null }>(
        `SELECT job.status, application.status AS app_status, application.submission_result
         FROM public.runner_job AS job
         JOIN public.applications AS application ON application.id = job.application_id
         WHERE job.id = $1`,
        [runner.jobId],
      );
      expect(runnerState.rows[0]).toMatchObject({ status: "cancelled", app_status: "draft", submission_result: null });
    } finally {
      await cleanupFixture(runner);
    }

    const legacyWorker = `runner-fence-cancel-legacy-${Date.now()}`;
    const legacy = await createFixture({
      workerId: legacyWorker,
      maxAttempts: 1,
      submissionResult: { keep: true },
      submissionResultStatus: "processing",
    });
    try {
      await query(
        "SELECT * FROM public.fail_runner_pool_job($1::uuid, $2::text, 'failed', 1, 'legacy cancel setup', 0)",
        [legacy.jobId, legacyWorker],
      );
      const queue = await query<{ id: string }>(
        `INSERT INTO public.submission_queue (application_id, status)
         VALUES ($1, 'sgac_live_assisted_pending')
         RETURNING id`,
        [legacy.applicationId],
      );
      const queueId = queue.rows[0].id;
      const cancelled = await query<{ cancelled: boolean; queue_id: string; queue_transport: string }>(
        "SELECT * FROM public.cancel_application_submission($1::uuid, $2::uuid, 'submission_queue')",
        [legacy.applicationId, queueId],
      );
      expect(cancelled.rows).toHaveLength(1);
      expect(cancelled.rows[0]).toMatchObject({ cancelled: true, queue_id: queueId, queue_transport: "submission_queue" });
      const queueState = await query<{ status: string; app_status: string }>(
        `SELECT queue.status, application.status AS app_status
         FROM public.submission_queue AS queue
         JOIN public.applications AS application ON application.id = queue.application_id
         WHERE queue.id = $1`,
        [queueId],
      );
      expect(queueState.rows[0]).toEqual({ status: "sgac_live_assisted_cancelled", app_status: "draft" });

      await query(
        `UPDATE public.applications
         SET status = 'submitted', submission_result = '{"keep":true}'::jsonb,
             submission_result_status = 'submitted'
         WHERE id = $1`,
        [legacy.applicationId],
      );
      const lockedQueue = await query<{ id: string }>(
        `INSERT INTO public.submission_queue (application_id, status, locked_by, locked_at, locked_until)
         VALUES ($1, 'sgac_live_assisted_pending', 'other-worker', NOW(), NOW() + INTERVAL '1 minute')
         RETURNING id`,
        [legacy.applicationId],
      );
      const conflict = await query(
        "SELECT * FROM public.cancel_application_submission($1::uuid, $2::uuid, 'submission_queue')",
        [legacy.applicationId, lockedQueue.rows[0].id],
      );
      expect(conflict.rows).toHaveLength(0);
      const unchanged = await query<{ status: string; submission_result: Record<string, unknown>; submission_result_status: string }>(
        "SELECT status, submission_result, submission_result_status FROM public.applications WHERE id = $1",
        [legacy.applicationId],
      );
      expect(unchanged.rows[0]).toEqual({ status: "submitted", submission_result: { keep: true }, submission_result_status: "submitted" });
    } finally {
      await cleanupFixture(legacy);
    }
  });

  it("claims takeover sessions exactly once and returns zero for conflicts", async () => {
    const workerId = `runner-fence-takeover-claim-${Date.now()}`;
    const fixture = await createFixture({ workerId });
    try {
      const opened = await query<{ takeover_id: string }>(
        "SELECT * FROM public.open_runner_job_takeover($1::uuid, $2::text, $3::uuid, $4::uuid, $5::text, $6::text, NULL)",
        [fixture.jobId, workerId, fixture.applicationId, fixture.applicantId, "claim test", "wss://runner.invalid/debug"],
      );
      const takeoverId = opened.rows[0].takeover_id;
      const first = await query(
        "SELECT * FROM public.claim_takeover_session($1::uuid, $2::uuid, NULL::text)",
        [takeoverId, fixture.applicantId],
      );
      expect(first.rows).toEqual([
        { claimed: true, job_id: fixture.jobId, application_id: fixture.applicationId, handoff_kind: null },
      ]);
      const retry = await query(
        "SELECT * FROM public.claim_takeover_session($1::uuid, $2::uuid, NULL::text)",
        [takeoverId, fixture.applicantId],
      );
      expect(retry.rows).toEqual(first.rows);
      const wrongClaimant = await query(
        "SELECT * FROM public.claim_takeover_session($1::uuid, $2::uuid, NULL::text)",
        [takeoverId, fixture.applicationId],
      );
      expect(wrongClaimant.rows).toHaveLength(0);
      const actions = await query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM public.takeover_action_log WHERE takeover_id = $1",
        [takeoverId],
      );
      expect(actions.rows[0].count).toBe("2");
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("settles takeovers atomically, rejects conflicts, and rolls back invalid input", async () => {
    const workerId = `runner-fence-takeover-settle-${Date.now()}`;
    const fixture = await createFixture({ workerId });
    try {
      const opened = await query<{ takeover_id: string }>(
        "SELECT * FROM public.open_runner_job_takeover($1::uuid, $2::text, $3::uuid, $4::uuid, $5::text, $6::text, NULL)",
        [fixture.jobId, workerId, fixture.applicationId, fixture.applicantId, "settle test", "wss://runner.invalid/debug"],
      );
      expect(opened.rows).toHaveLength(1);
      const takeoverId = opened.rows[0].takeover_id;
      const claimed = await query(
        "SELECT * FROM public.claim_takeover_session($1::uuid, $2::uuid, NULL::text)",
        [takeoverId, fixture.applicantId],
      );
      expect(claimed.rows).toEqual([
        { claimed: true, job_id: fixture.jobId, application_id: fixture.applicationId, handoff_kind: null },
      ]);
      const settled = await query<{ settled: boolean; job_id: string; application_id: string; job_status: string }>(
        "SELECT * FROM public.settle_runner_job_takeover($1::uuid, $2::uuid, 'completed', $3::text, $4::jsonb)",
        [takeoverId, fixture.applicantId, "completed by test", { surname: "CHEN", given_name: "TEST" }],
      );
      expect(settled.rows).toEqual([
        { settled: true, job_id: fixture.jobId, application_id: fixture.applicationId, job_status: "succeeded" },
      ]);
      const finalState = await query<{ session_status: string; job_status: string; actions: string }>(
        `SELECT session.status AS session_status, job.status AS job_status,
                (SELECT COUNT(*)::text FROM public.takeover_action_log WHERE takeover_id = session.id) AS actions
         FROM public.takeover_session AS session
         JOIN public.runner_job AS job ON job.id = session.job_id
         WHERE session.id = $1`,
        [takeoverId],
      );
      expect(finalState.rows[0]).toEqual({ session_status: "completed", job_status: "succeeded", actions: "2" });
      const answers = await query<{ field_name: string; value_text: string }>(
        "SELECT field_name, value_text FROM public.visa_application_answers WHERE application_id = $1 ORDER BY field_name",
        [fixture.applicationId],
      );
      expect(answers.rows).toEqual([
        { field_name: "given_name", value_text: "TEST" },
        { field_name: "surname", value_text: "CHEN" },
      ]);

      const conflict = await query(
        "SELECT * FROM public.settle_runner_job_takeover($1::uuid, $2::uuid, 'abandoned', NULL, '{}'::jsonb)",
        [takeoverId, fixture.applicantId],
      );
      expect(conflict.rows).toHaveLength(0);
      const actionCount = await query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM public.takeover_action_log WHERE takeover_id = $1",
        [takeoverId],
      );
      expect(actionCount.rows[0].count).toBe("2");
    } finally {
      await cleanupFixture(fixture);
    }

    const rollbackWorker = `runner-fence-takeover-rollback-${Date.now()}`;
    const rollbackFixture = await createFixture({ workerId: rollbackWorker });
    try {
      const opened = await query<{ takeover_id: string }>(
        "SELECT * FROM public.open_runner_job_takeover($1::uuid, $2::text, $3::uuid, $4::uuid, $5::text, $6::text, NULL)",
        [rollbackFixture.jobId, rollbackWorker, rollbackFixture.applicationId, rollbackFixture.applicantId, "rollback test", "wss://runner.invalid/debug"],
      );
      const takeoverId = opened.rows[0].takeover_id;
      await query(
        "SELECT * FROM public.claim_takeover_session($1::uuid, $2::uuid, NULL::text)",
        [takeoverId, rollbackFixture.applicantId],
      );
      const actorMismatch = await query(
        "SELECT * FROM public.settle_runner_job_takeover($1::uuid, $2::uuid, 'completed', NULL, $3::jsonb)",
        [takeoverId, rollbackFixture.applicationId, { mismatch: "must not write" }],
      );
      expect(actorMismatch.rows).toHaveLength(0);
      await expect(
        query(
          "SELECT * FROM public.settle_runner_job_takeover($1::uuid, $2::uuid, 'abandoned', NULL, $3::jsonb)",
          [takeoverId, rollbackFixture.applicantId, { stray: "answer" }],
        ),
      ).rejects.toMatchObject({ code: "22023" });
      await expect(
        query(
          "SELECT * FROM public.settle_runner_job_takeover($1::uuid, $2::uuid, 'completed', $3::text, $4::jsonb)",
          [takeoverId, rollbackFixture.applicantId, "x".repeat(4001), { answer: "value" }],
        ),
      ).rejects.toMatchObject({ code: "22023" });
      const unchanged = await query<{ session_status: string; job_status: string; actions: string }>(
        `SELECT session.status AS session_status, job.status AS job_status,
                (SELECT COUNT(*)::text FROM public.takeover_action_log WHERE takeover_id = session.id) AS actions
         FROM public.takeover_session AS session
         JOIN public.runner_job AS job ON job.id = session.job_id
         WHERE session.id = $1`,
        [takeoverId],
      );
      expect(unchanged.rows[0]).toEqual({ session_status: "claimed", job_status: "needs_human", actions: "2" });
      const answerCount = await query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM public.visa_application_answers WHERE application_id = $1",
        [rollbackFixture.applicationId],
      );
      expect(answerCount.rows[0].count).toBe("0");
    } finally {
      await cleanupFixture(rollbackFixture);
    }
  });

  it("pauses application, legacy queue, and runner transports in one transaction", async () => {
    const workerId = `runner-fence-pause-atomic-${Date.now()}`;
    const fixture = await createFixture({ workerId });
    try {
      const legacy = await query<{ id: string }>(
        `INSERT INTO public.submission_queue (application_id, status)
         VALUES ($1, 'sgac_live_assisted_pending')
         RETURNING id`,
        [fixture.applicationId],
      );
      const paused = await query<{ pause_runner_jobs_for_review: number }>(
        "SELECT public.pause_runner_jobs_for_review($1::uuid, $2::text)",
        [fixture.applicationId, "face-match review"],
      );
      expect(paused.rows[0].pause_runner_jobs_for_review).toBe(2);
      const state = await query<{ app_status: string; queue_status: string; paused_reason: string; job_status: string }>(
        `SELECT application.status AS app_status,
                queue.status AS queue_status,
                queue.paused_reason,
                job.status AS job_status
         FROM public.applications AS application
         JOIN public.submission_queue AS queue ON queue.application_id = application.id
         JOIN public.runner_job AS job ON job.application_id = application.id
         WHERE application.id = $1 AND queue.id = $2 AND job.id = $3`,
        [fixture.applicationId, legacy.rows[0].id, fixture.jobId],
      );
      expect(state.rows[0]).toEqual({
        app_status: "staff_action_required",
        queue_status: "paused",
        paused_reason: "face-match review",
        job_status: "paused",
      });
    } finally {
      await query("DELETE FROM public.submission_queue WHERE application_id = $1", [fixture.applicationId]);
      await cleanupFixture(fixture);
    }
  });

  it("blocks direct requeues, permits policy-checked retries, and quarantines exhausted work", async () => {
    const workerId = `runner-fence-requeue-${Date.now()}`;
    const fixture = await createFixture({ workerId, maxAttempts: 3 });
    try {
      await query(
        "SELECT * FROM public.fail_runner_pool_job($1::uuid, $2::text, 'failed', 1, 'retry me', 0)",
        [fixture.jobId, workerId],
      );
      const direct = await query(
        "UPDATE public.runner_job SET status = 'queued' WHERE id = $1 RETURNING id",
        [fixture.jobId],
      );
      expect(direct.rows).toHaveLength(0);
      const stillFailed = await query<{ status: string }>(
        "SELECT status FROM public.runner_job WHERE id = $1",
        [fixture.jobId],
      );
      expect(stillFailed.rows[0].status).toBe("failed");

      const requeued = await query<{ requeue_runner_job: boolean }>(
        "SELECT public.requeue_runner_job($1::uuid)",
        [fixture.jobId],
      );
      expect(requeued.rows[0].requeue_runner_job).toBe(true);
      const queued = await query<{ status: string; attempts: number; leased_by: string | null; started_at: string | null; finished_at: string | null }>(
        "SELECT status, attempts, leased_by, started_at, finished_at FROM public.runner_job WHERE id = $1",
        [fixture.jobId],
      );
      expect(queued.rows[0]).toMatchObject({ status: "queued", attempts: 1, leased_by: null, started_at: null, finished_at: null });

      await query("UPDATE public.runner_job SET status = 'failed', last_error = $2 WHERE id = $1", [fixture.jobId, "quarantined by test"]);
      const quarantined = await query<{ requeue_runner_job: boolean }>(
        "SELECT public.requeue_runner_job($1::uuid)",
        [fixture.jobId],
      );
      expect(quarantined.rows[0].requeue_runner_job).toBe(false);
    } finally {
      await cleanupFixture(fixture);
    }

    const exhaustedWorker = `runner-fence-requeue-exhausted-${Date.now()}`;
    const exhausted = await createFixture({ workerId: exhaustedWorker, maxAttempts: 1 });
    try {
      await query(
        "SELECT * FROM public.fail_runner_pool_job($1::uuid, $2::text, 'failed', 1, 'exhausted', 0)",
        [exhausted.jobId, exhaustedWorker],
      );
      const result = await query<{ requeue_runner_job: boolean }>(
        "SELECT public.requeue_runner_job($1::uuid)",
        [exhausted.jobId],
      );
      expect(result.rows[0].requeue_runner_job).toBe(false);
    } finally {
      await cleanupFixture(exhausted);
    }
  });

  it("rejects malformed queued inserts and excludes exhausted queued claims", async () => {
    const workerId = `runner-fence-queued-guard-${Date.now()}`;
    const fixture = await createFixture({ workerId });
    try {
      await expect(
        query(
          `INSERT INTO public.runner_job (
             application_id, country, flow_key, status, attempts, max_attempts,
             available_at, leased_by
           ) VALUES ($1, 'vietnam', 'vn_prearrival', 'queued', 3, 3, NOW(), 'forged')`,
          [fixture.applicationId],
        ),
      ).rejects.toMatchObject({ code: "23514" });

      const adjuster = await pool!.connect();
      try {
        await adjuster.query("BEGIN");
        await adjuster.query("SET LOCAL session_replication_role = 'replica'");
        await adjuster.query(
          "UPDATE public.runner_job SET status = 'queued', attempts = max_attempts, leased_by = NULL, leased_until = NULL, started_at = NULL, finished_at = NULL WHERE id = $1",
          [fixture.jobId],
        );
        await adjuster.query("COMMIT");
      } finally {
        await adjuster.query("ROLLBACK").catch(() => undefined);
        adjuster.release();
      }
      const claim = await query(
        "SELECT * FROM public.claim_runner_pool_job($1::text, 60000, FALSE, NOW() + INTERVAL '1 day')",
        [workerId],
      );
      expect(claim.rows).toHaveLength(0);
      const state = await query<{ status: string; attempts: number }>(
        "SELECT status, attempts FROM public.runner_job WHERE id = $1",
        [fixture.jobId],
      );
      expect(state.rows[0]).toEqual({ status: "queued", attempts: 3 });
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("gates the application-first enqueue/pause race on the explicit local database marker", async () => {
    const fixture = await createFixture({ workerId: `runner-fence-pause-race-${Date.now()}` });
    try {
      await query(
        "UPDATE public.applications SET status = 'staff_action_required' WHERE id = $1",
        [fixture.applicationId],
      );
      const blocker = await pool!.connect();
      const pauseClient = await pool!.connect();
      const enqueueClient = await pool!.connect();
      try {
        await blocker.query("BEGIN");
        await blocker.query(
          "SELECT id FROM public.applications WHERE id = $1 FOR UPDATE",
          [fixture.applicationId],
        );
        const pausePending = pauseClient.query<{ pause_runner_jobs_for_review: number }>(
          "SELECT public.pause_runner_jobs_for_review($1::uuid, $2::text)",
          [fixture.applicationId, "synthetic staff review race"],
        );
        const enqueuePending = enqueueClient.query(
          "SELECT * FROM public.enqueue_runner_pool_job($1::uuid, 'vietnam', 'vn_prearrival', NOW(), 3, NULL, '{}'::jsonb, NOW())",
          [fixture.applicationId],
        );
        await sleep(100);
        await blocker.query("COMMIT");
        const [pauseResult, enqueueResult] = await Promise.allSettled([
          pausePending,
          enqueuePending,
        ]);
        expect(pauseResult.status).toBe("fulfilled");
        expect(enqueueResult.status).toBe("rejected");
        if (enqueueResult.status === "rejected") {
          expect(enqueueResult.reason).toMatchObject({ code: "55000" });
        }
      } finally {
        await blocker.query("ROLLBACK").catch(() => undefined);
        blocker.release();
        pauseClient.release();
        enqueueClient.release();
      }
      const paused = await query<{ status: string }>(
        "SELECT status FROM public.runner_job WHERE id = $1",
        [fixture.jobId],
      );
      expect(paused.rows[0].status).toBe("paused");
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("enqueues and claims the Taiwan tuple, then clears started_at on retry", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const applicant = await query<{ id: string }>(
      `INSERT INTO public.applicant_profiles (email, full_name)
       VALUES ($1, 'Taiwan enqueue fixture') RETURNING id`,
      [`runner-fence-tw-enqueue-${suffix}@invalid.test`],
    );
    const application = await query<{ id: string }>(
      `INSERT INTO public.applications (applicant_id, country, visa_type, status)
       VALUES ($1, 'taiwan', 'tw_entry_permit', 'processing') RETURNING id`,
      [applicant.rows[0].id],
    );
    let fixture: Fixture | undefined;
    try {
      const enqueued = await query<{ runner_job_id: string }>(
        `SELECT * FROM public.enqueue_runner_pool_job(
           $1::uuid, 'taiwan', 'tw_entry_permit', NOW(), 3, NULL, '{}'::jsonb, NOW()
         )`,
        [application.rows[0].id],
      );
      expect(enqueued.rows).toHaveLength(1);
      fixture = {
        applicantId: applicant.rows[0].id,
        applicationId: application.rows[0].id,
        jobId: enqueued.rows[0].runner_job_id,
      };
      fixtureIds.add(fixture.jobId);
      fixtureIds.add(fixture.applicationId);
      fixtureIds.add(fixture.applicantId);
      const workerId = `runner-fence-tw-enqueue-worker-${suffix}`;
      const claimed = await query<{ id: string; country: string; flow_key: string }>(
        "SELECT id, country, flow_key FROM public.claim_runner_pool_job($1::text, 60000, FALSE, NOW())",
        [workerId],
      );
      expect(claimed.rows).toEqual([
        { id: fixture.jobId, country: "taiwan", flow_key: "tw_entry_permit" },
      ]);
      const failed = await query(
        "SELECT * FROM public.fail_runner_pool_job($1::uuid, $2::text, 'queued', 1, 'retry', 0)",
        [fixture.jobId, workerId],
      );
      expect(failed.rows).toHaveLength(1);
      const row = await query<{ status: string; started_at: string | null; finished_at: string | null }>(
        "SELECT status, started_at, finished_at FROM public.runner_job WHERE id = $1",
        [fixture.jobId],
      );
      expect(row.rows[0]).toEqual({ status: "queued", started_at: null, finished_at: null });
    } finally {
      if (fixture) await cleanupFixture(fixture);
    }
  });

  it("serializes Taiwan opens, never supersedes a claimed session, and rejects a different job", async () => {
    const workerId = `runner-fence-tw-open-${Date.now()}`;
    const fixture = await createTaiwanFixture({ workerId });
    const other = await createTaiwanFixture({ workerId: `${workerId}-other` });
    try {
      const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
      const stopped = { country: "TW", status: "stopped_at_captcha", portalUrl: "https://nia.invalid" };
      const openArgs = [fixture.jobId, workerId, fixture.applicationId, fixture.applicantId, "bb-session", "https://live.invalid/view", expiresAt, stopped];
      const opened = await query<{ opened: boolean; takeover_id: string }>(
        "SELECT * FROM public.open_tw_applicant_handoff($1::uuid, $2::text, $3::uuid, $4::uuid, $5::text, $6::text, $7::timestamptz, $8::jsonb)",
        openArgs,
      );
      expect(opened.rows).toHaveLength(1);
      expect(opened.rows[0].opened).toBe(true);
      const takeoverId = opened.rows[0].takeover_id;

      const concurrent = await Promise.all([
        query<{ opened: boolean; takeover_id: string }>(
          "SELECT * FROM public.open_tw_applicant_handoff($1::uuid, $2::text, $3::uuid, $4::uuid, $5::text, $6::text, $7::timestamptz, $8::jsonb)",
          openArgs,
        ),
        query<{ opened: boolean; takeover_id: string }>(
          "SELECT * FROM public.open_tw_applicant_handoff($1::uuid, $2::text, $3::uuid, $4::uuid, $5::text, $6::text, $7::timestamptz, $8::jsonb)",
          openArgs,
        ),
      ]);
      expect(concurrent.flatMap((result) => result.rows)).toHaveLength(2);
      expect(concurrent.flatMap((result) => result.rows).map((row) => row.takeover_id)).toEqual([takeoverId, takeoverId]);
      const openActions = await query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM public.takeover_action_log WHERE takeover_id = $1 AND action = 'open'",
        [takeoverId],
      );
      expect(openActions.rows[0].count).toBe("1");

      const claimed = await query<{ claimed: boolean; vnc_url: string }>(
        "SELECT * FROM public.claim_tw_applicant_handoff($1::uuid, $2::uuid, $3::uuid)",
        [takeoverId, fixture.applicationId, fixture.applicantId],
      );
      expect(claimed.rows).toHaveLength(1);
      expect(claimed.rows[0]).toMatchObject({ claimed: true, vnc_url: "https://live.invalid/view" });
      const claimedReopen = await query<{ opened: boolean; takeover_id: string }>(
        "SELECT * FROM public.open_tw_applicant_handoff($1::uuid, $2::text, $3::uuid, $4::uuid, $5::text, $6::text, $7::timestamptz, $8::jsonb)",
        openArgs,
      );
      expect(claimedReopen.rows).toEqual([
        expect.objectContaining({ opened: true, takeover_id: takeoverId }),
      ]);

      // The partial unique index permits only one active row per application;
      // close the first handoff before modelling an orphaned active session
      // left by an older terminal job. The open RPC must still fail closed on
      // the exact job mismatch rather than reusing that session.
      await query(
        "UPDATE public.takeover_session SET status = 'abandoned', closed_at = NOW() WHERE id = $1",
        [takeoverId],
      );
      await query(
        `INSERT INTO public.takeover_session (
           job_id, application_id, applicant_id, status, reason,
           remote_debug_url, vnc_url, handoff_kind, expires_at
         ) VALUES ($1, $2, $3, 'queued', 'different job', 'browserbase-session:other',
           'https://live.invalid/other', 'taiwan_applicant_final_submit', $4)`,
        [other.jobId, fixture.applicationId, fixture.applicantId, expiresAt],
      );
      const blocked = await query(
        "SELECT * FROM public.open_tw_applicant_handoff($1::uuid, $2::text, $3::uuid, $4::uuid, $5::text, $6::text, $7::timestamptz, $8::jsonb)",
        openArgs,
      );
      expect(blocked.rows).toHaveLength(0);
    } finally {
      await cleanupFixture(fixture);
      await cleanupFixture(other);
    }
  });

  it("fences Taiwan claim and settlement ownership, receipt evidence, expiry, and generic operator paths", async () => {
    const workerId = `runner-fence-tw-settle-${Date.now()}`;
    const fixture = await createTaiwanFixture({ workerId });
    try {
      const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
      const stopped = { country: "TW", status: "stopped_at_captcha" };
      const opened = await query<{ takeover_id: string }>(
        "SELECT * FROM public.open_tw_applicant_handoff($1::uuid, $2::text, $3::uuid, $4::uuid, $5::text, $6::text, $7::timestamptz, $8::jsonb)",
        [fixture.jobId, workerId, fixture.applicationId, fixture.applicantId, "bb-session-settle", "https://live.invalid/settle", expiresAt, stopped],
      );
      const takeoverId = opened.rows[0].takeover_id;
      const wrongApplicant = await query(
        "SELECT * FROM public.claim_tw_applicant_handoff($1::uuid, $2::uuid, $3::uuid)",
        [takeoverId, fixture.applicationId, fixture.applicationId],
      );
      expect(wrongApplicant.rows).toHaveLength(0);
      const claimed = await query(
        "SELECT * FROM public.claim_tw_applicant_handoff($1::uuid, $2::uuid, $3::uuid)",
        [takeoverId, fixture.applicationId, fixture.applicantId],
      );
      expect(claimed.rows[0].claimed).toBe(true);

      const genericClaim = await query(
        "SELECT * FROM public.claim_takeover_session($1::uuid, $2::uuid, 'taiwan_applicant_final_submit')",
        [takeoverId, fixture.applicantId],
      );
      expect(genericClaim.rows).toHaveLength(0);
      const genericSettle = await query(
        "SELECT * FROM public.settle_runner_job_takeover($1::uuid, $2::uuid, 'abandoned', NULL, '{}'::jsonb)",
        [takeoverId, fixture.applicantId],
      );
      expect(genericSettle.rows).toHaveLength(0);

      await expect(
        query(
          "SELECT * FROM public.settle_tw_applicant_handoff($1::uuid, $2::uuid, $3::text, 'completed', $4::jsonb)",
          [takeoverId, fixture.jobId, `${workerId}-stale`, { country: "TW", status: "submitted" }],
        ),
      ).resolves.toMatchObject({ rows: [] });
      await expect(
        query(
          "SELECT * FROM public.settle_tw_applicant_handoff($1::uuid, $2::uuid, $3::text, 'completed', $4::jsonb)",
          [takeoverId, fixture.jobId, workerId, { country: "TW", status: "submitted" }],
        ),
      ).rejects.toMatchObject({ code: "22023" });
      const unchanged = await query<{ app_status: string; session_status: string; job_status: string }>(
        `SELECT application.submission_result_status AS app_status,
                session.status AS session_status, job.status AS job_status
         FROM public.applications AS application
         JOIN public.takeover_session AS session ON session.application_id = application.id
         JOIN public.runner_job AS job ON job.id = session.job_id
         WHERE application.id = $1 AND session.id = $2`,
        [fixture.applicationId, takeoverId],
      );
      expect(unchanged.rows[0]).toEqual({ app_status: "needs_user_action", session_status: "claimed", job_status: "running" });

      const receipt = {
        country: "TW",
        status: "submitted",
        officialReceipt: {
          source: "official_success_page_with_application_number",
          capturedAt: new Date().toISOString(),
          portalUrl: "https://nia.invalid/success",
          caseNumber: "TW20260801ABC123",
          confirmationText: "送出成功",
        },
      };
      const completed = await query<{ settled: boolean; handoff_status: string }>(
        "SELECT * FROM public.settle_tw_applicant_handoff($1::uuid, $2::uuid, $3::text, 'completed', $4::jsonb)",
        [takeoverId, fixture.jobId, workerId, receipt],
      );
      expect(completed.rows).toEqual([{ settled: true, job_id: fixture.jobId, application_id: fixture.applicationId, handoff_status: "completed" }]);
      const state = await query<{ app_status: string; session_status: string; job_status: string }>(
        `SELECT application.submission_result_status AS app_status,
                session.status AS session_status, job.status AS job_status
         FROM public.applications AS application
         JOIN public.takeover_session AS session ON session.application_id = application.id
         JOIN public.runner_job AS job ON job.id = session.job_id
         WHERE application.id = $1 AND session.id = $2`,
        [fixture.applicationId, takeoverId],
      );
      expect(state.rows[0]).toEqual({ app_status: "completed", session_status: "completed", job_status: "running" });
    } finally {
      await cleanupFixture(fixture);
    }

    const expiredWorker = `runner-fence-tw-expired-${Date.now()}`;
    const expired = await createTaiwanFixture({ workerId: expiredWorker });
    try {
      const expiredAt = new Date(Date.now() - 1_000).toISOString();
      const opened = await query<{ takeover_id: string }>(
        "SELECT * FROM public.open_tw_applicant_handoff($1::uuid, $2::text, $3::uuid, $4::uuid, $5::text, $6::text, $7::timestamptz, $8::jsonb)",
        [expired.jobId, expiredWorker, expired.applicationId, expired.applicantId, "bb-session-expired", "https://live.invalid/expired", new Date(Date.now() + 60_000).toISOString(), { country: "TW", status: "stopped_at_captcha" }],
      );
      const takeoverId = opened.rows[0].takeover_id;
      await query("UPDATE public.takeover_session SET expires_at = $2 WHERE id = $1", [takeoverId, expiredAt]);
      const abandoned = await query<{ settled: boolean; handoff_status: string }>(
        "SELECT * FROM public.settle_tw_applicant_handoff($1::uuid, $2::uuid, $3::text, 'abandoned', NULL)",
        [takeoverId, expired.jobId, expiredWorker],
      );
      expect(abandoned.rows).toEqual([{ settled: true, job_id: expired.jobId, application_id: expired.applicationId, handoff_status: "abandoned" }]);
      const state = await query<{ app_status: string; session_status: string; job_status: string }>(
        `SELECT application.submission_result_status AS app_status,
                session.status AS session_status, job.status AS job_status
         FROM public.applications AS application
         JOIN public.takeover_session AS session ON session.application_id = application.id
         JOIN public.runner_job AS job ON job.id = session.job_id
         WHERE application.id = $1 AND session.id = $2`,
        [expired.applicationId, takeoverId],
      );
      expect(state.rows[0]).toEqual({ app_status: "needs_user_action", session_status: "abandoned", job_status: "running" });
    } finally {
      await cleanupFixture(expired);
    }
  });
});

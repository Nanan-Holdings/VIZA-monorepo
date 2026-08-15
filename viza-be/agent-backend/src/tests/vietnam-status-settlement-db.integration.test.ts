import { Pool, type PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const confirm = process.env.RUNNER_FENCE_DB_CONFIRM === "local-test";
const databaseUrl = process.env.RUNNER_FENCE_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
const marker = (process.env.RUNNER_FENCE_DB_NONPRODUCTION ?? "").toLowerCase();
const localHost = (() => {
  try {
    const host = new URL(databaseUrl).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "supabase";
  } catch {
    return false;
  }
})();
const liveGateEnabled = Boolean(
  databaseUrl &&
    confirm &&
    localHost &&
    ["1", "true", "local", "local-test", "non-production"].includes(marker),
);

type CheckFixture = {
  applicantId: string;
  applicationId: string;
  checkId: string;
  authUserId: string;
};

let pool: Pool | undefined;
let lockClient: PoolClient | undefined;
const fixtureIds = new Set<string>();

const query = async <T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string,
  values: unknown[] = [],
) => {
  if (!pool) throw new Error("Vietnam settlement integration pool is not initialized");
  return pool.query<T>(sql, values);
};

const createFixture = async (): Promise<CheckFixture> => {
  const authUserId = randomUUID();
  const applicant = await query<{ id: string }>(
    `INSERT INTO public.applicant_profiles (auth_user_id, email, full_name, language_pref)
     VALUES ($1, $2, 'VN settlement fixture', 'en') RETURNING id`,
    [authUserId, `vn-settlement-${Date.now()}-${Math.random().toString(16).slice(2)}@invalid.test`],
  );
  const applicantId = applicant.rows[0].id;
  const application = await query<{ id: string }>(
    `INSERT INTO public.applications
       (applicant_id, country, visa_type, status, external_reference, submission_result_status)
     VALUES ($1, 'vietnam', 'vn_prearrival', 'processing', 'DB-REGISTRATION', 'waiting') RETURNING id`,
    [applicantId],
  );
  const applicationId = application.rows[0].id;
  await query(
    `INSERT INTO public.official_application_tracking
       (application_id, applicant_id, auth_user_id, country_code, provider,
        official_lookup_email, daily_check_hour, daily_check_minute,
        next_daily_check_at)
     VALUES ($1, $2, $3, 'VN', 'vietnam_evisa', 'vn-fixture@invalid.test', 0, 0, NOW())`,
    [applicationId, applicantId, authUserId],
  );
  const check = await query<{ id: string }>(
    `INSERT INTO public.official_status_checks
       (application_id, user_id, country_code, provider, status, scheduled_for,
        raw_status_json)
     VALUES ($1, $2, 'VN', 'vietnam_evisa', 'queued', NOW(), '{}'::jsonb)
     RETURNING id`,
    [applicationId, authUserId],
  );
  const checkId = check.rows[0].id;
  fixtureIds.add(applicantId);
  fixtureIds.add(applicationId);
  fixtureIds.add(checkId);
  return { applicantId, applicationId, checkId, authUserId };
};

const claim = async (fixture: CheckFixture, workerId: string, leaseSeconds = 300) =>
  query<{ id: string; lease_generation: string | number; lease_expires_at: string }>(
    `SELECT id, lease_generation, lease_expires_at
       FROM public.claim_vn_official_status_checks($1::text, 1, $2::integer)
      WHERE id = $3`,
    [workerId, leaseSeconds, fixture.checkId],
  );

const cleanup = async (fixture: CheckFixture): Promise<void> => {
  await query("DELETE FROM public.official_status_checks WHERE application_id = $1", [fixture.applicationId]);
  await query("DELETE FROM public.official_application_tracking WHERE application_id = $1", [fixture.applicationId]);
  await query("DELETE FROM public.applications WHERE id = $1", [fixture.applicationId]);
  await query("DELETE FROM public.applicant_profiles WHERE id = $1", [fixture.applicantId]);
};

describe.skipIf(!liveGateEnabled)("Vietnam official status settlement fence (gated local PG)", () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl, max: 8 });
    const probe = await pool.query<{ environment: string | null }>(
      "SELECT current_setting('app.viza_environment', true) AS environment",
    );
    expect(["local", "local-test", "test", "development"]).toContain(
      probe.rows[0]?.environment?.toLowerCase(),
    );
    lockClient = await pool.connect();
    await lockClient.query("SELECT pg_advisory_lock(hashtext('viza-vn-status-settlement-integration'))");
  });

  afterAll(async () => {
    if (lockClient) {
      await lockClient.query("SELECT pg_advisory_unlock(hashtext('viza-vn-status-settlement-integration'))").catch(() => undefined);
      lockClient.release();
    }
    await pool?.end();
    pool = undefined;
  });

  it("claims with limit one and increments generation on reclaim", async () => {
    const fixture = await createFixture();
    try {
      const first = await claim(fixture, "vn-fence-worker-a");
      expect(first.rows).toHaveLength(1);
      const firstGeneration = Number(first.rows[0].lease_generation);
      await query("UPDATE public.official_status_checks SET lease_expires_at = clock_timestamp() - INTERVAL '1 second' WHERE id = $1", [fixture.checkId]);
      const second = await claim(fixture, "vn-fence-worker-b");
      expect(second.rows).toHaveLength(1);
      expect(Number(second.rows[0].lease_generation)).toBe(firstGeneration + 1);
    } finally {
      await cleanup(fixture);
    }
  });

  it("rejects wrong worker and stale generation without side effects", async () => {
    const fixture = await createFixture();
    try {
      const workerId = "vn-fence-owner";
      const claimed = await claim(fixture, workerId);
      const generation = Number(claimed.rows[0].lease_generation);
      const wrong = await query("SELECT * FROM public.renew_vn_official_status_check($1, 'wrong-worker', $2, 60)", [fixture.checkId, generation]);
      expect(wrong.rows).toHaveLength(0);
      const stale = await query("SELECT * FROM public.renew_vn_official_status_check($1, $2, $3, 60)", [fixture.checkId, workerId, generation - 1]);
      expect(stale.rows).toHaveLength(0);
      const row = await query<{ status: string; worker_id: string; lease_generation: string }>("SELECT status, worker_id, lease_generation FROM public.official_status_checks WHERE id = $1", [fixture.checkId]);
      expect(row.rows[0]).toMatchObject({ status: "running", worker_id: workerId, lease_generation: String(generation) });
    } finally {
      await cleanup(fixture);
    }
  });

  it("settles a completed result once and is idempotent on retry", async () => {
    const fixture = await createFixture();
    try {
      const workerId = "vn-fence-complete";
      const claimed = await claim(fixture, workerId);
      const generation = Number(claimed.rows[0].lease_generation);
      const payload = {
        status: "completed",
        official_reference: "VN-2026-TEST",
        official_status: "approved",
        result_status: "approved",
        application_url: `https://portal.invalid/client/status?applicationId=${fixture.applicationId}`,
        raw_status_json: { source: "integration" },
      };
      const completed = await query<{ complete_vn_official_status_check: boolean }>(
        "SELECT public.complete_vn_official_status_check($1, $2, $3, $4::jsonb)",
        [fixture.checkId, workerId, generation, JSON.stringify(payload)],
      );
      expect(completed.rows[0].complete_vn_official_status_check).toBe(true);
      const duplicate = await query<{ complete_vn_official_status_check: boolean }>(
        "SELECT public.complete_vn_official_status_check($1, $2, $3, $4::jsonb)",
        [fixture.checkId, workerId, generation, JSON.stringify(payload)],
      );
      expect(duplicate.rows[0].complete_vn_official_status_check).toBe(false);
      const events = await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM public.application_events WHERE application_id = $1 AND source = 'vietnam_official_status'", [fixture.applicationId]);
      expect(Number(events.rows[0].count)).toBe(1);
    } finally {
      await cleanup(fixture);
    }
  });

  it("persists deterministic eVisa evidence with registration and visa numbers kept distinct", async () => {
    const fixture = await createFixture();
    try {
      const workerId = "vn-fence-artifact-complete";
      const claimed = await claim(fixture, workerId);
      const generation = Number(claimed.rows[0].lease_generation);
      const sha = "b".repeat(64);
      const storagePath = `submission-artifacts/${fixture.authUserId}/${fixture.applicationId}/VN/evisa-${sha}.pdf`;
      const completed = await query<{ complete_vn_official_status_check: boolean }>(
        "SELECT public.complete_vn_official_status_check($1, $2, $3, $4::jsonb)",
        [
          fixture.checkId,
          workerId,
          generation,
          JSON.stringify({
            status: "completed",
            official_reference: "REGISTRATION-CODE",
            official_status: "approved",
            visa_number: "EVISA-NUMBER",
            application_url: `https://portal.invalid/client/status?applicationId=${fixture.applicationId}`,
            artifact_storage_path: storagePath,
            artifact_sha256: sha,
            raw_status_json: { source: "integration-artifact" },
          }),
        ],
      );
      expect(completed.rows[0].complete_vn_official_status_check).toBe(true);
      const state = await query<{ external_reference: string; result_storage_path: string; status: string }>(
        "SELECT external_reference, result_storage_path, status FROM public.applications WHERE id = $1",
        [fixture.applicationId],
      );
      expect(state.rows[0]).toEqual({ external_reference: "DB-REGISTRATION", result_storage_path: storagePath, status: "approved" });
      const document = await query<{ storage_path: string; metadata: Record<string, unknown> }>(
        "SELECT storage_path, metadata FROM public.application_documents WHERE application_id = $1 AND document_type = 'evisa_pdf'",
        [fixture.applicationId],
      );
      expect(document.rows[0]).toMatchObject({ storage_path: storagePath, metadata: expect.objectContaining({ visa_number: "EVISA-NUMBER" }) });
      const notification = await query<{ payload: Record<string, unknown> }>(
        "SELECT payload FROM public.notification_events WHERE application_id = $1 AND idempotency_key LIKE 'vn-status:%'",
        [fixture.applicationId],
      );
      expect(notification.rows[0].payload).toMatchObject({ application_url: `https://portal.invalid/client/status?applicationId=${fixture.applicationId}` });
    } finally {
      await cleanup(fixture);
    }
  });

  it("keeps a legacy artifact path document-ready when no new upload is supplied", async () => {
    const fixture = await createFixture();
    try {
      const legacyPath = "legacy-submission-artifacts/vn-existing.pdf";
      await query("UPDATE public.applications SET result_storage_path = $2 WHERE id = $1", [fixture.applicationId, legacyPath]);
      await query("UPDATE public.official_application_tracking SET last_artifact_storage_path = $2, last_artifact_hash = NULL WHERE application_id = $1", [fixture.applicationId, legacyPath]);
      const workerId = "vn-fence-legacy-artifact";
      const claimed = await claim(fixture, workerId);
      const generation = Number(claimed.rows[0].lease_generation);
      const result = await query<{ complete_vn_official_status_check: boolean }>(
        "SELECT public.complete_vn_official_status_check($1, $2, $3, $4::jsonb)",
        [fixture.checkId, workerId, generation, JSON.stringify({ status: "completed", official_status: "approved", application_url: `https://portal.invalid/client/status?applicationId=${fixture.applicationId}` })],
      );
      expect(result.rows[0].complete_vn_official_status_check).toBe(true);
      const state = await query<{ result_status: string; result_storage_path: string; tracking_status: string }>(
        `SELECT application.result_status, application.result_storage_path, tracking.tracking_status
           FROM public.applications application
           JOIN public.official_application_tracking tracking ON tracking.application_id = application.id
          WHERE application.id = $1`,
        [fixture.applicationId],
      );
      expect(state.rows[0]).toEqual({ result_status: "approved", result_storage_path: legacyPath, tracking_status: "completed" });
    } finally {
      await cleanup(fixture);
    }
  });

  it("rejects non-deterministic artifact paths and rolls back all writes", async () => {
    const fixture = await createFixture();
    try {
      const workerId = "vn-fence-artifact";
      const claimed = await claim(fixture, workerId);
      const generation = Number(claimed.rows[0].lease_generation);
      await expect(
        query(
          "SELECT public.complete_vn_official_status_check($1, $2, $3, $4::jsonb)",
          [fixture.checkId, workerId, generation, JSON.stringify({ status: "completed", official_status: "approved", result_status: "approved", application_url: `https://portal.invalid/client/status?applicationId=${fixture.applicationId}`, artifact_storage_path: "submission-artifacts/not-deterministic.pdf", artifact_sha256: "a".repeat(64) })],
        ),
      ).rejects.toMatchObject({ code: "22023" });
      const row = await query<{ status: string; completed_at: string | null }>("SELECT status, completed_at FROM public.official_status_checks WHERE id = $1", [fixture.checkId]);
      expect(row.rows[0]).toEqual({ status: "running", completed_at: null });
    } finally {
      await cleanup(fixture);
    }
  });

  it("records a bounded failure retry in the same transaction as tracking backoff", async () => {
    const fixture = await createFixture();
    try {
      const workerId = "vn-fence-failure-retry";
      const claimed = await claim(fixture, workerId);
      const generation = Number(claimed.rows[0].lease_generation);
      const failed = await query<{ fail_vn_official_status_check: boolean }>(
        "SELECT public.fail_vn_official_status_check($1, $2, $3, 'portal_timeout', 'bounded failure', '{\"source\":\"integration\"}'::jsonb)",
        [fixture.checkId, workerId, generation],
      );
      expect(failed.rows[0].fail_vn_official_status_check).toBe(true);
      const state = await query<{ status: string; attempts: number; failures: number }>(
        `SELECT checks.status, checks.attempt_count AS attempts,
                tracking.consecutive_failures AS failures
           FROM public.official_status_checks checks
           JOIN public.official_application_tracking tracking ON tracking.application_id = checks.application_id
          WHERE checks.id = $1`,
        [fixture.checkId],
      );
      expect(state.rows[0]).toMatchObject({ status: "failed", failures: 1 });
      const retry = await query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM public.official_status_checks WHERE application_id = $1 AND trigger_source = 'retry' AND idempotency_key LIKE $2",
        [fixture.applicationId, `vn:retry:${fixture.checkId}:%`],
      );
      expect(retry.rows[0].count).toBe("1");
    } finally {
      await cleanup(fixture);
    }
  });

  it("fails closed before application mutation when tracking identity is missing", async () => {
    const fixture = await createFixture();
    try {
      const workerId = "vn-fence-missing-tracking";
      const claimed = await claim(fixture, workerId);
      const generation = Number(claimed.rows[0].lease_generation);
      await query("DELETE FROM public.official_application_tracking WHERE application_id = $1", [fixture.applicationId]);
      const result = await query<{ complete_vn_official_status_check: boolean }>(
        "SELECT public.complete_vn_official_status_check($1, $2, $3, $4::jsonb)",
        [fixture.checkId, workerId, generation, JSON.stringify({ status: "completed", official_status: "rejected", application_url: `https://portal.invalid/client/status?applicationId=${fixture.applicationId}` })],
      );
      expect(result.rows[0].complete_vn_official_status_check).toBe(false);
      const application = await query<{ external_status: string | null; status: string }>("SELECT external_status, status FROM public.applications WHERE id = $1", [fixture.applicationId]);
      expect(application.rows[0]).toEqual({ external_status: null, status: "processing" });
    } finally {
      await cleanup(fixture);
    }
  });

  it("does not emit a duplicate event for an unchanged status without a new artifact", async () => {
    const fixture = await createFixture();
    try {
      const firstWorker = "vn-fence-same-status-a";
      const firstClaim = await claim(fixture, firstWorker);
      const firstGeneration = Number(firstClaim.rows[0].lease_generation);
      await query(
        "SELECT public.complete_vn_official_status_check($1, $2, $3, $4::jsonb)",
        [fixture.checkId, firstWorker, firstGeneration, JSON.stringify({ status: "completed", official_status: "processing", application_url: `https://portal.invalid/client/status?applicationId=${fixture.applicationId}`, raw_status_json: { source: "first" } })],
      );
      const second = await query<{ id: string }>(
        `INSERT INTO public.official_status_checks (application_id, user_id, country_code, provider, status, scheduled_for, raw_status_json)
         VALUES ($1, $2, 'VN', 'vietnam_evisa', 'queued', NOW(), '{}'::jsonb) RETURNING id`,
        [fixture.applicationId, fixture.authUserId],
      );
      const secondId = second.rows[0].id;
      const secondClaim = await query<{ lease_generation: string | number }>(
        `SELECT lease_generation FROM public.claim_vn_official_status_checks('vn-fence-same-status-b', 1, 300) WHERE id = $1`,
        [secondId],
      );
      await query(
        "SELECT public.complete_vn_official_status_check($1, 'vn-fence-same-status-b', $2, $3::jsonb)",
        [secondId, Number(secondClaim.rows[0].lease_generation), JSON.stringify({ status: "completed", official_status: "processing", application_url: `https://portal.invalid/client/status?applicationId=${fixture.applicationId}`, raw_status_json: { source: "second" } })],
      );
      const events = await query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM public.application_events WHERE application_id = $1 AND source = 'vietnam_official_status'",
        [fixture.applicationId],
      );
      expect(events.rows[0].count).toBe("1");
    } finally {
      await cleanup(fixture);
    }
  });

  it("increments failure backoff atomically and fences expired lock waits", async () => {
    const fixture = await createFixture();
    try {
      const workerId = "vn-fence-fail";
      const claimed = await claim(fixture, workerId, 1);
      const generation = Number(claimed.rows[0].lease_generation);
      const blocker = await pool!.connect();
      try {
        await blocker.query("BEGIN");
        await blocker.query("SELECT id FROM public.applications WHERE id = $1 FOR UPDATE", [fixture.applicationId]);
        await blocker.query("SELECT id FROM public.official_status_checks WHERE id = $1 FOR UPDATE", [fixture.checkId]);
        await blocker.query("SELECT application_id FROM public.official_application_tracking WHERE application_id = $1 FOR UPDATE", [fixture.applicationId]);
        const pending = query(
          "SELECT public.fail_vn_official_status_check($1, $2, $3, 'integration_failure', 'expired lock wait', '{\"source\":\"integration\"}'::jsonb)",
          [fixture.checkId, workerId, generation],
        );
        await new Promise((resolve) => setTimeout(resolve, 1_100));
        await blocker.query("COMMIT");
        const result = await pending;
        expect(result.rows[0].fail_vn_official_status_check).toBe(false);
      } finally {
        await blocker.query("ROLLBACK").catch(() => undefined);
        blocker.release();
      }
      const state = await query<{ status: string; consecutive_failures: number }>(
        `SELECT checks.status, tracking.consecutive_failures
           FROM public.official_status_checks checks
           JOIN public.official_application_tracking tracking ON tracking.application_id = checks.application_id
          WHERE checks.id = $1`,
        [fixture.checkId],
      );
      expect(state.rows[0].status).toBe("running");
      expect(state.rows[0].consecutive_failures).toBe(0);
    } finally {
      await cleanup(fixture);
    }
  });
});

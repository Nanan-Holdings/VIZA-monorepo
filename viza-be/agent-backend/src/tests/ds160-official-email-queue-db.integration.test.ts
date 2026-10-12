import { Pool, type PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const confirm = process.env.DS160_OFFICIAL_EMAIL_QUEUE_DB_CONFIRM === "local-test";
const databaseUrl = process.env.DS160_OFFICIAL_EMAIL_QUEUE_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
const marker = (process.env.DS160_OFFICIAL_EMAIL_QUEUE_DB_NONPRODUCTION ?? "").toLowerCase();
const allowedMarkers = new Set(["local", "local-test", "test", "development"]);
const localHost = (() => {
  try {
    const host = new URL(databaseUrl).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "supabase";
  } catch {
    return false;
  }
})();
const liveGateEnabled = Boolean(databaseUrl) && confirm && localHost && allowedMarkers.has(marker);
const migrationSql = readFileSync(
  fileURLToPath(new URL("../../drizzle/0206_ds160_official_email_queue.sql", import.meta.url)),
  "utf8",
);

type Fixture = { applicationId: string; applicantId: string; authUserId: string };
let pool: Pool | undefined;
let client: PoolClient | undefined;
let fixture: Fixture;
let conflictFixture: Fixture;
const digest = "a".repeat(64);

const query = async <T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string,
  values: unknown[] = [],
) => {
  if (!client) throw new Error("DS-160 official email integration client is not initialized");
  return client.query<T>(sql, values);
};

const expectDbError = async (sql: string, values: unknown[] = []): Promise<void> => {
  await query("SAVEPOINT ds160_email_expected_error");
  await expect(query(sql, values)).rejects.toThrow();
  await query("ROLLBACK TO SAVEPOINT ds160_email_expected_error");
  await query("RELEASE SAVEPOINT ds160_email_expected_error");
};

const createFixture = async (label: string): Promise<Fixture> => {
  const applicantId = randomUUID();
  const authUserId = randomUUID();
  const applicationId = randomUUID();
  await query(
    `INSERT INTO public.applicant_profiles (id, auth_user_id, email, full_name)
     VALUES ($1, $2, $3, $4)`,
    [applicantId, authUserId, `${label}-${Date.now()}@invalid.test`, `DS-160 ${label}`],
  );
  await query(
    `INSERT INTO public.applications
       (id, applicant_id, country, visa_type, status, submission_result, submission_result_status)
     VALUES ($1, $2, 'US', 'DS160', 'submitted', $3::jsonb, 'submitted')`,
    [applicationId, applicantId, JSON.stringify({ country: "US", status: "submitted" })],
  );
  return { applicationId, applicantId, authUserId };
};

describe.skipIf(!liveGateEnabled)("DS-160 official email queue database integration", () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl, max: 1 });
    client = await pool.connect();
    const environment = await query<{ environment: string | null }>(
      "SELECT current_setting('app.viza_environment', true) AS environment",
    );
    const databaseEnvironment = (environment.rows[0]?.environment ?? "").toLowerCase();
    if (!allowedMarkers.has(databaseEnvironment)) {
      throw new Error(
        `Refusing DS-160 email integration writes: database marker ${databaseEnvironment || "<unset>"} is not local/test`,
      );
    }
    await query("BEGIN");
    await query(migrationSql);
    fixture = await createFixture("email-queue");
    conflictFixture = await createFixture("runner-conflict");
  });

  it("is request-idempotent and rejects a request-id digest change", async () => {
    const requestId = randomUUID();
    const first = await query<{ id: string; status: string; current_stage: string; ceac_result_payload: Record<string, unknown> }>(
      `SELECT id, status, current_stage, ceac_result_payload
         FROM public.enqueue_ds160_proof_email($1, $2, $3, $4, FALSE)`,
      [fixture.applicationId, fixture.authUserId, requestId, digest],
    );
    expect(first.rows).toHaveLength(1);
    expect(first.rows[0].status).toBe("ds160_proof_pending");
    expect(first.rows[0].current_stage).toBe("queued");
    expect(first.rows[0].ceac_result_payload).toMatchObject({
      action: "official_ceac_email",
      email: { status: "queued", request_id: requestId, recipient_sha256: digest },
    });

    const duplicate = await query<{ id: string }>(
      `SELECT id FROM public.enqueue_ds160_proof_email($1, $2, $3, $4, FALSE)`,
      [fixture.applicationId, fixture.authUserId, requestId, digest],
    );
    expect(duplicate.rows).toEqual([{ id: first.rows[0].id }]);
    await expectDbError(
      `SELECT id FROM public.enqueue_ds160_proof_email($1, $2, $3, $4, FALSE)`,
      [fixture.applicationId, fixture.authUserId, requestId, "b".repeat(64)],
    );
  });

  it("keeps the reservation one-shot and settles unknown with the lease cleared", async () => {
    const row = await query<{ id: string }>(
      `SELECT id FROM public.submission_queue
       WHERE application_id = $1 AND provider = 'ceac_proof'
       ORDER BY created_at DESC LIMIT 1`,
      [fixture.applicationId],
    );
    const queueId = row.rows[0].id;
    const claimed = await query<{ locked_at: Date }>(
      `UPDATE public.submission_queue
          SET locked_by = 'db-integration-worker',
              locked_at = clock_timestamp(),
              locked_until = clock_timestamp() + INTERVAL '10 minutes'
        WHERE id = $1
        RETURNING locked_at`,
      [queueId],
    );
    const lockedAt = claimed.rows[0].locked_at;
    const started = await query<{ status: string; current_stage: string }>(
      `SELECT status, current_stage
         FROM public.start_ds160_proof_email($1, 'db-integration-worker', $2)`,
      [queueId, lockedAt],
    );
    expect(started.rows).toHaveLength(1);
    expect(started.rows[0]).toMatchObject({ status: "ds160_proof_processing", current_stage: "retrieving_confirmation" });

    const reserved = await query<{ status: string; ceac_result_payload: Record<string, unknown> }>(
      `SELECT status, ceac_result_payload
         FROM public.reserve_ds160_email_send($1, 'db-integration-worker', $2)`,
      [queueId, lockedAt],
    );
    expect(reserved.rows).toHaveLength(1);
    expect(reserved.rows[0].status).toBe("ds160_proof_processing");
    expect(reserved.rows[0].ceac_result_payload).toMatchObject({ email: { status: "sending" } });

    const replay = await query(
      `SELECT id FROM public.reserve_ds160_email_send($1, 'db-integration-worker', $2)`,
      [queueId, lockedAt],
    );
    expect(replay.rows).toHaveLength(0);

    const settled = await query<{ status: string; locked_by: string | null; ceac_result_payload: Record<string, unknown> }>(
      `SELECT status, locked_by, ceac_result_payload
         FROM public.settle_ds160_proof_email(
           $1, 'db-integration-worker', $2, 'unknown', 'receipt_missing', '{"source":"db-test"}'::jsonb
         )`,
      [queueId, lockedAt],
    );
    expect(settled.rows).toHaveLength(1);
    expect(settled.rows[0]).toMatchObject({ status: "ds160_proof_failed", locked_by: null });
    expect(settled.rows[0].ceac_result_payload).toMatchObject({ email: { status: "unknown", code: "receipt_missing" } });
  });

  it("allows only an explicit retry after unknown and fences runner jobs", async () => {
    const retry = await query<{ id: string; status: string }>(
      `SELECT id, status
         FROM public.enqueue_ds160_proof_email($1, $2, $3, $4, TRUE)`,
      [fixture.applicationId, fixture.authUserId, randomUUID(), digest],
    );
    expect(retry.rows).toHaveLength(1);
    expect(retry.rows[0].status).toBe("ds160_proof_pending");

    await query(
      `INSERT INTO public.runner_job (application_id, country, status)
       VALUES ($1, 'us', 'queued')`,
      [conflictFixture.applicationId],
    );
    await expectDbError(
      `SELECT id FROM public.enqueue_ds160_proof_email($1, $2, $3, $4, TRUE)`,
      [conflictFixture.applicationId, conflictFixture.authUserId, randomUUID(), digest],
    );
  });

  it("does not accept a stale worker owner or lock epoch", async () => {
    const queue = await query<{ id: string }>(
      `SELECT id FROM public.submission_queue
       WHERE application_id = $1 AND status = 'ds160_proof_pending'
       ORDER BY created_at DESC LIMIT 1`,
      [fixture.applicationId],
    );
    const queueId = queue.rows[0].id;
    const claimed = await query<{ locked_at: string; stale_locked_at: string }>(
      `UPDATE public.submission_queue
          SET locked_by = 'epoch-worker', locked_at = clock_timestamp(),
              locked_until = clock_timestamp() + INTERVAL '10 minutes'
        WHERE id = $1
        RETURNING locked_at::text, (locked_at - INTERVAL '1 second')::text AS stale_locked_at`,
      [queueId],
    );
    expect((await query(
      `SELECT id FROM public.start_ds160_proof_email($1, 'other-worker', $2)`,
      [queueId, claimed.rows[0].locked_at],
    )).rows).toHaveLength(0);
    expect((await query(
      `SELECT id FROM public.start_ds160_proof_email($1, 'epoch-worker', $2)`,
      [queueId, claimed.rows[0].stale_locked_at],
    )).rows).toHaveLength(0);
  });

  afterAll(async () => {
    if (client) {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
    }
    await pool?.end();
    client = undefined;
    pool = undefined;
  });
});

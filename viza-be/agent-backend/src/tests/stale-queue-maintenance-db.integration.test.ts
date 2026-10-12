import { Pool, type PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const confirmed = process.env.STALE_QUEUE_MAINTENANCE_DB_CONFIRM === "local-test";
const databaseUrl = process.env.STALE_QUEUE_MAINTENANCE_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
const environmentMarker = (process.env.STALE_QUEUE_MAINTENANCE_DB_NONPRODUCTION ?? "").toLowerCase();
const allowedMarkers = new Set(["local", "local-test", "test", "development"]);
const localHost = (() => {
  try {
    const host = new URL(databaseUrl).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "supabase";
  } catch {
    return false;
  }
})();
const liveGateEnabled = Boolean(databaseUrl) && confirmed && localHost && allowedMarkers.has(environmentMarker);

const emailMigration = readFileSync(
  fileURLToPath(new URL("../../drizzle/0206_ds160_official_email_queue.sql", import.meta.url)),
  "utf8",
);
const staleMaintenanceMigration = readFileSync(
  fileURLToPath(new URL("../../drizzle/0207_preserve_ds160_proof_stale_results.sql", import.meta.url)),
  "utf8",
);

let pool: Pool | undefined;
let client: PoolClient | undefined;

const query = async <T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string,
  values: unknown[] = [],
) => {
  if (!client) throw new Error("stale queue maintenance integration client is not initialized");
  return client.query<T>(sql, values);
};

describe.skipIf(!liveGateEnabled)("stale queue maintenance database regression", () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl, max: 1 });
    client = await pool.connect();
    const environment = await query<{ environment: string | null }>(
      "SELECT current_setting('app.viza_environment', true) AS environment",
    );
    const databaseEnvironment = (environment.rows[0]?.environment ?? "").toLowerCase();
    if (!allowedMarkers.has(databaseEnvironment)) {
      throw new Error(
        `Refusing stale queue integration writes: database marker ${databaseEnvironment || "<unset>"} is not local/test`,
      );
    }
    await query("BEGIN");
    await query(emailMigration);
    await query(staleMaintenanceMigration);
  });

  it("preserves proof results, honors leases, and leaves the service-role ACL intact", async () => {
    const applicantId = randomUUID();
    const authUserId = randomUUID();
    const proofQueuedApplicationId = randomUUID();
    const proofSendingApplicationId = randomUUID();
    const expiredGenericApplicationId = randomUUID();
    const activeGenericApplicationId = randomUUID();
    const queueIds = {
      proofQueued: randomUUID(),
      proofSending: randomUUID(),
      expiredGeneric: randomUUID(),
      activeGeneric: randomUUID(),
    };
    const old = new Date(Date.now() - 20 * 60 * 1000);
    const staleBefore = new Date(Date.now() - 10 * 60 * 1000);
    const future = new Date(Date.now() + 10 * 60 * 1000);
    const submittedResult = {
      country: "US",
      status: "submitted",
      confirmationPdfStoragePath: "private/ds160/confirmation.pdf",
    };
    const queuedDigest = "a".repeat(64);
    const sendingDigest = "b".repeat(64);

    await query(
      `INSERT INTO public.applicant_profiles (id, auth_user_id, email, full_name)
       VALUES ($1, $2, 'stale-queue-fixture@example.invalid', 'Stale Queue Fixture')`,
      [applicantId, authUserId],
    );
    await query(
      `INSERT INTO public.applications
         (id, applicant_id, country, visa_type, status, submission_result, submission_result_status)
       VALUES
         ($1, $4, 'US', 'DS160', 'submitted', $2::jsonb, 'submitted'),
         ($3, $4, 'US', 'DS160', 'submitted', $2::jsonb, 'submitted'),
         ($5, $4, 'US', 'DS160', 'submitted', $2::jsonb, 'submitted'),
         ($6, $4, 'US', 'DS160', 'submitted', $2::jsonb, 'submitted')`,
      [
        proofQueuedApplicationId,
        JSON.stringify(submittedResult),
        proofSendingApplicationId,
        applicantId,
        expiredGenericApplicationId,
        activeGenericApplicationId,
      ],
    );
    await query(
      `INSERT INTO public.submission_queue
         (id, application_id, user_id, status, mode, provider, attempts, last_error,
          current_stage, ceac_result_payload, created_at, updated_at, heartbeat_at,
          locked_by, locked_at, locked_until)
       VALUES
         ($1, $2, $3, 'ds160_proof_processing', 'live_assisted', 'ceac_proof', 1, NULL,
          'retrieving_confirmation', $4::jsonb, $5, $5, $5, 'old-worker', $5, $5),
         ($6, $7, $3, 'ds160_proof_processing', 'live_assisted', 'ceac_proof', 1, NULL,
          'email_confirmation_sending', $8::jsonb, $5, $5, $5, 'old-worker', $5, $5),
         ($9, $10, NULL, 'processing', 'live_assisted', 'ceac_live', 1, 'old error',
          'submit', NULL, $5, $5, $5, 'old-worker', $5, $5),
         ($11, $12, NULL, 'processing', 'live_assisted', 'ceac_live', 1, 'active error',
          'submit', NULL, $5, $5, $5, 'live-worker', $5, $13)`,
      [
        queueIds.proofQueued,
        proofQueuedApplicationId,
        authUserId,
        JSON.stringify({
          action: "official_ceac_email",
          email: { status: "queued", request_id: randomUUID(), recipient_sha256: queuedDigest },
        }),
        old,
        queueIds.proofSending,
        proofSendingApplicationId,
        JSON.stringify({
          action: "official_ceac_email",
          email: {
            status: "sending",
            send_started_at: old.toISOString(),
            request_id: randomUUID(),
            recipient_sha256: sendingDigest,
          },
        }),
        queueIds.expiredGeneric,
        expiredGenericApplicationId,
        queueIds.activeGeneric,
        activeGenericApplicationId,
        future,
      ],
    );

    const maintenance = await query<{ id: string; application_id: string; status: string; timed_out_status: string }>(
      `SELECT id, application_id, status, timed_out_status
         FROM public.mark_stale_submission_queue_batch($1, $1, $1, 100)`,
      [staleBefore],
    );
    expect(maintenance.rows).toHaveLength(1);
    expect(maintenance.rows[0]).toMatchObject({
      id: queueIds.expiredGeneric,
      application_id: expiredGenericApplicationId,
      status: "processing",
      timed_out_status: "failed",
    });

    const queueState = await query<{
      id: string;
      status: string;
      locked_until: Date | null;
      ceac_result_payload: Record<string, unknown> | null;
    }>(
      `SELECT id, status, locked_until, ceac_result_payload
         FROM public.submission_queue
        WHERE id IN ($1, $2, $3, $4)`,
      [queueIds.proofQueued, queueIds.proofSending, queueIds.expiredGeneric, queueIds.activeGeneric],
    );
    const queueById = new Map(queueState.rows.map((row) => [row.id, row]));
    expect(queueById.get(queueIds.proofQueued)?.status).toBe("ds160_proof_processing");
    expect(queueById.get(queueIds.proofSending)?.status).toBe("ds160_proof_processing");
    expect(queueById.get(queueIds.expiredGeneric)?.status).toBe("failed");
    expect(queueById.get(queueIds.expiredGeneric)?.locked_until).toBeNull();
    expect(queueById.get(queueIds.activeGeneric)?.status).toBe("processing");

    const applicationState = await query<{
      id: string;
      submission_result_status: string;
      submission_result: Record<string, unknown>;
    }>(
      `SELECT id, submission_result_status, submission_result
         FROM public.applications
        WHERE id IN ($1, $2, $3, $4)`,
      [
        proofQueuedApplicationId,
        proofSendingApplicationId,
        expiredGenericApplicationId,
        activeGenericApplicationId,
      ],
    );
    const applicationsById = new Map(applicationState.rows.map((row) => [row.id, row]));
    expect(applicationsById.get(proofQueuedApplicationId)?.submission_result_status).toBe("submitted");
    expect(applicationsById.get(proofSendingApplicationId)?.submission_result_status).toBe("submitted");
    expect(applicationsById.get(activeGenericApplicationId)?.submission_result_status).toBe("submitted");
    expect(applicationsById.get(expiredGenericApplicationId)?.submission_result_status).toBe("failed");
    expect(applicationsById.get(proofQueuedApplicationId)?.submission_result).toEqual(submittedResult);
    expect(applicationsById.get(proofSendingApplicationId)?.submission_result).toEqual(submittedResult);

    const privileges = await query<{
      anon_execute: boolean;
      authenticated_execute: boolean;
      service_execute: boolean;
    }>(
      `SELECT
         has_function_privilege('anon', 'public.mark_stale_submission_queue_batch(timestamptz,timestamptz,timestamptz,integer)', 'EXECUTE') AS anon_execute,
         has_function_privilege('authenticated', 'public.mark_stale_submission_queue_batch(timestamptz,timestamptz,timestamptz,integer)', 'EXECUTE') AS authenticated_execute,
         has_function_privilege('service_role', 'public.mark_stale_submission_queue_batch(timestamptz,timestamptz,timestamptz,integer)', 'EXECUTE') AS service_execute`,
    );
    expect(privileges.rows[0]).toEqual({ anon_execute: false, authenticated_execute: false, service_execute: true });

    const queuedRetry = await query<{ id: string; status: string }>(
      `SELECT id, status
         FROM public.enqueue_ds160_proof_email($1, $2, $3, $4, TRUE)`,
      [proofQueuedApplicationId, authUserId, randomUUID(), queuedDigest],
    );
    expect(queuedRetry.rows).toHaveLength(1);
    expect(queuedRetry.rows[0]?.status).toBe("ds160_proof_pending");
    const queuedPayload = await query<{
      status: string;
      current_stage: string;
      error_code: string;
      ceac_result_payload: { email?: { status?: string; code?: string } };
    }>(
      `SELECT status, current_stage, error_code, ceac_result_payload
         FROM public.submission_queue WHERE id = $1`,
      [queueIds.proofQueued],
    );
    expect(queuedPayload.rows[0]).toMatchObject({
      status: "ds160_proof_failed",
      current_stage: "email_confirmation_failed",
      error_code: "ds160_email_lease_expired_before_send",
      ceac_result_payload: {
        email: { status: "failed", code: "ds160_email_lease_expired_before_send" },
      },
    });

    const sendingRetry = await query<{ id: string; status: string }>(
      `SELECT id, status
         FROM public.enqueue_ds160_proof_email($1, $2, $3, $4, TRUE)`,
      [proofSendingApplicationId, authUserId, randomUUID(), sendingDigest],
    );
    expect(sendingRetry.rows).toHaveLength(1);
    expect(sendingRetry.rows[0]?.status).toBe("ds160_proof_pending");
    const sendingPayload = await query<{
      status: string;
      current_stage: string;
      error_code: string;
      ceac_result_payload: { email?: { status?: string; code?: string } };
    }>(
      `SELECT status, current_stage, error_code, ceac_result_payload
         FROM public.submission_queue WHERE id = $1`,
      [queueIds.proofSending],
    );
    expect(sendingPayload.rows[0]).toMatchObject({
      status: "ds160_proof_failed",
      current_stage: "email_confirmation_unknown",
      error_code: "ds160_email_lease_expired",
      ceac_result_payload: {
        email: { status: "unknown", code: "ds160_email_lease_expired" },
      },
    });
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

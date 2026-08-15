import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const canonicalPath = fileURLToPath(
  new URL("../../drizzle/0139_concurrency_phase_two.sql", import.meta.url),
);
const mirrorDirectory = fileURLToPath(
  new URL("../../../../viza-fe/internal-website/supabase/migrations/", import.meta.url),
);
const integrationPath = fileURLToPath(
  new URL("./concurrency-phase-two-db.integration.test.ts", import.meta.url),
);
const canonicalSql = existsSync(canonicalPath) ? readFileSync(canonicalPath, "utf8") : "";
const integrationSource = existsSync(integrationPath) ? readFileSync(integrationPath, "utf8") : "";
const normalized = (source: string): string => source.replace(/\r\n/g, "\n").trimEnd();
const functionBody = canonicalSql.match(
  /CREATE OR REPLACE FUNCTION public\.claim_runner_pool_job\([\s\S]*?\n\$\$;/i,
)?.[0] ?? "";
const emailFunctionBody = canonicalSql.match(
  /CREATE OR REPLACE FUNCTION public\.enqueue_vn_email_triggered_status_checks\([\s\S]*?\n\$\$;/i,
)?.[0] ?? "";
const deferFunctionBody = canonicalSql.match(
  /CREATE OR REPLACE FUNCTION public\.defer_vn_official_status_check\([\s\S]*?\n\$\$;/i,
 )?.[0] ?? "";
const completeFunctionBody = canonicalSql.match(
  /CREATE OR REPLACE FUNCTION public\.complete_runner_pool_job\([\s\S]*?\n\$\$;/i,
)?.[0] ?? "";
const renewFunctionBody = canonicalSql.match(
  /CREATE OR REPLACE FUNCTION public\.renew_runner_pool_job\([\s\S]*?\n\$\$;/i,
)?.[0] ?? "";
const failFunctionBody = canonicalSql.match(
  /CREATE OR REPLACE FUNCTION public\.fail_runner_pool_job\([\s\S]*?\n\$\$;/i,
)?.[0] ?? "";
const triggerFunctionBody = canonicalSql.match(
  /CREATE OR REPLACE FUNCTION runner_private\.guard_expired_runner_job_lifecycle_update\([\s\S]*?\n\$\$;/i,
)?.[0] ?? "";
const takeoverFunctionBody = canonicalSql.match(
  /CREATE OR REPLACE FUNCTION public\.open_runner_job_takeover\([\s\S]*?\n\$\$;/i,
)?.[0] ?? "";
const resultFunctionBody = canonicalSql.match(
  /CREATE OR REPLACE FUNCTION public\.write_runner_pool_submission_result\([\s\S]*?\n\$\$;/i,
)?.[0] ?? "";
const enqueueFunctionBody = canonicalSql.match(
  /CREATE OR REPLACE FUNCTION public\.enqueue_runner_pool_job\([\s\S]*?\n\$\$;/i,
)?.[0] ?? "";
const pauseFunctionBody = canonicalSql.match(
  /CREATE OR REPLACE FUNCTION public\.pause_runner_jobs_for_review\([\s\S]*?\n\$\$;/i,
)?.[0] ?? "";
const cancelFunctionBody = canonicalSql.match(
  /CREATE OR REPLACE FUNCTION public\.cancel_application_submission\([\s\S]*?\n\$\$;/i,
)?.[0] ?? "";
const takeoverSettlementFunctionBody = canonicalSql.match(
  /CREATE OR REPLACE FUNCTION public\.settle_runner_job_takeover\([\s\S]*?\n\$\$;/i,
)?.[0] ?? "";
const insertGuardFunctionBody = canonicalSql.match(
  /CREATE OR REPLACE FUNCTION runner_private\.guard_runner_job_running_insert\([\s\S]*?\n\$\$;/i,
)?.[0] ?? "";

const plpgsqlBody = (functionSql: string): string =>
  functionSql.slice(functionSql.indexOf("AS $$"));

const assertSettlementLocksBeforeClock = (functionSql: string): void => {
  const body = plpgsqlBody(functionSql);
  const lockIndex = body.search(
    /SELECT[\s\S]*?FROM public\.runner_job AS job[\s\S]*?WHERE[\s\S]*?job\.id\s*=\s*p_job_id[\s\S]*?job\.status\s*=\s*'running'[\s\S]*?job\.leased_by\s*=\s*(?:BTRIM\(p_worker_id\)|p_worker_id|v_worker_id)[\s\S]*?FOR UPDATE\s*;/i,
  );
  expect(lockIndex).toBeGreaterThan(-1);

  const clockIndex = body.search(
    /v_now\s*(?:TIMESTAMPTZ\s*)?:=\s*(?:pg_catalog\.)?clock_timestamp\(\)/i,
  );
  expect(clockIndex).toBeGreaterThan(lockIndex);
  expect(body).not.toMatch(
    /DECLARE[\s\S]*?v_now\s+TIMESTAMPTZ\s*:=\s*clock_timestamp\(\)/i,
  );

  const leaseRecheckIndex = body.search(
    /IF\s+(?:v_leased_until|v_old_row\.leased_until)\s*<=\s*v_now\s+THEN[\s\S]*?RETURN;/i,
  );
  expect(leaseRecheckIndex).toBeGreaterThan(clockIndex);

  const updateIndex = body.search(/UPDATE public\.runner_job AS job/i);
  expect(updateIndex).toBeGreaterThan(leaseRecheckIndex);
  expect(body.slice(updateIndex)).toMatch(/job\.leased_until\s*>\s*v_now/i);
};

describe("runner pool concurrency phase two migration", () => {
  it("defines the exact service-role claim RPC identity and return contract", () => {
    expect(canonicalSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.claim_runner_pool_job\(\s*p_worker_id TEXT,\s*p_lease_ms INTEGER DEFAULT 900000,\s*p_require_slot BOOLEAN DEFAULT TRUE,\s*p_now TIMESTAMPTZ DEFAULT NOW\(\)\s*\)/i,
    );
    expect(canonicalSql).toMatch(
      /RETURNS TABLE \(\s*id UUID,\s*application_id UUID,\s*country TEXT,\s*flow_key TEXT,\s*attempts INTEGER,\s*max_attempts INTEGER,\s*correlation_id TEXT,\s*metadata JSONB\s*\)/i,
    );
    expect(functionBody).toMatch(/SECURITY DEFINER/i);
    expect(canonicalSql).toMatch(
      /REVOKE ALL ON SCHEMA runner_private FROM PUBLIC, anon, authenticated, service_role;/i,
    );
  });

  it("retains the timestamp parameter for compatibility but trusts database time", () => {
    expect(functionBody).toMatch(
      /IF p_lease_ms IS NULL OR p_lease_ms < 10000 OR p_lease_ms > 7200000 THEN[\s\S]*?ERRCODE = '22023'/i,
    );
    expect(functionBody).toMatch(
      /IF p_require_slot IS NULL THEN[\s\S]*?ERRCODE = '22023'/i,
    );
    expect(functionBody).toMatch(/v_now\s*:=\s*(?:pg_catalog\.)?clock_timestamp\(\)/i);
    expect(plpgsqlBody(functionBody).replace(/--[^\r\n]*/g, "")).not.toMatch(/\bp_now\b/i);
  });

  it("removes both blocking and try-lock global advisory lock variants", () => {
    expect(canonicalSql).not.toContain("pg_advisory_xact_lock(hashtext('viza-runner-pool-claim'))");
    expect(canonicalSql).not.toContain("pg_try_advisory_xact_lock(hashtext('viza-runner-pool-claim'))");
  });

  it("recovers at most one expired lease with an ordered SKIP LOCKED CTE and conditional update", () => {
    expect(canonicalSql).toMatch(
      /WITH expired AS MATERIALIZED \([\s\S]*?SELECT expired\.id[\s\S]*?FROM public\.runner_job AS expired[\s\S]*?ORDER BY[\s\S]*?LIMIT 1[\s\S]*?FOR UPDATE SKIP LOCKED[\s\S]*?\)[\s\S]*?SELECT expired\.id[\s\S]*?INTO v_expired_job_id/i,
    );
    expect(canonicalSql).toMatch(
      /INSERT INTO runner_private\.runner_job_update_capability[\s\S]*?'recover'[\s\S]*?old_row[\s\S]*?new_row[\s\S]*?UPDATE public\.runner_job AS job[\s\S]*?WHERE job\.id = v_expired_job_id[\s\S]*?job\.status = 'running'[\s\S]*?job\.leased_until <= v_now/i,
    );
    expect(canonicalSql).not.toMatch(/(?:set_config|current_setting)\(/i);
  });

  it("checks a live pool machine slot before claiming when required", () => {
    expect(functionBody).toMatch(
      /IF p_require_slot THEN[\s\S]*?PERFORM 1[\s\S]*?FROM public\.runner_machine_slot AS rms[\s\S]*?rms\.owner_machine_id = v_worker_id[\s\S]*?rms\.owner_kind = 'pool'[\s\S]*?rms\.lease_until > v_now[\s\S]*?FOR UPDATE[\s\S]*?IF NOT FOUND THEN[\s\S]*?RETURN;/i,
    );
  });

  it("serializes one live running job per matching pool slot owner", () => {
    expect(canonicalSql).toMatch(
      /CREATE INDEX IF NOT EXISTS runner_job_running_owner_lease_idx\s+ON public\.runner_job \(leased_by, leased_until\)\s+WHERE status = 'running';/i,
    );
    expect(functionBody).toMatch(
      /IF p_require_slot THEN[\s\S]*?FOR UPDATE[\s\S]*?IF EXISTS \([\s\S]*?FROM public\.runner_job AS owned[\s\S]*?owned\.status = 'running'[\s\S]*?owned\.leased_by = v_worker_id[\s\S]*?owned\.leased_until > v_now[\s\S]*?THEN[\s\S]*?RETURN;/i,
    );
  });

  it("locks one candidate and its country cap through a materialized ordered CTE", () => {
    expect(functionBody).toMatch(
      /selected AS MATERIALIZED \([\s\S]*?SELECT candidate\.id, candidate\.country[\s\S]*?FROM public\.runner_job AS candidate[\s\S]*?JOIN public\.runner_concurrency_cap AS cap[\s\S]*?ORDER BY candidate\.enqueued_at, candidate\.id[\s\S]*?LIMIT 1[\s\S]*?FOR UPDATE OF candidate, cap SKIP LOCKED/i,
    );
  });

  it("scans across unlocked countries instead of preselecting one cap row", () => {
    expect(functionBody).not.toMatch(/v_candidate_country|v_cap_country/i);
    expect(functionBody).not.toMatch(/candidate\.country\s*=\s*v_cap_country/i);
    expect(functionBody).not.toMatch(
      /SELECT candidate\.country[\s\S]*?INTO v_candidate_country[\s\S]*?LIMIT 1/i,
    );
    expect((functionBody.match(/selected AS MATERIALIZED/gi) ?? []).length).toBe(1);
    expect(functionBody).toMatch(
      /selected AS MATERIALIZED \([\s\S]*?SELECT candidate\.id, candidate\.country[\s\S]*?candidate\.country IN \([\s\S]*?'vietnam'[\s\S]*?'south_korea'[\s\S]*?\)[\s\S]*?ORDER BY candidate\.enqueued_at, candidate\.id[\s\S]*?LIMIT 1[\s\S]*?FOR UPDATE OF candidate, cap SKIP LOCKED/i,
    );
  });

  it("rechecks capacity in a fresh statement after each locked cap and continues boundedly", () => {
    const capLockIndex = functionBody.indexOf("FOR UPDATE OF cap SKIP LOCKED");
    const selectedIndex = functionBody.indexOf("selected AS MATERIALIZED");
    expect(capLockIndex).toBeGreaterThan(-1);
    expect(selectedIndex).toBeGreaterThan(capLockIndex);
    expect(functionBody.slice(0, capLockIndex)).not.toMatch(
      /SELECT COUNT\(\*\)[\s\S]*?active\.country = candidate\.country[\s\S]*?active\.status = 'running'/i,
    );
    expect(functionBody).toMatch(
      /SELECT cap\.country[\s\S]*?FROM public\.runner_concurrency_cap AS cap[\s\S]*?JOIN LATERAL \([\s\S]*?oldest_candidate\.status = 'queued'[\s\S]*?oldest_candidate\.available_at <= v_now[\s\S]*?ORDER BY oldest_candidate\.enqueued_at, oldest_candidate\.id, cap\.country[\s\S]*?LIMIT 1[\s\S]*?FOR UPDATE OF cap SKIP LOCKED/i,
    );
    expect(functionBody).toMatch(/WHILE\s+v_cap_iterations\s*<\s*5\s+LOOP/i);
    expect(functionBody).toMatch(/v_tried_countries/i);
    expect(functionBody).toMatch(/GET DIAGNOSTICS v_claimed_rows = ROW_COUNT/i);
    expect(functionBody).toMatch(
      /IF v_claimed_rows > 0 THEN\s*RETURN;\s*END IF;/i,
    );
  });

  it("orders untried cap locks by each country's oldest due queued candidate", () => {
    expect(functionBody).not.toMatch(/v_last_country|ORDER BY cap\.country/i);
    expect(functionBody).toMatch(/v_tried_countries\s+TEXT\[\]/i);
    expect(functionBody).toMatch(
      /LATERAL\s*\([\s\S]*?FROM public\.runner_job AS oldest_candidate[\s\S]*?oldest_candidate\.status = 'queued'[\s\S]*?oldest_candidate\.available_at <= v_now[\s\S]*?ORDER BY oldest_candidate\.enqueued_at, oldest_candidate\.id[\s\S]*?LIMIT 1/i,
    );
    expect(functionBody).toMatch(
      /ORDER BY oldest_candidate\.enqueued_at, oldest_candidate\.id, cap\.country[\s\S]*?FOR UPDATE OF cap SKIP LOCKED/i,
    );
    expect(functionBody).toMatch(/v_tried_countries\s*\|\|\s*v_locked_country/i);
  });

  it("only considers due queued jobs below an unpaused per-country cap", () => {
    expect(functionBody).toMatch(/candidate\.status = 'queued'/i);
    expect(functionBody).toMatch(/candidate\.available_at <= v_now/i);
    expect(functionBody).toMatch(/NOT cap\.paused/i);
    expect(functionBody).toMatch(
      /SELECT COUNT\(\*\)[\s\S]*?active\.country = candidate\.country[\s\S]*?active\.status = 'running'[\s\S]*?< cap\.max_concurrent/i,
    );
    expect(functionBody).not.toMatch(/'indonesia'/i);
  });

  it("updates queued jobs into leased running rows and returns the established columns", () => {
    expect(functionBody).toMatch(
      /UPDATE public\.runner_job AS claimed[\s\S]*?SET status = 'running'[\s\S]*?leased_by = v_worker_id[\s\S]*?leased_until = v_now \+ p_lease_ms \* INTERVAL '1 millisecond'[\s\S]*?started_at = v_now[\s\S]*?finished_at = NULL[\s\S]*?last_error = NULL/i,
    );
    expect(functionBody).toMatch(
      /RETURNING[\s\S]*?claimed\.id[\s\S]*?claimed\.application_id[\s\S]*?claimed\.country[\s\S]*?claimed\.flow_key[\s\S]*?claimed\.attempts[\s\S]*?claimed\.max_attempts[\s\S]*?claimed\.correlation_id[\s\S]*?claimed\.metadata/i,
    );
  });

  it("adds indexes matching queued ordering, running-country counts, and lease recovery", () => {
    expect(canonicalSql).toMatch(
      /CREATE INDEX IF NOT EXISTS runner_job_queued_available_idx\s+ON public\.runner_job \(country, available_at, enqueued_at, id\)\s+WHERE status = 'queued';/i,
    );
    expect(canonicalSql).toMatch(
      /runner_job_pool_claim_idx[\s\S]*?existing claim readers/i,
    );
    expect(canonicalSql).toMatch(
      /CREATE INDEX IF NOT EXISTS runner_job_running_country_idx\s+ON public\.runner_job \(country\)\s+WHERE status = 'running';/i,
    );
    expect(canonicalSql).toMatch(
      /CREATE INDEX IF NOT EXISTS runner_job_running_lease_idx\s+ON public\.runner_job \(leased_until\)[\s\S]*?WHERE status = 'running';/i,
    );
  });

  it("hardens execution privileges and function search path", () => {
    expect(functionBody).toMatch(/SECURITY DEFINER/i);
    expect(functionBody).toMatch(/SET search_path = ''/i);
    expect(canonicalSql).toMatch(
      /REVOKE ALL ON FUNCTION public\.claim_runner_pool_job\(\s*TEXT, INTEGER, BOOLEAN, TIMESTAMPTZ\s*\) FROM PUBLIC, anon, authenticated;/i,
    );
    expect(canonicalSql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.claim_runner_pool_job\(\s*TEXT, INTEGER, BOOLEAN, TIMESTAMPTZ\s*\) TO service_role;/i,
    );
  });

  it("keeps one CLI-generated mirror byte-for-byte equivalent after line-ending normalization", () => {
    const mirrorFiles = existsSync(mirrorDirectory)
      ? readdirSync(mirrorDirectory).filter((fileName) => /_concurrency_phase_two\.sql$/i.test(fileName))
      : [];
    expect(mirrorFiles).toHaveLength(1);
    const mirrorSql = readFileSync(`${mirrorDirectory}/${mirrorFiles[0]}`, "utf8");
    expect(normalized(mirrorSql)).toBe(normalized(canonicalSql));
  });

  it("defines the bounded Vietnam email matcher RPC and exact count contract", () => {
    expect(canonicalSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.enqueue_vn_email_triggered_status_checks\(\s*p_emails JSONB\s*\)/i,
    );
    expect(emailFunctionBody).toMatch(
      /RETURNS TABLE \(\s*queued INTEGER,\s*ambiguous INTEGER,\s*unmatched INTEGER,\s*duplicates INTEGER\s*\)/i,
    );
    expect(emailFunctionBody).toMatch(/LANGUAGE plpgsql/i);
    expect(emailFunctionBody).toMatch(/SECURITY INVOKER/i);
    expect(emailFunctionBody).toMatch(/SET search_path = ''/i);
  });

  it("rejects malformed and oversized email payloads with SQLSTATE 22023", () => {
    expect(emailFunctionBody).toMatch(
      /JSONB_TYPEOF\(p_emails\)\s*<>\s*'array'[\s\S]*?ERRCODE\s*=\s*'22023'/i,
    );
    expect(emailFunctionBody).toMatch(
      /p_emails\s+IS\s+NULL[\s\S]*?ERRCODE\s*=\s*'22023'/i,
    );
    expect(emailFunctionBody).toMatch(
      /jsonb_array_length\(p_emails\)\s*>\s*100[\s\S]*?ERRCODE\s*=\s*'22023'/i,
    );
    expect(emailFunctionBody).toMatch(/jsonb_to_recordset\(p_emails\)/i);
  });

  it("matches only inbound ids, active Vietnam tracking, and normalized references", () => {
    expect(emailFunctionBody).toMatch(/"emailId"/i);
    expect(emailFunctionBody).toMatch(/"normalizedReference"/i);
    expect(emailFunctionBody).toMatch(/LOWER\(tracking\.official_lookup_email\)\s*=\s*LOWER\(email\.to_addr\)/i);
    expect(emailFunctionBody).toMatch(/normalized_reference/i);
    expect(emailFunctionBody).toMatch(/inbound_email/i);
    expect(emailFunctionBody).toMatch(/tracking_status\s*=\s*'active'/i);
    expect(emailFunctionBody).toMatch(/applications/i);
    expect(emailFunctionBody).toMatch(/candidate_count/i);
  });

  it("inserts unique matches idempotently and returns all four counts", () => {
    expect(emailFunctionBody).toMatch(/ON CONFLICT\s*\(idempotency_key\)\s*WHERE\s+idempotency_key\s+IS\s+NOT\s+NULL/i);
    expect(emailFunctionBody).toMatch(/INSERT INTO public\.official_status_checks/i);
    expect(emailFunctionBody).toMatch(/INSERT INTO public\.application_events/i);
    expect(emailFunctionBody).toMatch(/official_email_match_ambiguous/i);
    expect(emailFunctionBody).toMatch(/last_email_message_id/i);
    expect(emailFunctionBody).toMatch(/tracking_updates[\s\S]*?FROM latest_tracking_emails/i);
    expect(emailFunctionBody).toMatch(/'candidate_count', classification\.candidate_count/i);
    expect(emailFunctionBody).toMatch(/RETURN QUERY/i);
    expect(emailFunctionBody).toMatch(/queued/i);
    expect(emailFunctionBody).toMatch(/ambiguous/i);
    expect(emailFunctionBody).toMatch(/unmatched/i);
    expect(emailFunctionBody).toMatch(/duplicates/i);
  });

  it("adds the active email expression index and service-role-only execution", () => {
    expect(canonicalSql).toMatch(
      /CREATE INDEX IF NOT EXISTS official_tracking_active_email_idx\s+ON public\.official_application_tracking\s*\(LOWER\(official_lookup_email\)\)\s+WHERE tracking_status = 'active';/i,
    );
    expect(canonicalSql).toMatch(
      /REVOKE ALL ON FUNCTION public\.enqueue_vn_email_triggered_status_checks\(JSONB\)\s+FROM PUBLIC, anon, authenticated;/i,
    );
    expect(canonicalSql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.enqueue_vn_email_triggered_status_checks\(JSONB\)\s+TO service_role;/i,
    );
    expect(canonicalSql).not.toMatch(/official_status_checks_idempotency_key_unique_idx/i);
  });

  it("uses one classification CTE and rejects duplicate normalized email ids", () => {
    expect(emailFunctionBody).toMatch(/candidate_matches\s+AS\s+MATERIALIZED/i);
    expect(emailFunctionBody).toMatch(/classified\s+AS\s+MATERIALIZED/i);
    expect(emailFunctionBody).not.toMatch(/inputs\s+AS\s+MATERIALIZED\s*\([\s\S]*?SELECT DISTINCT/i);
    expect(emailFunctionBody).not.toMatch(/DISTINCT ON/i);
    expect(emailFunctionBody).toMatch(/INSERT INTO public\.official_status_checks[\s\S]*?UPDATE public\.official_application_tracking[\s\S]*?INSERT INTO public\.application_events/i);
    expect(emailFunctionBody).toMatch(/LOWER\(BTRIM\(item\.value ->> 'emailId'\)\)/i);
    expect(emailFunctionBody).toMatch(/GROUP BY duplicate_inputs\.email_id[\s\S]*?HAVING COUNT\(\*\)\s*>\s*1/i);
    expect(emailFunctionBody).toMatch(/duplicate emailId values/i);
    expect(emailFunctionBody).toMatch(/duplicate_inputs[\s\S]*?RETURN QUERY/i);
  });

  it("updates each tracking row from the newest inserted email deterministically", () => {
    expect(emailFunctionBody).toMatch(/latest_tracking_emails\s+AS\s+MATERIALIZED/i);
    expect(emailFunctionBody).toMatch(
      /latest_tracking_emails[\s\S]*?FROM status_inserts[\s\S]*?JOIN public\.inbound_email/i,
    );
    expect(emailFunctionBody).toMatch(/ORDER BY inbound\.received_at\s+DESC, inserted\.inbound_email_id\s+DESC/i);
    expect(emailFunctionBody).toMatch(
      /tracking_updates[\s\S]*?FROM latest_tracking_emails[\s\S]*?row_number\s*=\s*1/i,
    );
    expect(emailFunctionBody).toMatch(/COUNT\(\*\)[\s\S]*?FROM classified WHERE candidate_count = 1/i);
  });

  it("defines the exact service-role defer RPC identity and return contract", () => {
    expect(canonicalSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.defer_vn_official_status_check\(\s*p_check_id UUID,\s*p_worker_id TEXT,\s*p_retry_after_seconds INTEGER DEFAULT 30\s*\)/i,
    );
    expect(deferFunctionBody).toMatch(/RETURNS BOOLEAN/i);
    expect(deferFunctionBody).toMatch(/SECURITY INVOKER/i);
    expect(deferFunctionBody).toMatch(/SET search_path = ''/i);
  });

  it("validates defer inputs with SQLSTATE 22023 and bounds retry delay", () => {
    expect(deferFunctionBody).toMatch(
      /p_check_id IS NULL[\s\S]*?ERRCODE\s*=\s*'22023'/i,
    );
    expect(deferFunctionBody).toMatch(
      /NULLIF\(BTRIM\(p_worker_id\), ''\) IS NULL[\s\S]*?ERRCODE\s*=\s*'22023'/i,
    );
    expect(deferFunctionBody).toMatch(
      /p_retry_after_seconds IS NULL[\s\S]*?p_retry_after_seconds < 1[\s\S]*?p_retry_after_seconds > 300[\s\S]*?ERRCODE\s*=\s*'22023'/i,
    );
  });

  it("revokes public execution and grants defer only to service_role", () => {
    expect(canonicalSql).toMatch(
      /REVOKE ALL ON FUNCTION public\.defer_vn_official_status_check\(UUID, TEXT, INTEGER\)\s+FROM PUBLIC, anon, authenticated;/i,
    );
    expect(canonicalSql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.defer_vn_official_status_check\(UUID, TEXT, INTEGER\)\s+TO service_role;/i,
    );
  });

  it("conditionally requeues only a live worker-owned running check and reverses the admission attempt", () => {
    expect(deferFunctionBody).toMatch(
      /UPDATE public\.official_status_checks[\s\S]*?SET[\s\S]*?status\s*=\s*'queued'[\s\S]*?scheduled_for\s*=\s*NOW\(\)\s*\+[\s\S]*?attempt_count\s*=\s*GREATEST\(checks\.attempt_count\s*-\s*1,\s*0\)[\s\S]*?worker_id\s*=\s*NULL[\s\S]*?claimed_at\s*=\s*NULL[\s\S]*?lease_expires_at\s*=\s*NULL[\s\S]*?started_at\s*=\s*NULL[\s\S]*?updated_at\s*=\s*NOW\(\)/i,
    );
    expect(deferFunctionBody).toMatch(
      /WHERE checks\.id\s*=\s*p_check_id[\s\S]*?checks\.status\s*=\s*'running'[\s\S]*?checks\.worker_id\s*=\s*BTRIM\(p_worker_id\)[\s\S]*?checks\.lease_expires_at\s*>\s*NOW\(\)/i,
    );
    expect(deferFunctionBody).toMatch(/GET DIAGNOSTICS updated_count\s*=\s*ROW_COUNT/i);
    expect(deferFunctionBody).toMatch(/RETURN updated_count\s*=\s*1/i);
  });

  it("keeps the CLI mirror byte-for-byte equivalent after adding the defer RPC", () => {
    const mirrorFiles = existsSync(mirrorDirectory)
      ? readdirSync(mirrorDirectory).filter((fileName) => /_concurrency_phase_two\.sql$/i.test(fileName))
      : [];
    expect(mirrorFiles).toHaveLength(1);
    const mirrorSql = readFileSync(`${mirrorDirectory}/${mirrorFiles[0]}`, "utf8");
    expect(normalized(mirrorSql)).toBe(normalized(canonicalSql));
  });

  it("defines the fenced service-role runner completion RPC", () => {
    expect(canonicalSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.complete_runner_pool_job\(\s*p_job_id UUID,\s*p_worker_id TEXT,\s*p_now TIMESTAMPTZ DEFAULT NULL\s*\)/i,
    );
    expect(completeFunctionBody).toMatch(
      /RETURNS TABLE \(\s*application_id UUID,\s*country TEXT,\s*started_at TIMESTAMPTZ\s*\)/i,
    );
    expect(completeFunctionBody).toMatch(/SECURITY DEFINER/i);
    expect(completeFunctionBody).toMatch(/SET search_path = ''/i);
    expect(completeFunctionBody).toMatch(/p_job_id IS NULL[\s\S]*?ERRCODE = '22023'/i);
    expect(completeFunctionBody).toMatch(/NULLIF\(BTRIM\(p_worker_id\), ''\) IS NULL[\s\S]*?ERRCODE = '22023'/i);
    expect(completeFunctionBody).toMatch(
      /UPDATE public\.runner_job[\s\S]*?SET status = 'succeeded'[\s\S]*?finished_at = v_now[\s\S]*?leased_by = NULL[\s\S]*?leased_until = NULL[\s\S]*?WHERE[\s\S]*?id = p_job_id[\s\S]*?status = 'running'[\s\S]*?leased_by = v_worker_id[\s\S]*?leased_until > v_now[\s\S]*?RETURNING[\s\S]*?application_id[\s\S]*?country[\s\S]*?started_at/i,
    );
    expect(canonicalSql).toMatch(
      /REVOKE ALL ON FUNCTION public\.complete_runner_pool_job\(UUID, TEXT, TIMESTAMPTZ\) FROM PUBLIC, anon, authenticated;/i,
    );
    expect(canonicalSql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.complete_runner_pool_job\(UUID, TEXT, TIMESTAMPTZ\) TO service_role;/i,
    );
  });

  it("keeps the completion RPC byte-for-byte equivalent in the CLI mirror", () => {
    const mirrorFiles = existsSync(mirrorDirectory)
      ? readdirSync(mirrorDirectory).filter((fileName) => /_concurrency_phase_two\.sql$/i.test(fileName))
      : [];
    expect(mirrorFiles).toHaveLength(1);
    const mirrorSql = readFileSync(`${mirrorDirectory}/${mirrorFiles[0]}`, "utf8");
    expect(normalized(mirrorSql)).toBe(normalized(canonicalSql));
  });

  it("defines service-role-only DB-clock runner renew and failure RPCs", () => {
    expect(canonicalSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.renew_runner_pool_job\(\s*p_job_id UUID,\s*p_worker_id TEXT,\s*p_lease_ms INTEGER DEFAULT 900000\s*\)/i,
    );
    expect(canonicalSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.fail_runner_pool_job\(\s*p_job_id UUID,\s*p_worker_id TEXT,\s*p_status TEXT,\s*p_attempts INTEGER,\s*p_last_error TEXT,\s*p_retry_after_seconds INTEGER DEFAULT 0\s*\)/i,
    );
    const renewBody = canonicalSql.match(
      /CREATE OR REPLACE FUNCTION public\.renew_runner_pool_job\([\s\S]*?\n\$\$;/i,
    )?.[0] ?? "";
    const failBody = canonicalSql.match(
      /CREATE OR REPLACE FUNCTION public\.fail_runner_pool_job\([\s\S]*?\n\$\$;/i,
    )?.[0] ?? "";
    expect(renewBody).toMatch(/clock_timestamp\(\)/i);
    expect(renewBody).toMatch(/leased_until\s*>\s*v_now/i);
    expect(renewBody).toMatch(/p_lease_ms IS NULL OR p_lease_ms < 10000 OR p_lease_ms > 7200000/i);
    expect(failBody).toMatch(/clock_timestamp\(\)/i);
    expect(failBody).toMatch(/leased_until\s*>\s*v_now/i);
    expect(failBody).toMatch(/p_status IS NULL OR p_status NOT IN \('queued', 'failed'\)/i);
    expect(failBody).toMatch(/p_retry_after_seconds IS NULL/i);
    expect(canonicalSql).toMatch(
      /REVOKE ALL ON FUNCTION public\.renew_runner_pool_job\(UUID, TEXT, INTEGER\) FROM PUBLIC, anon, authenticated;/i,
    );
    expect(canonicalSql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.renew_runner_pool_job\(UUID, TEXT, INTEGER\) TO service_role;/i,
    );
    expect(canonicalSql).toMatch(
      /REVOKE ALL ON FUNCTION public\.fail_runner_pool_job\(UUID, TEXT, TEXT, INTEGER, TEXT, INTEGER\) FROM PUBLIC, anon, authenticated;/i,
    );
    expect(canonicalSql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.fail_runner_pool_job\(UUID, TEXT, TEXT, INTEGER, TEXT, INTEGER\) TO service_role;/i,
    );
  });

  it("fences completion against the live database clock while retaining a controlled timestamp", () => {
    expect(canonicalSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.complete_runner_pool_job\(\s*p_job_id UUID,\s*p_worker_id TEXT,\s*p_now TIMESTAMPTZ DEFAULT NULL\s*\)/i,
    );
    expect(completeFunctionBody).toMatch(/v_now\s*:=\s*(?:pg_catalog\.)?clock_timestamp\(\)/i);
    expect(completeFunctionBody).not.toMatch(/v_now\s*:=\s*COALESCE\(p_now/i);
    expect(completeFunctionBody).toMatch(/v_worker_id\s*:=\s*BTRIM\(p_worker_id\)/i);
    expect(completeFunctionBody).toMatch(/leased_by\s*=\s*v_worker_id/i);
    expect(completeFunctionBody).toMatch(/leased_until\s*>\s*v_now/i);
    expect(completeFunctionBody).toMatch(/finished_at\s*=\s*v_now/i);
  });

  it("never uses an explicit p_now/coalesced clock as the lease predicate", () => {
    expect(canonicalSql).not.toMatch(
      /(?:leased_until|lease_expires_at)\s*(?:>|<=)\s*COALESCE\(\s*p_now\s*,\s*(?:pg_catalog\.)?clock_timestamp\(\)\s*\)/i,
    );
    expect(canonicalSql).not.toMatch(
      /COALESCE\(\s*p_now\s*,\s*(?:pg_catalog\.)?clock_timestamp\(\)\s*\)\s*(?:>|<=)\s*(?:leased_until|lease_expires_at)/i,
    );
  });

  it("locks the completion row before taking its post-lock clock snapshot", () => {
    assertSettlementLocksBeforeClock(completeFunctionBody);
  });

  it("locks the renewal row before taking its post-lock clock snapshot", () => {
    assertSettlementLocksBeforeClock(renewFunctionBody);
  });

  it("locks the failure row before taking its post-lock clock snapshot", () => {
    assertSettlementLocksBeforeClock(failFunctionBody);
  });

  it("keeps the renew/failure RPCs byte-for-byte equivalent in the CLI mirror", () => {
    const mirrorFiles = existsSync(mirrorDirectory)
      ? readdirSync(mirrorDirectory).filter((fileName) => /_concurrency_phase_two\.sql$/i.test(fileName))
      : [];
    expect(mirrorFiles).toHaveLength(1);
    const mirrorSql = readFileSync(`${mirrorDirectory}/${mirrorFiles[0]}`, "utf8");
    expect(normalized(mirrorSql)).toBe(normalized(canonicalSql));
  });

  it("installs the permanent expired-row compatibility trigger with metadata-only escape", () => {
    expect(canonicalSql).toMatch(
      /CREATE OR REPLACE FUNCTION runner_private\.guard_expired_runner_job_lifecycle_update\(\)\s*RETURNS trigger[\s\S]*?SECURITY DEFINER[\s\S]*?SET search_path = ''/i,
    );
    expect(triggerFunctionBody).toMatch(/OLD\.status IS DISTINCT FROM 'running'/i);
    expect(triggerFunctionBody).toMatch(/RETURN NEW;/i);
    expect(triggerFunctionBody).toMatch(/RETURN NULL;/i);
    expect(triggerFunctionBody).toMatch(
      /DELETE FROM runner_private\.runner_job_update_capability[\s\S]*?txid = pg_catalog\.txid_current\(\)[\s\S]*?backend_pid = pg_catalog\.pg_backend_pid\(\)[\s\S]*?job_id = OLD\.id[\s\S]*?operation IN[\s\S]*?'recover'[\s\S]*?'fingerprint_append'[\s\S]*?old_row = to_jsonb\(OLD\)[\s\S]*?new_row = to_jsonb\(NEW\)/i,
    );
    expect(triggerFunctionBody).toMatch(
      /to_jsonb\(NEW\) - 'metadata'\s*=\s*to_jsonb\(OLD\) - 'metadata'/i,
    );
    expect(triggerFunctionBody).toMatch(
      /IF to_jsonb\(NEW\) - 'metadata'\s*=\s*to_jsonb\(OLD\) - 'metadata'[\s\S]*?RETURN NEW;/i,
    );
    expect(triggerFunctionBody).not.toMatch(/current_setting\(|set_config\(/i);
    expect(triggerFunctionBody).toMatch(/operation IN\s*\([\s\S]*?'takeover_open'[\s\S]*?'admin_pause'[\s\S]*?'fingerprint_append'/i);
    expect(canonicalSql).toMatch(
      /CREATE TRIGGER guard_expired_runner_job_lifecycle_update\s*BEFORE UPDATE ON public\.runner_job/i,
    );
    expect(canonicalSql).toMatch(
      /DROP FUNCTION IF EXISTS public\.guard_expired_runner_job_lifecycle_update\(\);/i,
    );
    expect(canonicalSql).toMatch(
      /REVOKE ALL ON FUNCTION runner_private\.guard_expired_runner_job_lifecycle_update\(\)\s*FROM PUBLIC, anon, authenticated, service_role;/i,
    );
    expect(canonicalSql).toMatch(
      /REVOKE ALL ON TABLE runner_private\.runner_job_update_capability\s*FROM PUBLIC, anon, authenticated, service_role;/i,
    );
  });

  it("defines the fenced atomic runner submission-result writer", () => {
    expect(canonicalSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.write_runner_pool_submission_result\(\s*p_job_id UUID,\s*p_worker_id TEXT,\s*p_submission_result JSONB,\s*p_submission_result_status TEXT\s*\)/i,
    );
    expect(resultFunctionBody).toMatch(
      /RETURNS TABLE \(\s*runner_job_id UUID,\s*application_id UUID,\s*submission_result_updated_at TIMESTAMPTZ\s*\)/i,
    );
    expect(resultFunctionBody).toMatch(/SECURITY INVOKER/i);
    expect(resultFunctionBody).toMatch(/SET search_path = ''/i);
    expect(resultFunctionBody).toMatch(/p_submission_result IS NULL/i);
    expect(resultFunctionBody).toMatch(/jsonb_typeof\(p_submission_result\) <> 'object'/i);
    expect(resultFunctionBody).toMatch(/pg_column_size\(p_submission_result\) > 524288/i);
    expect(resultFunctionBody).toMatch(/NULLIF\(BTRIM\(p_submission_result_status\), ''\) IS NULL/i);
    expect(resultFunctionBody).toMatch(
      /SELECT job\.application_id\s*\n\s*INTO v_application_id[\s\S]*?FROM public\.runner_job AS job[\s\S]*?WHERE job\.id = p_job_id[\s\S]*?;[\s\S]*?SELECT application\.id[\s\S]*?FROM public\.applications AS application[\s\S]*?WHERE application\.id = v_application_id[\s\S]*?FOR UPDATE;[\s\S]*?SELECT job\.application_id, job\.leased_until[\s\S]*?FROM public\.runner_job AS job[\s\S]*?job\.status = 'running'[\s\S]*?job\.leased_by = v_worker_id[\s\S]*?FOR UPDATE/i,
    );
    expect(resultFunctionBody).toMatch(/v_now\s*:=\s*(?:pg_catalog\.)?clock_timestamp\(\)/i);
    expect(resultFunctionBody).toMatch(/v_leased_until IS NULL OR v_leased_until <= v_now/i);
    expect(resultFunctionBody).toMatch(
      /'waiting'[\s\S]*?'scheduled'[\s\S]*?'processing'[\s\S]*?'needs_user_action'[\s\S]*?'completed'[\s\S]*?'stalled'[\s\S]*?'submitted'[\s\S]*?'submitted_mock'[\s\S]*?'unsupported'[\s\S]*?'action_required'[\s\S]*?'stopped_at_sign'[\s\S]*?'stopped_at_pay'[\s\S]*?'stopped_at_review'[\s\S]*?'final_review_required'[\s\S]*?'form_ready_for_agency'[\s\S]*?'form_ready_for_kvac'[\s\S]*?'failed'/i,
    );
    expect(resultFunctionBody).toMatch(
      /UPDATE public\.applications AS application[\s\S]*?submission_result = p_submission_result[\s\S]*?submission_result_status = v_result_status[\s\S]*?submission_result_updated_at = v_now[\s\S]*?WHEN v_result_status = 'submitted' THEN 'submitted'[\s\S]*?ELSE application\.status/i,
    );
    expect(canonicalSql).toMatch(
      /REVOKE ALL ON FUNCTION public\.write_runner_pool_submission_result\(\s*UUID, TEXT, JSONB, TEXT\s*\) FROM PUBLIC, anon, authenticated;/i,
    );
    expect(canonicalSql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.write_runner_pool_submission_result\(\s*UUID, TEXT, JSONB, TEXT\s*\) TO service_role;/i,
    );
  });

  it("requires generalized full-row capabilities for every running-row mutation", () => {
    expect(canonicalSql).toMatch(
      /CREATE TABLE IF NOT EXISTS runner_private\.runner_job_update_capability[\s\S]*?operation TEXT NOT NULL CHECK[\s\S]*?'recover'[\s\S]*?'complete'[\s\S]*?'renew'[\s\S]*?'fail'[\s\S]*?'takeover_open'[\s\S]*?'admin_pause'[\s\S]*?'fingerprint_append'[\s\S]*?old_row JSONB NOT NULL[\s\S]*?new_row JSONB NOT NULL[\s\S]*?issued_at TIMESTAMPTZ/i,
    );
    expect(canonicalSql).not.toMatch(/set_config\(|current_setting\(/i);
    expect(canonicalSql).not.toMatch(/runner_recovery_capability/i);
    for (const body of [completeFunctionBody, renewFunctionBody, failFunctionBody]) {
      expect(body).toMatch(/SECURITY DEFINER/i);
      expect(body).toMatch(/INSERT INTO runner_private\.runner_job_update_capability/i);
      expect(body).toMatch(/old_row, new_row/i);
      expect(body).toMatch(/GET DIAGNOSTICS[\s\S]*?ROW_COUNT/i);
    }
  });

  it("fails closed on exact active flow tuples and quarantines invalid queued work", () => {
    expect(canonicalSql).toMatch(/Cannot enable runner flow fence while invalid running runner_job rows exist/i);
    expect(canonicalSql).toMatch(/runner_job_active_flow_key_check/i);
    for (const tuple of ["vn_prearrival", "sgac", "mdac", "tdac", "kr_eform"]) {
      expect(canonicalSql).toContain(tuple);
    }
    expect(canonicalSql).not.toMatch(/country = 'vietnam'\s+AND\s+flow_key = 'vn_evisa'/i);
    expect(canonicalSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.enqueue_sgac_country_runner_retry[\s\S]*?country, flow_key, status[\s\S]*?'singapore', 'sgac'/i,
    );
    expect(canonicalSql).toMatch(/CREATE OR REPLACE VIEW public\.runner_pool_depth[\s\S]*?flow_key = 'sgac'/i);
  });

  it("defines service-role takeover, review pause, and fingerprint RPCs", () => {
    expect(canonicalSql).toMatch(/CREATE OR REPLACE FUNCTION public\.open_runner_job_takeover/i);
    expect(canonicalSql).toMatch(/'takeover_open'/i);
    expect(canonicalSql).toMatch(/INSERT INTO public\.takeover_session/i);
    expect(canonicalSql).toMatch(/INSERT INTO public\.takeover_action_log/i);
    expect(canonicalSql).toMatch(/CREATE OR REPLACE FUNCTION public\.pause_runner_jobs_for_review/i);
    expect(canonicalSql).toMatch(/'admin_pause'/i);
    expect(canonicalSql).toMatch(/CREATE OR REPLACE FUNCTION public\.append_runner_job_fingerprint/i);
    expect(canonicalSql).toMatch(/'fingerprint_append'/i);
    expect(canonicalSql).toMatch(/fingerprint_history = v_new_history/i);
    expect(canonicalSql).toMatch(/REVOKE ALL ON FUNCTION public\.open_runner_job_takeover/i);
    expect(canonicalSql).toMatch(/REVOKE ALL ON FUNCTION public\.pause_runner_jobs_for_review/i);
    expect(canonicalSql).toMatch(/REVOKE ALL ON FUNCTION public\.append_runner_job_fingerprint/i);
  });

  it("locks takeover application first, then the exact job, before sampling time", () => {
    const applicationLock = takeoverFunctionBody.search(
      /SELECT application\.id[\s\S]*?FROM public\.applications AS application[\s\S]*?FOR UPDATE;/i,
    );
    const jobLock = takeoverFunctionBody.search(
      /SELECT job\.\*[\s\S]*?FROM public\.runner_job AS job[\s\S]*?FOR UPDATE;/i,
    );
    const clock = takeoverFunctionBody.search(/v_now\s*:=\s*pg_catalog\.clock_timestamp\(\)/i);
    expect(applicationLock).toBeGreaterThan(-1);
    expect(jobLock).toBeGreaterThan(applicationLock);
    expect(clock).toBeGreaterThan(jobLock);
    expect(takeoverFunctionBody).not.toMatch(/FOR UPDATE OF job, application/i);
  });

  it("validates failure transition shape against the locked row before minting", () => {
    const failBody = canonicalSql.match(
      /CREATE OR REPLACE FUNCTION public\.fail_runner_pool_job\([\s\S]*?\n\$\$;/i,
    )?.[0] ?? "";
    const capInsert = failBody.indexOf("INSERT INTO runner_private.runner_job_update_capability");
    const shapeCheck = failBody.search(
      /p_attempts\s*<>\s*v_old_row\.attempts\s*\+\s*1[\s\S]*?p_status\s*<>&?\s*CASE|p_status\s*IS DISTINCT FROM CASE/i,
    );
    expect(failBody).toMatch(/p_attempts\s*<>\s*v_old_row\.attempts\s*\+\s*1/i);
    expect(failBody).toMatch(/p_status\s+IS DISTINCT FROM CASE/i);
    expect(shapeCheck).toBeGreaterThan(-1);
    expect(capInsert).toBeGreaterThan(shapeCheck);
    expect(failBody).toMatch(/ERRCODE = '22023'/i);
  });

  it("gates real Postgres smoke on the actual local database URL and DB environment", () => {
    expect(integrationSource).toMatch(/new URL\(databaseUrl\)/i);
    expect(integrationSource).not.toMatch(/SUPABASE_URL|NEXT_PUBLIC_SUPABASE_URL/);
    expect(integrationSource).toMatch(
      /current_setting\('app\.viza_environment', true\)/i,
    );
    expect(integrationSource).toMatch(
      /allowedDatabaseEnvironments = new Set\(\[[\s\S]*?local[\s\S]*?local-test[\s\S]*?test[\s\S]*?development/i,
    );
    expect(integrationSource).toMatch(
      /if \(!allowedDatabaseEnvironments\.has\(databaseEnvironment\)\)[\s\S]*?throw new Error/i,
    );
    const environmentCheckIndex = integrationSource.indexOf("current_setting('app.viza_environment'");
    const advisoryLockIndex = integrationSource.indexOf("pg_advisory_lock");
    expect(environmentCheckIndex).toBeGreaterThan(-1);
    expect(advisoryLockIndex).toBeGreaterThan(environmentCheckIndex);
  });

  it("keeps the trigger and result RPC in the CLI mirror", () => {
    const mirrorFiles = existsSync(mirrorDirectory)
      ? readdirSync(mirrorDirectory).filter((fileName) => /_concurrency_phase_two\.sql$/i.test(fileName))
      : [];
    expect(mirrorFiles).toHaveLength(1);
    const mirrorSql = readFileSync(`${mirrorDirectory}/${mirrorFiles[0]}`, "utf8");
    expect(normalized(mirrorSql)).toBe(normalized(canonicalSql));
  });

  it("uses COALESCE false for every active tuple predicate and quarantines null queued rows", () => {
    expect(canonicalSql).toMatch(
      /WHERE status = 'queued'\s+AND NOT COALESCE\(\([\s\S]*?flow_key = 'kr_eform'[\s\S]*?\), FALSE\);/i,
    );
    expect(canonicalSql).toMatch(
      /CHECK \(\s*status NOT IN \('queued', 'running'\)[\s\S]*?OR COALESCE\([\s\S]*?\), FALSE\)\s*\);/i,
    );
    const activeTupleMatches = canonicalSql.match(/\b(?:expired|oldest_candidate|candidate|active|rj)\.flow_key = 'kr_eform'/gi) ?? [];
    expect(activeTupleMatches.length).toBeGreaterThanOrEqual(5);
    expect(canonicalSql).not.toMatch(
      /status = 'running'\s+AND NOT \(\s*\(country = 'vietnam'/i,
    );
  });

  it("redefines enqueue with the exact five tuple identity and application-first locking", () => {
    expect(canonicalSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.enqueue_runner_pool_job\(\s*p_application_id UUID,\s*p_country TEXT,\s*p_flow_key TEXT,\s*p_available_at TIMESTAMPTZ DEFAULT NOW\(\),\s*p_max_attempts INTEGER DEFAULT 3,\s*p_correlation_id TEXT DEFAULT NULL,\s*p_metadata JSONB DEFAULT '\{\}'::JSONB,\s*p_now TIMESTAMPTZ DEFAULT NOW\(\)\s*\)/i,
    );
    expect(enqueueFunctionBody).toMatch(/SECURITY DEFINER/i);
    expect(enqueueFunctionBody).toMatch(/SET search_path = ''/i);
    expect(enqueueFunctionBody).toMatch(/v_now\s*:=\s*pg_catalog\.clock_timestamp\(\)/i);
    expect(enqueueFunctionBody).toMatch(/SELECT application\.status[\s\S]*?FROM public\.applications AS application[\s\S]*?FOR UPDATE;/i);
    expect(enqueueFunctionBody).toMatch(/v_application_status = 'staff_action_required'/i);
    expect(enqueueFunctionBody).toMatch(/PERFORM rj\.id[\s\S]*?FROM public\.runner_job AS rj[\s\S]*?FOR UPDATE;/i);
    expect(enqueueFunctionBody).toMatch(/v_runner\.country = v_country AND v_runner\.flow_key = v_flow/i);
    expect(enqueueFunctionBody).not.toMatch(/vn_evisa|id_c1|id_b1_evoa|indonesia/i);
    const sgacBody = canonicalSql.match(
      /CREATE OR REPLACE FUNCTION public\.enqueue_sgac_country_runner_retry\([\s\S]*?\n\$\$;/i,
    )?.[0] ?? "";
    expect(sgacBody).toMatch(/v_application_status = 'staff_action_required'/i);
    expect(canonicalSql).toMatch(
      /REVOKE ALL ON FUNCTION public\.enqueue_runner_pool_job\(\s*UUID, TEXT, TEXT, TIMESTAMPTZ, INTEGER, TEXT, JSONB, TIMESTAMPTZ\s*\)[\s\S]*?GRANT EXECUTE ON FUNCTION public\.enqueue_runner_pool_job\([\s\S]*?\) TO service_role;/i,
    );
  });

  it("fences queued-to-running claims with an exact claim capability and insert guard", () => {
    expect(canonicalSql).toMatch(
      /operation TEXT NOT NULL CHECK \(operation IN \([\s\S]*?'claim'[\s\S]*?'fingerprint_append'/i,
    );
    expect(functionBody).toMatch(
      /v_claimed_old_row[\s\S]*?v_claimed_new_row[\s\S]*?operation, old_row, new_row[\s\S]*?'claim'[\s\S]*?UPDATE public\.runner_job AS claimed/i,
    );
    expect(functionBody).toMatch(
      /SELECT job\.\*[\s\S]*?WHERE job\.id = v_claimed_job_id[\s\S]*?FOR UPDATE;[\s\S]*?v_now\s*:=\s*pg_catalog\.clock_timestamp\(\)[\s\S]*?v_claimed_old_row\.available_at > v_now/i,
    );
    expect(functionBody).toMatch(
      /v_claimed_old_row\.available_at > v_now[\s\S]*?owner_machine_id = v_worker_id[\s\S]*?owner_kind = 'pool'[\s\S]*?lease_until > v_now[\s\S]*?FOR UPDATE;/i,
    );
    expect(triggerFunctionBody).toMatch(
      /OLD\.status IS DISTINCT FROM 'running'[\s\S]*?NEW\.status IS NOT DISTINCT FROM 'running'[\s\S]*?operation = 'claim'[\s\S]*?old_row = to_jsonb\(OLD\)[\s\S]*?new_row = to_jsonb\(NEW\)/i,
    );
    expect(canonicalSql).toMatch(
      /CREATE TRIGGER guard_runner_job_running_insert\s*BEFORE INSERT ON public\.runner_job/i,
    );
    expect(insertGuardFunctionBody).toMatch(/NEW\.status IS NOT DISTINCT FROM 'running'/i);
    expect(insertGuardFunctionBody).toMatch(/NEW\.status IS NOT DISTINCT FROM 'queued'/i);
    expect(insertGuardFunctionBody).toMatch(/FROM public\.applications AS application[\s\S]*?application\.id = NEW\.application_id[\s\S]*?FOR UPDATE;/i);
    expect(insertGuardFunctionBody).toMatch(/v_application_status = 'staff_action_required'/i);
    expect(insertGuardFunctionBody).toMatch(/IF NOT COALESCE\([\s\S]*?NEW\.country = 'vietnam'[\s\S]*?NEW\.flow_key = 'kr_eform'/i);
    expect(insertGuardFunctionBody).toMatch(/ERRCODE = '23514'/i);
    expect(triggerFunctionBody).toMatch(
      /NEW\.status IS NOT DISTINCT FROM 'queued'[\s\S]*?OLD\.status IS DISTINCT FROM 'running'[\s\S]*?FROM public\.applications AS application[\s\S]*?FOR UPDATE NOWAIT[\s\S]*?v_application_status = 'staff_action_required'/i,
    );
  });

  it("locks the application before jobs when pausing review", () => {
    const applicationLock = pauseFunctionBody.search(
      /FROM public\.applications AS application[\s\S]*?WHERE application\.id = p_application_id[\s\S]*?FOR UPDATE;/i,
    );
    const jobLock = pauseFunctionBody.search(/FOR v_job IN[\s\S]*?FOR UPDATE/i);
    expect(applicationLock).toBeGreaterThan(-1);
    expect(jobLock).toBeGreaterThan(applicationLock);
    expect(pauseFunctionBody).toMatch(/RETURN 0;/i);
  });

  it("defines service-role-only atomic cancellation with policy-derived status", () => {
    expect(canonicalSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.cancel_application_submission\(\s*p_application_id UUID,\s*p_queue_id UUID,\s*p_transport TEXT\s*\)/i,
    );
    expect(cancelFunctionBody).toMatch(
      /RETURNS TABLE \(\s*cancelled BOOLEAN,\s*queue_id UUID,\s*queue_transport TEXT,\s*cancelled_at TIMESTAMPTZ\s*\)/i,
    );
    expect(cancelFunctionBody).toMatch(/SECURITY DEFINER/i);
    expect(cancelFunctionBody).toMatch(/SET search_path = ''/i);
    expect(cancelFunctionBody).toMatch(/job\.application_id = p_application_id[\s\S]*?job\.status = 'queued'[\s\S]*?job\.leased_by IS NULL[\s\S]*?job\.leased_until IS NULL/i);
    expect(cancelFunctionBody).toMatch(/queue\.application_id = p_application_id[\s\S]*?queue\.locked_by IS NULL[\s\S]*?queue\.locked_until IS NULL/i);
    expect(cancelFunctionBody).toMatch(/UPDATE public\.applications AS application[\s\S]*?status = 'draft'/i);
    expect(cancelFunctionBody).toMatch(/GET DIAGNOSTICS v_updated_rows = ROW_COUNT[\s\S]*?UPDATE public\.applications AS application[\s\S]*?GET DIAGNOSTICS v_updated_rows = ROW_COUNT/i);
    expect(cancelFunctionBody).toMatch(/MY_MDAC_ARRIVAL_CARD|TH_TDAC_ARRIVAL_CARD|VN_PREARRIVAL_DECLARATION/i);
    expect(cancelFunctionBody).not.toMatch(/p_cancelled_status|p_reason/i);
    expect(canonicalSql).toMatch(
      /REVOKE ALL ON FUNCTION public\.cancel_application_submission\(UUID, UUID, TEXT\)[\s\S]*?GRANT EXECUTE ON FUNCTION public\.cancel_application_submission\(UUID, UUID, TEXT\)\s+TO service_role;/i,
    );
  });

  it("defines deterministic session-application-job takeover settlement", () => {
    expect(canonicalSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.settle_runner_job_takeover\(\s*p_takeover_id UUID,\s*p_actor_user_id UUID,\s*p_outcome TEXT,\s*p_operator_notes TEXT DEFAULT NULL,\s*p_answers_written INTEGER DEFAULT 0\s*\)/i,
    );
    expect(takeoverSettlementFunctionBody).toMatch(
      /RETURNS TABLE \(\s*settled BOOLEAN,\s*job_id UUID,\s*application_id UUID,\s*job_status TEXT\s*\)/i,
    );
    expect(takeoverSettlementFunctionBody).toMatch(/p_outcome NOT IN \('completed', 'abandoned'\)/i);
    const sessionLock = takeoverSettlementFunctionBody.search(/FROM public\.takeover_session AS session[\s\S]*?FOR UPDATE;/i);
    const applicationLock = takeoverSettlementFunctionBody.search(/FROM public\.applications AS application[\s\S]*?FOR UPDATE;/i);
    const jobLock = takeoverSettlementFunctionBody.search(/FROM public\.runner_job AS job[\s\S]*?FOR UPDATE;/i);
    expect(sessionLock).toBeGreaterThan(-1);
    expect(applicationLock).toBeGreaterThan(sessionLock);
    expect(jobLock).toBeGreaterThan(applicationLock);
    expect(takeoverSettlementFunctionBody).toMatch(/session\.status NOT IN \('queued', 'claimed'\)/i);
    expect(takeoverSettlementFunctionBody).toMatch(/UPDATE public\.takeover_session[\s\S]*?GET DIAGNOSTICS v_updated_rows = ROW_COUNT[\s\S]*?UPDATE public\.runner_job[\s\S]*?GET DIAGNOSTICS v_updated_rows = ROW_COUNT/i);
    expect(takeoverSettlementFunctionBody).toMatch(/Takeover action log write failed/i);
    expect(takeoverSettlementFunctionBody).toMatch(/job\.status = 'needs_human'/i);
    expect(takeoverSettlementFunctionBody).toMatch(/INSERT INTO public\.takeover_action_log/i);
    expect(takeoverSettlementFunctionBody).toMatch(/status = p_outcome[\s\S]*?closed_at = v_now/i);
    expect(takeoverSettlementFunctionBody).toMatch(/status = v_job_status[\s\S]*?finished_at = v_now/i);
    expect(canonicalSql).toMatch(
      /REVOKE ALL ON FUNCTION public\.settle_runner_job_takeover\(\s*UUID, UUID, TEXT, TEXT, INTEGER\s*\)[\s\S]*?GRANT EXECUTE ON FUNCTION public\.settle_runner_job_takeover\([\s\S]*?\) TO service_role;/i,
    );
  });
});

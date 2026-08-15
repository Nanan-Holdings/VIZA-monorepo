import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const canonicalPath = fileURLToPath(
  new URL("../../drizzle/0139_concurrency_phase_two.sql", import.meta.url),
);
const mirrorDirectory = fileURLToPath(
  new URL("../../../../viza-fe/internal-website/supabase/migrations/", import.meta.url),
);
const canonicalSql = existsSync(canonicalPath) ? readFileSync(canonicalPath, "utf8") : "";
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
  /CREATE OR REPLACE FUNCTION public\.guard_expired_runner_job_lifecycle_update\([\s\S]*?\n\$\$;/i,
)?.[0] ?? "";
const resultFunctionBody = canonicalSql.match(
  /CREATE OR REPLACE FUNCTION public\.write_runner_pool_submission_result\([\s\S]*?\n\$\$;/i,
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
    /IF\s+v_leased_until\s*<=\s*v_now\s+THEN[\s\S]*?RETURN;/i,
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
  });

  it("rejects null lease, slot-policy, and clock inputs explicitly", () => {
    expect(functionBody).toMatch(
      /IF p_lease_ms IS NULL OR p_lease_ms < 10000 OR p_lease_ms > 7200000 THEN[\s\S]*?ERRCODE = '22023'/i,
    );
    expect(functionBody).toMatch(
      /IF p_require_slot IS NULL THEN[\s\S]*?ERRCODE = '22023'/i,
    );
    expect(functionBody).toMatch(
      /IF p_now IS NULL THEN[\s\S]*?ERRCODE = '22023'/i,
    );
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
      /set_config\(\s*'viza\.runner_recovery_job_id'[\s\S]*?set_config\(\s*'viza\.runner_recovery_now'[\s\S]*?UPDATE public\.runner_job AS job[\s\S]*?WHERE job\.id = v_expired_job_id[\s\S]*?job\.status = 'running'[\s\S]*?job\.leased_until <= p_now[\s\S]*?set_config\(\s*'viza\.runner_recovery_job_id',\s*'',\s*TRUE[\s\S]*?set_config\(\s*'viza\.runner_recovery_now',\s*'',\s*TRUE/i,
    );
  });

  it("checks a live pool machine slot before claiming when required", () => {
    expect(functionBody).toMatch(
      /IF p_require_slot THEN[\s\S]*?PERFORM 1[\s\S]*?FROM public\.runner_machine_slot AS rms[\s\S]*?rms\.owner_machine_id = p_worker_id[\s\S]*?rms\.owner_kind = 'pool'[\s\S]*?rms\.lease_until > p_now[\s\S]*?FOR UPDATE[\s\S]*?IF NOT FOUND THEN[\s\S]*?RETURN;/i,
    );
  });

  it("serializes one live running job per matching pool slot owner", () => {
    expect(canonicalSql).toMatch(
      /CREATE INDEX IF NOT EXISTS runner_job_running_owner_lease_idx\s+ON public\.runner_job \(leased_by, leased_until\)\s+WHERE status = 'running';/i,
    );
    expect(functionBody).toMatch(
      /IF p_require_slot THEN[\s\S]*?FOR UPDATE[\s\S]*?IF EXISTS \([\s\S]*?FROM public\.runner_job AS owned[\s\S]*?owned\.status = 'running'[\s\S]*?owned\.leased_by = p_worker_id[\s\S]*?owned\.leased_until > p_now[\s\S]*?THEN[\s\S]*?RETURN;/i,
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
      /SELECT cap\.country[\s\S]*?FROM public\.runner_concurrency_cap AS cap[\s\S]*?JOIN LATERAL \([\s\S]*?oldest_candidate\.status = 'queued'[\s\S]*?oldest_candidate\.available_at <= p_now[\s\S]*?ORDER BY oldest_candidate\.enqueued_at, oldest_candidate\.id, cap\.country[\s\S]*?LIMIT 1[\s\S]*?FOR UPDATE OF cap SKIP LOCKED/i,
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
      /LATERAL\s*\([\s\S]*?FROM public\.runner_job AS oldest_candidate[\s\S]*?oldest_candidate\.status = 'queued'[\s\S]*?oldest_candidate\.available_at <= p_now[\s\S]*?ORDER BY oldest_candidate\.enqueued_at, oldest_candidate\.id[\s\S]*?LIMIT 1/i,
    );
    expect(functionBody).toMatch(
      /ORDER BY oldest_candidate\.enqueued_at, oldest_candidate\.id, cap\.country[\s\S]*?FOR UPDATE OF cap SKIP LOCKED/i,
    );
    expect(functionBody).toMatch(/v_tried_countries\s*\|\|\s*v_locked_country/i);
  });

  it("only considers due queued jobs below an unpaused per-country cap", () => {
    expect(functionBody).toMatch(/candidate\.status = 'queued'/i);
    expect(functionBody).toMatch(/candidate\.available_at <= p_now/i);
    expect(functionBody).toMatch(/NOT cap\.paused/i);
    expect(functionBody).toMatch(
      /SELECT COUNT\(\*\)[\s\S]*?active\.country = candidate\.country[\s\S]*?active\.status = 'running'[\s\S]*?< cap\.max_concurrent/i,
    );
    expect(functionBody).not.toMatch(/'indonesia'/i);
  });

  it("updates queued jobs into leased running rows and returns the established columns", () => {
    expect(functionBody).toMatch(
      /UPDATE public\.runner_job AS claimed[\s\S]*?SET status = 'running'[\s\S]*?leased_by = p_worker_id[\s\S]*?leased_until = p_now \+ p_lease_ms \* INTERVAL '1 millisecond'[\s\S]*?started_at = p_now[\s\S]*?finished_at = NULL[\s\S]*?last_error = NULL/i,
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
      /runner_job_pool_claim_idx[\s\S]*?rolling compatibility/i,
    );
    expect(canonicalSql).toMatch(
      /CREATE INDEX IF NOT EXISTS runner_job_running_country_idx\s+ON public\.runner_job \(country\)\s+WHERE status = 'running';/i,
    );
    expect(canonicalSql).toMatch(
      /CREATE INDEX IF NOT EXISTS runner_job_running_lease_idx\s+ON public\.runner_job \(leased_until\)[\s\S]*?WHERE status = 'running';/i,
    );
  });

  it("hardens execution privileges and function search path", () => {
    expect(functionBody).toMatch(/SECURITY INVOKER/i);
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
    expect(completeFunctionBody).toMatch(/SECURITY INVOKER/i);
    expect(completeFunctionBody).toMatch(/SET search_path = ''/i);
    expect(completeFunctionBody).toMatch(/p_job_id IS NULL[\s\S]*?ERRCODE = '22023'/i);
    expect(completeFunctionBody).toMatch(/NULLIF\(BTRIM\(p_worker_id\), ''\) IS NULL[\s\S]*?ERRCODE = '22023'/i);
    expect(completeFunctionBody).toMatch(
      /UPDATE public\.runner_job[\s\S]*?SET status = 'succeeded'[\s\S]*?finished_at = COALESCE\(p_now, v_now\)[\s\S]*?leased_by = NULL[\s\S]*?leased_until = NULL[\s\S]*?WHERE[\s\S]*?id = p_job_id[\s\S]*?status = 'running'[\s\S]*?leased_by = v_worker_id[\s\S]*?leased_until > v_now[\s\S]*?RETURNING[\s\S]*?application_id[\s\S]*?country[\s\S]*?started_at/i,
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
    expect(completeFunctionBody).toMatch(/finished_at\s*=\s*COALESCE\(p_now, v_now\)/i);
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
      /CREATE OR REPLACE FUNCTION public\.guard_expired_runner_job_lifecycle_update\(\)\s*RETURNS trigger[\s\S]*?SECURITY DEFINER[\s\S]*?SET search_path = ''/i,
    );
    expect(triggerFunctionBody).toMatch(
      /NEW\.status IS DISTINCT FROM OLD\.status[\s\S]*?NEW\.available_at IS DISTINCT FROM OLD\.available_at/i,
    );
    expect(triggerFunctionBody).toMatch(/RETURN NEW;/i);
    expect(triggerFunctionBody).toMatch(/RETURN NULL;/i);
    expect(triggerFunctionBody).toMatch(/current_setting\('viza\.runner_recovery_job_id', TRUE\)/i);
    expect(triggerFunctionBody).toMatch(/current_setting\('viza\.runner_recovery_now', TRUE\)/i);
    expect(triggerFunctionBody).toMatch(/v_marker_job_id::UUID/i);
    expect(triggerFunctionBody).toMatch(/v_marker_now_text::TIMESTAMPTZ/i);
    expect(triggerFunctionBody).toMatch(/NEW\.application_id IS DISTINCT FROM OLD\.application_id/i);
    expect(triggerFunctionBody).toMatch(/NEW\.metadata IS DISTINCT FROM OLD\.metadata/i);
    expect(triggerFunctionBody).toMatch(/NEW\.attempts IS DISTINCT FROM OLD\.attempts \+ 1/i);
    expect(triggerFunctionBody).toMatch(/NEW\.leased_by IS NOT NULL/i);
    expect(canonicalSql).toMatch(
      /CREATE TRIGGER guard_expired_runner_job_lifecycle_update\s*BEFORE UPDATE ON public\.runner_job/i,
    );
    expect(canonicalSql).toMatch(
      /REVOKE ALL ON FUNCTION public\.guard_expired_runner_job_lifecycle_update\(\)\s*FROM PUBLIC, anon, authenticated, service_role;/i,
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
    expect(resultFunctionBody).toMatch(/NULLIF\(BTRIM\(p_submission_result_status\), ''\) IS NULL/i);
    expect(resultFunctionBody).toMatch(
      /SELECT job\.application_id, job\.leased_until[\s\S]*?job\.status = 'running'[\s\S]*?job\.leased_by = v_worker_id[\s\S]*?FOR UPDATE/i,
    );
    expect(resultFunctionBody).toMatch(/v_now\s*:=\s*(?:pg_catalog\.)?clock_timestamp\(\)/i);
    expect(resultFunctionBody).toMatch(/v_leased_until IS NULL OR v_leased_until <= v_now/i);
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

  it("keeps the trigger and result RPC in the CLI mirror", () => {
    const mirrorFiles = existsSync(mirrorDirectory)
      ? readdirSync(mirrorDirectory).filter((fileName) => /_concurrency_phase_two\.sql$/i.test(fileName))
      : [];
    expect(mirrorFiles).toHaveLength(1);
    const mirrorSql = readFileSync(`${mirrorDirectory}/${mirrorFiles[0]}`, "utf8");
    expect(normalized(mirrorSql)).toBe(normalized(canonicalSql));
  });
});

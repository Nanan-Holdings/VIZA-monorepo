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
      /expired AS MATERIALIZED \([\s\S]*?FROM public\.runner_job AS expired[\s\S]*?ORDER BY[\s\S]*?LIMIT 1[\s\S]*?FOR UPDATE SKIP LOCKED[\s\S]*?\)/i,
    );
    expect(canonicalSql).toMatch(
      /UPDATE public\.runner_job AS job[\s\S]*?FROM expired[\s\S]*?WHERE job\.id = expired\.id[\s\S]*?job\.status = 'running'[\s\S]*?job\.leased_until <= p_now/i,
    );
  });

  it("checks a live pool machine slot before claiming when required", () => {
    expect(functionBody).toMatch(
      /IF p_require_slot THEN[\s\S]*?PERFORM 1[\s\S]*?FROM public\.runner_machine_slot AS rms[\s\S]*?rms\.owner_machine_id = p_worker_id[\s\S]*?rms\.owner_kind = 'pool'[\s\S]*?rms\.lease_until > p_now[\s\S]*?FOR UPDATE[\s\S]*?IF NOT FOUND THEN[\s\S]*?RETURN;/i,
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
});

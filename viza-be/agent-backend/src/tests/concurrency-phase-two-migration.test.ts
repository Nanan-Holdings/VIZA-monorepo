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

describe("runner pool concurrency phase two migration", () => {
  it("defines the exact service-role claim RPC identity and return contract", () => {
    expect(canonicalSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.claim_runner_pool_job\(\s*p_worker_id TEXT,\s*p_lease_ms INTEGER DEFAULT 900000,\s*p_require_slot BOOLEAN DEFAULT TRUE,\s*p_now TIMESTAMPTZ DEFAULT NOW\(\)\s*\)/i,
    );
    expect(canonicalSql).toMatch(
      /RETURNS TABLE \(\s*id UUID,\s*application_id UUID,\s*country TEXT,\s*flow_key TEXT,\s*attempts INTEGER,\s*max_attempts INTEGER,\s*correlation_id TEXT,\s*metadata JSONB\s*\)/i,
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
      /p_require_slot\s+AND\s+NOT EXISTS \([\s\S]*?FROM public\.runner_machine_slot AS rms[\s\S]*?rms\.owner_machine_id = p_worker_id[\s\S]*?rms\.owner_kind = 'pool'[\s\S]*?rms\.lease_until > p_now/i,
    );
  });

  it("locks one candidate and its country cap through a materialized ordered CTE", () => {
    expect(functionBody).toMatch(
      /selected AS MATERIALIZED \([\s\S]*?FROM public\.runner_job AS candidate[\s\S]*?JOIN public\.runner_concurrency_cap AS cap[\s\S]*?FOR UPDATE OF candidate, cap SKIP LOCKED/i,
    );
    expect(functionBody).toMatch(/ORDER BY candidate\.country, candidate\.enqueued_at, candidate\.id/i);
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
      /CREATE INDEX IF NOT EXISTS runner_job_queued_available_idx\s+ON public\.runner_job \(available_at, enqueued_at, id\)\s+WHERE status = 'queued';/i,
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
});

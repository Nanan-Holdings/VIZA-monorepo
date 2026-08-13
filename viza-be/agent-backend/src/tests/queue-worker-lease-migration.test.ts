import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL("../../drizzle/0137_queue_worker_leases_and_runtime_claims.sql", import.meta.url),
);
const sql = readFileSync(migrationPath, "utf8");

describe("queue worker lease migration", () => {
  it("uses nonblocking atomic notification claims and conditional settlements", () => {
    expect(sql).toMatch(/claim_notification_event_batch[\s\S]*FOR UPDATE SKIP LOCKED/i);
    expect(sql).toMatch(/ack_notification_event[\s\S]*worker_id = p_worker_id[\s\S]*lease_expires_at > NOW\(\)/i);
    expect(sql).toMatch(/nack_notification_event[\s\S]*INSERT INTO public\.notification_dlq/i);
    expect(sql).toMatch(/SECURITY INVOKER/gi);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.claim_notification_event_batch[\s\S]*PUBLIC, anon, authenticated/i);
  });

  it("keeps legacy and worker-aware Vietnam claim signatures during rolling deploys", () => {
    expect(sql).toMatch(/claim_vn_official_status_checks\(\s*p_worker_id TEXT,[\s\S]*p_lease_seconds INTEGER DEFAULT 300/i);
    expect(sql).toMatch(/claim_vn_official_status_checks\(\s*p_limit INTEGER DEFAULT 5\s*\)/i);
    expect(sql).toMatch(/FROM public\.claim_vn_official_status_checks\(\s*'vn-status-legacy-compat',\s*p_limit,\s*300/i);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.claim_vn_official_status_checks\(INTEGER\)[\s\S]*TO service_role/i);
    expect(sql).toMatch(/complete_vn_official_status_check[\s\S]*next_status NOT IN \('completed', 'cancelled'\)/i);
  });

  it("extends the generic claim without breaking callers that pass only the five established arguments", () => {
    expect(sql).toMatch(/p_target_job_id UUID DEFAULT NULL,[\s\S]*p_max_attempts INTEGER DEFAULT 3,[\s\S]*p_provider_allowlist TEXT\[\] DEFAULT NULL,[\s\S]*p_allow_failed BOOLEAN DEFAULT FALSE/i);
    expect(sql).toMatch(/COALESCE\(CARDINALITY\(p_provider_allowlist\), 0\) = 0/i);
    expect(sql).toMatch(/COALESCE\(p_allow_failed, FALSE\)[\s\S]*p_target_job_id IS NOT NULL/i);
  });
});

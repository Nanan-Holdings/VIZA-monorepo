import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const canonicalPath = fileURLToPath(
  new URL("../../drizzle/0150_vn_status_settlement_fence.sql", import.meta.url),
);
const mirrorPath = fileURLToPath(
  new URL(
    "../../../../viza-fe/internal-website/supabase/migrations/20260816161000_vietnam_status_settlement_fence.sql",
    import.meta.url,
  ),
);
const schemaPath = fileURLToPath(new URL("../db/schema.ts", import.meta.url));
const canonicalSql = existsSync(canonicalPath) ? readFileSync(canonicalPath, "utf8") : "";
const mirrorSql = existsSync(mirrorPath) ? readFileSync(mirrorPath, "utf8") : "";
const schemaSource = existsSync(schemaPath) ? readFileSync(schemaPath, "utf8") : "";
const normalize = (source: string): string => source.replace(/\r\n/g, "\n").trimEnd();

const functionBody = (name: string): string =>
  canonicalSql.match(
    new RegExp(
      `CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?\\n\\$\\$;`,
      "i",
    ),
  )?.[0] ?? "";

describe("Vietnam status settlement fence migration", () => {
  it("ships a byte-identical canonical and Supabase CLI mirror", () => {
    expect(existsSync(canonicalPath)).toBe(true);
    expect(existsSync(mirrorPath)).toBe(true);
    expect(normalize(mirrorSql)).toBe(normalize(canonicalSql));
  });

  it("adds a monotonic BIGINT lease generation and claim identity", () => {
    expect(canonicalSql).toMatch(
      /ALTER TABLE public\.official_status_checks[\s\S]*?ADD COLUMN IF NOT EXISTS lease_generation BIGINT NOT NULL DEFAULT 0/i,
    );
    expect(schemaSource).toMatch(
      /leaseGeneration:\s*bigint\("lease_generation",\s*\{\s*mode:\s*"number"\s*\}\)\.default\(0\)\.notNull\(\)/,
    );
    expect(canonicalSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.claim_vn_official_status_checks\(\s*p_worker_id TEXT,\s*p_limit INTEGER DEFAULT 1,\s*p_lease_seconds INTEGER DEFAULT 300\s*\)/i,
    );
    expect(canonicalSql).toMatch(/RETURNS SETOF public\.official_status_checks/i);
    expect(canonicalSql).toMatch(/lease_generation\s*=\s*checks\.lease_generation\s*\+\s*1/i);
    expect(canonicalSql).toMatch(/FOR UPDATE(?: OF candidate)? SKIP LOCKED/i);
    expect(canonicalSql).toMatch(/candidate\.status\s*=\s*'queued'/i);
    expect(canonicalSql).toMatch(/candidate\.lease_expires_at\s*<=\s*(?:v_now|clock_timestamp\(\))/i);
    expect(canonicalSql).not.toMatch(/claim_vn_official_status_checks\(\s*p_limit INTEGER DEFAULT 5\s*\)/i);
    expect(canonicalSql).not.toMatch(/CREATE OR REPLACE FUNCTION public\.claim_vn_official_status_checks\(INTEGER\)/i);
  });

  it("requires generation and live ownership for renew/defer/fail/complete", () => {
    expect(canonicalSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.renew_vn_official_status_check\(\s*p_check_id UUID,\s*p_worker_id TEXT,\s*p_lease_generation BIGINT,\s*p_lease_seconds INTEGER\s*\)[\s\S]*?RETURNS TABLE\s*\(\s*id UUID,\s*lease_generation BIGINT,\s*lease_expires_at TIMESTAMPTZ\s*\)/i,
    );
    expect(canonicalSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.defer_vn_official_status_check\(\s*p_check_id UUID,\s*p_worker_id TEXT,\s*p_lease_generation BIGINT,\s*p_retry_after_seconds INTEGER DEFAULT 30\s*\)/i,
    );
    expect(canonicalSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.fail_vn_official_status_check\(\s*p_check_id UUID,\s*p_worker_id TEXT,\s*p_lease_generation BIGINT,\s*p_error_code TEXT,\s*p_error_message TEXT,\s*p_raw_status_json JSONB DEFAULT '\{\}'::JSONB\s*\)/i,
    );
    expect(canonicalSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.complete_vn_official_status_check\(\s*p_check_id UUID,\s*p_worker_id TEXT,\s*p_lease_generation BIGINT,\s*p_patch JSONB DEFAULT '\{\}'::JSONB\s*\)/i,
    );
    for (const name of [
      "renew_vn_official_status_check",
      "defer_vn_official_status_check",
      "fail_vn_official_status_check",
      "complete_vn_official_status_check",
    ]) {
      const body = functionBody(name);
      expect(body).toMatch(/SECURITY DEFINER/i);
      expect(body).toMatch(/SET search_path\s*=\s*''/i);
      expect(body).toMatch(/clock_timestamp\(\)/i);
      expect(body).toMatch(/lease_generation\s*=\s*p_lease_generation/i);
      expect(body).toMatch(/lease_expires_at\s*>\s*v_now/i);
      expect(body).toMatch(/GET DIAGNOSTICS/i);
    }
    expect(canonicalSql).toMatch(/REVOKE ALL ON FUNCTION public\.renew_vn_official_status_check\(UUID, TEXT, BIGINT, INTEGER\)[\s\S]*?FROM PUBLIC, anon, authenticated/i);
    expect(canonicalSql).toMatch(/GRANT EXECUTE ON FUNCTION public\.renew_vn_official_status_check\(UUID, TEXT, BIGINT, INTEGER\)[\s\S]*?TO service_role/i);
    expect(canonicalSql).not.toMatch(/CREATE OR REPLACE FUNCTION public\.complete_vn_official_status_check\(UUID, TEXT, JSONB\)/i);
    expect(canonicalSql).not.toMatch(/CREATE OR REPLACE FUNCTION public\.fail_vn_official_status_check\(UUID, TEXT, TEXT, TEXT, JSONB\)/i);
    expect(canonicalSql).not.toMatch(/CREATE OR REPLACE FUNCTION public\.defer_vn_official_status_check\(UUID, TEXT, INTEGER\)/i);
  });

  it("validates nulls, bounds, patch keys, and deterministic full-SHA artifacts", () => {
    const complete = functionBody("complete_vn_official_status_check");
    const fail = functionBody("fail_vn_official_status_check");
    expect(complete).toMatch(/p_check_id IS NULL[\s\S]*?ERRCODE\s*=\s*'22023'/i);
    expect(complete).toMatch(/p_lease_generation IS NULL[\s\S]*?ERRCODE\s*=\s*'22023'/i);
    expect(complete).toMatch(/JSONB_TYPEOF\(v_patch\)\s*<>\s*'object'[\s\S]*?22023/i);
    expect(complete).toMatch(/PG_COLUMN_SIZE\(v_patch\)\s*>\s*524288[\s\S]*?22023/i);
    expect(complete).toMatch(/JSONB_OBJECT_KEYS[\s\S]*?official_reference[\s\S]*?visa_number[\s\S]*?application_url[\s\S]*?artifact_sha256/i);
    expect(complete).toMatch(/v_expected_pattern\s+TEXT[\s\S]*?evisa-\[0-9a-f\]\{64\}\[\.\]pdf/i);
    expect(complete).toMatch(/artifact_sha256[\s\S]*?\[0-9a-f\]\{64\}/i);
    expect(fail).toMatch(/p_error_message[\s\S]*?500/i);
    expect(fail).toMatch(/JSONB_TYPEOF\(v_raw\)\s*<>\s*'object'/i);
    expect(canonicalSql).toMatch(/RAISE EXCEPTION[\s\S]*?USING ERRCODE\s*=\s*'22023'/i);
  });

  it("settles all Vietnam status side effects atomically and idempotently", () => {
    const complete = functionBody("complete_vn_official_status_check");
    const fail = functionBody("fail_vn_official_status_check");
    expect(complete).toMatch(/SELECT application_id INTO v_application_id[\s\S]*?FROM public\.official_status_checks[\s\S]*?SELECT \* INTO v_application[\s\S]*?FROM public\.applications[\s\S]*?FOR UPDATE[\s\S]*?SELECT \* INTO v_check[\s\S]*?FROM public\.official_status_checks[\s\S]*?FOR UPDATE/i);
    expect(complete).toMatch(/FROM public\.official_application_tracking[\s\S]*?FOR UPDATE/i);
    expect(complete).toMatch(/UPDATE public\.applications/i);
    expect(complete).toMatch(/UPDATE public\.official_application_tracking/i);
    expect(complete).toMatch(/INSERT INTO public\.application_documents/i);
    expect(complete).toMatch(/INSERT INTO public\.application_events/i);
    expect(complete).toMatch(/INSERT INTO public\.notification_events/i);
    expect(complete).toMatch(/INSERT INTO public\.notification_event_log/i);
    expect(complete).toMatch(/ON CONFLICT\s*\(idempotency_key\)[\s\S]*?DO NOTHING/i);
    expect(complete).toMatch(/approved[\s\S]*?document[\s\S]*?retry/i);
    expect(complete).toMatch(/job remains|official_status_checks/i);
    expect(fail).toMatch(/consecutive_failures\s*=\s*LEAST\(tracking\.consecutive_failures\s*\+\s*1/i);
    expect(fail).toMatch(/next_daily_check_at|scheduled_for/i);
    expect(fail).toMatch(/UPDATE public\.official_application_tracking/i);
    expect(fail).toMatch(/v_check\.attempt_count\s*<\s*3[\s\S]*?trigger_source[\s\S]*?'retry'[\s\S]*?ON CONFLICT \(idempotency_key\) WHERE idempotency_key IS NOT NULL/i);
    expect(fail).toMatch(/SELECT \* INTO v_application[\s\S]*?IF NOT FOUND THEN RETURN FALSE/i);
    expect(fail).toMatch(/SELECT \* INTO v_tracking[\s\S]*?IF NOT FOUND THEN RETURN FALSE/i);
    expect(fail).toMatch(/SELECT application_id INTO v_application_id[\s\S]*?SELECT \* INTO v_application[\s\S]*?FOR UPDATE[\s\S]*?SELECT \* INTO v_check[\s\S]*?FOR UPDATE/i);
    expect(fail).toMatch(/RAISE EXCEPTION 'Vietnam tracking row changed[\s\S]*?55000/i);
  });

  it("derives notification payload fields and does not trust caller recipients/events", () => {
    const complete = functionBody("complete_vn_official_status_check");
    expect(complete).toMatch(/language_pref|language preference/i);
    expect(complete).toMatch(/application_url/i);
    expect(complete).toMatch(/vietnam_status_update/i);
    expect(complete).toMatch(/recipient[\s\S]*?profile\.email|profile\.email[\s\S]*?recipient/i);
    expect(complete).not.toMatch(/p_patch\s*->>\s*'recipient'/i);
    expect(complete).not.toMatch(/p_patch\s*->>\s*'event_type'/i);
    expect(complete).toMatch(/application_url must be an absolute http\(s\) URL/i);
    expect(complete).toMatch(/visa_number must be at most 128/i);
    expect(complete).toMatch(/LEFT\([^,]+,\s*512\)|char_length\([^)]*\)\s*<=\s*512/i);
    expect(complete).not.toMatch(/current_setting\(['"]app\.public_site_url/i);
    expect(complete).toMatch(/client\/status\[\?\]applicationId/i);
    expect(complete).toContain("^https?://[A-Za-z0-9.-]+(:[0-9]{1,5})?/client/status[?]applicationId=");
    expect(complete).toContain("v_application.id::TEXT || '$'");
    expect(complete).not.toMatch(/https\?:\/\/\[\^\[:space:\]\]\+\/client\/status/i);
    expect(complete).toMatch(/v_next_status\s*=\s*'completed'[\s\S]*?INSERT INTO public\.notification_events/i);
    expect(complete).toMatch(/v_next_status\s*=\s*'completed'[\s\S]*?INSERT INTO public\.application_documents/i);
    expect(complete).toMatch(/v_artifact_changed[\s\S]*?v_previous_status IS DISTINCT FROM v_official_status/i);
    expect(complete).toMatch(/v_new_artifact[\s\S]*?v_tracking\.last_artifact_storage_path[\s\S]*?v_application\.result_storage_path/i);
    expect(complete).toMatch(/v_document_ready\s*:=\s*v_artifact_path IS NOT NULL/i);
    expect(complete).not.toMatch(/submission_result_status\s*=/i);
    expect(complete).not.toMatch(/external_reference\s*=\s*v_official_reference/i);
    expect(complete).toMatch(/v_visa_number[\s\S]*?visa_number[\s\S]*?official_reference/i);
    expect(complete).toMatch(/v_next_status\s*=\s*'completed'[\s\S]*?v_official_status IS NULL[\s\S]*?22023/i);
    const allowlist = complete.match(/WHERE patch_key <> ALL \(ARRAY\[[\s\S]*?\]\)/i)?.[0] ?? "";
    expect(allowlist).not.toContain("'checked_at'");
    expect(complete).toMatch(/v_new_artifact[\s\S]*?full-SHA Vietnam eVisa path/i);
    expect(complete).toMatch(/v_next_status\s*=\s*'completed'[\s\S]*?v_application_url := v_patch_application_url/i);
    expect(complete).toMatch(/SELECT \* INTO v_application[\s\S]*?IF NOT FOUND THEN RETURN FALSE[\s\S]*?SELECT \* INTO v_tracking[\s\S]*?IF NOT FOUND THEN RETURN FALSE/i);
    expect(complete).toMatch(/RAISE EXCEPTION 'Vietnam application changed[\s\S]*?55000/i);
    expect(complete).toMatch(/RAISE EXCEPTION 'Vietnam tracking row changed[\s\S]*?55000/i);
    expect(complete).toMatch(/RAISE EXCEPTION 'Vietnam status check changed during settlement[\s\S]*?55000/i);
    expect(complete).not.toMatch(/FOR SHARE/i);
    expect(canonicalSql).toMatch(/ON CONFLICT \(idempotency_key\) WHERE idempotency_key IS NOT NULL DO NOTHING/i);
  });

  it("keeps privileges service-role-only with empty search paths", () => {
    for (const name of [
      "claim_vn_official_status_checks",
      "renew_vn_official_status_check",
      "defer_vn_official_status_check",
      "fail_vn_official_status_check",
      "complete_vn_official_status_check",
    ]) {
      expect(canonicalSql).toMatch(new RegExp(`${name}[\\s\\S]*?SECURITY DEFINER[\\s\\S]*?SET search_path = ''`, "i"));
    }
    expect(canonicalSql).toMatch(/REVOKE ALL ON TABLE public\.official_status_checks[\s\S]*?FROM PUBLIC, anon, authenticated/i);
    expect(canonicalSql).toMatch(/GRANT ALL ON TABLE public\.official_status_checks[\s\S]*?TO service_role/i);
  });
});

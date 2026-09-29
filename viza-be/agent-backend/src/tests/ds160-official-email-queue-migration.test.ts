import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const canonicalPath = fileURLToPath(
  new URL("../../drizzle/0206_ds160_official_email_queue.sql", import.meta.url),
);
const mirrorPath = fileURLToPath(
  new URL(
    "../../../../viza-fe/internal-website/supabase/migrations/20260929000000_ds160_official_email_queue.sql",
    import.meta.url,
  ),
);
const canonicalSql = existsSync(canonicalPath) ? readFileSync(canonicalPath, "utf8") : "";
const mirrorSql = existsSync(mirrorPath) ? readFileSync(mirrorPath, "utf8") : "";

const functionBody = (name: string): string => canonicalSql.match(
  new RegExp(
    `CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?\\n\\$\\$;`,
    "i",
  ),
)?.[0] ?? "";

describe("DS-160 official email queue migration", () => {
  it("ships one byte-identical canonical and Supabase CLI mirror", () => {
    expect(existsSync(canonicalPath)).toBe(true);
    expect(existsSync(mirrorPath)).toBe(true);
    expect(mirrorSql).toBe(canonicalSql);
  });

  it("serializes ownership, submitted-US validation, and recipient metadata", () => {
    const enqueue = functionBody("enqueue_ds160_proof_email");
    expect(enqueue).toMatch(
      /p_application_id UUID,\s*p_auth_user_id UUID,\s*p_request_id UUID,\s*p_recipient_sha256 TEXT,\s*p_retry BOOLEAN DEFAULT FALSE/i,
    );
    expect(enqueue).toMatch(/FROM public\.applications[\s\S]*?FOR UPDATE/i);
    expect(enqueue).toMatch(/p\.auth_user_id = p_auth_user_id[\s\S]*?FOR UPDATE/i);
    expect(enqueue).toMatch(/p_recipient_sha256[\s\S]*?\^\[0-9a-f\]\{64\}/i);
    expect(enqueue).toMatch(/submission_result[\s\S]*?country[\s\S]*?'US'[\s\S]*?status[\s\S]*?'submitted'/i);
    expect(enqueue).toMatch(/official_ceac_email/);
    expect(enqueue).toMatch(/'status', 'queued'[\s\S]*?'request_id'[\s\S]*?'recipient_sha256'/i);
    expect(enqueue).toMatch(/FROM public\.submission_queue[\s\S]*?FOR UPDATE/i);
    expect(enqueue).toMatch(/runner_job[\s\S]*?status IN \('queued', 'running'\)/i);
    expect(enqueue).toMatch(/request id is already bound to another recipient digest/i);
    expect(enqueue).toMatch(/locked_until > v_now/);
    expect(enqueue).toMatch(/ds160_email_lease_expired_before_send/);
    expect(enqueue).not.toMatch(/FROM auth\.users/i);
  });

  it("keeps start and send reservation fences exact-owner and database-clock based", () => {
    const start = functionBody("start_ds160_proof_email");
    const reserve = functionBody("reserve_ds160_email_send");
    expect(start).toMatch(/p_queue_id UUID,\s*p_worker_id TEXT,\s*p_locked_at TIMESTAMPTZ/i);
    expect(start).toMatch(/locked_by IS DISTINCT FROM v_owner/i);
    expect(start).toMatch(/locked_at IS DISTINCT FROM p_locked_at/i);
    expect(start).toMatch(/locked_until <= v_now/i);
    expect(start).toMatch(/status = 'ds160_proof_processing'/i);
    expect(start).toMatch(/current_stage = 'retrieving_confirmation'/i);
    expect(start).not.toMatch(/email[^\n]*status[^\n]*sending/i);
    expect(reserve).toMatch(/status IS DISTINCT FROM 'ds160_proof_processing'/i);
    expect(reserve).toMatch(/status'?, 'sending'/i);
    expect(reserve).toMatch(/send_started_at/);
    expect(reserve).toMatch(/clock_timestamp\(\)/i);
    expect(reserve).toMatch(/status' = 'sending'|status' = 'sending'/i);
    expect(reserve).toMatch(/RETURN;[\s\S]*?IF v_email ->> 'status' IS DISTINCT FROM 'queued'/i);
  });

  it("gates download recovery behind the same application mutex", () => {
    const download = functionBody("enqueue_ds160_proof_download");
    expect(download).toMatch(/p_application_id UUID,\s*p_auth_user_id UUID/i);
    expect(download).toMatch(/FROM public\.applications[\s\S]*?FOR UPDATE/i);
    expect(download).toMatch(/p\.auth_user_id = p_auth_user_id[\s\S]*?FOR UPDATE/i);
    expect(download).toMatch(/official email recovery is active[\s\S]*?55000/i);
    expect(download).toMatch(/runner_job[\s\S]*?status IN \('queued', 'running'\)/i);
    expect(download).toMatch(/'ds160_proof_pending'[\s\S]*?'ceac_proof'[\s\S]*?'queued'/i);
    expect(download).toMatch(/COALESCE\(v_queue\.locked_until > v_now, FALSE\)/i);
  });

  it("settles only allowed states and clears the live lease atomically", () => {
    const settle = functionBody("settle_ds160_proof_email");
    expect(settle).toMatch(/v_status NOT IN \('sent', 'unknown', 'failed'\)/i);
    expect(settle).toMatch(/v_email ->> 'status' IS DISTINCT FROM 'sending'/i);
    expect(settle).toMatch(/v_email ->> 'status' IS DISTINCT FROM 'queued'/i);
    expect(settle).toMatch(/status = CASE WHEN v_status = 'sent' THEN 'done' ELSE 'ds160_proof_failed' END/i);
    expect(settle).toMatch(/locked_by = NULL[\s\S]*?locked_at = NULL[\s\S]*?locked_until = NULL/i);
    expect(settle).toMatch(/p_evidence JSONB DEFAULT '\{\}'::JSONB/i);
    expect(settle).toMatch(/jsonb_typeof\(p_evidence\)/i);
  });

  it("keeps all four RPCs service-role-only invoker functions with empty paths", () => {
    for (const name of [
      "enqueue_ds160_proof_email",
      "enqueue_ds160_proof_download",
      "start_ds160_proof_email",
      "reserve_ds160_email_send",
      "settle_ds160_proof_email",
    ]) {
      expect(canonicalSql).toMatch(new RegExp(
        `CREATE OR REPLACE FUNCTION public\\.${name}[\\s\\S]*?SECURITY INVOKER[\\s\\S]*?SET search_path = ''`,
        "i",
      ));
      expect(canonicalSql).toMatch(new RegExp(
        `REVOKE ALL ON FUNCTION public\\.${name}[\\s\\S]*?FROM PUBLIC, anon, authenticated, service_role[\\s\\S]*?GRANT EXECUTE ON FUNCTION public\\.${name}[\\s\\S]*?TO service_role`,
        "i",
      ));
    }
  });
});

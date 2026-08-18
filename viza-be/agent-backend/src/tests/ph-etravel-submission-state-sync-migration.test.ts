import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL("../../drizzle/0150_ph_etravel_submission_state_sync.sql", import.meta.url),
);
const sql = readFileSync(migrationPath, "utf8");
const lowerSql = sql.toLowerCase();

describe("PH eTravel submission-state sync migration", () => {
  it("defines the v2 RPC with the submission-service adapter argument contract", () => {
    expect(lowerSql).toMatch(/create or replace function public\.sync_ph_etravel_submission_state/);
    expect(lowerSql).toMatch(/application_id uuid,\s*queue_id uuid,\s*idempotency_key text,\s*result_json jsonb,\s*application_patch jsonb,\s*queue_patch jsonb/s);
    expect(lowerSql).toMatch(/returns jsonb/);
    expect(lowerSql).toMatch(/security invoker/);
    expect(lowerSql).toMatch(/set search_path = ''/);
    expect(lowerSql).not.toMatch(/security definer/);
  });

  it("is service-role-only and keeps public roles revoked", () => {
    expect(lowerSql).toMatch(/revoke all on function public\.sync_ph_etravel_submission_state\(\s*uuid, uuid, text, jsonb, jsonb, jsonb\s*\) from public, anon, authenticated;/s);
    expect(lowerSql).toMatch(/grant execute on function public\.sync_ph_etravel_submission_state\(\s*uuid, uuid, text, jsonb, jsonb, jsonb\s*\) to service_role;/s);
    expect(lowerSql).not.toMatch(/grant execute on function public\.sync_ph_etravel_submission_state[\s\S]*to\s+(public|anon|authenticated)/);
  });

  it("locks applications and submission_queue and rejects unsupported products or states", () => {
    expect(lowerSql).toMatch(/from public\.applications as app[\s\S]*for update/);
    expect(lowerSql).toMatch(/from public\.submission_queue as sq[\s\S]*for update/);
    expect(lowerSql).toMatch(/lower\(v_application\.country\) <> 'philippines'/);
    expect(lowerSql).toMatch(/upper\(v_application\.visa_type\) <> 'ph_etravel_arrival_card'/);
    expect(lowerSql).toMatch(/v_target_status not in \('submitted', 'action_required', 'recovery_required'\)/);
    expect(lowerSql).toMatch(/patch does not match target_status/);
    expect(lowerSql).toMatch(/expected_prior_state_mismatch/);
  });

  it("requires trusted submitted reference and QR evidence before marking submitted", () => {
    expect(lowerSql).toMatch(/submitted ph etravel sync requires trusted reference and qr evidence/);
    expect(lowerSql).toMatch(/official_reference/);
    expect(lowerSql).toMatch(/official_registration_result_read/);
    expect(lowerSql).toMatch(/post_submit_read/);
    expect(lowerSql).toMatch(/stable_reference/);
    expect(lowerSql).toMatch(/official_client_reference_qr/);
    expect(lowerSql).toMatch(/rendered_for_reference/);
    expect(lowerSql).toMatch(/reference_value_validated/);
    expect(lowerSql).toMatch(/v_qr_render ->> 'rendered_for_reference' is distinct from v_official_reference/);
  });

  it("stores only a whitelisted PH result shape and blocks weaker overwrites", () => {
    expect(sql).toMatch(/'country', 'PH'/);
    expect(sql).toMatch(/'visaType', 'PH_ETRAVEL_ARRIVAL_CARD'/);
    expect(sql).toMatch(/'provider', 'philippines_etravel_live'/);
    expect(sql).toMatch(/'authoritativeRead'/);
    expect(sql).toMatch(/'qrRender'/);
    expect(sql).toMatch(/'stateSync'/);
    expect(sql).toMatch(/'version', 2/);
    expect(lowerSql).not.toMatch(/submission_result\s*=\s*result_json/);
    expect(lowerSql).toMatch(/v_existing_result ->> 'status' = 'submitted'/);
    expect(lowerSql).toMatch(/v_existing_result #>> '\{resultevidence,qrrender,renderedforreference\}' = v_existing_reference/);
    expect(lowerSql).toMatch(/v_target_status = 'submitted' and v_existing_reference = v_official_reference/);
  });

  it("adds the PH queue result columns needed by the v2 atomic queue patch", () => {
    for (const column of [
      "error_code",
      "error_message",
      "official_status",
      "current_stage",
      "manual_action_status",
      "official_portal_url",
      "official_confirmation_pdf_url",
      "live_submitted_at",
      "live_screenshot_url",
    ]) {
      expect(lowerSql).toContain(`add column if not exists ${column}`);
    }
  });
});

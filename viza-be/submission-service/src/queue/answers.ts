import { supabase } from "../supabase.js";

/**
 * Canonical answer loader for the runner_job dispatch layer (QUE-001).
 *
 * Reads an application's stored answers + applicant profile from Supabase
 * and flattens them into a single `Record<string,string>` keyed by the
 * canonical field names the per-country runners expect (surname,
 * given_names, date_of_birth, nationality, passport_number,
 * passport_expiry_date, passport_issuing_country, email, phone, …).
 *
 * `visa_application_answers.field_name` values win over profile-derived
 * fallbacks, so portal-specific overrides typed by the applicant take
 * precedence. Country-specific field-name mapping may still need recon
 * tuning per portal — see docs/infra/queue.md.
 */
export type CanonicalRecord = Record<string, string>;

export async function loadCanonicalAnswers(
  applicationId: string,
): Promise<CanonicalRecord> {
  const { data: app, error: appErr } = await supabase
    .from("applications")
    .select("id, applicant_id")
    .eq("id", applicationId)
    .single();
  if (appErr) throw new Error(`applications lookup failed: ${appErr.message}`);

  const { data: profile, error: profileErr } = await supabase
    .from("applicant_profiles")
    .select(
      "full_name, date_of_birth, passport_number, passport_expiry_date, email, phone, nationality",
    )
    .eq("id", app.applicant_id)
    .maybeSingle();
  if (profileErr) {
    throw new Error(`applicant_profiles lookup failed: ${profileErr.message}`);
  }

  const { data: answerRows, error: answerErr } = await supabase
    .from("visa_application_answers")
    .select("field_name, value_text")
    .eq("application_id", applicationId);
  if (answerErr) {
    throw new Error(`visa_application_answers lookup failed: ${answerErr.message}`);
  }

  const rec: CanonicalRecord = {};

  // Profile-derived fallbacks first (lowest precedence).
  const p = (profile ?? {}) as Record<string, unknown>;
  const fullName = String(p.full_name ?? "").trim();
  if (fullName) {
    const parts = fullName.split(/\s+/);
    rec.given_names = parts.slice(0, -1).join(" ") || fullName;
    rec.surname = parts.length > 1 ? parts[parts.length - 1] : "";
  }
  const fromProfile: Record<string, unknown> = {
    date_of_birth: p.date_of_birth,
    passport_number: p.passport_number,
    passport_expiry_date: p.passport_expiry_date,
    email: p.email,
    phone: p.phone,
    nationality: p.nationality,
  };
  for (const [k, v] of Object.entries(fromProfile)) {
    if (v != null && v !== "") rec[k] = String(v);
  }

  // Stored answers win.
  for (const row of answerRows ?? []) {
    if (row.value_text != null) rec[row.field_name] = String(row.value_text);
  }

  return rec;
}

/** Read a field with a default; trims whitespace. */
export function pick(rec: CanonicalRecord, key: string, fallback = ""): string {
  const v = rec[key];
  return v != null && String(v).trim() !== "" ? String(v) : fallback;
}

import { supabase } from "../supabase.js";
import { buildCountrySubmissionApplication } from "../country-submissions/from-records.js";
import type { CountrySubmissionApplication } from "../country-submissions/types.js";
import type { ApplicantProfile, Application } from "../types.js";

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

export interface CountrySubmissionContext {
  profile: ApplicantProfile;
  application: Application;
  answers: CanonicalRecord;
  submissionApplication: CountrySubmissionApplication;
}

export interface SubmissionPreflightDocument {
  documentType: string;
  storagePath: string | null;
  status: string | null;
}

export interface SubmissionPreflightContext {
  applicantId: string;
  applicationCountry: string;
  applicationVisaType: string;
  inboxAlias: string | null;
  documents: SubmissionPreflightDocument[];
}

export function matchesSubmissionPreflightApplication(
  context: Pick<SubmissionPreflightContext, "applicationCountry" | "applicationVisaType">,
  expectedCountry: string,
  expectedVisaType: string,
): boolean {
  return context.applicationCountry === expectedCountry &&
    context.applicationVisaType === expectedVisaType;
}

function answersFromRows(
  rows: Array<{ field_name: string; value_text: string | null }>,
): CanonicalRecord {
  const answers: CanonicalRecord = {};
  for (const row of rows) {
    if (row.value_text != null) answers[row.field_name] = String(row.value_text);
  }
  return answers;
}

/**
 * Applicant facts that are stable across destinations and safe to reuse when
 * every prior non-empty occurrence agrees. Travel plans, finances, consent,
 * health/security declarations and time-sensitive status are intentionally
 * excluded.
 */
export const STABLE_CROSS_APPLICATION_FIELDS = new Set([
  "father_name",
  "father_full_name",
  "father_given_names",
  "father_surname",
  "father_nationality",
  "father_place_of_birth",
  "father_country_of_birth",
  "mother_name",
  "mother_full_name",
  "mother_given_names",
  "mother_surname",
  "mother_nationality",
  "mother_place_of_birth",
  "mother_country_of_birth",
]);

export function stableConsensusAnswers(
  rows: Array<{ field_name: string; value_text: string | null }>,
): CanonicalRecord {
  const values = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!STABLE_CROSS_APPLICATION_FIELDS.has(row.field_name)) continue;
    const value = row.value_text?.trim();
    if (!value) continue;
    const fieldValues = values.get(row.field_name) ?? new Set<string>();
    fieldValues.add(value);
    values.set(row.field_name, fieldValues);
  }
  const answers: CanonicalRecord = {};
  for (const [fieldName, fieldValues] of values) {
    if (fieldValues.size === 1) answers[fieldName] = [...fieldValues][0];
  }
  return answers;
}

export async function loadStableApplicantAnswers(applicantId: string): Promise<CanonicalRecord> {
  const { data: applications, error: applicationError } = await supabase
    .from("applications")
    .select("id")
    .eq("applicant_id", applicantId);
  if (applicationError) {
    throw new Error(`stable applications lookup failed: ${applicationError.message}`);
  }
  const applicationIds = (applications ?? []).map((application) => String(application.id));
  if (applicationIds.length === 0) return {};
  const { data: rows, error: answerError } = await supabase
    .from("visa_application_answers")
    .select("field_name, value_text")
    .in("application_id", applicationIds)
    .in("field_name", [...STABLE_CROSS_APPLICATION_FIELDS]);
  if (answerError) {
    throw new Error(`stable application answers lookup failed: ${answerError.message}`);
  }
  return stableConsensusAnswers(rows ?? []);
}

export async function loadCountrySubmissionContext(
  applicationId: string,
): Promise<CountrySubmissionContext> {
  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .select("*")
    .eq("id", applicationId)
    .single();
  if (applicationError) {
    throw new Error(`applications lookup failed: ${applicationError.message}`);
  }

  const [
    { data: profile, error: profileError },
    { data: answerRows, error: answerError },
    stableAnswers,
  ] =
    await Promise.all([
      supabase
        .from("applicant_profiles")
        .select("*")
        .eq("id", application.applicant_id)
        .single(),
      supabase
        .from("visa_application_answers")
        .select("field_name, value_text")
        .eq("application_id", applicationId),
      loadStableApplicantAnswers(String(application.applicant_id)),
    ]);
  if (profileError) {
    throw new Error(`applicant_profiles lookup failed: ${profileError.message}`);
  }
  if (answerError) {
    throw new Error(`visa_application_answers lookup failed: ${answerError.message}`);
  }

  const typedProfile = profile as ApplicantProfile;
  const typedApplication = application as Application;
  const answers = { ...stableAnswers, ...answersFromRows(answerRows ?? []) };
  return {
    profile: typedProfile,
    application: typedApplication,
    answers,
    submissionApplication: buildCountrySubmissionApplication(
      typedProfile,
      typedApplication,
      answers,
    ),
  };
}

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

  const [
    { data: answerRows, error: answerErr },
    stableAnswers,
  ] = await Promise.all([
    supabase
      .from("visa_application_answers")
      .select("field_name, value_text")
      .eq("application_id", applicationId),
    loadStableApplicantAnswers(String(app.applicant_id)),
  ]);
  if (answerErr) {
    throw new Error(`visa_application_answers lookup failed: ${answerErr.message}`);
  }

  const rec: CanonicalRecord = { ...stableAnswers };

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

/**
 * Load only the non-answer state needed by country preflight. Both application
 * documents and reusable universal-profile documents are included, but no file
 * bytes are downloaded and no official portal state is changed.
 */
export async function loadSubmissionPreflightContext(
  applicationId: string,
): Promise<SubmissionPreflightContext> {
  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .select("applicant_id, country, visa_type")
    .eq("id", applicationId)
    .single();
  if (applicationError) {
    throw new Error(`applications preflight lookup failed: ${applicationError.message}`);
  }

  const [profileResult, applicationDocumentsResult, universalDocumentsResult] =
    await Promise.all([
      supabase
        .from("applicant_profiles")
        .select("inbox_alias")
        .eq("id", application.applicant_id)
        .single(),
      supabase
        .from("application_documents")
        .select("document_type, storage_path, status")
        .eq("application_id", applicationId),
      supabase
        .from("universal_profile_documents")
        .select("document_type, storage_path, status")
        .eq("applicant_id", application.applicant_id),
    ]);

  if (profileResult.error) {
    throw new Error(`applicant profile preflight lookup failed: ${profileResult.error.message}`);
  }
  if (applicationDocumentsResult.error) {
    throw new Error(
      `application documents preflight lookup failed: ${applicationDocumentsResult.error.message}`,
    );
  }
  if (universalDocumentsResult.error) {
    throw new Error(
      `universal documents preflight lookup failed: ${universalDocumentsResult.error.message}`,
    );
  }

  const documents = [
    ...(applicationDocumentsResult.data ?? []),
    ...(universalDocumentsResult.data ?? []),
  ].map((document) => ({
    documentType: String(document.document_type),
    storagePath: document.storage_path ? String(document.storage_path) : null,
    status: document.status ? String(document.status) : null,
  }));

  return {
    applicantId: String(application.applicant_id),
    applicationCountry: String(application.country ?? ""),
    applicationVisaType: String(application.visa_type ?? ""),
    inboxAlias:
      typeof profileResult.data.inbox_alias === "string" &&
      profileResult.data.inbox_alias.trim()
        ? profileResult.data.inbox_alias.trim().toLowerCase()
        : null,
    documents,
  };
}

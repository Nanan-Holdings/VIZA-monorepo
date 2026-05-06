/**
 * Pulls DS-160 answers + applicant profile from Supabase for the CEAC
 * autofill orchestrator. Used by the e2e harness when
 * CEAC_TEST_APPLICATION_ID is set, so the run exercises the production
 * DB→fill path instead of a hardcoded payload.
 */
import { createClient } from "@supabase/supabase-js";
import { deriveDS160Answers } from "../ds160-derive-answers";
import {
  applyTranslationOverlay,
  assertNoCjkRemaining,
} from "../translation-gate";

export interface LoadedAnswers {
  answers: Record<string, string>;
  profile: Record<string, unknown>;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export async function loadAnswersForApplication(
  applicationId: string,
): Promise<LoadedAnswers> {
  const supabase = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );

  // Fetch the applications row to walk back to applicant_profiles
  const { data: app, error: appErr } = await supabase
    .from("applications")
    .select("id, applicant_id, visa_type")
    .eq("id", applicationId)
    .single();
  if (appErr) throw new Error(`applications lookup failed: ${appErr.message}`);
  if (app.visa_type !== "DS160") {
    throw new Error(
      `application ${applicationId} has visa_type=${app.visa_type}; expected DS160`,
    );
  }

  // Profile (used as fallback for orchestrator field resolution)
  const { data: profile, error: profileErr } = await supabase
    .from("applicant_profiles")
    .select(
      "full_name, date_of_birth, passport_number, email, phone, nationality, gender",
    )
    .eq("id", app.applicant_id)
    .single();
  if (profileErr) {
    throw new Error(`applicant_profiles lookup failed: ${profileErr.message}`);
  }

  // Answers
  const { data: answerRows, error: answerErr } = await supabase
    .from("visa_application_answers")
    .select("field_name, value_text")
    .eq("application_id", applicationId);
  if (answerErr) {
    throw new Error(`visa_application_answers lookup failed: ${answerErr.message}`);
  }

  const answers: Record<string, string> = {};
  for (const row of answerRows ?? []) {
    if (row.value_text != null) answers[row.field_name] = row.value_text;
  }

  // Translation overlay: replace user-typed source text with English from
  // application_translations. Done before derivation so derived keys (date
  // splits, NA flags) inherit translated values for any text-bearing source.
  // The raw profile is mutated in place so the shaping below uses the
  // English full_name, etc.
  const rawProfile = profile as Record<string, unknown>;
  await applyTranslationOverlay(supabase, applicationId, rawProfile, answers);

  // Bridge form-shape → orchestrator-shape: split dates into day/month/year,
  // derive *_na flags from "DOES_NOT_APPLY" tokens, alias form-side keys to
  // their CEAC-side equivalents. See ds160-derive-answers.ts for the rule set.
  deriveDS160Answers(answers);

  // Shape profile to match the inline SAMPLE_PROFILE keys (surname, given_names,
  // date_of_birth, passport_number, email_address) — orchestrator uses the
  // profile only as a soft fallback so any extra keys are harmless.
  const fullName = String(rawProfile.full_name ?? "").trim();
  const parts = fullName.split(/\s+/);
  const givenNames = parts.slice(0, -1).join(" ") || fullName;
  const surname = parts.length > 1 ? parts[parts.length - 1] : "";

  const shapedProfile: Record<string, unknown> = {
    surname: answers.surname ?? surname,
    given_names: answers.given_names ?? givenNames,
    date_of_birth: rawProfile.date_of_birth,
    passport_number: rawProfile.passport_number ?? answers.passport_number,
    email_address: rawProfile.email ?? answers.email_address,
  };

  // Hard gate: refuse to hand the answer set to the autofill orchestrator
  // if any value still contains CJK characters. Bypassable via
  // CEAC_SKIP_TRANSLATION_GATE=1 for local debugging.
  assertNoCjkRemaining(answers, shapedProfile, { applicationId });

  return { answers, profile: shapedProfile };
}

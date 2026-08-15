#!/usr/bin/env npx tsx

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { decryptSecret } from "../src/secret-cipher";
import { supabase } from "../src/supabase";
import { resumeVietnamOfficialPayment } from "../src/vietnam/payment-resume";

type QueueRow = {
  application_id: string;
  vn_registration_code_encrypted: string;
};

function readAnswerValue(rows: Array<{ field_name: string; value_text: string | null; value_json: unknown }>): string | null {
  const aliases = new Set(["date_of_birth", "birth_date", "dob"]);
  for (const row of rows) {
    if (!aliases.has(row.field_name)) continue;
    const value = row.value_json != null ? String(row.value_json) : row.value_text;
    if (value?.trim()) return value.trim();
  }
  return null;
}

async function loadLatestSafeInput(): Promise<{
  registrationCode: string;
  email: string;
  dateOfBirth: string;
}> {
  const { data: queue, error: queueError } = await supabase
    .from("submission_queue")
    .select("application_id, vn_registration_code_encrypted")
    .eq("provider", "vietnam_evisa_live")
    .not("vn_registration_code_encrypted", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (queueError || !queue) {
    throw new Error(`Unable to load a Vietnam payment checkpoint: ${queueError?.message ?? "not found"}`);
  }
  const row = queue as QueueRow;

  const [{ data: application, error: applicationError }, { data: answers, error: answersError }] = await Promise.all([
    supabase
      .from("applications")
      .select("applicant_id, country, visa_type")
      .eq("id", row.application_id)
      .single(),
    supabase
      .from("visa_application_answers")
      .select("field_name, value_text, value_json")
      .eq("application_id", row.application_id),
  ]);
  if (applicationError || !application) {
    throw new Error(`Unable to load the Vietnam application: ${applicationError?.message ?? "not found"}`);
  }
  if (String(application.country ?? "").toLowerCase() !== "vietnam") {
    throw new Error("The latest payment checkpoint is not a Vietnam application.");
  }
  if (answersError) throw new Error(`Unable to load the Vietnam date of birth: ${answersError.message}`);

  const { data: profile, error: profileError } = await supabase
    .from("applicant_profiles")
    .select("inbox_alias, date_of_birth")
    .eq("id", application.applicant_id)
    .single();
  if (profileError || !profile) {
    throw new Error(`Unable to load the applicant alias: ${profileError?.message ?? "not found"}`);
  }
  const submittedEmail = (answers ?? [])
    .filter((row) => ["email_address", "re_enter_email_address", "email"].includes(row.field_name))
    .map((row) => row.value_json != null ? String(row.value_json) : row.value_text)
    .find((value) => typeof value === "string" && value.trim())
    ?.trim()
    .toLowerCase();
  const managedAlias = typeof profile.inbox_alias === "string" ? profile.inbox_alias.trim().toLowerCase() : "";
  const email = submittedEmail || managedAlias;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("The application has no valid email previously submitted to the official portal.");
  }
  const dateOfBirth = readAnswerValue(answers ?? []) || String(profile.date_of_birth ?? "").trim();
  if (!dateOfBirth) throw new Error("The application has no date of birth for the official search.");

  return {
    registrationCode: decryptSecret(row.vn_registration_code_encrypted),
    email,
    dateOfBirth,
  };
}

async function main(): Promise<void> {
  // Match the Fly worker's Vietnam-only compatibility setting. The public
  // page can load while api.evisa.gov.vn's CAPTCHA image fails certificate
  // validation, which otherwise looks like a solver problem in local QA.
  process.env.VN_IGNORE_HTTPS_ERRORS ??= "true";
  const input = await loadLatestSafeInput();
  const outputDir = path.resolve("output", "playwright");
  fs.mkdirSync(outputDir, { recursive: true });
  const screenshotPath = path.join(outputDir, `vn-payment-pre-card-${Date.now()}.png`);
  const result = await resumeVietnamOfficialPayment({
    ...input,
    headless: process.env.VN_PRE_CARD_HEADLESS !== "false",
    timeoutMs: Number(process.env.VN_PRE_CARD_TIMEOUT_MS ?? 300_000),
    screenshotPath,
    card: null,
    stopBeforeCardEntry: true,
  });

  const safeSummary = {
    status: result.status,
    cardEntryReady: result.status === "card_entry_ready",
    paymentSubmitted: false,
    captchaAttempts: result.diagnostics?.searchCaptchaAttempts?.map((attempt) => ({
      attempt: attempt.attempt,
      outcome: attempt.outcome,
      answerLength: attempt.answerLength,
      solverErrorKind: attempt.solverErrorKind,
      sameChallengeRetry: attempt.sameChallengeRetry,
    })) ?? [],
    paymentEntryOutcome: result.diagnostics?.paymentEntry?.outcome ?? null,
    screenshotPath,
    ...(result.status === "card_entry_ready" ? {} : { reason: result.reason }),
  };
  console.log(JSON.stringify(safeSummary, null, 2));
  process.exit(result.status === "card_entry_ready" ? 0 : 2);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

#!/usr/bin/env npx tsx

import "dotenv/config";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { decryptSecret, encryptSecret } from "../src/secret-cipher";
import { supabase } from "../src/supabase";
import { resumeVietnamOfficialPayment } from "../src/vietnam/payment-resume";
import { fillVietnamApplication } from "../src/vietnam";

type QueueRow = {
  application_id: string;
  vn_registration_code_encrypted: string;
};

type AnswerRow = { field_name: string; value_text: string | null; value_json: unknown };

type DocumentRow = {
  document_type: string;
  storage_path: string;
  filename: string | null;
};

function redactSmokeFailureReason(reason: string | undefined): string | null {
  if (!reason) return null;
  return reason
    .replace(/[A-Z]:\\[^\r\n]+/gi, "<redacted-path>")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "<redacted-email>")
    .replace(/([?&](?:token|code|email|registration|id)=)[^&\s]+/gi, "$1<redacted>")
    .replace(/\b[A-Z0-9]{12,}\b/g, "<redacted-id>")
    .slice(0, 500);
}

function readAnswerValue(rows: AnswerRow[]): string | null {
  const aliases = new Set(["date_of_birth", "birth_date", "dob"]);
  for (const row of rows) {
    if (!aliases.has(row.field_name)) continue;
    const value = row.value_json != null ? String(row.value_json) : row.value_text;
    if (value?.trim()) return value.trim();
  }
  return null;
}

async function loadLatestSafeInput(): Promise<{
  applicationId: string;
  registrationCode: string;
  email: string;
  dateOfBirth: string;
  repairAnswers: Record<string, string>;
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
  // Fresh official profiles must use the managed alias so official mail can
  // be correlated with status tracking. Never fall back to a personal email
  // while a valid alias exists.
  const email = managedAlias || submittedEmail;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("The application has no valid email previously submitted to the official portal.");
  }
  const dateOfBirth = readAnswerValue(answers ?? []) || String(profile.date_of_birth ?? "").trim();
  if (!dateOfBirth) throw new Error("The application has no date of birth for the official search.");

  const repairAnswers: Record<string, string> = {};
  for (const answer of (answers ?? []) as AnswerRow[]) {
    const value = answer.value_json != null ? String(answer.value_json) : answer.value_text;
    if (value?.trim()) repairAnswers[answer.field_name] = value.trim();
  }
  repairAnswers.email_address = email;
  repairAnswers.re_enter_email_address = email;

  return {
    applicationId: row.application_id,
    registrationCode: decryptSecret(row.vn_registration_code_encrypted),
    email,
    dateOfBirth,
    repairAnswers,
  };
}

async function downloadRepairDocuments(
  applicationId: string,
  tempDir: string,
): Promise<Record<string, string>> {
  const acceptedTypes = new Set([
    "photo",
    "applicant_photo",
    "portrait_photo",
    "passport_copy",
    "passport_scan",
    "passport_photo",
    "passport",
  ]);
  const { data, error } = await supabase
    .from("application_documents")
    .select("document_type, storage_path, filename")
    .eq("application_id", applicationId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Unable to load Vietnam repair documents: ${error.message}`);

  const localByType: Record<string, string> = {};
  for (const document of (data ?? []) as DocumentRow[]) {
    if (!acceptedTypes.has(document.document_type) || !document.storage_path || localByType[document.document_type]) {
      continue;
    }
    const { data: blob, error: downloadError } = await supabase.storage
      .from("application-documents")
      .download(document.storage_path);
    if (downloadError || !blob) {
      throw new Error(`Unable to download required Vietnam ${document.document_type} document.`);
    }
    const extension = path.extname(path.basename(document.filename ?? "")).toLowerCase();
    const safeExtension = /^\.(?:jpe?g|png|webp|pdf)$/.test(extension) ? extension : ".bin";
    const localPath = path.join(tempDir, `${document.document_type}${safeExtension}`);
    fs.writeFileSync(localPath, Buffer.from(await blob.arrayBuffer()));
    localByType[document.document_type] = localPath;
  }
  return localByType;
}

async function main(): Promise<void> {
  // Match the Fly worker's Vietnam-only compatibility setting. The public
  // page can load while api.evisa.gov.vn's CAPTCHA image fails certificate
  // validation, which otherwise looks like a solver problem in local QA.
  process.env.VN_IGNORE_HTTPS_ERRORS ??= "true";
  const input = await loadLatestSafeInput();
  const outputDir = path.resolve("output", "playwright");
  fs.mkdirSync(outputDir, { recursive: true });
  const artifactStamp = Date.now();
  const screenshotPath = path.join(outputDir, `vn-payment-pre-card-${artifactStamp}.png`);
  const freshScreenshotPath = path.join(outputDir, `vn-payment-fresh-${artifactStamp}.png`);
  const freshTracePath = path.join(outputDir, `vn-payment-fresh-${artifactStamp}.zip`);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vn-payment-pre-card-"));
  let createdFreshProfile = false;
  try {
    const localDocuments = await downloadRepairDocuments(input.applicationId, tempDir);
    const portraitPath = ["photo", "applicant_photo", "portrait_photo"]
      .map((key) => localDocuments[key])
      .find(Boolean);
    const passportPath = ["passport_copy", "passport_scan", "passport_photo", "passport"]
      .map((key) => localDocuments[key])
      .find(Boolean);
    if (portraitPath) input.repairAnswers.portrait_photo = portraitPath;
    if (passportPath) {
      input.repairAnswers.passport_copy = passportPath;
      input.repairAnswers.passport_photo = passportPath;
    }
    if (process.env.VN_PRE_CARD_CREATE_FRESH_PROFILE === "true") {
      console.log("[vn-pre-card] Creating one fresh official profile with the managed alias; payment remains disabled.");
      const freshResult = await fillVietnamApplication(
        { answers: input.repairAnswers },
        {
          headless: process.env.VN_PRE_CARD_HEADLESS !== "false",
          runId: `vn-pre-card-fresh-${Date.now()}`,
          stepTimeoutMs: Math.min(Number(process.env.VN_PRE_CARD_TIMEOUT_MS ?? 300_000), 90_000),
          stopAtFirstCheckpoint: false,
          allowFixedCardPayment: false,
          maxPortalAttempts: 1,
          browserChannels: "bundled",
          finalScreenshotPath: freshScreenshotPath,
          tracePath: freshTracePath,
        },
      );
      const registrationCode =
        freshResult.status === "submitted_pending_pay"
          ? freshResult.registrationCode
          : freshResult.status === "action_required"
            ? freshResult.registrationCode ?? null
            : null;
      if (!registrationCode) {
        const safeStatus = freshResult.status;
        const safeCheckpoint = "checkpoint" in freshResult ? freshResult.checkpoint ?? null : null;
        const safeDetail = freshResult.status === "failed"
          ? redactSmokeFailureReason(JSON.stringify(freshResult.error))
          : freshResult.status === "scaffolded_pending_walk"
            ? redactSmokeFailureReason(freshResult.reason)
            : freshResult.status === "action_required"
              ? `action=${freshResult.actionType}`
              : null;
        throw new Error(
          `[vn-safe] fresh_profile_failed status=${safeStatus} checkpoint=${safeCheckpoint ?? "none"}` +
          ` detail=${safeDetail ?? "none"}`,
        );
      }
      input.registrationCode = registrationCode;
      const now = new Date().toISOString();
      const { error: applicationUpdateError } = await supabase
        .from("applications")
        .update({
          external_reference: registrationCode,
          external_status: "payment_required",
          submission_result_status: "action_required",
          official_fee_status: "official_fee_payment_queued",
          updated_at: now,
        })
        .eq("id", input.applicationId);
      if (applicationUpdateError) {
        throw new Error("[vn-safe] fresh_profile_tracking_application_update_failed");
      }
      const { data: latestQueue } = await supabase
        .from("submission_queue")
        .select("id")
        .eq("application_id", input.applicationId)
        .eq("provider", "vietnam_evisa_live")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestQueue?.id) {
        const { error: queueUpdateError } = await supabase
          .from("submission_queue")
          .update({
            vn_registration_code_encrypted: encryptSecret(registrationCode),
            official_status: "registration_code_captured_payment_pending",
            updated_at: now,
          })
          .eq("id", latestQueue.id);
        if (queueUpdateError) {
          throw new Error("[vn-safe] fresh_profile_tracking_queue_update_failed");
        }
      }
      console.log("[vn-pre-card] Fresh official profile captured and linked to managed alias tracking.");
      createdFreshProfile = true;
      if (process.env.VN_PRE_CARD_STOP_AFTER_REGISTRATION === "true") {
        console.log(JSON.stringify({
          status: "registration_checkpoint_ready",
          registrationCodeCaptured: true,
          managedAliasTrackingLinked: true,
          cardEntryReady: false,
          paymentSubmitted: false,
        }, null, 2));
        return;
      }
    }
    let resumeRepairAnswers: Record<string, string> | undefined = input.repairAnswers;
    if (createdFreshProfile || process.env.VN_PRE_CARD_SKIP_REPAIR === "true") {
      // A profile created in this same safe smoke already contains the complete
      // current answer set. Re-entering repair immediately would trigger a
      // second review CAPTCHA without changing any data and can consume the
      // bounded run budget before the payment-page assertion.
      resumeRepairAnswers = undefined;
    } else if (process.env.VN_PRE_CARD_FULL_REPAIR !== "true") {
      const minimalFields = new Set([
        "portrait_photo",
        "passport_copy",
        "passport_photo",
        "visa_valid_from",
        "visa_valid_to",
        "intended_date_of_entry",
        "intended_length_of_stay",
        "intended_expenses_usd",
        "bought_travel_insurance",
        "expense_coverage",
        "expense_payment_method",
        "declaration_temporary_residence",
      ]);
      resumeRepairAnswers = Object.fromEntries(
        Object.entries(input.repairAnswers).filter(([fieldName]) => minimalFields.has(fieldName)),
      );
    }

    const result = await resumeVietnamOfficialPayment({
      registrationCode: input.registrationCode,
      email: input.email,
      dateOfBirth: input.dateOfBirth,
      repairAnswers: resumeRepairAnswers,
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
      safeFailure: "reason" in result && result.reason.startsWith("[vn-safe]")
        ? result.reason
        : null,
      failureReason: "reason" in result ? redactSmokeFailureReason(result.reason) : null,
      captchaAttempts: result.diagnostics?.searchCaptchaAttempts?.map((attempt) => ({
        attempt: attempt.attempt,
        outcome: attempt.outcome,
        answerLength: attempt.answerLength,
        solverErrorKind: attempt.solverErrorKind,
        sameChallengeRetry: attempt.sameChallengeRetry,
      })) ?? [],
      paymentEntryOutcome: result.diagnostics?.paymentEntry?.outcome ?? null,
      screenshotPath,
    };
    console.log(JSON.stringify(safeSummary, null, 2));
    if (result.status !== "card_entry_ready") process.exitCode = 2;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

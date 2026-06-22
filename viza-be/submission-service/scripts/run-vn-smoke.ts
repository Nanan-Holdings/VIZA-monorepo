#!/usr/bin/env npx tsx
/**
 * Vietnam e-Visa smoke runner.
 *
 * Drives the public evisa.gov.vn form with synthetic answers and stops at the
 * pre-pay/review checkpoint. The runner never clicks Pay or final Submit.
 *
 * Optional env:
 *   VN_PLAYWRIGHT_HEADLESS=false
 *   VN_CAPTURE_TRACE=true
 *   VN_CAPTURE_SCREENSHOT=true
 *   VN_SMOKE_TIMEOUT_MS=240000
 *   VN_OFFICIAL_BASE_URL=https://evisa.gov.vn/
 *   VN_OFFICIAL_FALLBACK_BASE_URL=https://thithucdientu.gov.vn/
 */

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fillVietnamApplication } from "../src/vietnam";

const answers: Record<string, string> = {
  surname: "ZHANG",
  given_name: "EDWARD",
  date_of_birth: "1995-01-01",
  sex: "M",
  nationality: "CHN",
  email_address: "smoke@example.invalid",
  re_enter_email_address: "smoke@example.invalid",
  religion: "None",
  place_of_birth: "Beijing",
  has_multiple_nationalities: "no",
  has_violated_vietnam_laws: "no",
  visa_type_requested: "single",
  visa_valid_from: "2026-08-01",
  visa_valid_to: "2026-08-15",
  passport_number: "E12345678",
  passport_issuing_authority: "Exit and Entry Administration",
  passport_type: "ordinary_passport",
  passport_issue_date: "2020-01-01",
  passport_expiry_date: "2030-01-01",
  permanent_residential_address: "1 Test Road, Beijing",
  contact_address: "1 Test Road, Beijing",
  telephone_number: "+8613800000000",
  emergency_contact_full_name: "TEST CONTACT",
  emergency_contact_current_address: "1 Test Road, Beijing",
  emergency_contact_telephone: "+8613800000001",
  emergency_contact_relationship: "Friend",
  occupation: "employee",
  occupation_info: "Software engineer",
  company_or_school_name: "Test Company Ltd",
  position_course: "Engineer",
  company_address: "1 Employer Road, Beijing",
  company_phone: "+8610123456789",
  purpose_of_entry: "tourist",
  intended_date_of_entry: "2026-08-01",
  intended_length_of_stay: "15",
  phone_in_vietnam: "+84900000000",
  residential_address_in_vietnam: "Hotel",
  intended_province_city: "ha_noi",
  intended_ward_commune: "phuong_my_binh",
  intended_border_gate_of_entry: "noi_bai_int_airport_ha_noi",
  intended_border_gate_of_exit: "noi_bai_int_airport_ha_noi",
  declaration_temporary_residence: "yes",
  visited_vietnam_in_last_year: "no",
  has_relatives_in_vietnam: "no",
  intended_expenses_usd: "1200",
  bought_travel_insurance: "yes",
  expense_coverage: "personal",
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`smoke timeout > ${timeoutMs}ms`)), timeoutMs),
    ),
  ]);
}

function readTimeoutMs(): number {
  const raw = process.env.VN_SMOKE_TIMEOUT_MS;
  if (!raw) return 240_000;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 240_000;
}

function readStepTimeoutMs(totalTimeoutMs: number): number {
  const raw = process.env.VN_SMOKE_STEP_TIMEOUT_MS;
  if (raw) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return Math.min(60_000, totalTimeoutMs);
}

function readBooleanEnv(key: string, defaultValue: boolean): boolean {
  const raw = process.env[key];
  if (raw === undefined) return defaultValue;
  return raw === "1" || raw.toLowerCase() === "true";
}

function readHeadless(): boolean {
  if (process.env.VN_SMOKE_HEADFUL === "1") return false;
  return readBooleanEnv("VN_PLAYWRIGHT_HEADLESS", false);
}

async function main(): Promise<void> {
  const runId = `vn-smoke-${Date.now()}`;
  const traceEnabled =
    readBooleanEnv("VN_CAPTURE_TRACE", true) || process.env.VN_SMOKE_TRACE === "1";
  const screenshotEnabled = readBooleanEnv("VN_CAPTURE_SCREENSHOT", true);
  const timeoutMs = readTimeoutMs();
  const stepTimeoutMs = readStepTimeoutMs(timeoutMs);
  const diagnosticsDir = path.resolve("diag-out", "vn-smoke", runId);
  const tracePath = path.join(diagnosticsDir, "trace.zip");
  const finalScreenshotPath = path.join(diagnosticsDir, "final.png");
  if (traceEnabled || screenshotEnabled) {
    fs.mkdirSync(diagnosticsDir, { recursive: true });
    console.log(`[vn-smoke] Diagnostics: ${diagnosticsDir}`);
  }

  const result = await withTimeout(
    fillVietnamApplication(
      { answers },
      {
        headless: readHeadless(),
        runId,
        officialBaseUrl: process.env.VN_OFFICIAL_BASE_URL ?? "https://evisa.gov.vn/",
        officialFallbackBaseUrl:
          process.env.VN_OFFICIAL_FALLBACK_BASE_URL ?? "https://thithucdientu.gov.vn/",
        stepTimeoutMs,
        stopAtFirstCheckpoint: readBooleanEnv("VN_SMOKE_STOP_AT_FIRST_CHECKPOINT", true),
        ...(traceEnabled ? { tracePath } : {}),
        ...(screenshotEnabled ? { finalScreenshotPath } : {}),
      },
    ),
    timeoutMs,
  );

  console.log(JSON.stringify(result, null, 2));
  if (traceEnabled) {
    console.log(`[vn-smoke] Trace: ${tracePath}`);
  }
  if (screenshotEnabled) {
    console.log(`[vn-smoke] Final screenshot: ${finalScreenshotPath}`);
  }
  if (result.status === "submitted_pending_pay") {
    console.log("[vn-smoke] Pre-pay checkpoint reached; Pay/Submit was not clicked.");
    process.exit(0);
  }

  if (result.status === "scaffolded_pending_walk") {
    if (
      result.checkpoint === "application_form_visible" ||
      result.checkpoint === "landing_page_loaded" ||
      result.checkpoint === "apply_now_visible" ||
      result.checkpoint === "note_modal_visible" ||
      result.checkpoint === "captcha_visible"
    ) {
      console.log(`[vn-smoke] Official checkpoint reached: ${result.checkpoint}`);
      process.exit(0);
    }
    console.error(`[vn-smoke] Scaffolded but did not capture registration code: ${result.reason}`);
    process.exit(2);
  }

  if (result.status === "action_required") {
    console.error(`[vn-smoke] Manual checkpoint: ${result.checkpoint} (${result.actionType})`);
    process.exit(0);
  }

  console.error(`[vn-smoke] Failed at ${result.failedStep}`);
  process.exit(3);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(4);
});

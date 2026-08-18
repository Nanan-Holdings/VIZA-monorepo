#!/usr/bin/env npx tsx

import "dotenv/config";
import { execFileSync } from "node:child_process";
import { supabase } from "../src/supabase";

type FlyMachine = {
  id: string;
  state: string;
  config?: { env?: Record<string, string> };
};

type QueueRpcRow = {
  queue_id?: string;
  queue_provider?: string;
  reused_existing?: boolean;
};

const ACTIVE_PAYMENT_ATTEMPT_STATUSES = new Set(["started", "processing", "succeeded"]);
const TERMINAL_FAILURE_STATUSES = new Set([
  "failed",
  "vn_live_assisted_failed",
  "vn_payment_failed",
  "retry_superseded",
]);

function readArg(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length).trim() || null;
}

function requireUuid(value: string | null, label: string): string {
  if (!value || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`${label} must be an explicit UUID.`);
  }
  return value;
}

function requireIsoDate(value: string | null, label: string): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must use YYYY-MM-DD.`);
  }
  return value;
}

function answerContainsIsoDate(row: { value_text?: unknown; value_json?: unknown }, isoDate: string): boolean {
  const [year, month, day] = isoDate.split("-");
  const serialized = JSON.stringify([row.value_text ?? null, row.value_json ?? null]);
  return (
    serialized.includes(isoDate) ||
    serialized.includes(`${day}/${month}/${year}`) ||
    serialized.includes(`${month}/${day}/${year}`)
  );
}

async function resolveApplicationIdByTravelDates(arrivalDate: string, departureDate: string): Promise<string> {
  const { data: applications, error: applicationsError } = await supabase
    .from("applications")
    .select("id")
    .ilike("country", "vietnam")
    .eq("visa_type", "evisa_tourism")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (applicationsError) throw new Error(`Unable to list Vietnam QA applications: ${applicationsError.message}`);
  const applicationIds = (applications ?? []).map((row) => row.id).filter(Boolean);
  if (applicationIds.length === 0) throw new Error("No Vietnam eVisa applications are available for QA.");

  const { data: answers, error: answersError } = await supabase
    .from("visa_application_answers")
    .select("application_id, field_name, value_text, value_json")
    .in("application_id", applicationIds)
    .in("field_name", [
      "intended_date_of_entry",
      "intended_date_of_departure",
      "visa_valid_from",
      "visa_valid_to",
      "arrival_date",
      "departure_date",
    ]);
  if (answersError) throw new Error(`Unable to match Vietnam QA travel dates: ${answersError.message}`);

  const matchingIds = applicationIds.filter((applicationId) => {
    const rows = (answers ?? []).filter((row) => row.application_id === applicationId);
    return (
      rows.some((row) => answerContainsIsoDate(row, arrivalDate)) &&
      rows.some((row) => answerContainsIsoDate(row, departureDate))
    );
  });
  if (matchingIds.length !== 1) {
    throw new Error(`Expected exactly one Vietnam QA application for the supplied travel dates; found ${matchingIds.length}.`);
  }
  return matchingIds[0];
}

function flyctlJson(args: string[]): unknown {
  const executable = process.platform === "win32" ? "flyctl.exe" : "flyctl";
  const output = execFileSync(executable, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30_000,
  });
  return JSON.parse(output);
}

function listFlyMachines(appName: string): FlyMachine[] {
  const value = flyctlJson(["machine", "list", "-a", appName, "--json"]);
  if (!Array.isArray(value)) throw new Error("Fly Machines API returned an unexpected response.");
  return value as FlyMachine[];
}

function assertSafeFlyPreCardConfig(appName: string): FlyMachine {
  const machines = listFlyMachines(appName);
  if (machines.length !== 1) {
    throw new Error("Pre-card QA requires exactly one retained legacy Machine.");
  }
  const machine = machines[0];
  const env = machine.config?.env ?? {};
  if (env.VN_OFFICIAL_PAYMENT_STOP_BEFORE_CARD_ENTRY !== "true") {
    throw new Error("Fly pre-card stop guard is not enabled; refusing to enqueue QA work.");
  }
  if (env.VN_CLOUD_QUEUE_ENABLED !== "true" || env.VN_OFFICIAL_PAYMENT_AUTOPAY !== "true") {
    throw new Error("Fly Vietnam payment queue is not enabled for pre-card QA.");
  }
  if (machine.state !== "stopped") {
    throw new Error(`Fly legacy Machine is ${machine.state}; refusing to race active work.`);
  }
  return machine;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadAndValidateApplication(applicationId: string): Promise<{ userId: string }> {
  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .select("id, applicant_id, country, visa_type")
    .eq("id", applicationId)
    .single();
  if (applicationError || !application) {
    throw new Error(`Unable to load the selected application: ${applicationError?.message ?? "not found"}`);
  }
  if (String(application.country ?? "").toLowerCase() !== "vietnam") {
    throw new Error("Selected application is not Vietnam.");
  }
  const visaType = String(application.visa_type ?? "").toLowerCase();
  if (!visaType.includes("evisa") && !visaType.includes("e_visa")) {
    throw new Error("Selected application is not a Vietnam eVisa application.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("applicant_profiles")
    .select("inbox_alias")
    .eq("id", application.applicant_id)
    .single();
  if (profileError || !profile || !String(profile.inbox_alias ?? "").trim()) {
    throw new Error("Selected application has no managed inbox alias.");
  }

  const { data: previousQueue, error: queueError } = await supabase
    .from("submission_queue")
    .select("user_id, vn_registration_code_encrypted, status")
    .eq("application_id", applicationId)
    .eq("provider", "vietnam_evisa_live")
    .not("vn_registration_code_encrypted", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (queueError || !previousQueue?.vn_registration_code_encrypted || !previousQueue.user_id) {
    throw new Error("Selected application has no encrypted Vietnam registration checkpoint.");
  }
  if (["vn_payment_processing", "vn_live_assisted_processing"].includes(previousQueue.status)) {
    throw new Error("Selected application already has active official browser work.");
  }

  const [{ data: attempts, error: attemptsError }, { data: receipts, error: receiptsError }] = await Promise.all([
    supabase
      .from("official_fee_payment_attempts")
      .select("status")
      .eq("application_id", applicationId),
    supabase
      .from("official_fee_receipts")
      .select("id")
      .eq("application_id", applicationId)
      .limit(1),
  ]);
  if (attemptsError) throw new Error(`Unable to verify payment attempts: ${attemptsError.message}`);
  if (receiptsError) throw new Error(`Unable to verify payment receipts: ${receiptsError.message}`);
  if ((receipts ?? []).length > 0) {
    throw new Error("An official-fee receipt already exists; refusing to rerun pre-card QA.");
  }
  if ((attempts ?? []).some((row) => ACTIVE_PAYMENT_ATTEMPT_STATUSES.has(String(row.status ?? "")))) {
    throw new Error("An active or successful official-fee attempt exists; refusing to rerun pre-card QA.");
  }

  return { userId: previousQueue.user_id };
}

async function enqueuePreCardQa(applicationId: string, userId: string): Promise<string> {
  const now = new Date().toISOString();
  const { data, error } = await supabase.rpc("enqueue_official_fee_submission", {
    p_application_id: applicationId,
    p_user_id: userId,
    p_status: "vn_payment_pending",
    p_provider: "vietnam_evisa_live",
    p_current_stage: "official_fee_pre_card_qa_queued",
    p_manual_action_status: "completed",
    p_payment_status: "authorized",
    p_official_status: "registration_code_captured_payment_pending",
    p_result_payload: {
      status: "payment_authorized",
      checkpoint: "pre_card_qa_queued",
      registrationCodeCaptured: true,
      qaMode: "pre_card_only",
      paymentSubmitted: false,
    },
    p_now: now,
  });
  if (error) throw new Error(`Unable to enqueue pre-card QA: ${error.message}`);
  const row = (Array.isArray(data) ? data[0] : data) as QueueRpcRow | null;
  if (!row?.queue_id || row.queue_provider !== "vietnam_evisa_live") {
    throw new Error("Pre-card QA enqueue RPC returned no Vietnam queue job.");
  }
  if (row.reused_existing === true) {
    throw new Error("An active queue job already exists; refusing to reinterpret it as pre-card QA.");
  }

  const { data: queued, error: queuedError } = await supabase
    .from("submission_queue")
    .select("vn_registration_code_encrypted, vn_result_payload, status")
    .eq("id", row.queue_id)
    .single();
  if (queuedError || !queued) {
    throw new Error(`Unable to verify the pre-card QA queue row: ${queuedError?.message ?? "not found"}`);
  }
  const payload = queued.vn_result_payload as Record<string, unknown> | null;
  if (
    queued.status !== "vn_payment_pending" ||
    !queued.vn_registration_code_encrypted ||
    payload?.qaMode !== "pre_card_only" ||
    payload?.paymentSubmitted !== false
  ) {
    throw new Error("Pre-card QA queue row failed its encrypted checkpoint or no-payment guard.");
  }
  return row.queue_id;
}

async function enqueueFreshProfileQa(applicationId: string, userId: string): Promise<string> {
  const now = new Date().toISOString();
  const { data, error } = await supabase.rpc("enqueue_official_fee_submission", {
    p_application_id: applicationId,
    p_user_id: userId,
    p_status: "vn_cloud_live_pending",
    p_provider: "vietnam_evisa_live",
    p_current_stage: "official_fee_fresh_profile_qa_queued",
    p_manual_action_status: "completed",
    p_payment_status: "not_required",
    p_official_status: "fresh_profile_requested",
    p_result_payload: {
      status: "fresh_profile_requested",
      checkpoint: "fresh_profile_qa_queued",
      qaMode: "fresh_profile_only",
      paymentSubmitted: false,
    },
    p_now: now,
  });
  if (error) throw new Error(`Unable to enqueue fresh-profile QA: ${error.message}`);
  const row = (Array.isArray(data) ? data[0] : data) as QueueRpcRow | null;
  if (!row?.queue_id || row.queue_provider !== "vietnam_evisa_live") {
    throw new Error("Fresh-profile QA enqueue RPC returned no Vietnam queue job.");
  }
  if (row.reused_existing === true) {
    throw new Error("An active queue job already exists; refusing to replace it with fresh-profile QA.");
  }

  const { data: queued, error: queuedError } = await supabase
    .from("submission_queue")
    .select("vn_registration_code_encrypted, vn_result_payload, status")
    .eq("id", row.queue_id)
    .single();
  if (queuedError || !queued) {
    throw new Error(`Unable to verify the fresh-profile QA row: ${queuedError?.message ?? "not found"}`);
  }
  const payload = queued.vn_result_payload as Record<string, unknown> | null;
  if (
    queued.status !== "vn_cloud_live_pending" ||
    queued.vn_registration_code_encrypted ||
    payload?.qaMode !== "fresh_profile_only" ||
    payload?.paymentSubmitted !== false
  ) {
    throw new Error("Fresh-profile QA row failed its no-payment or empty-checkpoint guard.");
  }
  return row.queue_id;
}

function startFlyMachine(appName: string, machineId: string): void {
  const executable = process.platform === "win32" ? "flyctl.exe" : "flyctl";
  execFileSync(executable, ["machine", "start", machineId, "-a", appName], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 60_000,
  });
}

async function waitForCardEntry(queueId: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { data, error } = await supabase
      .from("submission_queue")
      .select("status, current_stage, payment_status, official_status, error_code, vn_result_payload")
      .eq("id", queueId)
      .single();
    if (error || !data) throw new Error(`Unable to monitor pre-card QA: ${error?.message ?? "not found"}`);
    const payload = data.vn_result_payload as Record<string, unknown> | null;
    if (
      data.status === "vn_blocked" &&
      data.current_stage === "official_fee_card_entry_ready" &&
      data.payment_status === "card_entry_ready" &&
      payload?.paymentSubmitted === false
    ) {
      console.log(JSON.stringify({
        status: "card_entry_ready",
        paymentSubmitted: false,
        officialStatus: data.official_status,
      }));
      return;
    }
    if (data.status === "vn_blocked") {
      throw new Error(
        `Pre-card QA reached a non-card checkpoint: stage=${data.current_stage ?? "unknown"}` +
        ` code=${data.error_code ?? "unknown"}`,
      );
    }
    if (TERMINAL_FAILURE_STATUSES.has(data.status)) {
      throw new Error(
        `Pre-card QA stopped before card entry: stage=${data.current_stage ?? "unknown"}` +
        ` code=${data.error_code ?? "unknown"}`,
      );
    }
    await sleep(5_000);
  }
  throw new Error("Pre-card QA did not reach card entry within the bounded timeout.");
}

async function waitForFreshRegistration(queueId: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { data, error } = await supabase
      .from("submission_queue")
      .select("status, current_stage, official_status, error_code, vn_registration_code_encrypted, vn_result_payload")
      .eq("id", queueId)
      .single();
    if (error || !data) throw new Error(`Unable to monitor fresh-profile QA: ${error?.message ?? "not found"}`);
    const payload = data.vn_result_payload as Record<string, unknown> | null;
    const captured = Boolean(data.vn_registration_code_encrypted);
    if (
      captured &&
      payload?.paymentSubmitted !== true &&
      (
        data.status === "vn_prefilled" ||
        data.official_status === "registration_code_captured" ||
        data.official_status === "registration_code_captured_payment_pending"
      )
    ) {
      console.log(JSON.stringify({
        status: "fresh_registration_ready",
        registrationCodeCaptured: true,
        paymentSubmitted: false,
      }));
      return;
    }
    if (data.status === "vn_blocked" || TERMINAL_FAILURE_STATUSES.has(data.status)) {
      throw new Error(
        `Fresh-profile QA stopped before registration capture: stage=${data.current_stage ?? "unknown"}` +
        ` code=${data.error_code ?? "unknown"}`,
      );
    }
    await sleep(5_000);
  }
  throw new Error("Fresh-profile QA did not capture a new registration checkpoint within the bounded timeout.");
}

async function waitForFlyStop(appName: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const machines = listFlyMachines(appName);
    if (machines.every((machine) => machine.state === "stopped")) return true;
    await sleep(10_000);
  }
  return false;
}

async function main(): Promise<void> {
  if (!process.argv.includes("--execute")) {
    throw new Error("Refusing to enqueue without explicit --execute.");
  }
  const explicitApplicationId = readArg("application-id") ?? process.env.VN_CLOUD_PRE_CARD_QA_APPLICATION_ID ?? null;
  const applicationId = explicitApplicationId
    ? requireUuid(explicitApplicationId, "application-id")
    : await resolveApplicationIdByTravelDates(
        requireIsoDate(readArg("arrival-date"), "arrival-date"),
        requireIsoDate(readArg("departure-date"), "departure-date"),
      );
  const appName = readArg("fly-app") ?? process.env.FLY_SUBMISSION_LEGACY_APP ?? "viza-prod-submission-legacy";
  const timeoutMs = Number(readArg("timeout-ms") ?? process.env.VN_CLOUD_PRE_CARD_QA_TIMEOUT_MS ?? 480_000);
  if (!Number.isFinite(timeoutMs) || timeoutMs < 60_000 || timeoutMs > 900_000) {
    throw new Error("timeout-ms must be between 60000 and 900000.");
  }

  const machine = assertSafeFlyPreCardConfig(appName);
  const { userId } = await loadAndValidateApplication(applicationId);
  if (process.argv.includes("--fresh-profile")) {
    const freshQueueId = await enqueueFreshProfileQa(applicationId, userId);
    console.log("[vn-cloud-pre-card] Fresh-profile QA row verified; starting one stopped legacy Machine.");
    startFlyMachine(appName, machine.id);
    await waitForFreshRegistration(freshQueueId, timeoutMs);
    const stoppedAfterFreshProfile = await waitForFlyStop(appName, 240_000);
    if (!stoppedAfterFreshProfile) {
      throw new Error("Fresh-profile QA succeeded, but the Fly Machine did not stop before the payment search stage.");
    }
  }

  const preCardMachine = assertSafeFlyPreCardConfig(appName);
  const queueId = await enqueuePreCardQa(applicationId, userId);
  console.log("[vn-cloud-pre-card] Safe QA row verified; starting one stopped legacy Machine.");
  startFlyMachine(appName, preCardMachine.id);
  await waitForCardEntry(queueId, timeoutMs);
  const stopped = await waitForFlyStop(appName, 240_000);
  if (!stopped) {
    throw new Error("Pre-card QA succeeded, but the Fly Machine did not stop within the idle window.");
  }
  console.log(JSON.stringify({ status: "complete", cardEntryReady: true, paymentSubmitted: false, machineStopped: true }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

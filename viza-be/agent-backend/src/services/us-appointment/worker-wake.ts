import type { AppointmentAssistanceJob } from "./types.js";

export type USAppointmentWakeFailure =
  | "not_configured"
  | "invalid_configuration"
  | "machine_unavailable"
  | "machine_lifecycle_unverified"
  | "machine_start_failed"
  | "readiness_timeout"
  | "worker_busy"
  | "job_ineligible"
  | "worker_disabled"
  | "request_failed"
  | "invalid_response";

export type USAppointmentWakeResult =
  | { ok: true; duplicate: boolean; coldStart: "configured" | "not_configured" }
  | { ok: false; reason: USAppointmentWakeFailure };

export type USAppointmentWorkerWake = (jobId: string) => Promise<USAppointmentWakeResult>;

const WORKER_STATUSES = new Set([
  "appointment_consent_received",
  "appointment_account_required",
  "appointment_login_required",
  "appointment_payment_completed",
  "appointment_no_slots_available",
  "appointment_booked",
  "appointment_status_check_in_progress",
]);

/** Mirrors submission-service eligibility; the worker re-reads and claims the job. */
export function isAutoSupportedUSAppointmentManualAction(actionType: string | null): boolean {
  return actionType === "login" || actionType === "account_email_verification";
}

export function isUSAppointmentWorkerEligible(job: AppointmentAssistanceJob): boolean {
  const supportedManualAction = isAutoSupportedUSAppointmentManualAction(job.currentManualAction);
  return job.mode === "assisted_live"
    && job.countryCode === "US"
    && job.applyingCountryCode?.trim().toUpperCase() === "CN"
    && job.schedulingProvider?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "") === "usvisascheduling"
    && WORKER_STATUSES.has(job.status)
    && (!job.requiresUserAction || supportedManualAction)
    && (!job.currentManualAction || supportedManualAction);
}

type WakeOptions = {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  readinessTimeoutMs?: number;
  readinessPollMs?: number;
};

type WakeConfig = {
  baseUrl: string;
  token: string;
  fly: { app: string; machineId: string; token: string } | null;
};

function readConfig(env: NodeJS.ProcessEnv): WakeConfig | USAppointmentWakeFailure {
  const rawUrl = env.US_APPOINTMENT_SUBMISSION_SERVICE_URL?.trim();
  const token = env.US_APPOINTMENT_INTERNAL_TOKEN?.trim() || env.SUBMISSION_QUEUE_INTERNAL_TOKEN?.trim();
  const app = env.US_APPOINTMENT_FLY_APP?.trim();
  const machineId = env.US_APPOINTMENT_FLY_MACHINE_ID?.trim();
  const flyToken = env.FLY_SUBMISSION_ORG_TOKEN?.trim();
  const flySelected = Boolean(app || machineId);
  // A shared Fly organization token alone does not select a machine for this flow.
  if (flySelected && (!app || !machineId || !flyToken)) return "invalid_configuration";
  if (!rawUrl || !token) return "not_configured";
  try {
    const url = new URL(rawUrl);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash || !["", "/"].includes(url.pathname)
      || (url.protocol !== "https:" && !(loopback && url.protocol === "http:"))) {
      return "invalid_configuration";
    }
    if (flySelected) {
      if (!/^[a-z0-9][a-z0-9-]*$/.test(app!) || !/^[a-zA-Z0-9]+$/.test(machineId!)
        || url.protocol !== "https:" || url.hostname !== `${app}.fly.dev` || url.port) {
        return "invalid_configuration";
      }
      return { baseUrl: url.origin, token, fly: { app: app!, machineId: machineId!, token: flyToken! } };
    }
    return { baseUrl: url.origin, token, fly: null };
  } catch {
    return "invalid_configuration";
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function request(fetchImpl: typeof fetch, url: string, init: RequestInit = {}, timeoutMs = 6_000): Promise<Response> {
  return fetchImpl(url, {
    ...init,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(Math.max(1, timeoutMs)),
  });
}

/** Starts only the explicitly configured retained machine. Never creates or scales machines. */
async function prepareMachine(config: WakeConfig, fetchImpl: typeof fetch, options: WakeOptions): Promise<USAppointmentWakeFailure | null> {
  if (!config.fly) return null;
  const machineUrl = `https://api.machines.dev/v1/apps/${encodeURIComponent(config.fly.app)}/machines/${encodeURIComponent(config.fly.machineId)}`;
  const headers = { Authorization: `Bearer ${config.fly.token}`, "Content-Type": "application/json" };
  const response = await request(fetchImpl, machineUrl, { headers });
  if (!response.ok) return "machine_unavailable";
  const machine: unknown = await response.json();
  if (!isObject(machine) || machine.id !== config.fly.machineId || typeof machine.state !== "string") {
    return "machine_unavailable";
  }
  if (!["stopped", "suspended", "started", "starting"].includes(machine.state)) return "machine_unavailable";
  const machineEnv = isObject(machine.config) && isObject(machine.config.env) ? machine.config.env : null;
  const rawIdleExit = machineEnv?.SUBMISSION_SERVICE_IDLE_EXIT_MS;
  const idleExitMs = typeof rawIdleExit === "string" || typeof rawIdleExit === "number" ? Number(rawIdleExit) : NaN;
  if (machineEnv?.RUNNER_MACHINE_KIND !== "pool" || !Number.isFinite(idleExitMs) || idleExitMs <= 0 || idleExitMs > 3_600_000) {
    return "machine_lifecycle_unverified";
  }
  if (["stopped", "suspended"].includes(machine.state)) {
    const start = await request(fetchImpl, `${machineUrl}/start`, { method: "POST", headers, body: "{}" });
    if (!start.ok && start.status !== 409) return "machine_start_failed";
  }

  const timeoutMs = Math.max(0, Math.min(20_000, options.readinessTimeoutMs ?? 20_000));
  const deadline = Date.now() + timeoutMs;
  do {
    try {
      const ready = await request(fetchImpl, `${config.baseUrl}/ready`, {
        headers: { "Fly-Force-Instance-Id": config.fly.machineId },
      }, Math.min(3_000, Math.max(1, deadline - Date.now())));
      if (ready.ok) return null;
    } catch {
      // The existing machine may be starting; use a fixed, bounded readiness window.
    }
    const waitMs = Math.min(Math.max(1, options.readinessPollMs ?? 500), Math.max(0, deadline - Date.now()));
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
  } while (Date.now() < deadline);
  return "readiness_timeout";
}

export async function wakeUSAppointmentWorker(jobId: string, options: WakeOptions = {}): Promise<USAppointmentWakeResult> {
  const config = readConfig(options.env ?? process.env);
  if (typeof config === "string") return { ok: false, reason: config };
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const machineFailure = await prepareMachine(config, fetchImpl, options);
    if (machineFailure) return { ok: false, reason: machineFailure };
    const response = await request(fetchImpl, `${config.baseUrl}/internal/us-appointment/wake`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
        ...(config.fly ? { "Fly-Force-Instance-Id": config.fly.machineId } : {}),
      },
      body: JSON.stringify({ jobId }),
    });
    if (response.status === 409) return { ok: false, reason: "worker_busy" };
    if (response.status === 422) return { ok: false, reason: "job_ineligible" };
    if (response.status === 503) return { ok: false, reason: "worker_disabled" };
    if (response.status !== 202) return { ok: false, reason: "request_failed" };
    const body: unknown = await response.json();
    if (!isObject(body) || body.ok !== true || body.accepted !== true || typeof body.duplicate !== "boolean") {
      return { ok: false, reason: "invalid_response" };
    }
    return { ok: true, duplicate: body.duplicate, coldStart: config.fly ? "configured" : "not_configured" };
  } catch {
    // Credentials, endpoint URLs, provider bodies and thrown errors never enter audit records.
    return { ok: false, reason: "request_failed" };
  }
}

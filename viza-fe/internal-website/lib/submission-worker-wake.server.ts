import "server-only";
import { ensureFlyMachineStarted, waitForHttpReady } from "@/lib/fly-machine-wake.server";
import { isRunnerCutoverPaused } from "@/lib/runner-cutover-pause.server";

type WakeEnvironment = Partial<NodeJS.ProcessEnv>;

type WakeEndpoint = "default" | "legacy" | "ds160" | "france";

export type SubmissionWorkerWakeResult =
  | { ok: true }
  | { ok: false; reason: "cutover_paused" | "not_configured" | "insecure_url" | "request_failed" | "target_mismatch" | "capacity_full" | "machine_not_found" | "readiness_timeout" };

function resolveWakeBaseUrl(
  env: WakeEnvironment,
  target: string,
  endpoint: WakeEndpoint = "default",
): string | null {
  const normalized = target.trim().toLowerCase().replace(/[\s-]+/gu, "_");
  const isPool = normalized === "pool" || normalized === "runner_pool" ||
      ["vn", "vietnam", "sg", "singapore", "my", "malaysia", "th", "thailand"].includes(normalized)
  const isIndonesia = normalized === "indonesia" || normalized === "id";
  const isSouthKorea = normalized === "south_korea" || normalized === "korea" || normalized === "kr" || normalized === "kor";
  const isDs160 = endpoint === "ds160" || normalized === "ds160";
  const isFrance = endpoint === "france" || normalized === "france" || normalized === "fr";
  const explicitUrl = isDs160
    ? env.SUBMISSION_SERVICE_DS160_URL
    : isFrance
    ? env.SUBMISSION_SERVICE_FRANCE_URL
    : endpoint === "legacy"
    ? env.SUBMISSION_SERVICE_CLOUD_URL
    : isPool
      ? env.RUNNER_POOL_SUBMISSION_SERVICE_URL
      : isIndonesia
        ? env.INDONESIA_SUBMISSION_SERVICE_URL
        : isSouthKorea
          ? env.SOUTH_KOREA_SUBMISSION_SERVICE_URL ?? env.KOREA_SUBMISSION_SERVICE_URL
          : env.VIETNAM_SUBMISSION_SERVICE_URL ?? env.SUBMISSION_SERVICE_CLOUD_URL;
  if (explicitUrl?.trim()) return explicitUrl.trim().replace(/\/+$/u, "");

  const app = isDs160
    ? env.FLY_SUBMISSION_DS160_APP?.trim() || "viza-prod-submission-ds160"
    : isFrance
    ? env.FLY_SUBMISSION_FRANCE_APP?.trim() || "viza-prod-submission-france"
    : isPool
    ? env.FLY_RUNNER_POOL_APP?.trim() || "viza-runner-pool"
    : isIndonesia
      ? env.FLY_RUNNER_INDONESIA_APP?.trim() || "viza-runner-indonesia"
      : isSouthKorea
        ? env.FLY_RUNNER_SOUTH_KOREA_APP?.trim() || "viza-runner-south-korea"
        : env.FLY_SUBMISSION_LEGACY_APP?.trim() || "viza-submission-legacy";
  return /^[a-z0-9][a-z0-9-]{0,62}$/u.test(app) ? `https://${app}.fly.dev` : null;
}

function resolveWakeConfig(
  env: WakeEnvironment,
  target: string,
  endpoint: WakeEndpoint = "default",
): { baseUrl: string; token: string } | null {
  const baseUrl = resolveWakeBaseUrl(env, target, endpoint);
  const token = (
    env.SUBMISSION_QUEUE_INTERNAL_TOKEN ??
    env.VIETNAM_CARD_SESSION_INTERNAL_TOKEN
  )?.trim();
  return baseUrl && token ? { baseUrl, token } : null;
}

export async function wakeCloudSubmissionWorker(
  jobId: string | null,
  options: {
    env?: WakeEnvironment;
    fetchImpl?: typeof fetch;
    target?: string;
    endpoint?: WakeEndpoint;
  } = {},
): Promise<SubmissionWorkerWakeResult> {
  const env = options.env ?? process.env;
  if (isRunnerCutoverPaused(env)) {
    return { ok: false, reason: "cutover_paused" };
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const target = options.target ?? "legacy";
  const endpoint = options.endpoint ?? "default";
  const normalizedTarget = target.trim().toLowerCase().replace(/[\s-]+/gu, "_");
  // Country aliases can also wake maintenance handled by the shared service.
  // Only explicit runner-pool enqueues use the runner_job-only endpoint.
  const isRunnerPoolTarget = normalizedTarget === "pool" || normalizedTarget === "runner_pool";
  const wakePath = isRunnerPoolTarget
    ? "/internal/runner-job/wake"
    : "/internal/submission-queue/wake";
  const machineWake = await ensureFlyMachineStarted(target, {
    env,
    fetchImpl,
  });
  const config = resolveWakeConfig(env, target, endpoint);
  if (!config) {
    return machineWake.ok && machineWake.state === "start_requested"
      ? { ok: true }
      : { ok: false, reason: "not_configured" };
  }
  if (env.NODE_ENV === "production" && !config.baseUrl.startsWith("https://")) {
    return { ok: false, reason: "insecure_url" };
  }

  try {
    const response = await fetchImpl(
      `${config.baseUrl}${wakePath}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jobId }),
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      },
    );
    return response.ok || (machineWake.ok && machineWake.state === "start_requested")
      ? { ok: true }
      : { ok: false, reason: "request_failed" };
  } catch {
    return machineWake.ok && machineWake.state === "start_requested"
      ? { ok: true }
      : { ok: false, reason: "request_failed" };
  }
}

/**
 * DS-160 runs on its own US East worker (the legacy image, next to the CEAC
 * browser), not on the Singapore legacy worker. Keep this mapping explicit so
 * the generic legacy compatibility path used by Vietnam is not changed.
 */
export async function wakeDs160SubmissionWorker(
  jobId: string | null,
  options: {
    env?: WakeEnvironment;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<SubmissionWorkerWakeResult> {
  return wakeCloudSubmissionWorker(jobId, {
    ...options,
    target: "ds160",
    endpoint: "ds160",
  });
}

/** UK jobs use the retained legacy Machine and its authenticated queue wake.
 * A Machine start acknowledgement alone is not proof the worker accepted wake.
 */
export async function wakeUkSubmissionWorker(
  jobId: string | null,
  options: { env?: WakeEnvironment; fetchImpl?: typeof fetch } = {},
): Promise<SubmissionWorkerWakeResult> {
  const env = options.env ?? process.env;
  if (isRunnerCutoverPaused(env)) return { ok: false, reason: "cutover_paused" };
  const config = resolveWakeConfig(env, "legacy", "legacy");
  if (!config || !jobId) return { ok: false, reason: "not_configured" };
  const app = env.FLY_SUBMISSION_LEGACY_APP?.trim() || "viza-submission-legacy";
  try {
    const url = new URL(config.baseUrl);
    if (url.protocol !== "https:") return { ok: false, reason: "insecure_url" };
    if (url.origin !== `https://${app}.fly.dev` || url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
      return { ok: false, reason: "target_mismatch" };
    }
  } catch {
    return { ok: false, reason: "insecure_url" };
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const machine = await ensureFlyMachineStarted("legacy", { env, fetchImpl });
  if (!machine.ok) {
    return { ok: false, reason: machine.reason === "unmanaged_target" ? "request_failed" : machine.reason };
  }
  const ready = await waitForHttpReady(`${config.baseUrl}/ready`, {
    fetchImpl, timeoutMs: 12_000, requestTimeoutMs: 3_000, pollIntervalMs: 500,
  });
  if (!ready.ok) return { ok: false, reason: "readiness_timeout" };
  try {
    const response = await fetchImpl(`${config.baseUrl}/internal/submission-queue/wake`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    return response.ok ? { ok: true } : { ok: false, reason: "request_failed" };
  } catch {
    return { ok: false, reason: "request_failed" };
  }
}

/**
 * France-Visas runs on its own Frankfurt worker (the legacy image, next to the
 * eu-central-1 France-Visas browser); the Singapore legacy worker denylists
 * the France-Visas providers. Wake that worker explicitly.
 */
export async function wakeFranceSubmissionWorker(
  jobId: string | null,
  options: {
    env?: WakeEnvironment;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<SubmissionWorkerWakeResult> {
  return wakeCloudSubmissionWorker(jobId, {
    ...options,
    target: "france",
    endpoint: "france",
  });
}

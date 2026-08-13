import "server-only";
import { ensureFlyMachineStarted } from "@/lib/fly-machine-wake.server";

type WakeEnvironment = Partial<NodeJS.ProcessEnv>;

export type SubmissionWorkerWakeResult =
  | { ok: true }
  | { ok: false; reason: "not_configured" | "insecure_url" | "request_failed" };

function resolveWakeBaseUrl(env: WakeEnvironment, target: string): string | null {
  const normalized = target.trim().toLowerCase().replace(/[\s-]+/gu, "_");
  const isPool = normalized === "pool" || normalized === "runner_pool" ||
      ["vn", "vietnam", "sg", "singapore", "my", "malaysia", "th", "thailand"].includes(normalized)
  const isIndonesia = normalized === "indonesia" || normalized === "id";
  const isSouthKorea = normalized === "south_korea" || normalized === "korea" || normalized === "kr" || normalized === "kor";
  const explicitUrl = isPool
    ? env.RUNNER_POOL_SUBMISSION_SERVICE_URL
    : isIndonesia
      ? env.INDONESIA_SUBMISSION_SERVICE_URL
      : isSouthKorea
        ? env.SOUTH_KOREA_SUBMISSION_SERVICE_URL ?? env.KOREA_SUBMISSION_SERVICE_URL
        : env.VIETNAM_SUBMISSION_SERVICE_URL ?? env.SUBMISSION_SERVICE_CLOUD_URL;
  if (explicitUrl?.trim()) return explicitUrl.trim().replace(/\/+$/u, "");

  const app = isPool
    ? env.FLY_RUNNER_POOL_APP?.trim() || "viza-runner-pool"
    : isIndonesia
      ? env.FLY_RUNNER_INDONESIA_APP?.trim() || "viza-runner-indonesia"
      : isSouthKorea
        ? env.FLY_RUNNER_SOUTH_KOREA_APP?.trim() || "viza-runner-south-korea"
        : env.FLY_SUBMISSION_LEGACY_APP?.trim() || "viza-submission-legacy";
  return /^[a-z0-9][a-z0-9-]{0,62}$/u.test(app) ? `https://${app}.fly.dev` : null;
}

function resolveWakeConfig(env: WakeEnvironment, target: string): { baseUrl: string; token: string } | null {
  const baseUrl = resolveWakeBaseUrl(env, target);
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
  } = {},
): Promise<SubmissionWorkerWakeResult> {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const target = options.target ?? "legacy";
  const normalizedTarget = target.trim().toLowerCase().replace(/[\s-]+/gu, "_");
  const isRunnerPoolTarget = [
    "pool", "runner_pool", "vn", "vietnam", "sg", "singapore",
    "my", "malaysia", "th", "thailand",
  ].includes(normalizedTarget);
  const wakePath = isRunnerPoolTarget
    ? "/internal/runner-job/wake"
    : "/internal/submission-queue/wake";
  const machineWake = await ensureFlyMachineStarted(target, {
    env,
    fetchImpl,
  });
  const config = resolveWakeConfig(env, target);
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

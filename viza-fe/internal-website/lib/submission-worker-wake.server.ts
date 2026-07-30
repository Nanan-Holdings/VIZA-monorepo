import "server-only";
import { ensureFlyMachineStarted } from "@/lib/fly-machine-wake.server";

type WakeEnvironment = Partial<NodeJS.ProcessEnv>;

export type SubmissionWorkerWakeResult =
  | { ok: true }
  | { ok: false; reason: "not_configured" | "insecure_url" | "request_failed" };

function resolveWakeConfig(env: WakeEnvironment): { baseUrl: string; token: string } | null {
  const baseUrl = (
    env.VIETNAM_SUBMISSION_SERVICE_URL ??
    env.SUBMISSION_SERVICE_CLOUD_URL
  )?.trim().replace(/\/+$/u, "");
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
  const machineWake = await ensureFlyMachineStarted(options.target ?? "legacy", {
    env,
    fetchImpl,
  });
  const config = resolveWakeConfig(env);
  if (!config) {
    return machineWake.ok
      ? { ok: true }
      : { ok: false, reason: "not_configured" };
  }
  if (env.NODE_ENV === "production" && !config.baseUrl.startsWith("https://")) {
    return { ok: false, reason: "insecure_url" };
  }

  try {
    const response = await fetchImpl(
      `${config.baseUrl}/internal/submission-queue/wake`,
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
    return response.ok || machineWake.ok
      ? { ok: true }
      : { ok: false, reason: "request_failed" };
  } catch {
    return machineWake.ok
      ? { ok: true }
      : { ok: false, reason: "request_failed" };
  }
}

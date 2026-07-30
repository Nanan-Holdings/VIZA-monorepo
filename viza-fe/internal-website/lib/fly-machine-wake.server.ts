import "server-only";

type WakeEnvironment = Partial<NodeJS.ProcessEnv>;

export const FLY_WAKE_COUNTRIES = [
  "indonesia",
  "vietnam",
  "singapore",
  "malaysia",
  "thailand",
  "south_korea",
] as const;

export type FlyWakeCountry = (typeof FLY_WAKE_COUNTRIES)[number];
export type FlyWakeTarget = FlyWakeCountry | "legacy";

export type FlyMachineWakeResult =
  | { ok: true; target: FlyWakeTarget; app: string; state: "already_running" | "start_requested" }
  | {
      ok: false;
      target: string;
      reason: "unmanaged_target" | "not_configured" | "machine_not_found" | "request_failed";
    };

interface FlyMachineSummary {
  id: string;
  state: string;
}

const TARGET_APPS: Record<FlyWakeTarget, string> = {
  legacy: "viza-submission-legacy",
  indonesia: "viza-runner-indonesia",
  vietnam: "viza-runner-vietnam",
  singapore: "viza-runner-singapore",
  malaysia: "viza-runner-malaysia",
  thailand: "viza-runner-thailand",
  south_korea: "viza-runner-south-korea",
};

const COUNTRY_ALIASES: Record<string, FlyWakeCountry> = {
  id: "indonesia",
  indonesia: "indonesia",
  vn: "vietnam",
  vietnam: "vietnam",
  sg: "singapore",
  singapore: "singapore",
  my: "malaysia",
  malaysia: "malaysia",
  th: "thailand",
  thailand: "thailand",
  kr: "south_korea",
  korea: "south_korea",
  kor: "south_korea",
  south_korea: "south_korea",
};

const inFlightStarts = new Map<FlyWakeTarget, Promise<FlyMachineWakeResult>>();

function normalizeTarget(target: string): FlyWakeTarget | null {
  const normalized = target.trim().toLowerCase().replace(/[\s-]+/gu, "_");
  if (normalized === "legacy") return "legacy";
  return COUNTRY_ALIASES[normalized] ?? null;
}

function flyApiConfig(env: WakeEnvironment): { token: string; baseUrl: string } | null {
  const token = env.FLY_SUBMISSION_ORG_TOKEN?.trim();
  if (!token) return null;
  return {
    token,
    baseUrl: (env.FLY_MACHINES_API_URL ?? "https://api.machines.dev/v1").replace(/\/+$/u, ""),
  };
}

async function flyRequest(
  url: string,
  token: string,
  fetchImpl: typeof fetch,
  init: RequestInit = {},
): Promise<Response> {
  return fetchImpl(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(6_000),
  });
}

async function startTarget(
  target: FlyWakeTarget,
  env: WakeEnvironment,
  fetchImpl: typeof fetch,
): Promise<FlyMachineWakeResult> {
  const config = flyApiConfig(env);
  if (!config) return { ok: false, target, reason: "not_configured" };

  const app = TARGET_APPS[target];
  try {
    const listResponse = await flyRequest(
      `${config.baseUrl}/apps/${encodeURIComponent(app)}/machines`,
      config.token,
      fetchImpl,
    );
    if (!listResponse.ok) return { ok: false, target, reason: "request_failed" };

    const machines = (await listResponse.json()) as FlyMachineSummary[];
    const alreadyRunning = machines.some(
      (machine) => machine.state === "started" || machine.state === "starting",
    );
    if (alreadyRunning) return { ok: true, target, app, state: "already_running" };

    const candidate = machines
      .filter((machine) => machine.state === "stopped" || machine.state === "suspended")
      .sort((left, right) => left.id.localeCompare(right.id))[0];
    if (!candidate) return { ok: false, target, reason: "machine_not_found" };

    const startResponse = await flyRequest(
      `${config.baseUrl}/apps/${encodeURIComponent(app)}/machines/${encodeURIComponent(candidate.id)}/start`,
      config.token,
      fetchImpl,
      { method: "POST", body: "{}" },
    );
    if (startResponse.ok || startResponse.status === 409) {
      return { ok: true, target, app, state: "start_requested" };
    }
    return { ok: false, target, reason: "request_failed" };
  } catch {
    return { ok: false, target, reason: "request_failed" };
  }
}

export async function ensureFlyMachineStarted(
  rawTarget: string,
  options: {
    env?: WakeEnvironment;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<FlyMachineWakeResult> {
  const target = normalizeTarget(rawTarget);
  if (!target) return { ok: false, target: rawTarget, reason: "unmanaged_target" };

  const existing = inFlightStarts.get(target);
  if (existing) return existing;

  const operation = startTarget(
    target,
    options.env ?? process.env,
    options.fetchImpl ?? fetch,
  ).finally(() => {
    inFlightStarts.delete(target);
  });
  inFlightStarts.set(target, operation);
  return operation;
}

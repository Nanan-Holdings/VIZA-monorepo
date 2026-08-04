import "server-only";
import { withAdmin } from "@/lib/auth/with-admin";

type WakeEnvironment = Partial<NodeJS.ProcessEnv>;

export type FlyWakeTarget = "legacy" | "pool" | "indonesia" | "south_korea";

export type FlyMachineWakeResult =
  | { ok: true; target: FlyWakeTarget; app: string; state: "already_running" | "start_requested" }
  | {
      ok: false;
      target: string;
      reason:
        | "unmanaged_target"
        | "not_configured"
        | "machine_not_found"
        | "capacity_full"
        | "request_failed";
    };

export type FlyMachineCapacityResult =
  | {
      ok: true;
      target: FlyWakeTarget;
      app: string;
      desired: number;
      active: number;
      started: number;
    }
  | Extract<FlyMachineWakeResult, { ok: false }>;

interface FlyMachineSummary {
  id: string;
  state: string;
}

const DEFAULT_TARGET_APPS: Record<FlyWakeTarget, string> = {
  pool: "viza-runner-pool",
  legacy: "viza-submission-legacy",
  indonesia: "viza-runner-indonesia",
  south_korea: "viza-runner-south-korea",
};

function targetApps(env: WakeEnvironment): Record<FlyWakeTarget, string> {
  return {
    pool: env.FLY_RUNNER_POOL_APP?.trim() || DEFAULT_TARGET_APPS.pool,
    legacy:
      env.FLY_SUBMISSION_LEGACY_APP?.trim() || DEFAULT_TARGET_APPS.legacy,
    indonesia:
      env.FLY_RUNNER_INDONESIA_APP?.trim() || DEFAULT_TARGET_APPS.indonesia,
    south_korea:
      env.FLY_RUNNER_SOUTH_KOREA_APP?.trim() ||
      DEFAULT_TARGET_APPS.south_korea,
  };
}

const COUNTRY_ALIASES: Record<string, FlyWakeTarget> = {
  id: "indonesia",
  indonesia: "indonesia",
  vn: "pool",
  vietnam: "pool",
  sg: "pool",
  singapore: "pool",
  my: "pool",
  malaysia: "pool",
  th: "pool",
  thailand: "pool",
  kr: "south_korea",
  korea: "south_korea",
  kor: "south_korea",
  south_korea: "south_korea",
};

const inFlightCapacity = new Map<FlyWakeTarget, Promise<FlyMachineCapacityResult>>();

function normalizeTarget(target: string): FlyWakeTarget | null {
  const normalized = target.trim().toLowerCase().replace(/[\s-]+/gu, "_");
  if (normalized === "legacy") return "legacy";
  if (normalized === "pool" || normalized === "runner_pool") return "pool";
  return COUNTRY_ALIASES[normalized] ?? null;
}

function slotKind(target: FlyWakeTarget): "pool" | "legacy" | "south_korea" | "indonesia" | null {
  if (
    target === "pool" ||
    target === "legacy" ||
    target === "south_korea" ||
    target === "indonesia"
  ) {
    return target;
  }
  return null;
}

function slotEnforcementConfigured(env: WakeEnvironment): boolean {
  return Boolean(
    env.SUPABASE_SERVICE_ROLE_KEY?.trim() &&
      (env.NEXT_PUBLIC_SUPABASE_URL?.trim() || env.SUPABASE_URL?.trim()),
  );
}

async function reserveSlot(
  target: FlyWakeTarget,
  machineId: string,
  env: WakeEnvironment,
): Promise<{ reserved: boolean; evictedPoolMachineId: string | null }> {
  const kind = slotKind(target);
  if (!kind || !slotEnforcementConfigured(env)) {
    return { reserved: true, evictedPoolMachineId: null };
  }
  return withAdmin("system", "fly-machine-wake:reserve-slot", async (admin) => {
    if (kind === "legacy" || kind === "south_korea" || kind === "indonesia") {
      const { data, error } = await admin.rpc("reserve_sticky_runner_machine_slot", {
        p_machine_id: machineId,
        p_kind: kind,
        p_lease_seconds: 1800,
      });
      if (error) throw new Error(`Sticky Machine slot reserve failed: ${error.message}`);
      const row = Array.isArray(data) ? data[0] : data;
      return {
        reserved: Boolean(row && typeof row.slot_number === "number"),
        evictedPoolMachineId:
          row && typeof row.evicted_pool_machine_id === "string"
            ? row.evicted_pool_machine_id
            : null,
      };
    }
    const { data, error } = await admin.rpc("reserve_runner_machine_slot", {
      p_machine_id: machineId,
      p_kind: kind,
      p_lease_seconds: 1800,
    });
    if (error) throw new Error(`Machine slot reserve failed: ${error.message}`);
    return {
      reserved: typeof data === "number",
      evictedPoolMachineId: null,
    };
  });
}

async function releaseSlot(machineId: string, env: WakeEnvironment): Promise<void> {
  if (!slotEnforcementConfigured(env)) return;
  await withAdmin("system", "fly-machine-wake:release-slot", async (admin) => {
    const { error } = await admin.rpc("release_runner_machine_slot", {
      p_machine_id: machineId,
    });
    if (error) throw new Error(`Machine slot release failed: ${error.message}`);
  });
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

async function reconcileCapacity(
  target: FlyWakeTarget,
  rawDesired: number,
  env: WakeEnvironment,
  fetchImpl: typeof fetch,
): Promise<FlyMachineCapacityResult> {
  const config = flyApiConfig(env);
  if (!config) return { ok: false, target, reason: "not_configured" };

  const apps = targetApps(env);
  const app = apps[target];
  const desiredLimit = target === "pool" ? 10 : 1;
  const desired = Math.max(0, Math.min(desiredLimit, Math.floor(rawDesired)));
  try {
    const listResponse = await flyRequest(
      `${config.baseUrl}/apps/${encodeURIComponent(app)}/machines`,
      config.token,
      fetchImpl,
    );
    if (!listResponse.ok) return { ok: false, target, reason: "request_failed" };

    const machines = (await listResponse.json()) as FlyMachineSummary[];
    const activeMachines = machines.filter(
      (machine) => machine.state === "started" || machine.state === "starting",
    );
    if (activeMachines.length >= desired) {
      return {
        ok: true,
        target,
        app,
        desired,
        active: activeMachines.length,
        started: 0,
      };
    }

    const candidates = machines
      .filter((machine) => machine.state === "stopped" || machine.state === "suspended")
      .sort((left, right) => left.id.localeCompare(right.id));
    const needed = desired - activeMachines.length;
    if (candidates.length < needed) {
      return { ok: false, target, reason: "machine_not_found" };
    }

    let started = 0;
    let capacityBlocked = false;
    for (const candidate of candidates.slice(0, needed)) {
      const reservation = await reserveSlot(target, candidate.id, env);
      if (!reservation.reserved) {
        capacityBlocked = true;
        continue;
      }
      if (reservation.evictedPoolMachineId) {
        const stopResponse = await flyRequest(
          `${config.baseUrl}/apps/${encodeURIComponent(apps.pool)}/machines/${encodeURIComponent(reservation.evictedPoolMachineId)}/stop`,
          config.token,
          fetchImpl,
          { method: "POST", body: "{}" },
        );
        if (!stopResponse.ok && stopResponse.status !== 409) {
          await releaseSlot(candidate.id, env).catch(() => undefined);
          return { ok: false, target, reason: "request_failed" };
        }
      }
      const startResponse = await flyRequest(
        `${config.baseUrl}/apps/${encodeURIComponent(app)}/machines/${encodeURIComponent(candidate.id)}/start`,
        config.token,
        fetchImpl,
        { method: "POST", body: "{}" },
      );
      if (startResponse.ok || startResponse.status === 409) {
        started += 1;
        continue;
      }
      await releaseSlot(candidate.id, env).catch(() => undefined);
      return { ok: false, target, reason: "request_failed" };
    }
    if (started === 0 && capacityBlocked) {
      return { ok: false, target, reason: "capacity_full" };
    }
    return {
      ok: true,
      target,
      app,
      desired,
      active: activeMachines.length + started,
      started,
    };
  } catch {
    return { ok: false, target, reason: "request_failed" };
  }
}

export async function ensureFlyMachineCapacity(
  rawTarget: string,
  desired: number,
  options: {
    env?: WakeEnvironment;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<FlyMachineCapacityResult> {
  const target = normalizeTarget(rawTarget);
  if (!target) return { ok: false, target: rawTarget, reason: "unmanaged_target" };

  const existing = inFlightCapacity.get(target);
  if (existing) {
    await existing;
  }
  const operation = reconcileCapacity(
    target,
    desired,
    options.env ?? process.env,
    options.fetchImpl ?? fetch,
  ).finally(() => {
    if (inFlightCapacity.get(target) === operation) {
      inFlightCapacity.delete(target);
    }
  });
  inFlightCapacity.set(target, operation);
  return operation;
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
  const capacity = await ensureFlyMachineCapacity(target, 1, options);
  if (!capacity.ok) return capacity;
  return {
    ok: true,
    target,
    app: capacity.app,
    state: capacity.started > 0 ? "start_requested" : "already_running",
  };
}

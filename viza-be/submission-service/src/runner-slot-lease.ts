import { supabase } from "./supabase.js";

export type RunnerMachineKind = "pool" | "legacy" | "south_korea" | "indonesia";

export interface RunnerSlotRenewal {
  slotNumber: number;
  leaseUntil: Date;
}

interface SlotLeaseRpc {
  reserve: (
    machineId: string,
    kind: RunnerMachineKind,
    leaseSeconds: number,
  ) => Promise<number | null>;
  reserveSticky: (
    machineId: string,
    kind: Exclude<RunnerMachineKind, "pool">,
    leaseSeconds: number,
  ) => Promise<{ slotNumber: number; evictedPoolMachineId: string | null } | null>;
  renew: (
    machineId: string,
    kind: RunnerMachineKind,
    leaseSeconds: number,
  ) => Promise<RunnerSlotRenewal | null>;
  release: (machineId: string) => Promise<void>;
}

export interface RunnerSlotLeaseOptions {
  machineId: string;
  kind: RunnerMachineKind;
  leaseSeconds?: number;
  renewEveryMs?: number;
  rpc?: SlotLeaseRpc;
  onLeaseLost?: () => void;
  /** Called for every temporary renewal error with the consecutive count. */
  onRenewalFailure?: (error: unknown, consecutiveFailures: number) => void;
}

export interface RunnerSlotAcquireRetryOptions {
  signal?: AbortSignal;
  initialDelayMs?: number;
  maxDelayMs?: number;
  onError?: (error: unknown, attempt: number) => void;
}

export async function acquireRunnerSlotWithRetry(
  lease: Pick<RunnerSlotLease, "start">,
  options: RunnerSlotAcquireRetryOptions = {},
): Promise<boolean> {
  const initialDelayMs = Math.max(1, options.initialDelayMs ?? 2_000);
  const maxDelayMs = Math.max(initialDelayMs, options.maxDelayMs ?? 30_000);
  let attempt = 0;
  while (!options.signal?.aborted) {
    attempt += 1;
    try {
      return await lease.start();
    } catch (error) {
      options.onError?.(error, attempt);
    }
    const delayMs = Math.min(maxDelayMs, initialDelayMs * (2 ** Math.min(attempt - 1, 4)));
    await new Promise<void>((resolve) => {
      const signal = options.signal;
      const onAbort = () => {
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      }, delayMs);
      if (signal) {
        if (signal.aborted) {
          clearTimeout(timer);
          resolve();
        } else {
          signal.addEventListener("abort", onAbort, { once: true });
        }
      }
    });
  }
  return false;
}

async function reserveSlot(
  machineId: string,
  kind: RunnerMachineKind,
  leaseSeconds: number,
): Promise<number | null> {
  const { data, error } = await supabase.rpc("reserve_runner_machine_slot", {
    p_machine_id: machineId,
    p_kind: kind,
    p_lease_seconds: leaseSeconds,
  });
  if (error) throw new Error(`runner Machine slot reserve: ${error.message}`);
  if (data === null || data === undefined) return null;
  if (!Number.isInteger(data) || data < 0) {
    throw new Error("runner Machine slot reserve RPC returned an invalid slot number");
  }
  return data;
}

export function parseRunnerSlotRenewal(data: unknown): RunnerSlotRenewal | null {
  if (data === null || data === undefined) return null;
  const rows = Array.isArray(data) ? data : [data];
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(
      `runner Machine slot renew RPC returned ${rows.length} rows; expected at most one`,
    );
  }
  const row = rows[0];
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    throw new Error("runner Machine slot renew RPC returned a malformed row");
  }
  const record = row as Record<string, unknown>;
  if (!Number.isInteger(record.slot_number) || (record.slot_number as number) < 0) {
    throw new Error("runner Machine slot renew RPC returned an invalid slot number");
  }
  if (typeof record.lease_until !== "string") {
    throw new Error("runner Machine slot renew RPC returned an invalid lease timestamp");
  }
  const leaseUntilMs = Date.parse(record.lease_until);
  if (!Number.isFinite(leaseUntilMs)) {
    throw new Error("runner Machine slot renew RPC returned an invalid lease timestamp");
  }
  return {
    slotNumber: record.slot_number as number,
    leaseUntil: new Date(leaseUntilMs),
  };
}

async function renewSlot(
  machineId: string,
  kind: RunnerMachineKind,
  leaseSeconds: number,
): Promise<RunnerSlotRenewal | null> {
  const { data, error } = await supabase.rpc("renew_runner_machine_slot", {
    p_machine_id: machineId,
    p_kind: kind,
    p_lease_seconds: leaseSeconds,
  });
  if (error) throw new Error(`runner Machine slot renew: ${error.message}`);
  return parseRunnerSlotRenewal(data);
}

async function releaseSlot(machineId: string): Promise<void> {
  const { error } = await supabase.rpc("release_runner_machine_slot", {
    p_machine_id: machineId,
  });
  if (error) throw new Error(`runner Machine slot release: ${error.message}`);
}

async function reserveStickySlot(
  machineId: string,
  kind: Exclude<RunnerMachineKind, "pool">,
  leaseSeconds: number,
): Promise<{ slotNumber: number; evictedPoolMachineId: string | null } | null> {
  const { data, error } = await supabase.rpc("reserve_sticky_runner_machine_slot", {
    p_machine_id: machineId,
    p_kind: kind,
    p_lease_seconds: leaseSeconds,
  });
  if (error) throw new Error(`sticky runner Machine slot reserve: ${error.message}`);
  if (data === null || data === undefined) return null;
  const rows = Array.isArray(data) ? data : [data];
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(
      `sticky runner Machine slot reserve RPC returned ${rows.length} rows; expected at most one`,
    );
  }
  const row = rows[0];
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    throw new Error("sticky runner Machine slot reserve RPC returned a malformed row");
  }
  const record = row as Record<string, unknown>;
  if (!Number.isInteger(record.slot_number) || (record.slot_number as number) < 0) {
    throw new Error("sticky runner Machine slot reserve RPC returned an invalid slot number");
  }
  if (
    record.evicted_pool_machine_id !== null
    && record.evicted_pool_machine_id !== undefined
    && typeof record.evicted_pool_machine_id !== "string"
  ) {
    throw new Error("sticky runner Machine slot reserve RPC returned an invalid evicted machine id");
  }
  return {
    slotNumber: record.slot_number as number,
    evictedPoolMachineId:
      typeof record.evicted_pool_machine_id === "string"
        ? record.evicted_pool_machine_id
        : null,
  };
}

const defaultRpc: SlotLeaseRpc = {
  reserve: reserveSlot,
  reserveSticky: reserveStickySlot,
  renew: renewSlot,
  release: releaseSlot,
};

export class RunnerSlotLease {
  private readonly machineId: string;
  private readonly kind: RunnerMachineKind;
  private readonly leaseSeconds: number;
  private readonly renewEveryMs: number;
  private readonly rpc: SlotLeaseRpc;
  private readonly onLeaseLost: (() => void) | undefined;
  private readonly onRenewalFailure:
    | ((error: unknown, consecutiveFailures: number) => void)
    | undefined;
  private timer: NodeJS.Timeout | null = null;
  private slotNumber: number | null = null;
  private healthy = true;
  private renewing = false;
  private consecutiveRenewalFailures = 0;
  private stopping = false;

  constructor(options: RunnerSlotLeaseOptions) {
    this.machineId = options.machineId;
    this.kind = options.kind;
    this.leaseSeconds = options.leaseSeconds ?? 1800;
    this.renewEveryMs = options.renewEveryMs ?? 60_000;
    this.rpc = options.rpc ?? defaultRpc;
    this.onLeaseLost = options.onLeaseLost;
    this.onRenewalFailure = options.onRenewalFailure;
  }

  async start(): Promise<boolean> {
    this.stopping = false;
    let slot: number | null;
    try {
      slot =
        this.kind === "pool"
          ? await this.rpc.reserve(this.machineId, this.kind, this.leaseSeconds)
          : (
              await this.rpc.reserveSticky(
                this.machineId,
                this.kind,
                this.leaseSeconds,
              )
            )?.slotNumber ?? null;
    } catch (error) {
      console.error(JSON.stringify({
        metric: "runner_slot_event",
        event: "error",
        phase: "acquire",
        kind: this.kind,
        error: error instanceof Error ? error.message : String(error),
        at: new Date().toISOString(),
      }));
      throw error;
    }
    if (slot == null) {
      this.healthy = true;
      console.log(JSON.stringify({
        metric: "runner_slot_event",
        event: "acquire",
        outcome: "unavailable",
        kind: this.kind,
        at: new Date().toISOString(),
      }));
      return false;
    }
    this.slotNumber = slot;
    this.healthy = true;
    this.consecutiveRenewalFailures = 0;
    this.timer = setInterval(() => {
      void this.renew();
    }, this.renewEveryMs);
    this.timer.unref?.();
    console.log(JSON.stringify({
      metric: "runner_slot_event",
      event: "acquire",
      outcome: "acquired",
      kind: this.kind,
      slotNumber: slot,
      at: new Date().toISOString(),
    }));
    return true;
  }

  isHealthy(): boolean {
    return this.healthy;
  }

  slot(): number | null {
    return this.slotNumber;
  }

  renewalFailures(): number {
    return this.consecutiveRenewalFailures;
  }

  async stop(): Promise<void> {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.slotNumber == null) return;
    this.slotNumber = null;
    try {
      await this.rpc.release(this.machineId);
    } catch (error) {
      console.error("[capacity] Machine slot release failed", error);
    }
  }

  private async renew(): Promise<void> {
    if (this.stopping || this.renewing || this.slotNumber == null) return;
    this.renewing = true;
    const startedAt = Date.now();
    try {
      const renewal = await this.rpc.renew(
        this.machineId,
        this.kind,
        this.leaseSeconds,
      );
      if (this.stopping) return;
      if (renewal == null) {
        const lostSlotNumber = this.slotNumber;
        this.healthy = false;
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
        this.slotNumber = null;
        console.error(JSON.stringify({
          metric: "runner_slot_event",
          event: "lost",
          outcome: "zero_rows",
          kind: this.kind,
          slotNumber: lostSlotNumber,
          at: new Date().toISOString(),
        }));
        try {
          this.onLeaseLost?.();
        } catch (error) {
          console.error("[capacity] lease-lost shutdown callback failed", error);
        }
        return;
      }
      this.slotNumber = renewal.slotNumber;
      this.healthy = true;
      this.consecutiveRenewalFailures = 0;
      console.log(JSON.stringify({
        metric: "runner_slot_event",
        event: "renew",
        outcome: "renewed",
        kind: this.kind,
        slotNumber: renewal.slotNumber,
        durationMs: Math.max(0, Date.now() - startedAt),
        leaseUntil: renewal.leaseUntil.toISOString(),
        at: new Date().toISOString(),
      }));
    } catch (error) {
      this.healthy = false;
      this.consecutiveRenewalFailures += 1;
      console.error(JSON.stringify({
        metric: "runner_slot_event",
        event: "error",
        phase: "renew",
        kind: this.kind,
        durationMs: Math.max(0, Date.now() - startedAt),
        consecutiveFailures: this.consecutiveRenewalFailures,
        error: error instanceof Error ? error.message : String(error),
        at: new Date().toISOString(),
      }));
      try {
        this.onRenewalFailure?.(error, this.consecutiveRenewalFailures);
      } catch (callbackError) {
        console.error("[capacity] renewal failure callback failed", callbackError);
      }
      // Keep the exact DB-owned slot and do not re-reserve a different one
      // after a transport/schema error. The existing job lease fence remains
      // authoritative until a subsequent renew succeeds or returns zero rows.
    } finally {
      this.renewing = false;
    }
  }
}

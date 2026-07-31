import { supabase } from "./supabase.js";

export type RunnerMachineKind = "pool" | "legacy" | "south_korea" | "indonesia";

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
  release: (machineId: string) => Promise<void>;
}

export interface RunnerSlotLeaseOptions {
  machineId: string;
  kind: RunnerMachineKind;
  leaseSeconds?: number;
  renewEveryMs?: number;
  rpc?: SlotLeaseRpc;
  onLeaseLost?: () => void;
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
  return typeof data === "number" ? data : null;
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
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row.slot_number !== "number") return null;
  return {
    slotNumber: row.slot_number,
    evictedPoolMachineId:
      typeof row.evicted_pool_machine_id === "string"
        ? row.evicted_pool_machine_id
        : null,
  };
}

const defaultRpc: SlotLeaseRpc = {
  reserve: reserveSlot,
  reserveSticky: reserveStickySlot,
  release: releaseSlot,
};

export class RunnerSlotLease {
  private readonly machineId: string;
  private readonly kind: RunnerMachineKind;
  private readonly leaseSeconds: number;
  private readonly renewEveryMs: number;
  private readonly rpc: SlotLeaseRpc;
  private readonly onLeaseLost: (() => void) | undefined;
  private timer: NodeJS.Timeout | null = null;
  private slotNumber: number | null = null;
  private healthy = true;
  private renewing = false;

  constructor(options: RunnerSlotLeaseOptions) {
    this.machineId = options.machineId;
    this.kind = options.kind;
    this.leaseSeconds = options.leaseSeconds ?? 1800;
    this.renewEveryMs = options.renewEveryMs ?? 60_000;
    this.rpc = options.rpc ?? defaultRpc;
    this.onLeaseLost = options.onLeaseLost;
  }

  async start(): Promise<boolean> {
    const slot =
      this.kind === "pool"
        ? await this.rpc.reserve(this.machineId, this.kind, this.leaseSeconds)
        : (
            await this.rpc.reserveSticky(
              this.machineId,
              this.kind,
              this.leaseSeconds,
            )
          )?.slotNumber ?? null;
    if (slot == null) {
      this.healthy = true;
      return false;
    }
    this.slotNumber = slot;
    this.healthy = true;
    this.timer = setInterval(() => {
      void this.renew();
    }, this.renewEveryMs);
    this.timer.unref?.();
    console.log(`[capacity] Machine slot ${slot} acquired kind=${this.kind}`);
    return true;
  }

  isHealthy(): boolean {
    return this.healthy;
  }

  slot(): number | null {
    return this.slotNumber;
  }

  async stop(): Promise<void> {
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
    if (this.renewing || this.slotNumber == null) return;
    this.renewing = true;
    try {
      const slot =
        this.kind === "pool"
          ? await this.rpc.reserve(this.machineId, this.kind, this.leaseSeconds)
          : (
              await this.rpc.reserveSticky(
                this.machineId,
                this.kind,
                this.leaseSeconds,
              )
            )?.slotNumber ?? null;
      if (slot == null) {
        this.healthy = true;
        this.slotNumber = null;
        console.error("[capacity] Machine slot was reassigned; stopping this idle worker.");
        this.onLeaseLost?.();
        return;
      }
      this.slotNumber = slot;
      this.healthy = true;
    } catch (error) {
      this.healthy = false;
      console.error("[capacity] Machine slot renewal failed; retaining worker until DB recovers.", error);
    } finally {
      this.renewing = false;
    }
  }
}

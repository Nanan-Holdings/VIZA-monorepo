export type IdleLifecycleState =
  | "booting"
  | "ready"
  | "busy"
  | "idle_grace"
  | "draining";

export interface IdleExitControllerOptions {
  enabled: boolean;
  idleMs: number;
  recheckMs?: number;
  checkIntervalMs?: number;
  isSafeToExit: () => Promise<boolean>;
  onExit: () => void;
  now?: () => number;
}

export interface IdleLifecycleSnapshot {
  state: IdleLifecycleState;
  activeWork: number;
  idleSince: string | null;
}

export class IdleExitController {
  private readonly enabled: boolean;
  private readonly idleMs: number;
  private readonly recheckMs: number;
  private readonly checkIntervalMs: number;
  private readonly isSafeToExit: () => Promise<boolean>;
  private readonly onExit: () => void;
  private readonly now: () => number;
  private activeWork = 0;
  private ready = false;
  private lastActivityAt: number;
  private checking = false;
  private drainingGeneration = 0;
  private interval: NodeJS.Timeout | null = null;
  private recheckTimer: NodeJS.Timeout | null = null;

  constructor(options: IdleExitControllerOptions) {
    this.enabled = options.enabled;
    this.idleMs = Math.max(1_000, options.idleMs);
    this.recheckMs = Math.max(1_000, options.recheckMs ?? 5_000);
    this.checkIntervalMs = Math.max(500, options.checkIntervalMs ?? 5_000);
    this.isSafeToExit = options.isSafeToExit;
    this.onExit = options.onExit;
    this.now = options.now ?? Date.now;
    this.lastActivityAt = this.now();
  }

  start(): void {
    if (!this.enabled || this.interval) return;
    this.interval = setInterval(() => {
      void this.evaluate();
    }, this.checkIntervalMs);
    this.interval.unref?.();
  }

  markReady(): void {
    this.ready = true;
    this.noteActivity();
  }

  noteActivity(): void {
    this.lastActivityAt = this.now();
    this.cancelDraining();
  }

  workStarted(): void {
    this.activeWork += 1;
    this.noteActivity();
  }

  workFinished(): void {
    this.activeWork = Math.max(0, this.activeWork - 1);
    this.lastActivityAt = this.now();
  }

  stop(): void {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    this.cancelDraining();
  }

  snapshot(): IdleLifecycleSnapshot {
    let state: IdleLifecycleState = "booting";
    if (this.ready) {
      if (this.drainingGeneration > 0) state = "draining";
      else if (this.activeWork > 0) state = "busy";
      else if (this.now() - this.lastActivityAt >= this.idleMs) state = "idle_grace";
      else state = "ready";
    }
    return {
      state,
      activeWork: this.activeWork,
      idleSince:
        this.ready && this.activeWork === 0
          ? new Date(this.lastActivityAt).toISOString()
          : null,
    };
  }

  async evaluate(): Promise<void> {
    if (
      !this.enabled ||
      !this.ready ||
      this.activeWork > 0 ||
      this.checking ||
      this.drainingGeneration > 0 ||
      this.now() - this.lastActivityAt < this.idleMs
    ) {
      return;
    }

    this.checking = true;
    try {
      if (!(await this.isSafeToExit())) return;
      const generation = Date.now();
      this.drainingGeneration = generation;
      this.recheckTimer = setTimeout(() => {
        void this.confirmExit(generation);
      }, this.recheckMs);
      this.recheckTimer.unref?.();
    } finally {
      this.checking = false;
    }
  }

  private async confirmExit(generation: number): Promise<void> {
    this.recheckTimer = null;
    if (
      this.drainingGeneration !== generation ||
      this.activeWork > 0 ||
      this.now() - this.lastActivityAt < this.idleMs
    ) {
      return;
    }

    this.checking = true;
    try {
      if (!(await this.isSafeToExit())) {
        this.cancelDraining();
        return;
      }
      this.stop();
      this.onExit();
    } finally {
      this.checking = false;
    }
  }

  private cancelDraining(): void {
    this.drainingGeneration = 0;
    if (this.recheckTimer) clearTimeout(this.recheckTimer);
    this.recheckTimer = null;
  }
}


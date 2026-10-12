import { isEligibleUSAppointmentJob, type USAppointmentJobRow, type USAppointmentRunnerConfig } from "./runner";

export type USAppointmentWakeResult =
  | { outcome: "accepted"; duplicate: boolean }
  | { outcome: "not_found" | "disabled" | "ineligible" | "busy" | "unavailable" };

export interface USAppointmentDispatchOptions {
  getJob(jobId: string): Promise<USAppointmentJobRow | null>;
  claims: {
    claim(jobId: string, workerId: string): Promise<{ claimId: string } | null>;
    finish(claimId: string, workerId: string, outcome: "completed" | "failed" | "skipped"): Promise<void>;
  };
  workerId: string;
  config: USAppointmentRunnerConfig;
  runJob(job: USAppointmentJobRow, signal: AbortSignal): Promise<"processed" | "skipped">;
  onWorkStart?(): void;
  onWorkFinish?(): void;
  onFailure?(code: string): void;
  /** Must terminate the worker: a timed-out operation has not stopped safely. */
  onFatal?(code: string): void;
  timeoutMs?: number;
  cleanupTimeoutMs?: number;
}

interface DispatchWork {
  jobId: string;
  controller: AbortController;
  admission: Promise<USAppointmentWakeResult>;
  acknowledge(result: USAppointmentWakeResult): void;
  done: Promise<void>;
}

interface ExecutionWaiter {
  signal: AbortSignal;
  resolve(release: () => void): void;
  reject(error: Error): void;
  abort(): void;
}

/** Exact-job wake: the durable claim remains held if execution is ambiguous. */
export class USAppointmentDispatcher {
  private readonly inFlight = new Map<string, DispatchWork>();
  private readonly executionWaiters: ExecutionWaiter[] = [];
  private executionHeld = false;
  private stopping = false;
  private healthyState = true;
  constructor(private readonly options: USAppointmentDispatchOptions) {}

  get activeCount(): number { return this.inFlight.size; }
  get healthy(): boolean { return this.healthyState; }

  async drain(): Promise<void> { await Promise.all([...this.inFlight.values()].map((work) => work.done)); }

  /** Reject new admissions, cancel queued claims, and abort the active browser. */
  async shutdown(): Promise<void> {
    this.stopping = true;
    for (const work of this.inFlight.values()) work.controller.abort();
    await this.drain();
  }

  private eligible(job: USAppointmentJobRow): boolean {
    return isEligibleUSAppointmentJob(job, this.options.config)
      && job.applying_country_code?.trim().toUpperCase() === "CN"
      && job.scheduling_provider?.trim().toLowerCase() === "usvisascheduling"
      && !Object.prototype.hasOwnProperty.call(job.user_preferences_json ?? {}, "portalFixture");
  }

  private executionRelease(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.executionHeld = false;
      const waiter = this.executionWaiters.shift();
      if (!waiter) return;
      waiter.signal.removeEventListener("abort", waiter.abort);
      this.executionHeld = true;
      waiter.resolve(this.executionRelease());
    };
  }

  private async acquireExecution(signal: AbortSignal): Promise<() => void> {
    if (signal.aborted) throw new Error("us_appointment_dispatch_cancelled");
    if (!this.executionHeld) {
      this.executionHeld = true;
      return this.executionRelease();
    }
    return new Promise<() => void>((resolve, reject) => {
      const waiter: ExecutionWaiter = { signal, resolve, reject, abort: () => {
        const index = this.executionWaiters.indexOf(waiter);
        if (index !== -1) this.executionWaiters.splice(index, 1);
        reject(new Error("us_appointment_dispatch_cancelled"));
      } };
      this.executionWaiters.push(waiter);
      signal.addEventListener("abort", waiter.abort, { once: true });
    });
  }

  async wake(jobId: string): Promise<USAppointmentWakeResult> {
    if (this.stopping || !this.healthyState) return { outcome: "unavailable" };
    const existing = this.inFlight.get(jobId);
    if (existing) {
      const result = await existing.admission;
      return result.outcome === "accepted" ? { ...result, duplicate: true } : result;
    }
    let acknowledge!: (result: USAppointmentWakeResult) => void;
    const admission = new Promise<USAppointmentWakeResult>((resolve) => { acknowledge = resolve; });
    const work: DispatchWork = {
      jobId, controller: new AbortController(), admission, acknowledge, done: Promise.resolve(),
    };
    // Track before any database await; readiness/idle checks include claim setup.
    this.inFlight.set(jobId, work);
    work.done = Promise.resolve().then(() => this.runBounded(work));
    this.options.onWorkStart?.();
    return admission;
  }

  private async runBounded(work: DispatchWork): Promise<void> {
    const timeout = Math.min(Math.max(this.options.timeoutMs ?? 900_000, 1), 1_800_000);
    const cleanupTimeout = Math.min(Math.max(this.options.cleanupTimeoutMs ?? 10_000, 1), 30_000);
    let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
    let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
    let abort!: () => void;
    const cleanupExpired = new Promise<void>((resolve) => {
      abort = () => {
        work.acknowledge({ outcome: "unavailable" });
        cleanupTimer = setTimeout(() => {
          // Keep this work tracked and its execution gate held until the actual
          // operation stops. Never free another browser behind an orphaned run.
          if (this.healthyState) {
            this.healthyState = false;
            this.stopping = true;
            for (const pending of this.inFlight.values()) pending.controller.abort();
            this.options.onFatal?.("us_appointment_cleanup_timeout_reconciliation_required");
          }
          resolve();
        }, cleanupTimeout);
      };
      work.controller.signal.addEventListener("abort", abort, { once: true });
      if (work.controller.signal.aborted) abort();
    });
    const execution = this.execute(work).finally(() => {
      this.inFlight.delete(work.jobId);
      this.options.onWorkFinish?.();
    });
    deadlineTimer = setTimeout(() => {
      this.options.onFailure?.("us_appointment_execution_timeout_reconciliation_required");
      work.controller.abort();
    }, timeout);
    try {
      await Promise.race([execution, cleanupExpired]);
    } finally {
      clearTimeout(deadlineTimer);
      if (cleanupTimer) clearTimeout(cleanupTimer);
      work.controller.signal.removeEventListener("abort", abort);
    }
  }

  private async execute(work: DispatchWork): Promise<void> {
    const { jobId, acknowledge, controller } = work;
    const { getJob, config, claims, workerId, runJob } = this.options;
    let started = false;
    let claimId: string | null = null;
    let releaseExecution: (() => void) | undefined;
    const requireActive = () => {
      if (controller.signal.aborted || this.stopping || !this.healthyState) {
        throw new Error("us_appointment_dispatch_cancelled");
      }
    };
    try {
      requireActive();
      if (!config.enabled || !config.playwrightEnabled) { acknowledge({ outcome: "disabled" }); return; }
      const job = await getJob(jobId);
      requireActive();
      if (!job) { acknowledge({ outcome: "not_found" }); return; }
      if (!this.eligible(job)) { acknowledge({ outcome: "ineligible" }); return; }
      const claim = await claims.claim(jobId, workerId);
      if (!claim) { acknowledge({ outcome: "busy" }); return; }
      claimId = claim.claimId;
      requireActive();
      const latest = await getJob(jobId);
      requireActive();
      if (!latest || !this.eligible(latest)
        || latest.application_id !== job.application_id || latest.user_id !== job.user_id
        || latest.appointment_account_id !== job.appointment_account_id) {
        await claims.finish(claimId, workerId, "skipped");
        acknowledge({ outcome: "ineligible" });
        return;
      }
      acknowledge({ outcome: "accepted", duplicate: false });
      // One browser at a time per worker; accepted requests remain tracked
      // while waiting, so an idle machine cannot exit with queued work.
      releaseExecution = await this.acquireExecution(controller.signal);
      requireActive();
      const fresh = await getJob(jobId);
      requireActive();
      if (!fresh || !this.eligible(fresh) || fresh.application_id !== latest.application_id
        || fresh.user_id !== latest.user_id || fresh.appointment_account_id !== latest.appointment_account_id) {
        await claims.finish(claimId, workerId, "skipped");
        return;
      }
      started = true;
      const outcome = await runJob(fresh, controller.signal);
      if (controller.signal.aborted) return;
      await claims.finish(claimId, workerId, outcome === "processed" ? "completed" : "skipped");
    } catch {
      // Never include Playwright/SQL exceptions in an HTTP or audit payload.
      acknowledge({ outcome: "unavailable" });
      if (!controller.signal.aborted) this.options.onFailure?.("us_appointment_dispatch_failed");
      // Once portal work started, a crash/uncertain settlement must not permit
      // another worker to replay the same official submission automatically.
      if (claimId && !started) {
        await claims.finish(claimId, workerId, controller.signal.aborted ? "skipped" : "failed").catch(() => undefined);
      }
    } finally {
      releaseExecution?.();
    }
  }
}

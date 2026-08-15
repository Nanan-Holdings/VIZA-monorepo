/**
 * Ownership context passed through every runner_job handler invocation.
 *
 * A handler must call assertOwned/checkpoint immediately before any
 * irreversible portal action. The queue worker aborts this signal as soon as
 * its database lease is rejected or expires.
 */
export class RunnerJobOwnershipLostError extends Error {
  readonly code = "runner_job_ownership_lost" as const;

  constructor(message = "runner job lease ownership was lost") {
    super(message);
    this.name = "RunnerJobOwnershipLostError";
  }
}

export interface RunnerExecutionContext {
  /** Stable queue identity used to fence every pool-owned result write. */
  readonly jobId: string;
  readonly workerId: string;
  readonly signal: AbortSignal;
  /** Throw when the worker no longer owns the live database lease. */
  assertOwned(): void;
  /** Named checkpoint alias for readability at irreversible boundaries. */
  checkpoint(name?: string): void;
}

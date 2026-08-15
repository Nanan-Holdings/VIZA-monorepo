import "server-only";

type RunnerCutoverEnvironment = Readonly<Record<string, string | undefined>>;

export const RUNNER_CUTOVER_PAUSED_CODE = "runner_cutover_paused" as const;

/**
 * Typed hard stop used at durable enqueue boundaries. Keeping this distinct
 * from provider/network failures lets callers return a retryable maintenance
 * response without accidentally falling through to another transport.
 */
export class RunnerCutoverPausedError extends Error {
  readonly code = RUNNER_CUTOVER_PAUSED_CODE;

  constructor() {
    super("Runner enqueue and wake operations are paused for a controlled cutover.");
    this.name = "RunnerCutoverPausedError";
  }
}

/**
 * The cutover switch is server-only and deliberately accepts exactly `true`.
 * This prevents a loose truthy parser or a public build-time flag from
 * changing queue availability.
 */
export function isRunnerCutoverPaused(
  env: RunnerCutoverEnvironment = process.env,
): boolean {
  return env.RUNNER_CUTOVER_PAUSED === "true";
}

export function assertRunnerCutoverActive(
  env: RunnerCutoverEnvironment = process.env,
): void {
  if (isRunnerCutoverPaused(env)) {
    throw new RunnerCutoverPausedError();
  }
}

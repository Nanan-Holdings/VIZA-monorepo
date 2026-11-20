/**
 * UK dispatch entrypoint (RUN-UK-001).
 *
 * Exposes the application-scoped UK Standard Visitor flow as a runner_job
 * `runOne(applicationId)`. The implementation resolves an exact UK account,
 * registers only behind the explicit gate, resumes the bound application, and
 * maps verified declaration/payment boundaries separately from incomplete or
 * registration checkpoints. It lives in src/queue/halt-runners.ts (QUE-005).
 * Re-exported here so the binding lives under src/uk.
 */
export { runUkHalt as runOne } from "../queue/halt-runners.js";

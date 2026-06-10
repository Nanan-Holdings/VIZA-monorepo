/**
 * UK dispatch entrypoint (RUN-UK-001).
 *
 * Exposes the existing UK Standard Visitor resume/prefill flow as a
 * runner_job `runOne(applicationId)`. The implementation (loadUkAccount +
 * resumeUkApplication, mapping `stopped_at_pay`/`halted_before_pay` →
 * halted_before_pay) lives in src/queue/halt-runners.ts (QUE-005). The
 * legacy submission_queue UK status transitions in index.ts are unchanged.
 * Re-exported here so the binding lives under src/uk.
 */
export { runUkHalt as runOne } from "../queue/halt-runners.js";

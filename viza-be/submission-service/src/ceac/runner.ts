/**
 * US (CEAC / DS-160) dispatch entrypoint (RUN-US-001).
 *
 * Exposes the existing CEAC/DS-160 prefill flow as a runner_job
 * `runOne(applicationId)`. The implementation (startCeacSession →
 * handleConfirmApplicationPage → orchestrateFill, mapping
 * `result.status:"handoff_ready"` → halted_before_pay) lives in
 * src/queue/halt-runners.ts (QUE-005); orchestrateFill returns the
 * DS-160 sectionCoverage so completeness is observable before the halt.
 * Re-exported here so the binding lives under src/ceac.
 *
 * Halt-before-government-payment: CEAC stops at the sign/submit wall; the
 * worker marks the job `succeeded` on the halted_before_pay outcome.
 */
export { runUsHalt as runOne } from "../queue/halt-runners.js";

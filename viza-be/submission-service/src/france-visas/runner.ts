/**
 * France-Visas dispatch entrypoint (RUN-FR-001).
 *
 * Exposes the existing France-Visas halt flow as a runner_job
 * `runOne(applicationId)`. The implementation (answer assembly via
 * normalizeFvAnswers + fv_accounts credentials + fillFranceVisasApplication,
 * mapping `status:"prefilled"` → halted_before_pay) lives in
 * src/queue/halt-runners.ts (QUE-005). Re-exported here so the binding lives
 * under src/france-visas as the AC requires.
 *
 * Halt-before-government-pay: France-Visas saves the draft + finalizes the
 * CERFA but stops before the consulate/VAC fee; the worker marks the job
 * `succeeded` on the halted_before_pay outcome.
 */
export { runFranceHalt as runOne } from "../queue/halt-runners.js";

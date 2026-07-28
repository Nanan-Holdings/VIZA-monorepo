/**
 * Taiwan dispatch entrypoint (mirrors src/uk/runner.ts).
 *
 * Exposes the Taiwan Online Entry Permit fill flow as a runner_job
 * `runOne(applicationId)`. The implementation (load profile/app, load +
 * normalize answers, call fillTwEntryPermitApplication, map
 * `stopped_at_captcha` → `halted_before_pay`) lives in
 * src/queue/halt-runners.ts (`runTwHalt`) alongside the other halt-before-
 * government-payment countries (UK/France/Australia). Re-exported here so
 * the binding lives under src/tw.
 */
export { runTwHalt as runOne } from "../queue/halt-runners.js";

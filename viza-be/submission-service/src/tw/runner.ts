/**
 * Taiwan dispatch entrypoint (mirrors src/uk/runner.ts).
 *
 * Exposes the Taiwan Online Entry Permit fill flow as a runner_job
 * `runOne(applicationId)`. The implementation loads profile/app data,
 * normalizes answers, resolves required files, calls fillTwEntryPermitApplication,
 * and persists either fail-closed official receipt evidence (`submitted`) or a
 * recoverable failure. Post-approval payment remains outside this session.
 * Re-exported here so the binding lives under src/tw.
 */
export { runTwHalt as runOne } from "../queue/halt-runners.js";

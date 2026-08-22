/**
 * Taiwan dispatch entrypoint (mirrors src/uk/runner.ts).
 *
 * Exposes the Taiwan Online Entry Permit fill flow as a runner_job
 * `runOne(applicationId, jobId, executionContext)`. The implementation requires
 * an exact live pool lease, loads profile/app data,
 * normalizes answers, resolves required files, calls fillTwEntryPermitApplication,
 * and persists official receipt evidence (`submitted`) through the fenced pool
 * result RPC. Ownership loss aborts the browser and final official click.
 * Re-exported here so the binding lives under src/tw.
 */
export { runTwHalt as runOne } from "../queue/halt-runners.js";

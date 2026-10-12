#!/usr/bin/env npx tsx

import "dotenv/config";
import {
  CAPTURED_RESUME_PENDING_STATUS,
  evaluateCapturedResumeRecovery,
  loadCapturedResumeRecoverySnapshot,
  parseCapturedResumeRecoveryArgs,
  transitionCapturedResumeQueue,
  type CapturedResumeRecoveryArgs,
  type CapturedResumeRecoveryReport,
  type RecoveryMutationClient,
} from "../../src/queue/captured-resume-recovery";

function printReport(
  args: CapturedResumeRecoveryArgs,
  report: CapturedResumeRecoveryReport,
): void {
  console.log(JSON.stringify({
    applicationId: args.applicationId,
    jobId: args.jobId,
    mode: args.execute ? "execute" : "dry_run",
    ...report,
  }, null, 2));
}

async function main(): Promise<void> {
  const args = parseCapturedResumeRecoveryArgs(process.argv.slice(2));
  const { supabase } = await import("../../src/supabase");
  const snapshot = await loadCapturedResumeRecoverySnapshot(supabase, args.applicationId);
  const report = evaluateCapturedResumeRecovery(snapshot, args.applicationId, args.jobId);
  printReport(args, report);
  if (!report.ok) {
    process.exitCode = 2;
    return;
  }
  if (!args.execute) {
    console.log("Dry-run only. Re-run with --execute to perform the conditional transition.");
    return;
  }

  const queue = snapshot.queueRows.find((row) => row.id === args.jobId);
  if (!queue) throw new Error("Queue job disappeared after preflight; no transition was attempted.");
  await transitionCapturedResumeQueue(
    supabase as unknown as RecoveryMutationClient,
    queue,
    args.applicationId,
    args.jobId,
  );
  console.log(JSON.stringify({ status: "requeued", queueStatus: CAPTURED_RESUME_PENDING_STATUS }));
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "DS-160 recovery failed; no transition was confirmed.");
    process.exitCode = 1;
  });
}


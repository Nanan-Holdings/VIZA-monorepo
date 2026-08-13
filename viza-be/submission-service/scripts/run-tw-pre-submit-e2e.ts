import * as dotenv from "dotenv";
import * as path from "node:path";

dotenv.config();
dotenv.config({ path: ".env.local", override: false });

function argValue(name: string): string | undefined {
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const applicationId = argValue("--application-id") ?? process.env.TW_PRE_SUBMIT_APPLICATION_ID;
  if (!applicationId) {
    throw new Error("usage: tsx scripts/run-tw-pre-submit-e2e.ts --application-id <uuid>");
  }

  const runId = argValue("--run-id") ?? `tw-pre-submit-${Date.now()}`;
  const diagnosticsDir = argValue("--diagnostics-dir") ?? path.join(process.cwd(), "artifacts", "tw-pre-submit", runId);
  const [{ prepareTwEntryPermitApplication }, tw] = await Promise.all([
    import("../src/queue/halt-runners.js"),
    import("../src/tw/index.js"),
  ]);
  const prepared = await prepareTwEntryPermitApplication(applicationId);
  const result = await tw.fillTwEntryPermitApplication(prepared.input, {
    ...prepared.applyOptions,
    headless: !process.argv.includes("--headed"),
    runId,
    diagnosticsOutputDir: diagnosticsDir,
    contractFixtureOutputDir: diagnosticsDir,
    stopBeforeFinalSubmit: true,
    officialLoginProvider: tw.createTwOfficialLoginProviderFromEnvironment(),
    officialLoginOtpProvider: tw.createTwOfficialLoginOtpProviderFromEnvironment(),
    emailOtpProvider: new tw.TwInboxEmailOtpProvider({ markProcessed: false }),
  });

  const base = {
    application: "[redacted]",
    runId,
    requiredDocumentCount: prepared.requiredDocumentCount,
    diagnosticsDir,
  };

  if (result.status === "ready_to_submit") {
    console.log(JSON.stringify({
      ...base,
      status: result.status,
      checkpoint: result.checkpoint,
      pagesFilled: result.pagesFilled,
      repairRounds: result.repairRounds,
      fieldAuditTotal: result.fieldAudit.total,
      controlCount: result.fieldAudit.controls.length,
      captchaAttempts: result.captchaSolve.telemetry.length,
      portalPath: safePath(result.portalUrl),
    }, null, 2));
    return;
  }

  if (result.status === "failed") {
    console.error(JSON.stringify({
      ...base,
      status: result.status,
      checkpoint: result.checkpoint,
      error: result.error,
      portalPath: result.url ? safePath(result.url) : null,
      contractFixturePath: result.contractFixturePath,
    }, null, 2));
    process.exitCode = 1;
    return;
  }

  console.error(JSON.stringify({
    ...base,
    status: "failed",
    error: `unexpected pre-submit result status ${result.status}`,
  }, null, 2));
  process.exitCode = 1;
}

function safePath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
}

main().catch((err) => {
  console.error(JSON.stringify({
    status: "failed",
    error: err instanceof Error ? err.message : String(err),
  }, null, 2));
  process.exitCode = 1;
});

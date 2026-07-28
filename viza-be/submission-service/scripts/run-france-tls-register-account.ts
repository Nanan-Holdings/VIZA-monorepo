#!/usr/bin/env npx tsx
import "dotenv/config";
import { registerAndPrepareFranceTlsAccount } from "../src/france-tls/account-registration";

function readArg(name: string): string | null {
  const marker = `--${name}=`;
  return process.argv.find((item) => item.startsWith(marker))?.slice(marker.length).trim() ?? null;
}

async function main(): Promise<void> {
  const applicationId = readArg("application-id");
  if (!applicationId) throw new Error("--application-id is required");
  const submitRegistration = process.argv.includes("--submit-registration");
  if (submitRegistration && process.env.FRANCE_TLS_ACCOUNT_REGISTRATION_ENABLED !== "true") {
    throw new Error("FRANCE_TLS_ACCOUNT_REGISTRATION_ENABLED=true is required for real account registration");
  }
  const result = await registerAndPrepareFranceTlsAccount({
    applicationId,
    centerCode: readArg("center") ?? "shanghai",
    submitRegistration,
    fillOfficialReference: !process.argv.includes("--registration-only"),
    emailTimeoutMs: Number.parseInt(process.env.FRANCE_TLS_EMAIL_TIMEOUT_MS ?? "600000", 10),
    refreshRetries: 2,
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({
    status: "france_tls_account_registration_failed",
    message: error instanceof Error ? error.message.split("\n")[0] : String(error),
  }, null, 2));
  process.exit(1);
});

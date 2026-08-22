#!/usr/bin/env npx tsx
import "dotenv/config";
import {
  abandonAndRegisterFranceTlsAccount,
  recoverAndPrepareFranceTlsAccount,
  registerAndPrepareFranceTlsAccount,
} from "../src/france-tls/account-registration";

function readArg(name: string): string | null {
  const marker = `--${name}=`;
  return process.argv.find((item) => item.startsWith(marker))?.slice(marker.length).trim() ?? null;
}

async function main(): Promise<void> {
  const applicationId = readArg("application-id");
  if (!applicationId) throw new Error("--application-id is required");
  const submitRegistration = process.argv.includes("--submit-registration");
  const resetPassword = process.argv.includes("--reset-password");
  const abandonExistingAccount = process.argv.includes("--abandon-existing-account");
  if (submitRegistration && process.env.FRANCE_TLS_ACCOUNT_REGISTRATION_ENABLED !== "true") {
    throw new Error("FRANCE_TLS_ACCOUNT_REGISTRATION_ENABLED=true is required for real account registration");
  }
  if (resetPassword && process.env.FRANCE_TLS_ACCOUNT_PASSWORD_RESET_ENABLED !== "true") {
    throw new Error("FRANCE_TLS_ACCOUNT_PASSWORD_RESET_ENABLED=true is required for official password recovery");
  }
  if (abandonExistingAccount && process.env.FRANCE_TLS_ACCOUNT_ABANDONMENT_ENABLED !== "true") {
    throw new Error("FRANCE_TLS_ACCOUNT_ABANDONMENT_ENABLED=true is required to abandon a stored TLS account");
  }
  if (submitRegistration && resetPassword) {
    throw new Error("--submit-registration and --reset-password cannot be combined");
  }
  if (abandonExistingAccount && !submitRegistration) {
    throw new Error("--abandon-existing-account requires --submit-registration");
  }
  if (abandonExistingAccount && resetPassword) {
    throw new Error("--abandon-existing-account and --reset-password cannot be combined");
  }
  const common = {
    applicationId,
    centerCode: readArg("center") ?? "shanghai",
    fillOfficialReference: !process.argv.includes("--registration-only"),
    emailTimeoutMs: Number.parseInt(process.env.FRANCE_TLS_EMAIL_TIMEOUT_MS ?? "600000", 10),
  };
  const registrationInput = {
    ...common,
    submitRegistration,
    refreshRetries: 2,
  };
  const result = resetPassword
    ? await recoverAndPrepareFranceTlsAccount(common)
    : abandonExistingAccount
      ? await abandonAndRegisterFranceTlsAccount({ ...registrationInput, submitRegistration: true })
      : await registerAndPrepareFranceTlsAccount(registrationInput);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({
    status: "france_tls_account_registration_failed",
    message: error instanceof Error ? error.message.split("\n")[0] : String(error),
  }, null, 2));
  process.exit(1);
});

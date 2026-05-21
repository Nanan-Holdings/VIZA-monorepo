#!/usr/bin/env npx tsx
/**
 * Rotate one secret in the per-applicant credential vault.
 *
 * Reads the new plaintext from stdin (so it never lands in shell history)
 * and writes it through the same vault helpers that the runtime uses, so
 * the rotation is recorded in `secret_access_log` automatically.
 *
 * Usage:
 *   echo -n "new-plaintext-value" | \
 *     npx tsx scripts/rotate-applicant-secret.ts <applicant_id> <key>
 *
 * Required env (loaded from .env.local / .env via supabase-client.ts):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   SUBMISSION_RESULT_SECRET_KEY
 */

import { setApplicantSecret } from "../src/db/applicant-vault.js";

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data.replace(/\r?\n$/, "")));
    process.stdin.on("error", reject);
  });
}

async function main() {
  const [, , applicantId, key] = process.argv;
  if (!applicantId || !key) {
    console.error("Usage: rotate-applicant-secret.ts <applicant_id> <key>");
    console.error("       (new value is read from stdin)");
    process.exit(2);
  }

  if (process.stdin.isTTY) {
    console.error(
      "Refusing to read interactively — pipe the new plaintext value via stdin.",
    );
    console.error(
      'Example: echo -n "value" | npx tsx scripts/rotate-applicant-secret.ts <applicant_id> <key>',
    );
    process.exit(2);
  }

  const plaintext = await readStdin();
  if (!plaintext) {
    console.error("Empty stdin — no rotation performed.");
    process.exit(1);
  }

  await setApplicantSecret(applicantId, key, plaintext, {
    actor: "scripts/rotate-applicant-secret.ts",
    note: `rotated_at=${new Date().toISOString()}`,
  });

  console.log(
    `✅ rotated applicant_secret applicant=${applicantId} key=${key} ` +
      `(audit row written to secret_access_log)`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});

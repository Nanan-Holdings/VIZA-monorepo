/**
 * Seed test portal credentials for the Edward (developer) applicant profile.
 *
 * Idempotent: re-running upserts the same rows. Intended for local / staging
 * dev work before VIZA owns a customer domain that auto-provisions per-applicant
 * portal accounts.
 *
 * Required env (read from viza-be/submission-service/.env via dotenv):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUBMISSION_RESULT_SECRET_KEY
 *
 * Required env for credential values (passed at invocation, never committed):
 *   EDWARD_UK_PASSWORD     UK Visas4UK password
 *   EDWARD_UK_RESUME_URL   forceResume URL minted by UKVI at registration
 *   EDWARD_UK_EMAIL        UK account email (defaults to edward.zehua.zhang@gmail.com)
 *   EDWARD_EG_EMAIL        Egypt visa2egypt account email
 *   EDWARD_EG_PASSWORD     Egypt visa2egypt password
 *   EDWARD_EG_RESUME_URL   visa2egypt.gov.eg/eVisa/Applications?VISTK=... (optional)
 *   EDWARD_IT_USERNAME     Italy VFS-CN username (optional — skipped if empty)
 *   EDWARD_IT_PASSWORD     Italy VFS-CN password (optional)
 *
 * Usage:
 *   EDWARD_UK_PASSWORD=... EDWARD_UK_RESUME_URL=... EDWARD_EG_EMAIL=... \
 *   EDWARD_EG_PASSWORD=... npm run seed:edward-creds
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { encryptSecret } from "../src/secret-cipher";

// Load env from submission-service .env first, fall back to agent-backend .env.local
// (which holds shared infrastructure secrets in this monorepo).
const submissionEnv = path.resolve(__dirname, "..", ".env");
const agentBackendEnv = path.resolve(__dirname, "..", "..", "agent-backend", ".env.local");
// Load agent-backend first (authoritative source), then submission-service local
// overrides. Empty values in submission-service/.env should not clobber populated
// values in agent-backend/.env.local.
const r1 = dotenv.config({ path: agentBackendEnv });
const r2 = dotenv.config({ path: submissionEnv });
if (r1.error) console.warn(`(dotenv) ${agentBackendEnv}: ${r1.error.message}`);
if (r2.error) console.warn(`(dotenv) ${submissionEnv}: ${r2.error.message}`);

const EDWARD_APPLICANT_ID = "f8e36807-36b1-432c-ae1b-c34fb01f053a";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

async function main() {
  const supabase = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );

  if (!process.env.SUBMISSION_RESULT_SECRET_KEY) {
    throw new Error("SUBMISSION_RESULT_SECRET_KEY must be set to encrypt creds");
  }

  // ── UK ────────────────────────────────────────────────────────────────────
  const ukPassword = process.env.EDWARD_UK_PASSWORD;
  const ukResumeUrl = process.env.EDWARD_UK_RESUME_URL;
  const ukEmail = process.env.EDWARD_UK_EMAIL ?? "edward.zehua.zhang@gmail.com";

  if (ukPassword && ukResumeUrl) {
    const { error } = await supabase
      .from("uk_accounts")
      .upsert(
        {
          applicant_id: EDWARD_APPLICANT_ID,
          email: ukEmail,
          password_encrypted: encryptSecret(ukPassword),
          resume_url: ukResumeUrl,
        },
        { onConflict: "applicant_id,email" },
      );
    if (error) throw new Error(`uk_accounts upsert failed: ${error.message}`);
    console.log(`✅ uk_accounts seeded for ${ukEmail}`);
  } else {
    console.log("⏭️  Skipping uk_accounts (EDWARD_UK_PASSWORD or EDWARD_UK_RESUME_URL not set)");
  }

  // ── EG ────────────────────────────────────────────────────────────────────
  const egEmail = process.env.EDWARD_EG_EMAIL;
  const egPassword = process.env.EDWARD_EG_PASSWORD;
  const egResumeUrl = process.env.EDWARD_EG_RESUME_URL;

  if (egEmail && egPassword) {
    const vistkToken = egResumeUrl
      ? new URL(egResumeUrl).searchParams.get("VISTK")
      : null;
    const { error } = await supabase
      .from("eg_accounts")
      .upsert(
        {
          applicant_id: EDWARD_APPLICANT_ID,
          email: egEmail,
          password_encrypted: encryptSecret(egPassword),
          vistk_token: vistkToken,
          resume_url: egResumeUrl ?? null,
        },
        { onConflict: "applicant_id,email" },
      );
    if (error) throw new Error(`eg_accounts upsert failed: ${error.message}`);
    console.log(`✅ eg_accounts seeded for ${egEmail}`);
  } else {
    console.log("⏭️  Skipping eg_accounts (EDWARD_EG_EMAIL or EDWARD_EG_PASSWORD not set)");
  }

  // ── IT VFS-CN ─────────────────────────────────────────────────────────────
  const itUsername = process.env.EDWARD_IT_USERNAME;
  const itPassword = process.env.EDWARD_IT_PASSWORD;

  if (itUsername && itPassword) {
    const { error } = await supabase
      .from("it_vfs_cn_accounts")
      .upsert(
        {
          applicant_id: EDWARD_APPLICANT_ID,
          username: itUsername,
          password_encrypted: encryptSecret(itPassword),
        },
        { onConflict: "applicant_id,username" },
      );
    if (error) throw new Error(`it_vfs_cn_accounts upsert failed: ${error.message}`);
    console.log(`✅ it_vfs_cn_accounts seeded for ${itUsername}`);
  } else {
    console.log("⏭️  Skipping it_vfs_cn_accounts (EDWARD_IT_USERNAME or EDWARD_IT_PASSWORD not set)");
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

#!/usr/bin/env npx tsx
/**
 * QA harness: drive UK save-and-return registration through the live UKVI
 * portal via the GB residential proxy.
 *
 * SAFE by default (fills the register-an-email form, stops before submit —
 * no UKVI account created). Set UK_REGISTER_COMMIT=1 to actually create the
 * account + capture the resume link via the inbox (requires inbox-ingest
 * running in --loop).
 *
 *   RECON_PROXY_COUNTRY=gb npx tsx scripts/qa-uk-register.ts
 */
import "dotenv/config";
import { registerUkAccount } from "../src/uk/register";

const APPLICANT_ID = process.env.QA_APPLICANT_ID ?? "11111111-1111-1111-1111-111111111111";

// playwright-extra's stealth plugin fires a benign CDP call after the browser
// closes ("Target page, context or browser has been closed"). Swallow it so it
// doesn't crash the process before the real result prints.
process.on("unhandledRejection", (err) => {
  const msg = err instanceof Error ? err.message : String(err);
  if (/has been closed/i.test(msg)) return;
  console.error("unhandledRejection:", msg);
});

async function main(): Promise<void> {
  const result = await Promise.race([
    registerUkAccount({
      applicantId: APPLICANT_ID,
      biometricsCountryIso3: "USA",
      headless: process.env.UK_HEADFUL !== "1",
      runId: `qa-uk-${Date.now()}`,
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("qa-uk timeout > 300s")), 300_000),
    ),
  ]);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === "failed" ? 1 : 0);
}

main().catch((err) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  process.exit(2);
});

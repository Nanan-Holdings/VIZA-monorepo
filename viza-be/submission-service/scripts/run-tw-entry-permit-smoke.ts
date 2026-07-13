#!/usr/bin/env npx tsx
import "dotenv/config";
import { supabase } from "../src/supabase";
import { runTaiwanEntryPermitPortalSubmission } from "../src/tw-entry-permit/runner";

const SEND_EMAIL = process.argv.includes("--send-email");
const TEST_EMAIL = "czz19974931995@gmail.com";

async function main(): Promise<void> {
  if (SEND_EMAIL && process.env.TW_ENTRY_PERMIT_EMAIL_VERIFICATION_ENABLED !== "true") {
    throw new Error("Set TW_ENTRY_PERMIT_EMAIL_VERIFICATION_ENABLED=true before running --send-email.");
  }
  const users = await supabase.auth.admin.listUsers({ page: 1, perPage: 1_000 });
  if (users.error) throw new Error(`Unable to load local smoke applicant: ${users.error.message}`);
  const user = users.data.users.find((candidate) => candidate.email === TEST_EMAIL);
  if (!user) throw new Error("Local Taiwan smoke applicant is not available.");
  const profile = await supabase.from("applicant_profiles")
    .select("id, inbox_alias")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (profile.error || !profile.data?.id || !profile.data.inbox_alias) {
    throw new Error("Local Taiwan smoke applicant has no managed inbox alias.");
  }

  const result = await runTaiwanEntryPermitPortalSubmission({
    applicationId: "00000000-0000-4000-8000-000000000001",
    visaType: "TW_OVERSEAS_CN_TOURISM_ENTRY_PERMIT",
    aliasEmailAddress: profile.data.inbox_alias,
    passportNumber: "E12345678",
    passportExpiryDate: "2030-07-13",
    eligibilityRoute: "singapore_pr",
    declarationAccepted: true,
  }, {
    headless: true,
    stopBeforeSubmit: true,
    sendVerificationCode: SEND_EMAIL,
    applicantId: profile.data.id,
  });
  console.log(JSON.stringify({
    submitted: result.submitted,
    checkpoint: result.checkpoint,
    origin: new URL(result.portalUrl).origin,
    referenceNumberCaptured: Boolean(result.referenceNumber),
    postVerificationControls: result.postVerificationControls,
    screenshotsCaptured: result.screenshots.length,
    logs: result.logs.filter((entry) => entry.startsWith("tw_entry_permit_")),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

#!/usr/bin/env npx tsx
/**
 * Smoke test for the Cloudflare-backed inbox path (INBOX-005).
 *
 * Inserts a synthetic inbound_email row addressed to a configured test
 * applicant's alias, then calls inbox.waitForMessage() with a 30s
 * timeout. Asserts the helper returned the row in under 30 seconds.
 *
 * Usage:
 *   APPLICANT_ID=<uuid> npx tsx scripts/inbox-smoke.ts vn
 *   APPLICANT_ID=<uuid> npx tsx scripts/inbox-smoke.ts uk-resume
 *   APPLICANT_ID=<uuid> npx tsx scripts/inbox-smoke.ts uk-security
 *   APPLICANT_ID=<uuid> npx tsx scripts/inbox-smoke.ts us-appointment
 *
 * Required env (loaded from .env via dotenv):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * The applicant must already have inbox_alias assigned (INBOX-003 server
 * action `assignApplicantInboxAlias`).
 */

import "dotenv/config";
import { supabase } from "../src/supabase.js";
import { waitForVnRegistrationEmail } from "../src/vietnam/inbox.js";
import {
  waitForUkResumeEmail,
  waitForUkSecurityCode,
} from "../src/uk/inbox.js";
import { waitForUSAppointmentVerificationEmail } from "../src/us-appointment/inbox.js";

type Mode = "vn" | "uk-resume" | "uk-security" | "us-appointment";

const TIMEOUT_MS = 30_000;

async function fetchAlias(applicantId: string): Promise<string> {
  const { data, error } = await supabase
    .from("applicant_profiles")
    .select("inbox_alias")
    .eq("id", applicantId)
    .maybeSingle();
  if (error) throw new Error(`alias read failed: ${error.message}`);
  if (!data?.inbox_alias) {
    throw new Error(
      `applicant ${applicantId} has no inbox_alias — call assignApplicantInboxAlias first`,
    );
  }
  return data.inbox_alias.toLowerCase();
}

interface SyntheticMessage {
  to_addr: string;
  from_addr: string;
  subject: string;
  text: string;
}

const SYNTHETIC: Record<Mode, (toAddr: string) => SyntheticMessage> = {
  vn: (to) => ({
    to_addr: to,
    from_addr: "no-reply@evisa.xuatnhapcanh.gov.vn",
    subject: "E-VISA Application registration",
    text: "Dear Applicant,\n\nYour registration code is SMOKE12CD34EF56. Please save this for the result page.\n\nResult: https://evisa.xuatnhapcanh.gov.vn/EN/result?code=SMOKE12CD34EF56\n",
  }),
  "uk-resume": (to) => ({
    to_addr: to,
    from_addr: "no-reply@notifications.service.gov.uk",
    subject: "Resume your UK Visa application",
    text: "Resume your application: https://apply-uk-visa.service.gov.uk/forceResume?token=smoke\n",
  }),
  "uk-security": (to) => ({
    to_addr: to,
    from_addr: "no-reply@notifications.service.gov.uk",
    subject: "Your UK Visa security code",
    text: "Your security code is 909123.\n",
  }),
  "us-appointment": (to) => ({
    to_addr: to,
    from_addr: "no-reply@do-not-reply.usvisascheduling.com",
    subject: "Verify your USVisaScheduling account",
    text: "Your verification code is 654321. This code expires shortly.\n",
  }),
};

async function insertSynthetic(msg: SyntheticMessage): Promise<void> {
  const { error } = await supabase.from("inbound_email").insert({
    to_addr: msg.to_addr,
    from_addr: msg.from_addr,
    subject: msg.subject,
    text: msg.text,
    headers: {},
    raw_size: msg.text.length,
    received_at: new Date().toISOString(),
    processed: false,
  });
  if (error) throw new Error(`synthetic insert failed: ${error.message}`);
}

async function main() {
  const mode = (process.argv[2] ?? "vn") as Mode;
  const applicantId = process.env.APPLICANT_ID;
  if (!applicantId) {
    console.error("Set APPLICANT_ID=<uuid> in env before running.");
    process.exit(2);
  }
  if (!SYNTHETIC[mode]) {
    console.error(`Unknown mode "${mode}". Use one of: ${Object.keys(SYNTHETIC).join(", ")}`);
    process.exit(2);
  }

  const alias = await fetchAlias(applicantId);
  await insertSynthetic(SYNTHETIC[mode](alias));

  const start = Date.now();
  let label: string;
  let summary: Record<string, unknown>;
  if (mode === "vn") {
    const out = await waitForVnRegistrationEmail(applicantId, TIMEOUT_MS);
    label = "VN registration";
    summary = { code: out.registrationCode, link: out.resultLink };
  } else if (mode === "uk-resume") {
    const out = await waitForUkResumeEmail(applicantId, TIMEOUT_MS);
    label = "UK resume";
    summary = { resumeUrl: out.resumeUrl };
  } else if (mode === "uk-security") {
    const out = await waitForUkSecurityCode(applicantId, TIMEOUT_MS);
    label = "UK security code";
    summary = { hasCode: Boolean(out.code) };
  } else {
    const out = await waitForUSAppointmentVerificationEmail(applicantId, TIMEOUT_MS);
    label = "US appointment verification";
    summary = { hasCode: Boolean(out.code), hasLink: Boolean(out.link) };
  }
  const elapsed = Date.now() - start;

  console.log(`✅ ${label} consumed in ${elapsed}ms`, summary);
  if (elapsed > TIMEOUT_MS) {
    console.error(`elapsed ${elapsed}ms exceeded ${TIMEOUT_MS}ms — smoke FAILED`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});

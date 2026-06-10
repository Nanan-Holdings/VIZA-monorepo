/**
 * UK save-and-return account registration (the gated-portal keystone).
 *
 * `orchestrateUkFill` deliberately stops at the "register an email" page
 * because creating a UKVI account requires an email we can read verification
 * mail from. Now that the inbox pipeline is live (per-applicant
 * `appl-*@haggstorm.com` alias → Cloudflare → ingest → `inbound_email`), this
 * worker completes the step:
 *
 *   reach registration → fill alias + generated password → submit →
 *   wait for UKVI's resume link via the inbox → persist an encrypted
 *   `uk_accounts` row (email, password, resume_url) for the runner to resume.
 *
 * SAFETY: submitting CREATES A REAL UKVI ACCOUNT. The submit is gated behind
 * `UK_REGISTER_COMMIT=1`. Without it the worker fills the form and stops
 * (`stopped_before_commit`) — safe to run against the live portal for QA.
 */
import { randomBytes } from "node:crypto";
import { supabase } from "../supabase.js";
import { startUkSession } from "./session.js";
import { orchestrateUkFill } from "./orchestrator.js";
import { UK_PAGE_SELECTORS, UK_SUBMIT_SELECTOR } from "./selectors.js";
import { waitForUkResumeEmail } from "./inbox.js";
import { encryptSecret } from "../secret-cipher.js";

export interface UkRegisterInput {
  applicantId: string;
  /** ISO3 biometrics country for the orchestrator (default USA). */
  biometricsCountryIso3?: string;
  headless?: boolean;
  runId?: string;
}

export type UkRegisterResult =
  | { status: "registered"; email: string; resumeUrl: string }
  | { status: "stopped_before_commit"; email: string; reason: string }
  | { status: "failed"; reason: string; stoppedAt?: string };

/** UKVI password policy: 8–30 chars, upper+lower+digit+special. */
function generatePassword(): string {
  const pick = (set: string): string => set[randomBytes(1)[0] % set.length];
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digit = "23456789";
  const special = "!@$%^*";
  const core = randomBytes(8).toString("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, 8);
  return `${pick(upper)}${core}${pick(lower)}${pick(digit)}${pick(special)}`;
}

async function aliasForApplicant(applicantId: string): Promise<string> {
  const { data, error } = await supabase
    .from("applicant_profiles")
    .select("inbox_alias")
    .eq("id", applicantId)
    .maybeSingle();
  if (error) throw new Error(`inbox_alias lookup failed: ${error.message}`);
  if (!data?.inbox_alias) {
    throw new Error(`applicant ${applicantId} has no inbox_alias — call assignApplicantInboxAlias() first`);
  }
  return String(data.inbox_alias).toLowerCase();
}

export async function registerUkAccount(input: UkRegisterInput): Promise<UkRegisterResult> {
  const email = await aliasForApplicant(input.applicantId);
  const password = generatePassword();
  // UKVI geo-gates by IP; egress GB. stealth-browser reads RECON_PROXY_COUNTRY.
  process.env.RECON_PROXY_COUNTRY = process.env.RECON_PROXY_COUNTRY ?? "gb";

  // UKVI behind a residential proxy is slow; give the first paint room.
  const session = await startUkSession({
    headless: input.headless ?? true,
    runId: input.runId,
    navigationTimeoutMs: 120_000,
  });
  try {
    const orchestrated = await orchestrateUkFill(session, {
      answers: {},
      biometricsCountryIso3: input.biometricsCountryIso3 ?? "USA",
      runId: input.runId,
    });
    if (orchestrated.stoppedAt.id !== "registration") {
      return { status: "failed", reason: "did not reach registration page", stoppedAt: orchestrated.stoppedAt.id };
    }

    const { page } = session;
    await page.fill(UK_PAGE_SELECTORS.registration.email.selector, email, { timeout: 10_000 });
    await page.fill(UK_PAGE_SELECTORS.registration.password1.selector, password, { timeout: 10_000 });
    await page.fill(UK_PAGE_SELECTORS.registration.password2.selector, password, { timeout: 10_000 });

    if (process.env.UK_REGISTER_COMMIT !== "1") {
      return {
        status: "stopped_before_commit",
        email,
        reason: "registration form filled; UK_REGISTER_COMMIT not set, so no UKVI account was created",
      };
    }

    // COMMIT: creates the UKVI account and triggers the verification email.
    await page.click(UK_SUBMIT_SELECTOR, { timeout: 10_000 });

    // UKVI emails a resume/continue link to the alias; the inbox ingest worker
    // must be running for this to resolve.
    const resumeEmail = await waitForUkResumeEmail(input.applicantId, 180_000);
    const resumeUrl = resumeEmail.resumeUrl;
    if (!resumeUrl) {
      return { status: "failed", reason: "registration submitted but no resume link found in verification email" };
    }

    const { error } = await supabase.from("uk_accounts").upsert(
      {
        applicant_id: input.applicantId,
        email,
        password_encrypted: encryptSecret(password),
        resume_url: resumeUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "applicant_id,email" },
    );
    if (error) {
      return { status: "failed", reason: `uk_accounts upsert failed: ${error.message}` };
    }

    return { status: "registered", email, resumeUrl };
  } finally {
    await session.close();
  }
}

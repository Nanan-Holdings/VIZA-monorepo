/**
 * End-to-end live test harness for the DS-160 CEAC autofill pipeline.
 *
 * Chains the full live flow:
 *   1. startCeacSession — stealth browser + location select + CAPTCHA solve
 *   2. handleConfirmApplicationPage — Privacy Act + Application ID + security Q
 *   3. orchestrateFill — page-by-page DS-160 fill to Sign and Submit
 *
 * Uses a sample answer payload so the run does not depend on Supabase. The
 * goal is to prove the autofill pipeline reaches either `handoff_ready` or a
 * well-classified failure on a real CEAC session.
 *
 * Usage:
 *   npx tsx src/ceac/_e2e.ts
 *
 * Writes artifacts (screenshots, .dat) to ./e2e-out/
 */
import { config } from "dotenv";
import * as path from "node:path";
import * as fs from "node:fs";
config({ path: path.join(__dirname, "../../.env") });

import { startCeacSession } from "./session";
import { handleConfirmApplicationPage } from "./confirm-application";
import { detectPage } from "./pages";
import { orchestrateFill } from "./orchestrator";
import { createRecoveryTracker } from "./artifacts";

const OUT_DIR = path.join(__dirname, "../../e2e-out");

// A representative sample answer payload. Keys match the DS-160 seed-script
// field names (see seed-ds160-form-fields.ts). The orchestrator fills only
// keys present in the per-page mapping; missing keys are skipped silently.
const SAMPLE_ANSWERS: Record<string, string> = {
  // Personal Information 1
  surname: "TESTER",
  given_names: "JOHN ALEX",
  full_name_native_alphabet: "N/A",
  sex: "M",
  marital_status: "S",
  date_of_birth_day: "15",
  date_of_birth_month: "JUN",
  date_of_birth_year: "1990",
  has_other_names: "N",
  has_telecode: "N",
  city_of_birth: "LONDON",
  state_of_birth: "ENGLAND",
  country_of_birth: "GRBR",

  // Personal Information 2
  nationality_country: "GRBR",
  other_nationality: "N",
  permanent_resident_other_country: "N",
  // No National ID / SSN / Taxpayer ID — toggle the Does-Not-Apply checkboxes
  national_id_number_na: "Y",
  us_social_security_number_na: "Y",
  us_taxpayer_id_na: "Y",

  // Travel Information
  has_specific_travel_plans: "N",
  purpose_of_trip: "B",           // BUSINESS/PLEASURE (B1/B2)
  purpose_of_trip_specify: "B1-B2",
  who_is_paying: "S",             // SELF
  intended_arrival_date_day: "10",
  intended_arrival_date_month: "DEC",
  intended_arrival_date_year: "2026",
  intended_length_of_stay: "14",
  intended_length_of_stay_unit: "D",
  us_address_street: "123 MAIN ST",
  us_address_city: "NEW YORK",
  us_address_state: "NY",
  us_address_zip: "10001",

  // Travel Companions
  has_companions: "N",

  // Previous US Travel — all "No" for a first-time applicant
  has_been_in_us: "N",
  has_us_visa: "N",
  has_been_refused: "N",
  vwp_denial: "N",
  immigrant_petition_filed: "N",

  // Passport
  passport_document_type: "R",
  passport_number: "123456789",
  passport_book_number_na: "Y",
  passport_issuance_city: "LONDON",
  passport_issuance_country: "GRBR",
  passport_issuing_country: "GRBR",
  passport_issue_day: "01",
  passport_issue_month: "01",  // CEAC month ddl uses numeric months "01"-"12"
  passport_issue_year: "2020",
  passport_expiry_day: "01",
  passport_expiry_month: "01",
  passport_expiry_year: "2030",
  passport_lost_or_stolen: "N",

  // US Contact — required even when applicant doesn't know one; use a
  // hotel/host placeholder. Relationship "O" = Other.
  us_contact_surname: "DOE",
  us_contact_given_names: "JOHN",
  us_contact_organization_na: "Y",
  us_contact_relationship: "H",  // HOST
  us_contact_address_street1: "123 MAIN ST",
  us_contact_city: "NEW YORK",
  us_contact_state: "NY",
  us_contact_zip: "10001",
  us_contact_phone: "2125551234",
  us_contact_email: "host@example.com",

  // Family Relatives
  father_surname: "TESTER",
  father_given_names: "ROBERT",
  father_dob_day: "01",
  father_dob_month: "JAN",  // ddlFathersDOBMonth uses 3-letter abbrev values
  father_dob_year: "1960",
  father_in_us: "N",
  mother_surname: "TESTER",
  mother_given_names: "MARY",
  mother_dob_day: "01",
  mother_dob_month: "JAN",
  mother_dob_year: "1962",
  mother_in_us: "N",
  has_immediate_us_relatives: "N",
  has_other_us_relatives: "N",

  // Work / Education — Present. "RT" = Retired is the least-revealing
  // option (no employer required); "H" = Homemaker; use an option that
  // doesn't trigger reveals to keep this a small test payload.
  primary_occupation: "RT",  // RETIRED

  // Work / Education — Previous
  has_previous_employer: "N",
  has_other_education: "N",

  // Work / Education — Additional
  has_clan_tribe: "N",
  language_name: "ENGLISH",
  has_countries_visited: "N",
  has_organization: "N",
  has_specialized_skills: "N",
  has_served_military: "N",
  has_served_insurgent: "N",

  // Security and Background Part 1
  has_communicable_disease: "N",
  has_physical_mental_disorder: "N",
  is_drug_abuser: "N",

  // Security and Background Part 2
  has_arrest_conviction: "N",
  has_violated_controlled_substance: "N",
  has_prostitution: "N",
  has_money_laundering: "N",
  has_human_trafficking: "N",
  has_aided_human_trafficking: "N",
  has_trafficking_beneficiary: "N",

  // Security and Background Part 3
  intend_illegal_activity: "N",
  intend_terrorist_activity: "N",
  has_provided_terrorist_support: "N",
  is_terrorist_member: "N",
  is_terrorist_family: "N",
  has_genocide: "N",
  has_torture: "N",
  has_extrajudicial_killings: "N",
  has_child_soldier: "N",
  has_religious_freedom_violation: "N",
  has_population_control: "N",
  has_coercive_transplant: "N",

  // Security and Background Part 4
  has_immigration_fraud: "N",
  has_removal_order: "N",

  // Security and Background Part 5
  has_withheld_child_custody: "N",
  has_voted_illegally: "N",
  has_renounced_citizenship: "N",

  // Contact (Address and Phone)
  home_address_line1: "10 DOWNING STREET",
  home_address_city: "LONDON",
  home_address_state: "LONDON",
  home_address_postal: "SW1A2AA",
  home_address_country: "GRBR",
  mailing_same_as_home: "Y",
  primary_phone: "442079251234",
  mobile_phone_na: "Y",
  work_phone_na: "Y",
  has_other_phone: "N",
  email_address: "tester@example.com",
  has_other_email: "N",
  has_social_media: "N",
  // CEAC requires a social-media PLATFORM selection even when the
  // applicant declares no additional presence. "NONE" = "I do not have
  // any social media presence" in the dropdown.
  social_media_provider: "NONE",
  social_media_identifier: "N/A",
};

const SAMPLE_PROFILE = {
  surname: "TESTER",
  given_names: "JOHN ALEX",
  date_of_birth: "1990-06-15",
  passport_number: "123456789",
  email_address: "tester@example.com",
};

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const runId = `e2e-${Date.now()}`;
  const tracker = createRecoveryTracker({ runId });
  const log = (msg: string) => console.log(`[e2e] ${msg}`);

  log(`Starting end-to-end live run ${runId}`);
  log(`Output dir: ${OUT_DIR}`);

  // Bootstrap with retry on SessionTimedOut. CEAC's anti-bot sometimes
  // invalidates a stealth context the moment we click START, even with
  // a correct CAPTCHA. Fresh browser context per attempt is the only
  // recovery. Cap at 5 attempts to keep the run bounded.
  const t0 = Date.now();
  let session: Awaited<ReturnType<typeof startCeacSession>> | null = null;
  let lastErr: unknown;
  // HEADLESS toggle: set CEAC_HEADLESS=0 to watch the browser live.
  // Default stays headless for CI / background cron runs.
  const headless = process.env.CEAC_HEADLESS !== "0";
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      session = await startCeacSession({
        headless,
        acceptDownloads: true,
        runId: `${runId}-boot${attempt}`,
      });
      break;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      log(`Bootstrap attempt ${attempt}/5 failed: ${msg.slice(0, 140)}`);
      // Retry on SessionTimedOut (anti-bot), CAPTCHA exhaustion (bad
      // streak of wrong solves), or transient network errors (CEAC
      // sometimes rate-limit-resets the connection). All recover via a
      // fresh browser context. Back off between attempts to let CEAC's
      // anti-bot heuristics cool.
      const retryable =
        /SessionTimedOut/i.test(msg) ||
        /CAPTCHA solve failed/i.test(msg) ||
        /Failed to load CEAC start page/i.test(msg) ||
        /ERR_CONNECTION_RESET|ERR_NETWORK_CHANGED|ERR_NAME_NOT_RESOLVED/i.test(msg);
      if (!retryable) throw err;
      const backoffMs = Math.min(60_000, 5_000 * attempt * attempt);
      log(`  backing off ${Math.round(backoffMs / 1000)}s before next attempt`);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  if (!session) throw lastErr;
  log(`Session bootstrap OK in ${Date.now() - t0}ms`);
  log(`  url=${session.page.url()}`);
  log(`  captcha attempts=${session.captchaSolve?.telemetry.length ?? 0}`);

  try {
    // Step 2: Confirm Application page (Privacy Act + security Q)
    const confirm = await handleConfirmApplicationPage(session.page, {
      securityAnswer: "VIZATEST",
      securityQuestionValue: "3",
    });
    log(`ConfirmApplication OK — applicationId=${confirm.applicationId}`);
    log(`  security Q: ${confirm.securityQuestionText}`);
    log(`  post-continue url=${confirm.postContinueUrl}`);

    // Dump the new surface
    const probe = await detectPage(session.page);
    log(`After Continue — detected page: ${probe.id} (heading=${JSON.stringify(probe.heading)})`);
    await session.page.screenshot({
      path: path.join(OUT_DIR, `post-confirm.png`),
      fullPage: true,
    });

    // Step 3: orchestrateFill. Pass recovery credentials so a mid-fill
    // SessionTimedOut triggers auto-resume instead of a hard failure.
    // CEAC_TEST_PHOTO can point to a JPEG to walk through upload_photo
    // and continue to Sign and Submit; without it, we stop at
    // upload_photo with handoff_ready (back-compat for runs without a
    // photo).
    const photoPath = process.env.CEAC_TEST_PHOTO?.trim();
    if (photoPath) log(`Using photo file: ${photoPath}`);
    log(`Starting orchestrateFill...`);
    const { result, datArtifact, sectionCoverage } = await orchestrateFill(session, {
      answers: SAMPLE_ANSWERS,
      profile: SAMPLE_PROFILE,
      tracker,
      runId,
      outputDir: OUT_DIR,
      recoveryCredentials: {
        applicationId: confirm.applicationId,
        surnameFirstFive: (SAMPLE_ANSWERS.surname || "TESTER").slice(0, 5).toUpperCase(),
        yearOfBirth: SAMPLE_ANSWERS.date_of_birth_year || "1990",
        securityAnswer: confirm.securityAnswer,
      },
      photo: photoPath ? { kind: "path", path: photoPath } : undefined,
    });

    log(`orchestrateFill returned`);
    log(`  status=${result.status}`);
    log(`  applicationId=${result.applicationId ?? "(none)"}`);
    log(`  datArtifact=${datArtifact?.path ?? "(none)"}`);
    log(`  sections filled: [${sectionCoverage.filled.join(", ")}]`);
    log(`  sections skipped: [${sectionCoverage.skipped.join(", ")}]`);

    // On failure, dump the page HTML and all input/select/radio IDs so
    // we can adjust mappings without another live round-trip (which
    // consumes a 2captcha solve + a CEAC session).
    if (result.status !== "handoff_ready") {
      try {
        const html = await session.page.content();
        fs.writeFileSync(path.join(OUT_DIR, "failure-page.html"), html);
        const dom = await session.page.evaluate(`
          (function() {
            function list(sel) {
              var out = [];
              var ns = document.querySelectorAll(sel);
              for (var i = 0; i < ns.length; i++) {
                out.push({ id: ns[i].id, name: ns[i].name, type: ns[i].type || '', value: ns[i].value || '' });
              }
              return out;
            }
            function submitsVisible() {
              var out = [];
              var ss = document.querySelectorAll('input[type="submit"]');
              for (var i = 0; i < ss.length; i++) {
                var s = ss[i];
                var style = window.getComputedStyle(s);
                var visible = style.display !== 'none' && style.visibility !== 'hidden';
                var rect = s.getBoundingClientRect();
                var inViewport = rect.width > 0 && rect.height > 0;
                out.push({
                  id: s.id, name: s.name, value: s.value,
                  className: s.className, visible: visible, inViewport: inViewport,
                });
              }
              return out;
            }
            return {
              heading: (document.querySelector('h2, .SubHead') || {}).textContent || '',
              radios: list('input[type="radio"]'),
              checkboxes: list('input[type="checkbox"]'),
              selects: list('select'),
              textInputs: list('input[type="text"], input:not([type])'),
              submits: submitsVisible(),
            };
          })()
        `);
        fs.writeFileSync(path.join(OUT_DIR, "failure-dom.json"), JSON.stringify(dom, null, 2));
        log(`  diag: wrote failure-page.html and failure-dom.json`);
      } catch (e) {
        log(`  diag dump failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    fs.writeFileSync(
      path.join(OUT_DIR, "result.json"),
      JSON.stringify({ confirm, result, sectionCoverage }, null, 2),
    );
    log(`Wrote result.json`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[e2e] FAILED: ${msg}`);
    try {
      await session.page.screenshot({
        path: path.join(OUT_DIR, `failure.png`),
        fullPage: true,
      });
    } catch { /* best effort */ }
    process.exitCode = 1;
  } finally {
    await session.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Seed a deterministic test applicant for the CEAC DS-160 autofill e2e flow.
 *
 * Idempotent: re-running upserts the same auth user, applicant_profiles row,
 * applications row, and visa_application_answers rows. Safe to run repeatedly.
 *
 * What this seeds (under email user@test.com):
 *   1. Supabase auth user (password: $TEST_USER_PASSWORD or default)
 *   2. applicant_profiles row linked to auth_user_id
 *   3. applications row (country='united_states', visa_type='DS160', status='draft')
 *      — single canonical app reused across runs (upsert on auth_user_id+visa_type)
 *   4. visa_application_answers rows (one per SAMPLE_ANSWERS entry)
 *
 * Required env (from submission-service/.env or agent-backend/.env.local):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional env:
 *   TEST_USER_PASSWORD   (default: VizaTest!2026)
 *
 * Usage:
 *   npm run seed:test-ds160-applicant
 *
 * On success prints the application_id; pass it to the e2e runner via
 *   CEAC_TEST_APPLICATION_ID=<id> npx tsx src/ceac/_e2e.ts
 */
import * as dotenv from "dotenv";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { TEST_DS160_ANSWERS, TEST_DS160_PROFILE } from "../src/ceac/test-ds160-fixture";

const submissionEnv = path.resolve(__dirname, "..", ".env");
const agentBackendEnv = path.resolve(__dirname, "..", "..", "agent-backend", ".env.local");
dotenv.config({ path: agentBackendEnv });
dotenv.config({ path: submissionEnv });

const TEST_EMAIL = "user@test.com";
const DEFAULT_PASSWORD = "VizaTest!2026";

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

  const password = process.env.TEST_USER_PASSWORD ?? DEFAULT_PASSWORD;

  // ── 1. Supabase auth user ─────────────────────────────────────────────────
  let authUserId: string;
  const { data: createData, error: createErr } = await supabase.auth.admin.createUser({
    email: TEST_EMAIL,
    password,
    email_confirm: true,
  });

  if (createErr && /already.*registered|already exists|duplicate/i.test(createErr.message)) {
    // Look up existing user by email
    const { data: list, error: listErr } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) throw new Error(`auth.admin.listUsers failed: ${listErr.message}`);
    const existing = list.users.find((u) => u.email === TEST_EMAIL);
    if (!existing) throw new Error(`auth user ${TEST_EMAIL} reported as existing but not found`);
    authUserId = existing.id;
    console.log(`↻ auth user ${TEST_EMAIL} already exists — reusing id=${authUserId}`);
  } else if (createErr) {
    throw new Error(`auth.admin.createUser failed: ${createErr.message}`);
  } else {
    authUserId = createData.user.id;
    console.log(`✅ auth user created ${TEST_EMAIL} id=${authUserId}`);
  }

  // ── 2. applicant_profiles ────────────────────────────────────────────────
  // Upsert keyed on auth_user_id (UNIQUE in schema) so re-runs are idempotent.
  const profileRow = {
    auth_user_id: authUserId,
    full_name: `${TEST_DS160_PROFILE.given_names} ${TEST_DS160_PROFILE.surname}`,
    date_of_birth: TEST_DS160_PROFILE.date_of_birth,
    gender: "M",
    nationality: "GBR",
    occupation: "Retired",
    passport_number: TEST_DS160_PROFILE.passport_number,
    passport_issue_date: "2020-01-01",
    passport_expiry_date: "2030-01-01",
    passport_issuing_country: "GBR",
    email: TEST_DS160_PROFILE.email_address,
    phone: "+442079251234",
    language_pref: "en",
    onboarding_done: true,
  };

  const { data: profileData, error: profileErr } = await supabase
    .from("applicant_profiles")
    .upsert(profileRow, { onConflict: "auth_user_id" })
    .select("id")
    .single();
  if (profileErr) throw new Error(`applicant_profiles upsert failed: ${profileErr.message}`);
  const applicantId = profileData.id;
  console.log(`✅ applicant_profiles upserted id=${applicantId}`);

  // ── 3. applications (single canonical DS-160 app per applicant) ──────────
  // Upsert by lookup-then-insert pattern: applications table has no natural
  // unique key for (applicant_id, visa_type), so check first then insert.
  const { data: existingApp, error: existingAppErr } = await supabase
    .from("applications")
    .select("id")
    .eq("applicant_id", applicantId)
    .eq("visa_type", "DS160")
    .maybeSingle();
  if (existingAppErr) throw new Error(`applications lookup failed: ${existingAppErr.message}`);

  let applicationId: string;
  if (existingApp) {
    applicationId = existingApp.id;
    console.log(`↻ applications row already exists — reusing id=${applicationId}`);
  } else {
    const { data: newApp, error: newAppErr } = await supabase
      .from("applications")
      .insert({
        applicant_id: applicantId,
        country: "united_states",
        visa_type: "DS160",
        status: "draft",
        purpose: "B1-B2",
      })
      .select("id")
      .single();
    if (newAppErr) throw new Error(`applications insert failed: ${newAppErr.message}`);
    applicationId = newApp.id;
    console.log(`✅ applications row inserted id=${applicationId}`);
  }

  // ── 4. visa_application_answers (167 rows, upsert on (app_id, field_name)) ─
  const answerRows = Object.entries(TEST_DS160_ANSWERS).map(([fieldName, value]) => ({
    application_id: applicationId,
    field_name: fieldName,
    value_text: value,
  }));

  const BATCH = 100;
  let written = 0;
  for (let i = 0; i < answerRows.length; i += BATCH) {
    const batch = answerRows.slice(i, i + BATCH);
    const { error } = await supabase
      .from("visa_application_answers")
      .upsert(batch, { onConflict: "application_id,field_name" });
    if (error) throw new Error(`visa_application_answers upsert failed: ${error.message}`);
    written += batch.length;
  }
  console.log(`✅ visa_application_answers upserted: ${written} rows`);

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log("\n────────────────────────────────────────");
  console.log(`Test fixture ready.`);
  console.log(`  auth email:      ${TEST_EMAIL}`);
  console.log(`  auth password:   ${password}`);
  console.log(`  auth_user_id:    ${authUserId}`);
  console.log(`  applicant_id:    ${applicantId}`);
  console.log(`  application_id:  ${applicationId}`);
  console.log("────────────────────────────────────────");
  console.log(`\nRun the e2e against this fixture:`);
  console.log(`  CEAC_TEST_APPLICATION_ID=${applicationId} npx tsx src/ceac/_e2e.ts`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

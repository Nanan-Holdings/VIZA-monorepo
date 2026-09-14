import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { encryptSecret } from "../../secret-cipher";
import type { USAppointmentJobRow } from "../runner";

process.env.SUPABASE_URL ??= "http://127.0.0.1:1";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-key";
process.env.SUBMISSION_RESULT_SECRET_KEY = "registration-test-cipher-key-only";

const job: USAppointmentJobRow = {
  id: "job-1", application_id: "application-1", user_id: "user-1",
  appointment_account_id: "account-1", applying_country_code: "CN",
  applying_post_city: "Beijing", scheduling_provider: "usvisascheduling",
  status: "appointment_account_required", mode: "assisted_live",
  user_preferences_json: null, requires_user_action: false,
  current_manual_action: null, updated_at: null,
};

test("stored registration credentials are decrypted and bound to account, application, and user", async () => {
  const { SupabaseUSAppointmentRunnerRepository } = await import("../supabase-repository");
  const password = "VizaUS-Test9!";
  const encrypted = encryptSecret(password);
  const db = createClient("http://127.0.0.1:1", "test-key", { global: { fetch: async (input, init) => {
    assert.equal(init?.method, "GET");
    const url = new URL(String(input));
    const row = url.pathname.endsWith("appointment_accounts") ? (() => {
      assert.equal(url.searchParams.get("id"), "eq.account-1");
      assert.equal(url.searchParams.get("user_id"), "eq.user-1");
      assert.equal(url.searchParams.get("application_id"), "eq.application-1");
      assert.equal(url.searchParams.get("portal"), "eq.usvisascheduling");
      return { account_email: "appl-test@viza.it.com", encrypted_account_password: encrypted, account_status: "account_creation_started", email_verified: false };
    })() : url.pathname.endsWith("applications")
      ? { applicant_id: "applicant-1" }
      : { given_names_en: "TEST GIVEN", surname_en: "TEST SURNAME" };
    return Response.json([row]);
  } } });
  const repository = new SupabaseUSAppointmentRunnerRepository(db);
  const credentials = await repository.getAppointmentAccountCredentials(job);
  assert.deepEqual(credentials, {
    email: "appl-test@viza.it.com", password, accountStatus: "account_creation_started",
    emailVerified: false, givenName: "TEST GIVEN", surname: "TEST SURNAME",
  });
});

test("registration result cannot update an unrelated account or silently accept zero matched rows", async () => {
  const { SupabaseUSAppointmentRunnerRepository } = await import("../supabase-repository");
  let writes = 0;
  const db = createClient("http://127.0.0.1:1", "test-key", { global: { fetch: async (input, init) => {
    writes += 1;
    assert.equal(init?.method, "PATCH");
    const url = new URL(String(input));
    for (const [key, value] of Object.entries({ id: "account-1", application_id: "application-1", user_id: "user-1", portal: "usvisascheduling", account_email: "appl-test@viza.it.com" })) {
      assert.equal(url.searchParams.get(key), `eq.${value}`);
    }
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    assert.equal(body.account_status, "active");
    assert.equal(body.email_verified, true);
    assert.equal("encrypted_account_password" in body, false);
    return Response.json([]);
  } } });
  const repository = new SupabaseUSAppointmentRunnerRepository(db);
  const proof = { emailVerified: true, accountCreated: true, accountEmail: "appl-test@viza.it.com" } as const;
  await assert.rejects(repository.markAppointmentAccountVerified({ ...job, appointment_account_id: null }, proof), /exact account binding/);
  assert.equal(writes, 0);
  await assert.rejects(repository.markAppointmentAccountVerified(job, proof), /did not match/);
  assert.equal(writes, 1);
});

test("plaintext official credentials are rejected without returning them", async () => {
  const { SupabaseUSAppointmentRunnerRepository } = await import("../supabase-repository");
  const db = createClient("http://127.0.0.1:1", "test-key", { global: { fetch: async () => Response.json([
    { account_email: "appl-test@viza.it.com", encrypted_account_password: "plaintext-not-encrypted" },
  ]) } });
  await assert.rejects(new SupabaseUSAppointmentRunnerRepository(db).getAppointmentAccountCredentials(job), /Malformed cipher/);
});

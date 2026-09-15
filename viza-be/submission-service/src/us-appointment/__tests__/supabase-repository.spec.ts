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

test("registration submission state update keeps email unverified and preserves credentials", async () => {
  const { SupabaseUSAppointmentRunnerRepository } = await import("../supabase-repository");
  let writes = 0;
  const db = createClient("http://127.0.0.1:1", "test-key", { global: { fetch: async (input, init) => {
    writes += 1;
    assert.equal(init?.method, "PATCH");
    const url = new URL(String(input));
    assert.equal(url.searchParams.get("email_verified"), "eq.false");
    assert.match(url.searchParams.get("account_status") ?? "", /^in\.\(/);
    assert.doesNotMatch(url.searchParams.get("account_status") ?? "", /active|created,/);
    for (const [key, value] of Object.entries({ id: "account-1", application_id: "application-1", user_id: "user-1", portal: "usvisascheduling", account_email: "appl-test@viza.it.com" })) {
      assert.equal(url.searchParams.get(key), `eq.${value}`);
    }
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    assert.equal(body.account_status, "registration_submitted");
    assert.equal(body.email_verified, false);
    assert.equal("encrypted_account_password" in body, false);
    assert.equal("account_email" in body, false);
    return Response.json({ id: "account-1" });
  } } });
  const repository = new SupabaseUSAppointmentRunnerRepository(db);

  await repository.markAppointmentAccountRegistrationSubmitted(job, {
    accountEmail: "appl-test@viza.it.com",
  });
  assert.equal(writes, 1);
});

test("registration submission state update requires the exact account binding", async () => {
  const { SupabaseUSAppointmentRunnerRepository } = await import("../supabase-repository");
  let writes = 0;
  const db = createClient("http://127.0.0.1:1", "test-key", { global: { fetch: async (input, init) => {
    writes += 1;
    assert.equal(init?.method, "PATCH");
    return Response.json([]);
  } } });
  const repository = new SupabaseUSAppointmentRunnerRepository(db);

  await assert.rejects(
    repository.markAppointmentAccountRegistrationSubmitted(
      { ...job, appointment_account_id: null },
      { accountEmail: "appl-test@viza.it.com" },
    ),
    /exact account binding/,
  );
  assert.equal(writes, 0);
  await assert.rejects(
    repository.markAppointmentAccountRegistrationSubmitted(job, { accountEmail: "wrong@example.com" }),
    /did not match/,
  );
  assert.equal(writes, 1);
});

test("plaintext official credentials are rejected without returning them", async () => {
  const { SupabaseUSAppointmentRunnerRepository } = await import("../supabase-repository");
  const db = createClient("http://127.0.0.1:1", "test-key", { global: { fetch: async () => Response.json([
    { account_email: "appl-test@viza.it.com", encrypted_account_password: "plaintext-not-encrypted" },
  ]) } });
  await assert.rejects(new SupabaseUSAppointmentRunnerRepository(db).getAppointmentAccountCredentials(job), /Malformed cipher/);
});

test("applicant details are built from the active verified account and exact owned US application", async () => {
  const { SupabaseUSAppointmentRunnerRepository } = await import("../supabase-repository");
  const requests: string[] = [];
  const profile = {
    id: "applicant-1",
    auth_user_id: "user-1",
    surname_en: "TEST SURNAME",
    given_names_en: "TEST GIVEN",
    birth_country: "CN",
    date_of_birth: "1990-01-02",
    passport_number: "E12345678",
    passport_issue_date: "2020-01-01",
    passport_expiry_date: "2030-01-01",
    nationality: "CHN",
    gender: "M",
    email: "profile-email@example.com",
    phone: "+8613800000000",
  };
  const db = createClient("http://127.0.0.1:1", "test-key", { global: { fetch: async (input, init) => {
    assert.equal(init?.method, "GET");
    const url = new URL(String(input));
    requests.push(url.pathname);
    if (url.pathname.endsWith("appointment_accounts")) {
      assert.equal(url.searchParams.get("id"), "eq.account-1");
      assert.equal(url.searchParams.get("application_id"), "eq.application-1");
      assert.equal(url.searchParams.get("user_id"), "eq.user-1");
      assert.equal(url.searchParams.get("portal"), "eq.usvisascheduling");
      assert.equal(url.searchParams.get("account_status"), "eq.active");
      assert.equal(url.searchParams.get("email_verified"), "eq.true");
      return Response.json([{ id: "account-1", application_id: "application-1", user_id: "user-1", portal: "usvisascheduling", account_email: "managed-alias@example.com", account_status: "active", email_verified: true }]);
    }
    if (url.pathname.endsWith("applications")) {
      assert.equal(url.searchParams.get("id"), "eq.application-1");
      return Response.json([{ id: "application-1", applicant_id: "applicant-1", country: "united_states" }]);
    }
    if (url.pathname.endsWith("applicant_profiles")) {
      assert.equal(url.searchParams.get("id"), "eq.applicant-1");
      assert.equal(url.searchParams.get("auth_user_id"), "eq.user-1");
      const selected = url.searchParams.get("select") ?? "";
      assert.match(selected, /given_names_en/);
      assert.match(selected, /surname_en/);
      assert.match(selected, /passport_expiry_date/);
      assert.doesNotMatch(selected, /full_name|occupation|wechat|passport_issuing_authority/);
      return Response.json([profile]);
    }
    assert.match(url.pathname, /visa_application_answers$/);
    assert.equal(url.searchParams.get("application_id"), "eq.application-1");
    return Response.json([
      { application_id: "other-application", field_name: "surname", value_text: "OTHER", value_json: null },
      { application_id: "application-1", field_name: "surname", value_text: "TEST SURNAME", value_json: null },
      { application_id: "application-1", field_name: "mobile_phone", value_text: "13800000000", value_json: null },
      { application_id: "application-1", field_name: "passport_place_of_issue", value_text: "Beijing", value_json: null },
      { application_id: "application-1", field_name: "mailing_same_as_home", value_text: "yes", value_json: null },
      { application_id: "application-1", field_name: "home_address_line1", value_text: "1 Test Road", value_json: null },
      { application_id: "application-1", field_name: "home_address_city", value_text: "Beijing", value_json: null },
      { application_id: "application-1", field_name: "home_address_state_province", value_text: "Beijing", value_json: null },
      { application_id: "application-1", field_name: "home_address_postal_code", value_text: "100000", value_json: null },
      { application_id: "application-1", field_name: "national_id_number", value_text: "110101199001020011", value_json: null },
    ]);
  } } });
  const repository = new SupabaseUSAppointmentRunnerRepository(db);
  const result = await repository.getAppointmentApplicantDetails({
    ...job,
    user_preferences_json: {
      applicant_details: { mobile_phone_country_code: "+86" },
    },
  });

  assert.equal(result.state, "ready");
  if (result.state !== "ready") throw new Error("expected applicant details to be ready");
  assert.equal(result.data.email, "managed-alias@example.com");
  assert.deepEqual(result.data.mobilePhone, { callingCode: "+86", nationalNumber: "13800000000" });
  assert.equal(result.data.lastName, "TEST SURNAME");
  assert.equal(requests.length, 4);
  assert.equal(JSON.stringify(result).includes("managed-alias@example.com"), true);
  assert.equal(JSON.stringify(result).includes("OTHER"), false);
});

test("applicant detail lookup fails closed on profile ownership mismatch without reading answers", async () => {
  const { SupabaseUSAppointmentRunnerRepository } = await import("../supabase-repository");
  let answerReads = 0;
  const db = createClient("http://127.0.0.1:1", "test-key", { global: { fetch: async (input, init) => {
    assert.equal(init?.method, "GET");
    const url = new URL(String(input));
    if (url.pathname.endsWith("appointment_accounts")) {
      return Response.json([{ account_email: "managed-alias@example.com", account_status: "active", email_verified: true }]);
    }
    if (url.pathname.endsWith("applications")) {
      return Response.json([{ id: "application-1", applicant_id: "applicant-1", country: "united_states" }]);
    }
    if (url.pathname.endsWith("applicant_profiles")) {
      return Response.json([{ id: "applicant-1", auth_user_id: "other-user", given_names_en: "OTHER", surname_en: "OWNER" }]);
    }
    answerReads += 1;
    return Response.json([{ application_id: "application-1", field_name: "surname", value_text: "SHOULD NOT READ" }]);
  } } });
  const repository = new SupabaseUSAppointmentRunnerRepository(db);

  await assert.rejects(
    repository.getAppointmentApplicantDetails(job),
    (error: unknown) => {
      assert(error instanceof Error);
      assert.equal(error.message, "US appointment applicant details lookup failed.");
      assert.doesNotMatch(error.message, /applicant-1|user-1|SHOULD NOT READ/);
      return true;
    },
  );
  assert.equal(answerReads, 0);
});

test("applicant detail lookup rejects an unverified or pending account before application reads", async () => {
  const { SupabaseUSAppointmentRunnerRepository } = await import("../supabase-repository");
  let applicationReads = 0;
  const db = createClient("http://127.0.0.1:1", "test-key", { global: { fetch: async (input, init) => {
    assert.equal(init?.method, "GET");
    const url = new URL(String(input));
    if (url.pathname.endsWith("appointment_accounts")) {
      return Response.json([{ account_email: "managed-alias@example.com", account_status: "registration_submitted", email_verified: false }]);
    }
    applicationReads += 1;
    return Response.json([{ id: "application-1", applicant_id: "applicant-1", country: "united_states" }]);
  } } });
  const repository = new SupabaseUSAppointmentRunnerRepository(db);

  await assert.rejects(
    repository.getAppointmentApplicantDetails(job),
    /US appointment applicant details lookup failed\./,
  );
  assert.equal(applicationReads, 0);
});

test("applicant detail database errors are redacted and fail closed", async () => {
  const { SupabaseUSAppointmentRunnerRepository } = await import("../supabase-repository");
  let followUpReads = 0;
  const db = createClient("http://127.0.0.1:1", "test-key", { global: { fetch: async (input, init) => {
    assert.equal(init?.method, "GET");
    const url = new URL(String(input));
    if (url.pathname.endsWith("appointment_accounts")) {
      return Response.json({ code: "PGRST000", message: "private account binding diagnostic" }, { status: 500 });
    }
    followUpReads += 1;
    return Response.json([]);
  } } });
  const repository = new SupabaseUSAppointmentRunnerRepository(db);

  await assert.rejects(
    repository.getAppointmentApplicantDetails(job),
    (error: unknown) => {
      assert(error instanceof Error);
      assert.equal(error.message, "US appointment applicant details lookup failed.");
      assert.doesNotMatch(error.message, /private account binding diagnostic/);
      return true;
    },
  );
  assert.equal(followUpReads, 0);
});

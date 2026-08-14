import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolve } from "node:path";
import {
  buildShenyangUniversalProfileAnswers,
  requireShenyangVfsApplicantDetails,
  requireShenyangVfsApplicantDetailsFromSources,
} from "./applicant-details.js";

const NOW = new Date("2026-08-14T02:00:00.000Z");
const INVALID_MESSAGE = "The Shenyang VFS applicant details are incomplete or invalid.";

test("normalizes aliases and canonical answers into typed applicant details", () => {
  const details = requireShenyangVfsApplicantDetails({
    surname_en: "  Zhang  ",
    given_names: " Wei Li ",
    dob: "1990-01-02",
    travel_document_number: " e1234567 ",
    valid_until: "2030-12-31",
    booker_phone: " 138-0013-8000 ",
  }, NOW);

  assert.deepEqual(details, {
    surname: "Zhang",
    givenNames: "Wei Li",
    dateOfBirth: "1990-01-02",
    passportNumber: "E1234567",
    passportExpiryDate: "2030-12-31",
    mobilePhone: "13800138000",
  });
});

test("throws one generic error when a required value is absent", () => {
  assert.throws(
    () => requireShenyangVfsApplicantDetails({
      surname: "Zhang",
      given_names: "Wei Li",
      date_of_birth: "1990-01-02",
      passport_number: "E1234567",
      passport_expiry_date: "2030-12-31",
    }, NOW),
    (error: unknown) => error instanceof Error && error.message === INVALID_MESSAGE,
  );
});

test("rejects CJK or invalid names, impossible or future DOB, invalid passport, and malformed phone", () => {
  const cases: Record<string, string> = {
    cjkName: "张",
    punctuationName: "Zhang/Wei",
    impossibleDob: "1990-02-30",
    futureDob: "2026-08-15",
    invalidPassport: "E123-4567",
    malformedPhone: "1380013800A",
  };

  for (const [name, value] of Object.entries(cases)) {
    const answers: Record<string, string> = {
      surname: "Zhang",
      given_names: "Wei Li",
      date_of_birth: "1990-01-02",
      passport_number: "E1234567",
      passport_expiry_date: "2030-12-31",
      phone: "13800138000",
    };
    if (name === "cjkName" || name === "punctuationName") answers.surname = value;
    if (name === "impossibleDob" || name === "futureDob") answers.date_of_birth = value;
    if (name === "invalidPassport") answers.passport_number = value;
    if (name === "malformedPhone") answers.phone = value;

    assert.throws(
      () => requireShenyangVfsApplicantDetails(answers, NOW),
      (error: unknown) => error instanceof Error && error.message === INVALID_MESSAGE,
      name,
    );
  }
});

test("rejects expired and same-day expiry dates", () => {
  for (const expiry of ["2026-08-13", "2026-08-14"]) {
    assert.throws(
      () => requireShenyangVfsApplicantDetails({
        surname: "Zhang",
        given_names: "Wei Li",
        date_of_birth: "1990-01-02",
        passport_number: "E1234567",
        passport_expiry_date: expiry,
        phone: "13800138000",
      }, NOW),
      (error: unknown) => error instanceof Error && error.message === INVALID_MESSAGE,
      expiry,
    );
  }
});

test("accepts formatted +86 phone and a future expiry at a deterministic now boundary", () => {
  const details = requireShenyangVfsApplicantDetails({
    family_name_en: "O'Neil",
    first_name: "Anne-Marie",
    birth_date: "2000-08-14",
    passport_no: "ab12345",
    passport_date_of_expiry: "2026-08-15",
    primary_phone_number: "+86 (138) 0013-8000",
  }, NOW);

  assert.equal(details.mobilePhone, "13800138000");
  assert.equal(details.passportExpiryDate, "2026-08-15");
});

test("matches frontend mainland-phone normalization for Unicode whitespace and placement", () => {
  for (const phone of ["+86\u00A0138-0013-8000", "86(138)0013-8000"]) {
    const details = requireShenyangVfsApplicantDetails({
      surname: "Zhang",
      given_names: "Wei Li",
      date_of_birth: "1990-01-02",
      passport_number: "E1234567",
      passport_expiry_date: "2030-12-31",
      phone,
    }, NOW);

    assert.equal(details.mobilePhone, "13800138000", phone);
  }
});

test("fills the first visible matching field and rejects a collection with no visible match", async () => {
  process.env.SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  const { fillFirstVisibleShenyangApplicantField } = await import("./runner.js");

  const firstHidden = [{ visible: false, value: "" }, { visible: true, value: "" }];
  const matchingFields = {
    count: async () => firstHidden.length,
    nth: (index: number) => ({
      isVisible: async () => firstHidden[index].visible,
      fill: async (value: string) => { firstHidden[index].value = value; },
    }),
  };
  await fillFirstVisibleShenyangApplicantField(matchingFields, "Zhang");
  assert.equal(firstHidden[0].value, "");
  assert.equal(firstHidden[1].value, "Zhang");

  const hiddenOnly = {
    count: async () => 2,
    nth: () => ({
      isVisible: async () => false,
      fill: async () => undefined,
    }),
  };
  await assert.rejects(
    () => fillFirstVisibleShenyangApplicantField(hiddenOnly, "Zhang"),
    (error: unknown) => error instanceof Error
      && error.message === "The official Shenyang VFS applicant detail fields could not be identified.",
  );
});

test("gates both public Shenyang entry points before account and browser work", async () => {
  const source = await readFile(resolve(process.cwd(), "src/korea-vfs-shenyang/runner.ts"), "utf8");
  for (const functionName of ["startShenyangVfsBookingFlow", "bookShenyangVfsSlot"]) {
    const signature = `export async function ${functionName}`;
    const start = source.indexOf(signature);
    assert.notEqual(start, -1, `${functionName} should remain public`);
    const nextExport = source.indexOf("\nexport async function", start + signature.length);
    const body = source.slice(start, nextExport === -1 ? source.length : nextExport);
    const requiredDetailsGate = body.indexOf("loadRequiredShenyangVfsApplicantDetails");
    const accountLoad = body.indexOf("loadPortalAccount");
    const browserConnect = body.indexOf("connectBrowserbaseCloudBrowser");
    assert.ok(requiredDetailsGate >= 0, `${functionName} must invoke the required-details gate`);
    assert.ok(accountLoad >= 0 && requiredDetailsGate < accountLoad, `${functionName} must gate before account work`);
    assert.ok(browserConnect >= 0 && requiredDetailsGate < browserConnect, `${functionName} must gate before browser work`);
  }

  const accountStart = source.indexOf("async function loadPortalAccount");
  const accountEnd = source.indexOf("\nasync function loadRequiredShenyangVfsApplicantDetails", accountStart);
  const accountBody = source.slice(accountStart, accountEnd === -1 ? source.length : accountEnd);
  assert.match(accountBody, /mobilePhone:\s*string/u);
  assert.match(accountBody, /mainlandPhone\(mobilePhone\)/u);
  assert.doesNotMatch(accountBody, /profile\.phone/u);

  for (const functionName of ["startShenyangVfsBookingFlow", "bookShenyangVfsSlot"]) {
    const signature = `export async function ${functionName}`;
    const start = source.indexOf(signature);
    const nextExport = source.indexOf("\nexport async function", start + signature.length);
    const body = source.slice(start, nextExport === -1 ? source.length : nextExport);
    assert.match(body, /const applicantDetails = await loadRequiredShenyangVfsApplicantDetails/u);
    assert.match(body, /loadPortalAccount\(input\.applicationId, applicantDetails\.mobilePhone\)/u);
  }

  const loaderStart = source.indexOf("async function loadRequiredShenyangVfsApplicantDetails");
  const loaderEnd = source.indexOf("\nasync function setAccountStatus", loaderStart);
  const loaderBody = source.slice(loaderStart, loaderEnd === -1 ? source.length : loaderEnd);
  assert.match(loaderBody, /from\("universal_profile_answers"\)/u);
  assert.match(loaderBody, /\.eq\("applicant_id", application\.applicant_id\)/u);
  assert.match(loaderBody, /\.order\("updated_at", \{ ascending: false \}\)/u);
  assert.match(loaderBody, /isMissingShenyangUniversalProfileSchemaError/u);
});

test("prefers confirmed canonical fields when stale aliases are invalid", () => {
  const details = requireShenyangVfsApplicantDetails({
    surname_en: "张",
    surname: "Zhang",
    given_names_en: "张三",
    given_names: "Wei Li",
    date_of_birth: "1990-01-02",
    dob: "not-a-date",
    passport_number: "E1234567",
    passport_no: "E123-4567",
    passport_expiry_date: "2030-12-31",
    valid_until: "not-a-date",
    mobile_phone: "13800138000",
    phone: "not-a-phone",
  }, NOW);

  assert.deepEqual(details, {
    surname: "Zhang",
    givenNames: "Wei Li",
    dateOfBirth: "1990-01-02",
    passportNumber: "E1234567",
    passportExpiryDate: "2030-12-31",
    mobilePhone: "13800138000",
  });
});

test("prefers a valid current-application alias over a profile fallback", () => {
  const details = requireShenyangVfsApplicantDetailsFromSources({
    surname_en: "Application",
    given_names_en: "Current",
  }, {
    surname: "Profile",
    given_names: "Fallback",
    date_of_birth: "1990-01-02",
    passport_number: "E1234567",
    passport_expiry_date: "2030-12-31",
    mobile_phone: "13800138000",
  }, NOW);

  assert.equal(details.surname, "Application");
  assert.equal(details.givenNames, "Current");
});

test("prefers fresh canonical application values over stale invalid aliases", () => {
  const details = requireShenyangVfsApplicantDetailsFromSources({
    surname_en: "张",
    surname: "Confirmed",
    given_names_en: "张三",
    given_names: "Fresh Values",
    date_of_birth: "1990-01-02",
    passport_number: "E1234567",
    passport_expiry_date: "2030-12-31",
    mobile_phone: "13800138000",
  }, {
    surname: "Profile",
    given_names: "Fallback",
  }, NOW);

  assert.equal(details.surname, "Confirmed");
  assert.equal(details.givenNames, "Fresh Values");
});

test("falls back to profile values when the application has no usable aliases", () => {
  const details = requireShenyangVfsApplicantDetailsFromSources({}, {
    surname: "Profile",
    given_names: "Fallback",
    date_of_birth: "1990-01-02",
    passport_number: "E1234567",
    passport_expiry_date: "2030-12-31",
    mobile_phone: "13800138000",
  }, NOW);

  assert.deepEqual(details, {
    surname: "Profile",
    givenNames: "Fallback",
    dateOfBirth: "1990-01-02",
    passportNumber: "E1234567",
    passportExpiryDate: "2030-12-31",
    mobilePhone: "13800138000",
  });
});

test("uses reusable universal answers for a legacy application without current answers", () => {
  const reusable = buildShenyangUniversalProfileAnswers([
    { canonical_key: "surname", value_text: "Reusable", updated_at: "2026-08-13T00:00:00.000Z" },
    { canonical_key: "given_names", value_text: "Applicant", updated_at: "2026-08-13T00:00:00.000Z" },
    { canonical_key: "date_of_birth", value_text: "1990-01-02", updated_at: "2026-08-13T00:00:00.000Z" },
    { canonical_key: "passport_number", value_text: "E1234567", updated_at: "2026-08-13T00:00:00.000Z" },
    { canonical_key: "passport_expiry_date", value_text: "2030-12-31", updated_at: "2026-08-13T00:00:00.000Z" },
    { canonical_key: "phone", value_text: "13800138000", updated_at: "2026-08-13T00:00:00.000Z" },
  ]);

  const details = requireShenyangVfsApplicantDetailsFromSources({}, reusable, NOW);
  assert.equal(details.surname, "Reusable");
  assert.equal(details.mobilePhone, "13800138000");
});

test("current application answers override reusable universal answers", () => {
  const reusable = buildShenyangUniversalProfileAnswers([
    { canonical_key: "surname", value_text: "Reusable", updated_at: "2026-08-13T00:00:00.000Z" },
    { canonical_key: "given_names", value_text: "Applicant", updated_at: "2026-08-13T00:00:00.000Z" },
    { canonical_key: "date_of_birth", value_text: "1990-01-02", updated_at: "2026-08-13T00:00:00.000Z" },
    { canonical_key: "passport_number", value_text: "E1234567", updated_at: "2026-08-13T00:00:00.000Z" },
    { canonical_key: "passport_expiry_date", value_text: "2030-12-31", updated_at: "2026-08-13T00:00:00.000Z" },
    { canonical_key: "phone", value_text: "13800138000", updated_at: "2026-08-13T00:00:00.000Z" },
  ]);

  const details = requireShenyangVfsApplicantDetailsFromSources({ surname: "Current" }, reusable, NOW);
  assert.equal(details.surname, "Current");
});

test("keeps the newest reusable answer when canonical rows are duplicated", () => {
  const reusable = buildShenyangUniversalProfileAnswers([
    { canonical_key: "surname", value_text: "Older", updated_at: "2026-08-12T00:00:00.000Z" },
    { canonical_key: "surname", value_text: "Newest", updated_at: "2026-08-14T00:00:00.000Z" },
  ]);

  assert.equal(reusable.surname, "Newest");
});

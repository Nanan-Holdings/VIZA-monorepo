import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import {
  SA_REQUIRED_ANSWER_KEYS,
  missingRequired,
  missingSaDocuments,
  normalizeSaAnswers,
  normalizeSaPassportType,
  saOfficialPassportTypeLabel,
  toSaDate,
} from "../field-mappings.js";

const SA_SEED_SOURCE = readFileSync(
  path.join(process.cwd(), "../agent-backend/scripts/seed-sa-e-visa-form-fields.ts"),
  "utf8",
);

const COMPLETE: Record<string, string> = {
  nationality: "China",
  given_name: "EDWARD",
  father_name: "FATHER",
  family_name: "ZHANG",
  gender: "male",
  date_of_birth: "1990-04-15",
  country_of_birth: "China",
  city_of_birth: "Shanghai",
  religion: "None",
  marital_status: "Single",
  profession: "Engineer",
  applicant_is_minor: "no",
  passport_type: "regular",
  passport_number: "E12345678",
  passport_issuing_country: "China",
  passport_issue_place: "Shanghai",
  passport_issue_date: "2020-01-01",
  passport_expiry_date: "2030-01-01",
  residence_country: "Singapore",
  residence_city: "Singapore",
  residence_address: "Example address",
  visa_email: "example@example.com",
  phone_country_code: "+65",
  phone_number: "81234567",
  has_whatsapp: "no",
  purpose_of_visit: "Tourism",
  accommodation_type: "hotel",
  hotel_name: "Example Hotel",
  hotel_address: "Example hotel address",
  hotel_city: "Riyadh",
};

test("sa contract normalizes established profile aliases without inventing authenticated values", () => {
  const normalized = normalizeSaAnswers({
    given_names: "EDWARD",
    surname: "ZHANG",
    passport_place_of_issue: "Shanghai",
    email: "example@example.com",
  });
  assert.equal(normalized.given_name, "EDWARD");
  assert.equal(normalized.family_name, "ZHANG");
  assert.equal(normalized.passport_issue_place, "Shanghai");
  assert.equal(normalized.visa_email, "example@example.com");
  assert.equal(normalized.father_name, undefined);
});

test("sa contract enforces conditional accommodation, guardian, and WhatsApp branches", () => {
  assert.deepEqual(missingRequired(COMPLETE), []);
  assert.ok(missingRequired({ ...COMPLETE, accommodation_type: "residence" }).includes("private_residence_address"));
  assert.ok(missingRequired({ ...COMPLETE, applicant_is_minor: "yes" }).includes("guardian_full_name"));
  assert.ok(missingRequired({ ...COMPLETE, has_whatsapp: "yes" }).includes("whatsapp_number"));
});

test("sa passport type is required, truthful, and maps only explicit ordinary aliases", () => {
  assert.equal(normalizeSaPassportType("Regular Passport"), "regular");
  assert.equal(normalizeSaPassportType("ordinary"), "regular");
  assert.equal(saOfficialPassportTypeLabel("regular"), "Regular Passport");
  assert.equal(normalizeSaPassportType("diplomatic"), "");
  assert.equal(saOfficialPassportTypeLabel("diplomatic"), null);
  assert.ok(missingRequired({ ...COMPLETE, passport_type: "" }).includes("passport_type"));
  assert.ok(missingRequired({ ...COMPLETE, passport_type: "Diplomatic" }).includes("passport_type"));
});

test("sa documents and dates follow the active schema", () => {
  assert.deepEqual(missingSaDocuments([]), ["personal_photo", "passport_bio_page"]);
  assert.deepEqual(missingSaDocuments(["personal_photo", "passport_bio_page"]), []);
  assert.equal(toSaDate("1990-04-15"), "15/04/1990");
  assert.equal(toSaDate("bad"), "bad");
});

test("sa answer contract stays in parity with the seed and excludes workflow gates", () => {
  for (const key of SA_REQUIRED_ANSWER_KEYS) {
    assert.match(SA_SEED_SOURCE, new RegExp(`field_name:\\s*"${key}"`));
  }
  for (const key of [
    "guardian_full_name",
    "guardian_relationship",
    "whatsapp_country_code",
    "whatsapp_number",
    "hotel_name",
    "hotel_address",
    "hotel_city",
    "private_residence_address",
    "private_residence_city",
    "private_residence_name",
  ]) {
    assert.match(SA_SEED_SOURCE, new RegExp(`field_name:\\s*"${key}"`));
  }
  for (const workflowOnly of [
    "privacy_consent",
    "portal_username",
    "portal_password",
    "account_activation",
    "captcha_answer",
    "payment_authorization",
  ]) {
    assert.doesNotMatch(SA_SEED_SOURCE, new RegExp(`field_name:\\s*"${workflowOnly}"`));
  }
});

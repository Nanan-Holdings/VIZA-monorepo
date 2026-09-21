import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, it } from "node:test";
import { ds160ConditionMatches } from "../ds160-conditions";
import { DS160_FIELD_CONTRACTS } from "../ds160-field-contract";
import { readDs160SeedFields } from "../ds160-parity";
import { DS160_REPEAT_GROUP_CONTRACTS } from "../ds160-repeat-contract";
import { CEAC_DS160_LOCATION_OPTIONS } from "../ceac/start-location-options";

const seedPath = path.resolve(__dirname, "../../../agent-backend/scripts/seed-ds160-form-fields.ts");
const migrationPath = path.resolve(__dirname, "../../../agent-backend/drizzle/0201_ds160_remaining_live_parity.sql");
const migrationDirectory = path.dirname(migrationPath);
const frontendMigrationPath = path.resolve(__dirname, "../../../..", "viza-fe/internal-website/supabase/migrations/20260921050000_ds160_remaining_live_parity.sql");
const consularPostsPath = path.resolve(__dirname, "../../../agent-backend/scripts/ds160-consular-posts.ts");

function declaration(source: string, fieldName: string): string {
  const start = source.indexOf(`field_name: "${fieldName}"`);
  const end = source.indexOf("\n  },", start);
  assert.ok(start >= 0 && end > start, `missing seed declaration for ${fieldName}`);
  return source.slice(start, end);
}

function fnv1a32(value: string): string {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function migrationCaseAssignments(sql: string, assignment: "step_number" | "display_order") {
  const start = sql.indexOf(`${assignment} = CASE field_name`);
  assert.ok(start >= 0, `missing ${assignment} CASE`);
  const end = sql.indexOf("\n  END,", start);
  assert.ok(end > start, `unterminated ${assignment} CASE`);
  return [...sql.slice(start, end).matchAll(/WHEN '([^']+)' THEN (\d+)/g)].map((match) => ({
    fieldName: match[1],
    value: Number(match[2]),
  }));
}

describe("DS-160 remaining live branch contract", () => {
  it("keeps all 217 live CEAC consular posts with bilingual labels", () => {
    const source = readFileSync(seedPath, "utf8");
    const postsSource = readFileSync(consularPostsPath, "utf8");
    const postsStart = postsSource.indexOf("export const DS160_CONSULAR_POSTS");
    const arrayStart = postsSource.indexOf("= [", postsStart) + 2;
    const arrayEnd = postsSource.indexOf("] as const", arrayStart);
    assert.ok(postsStart >= 0 && arrayStart > postsStart && arrayEnd > arrayStart);
    const bilingualPosts = JSON.parse(postsSource.slice(arrayStart, arrayEnd + 1)) as Array<{
      code: string;
      official: string;
      labelZh: string;
    }>;
    const livePosts = CEAC_DS160_LOCATION_OPTIONS.map(([code, official]) => [code, official] as const);
    assert.equal(bilingualPosts.length, 217);
    assert.equal(new Set(bilingualPosts.map((post) => post.code)).size, 217);
    assert.equal(
      fnv1a32(JSON.stringify(livePosts.slice().sort(([left], [right]) => left.localeCompare(right)))),
      "ef538b6f",
    );
    for (const post of bilingualPosts) {
      assert.match(post.labelZh, /^[^A-Za-z()（）]+，[^A-Za-z()（）]+$/u, post.code);
    }
    assert.match(source, /options: DS160_CONSULAR_POSTS\.map/);
  });

  it("requires the proven Passport, family, contact, work, and additional branches", () => {
    const source = readFileSync(seedPath, "utf8");
    const required = [
      "passport_book_number", "passport_issuance_city", "lost_passport_number",
      "lost_passport_country", "lost_passport_explain", "partner_surname",
      "partner_given_names", "partner_date_of_birth", "partner_nationality",
      "partner_city_of_birth", "partner_country_of_birth", "partner_address_type",
      "partner_address_street1", "partner_address_city", "partner_address_state",
      "partner_address_zip", "partner_address_country", "deceased_spouse_surname",
      "deceased_spouse_given_names", "deceased_spouse_date_of_birth",
      "deceased_spouse_nationality", "deceased_spouse_city_of_birth",
      "deceased_spouse_country_of_birth", "number_of_former_spouses",
      "former_spouse_surname", "former_spouse_given_names", "former_spouse_date_of_birth",
      "former_spouse_nationality", "former_spouse_city_of_birth",
      "former_spouse_country_of_birth", "former_spouse_date_of_marriage",
      "former_spouse_date_marriage_ended", "former_spouse_how_marriage_ended",
      "former_spouse_country_marriage_terminated", "us_contact_surname",
      "us_contact_given_names", "us_contact_organization", "us_contact_address_street1",
      "us_contact_city", "us_contact_phone", "us_contact_email", "occupation_other_explain",
      "us_relative_surname", "us_relative_given_names", "us_relative_relationship", "us_relative_status",
      "vwp_denial_explain",
      "employer_name", "employer_address_line1", "employer_city", "employer_state_province",
      "employer_postal_code", "employer_country", "employer_phone", "employment_start_date",
      "job_duties", "prev_employer_name", "prev_employer_address_street1", "prev_employer_city",
      "prev_employer_state", "prev_employer_postal", "prev_employer_country", "prev_employer_phone",
      "prev_job_title", "prev_supervisor_surname", "prev_supervisor_given_names",
      "prev_employment_start_date", "prev_employment_end_date", "prev_job_duties",
      "education_institution_name", "education_address_line1", "education_city",
      "education_state_province", "education_postal_code", "education_country",
      "education_course_of_study", "education_start_date", "education_end_date",
      "clan_tribe_name", "traveled_country", "organization_name", "specialized_skills_explain",
      "military_country", "military_branch", "military_rank", "military_specialty",
      "military_date_from", "military_date_to", "paramilitary_explain",
    ];
    for (const fieldName of required) {
      assert.equal(DS160_FIELD_CONTRACTS[fieldName].required, true, fieldName);
      assert.match(declaration(source, fieldName), /required: true/);
    }

    assert.equal(DS160_FIELD_CONTRACTS.us_contact_zip.required, false);
    assert.match(declaration(source, "us_contact_zip"), /required: false/);
    assert.equal(DS160_FIELD_CONTRACTS.job_title.required, false);
    assert.equal(DS160_FIELD_CONTRACTS.father_in_us.step, 9);
    assert.equal(DS160_FIELD_CONTRACTS.mother_in_us.step, 9);
    assert.equal(DS160_FIELD_CONTRACTS.has_other_us_relatives.showIf, "has_immediate_us_relatives === no");
    assert.equal(DS160_FIELD_CONTRACTS.ds160_preparer_surname.allowsDoesNotApply, true);
    assert.equal(DS160_FIELD_CONTRACTS.vwp_denial.showIf, undefined);
    assert.equal(DS160_FIELD_CONTRACTS.vwp_denial.nationalityGate, "CEAC_ESTA");
    assert.equal(DS160_FIELD_CONTRACTS.vwp_denial_explain.showIf, "vwp_denial === yes");
    assert.equal(DS160_FIELD_CONTRACTS.vwp_denial_explain.nationalityGate, "CEAC_ESTA");
    assert.equal(DS160_FIELD_CONTRACTS.vwp_denial.label, "Have you ever been denied travel authorization by the Department of Homeland Security through the Electronic System for Travel Authorization (ESTA)?");
    assert.equal(DS160_FIELD_CONTRACTS.social_media_platform.showIf, undefined);
    assert.equal(DS160_FIELD_CONTRACTS.social_media_handle.showIf, "social_media_platform !== NONE && social_media_platform !== null");
    assert.match(declaration(source, "father_in_us"), /step_number: 9/);
    assert.match(declaration(source, "father_in_us"), /display_order: 4/);
    assert.match(declaration(source, "mother_in_us"), /step_number: 9/);
    assert.match(declaration(source, "mother_in_us"), /display_order: 9/);
    assert.match(declaration(source, "has_other_us_relatives"), /has_immediate_us_relatives === no/);
    assert.match(declaration(source, "ds160_preparer_surname"), /has_does_not_apply: true/);
    assert.match(declaration(source, "vwp_denial"), /Department of Homeland Security through the Electronic System for Travel Authorization/);
    assert.match(declaration(source, "vwp_denial"), /nationality_gate: "CEAC_ESTA"/);
    assert.doesNotMatch(declaration(source, "vwp_denial"), /conditional_logic:/);
    assert.match(declaration(source, "vwp_denial_explain"), /conditional_logic: { showIf: "vwp_denial === yes" }/);
    assert.match(declaration(source, "vwp_denial_explain"), /maxLength: 4000/);
    assert.match(declaration(source, "vwp_denial_explain"), /nationality_gate: "CEAC_ESTA"/);
    assert.match(declaration(source, "vwp_denial_explain"), /label_zh: "请解释"/);
    assert.match(declaration(source, "vwp_denial_explain"), /display_order: 25/);
    assert.doesNotMatch(declaration(source, "social_media_platform"), /conditional_logic:/);
    assert.match(declaration(source, "social_media_handle"), /social_media_platform !== NONE && social_media_platform !== null/);
    assert.equal(
      ds160ConditionMatches(DS160_FIELD_CONTRACTS.us_contact_surname.showIf!, {
        has_specific_plans: "no",
        intended_length_of_stay_unit: "H",
      }),
      false,
    );
    assert.equal(
      ds160ConditionMatches(DS160_FIELD_CONTRACTS.us_contact_surname.showIf!, {
        has_specific_plans: "no",
        intended_length_of_stay_unit: "D",
      }),
      true,
    );
    assert.match(declaration(source, "us_contact_surname"), /has_specific_plans !== no \|\| intended_length_of_stay_unit !== H/);
  });


  it("keeps the official DS-160 page order for contact and family branches", () => {
    const source = readFileSync(seedPath, "utf8");
    const seedFields = readDs160SeedFields(source);
    const expectedPageSteps: Record<string, number> = {
      "US Point of Contact": 8,
      "Family Information: Relatives": 9,
      "Family Information: Spouse": 10,
      "Family Information: Partner": 10,
      "Family Information: Deceased Spouse": 10,
      "Family Information: Former Spouse": 10,
    };
    for (const [page, step] of Object.entries(expectedPageSteps)) {
      const pageFields = seedFields.filter((field) => field.page === page);
      assert.ok(pageFields.length > 0, page);
      assert.deepEqual([...new Set(pageFields.map((field) => field.step))], [step], page);
      for (const field of pageFields) {
        assert.equal(DS160_FIELD_CONTRACTS[field.name].step, step, field.name);
      }
    }
    const migration = readFileSync(migrationPath, "utf8");
    assert.match(migration, /WHEN 'us_contact_surname' THEN 8/);
    assert.match(migration, /WHEN 'father_surname' THEN 9/);
    assert.match(migration, /WHEN 'spouse_surname' THEN 10/);
    assert.match(migration, /WHEN 'vwp_denial' THEN[\s\S]*nationality_gate/);
    assert.match(migration, /WHEN 'vwp_denial' THEN NULL/);
    assert.match(migration, /WHEN 'vwp_denial_explain' THEN '\{\"showIf\":\"vwp_denial === yes\"\}'/);
    assert.match(migration, /INSERT INTO public\.visa_form_fields[\s\S]*'vwp_denial_explain'[\s\S]*ON CONFLICT \(visa_type, field_name\) DO UPDATE/);
    assert.match(migration, /\"label_zh\":\"请解释\"/);
    assert.match(migration, /WHEN 'vwp_denial' THEN 24/);
    assert.match(migration, /WHEN 'vwp_denial_explain' THEN 25/);
    assert.match(migration, /WHEN 'immigrant_petition_filed' THEN 26/);
    assert.match(migration, /WHEN 'immigrant_petition_explain' THEN 27/);
    assert.match(migration, /WHEN 'social_media_platform' THEN NULL/);
    assert.match(migration, /WHEN 'social_media_handle' THEN '\{\"showIf\":\"social_media_platform !== NONE && social_media_platform !== null\"\}'/);
  });

  it("audits every cumulative 0197-0201 SQL target against the seed contract", () => {
    const source = readFileSync(seedPath, "utf8");
    const seedFields = readDs160SeedFields(source);
    const seedNames = new Set(seedFields.map((field) => field.name));
    const migrationFiles = [
      "0197_ds160_personal_identity_required_fields.sql",
      "0198_ds160_travel_required_fields.sql",
      "0199_ds160_previous_travel_contact_required_fields.sql",
      "0200_ds160_telecode_validation.sql",
      "0201_ds160_remaining_live_parity.sql",
    ];
    const migrationTargets = new Map<string, string[]>();

    for (const fileName of migrationFiles) {
      const sql = readFileSync(path.join(migrationDirectory, fileName), "utf8");
      const targets = new Set<string>();
      for (const match of sql.matchAll(/\bWHEN\s+'([^']+)'\s+THEN/g)) targets.add(match[1]);
      for (const match of sql.matchAll(/\bfield_name\s+IN\s*\(([\s\S]*?)\)/g)) {
        for (const fieldMatch of match[1].matchAll(/'([^']+)'/g)) targets.add(fieldMatch[1]);
      }
      migrationTargets.set(fileName, [...targets].sort());
      for (const fieldName of targets) {
        assert.ok(seedNames.has(fieldName), `${fileName} targets undeclared DS-160 field ${fieldName}`);
      }
    }

    const migration = readFileSync(migrationPath, "utf8");
    assert.equal(readFileSync(frontendMigrationPath, "utf8"), migration, "frontend migration mirror drift");
    assert.match(migration, /INSERT INTO public\.visa_form_fields[\s\S]*'vwp_denial_explain'/);
    assert.match(migration, /ON CONFLICT \(visa_type, field_name\) DO UPDATE/);
    assert.ok(migrationTargets.get("0201_ds160_remaining_live_parity.sql")?.includes("vwp_denial_explain"));

    for (const assignment of ["step_number", "display_order"] as const) {
      for (const { fieldName, value } of migrationCaseAssignments(migration, assignment)) {
        const seedDeclaration = declaration(source, fieldName);
        assert.match(seedDeclaration, new RegExp(`${assignment}: ${value}\\b`), `${assignment} drift for ${fieldName}`);
      }
    }
  });

  it("records the live lengths, date precision, repeat limits, and NA/unknown paths", () => {
    const source = readFileSync(seedPath, "utf8");
    const maxLengths: Record<string, number> = {
      national_id_number: 20,
      us_taxpayer_id: 20,
      passport_document_type_explain: 4000,
      passport_book_number: 20,
      passport_issuance_city: 25,
      passport_issuance_state: 25,
      lost_passport_number: 20,
      lost_passport_explain: 4000,
      partner_surname: 33,
      partner_given_names: 33,
      partner_city_of_birth: 20,
      partner_address_street1: 40,
      partner_address_street2: 40,
      partner_address_city: 20,
      partner_address_state: 20,
      partner_address_zip: 10,
      deceased_spouse_surname: 33,
      deceased_spouse_given_names: 33,
      deceased_spouse_city_of_birth: 20,
      former_spouse_surname: 33,
      former_spouse_given_names: 33,
      former_spouse_city_of_birth: 20,
      former_spouse_how_marriage_ended: 4000,
      us_contact_surname: 33,
      us_contact_given_names: 33,
      us_contact_organization: 33,
      us_contact_address_street1: 40,
      us_contact_address_street2: 40,
      us_contact_city: 20,
      us_contact_zip: 10,
      us_contact_phone: 15,
      us_contact_email: 50,
      occupation_other_explain: 4000,
      vwp_denial_explain: 4000,
      employer_name: 75,
      employer_address_line1: 40,
      employer_address_line2: 40,
      employer_city: 20,
      employer_state_province: 20,
      employer_postal_code: 10,
      employer_phone: 15,
      monthly_salary: 15,
      job_duties: 4000,
      prev_employer_name: 75,
      prev_employer_address_street1: 40,
      prev_employer_address_street2: 40,
      prev_employer_city: 20,
      prev_employer_state: 20,
      prev_employer_postal: 10,
      prev_employer_phone: 15,
      prev_job_title: 75,
      prev_supervisor_surname: 33,
      prev_supervisor_given_names: 33,
      prev_job_duties: 4000,
      education_institution_name: 75,
      education_address_line1: 40,
      education_address_line2: 40,
      education_city: 20,
      education_state_province: 20,
      education_postal_code: 10,
      education_course_of_study: 66,
      clan_tribe_name: 80,
      language_name: 66,
      organization_name: 66,
      specialized_skills_explain: 4000,
      military_branch: 40,
      military_rank: 40,
      military_specialty: 40,
      paramilitary_explain: 4000,
      ds160_preparer_surname: 33,
      ds160_preparer_given_names: 33,
      ds160_preparer_organization_name: 33,
      ds160_preparer_street1: 40,
      ds160_preparer_street2: 40,
      ds160_preparer_city: 20,
      ds160_preparer_state_province: 20,
      ds160_preparer_postal_code: 10,
      ds160_preparer_relationship: 75,
    };
    for (const [fieldName, maxLength] of Object.entries(maxLengths)) {
      assert.equal(DS160_FIELD_CONTRACTS[fieldName].maxLength, maxLength, fieldName);
      assert.match(declaration(source, fieldName), new RegExp(`maxLength: ${maxLength}`), fieldName);
    }

    const precision: Record<string, string> = {
      date_of_birth: "day",
      partner_date_of_birth: "year",
      deceased_spouse_date_of_birth: "year",
      former_spouse_date_of_birth: "year",
      former_spouse_date_of_marriage: "day",
      former_spouse_date_marriage_ended: "day",
      employment_start_date: "year",
      prev_employment_start_date: "year",
      prev_employment_end_date: "year",
      education_start_date: "month",
      education_end_date: "month",
      military_date_from: "month",
      military_date_to: "month",
    };
    for (const [fieldName, value] of Object.entries(precision)) {
      assert.equal(DS160_FIELD_CONTRACTS[fieldName].minimumDatePrecision, value, fieldName);
      assert.match(declaration(source, fieldName), new RegExp(`minimum_date_precision: "${value}"`), fieldName);
    }
    assert.equal(DS160_FIELD_CONTRACTS.date_of_birth.minimumAge, 14);
    assert.match(declaration(source, "date_of_birth"), /minimum_age: 14/);

    for (const fieldName of [
      "prev_employer_name", "prev_employer_address_street1", "prev_employer_address_street2",
      "prev_employer_city", "prev_employer_state", "prev_employer_postal", "prev_employer_country",
      "prev_employer_phone", "prev_job_title", "prev_supervisor_surname",
      "prev_supervisor_given_names", "prev_employment_start_date", "prev_employment_end_date",
      "prev_job_duties", "refusal_explain", "immigrant_petition_explain",
    ]) {
      assert.match(declaration(source, fieldName), /max_items: [12]/, fieldName);
      assert.ok(DS160_FIELD_CONTRACTS[fieldName].maxItems, fieldName);
    }

    assert.equal(DS160_FIELD_CONTRACTS.language_name.maxItems, undefined);
    assert.doesNotMatch(declaration(source, "language_name"), /max_items:/);
    assert.equal(DS160_FIELD_CONTRACTS.traveled_country.maxItems, undefined);
    assert.doesNotMatch(declaration(source, "traveled_country"), /max_items:/);
    for (const fieldName of [
      "arrival_date", "arrival_flight", "arrival_city", "departure_date", "departure_flight",
      "departure_city", "lost_passport_number", "lost_passport_country", "lost_passport_explain",
      "us_relative_surname", "us_relative_given_names", "us_relative_relationship", "us_relative_status",
      "former_spouse_surname", "former_spouse_given_names", "former_spouse_date_of_birth",
      "former_spouse_nationality", "former_spouse_city_of_birth", "former_spouse_country_of_birth",
      "former_spouse_date_of_marriage", "former_spouse_date_marriage_ended",
      "former_spouse_how_marriage_ended", "former_spouse_country_marriage_terminated",
      "us_drivers_license_number", "us_drivers_license_state",
      "education_institution_name", "education_address_line1", "education_address_line2",
      "education_city", "education_state_province", "education_postal_code", "education_country",
      "education_course_of_study", "education_start_date", "education_end_date", "organization_name",
    ]) {
      assert.equal(DS160_FIELD_CONTRACTS[fieldName].maxItems, undefined, fieldName);
      assert.doesNotMatch(declaration(source, fieldName), /max_items:/, fieldName);
    }
    for (const fieldName of [
      "military_country", "military_branch", "military_rank", "military_specialty",
      "military_date_from", "military_date_to",
    ]) {
      assert.equal(DS160_FIELD_CONTRACTS[fieldName].maxItems, undefined, fieldName);
      assert.doesNotMatch(declaration(source, fieldName), /max_items:/, fieldName);
    }
    assert.equal(DS160_REPEAT_GROUP_CONTRACTS.previous_visits.maxItems, 5);
    assert.equal(DS160_REPEAT_GROUP_CONTRACTS.previous_employers.maxItems, 2);
    assert.equal(DS160_REPEAT_GROUP_CONTRACTS.visa_refused.maxItems, 1);
    assert.equal(DS160_REPEAT_GROUP_CONTRACTS.immigrant_petition.maxItems, 1);
    for (const group of [
      "specific_travel_plans", "drivers_licenses", "us_relatives", "lost_passport",
      "former_spouses", "education", "languages", "traveled_countries", "organizations",
      "military_service",
    ] as const) {
      assert.equal(DS160_REPEAT_GROUP_CONTRACTS[group].maxItems, undefined, group);
    }

    assert.equal(DS160_FIELD_CONTRACTS.passport_book_number.allowsDoesNotApply, true);
    assert.equal(DS160_FIELD_CONTRACTS.passport_expiration_date.allowsDoesNotApply, true);
    assert.equal(DS160_FIELD_CONTRACTS.partner_address_state.allowsDoesNotApply, true);
    assert.equal(DS160_FIELD_CONTRACTS.partner_address_zip.allowsDoesNotApply, true);
    assert.equal(DS160_FIELD_CONTRACTS.us_contact_email.allowsDoesNotApply, true);
    for (const fieldName of ["lost_passport_number", "partner_city_of_birth", "deceased_spouse_city_of_birth", "former_spouse_city_of_birth", "us_contact_surname", "us_contact_organization"]) {
      assert.equal(DS160_FIELD_CONTRACTS[fieldName].allowsDoNotKnow, true, fieldName);
    }
    assert.equal(DS160_FIELD_CONTRACTS.ds160_preparer_surname.allowsDoesNotApply, true);
    assert.doesNotMatch(declaration(source, "passport_issuance_state"), /has_does_not_apply/);
    assert.doesNotMatch(declaration(source, "us_contact_zip"), /pattern:/);
  });

  it("uses the seven CEAC source families, including Sign and Submit geography", () => {
    const source = readFileSync(seedPath, "utf8");
    const sourceFields: Record<string, string> = {
      country_of_birth: "CEAC_BIRTH_COUNTRIES",
      nationality_country: "CEAC_NATIONALITIES",
      other_nationality_country: "CEAC_OTHER_NATIONALITIES",
      passport_issuing_country: "CEAC_PASSPORT_ISSUERS",
      lost_passport_country: "CEAC_PASSPORT_ISSUERS",
      us_address_state: "CEAC_US_STATES",
      us_drivers_license_state: "CEAC_US_STATES",
      us_contact_state: "CEAC_US_STATES",
      spouse_nationality: "CEAC_FAMILY_NATIONALITIES",
      partner_nationality: "CEAC_FAMILY_NATIONALITIES",
      deceased_spouse_nationality: "CEAC_FAMILY_NATIONALITIES",
      former_spouse_nationality: "CEAC_FAMILY_NATIONALITIES",
      military_country: "CEAC_FAMILY_NATIONALITIES",
      spouse_country_of_birth: "CEAC_BIRTH_COUNTRIES",
      partner_country_of_birth: "CEAC_BIRTH_COUNTRIES",
      deceased_spouse_country_of_birth: "CEAC_BIRTH_COUNTRIES",
      former_spouse_country_of_birth: "CEAC_BIRTH_COUNTRIES",
      passport_issuance_country: "CEAC_GEOGRAPHY",
      former_spouse_country_marriage_terminated: "CEAC_GEOGRAPHY",
      home_address_country: "CEAC_GEOGRAPHY",
      mailing_address_country: "CEAC_GEOGRAPHY",
      employer_country: "CEAC_GEOGRAPHY",
      prev_employer_country: "CEAC_GEOGRAPHY",
      education_country: "CEAC_GEOGRAPHY",
      traveled_country: "CEAC_GEOGRAPHY",
      ds160_preparer_country: "CEAC_GEOGRAPHY",
    };
    for (const [fieldName, sourceName] of Object.entries(sourceFields)) {
      assert.match(declaration(source, fieldName), new RegExp(`source: "${sourceName}"`), fieldName);
    }
  });

  it("marks duplicate compatibility-only seed fields without making them canonical", () => {
    const source = readFileSync(seedPath, "utf8");
    const migration = readFileSync(migrationPath, "utf8");
    for (const fieldName of [
      "mobile_phone", "has_social_media", "social_media_provider",
      "social_media_identifier", "passport_has_expiry",
    ]) {
      assert.match(declaration(source, fieldName), /legacy_compatibility_only: true/);
      assert.match(migration, new RegExp(`'${fieldName}'`));
      assert.match(migration, new RegExp(`WHEN '${fieldName}' THEN[\\s\\S]*legacy_compatibility_only`));
    }
  });

  it("keeps exactly 27 security explanation questions capped at 4000 characters", () => {
    const source = readFileSync(seedPath, "utf8");
    const seedFields = readDs160SeedFields(source);
    const explanations = seedFields.filter((field) => field.step >= 17 && field.step <= 21 && field.name.endsWith("_explain"));
    assert.equal(explanations.length, 27);
    assert.match(source, /validation_rules: \{ maxLength: 4000 \}/);
    const contractExplanations = Object.entries(DS160_FIELD_CONTRACTS).filter(([name, field]) => field.step >= 17 && field.step <= 21 && name.endsWith("_explain"));
    assert.equal(contractExplanations.length, 27);
    for (const [fieldName, field] of contractExplanations) {
      assert.equal(field.required, true, fieldName);
      assert.equal(field.maxLength, 4000, fieldName);
    }
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeTwAnswers } from "../normalize";
import { TwNormalizationError } from "../errors";

/** A representative full TW wizard answer set (already seed-keyed, since
 *  the wizard is designed from the start to align with the seed contract —
 *  see docs/tw-entry-permit-auto-submit-plan.md). */
function wizardAnswers(): Record<string, string> {
  return {
    continent: "A",
    embassy_office: "53",
    first_time_applying: "yes",
    permit_type: "1",
    permit_count: "1",
    has_other_nationality_passport: "no",
    eligibility_category: "1",
    name_chinese: "王小明",
    name_english: "wang xiao ming",
    date_of_birth: "1990-05-14",
    passport_number: "E12345678",
    passport_expiry_date: "2030-01-02",
    gender: "0",
    overseas_residency_id_number: "S1234567A",
    mainland_id_number_not_applicable: "true",
    birth_place_is_mainland: "mainland",
    birth_place_mainland_region: "湖南",
    local_mobile_phone: "+6591234567",
    current_occupation: "5",
    company_name: "Acme Pte Ltd",
    job_title: "Engineer",
    is_taiwanese_spouse: "no",
    overseas_address: "123 Orchard Road, Singapore",
    tw_contact_city: "1",
    tw_contact_road: "中山北路",
    tw_contact_building_number: "5樓",
    tw_contact_mobile_not_applicable: "true",
    kin_father_status: "1",
    kin_father_name: "王大明",
    kin_father_date_of_birth: "1960-01-01",
    kin_father_phone: "+8613800000000",
    kin_father_occupation: "5",
    kin_father_service_unit: "正式单位全名",
    kin_father_job_title: "工程师",
    kin_father_current_address_same_as_overseas: "true",
    kin_mother_status: "2",
    never_held_mainland_political_military_role: "true",
    accepted_terms: "true",
  };
}

describe("normalizeTwAnswers — seed-key + enum contract", () => {
  it("passes through already seed-keyed values without mutation", () => {
    const out = normalizeTwAnswers({ answers: wizardAnswers() });
    assert.equal(out.continent, "A");
    assert.equal(out.embassy_office, "53");
    assert.equal(out.permit_type, "1");
    assert.equal(out.household_revoked, undefined);
    assert.equal(out.gender, "0");
    assert.equal(out.birth_place_is_mainland, "mainland");
  });

  it("requires household_revoked only for permanent-residency HK/Macau office paths", () => {
    const base = wizardAnswers();
    assert.equal(normalizeTwAnswers({ answers: base }).household_revoked, undefined);

    assert.throws(
      () =>
        normalizeTwAnswers({
          answers: { ...base, eligibility_category: "2", embassy_office: "50" },
        }),
      TwNormalizationError,
    );

    const out = normalizeTwAnswers({
      answers: {
        ...base,
        eligibility_category: "2",
        embassy_office: "51",
        household_revoked: "yes",
      },
    });
    assert.equal(out.household_revoked, "yes");

    assert.equal(
      normalizeTwAnswers({
        answers: { ...base, eligibility_category: "2", embassy_office: "53", household_revoked: "" },
      }).household_revoked,
      undefined,
    );
    assert.equal(
      normalizeTwAnswers({
        answers: { ...base, eligibility_category: "1", embassy_office: "50", household_revoked: "" },
      }).household_revoked,
      undefined,
    );
  });

  it("uppercases the English name", () => {
    const out = normalizeTwAnswers({ answers: wizardAnswers() });
    assert.equal(out.name_english, "WANG XIAO MING");
  });

  it("rejects a Latin transliteration in the Chinese-name field", () => {
    assert.throws(
      () => normalizeTwAnswers({ answers: { ...wizardAnswers(), name_chinese: "Junjie" } }),
      (error) => error instanceof TwNormalizationError && error.field === "name_chinese",
    );
  });

  it("requires and preserves the official Mainland birthplace region", () => {
    const out = normalizeTwAnswers({ answers: wizardAnswers() });
    assert.equal(out.birth_place_mainland_region, "湖南");

    const { birth_place_mainland_region: _region, ...missingRegion } = wizardAnswers();
    assert.throws(
      () => normalizeTwAnswers({ answers: missingRegion }),
      (error) => error instanceof TwNormalizationError && error.field === "birth_place_mainland_region",
    );
  });

  it("defaults the mainland-id and tw-mobile checkboxes and skips the disabled text fields", () => {
    const out = normalizeTwAnswers({ answers: wizardAnswers() });
    assert.equal(out.mainland_id_number_not_applicable, "true");
    assert.equal(out.mainland_id_number, undefined);
    assert.equal(out.tw_contact_mobile_not_applicable, "true");
    assert.equal(out.tw_contact_mobile, undefined);
  });

  it("omits only job_title for student occupation while keeping the school/company field", () => {
    const out = normalizeTwAnswers({
      answers: {
        ...wizardAnswers(),
        current_occupation: "14",
        company_name: "National University of Singapore",
        job_title: "STALE_TITLE_SHOULD_NOT_SUBMIT",
      },
    });

    assert.equal(out.current_occupation, "14");
    assert.equal(out.company_name, "National University of Singapore");
    assert.equal(out.job_title, undefined);
  });

  it("fails integrity when a living parent is missing official detail fields", () => {
    const { kin_father_phone: _phone, ...missingPhone } = wizardAnswers();
    assert.throws(
      () => normalizeTwAnswers({ answers: missingPhone }),
      (error) => error instanceof TwNormalizationError && error.field === "kin_father_phone",
    );

    const deceasedParent = normalizeTwAnswers({
      answers: {
        ...wizardAnswers(),
        kin_father_status: "2",
        kin_father_name: "",
        kin_father_date_of_birth: "",
        kin_father_phone: "",
        kin_father_occupation: "",
        kin_father_service_unit: "",
        kin_father_job_title: "",
        kin_father_current_address_same_as_overseas: "",
      },
    });
    assert.equal(deceasedParent.kin_father_status, "2");
    assert.equal(deceasedParent.kin_father_name, undefined);
  });

  it("omits company_name and job_title for retired occupation even when stale draft values exist", () => {
    const out = normalizeTwAnswers({
      answers: {
        ...wizardAnswers(),
        current_occupation: "62",
        company_name: "STALE_COMPANY_SHOULD_NOT_SUBMIT",
        job_title: "STALE_TITLE_SHOULD_NOT_SUBMIT",
      },
    });

    assert.equal(out.current_occupation, "62");
    assert.equal(out.company_name, undefined);
    assert.equal(out.job_title, undefined);
  });

  it("omits company_name and job_title for unemployed occupation even when stale draft values exist", () => {
    const out = normalizeTwAnswers({
      answers: {
        ...wizardAnswers(),
        current_occupation: "61",
        company_name: "STALE_COMPANY_SHOULD_NOT_SUBMIT",
        job_title: "STALE_TITLE_SHOULD_NOT_SUBMIT",
      },
    });

    assert.equal(out.current_occupation, "61");
    assert.equal(out.company_name, undefined);
    assert.equal(out.job_title, undefined);
  });

  it("keeps requiring and submitting company_name and job_title for ordinary occupations", () => {
    const out = normalizeTwAnswers({ answers: { ...wizardAnswers(), current_occupation: "5" } });
    assert.equal(out.company_name, "Acme Pte Ltd");
    assert.equal(out.job_title, "Engineer");

    const { job_title: _jobTitle, ...withoutJobTitle } = wizardAnswers();
    assert.throws(
      () => normalizeTwAnswers({ answers: { ...withoutJobTitle, current_occupation: "5" } }),
      TwNormalizationError,
    );

    const { company_name: _companyName, ...withoutCompanyName } = wizardAnswers();
    assert.throws(
      () => normalizeTwAnswers({ answers: { ...withoutCompanyName, current_occupation: "5" } }),
      TwNormalizationError,
    );
  });

  it("copies overseas_address into kin_*_current_address when the same-as-overseas flag is set", () => {
    const out = normalizeTwAnswers({ answers: wizardAnswers() });
    assert.equal(out.kin_father_current_address_same_as_overseas, "true");
    assert.equal(out.kin_father_current_address, "123 Orchard Road, Singapore");
  });

  it("requires other_nationality_* fields only when has_other_nationality_passport is yes", () => {
    const base = wizardAnswers();
    assert.throws(
      () =>
        normalizeTwAnswers({
          answers: { ...base, has_other_nationality_passport: "yes" },
        }),
      TwNormalizationError,
    );
    const out = normalizeTwAnswers({
      answers: {
        ...base,
        has_other_nationality_passport: "yes",
        other_nationality_country: "27",
        other_passport_number: "K1111111",
        other_passport_expiry_date: "2029-06-01",
      },
    });
    assert.equal(out.other_nationality_country, "27");
  });

  it("throws TwNormalizationError for an out-of-range enum", () => {
    assert.throws(
      () => normalizeTwAnswers({ answers: { ...wizardAnswers(), continent: "Z" } }),
      TwNormalizationError,
    );
    assert.throws(
      () => normalizeTwAnswers({ answers: { ...wizardAnswers(), permit_type: "3" } }),
      TwNormalizationError,
    );
    assert.throws(
      () => normalizeTwAnswers({ answers: { ...wizardAnswers(), gender: "male" } }),
      TwNormalizationError,
    );
  });

  it("throws when accepted_terms is not true", () => {
    assert.throws(
      () => normalizeTwAnswers({ answers: { ...wizardAnswers(), accepted_terms: "false" } }),
      TwNormalizationError,
    );
    const { accepted_terms: _omit, ...withoutTerms } = wizardAnswers();
    assert.throws(() => normalizeTwAnswers({ answers: withoutTerms }), TwNormalizationError);
  });

  it("throws when a required identity field is missing", () => {
    const { name_chinese: _omit, ...withoutName } = wizardAnswers();
    assert.throws(() => normalizeTwAnswers({ answers: withoutName }), TwNormalizationError);
  });

  it("requires past_role_detail / current_role_detail only when their checkbox is true", () => {
    const base = wizardAnswers();
    assert.throws(
      () =>
        normalizeTwAnswers({
          answers: { ...base, past_mainland_political_military_role: "true" },
        }),
      TwNormalizationError,
    );
    const out = normalizeTwAnswers({
      answers: {
        ...base,
        past_mainland_political_military_role: "true",
        past_role_detail: "某單位",
      },
    });
    assert.equal(out.past_role_detail, "某單位");
  });

  it("converts a DD/MM/YYYY date to ISO and rejects unparseable dates", () => {
    const out = normalizeTwAnswers({
      answers: { ...wizardAnswers(), passport_expiry_date: "02/01/2030" },
    });
    assert.equal(out.passport_expiry_date, "2030-01-02");

    assert.throws(
      () => normalizeTwAnswers({ answers: { ...wizardAnswers(), passport_expiry_date: "not-a-date" } }),
      TwNormalizationError,
    );
  });
});

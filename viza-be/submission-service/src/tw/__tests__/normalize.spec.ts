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
    eligibility_category: "2",
    name_chinese: "王小明",
    name_english: "wang xiao ming",
    date_of_birth: "1990-05-14",
    passport_number: "E12345678",
    passport_expiry_date: "2030-01-02",
    gender: "0",
    overseas_residency_id_number: "S1234567A",
    mainland_id_number_not_applicable: "true",
    birth_place_is_mainland: "mainland",
    local_mobile_phone: "+6591234567",
    current_occupation: "5",
    company_name: "Acme Pte Ltd",
    job_title: "Engineer",
    overseas_address: "123 Orchard Road, Singapore",
    tw_contact_city: "1",
    tw_contact_road: "中山北路",
    tw_contact_building_number: "5樓",
    tw_contact_mobile_not_applicable: "true",
    kin_father_status: "1",
    kin_father_name: "王大明",
    kin_father_current_address_same_as_overseas: "true",
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
    assert.equal(out.gender, "0");
    assert.equal(out.birth_place_is_mainland, "mainland");
  });

  it("uppercases the English name", () => {
    const out = normalizeTwAnswers({ answers: wizardAnswers() });
    assert.equal(out.name_english, "WANG XIAO MING");
  });

  it("defaults the mainland-id and tw-mobile checkboxes and skips the disabled text fields", () => {
    const out = normalizeTwAnswers({ answers: wizardAnswers() });
    assert.equal(out.mainland_id_number_not_applicable, "true");
    assert.equal(out.mainland_id_number, undefined);
    assert.equal(out.tw_contact_mobile_not_applicable, "true");
    assert.equal(out.tw_contact_mobile, undefined);
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

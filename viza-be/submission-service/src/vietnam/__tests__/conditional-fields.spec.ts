import { test } from "node:test";
import assert from "node:assert/strict";
import {
  collectVietnamContactRows,
  collectVietnamOtherPassportRows,
  collectVietnamPreviousVisitRows,
  collectVietnamRelativeRows,
  validateVietnamConditionalAnswers,
} from "../conditional-fields.js";

test("vn.conditional-fields: preserves Yes and collects prior Viet Nam visit table rows", () => {
  const answers = {
    visited_vietnam_in_last_year: "yes",
    visited_vietnam_from_date: "2026-01-02",
    visited_vietnam_to_date: "2026-01-09",
    visited_vietnam_trip_purpose: "Tourism",
    visited_vietnam_from_date__2: "2026-03-04",
    visited_vietnam_to_date__2: "2026-03-08",
    visited_vietnam_trip_purpose__2: "Business meeting",
  };

  assert.deepEqual(collectVietnamPreviousVisitRows(answers), [
    { fromDate: "02/01/2026", toDate: "09/01/2026", purpose: "Tourism" },
    { fromDate: "04/03/2026", toDate: "08/03/2026", purpose: "Business meeting" },
  ]);
  assert.deepEqual(validateVietnamConditionalAnswers(answers), []);
});

test("vn.conditional-fields: blocks Yes prior Viet Nam answer when official table row fields are missing", () => {
  const errors = validateVietnamConditionalAnswers({
    visited_vietnam_in_last_year: "yes",
    visited_vietnam_purpose_detail: "Visited Da Nang for tourism",
  });

  assert.equal(errors.length, 1);
  assert.equal(errors[0]?.fieldName, "visited_vietnam_in_last_year");
  assert.match(errors[0]?.message ?? "", /From date \/ To date \/ Purpose of trip/);
});

test("vn.conditional-fields: blocks incomplete prior Viet Nam table rows", () => {
  const errors = validateVietnamConditionalAnswers({
    visited_vietnam_in_last_year: "yes",
    visited_vietnam_from_date: "2026-01-02",
    visited_vietnam_trip_purpose: "Tourism",
  });

  assert.equal(errors.length, 1);
  assert.equal(errors[0]?.fieldName, "visited_vietnam_last_year[1]");
  assert.match(errors[0]?.message ?? "", /To date/);
});

test("vn.conditional-fields: collects every mapped Yes conditional repeat group", () => {
  const answers = {
    has_other_passports_used_for_vietnam: "yes",
    other_vietnam_passport_number: "E1234567",
    other_vietnam_passport_full_name: "ZHANG SAN",
    other_vietnam_passport_date_of_birth: "1990-05-06",
    other_vietnam_passport_nationality: "chn",
    has_contact_in_vietnam: "yes",
    contact_hosting_organization_name: "VIZA Vietnam",
    contact_hosting_organization_phone: "+84901234567",
    contact_hosting_organization_address: "Hanoi",
    contact_hosting_organization_purpose: "Tourism assistance",
    has_relatives_in_vietnam: "yes",
    relative_full_name: "NGUYEN VAN A",
    relative_date_of_birth: "1988-02-03",
    relative_nationality: "china",
    relative_relationship: "Friend",
    relative_residential_address: "Da Nang",
  };

  assert.deepEqual(collectVietnamOtherPassportRows(answers), [
    { values: ["E1234567", "ZHANG SAN", "06/05/1990", "China"] },
  ]);
  assert.deepEqual(collectVietnamContactRows(answers), [
    { values: ["VIZA Vietnam", "+84901234567", "Hanoi", "Tourism assistance"] },
  ]);
  assert.deepEqual(collectVietnamRelativeRows(answers), [
    { values: ["NGUYEN VAN A", "03/02/1988", "China", "Friend", "Da Nang"] },
  ]);
  assert.deepEqual(validateVietnamConditionalAnswers(answers), []);
});

test("vn.conditional-fields: blocks mapped Yes conditional groups when row fields are missing", () => {
  const errors = validateVietnamConditionalAnswers({
    has_contact_in_vietnam: "yes",
    contact_hosting_organization_name: "VIZA Vietnam",
  });

  assert.equal(errors.length, 1);
  assert.equal(errors[0]?.fieldName, "vietnam_contacts[1]");
  assert.match(errors[0]?.message ?? "", /Telephone number/);
});

test("vn.conditional-fields: blocks unsupported Yes conditional groups instead of dropping child details", () => {
  const errors = validateVietnamConditionalAnswers({
    has_violated_vietnam_laws: "yes",
    vietnam_law_violation_act: "Overstay",
  });

  assert.equal(errors.length, 1);
  assert.equal(errors[0]?.fieldName, "has_violated_vietnam_laws");
  assert.match(errors[0]?.message ?? "", /blocked instead of changing the answer or dropping details/);
});

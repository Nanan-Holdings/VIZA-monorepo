import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeItVfsAnswers, assertCorridorEligible } from "../normalize.js";

const COMPLETE: Record<string, string> = {
  surname: "ZHANG",
  given_names: "Edward Zehua",
  date_of_birth: "1990-04-15",
  place_of_birth_city: "Beijing",
  place_of_birth_country: "CN",
  current_nationality: "CN",
  travel_document_type: "P",
  travel_document_number: "E12345678",
  travel_document_issue_date: "2022-01-01",
  travel_document_expiry_date: "2032-01-01",
  travel_document_issuing_country: "CN",
  home_address_line1: "1 Test Rd",
  home_address_city: "Beijing",
  home_address_postal_code: "100000",
  home_address_country: "CN",
  email: "edward@example.com",
  phone: "+8613800000000",
  current_occupation: "Engineer",
};

test("it-vfs.normalize: names the missing Annex I field for a partial set", () => {
  // COMPLETE covers personal/travel-doc/contact/occupation but not the
  // trip/cost sections — normalize must fail with a descriptive message
  // (proves the field-by-field req() validation the runner relies on).
  assert.throws(
    () =>
      normalizeItVfsAnswers({
        answers: COMPLETE,
        applicantResidencyCountry: "CN",
        destinationCountry: "IT",
      }),
    /Missing required answer/,
  );
});

test("it-vfs.normalize: rejects non-CN residency corridor", () => {
  assert.throws(() =>
    assertCorridorEligible({ answers: {}, applicantResidencyCountry: "US", destinationCountry: "IT" }),
  );
});

test("it-vfs.normalize: rejects non-IT destination corridor", () => {
  assert.throws(() =>
    assertCorridorEligible({ answers: {}, applicantResidencyCountry: "CN", destinationCountry: "FR" }),
  );
});

test("it-vfs.normalize: throws on missing required Annex I field", () => {
  const { surname, ...incomplete } = COMPLETE;
  void surname;
  assert.throws(() =>
    normalizeItVfsAnswers({ answers: incomplete, applicantResidencyCountry: "CN", destinationCountry: "IT" }),
  );
});

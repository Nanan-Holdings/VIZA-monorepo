import assert from "node:assert/strict";
import test from "node:test";
import type { ApplicantProfile, Application } from "../../types";
import { normalizeFvStep1, occupationText, toFvOccupation, type AnswerMap } from "../normalize";
import {
  FranceOptionUnmatchedError,
  pickOptionByLabel,
  submissionCentreCity,
} from "../option-match";

const towns = [
  { value: "1PE", label: "Beijing" },
  { value: "7CS", label: "CHANGSHA" },
  { value: "9XA", label: "Xian" },
  { value: "4SH", label: "Shanghai" },
  { value: "5SZ", label: "Shenzhen" },
];

test("centre cities match France-Visas labels regardless of case, accents and punctuation", () => {
  assert.equal(pickOptionByLabel(towns, "Changsha"), "7CS");
  assert.equal(pickOptionByLabel(towns, submissionCentreCity("xian") ?? ""), "9XA");
  assert.equal(pickOptionByLabel([{ value: "X", label: "Saint-Étienne" }], "saint etienne"), "X");
});

test("no match or an ambiguous match picks nothing", () => {
  assert.equal(pickOptionByLabel(towns, "Kunming"), null);
  assert.equal(pickOptionByLabel(towns, "Sh"), null, "Shanghai and Shenzhen both contain it");
  assert.equal(pickOptionByLabel(towns, ""), null);
});

test("the unmatched error lists what France-Visas offered and is reported by code", () => {
  const error = new FranceOptionUnmatchedError("depositTown", "Kunming", towns);
  assert.equal(error.code, "france_option_unmatched");
  assert.deepEqual(error.context.available, ["Beijing", "CHANGSHA", "Xian", "Shanghai", "Shenzhen"]);
  assert.match(error.message, /Kunming/);
});

test("unknown centre keys map to no city", () => {
  assert.equal(submissionCentreCity("changsha"), "Changsha");
  assert.equal(submissionCentreCity("paris"), undefined);
  assert.equal(submissionCentreCity(null), undefined);
});

function answers(extra: AnswerMap = {}): AnswerMap {
  return {
    current_nationality: "CHN",
    has_eu_family_member: "no",
    travel_document_type: "ordinary",
    travel_document_number: "EA1234567",
    travel_document_issue_date: "2024-06-25",
    travel_document_expiry_date: "2034-06-24",
    purpose_of_journey: "tourism",
    submission_centre: "changsha",
    ...extra,
  };
}

function step1(map: AnswerMap, fvOverrides = {}) {
  return normalizeFvStep1({
    answers: map,
    profile: {} as ApplicantProfile,
    application: {} as Application,
    fvOverrides,
  });
}

test("step 1 derives the filing country, centre city and tourism purpose from the answers", () => {
  const s1 = step1(answers());
  assert.equal(s1.depositCountry, "CHN");
  assert.equal(s1.depositTown, "");
  assert.equal(s1.depositTownCity, "Changsha");
  assert.equal(s1.purposeCategory, "TOUR");
  assert.equal(s1.purpose, "1");
});

test("explicit fv_* overrides still win", () => {
  const s1 = step1(answers(), { depositCountry: "SGP", depositTown: "1PE", purpose: "2" });
  assert.equal(s1.depositCountry, "SGP");
  assert.equal(s1.depositTown, "1PE");
  assert.equal(s1.depositTownCity, undefined);
  assert.equal(s1.purpose, "2");
});

test("an applicant living abroad files in their country of residence", () => {
  const s1 = step1(answers({ residence_country_different: "yes", residence_country: "SG" }));
  assert.equal(s1.depositCountry, "SGP");
});

test("occupation words map to France-Visas codes; codes from other forms fall back to the English words", () => {
  assert.equal(toFvOccupation("Software Engineer"), "73001");
  assert.equal(toFvOccupation("software_engineer"), "73001");
  assert.equal(toFvOccupation("Astronaut"), "65005");
  assert.equal(occupationText({ current_occupation: "0800", current_occupation_en: "Software Engineer" }, null), "Software Engineer");
  assert.equal(occupationText({ current_occupation: "Teacher" }, null), "Teacher");
  assert.equal(occupationText({}, "Farmer"), "Farmer");
});

test("the France-Visas access code is read from the authentication email", async () => {
  const { extractFranceVisasLoginCode } = await import("../sign-in");
  assert.equal(
    extractFranceVisasLoginCode("Access code: 482913.\n\nThis code will expire within 300 seconds."),
    "482913",
  );
  assert.equal(extractFranceVisasLoginCode("Code d'accès : 004512."), "004512");
  assert.equal(extractFranceVisasLoginCode("This code will expire within 300 seconds."), null);
  assert.equal(extractFranceVisasLoginCode(null), null);
});

test("countries stored by English or Chinese name map to France-Visas codes", async () => {
  const { toFvCountryCode } = await import("../normalize");
  assert.equal(toFvCountryCode("Singapore", "school_country"), "SGP");
  assert.equal(toFvCountryCode("新加坡", "school_country"), "SGP");
  assert.equal(toFvCountryCode("United Kingdom", "employer_country"), "GBR");
  assert.equal(toFvCountryCode("South Korea", "employer_country"), "KOR");
  assert.equal(toFvCountryCode("China", "home_address_country"), "CHN");
  assert.throws(() => toFvCountryCode("Atlantis", "school_country"));
});

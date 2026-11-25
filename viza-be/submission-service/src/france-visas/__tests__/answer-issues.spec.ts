import assert from "node:assert/strict";
import test from "node:test";
import type { FvApplicationAnswers } from "../field-mappings";
import {
  FranceAccountRequiredError,
  FranceAnswersInvalidError,
  containsNonLatinText,
  findFranceAnswerIssues,
} from "../fallbacks";
import { NormalizationError } from "../normalize";

function validAnswers(): FvApplicationAnswers {
  return {
    step1: { depositTown: "", depositTownCity: "Changsha" },
    step2: {
      placeOfBirth: "CHANGSHA",
      street: "No. 18 Dongsanhuan North Road",
      place: "Beijing",
      phoneNumber: "+86 138 0013 8000",
      email: "applicant@viza.test",
      occupation: "11001",
    },
    step3: {},
    step4: {},
    step5: {
      cbxHasHostPerson: true,
      cbxHasHostOrganization: false,
      cbxHasPlaceOfApplication: false,
      cbxHasAutoFunding: true,
      cbxHasGuarantor: false,
      hostPersonSurname: "Dupont",
      hostPersonFirstnames: "Élise",
      hostPersonAddress: "12 rue de l'Église",
      hostPersonZipcode: "75004",
      hostPersonPlace: "Paris",
      hostPersonCountry: "FRA",
      hostPersonPhone: "+33 1 23 45 67 89",
      hostPersonEmail: "elise@viza.test",
    },
  } as unknown as FvApplicationAnswers;
}

test("valid Latin answers (including accents) pass unchanged", () => {
  const answers = validAnswers();
  const before = JSON.stringify(answers);
  assert.deepEqual(findFranceAnswerIssues(answers), []);
  assert.equal(JSON.stringify(answers), before, "answers are never modified");
});

test("Chinese text in an official field is reported against its VIZA field, not replaced", () => {
  const answers = validAnswers();
  answers.step2.place = "确定";
  const issues = findFranceAnswerIssues(answers);
  assert.deepEqual(issues.map((issue) => [issue.field, issue.reason, issue.answerFields[0]]), [
    ["place", "contains_non_latin", "home_address_city"],
  ]);
  assert.equal(answers.step2.place, "确定");
});

test("other non-Latin scripts and full-width punctuation are rejected", () => {
  assert.equal(containsNonLatinText("Москва"), true);
  assert.equal(containsNonLatinText("Beijing，Chaoyang"), true);
  assert.equal(containsNonLatinText("Saint-Étienne (42)"), false);
});

test("malformed phone and missing host postcode are reported", () => {
  const answers = validAnswers();
  answers.step2.phoneNumber = "call me";
  answers.step5.hostPersonZipcode = undefined;
  const issues = findFranceAnswerIssues(answers);
  assert.deepEqual(issues.map((issue) => [issue.field, issue.reason]), [
    ["phoneNumber", "invalid_format"],
    ["hostPersonZipcode", "missing"],
  ]);
});

const HOTEL = {
  hostOrgName: "Hotel du Louvre",
  hostOrgStreet: "Place Andre Malraux",
  hostOrgZipcode: "75001",
  hostOrgPlace: "Paris",
  hostOrgCountry: "FRA",
  hostOrgPhone: "0033144581010",
  hostOrgEmail: "reservations@hotel.test",
};

test("hotel stays skip host-person checks", () => {
  const answers = validAnswers();
  answers.step5 = { ...answers.step5, cbxHasHostPerson: false, cbxHasHostOrganization: true, hostPersonZipcode: undefined, ...HOTEL };
  assert.deepEqual(findFranceAnswerIssues(answers), []);
});

test("hotel stays need the hotel's phone and email", () => {
  const answers = validAnswers();
  answers.step5 = {
    ...answers.step5, cbxHasHostPerson: false, cbxHasHostOrganization: true,
    ...HOTEL, hostOrgPhone: undefined, hostOrgEmail: undefined,
  };
  assert.deepEqual(findFranceAnswerIssues(answers).map((issue) => [issue.field, issue.answerFields[0], issue.labelZh]), [
    ["hostOrgPhone", "accommodation_phone", "住宿电话"],
    ["hostOrgEmail", "accommodation_email", "住宿电子邮箱"],
  ]);
});

test("an 'Other' occupation needs every employer detail, phone and email included", () => {
  const answers = validAnswers();
  answers.step2 = {
    ...answers.step2,
    occupation: "65005",
    occupationOtherSpecify: "Freelancer",
    businessSegment: "OTH",
    employerName: "Self",
    employerStreet: "1 Main St",
    employerPlace: "Beijing",
    employerCountry: "CHN",
  };
  const issues = findFranceAnswerIssues(answers);
  assert.deepEqual(issues.map((issue) => [issue.field, issue.answerFields]), [
    ["employerPhone", ["employer_phone"]],
    ["employerEmail", ["employer_email"]],
  ]);
});

test("the invalid-answers error is a non-retryable data error carrying every issue", () => {
  const answers = validAnswers();
  answers.step2.place = "确定";
  const error = new FranceAnswersInvalidError(findFranceAnswerIssues(answers));
  assert.ok(error instanceof NormalizationError);
  assert.equal(error.errorCode, "france_answers_invalid");
  assert.equal(error.issues.length, 1);
  assert.doesNotMatch(error.message, /确定/, "answer values are not logged");
});

test("a missing submission centre is reported before France-Visas is opened", () => {
  const answers = validAnswers();
  answers.step1 = { ...answers.step1, depositTown: "", depositTownCity: undefined };
  assert.deepEqual(findFranceAnswerIssues(answers).map((issue) => [issue.field, issue.reason, issue.answerFields[0]]), [
    ["depositTown", "missing", "submission_centre"],
  ]);
});

test("a missing France-Visas login is a non-retried data error with a Chinese fix-it", () => {
  const error = new FranceAccountRequiredError();
  assert.ok(error instanceof NormalizationError);
  assert.equal(error.errorCode, "france_account_required");
  assert.match(error.messageZh, /关联您的 France-Visas 账号/);
});

test("a student's educational establishment is checked against the school answers", () => {
  const answers = validAnswers();
  answers.step2 = {
    ...answers.step2,
    occupation: "69005",
    employerName: "National University of Singapore",
    employerStreet: "21 Lower Kent Ridge Road",
    employerCountry: "SGP",
    employerPhone: "+65 6516 6666",
  };
  const issues = findFranceAnswerIssues(answers);
  assert.deepEqual(issues.map((issue) => [issue.field, issue.answerFields[0], issue.labelZh]), [
    ["employerPlace", "school_city", "学校所在城市"],
    ["employerEmail", "school_email", "学校电子邮箱"],
  ]);
});

test("a student's establishment is in the Teaching / Education sector", async () => {
  const { normalizeFvAnswers, EDUCATION_SEGMENT } = await import("../normalize");
  assert.equal(EDUCATION_SEGMENT, "P");
  const answers = normalizeFvAnswers({
    answers: {
      current_nationality: "CHN", has_eu_family_member: "no", travel_document_type: "ordinary",
      travel_document_number: "EA1234567", travel_document_issue_date: "2024-06-25",
      travel_document_expiry_date: "2034-06-24", purpose_of_journey: "tourism", submission_centre: "changsha",
      sex: "male", civil_status: "single", surname: "CHEN", given_names: "HONGYU", date_of_birth: "2006-07-01",
      place_of_birth: "Changsha", country_of_birth: "China", home_address_line_1: "1 Main St",
      home_address_city: "Changsha", home_address_country: "China", phone_number: "+86 138 0013 8000",
      email_address: "a@viza.test", is_student: "yes", current_occupation: "Student",
      school_name: "National University of Singapore", school_address: "21 Lower Kent Ridge Road",
      school_city: "Singapore", school_country: "Singapore", school_phone: "+65 6516 6666", school_email: "s@nus.edu",
      intended_arrival_date: "2027-01-16", intended_departure_date: "2027-01-31", intended_duration_days: "16",
      number_of_entries_requested: "single", cost_covered_by: "self", self_means_cash: "yes",
      accommodation_type: "hotel", accommodation_name: "Hotel", accommodation_address_line_1: "1 Rue",
      accommodation_postcode: "75001", accommodation_city: "Paris", accommodation_country: "France",
    },
    profile: {} as never,
    application: {} as never,
    fvOverrides: {},
  });
  assert.equal(answers.step2.businessSegment, "P");
  assert.equal(answers.step2.employerCountry, "SGP");
});

test("phones use France-Visas' international extended form and funding follows the answers", async () => {
  const { toFvPhone, toFvAutoFundings } = await import("../normalize");
  assert.equal(toFvPhone("+33 1 44 58 10 10"), "0033144581010");
  assert.equal(toFvPhone("+65 (6516) 6666"), "006565166666");
  assert.equal(toFvPhone("0033144581010"), "0033144581010");
  assert.equal(toFvPhone("  "), undefined);
  assert.deepEqual(
    toFvAutoFundings({ self_means_cash: "yes", self_means_credit_card: "yes", self_means_prepaid_accommodation: "yes", self_means_other: "no" }),
    ["ARG", "CCR", "HPP"],
  );
  assert.deepEqual(toFvAutoFundings({}), ["CCR", "ARG"]);
});

test("a hotel stay fills the host organisation with the reception as contact", async () => {
  const { normalizeFvAnswers, HOTEL_RECEPTION_CONTACT } = await import("../normalize");
  const answers = normalizeFvAnswers({
    answers: {
      current_nationality: "CHN", has_eu_family_member: "no", travel_document_type: "ordinary",
      travel_document_number: "EA1234567", travel_document_issue_date: "2024-06-25",
      travel_document_expiry_date: "2034-06-24", purpose_of_journey: "tourism", submission_centre: "changsha",
      sex: "male", civil_status: "single", surname: "CHEN", given_names: "HONGYU", date_of_birth: "2006-07-01",
      place_of_birth: "Changsha", country_of_birth: "China", home_address_line_1: "1 Main St",
      home_address_city: "Changsha", home_address_country: "China", phone_number: "+86 138 0013 8000",
      email_address: "a@viza.test", is_student: "no", current_occupation: "Engineer",
      intended_arrival_date: "2027-01-16", intended_departure_date: "2027-01-31", intended_duration_days: "16",
      number_of_entries_requested: "single", cost_covered_by: "self", self_means_cash: "yes",
      accommodation_type: "hotel", accommodation_name: "Novotel Paris Créteil Le Lac", accommodation_address_line_1: "Rue Jean Gabin, RN 186",
      accommodation_postcode: "94000", accommodation_city: "Créteil", accommodation_country: "France",
      accommodation_phone: "+33 1 56 72 56 72", accommodation_email: "H0382@accor.com",
    },
    profile: {} as never,
    application: {} as never,
    fvOverrides: {},
  });
  const s5 = answers.step5;
  assert.equal(s5.cbxHasHostOrganization, true);
  assert.equal(s5.cbxHasHostPerson, false);
  assert.equal(s5.hostOrgName, "Novotel Paris Creteil Le Lac");
  assert.equal(s5.hostOrgStreet, "Rue Jean Gabin RN 186");
  assert.equal(s5.hostOrgPlace, "Creteil");
  assert.equal(s5.hostOrgCountry, "FRA");
  assert.equal(s5.hostOrgPhone, "0033156725672");
  assert.equal(s5.hostOrgContactSurname, HOTEL_RECEPTION_CONTACT);
  assert.equal(s5.hostOrgContactFirstnames, "HOTEL");
  assert.equal(s5.hostOrgContactAddress, "Rue Jean Gabin RN 186");
  assert.equal(s5.hostOrgContactPhone, "0033156725672");
  assert.equal(s5.hostOrgContactEmail, "H0382@accor.com");
  assert.deepEqual(s5.autoFundings, ["ARG"]);
});

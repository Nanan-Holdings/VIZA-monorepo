import assert from "node:assert/strict";
import test from "node:test";
import {
  buildUSAppointmentApplicantDetails,
  type USAppointmentApplicantDetailsInput,
} from "../applicant-details-data";

function completeInput(): USAppointmentApplicantDetailsInput {
  return {
    profile: {
      given_names_en: "Wei Li",
      surname_en: "Zhang",
      birth_country: "CN",
      date_of_birth: "1990-01-02",
      nationality: "Chinese",
      passport_number: "e1234567",
      passport_issue_date: "2020-01-02",
      passport_expiry_date: "2030-01-02",
      phone: "+6581234567",
    },
    answers: {
      mailing_same_as_home: "yes",
      home_address_line1: "1 Main Street",
      home_address_city: "Singapore",
      home_address_state_province: "Central",
      home_address_postal_code: "123456",
      mobile_phone: "81234567",
      passport_issuance_city: "Singapore",
      national_id_number: "S1234567A",
    },
    accountEmail: "Managed@Example.com",
    mobileCallingCode: "+65",
  };
}

test("builds the complete applicant-details contract from verified separated values", () => {
  const result = buildUSAppointmentApplicantDetails(completeInput());

  assert.deepEqual(result, {
    state: "ready",
    data: {
      firstName: "Wei Li",
      lastName: "Zhang",
      birthCountry: "China",
      homePhone: { callingCode: "+65", nationalNumber: "81234567" },
      mobilePhone: { callingCode: "+65", nationalNumber: "81234567" },
      email: "managed@example.com",
      mailingStreet: "1 Main Street",
      mailingCity: "Singapore",
      mailingState: "Central",
      mailingPostalCode: "123456",
      passportNumber: "E1234567",
      passportIssueDate: "2020-01-02",
      passportPlaceOfIssue: "Singapore",
      passportExpiryDate: "2030-01-02",
      dateOfBirth: "1990-01-02",
      nationality: "China",
      nationalId: "S1234567A",
    },
  });
});

test("derives a mobile calling code from an explicit E.164 answer without an override", () => {
  const input = completeInput();
  delete input.mobileCallingCode;
  input.answers.mobile_phone = "+86 138-0013-8000";

  const result = buildUSAppointmentApplicantDetails(input);

  assert.equal(result.state, "ready");
  if (result.state === "ready") {
    assert.deepEqual(result.data.mobilePhone, {
      callingCode: "+86",
      nationalNumber: "13800138000",
    });
  }
});

test("reports only the mobile calling-code field when a local mobile answer has no confirmed code", () => {
  const input = completeInput();
  delete input.mobileCallingCode;

  const result = buildUSAppointmentApplicantDetails(input);

  assert.deepEqual(result, {
    state: "missing",
    missingFields: ["mobilePhone.callingCode"],
  });
});

test("does not infer a mobile number from the profile home phone", () => {
  const input = completeInput();
  delete input.answers.mobile_phone;
  delete input.mobileCallingCode;

  const result = buildUSAppointmentApplicantDetails(input);

  assert.equal(result.state, "missing");
  if (result.state === "missing") assert.deepEqual(result.missingFields, ["mobilePhone.nationalNumber"]);
});

test("uses explicit mailing values only when mailing is different from home", () => {
  const input = completeInput();
  input.answers.mailing_same_as_home = "no";
  input.answers.mailing_address_line1 = "9 Mailing Road";
  input.answers.mailing_address_city = "Kuala Lumpur";
  input.answers.mailing_address_state = "Selangor";
  input.answers.mailing_address_postal_code = "50000";

  const result = buildUSAppointmentApplicantDetails(input);

  assert.equal(result.state, "ready");
  if (result.state === "ready") {
    assert.equal(result.data.mailingStreet, "9 Mailing Road");
    assert.equal(result.data.mailingCity, "Kuala Lumpur");
    assert.equal(result.data.mailingState, "Selangor");
    assert.equal(result.data.mailingPostalCode, "50000");
  }
});

test("does not reuse home address when the mailing branch is missing or unclear", () => {
  const input = completeInput();
  delete input.answers.mailing_same_as_home;

  const result = buildUSAppointmentApplicantDetails(input);

  assert.deepEqual(result, {
    state: "missing",
    missingFields: [
      "mailingSameAsHome",
      "mailingStreet",
      "mailingCity",
      "mailingState",
      "mailingPostalCode",
    ],
  });
});

test("accepts current application aliases before profile fallbacks", () => {
  const input = completeInput();
  // Keep this test focused on source/key precedence.  A separate test below
  // covers the safety gate for an application identity that disagrees with
  // the reusable profile.
  delete input.profile.birth_country;
  delete input.profile.date_of_birth;
  delete input.profile.nationality;
  delete input.profile.passport_number;
  delete input.profile.passport_issue_date;
  delete input.profile.passport_expiry_date;
  input.answers.given_names_en = "Current Given";
  input.answers.surname_en = "Current Surname";
  input.answers.given_names = "Native Given";
  input.answers.surname = "Native Surname";
  input.answers.passport_number = "ab765432";
  input.answers.passport_issue_date = "2021-03-04";
  input.answers.passport_issuance_city = "Beijing";
  input.answers.passport_expiry_date = "2031-03-04";
  input.answers.date_of_birth = "1991-04-05";
  input.answers.birth_country = "SGP";
  input.answers.nationality = "Singapore";

  const result = buildUSAppointmentApplicantDetails(input);

  assert.equal(result.state, "ready");
  if (result.state === "ready") {
    assert.equal(result.data.firstName, "Current Given");
    assert.equal(result.data.lastName, "Current Surname");
    assert.equal(result.data.passportNumber, "AB765432");
    assert.equal(result.data.passportPlaceOfIssue, "Beijing");
    assert.equal(result.data.birthCountry, "Singapore");
    assert.equal(result.data.nationality, "Singapore");
  }
});

test("fails closed when canonical identity answers disagree with the profile", () => {
  const input = completeInput();
  input.answers.passport_number = "AB765432";
  input.answers.date_of_birth = "1991-04-05";
  input.answers.nationality_country = "SGP";

  const result = buildUSAppointmentApplicantDetails(input);

  assert.equal(result.state, "missing");
  if (result.state === "missing") {
    assert.deepEqual(result.missingFields, ["passportNumber", "dateOfBirth", "nationality"]);
  }
});

test("does not replace an invalid canonical answer with a compatibility alias", () => {
  const input = completeInput();
  input.answers.passport_number = "?";
  input.answers.passportNumber = input.profile.passport_number;

  const result = buildUSAppointmentApplicantDetails(input);

  assert.equal(result.state, "missing");
  if (result.state === "missing") assert.deepEqual(result.missingFields, ["passportNumber"]);
});

test("accepts the established scalar value shape used by legacy JSON answer rows", () => {
  const input = completeInput();
  delete input.profile.passport_number;
  input.answers.passport_number = { value: "e9876543" };
  input.answers.date_of_birth = { value: "1990-01-02" };
  input.answers.nationality_country = { value: "CN" };

  const result = buildUSAppointmentApplicantDetails(input);

  assert.equal(result.state, "ready");
  if (result.state === "ready") {
    assert.equal(result.data.passportNumber, "E9876543");
    assert.equal(result.data.dateOfBirth, "1990-01-02");
    assert.equal(result.data.nationality, "China");
  }
});

test("does not stringify arbitrary JSON objects into official fields", () => {
  const input = completeInput();
  input.answers.passport_number = { raw: "E12345678" };
  input.answers.date_of_birth = { date: "1990-01-02" };
  input.answers.nationality_country = { code: "CN" };
  delete input.profile.passport_number;
  delete input.profile.date_of_birth;
  delete input.profile.nationality;

  const result = buildUSAppointmentApplicantDetails(input);

  assert.equal(result.state, "missing");
  if (result.state === "missing") {
    assert.ok(result.missingFields.includes("passportNumber"));
    assert.ok(result.missingFields.includes("dateOfBirth"));
    assert.ok(result.missingFields.includes("nationality"));
  }
});

test("requires separated names and never splits full_name", () => {
  const input = completeInput();
  delete input.profile.given_names_en;
  delete input.profile.surname_en;
  input.profile.full_name = "Zhang Wei Li";
  delete input.answers.given_names;
  delete input.answers.surname;

  const result = buildUSAppointmentApplicantDetails(input);

  assert.equal(result.state, "missing");
  if (result.state === "missing") {
    assert.ok(result.missingFields.includes("firstName"));
    assert.ok(result.missingFields.includes("lastName"));
  }
});

test("rejects non-canonical or impossible dates and unsupported countries", () => {
  const input = completeInput();
  input.answers.date_of_birth = "01/02/1990";
  input.answers.passport_issue_date = "2020-02-30";
  input.answers.passport_expiry_date = "2030-13-01";
  input.answers.birth_country = "Atlantis";
  input.answers.nationality = "ZZZ";
  input.profile.date_of_birth = "1990-02-30";
  input.profile.passport_issue_date = "03/04/2020";
  input.profile.passport_expiry_date = "2030-13-01";
  input.profile.birth_country = "Atlantis";
  input.profile.nationality = "ZZZ";

  const result = buildUSAppointmentApplicantDetails(input);

  assert.equal(result.state, "missing");
  if (result.state === "missing") {
    assert.ok(result.missingFields.includes("dateOfBirth"));
    assert.ok(result.missingFields.includes("passportIssueDate"));
    assert.ok(result.missingFields.includes("passportExpiryDate"));
    assert.ok(result.missingFields.includes("birthCountry"));
    assert.ok(result.missingFields.includes("nationality"));
  }
});

test("fails closed for conflicting identity sources and an E.164 override disagreement", () => {
  const input = completeInput();
  input.answers.passport_number = "AB765432";
  input.answers.mobile_phone = "+86 13800138000";
  input.mobileCallingCode = "+65";

  const result = buildUSAppointmentApplicantDetails(input);

  assert.equal(result.state, "missing");
  if (result.state === "missing") {
    assert.ok(result.missingFields.includes("passportNumber"));
    assert.ok(result.missingFields.includes("mobilePhone"));
  }
});

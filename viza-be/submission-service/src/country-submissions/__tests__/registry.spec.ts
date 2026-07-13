import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCountrySubmissionApplication,
  getCountrySubmissionProvider,
  listCountrySubmissionProviders,
  runDryRunSubmission,
} from "../index";
import type { CountrySubmissionApplication } from "../types";
import type { ApplicantProfile, Application } from "../../types";

function baseApplication(
  overrides: Partial<CountrySubmissionApplication> = {},
): CountrySubmissionApplication {
  return {
    applicationId: "11111111-2222-4333-8444-555555555555",
    userId: "test-user",
    applicantId: "test-applicant",
    countryCode: "canada",
    visaType: "CA_TRV",
    profile: {
      fullName: "Alex Tan",
      dateOfBirth: "1999-01-15",
      gender: "Male",
      nationality: "Singapore",
      passportNumber: "TEST123456",
      passportIssueDate: "2023-01-01",
      passportExpiryDate: "2033-01-01",
      passportIssuingCountry: "Singapore",
      email: "test.viza.user@example.com",
      phone: "+6591234567",
      address: "1 Test Street, Singapore 000001",
      occupation: "Student",
      employerOrSchool: "National University of Singapore",
    },
    trip: {
      destinationCountry: "Canada",
      destinationCity: "Toronto",
      arrivalDate: "2026-10-01",
      departureDate: "2026-10-10",
      purpose: "Tourism",
      accommodationName: "Test Hotel",
      accommodationAddress: "1 Test Hotel Road",
      funding: "Self-funded",
      budget: "Medium",
    },
    answers: {
      has_criminal_record: "No",
      overstay_history: "No",
    },
    metadata: { test: true },
    ...overrides,
  };
}

function vietnamAnswers(): Record<string, string> {
  return {
    surname: "TAN",
    given_name: "ALEX",
    date_of_birth: "1999-01-15",
    sex: "male",
    nationality: "Singapore",
    email_address: "test.viza.user@example.com",
    re_enter_email_address: "test.viza.user@example.com",
    religion: "None",
    place_of_birth: "Singapore",
    has_multiple_nationalities: "no",
    has_violated_vietnam_laws: "no",
    visa_type_requested: "single",
    visa_valid_from: "2026-10-01",
    visa_valid_to: "2026-10-30",
    passport_number: "TEST123456",
    passport_type: "ordinary_passport",
    passport_issue_date: "2023-01-01",
    passport_expiry_date: "2033-01-01",
    permanent_residential_address: "1 Test Street, Singapore 000001",
    contact_address: "1 Test Street, Singapore 000001",
    telephone_number: "+6591234567",
    emergency_contact_full_name: "Jamie Tan",
    emergency_contact_current_address: "2 Test Street, Singapore 000002",
    emergency_contact_telephone: "+6597654321",
    emergency_contact_relationship: "Sibling",
    purpose_of_entry: "tourist",
    intended_date_of_entry: "2026-10-01",
    intended_length_of_stay: "10",
    residential_address_in_vietnam: "1 Nguyen Hue Street, Ho Chi Minh City",
    intended_province_city: "ho_chi_minh_city",
    intended_ward_commune: "Ben Thanh",
    intended_border_gate_of_entry: "tan_son_nhat_int_airport_ho_chi_minh_city",
    intended_border_gate_of_exit: "tan_son_nhat_int_airport_ho_chi_minh_city",
    declaration_temporary_residence: "true",
    visited_vietnam_in_last_year: "no",
    has_relatives_in_vietnam: "no",
    final_declaration: "true",
  };
}

test("registry: every provider declares implementation and dry-run metadata", () => {
  const providers = listCountrySubmissionProviders();
  assert.ok(providers.length >= 20);
  for (const provider of providers) {
    assert.ok(provider.countryCode);
    assert.ok(provider.displayName);
    assert.ok(provider.supportedVisaTypes.length > 0);
    assert.ok(provider.schemaVersion);
    assert.ok(provider.implementationStatus);
    assert.equal(typeof provider.dryRunAvailable, "boolean");
    assert.equal(typeof provider.sandboxAvailable, "boolean");
    assert.equal(typeof provider.realSubmitAvailable, "boolean");
    assert.ok(provider.requiredFields.some((field) => field.required));
  }
});

test("registry: resolves by country and visa type", () => {
  assert.equal(getCountrySubmissionProvider("canada", "CA_TRV")?.countryCode, "CA");
  assert.equal(getCountrySubmissionProvider("germany", "EU_SCHENGEN_C_SHORT_STAY")?.countryCode, "SCHENGEN");
  assert.equal(getCountrySubmissionProvider("indonesia", "ID_C1_TOURIST")?.countryCode, "ID");
  assert.equal(getCountrySubmissionProvider("indonesia", "ID_B1_EVOA")?.countryCode, "ID");
  assert.equal(getCountrySubmissionProvider("vietnam", "VN_PREARRIVAL_DECLARATION")?.countryCode, "VN");
  assert.equal(getCountrySubmissionProvider("taiwan", "TW_OVERSEAS_CN_TOURISM_ENTRY_PERMIT")?.countryCode, "TW");
  assert.equal(getCountrySubmissionProvider("unknownland", "NOPE"), null);
});

test("registry: Taiwan entry permit requires the Singapore eligibility route and declaration", async () => {
  const answers = {
    eligibility_route: "work_one_year", permit_type: "single", singapore_residence_pass_number: "EP123", singapore_residence_expiry_date: "2030-01-01",
    surname: "ZHANG", given_names: "SAN", chinese_name: "张三", date_of_birth: "1990-01-01", gender: "male", passport_number: "E12345678", passport_expiry_date: "2030-01-01",
    real_email_address: "user@example.com", phone_country_code: "+65", phone_number: "81234567", singapore_residential_address: "Singapore", intended_arrival_date: "2027-01-01", intended_departure_date: "2027-01-10", taiwan_accommodation_address: "Taipei", official_declaration: "true",
  };
  const application = baseApplication({ countryCode: "taiwan", visaType: "TW_OVERSEAS_CN_TOURISM_ENTRY_PERMIT", answers });
  const provider = getCountrySubmissionProvider("taiwan", "TW_OVERSEAS_CN_TOURISM_ENTRY_PERMIT");
  assert.ok(provider);
  assert.equal(provider.validate(application).ok, true);
  const result = await runDryRunSubmission(application);
  assert.equal(result.status, "submitted_mock");
  assert.match(result.confirmationNumber ?? "", /^DRYRUN-TW-ENTRY-/);
});

test("registry: Vietnam Pre-Arrival declaration validates dedicated answers", async () => {
  const application = baseApplication({
    countryCode: "vietnam",
    visaType: "VN_PREARRIVAL_DECLARATION",
    answers: {
      expected_arrival_date: "2026-07-14",
      passport_type: "P",
      passport_number: "TEST123456",
      passport_expiry_date: "2033-01-01",
      gender: "male",
      given_name: "ALEX",
      date_of_birth: "1999-01-15",
      nationality: "Singapore",
      phone_country_code: "+65",
      phone_number: "91234567",
      alias_email_address: "alias-test@inbox.viza.test",
      visa_information_acknowledgement: "true",
      visa_type: "EV",
      visa_number: "123456789",
      visa_expiry_date: "2026-08-01",
      departure_country_before_arrival: "Singapore",
      purpose_of_travel: "travel",
      mode_of_travel: "air",
      flight_number: "VJ5439_CXR",
      border_gate_airport: "CXR",
      accommodation_type: "hotel",
      province_city_of_hotel: "Da Nang City",
      ward_commune_of_hotel: "Hoa Xuan Ward",
      hotel_accommodation_address: "T&D Hoi An House",
      final_declaration: "true",
    },
  });
  const provider = getCountrySubmissionProvider("vietnam", "VN_PREARRIVAL_DECLARATION");
  assert.ok(provider);
  assert.equal(provider.validate(application).ok, true);
  const payload = provider.mapToSubmissionPayload(application);
  assert.equal(payload.countrySpecific.expected_arrival_date, "2026-07-14");
  assert.equal(payload.countrySpecific.flight_number, "VJ5439_CXR");
  assert.equal(payload.countrySpecific.hotel_accommodation_address, "T&D Hoi An House");
  const result = await runDryRunSubmission(application, {
    dryRun: true,
    idempotencyKey: "registry-vn-prearrival",
  });
  assert.equal(result.status, "submitted_mock");
  assert.match(result.confirmationNumber ?? "", /^DRYRUN-VNPREARRIVAL-/);
});

test("registry: valid base profile dry-runs with a mock confirmation", async () => {
  const result = await runDryRunSubmission(baseApplication());
  assert.equal(result.status, "submitted_mock");
  assert.equal(result.mode, "dry_run");
  assert.equal(result.targetCountry, "CA");
  assert.match(result.confirmationNumber ?? "", /^MOCK-CA-/);
});

test("registry: US DS-160 dry-run uses DS-160 confirmation prefix", async () => {
  const result = await runDryRunSubmission(
    baseApplication({
      countryCode: "united_states",
      visaType: "DS160",
      trip: {
        ...baseApplication().trip,
        destinationCountry: "United States",
      },
      answers: {
        has_specific_travel_plans: "no",
        purpose_of_trip: "B",
        purpose_of_trip_specify: "B1-B2",
        intended_arrival_date: "2026-10-01",
        intended_length_of_stay_value: "10",
        intended_length_of_stay_unit: "D",
      },
    }),
  );
  assert.equal(result.status, "submitted_mock");
  assert.equal(result.mode, "dry_run");
  assert.equal(result.targetCountry, "US");
  assert.match(result.confirmationNumber ?? "", /^DRYRUN-DS160-111111112222-\d{14}$/);
});

test("registry: France Schengen dry-run resolves to the Schengen provider", async () => {
  const result = await runDryRunSubmission(
    baseApplication({
      countryCode: "france",
      visaType: "EU_SCHENGEN_C_SHORT_STAY",
      trip: {
        ...baseApplication().trip,
        destinationCountry: "France",
        destinationCity: "Paris",
      },
    }),
  );
  assert.equal(result.status, "submitted_mock");
  assert.equal(result.mode, "dry_run");
  assert.equal(result.targetCountry, "SCHENGEN");
  assert.match(result.confirmationNumber ?? "", /^MOCK-SCHENGEN-111111112222$/);
});

test("from-records: maps Schengen dynamic answers into required dry-run trip fields", async () => {
  const profile: ApplicantProfile = {
    id: "test-applicant",
    auth_user_id: "test-user",
    full_name: "Alex Tan",
    date_of_birth: "1999-01-15",
    place_of_birth: "Singapore",
    gender: "Male",
    nationality: "Singapore",
    occupation: "Student",
    address: "1 Test Street, Singapore 000001",
    passport_number: "TEST123456",
    passport_issue_date: "2023-01-01",
    passport_expiry_date: "2033-01-01",
    issuing_country: "Singapore",
    issuing_authority: "ICA",
    email: "test.viza.user@example.com",
    phone: "+6591234567",
    wechat: null,
  };
  const application: Application = {
    id: "11111111-2222-4333-8444-555555555555",
    applicant_id: "test-applicant",
    country: "france",
    visa_type: "EU_SCHENGEN_C_SHORT_STAY",
    status: "submitted",
    arrival_date: null,
    departure_date: null,
    port_of_entry: null,
    purpose: null,
    accommodation_name: null,
    accommodation_address: null,
    confirmation_number: null,
    submitted_at: null,
    visa_package_id: "test-package",
    ds160_application_id: null,
    ds160_retrieval_url: null,
    ds160_dat_storage_path: null,
  };

  const dryRunApplication = buildCountrySubmissionApplication(profile, application, {
    intended_arrival_date: "2026-10-01",
    intended_departure_date: "2026-10-10",
    purpose_of_journey: "tourism",
    accommodation_name: "Test Hotel",
    accommodation_address_line_1: "1 Test Hotel Road",
  });

  assert.equal(dryRunApplication.trip.arrivalDate, "2026-10-01");
  assert.equal(dryRunApplication.trip.departureDate, "2026-10-10");
  assert.equal(dryRunApplication.trip.purpose, "tourism");
  assert.equal(dryRunApplication.trip.accommodationName, "Test Hotel");

  const result = await runDryRunSubmission(dryRunApplication);
  assert.equal(result.status, "submitted_mock");
  assert.equal(result.targetCountry, "SCHENGEN");
});

test("from-records: maps common Vietnam fields into runner-required aliases", () => {
  const profile: ApplicantProfile = {
    id: "test-applicant",
    auth_user_id: "test-user",
    full_name: "Alex Tan",
    date_of_birth: "1999-01-15",
    place_of_birth: "Singapore",
    gender: "male",
    nationality: "Singapore",
    occupation: "Student",
    address: "1 Test Street, Singapore 000001",
    passport_number: "TEST123456",
    passport_issue_date: "2023-01-01",
    passport_expiry_date: "2033-01-01",
    issuing_country: "Singapore",
    issuing_authority: "ICA",
    email: "test.viza.user@example.com",
    phone: "+6591234567",
    wechat: null,
  };
  const application: Application = {
    id: "11111111-2222-4333-8444-555555555555",
    applicant_id: "test-applicant",
    country: "vietnam",
    visa_type: "evisa_tourism",
    status: "submitted",
    arrival_date: "2026-10-01",
    departure_date: "2026-10-10",
    port_of_entry: null,
    purpose: "tourist",
    accommodation_name: "Test Hotel",
    accommodation_address: "1 Nguyen Hue Street, Ho Chi Minh City",
    confirmation_number: null,
    submitted_at: null,
    visa_package_id: "test-package",
    ds160_application_id: null,
    ds160_retrieval_url: null,
    ds160_dat_storage_path: null,
  };

  const dryRunApplication = buildCountrySubmissionApplication(profile, application, {
    given_names: "ALEX",
    passport_document_type: "ordinary_passport",
    employer_name: "Test Company",
    employer_position: "Engineer",
    employer_address: "1 Employer Road",
    employer_phone: "+8610123456789",
    vietnam_phone_number: "+84900000000",
    province_city: "ha_noi",
    ward_commune: "phuong_my_binh",
    intended_border_gate_entry: "noi_bai_int_airport_ha_noi",
    intended_border_gate_exit: "noi_bai_int_airport_ha_noi",
    did_you_buy_insurance: "yes",
    trip_expense_payer: "personal",
  });
  const answers = dryRunApplication.answers ?? {};

  assert.equal(dryRunApplication.trip.purpose, "tourist");
  assert.equal(dryRunApplication.trip.accommodationName, "Test Hotel");
  assert.equal(answers.given_name, "ALEX");
  assert.equal(answers.re_enter_email_address, "test.viza.user@example.com");
  assert.equal(answers.intended_date_of_entry, "2026-10-01");
  assert.equal(answers.intended_length_of_stay, "10");
  assert.equal(answers.residential_address_in_vietnam, "1 Nguyen Hue Street, Ho Chi Minh City");
  assert.equal(answers.company_or_school_name, "Test Company");
  assert.equal(answers.position_course, "Engineer");
  assert.equal(answers.company_address, "1 Employer Road");
  assert.equal(answers.company_phone, "+8610123456789");
  assert.equal(answers.phone_in_vietnam, "+84900000000");
  assert.equal(answers.intended_province_city, "ha_noi");
  assert.equal(answers.intended_ward_commune, "phuong_my_binh");
  assert.equal(answers.intended_border_gate_of_entry, "noi_bai_int_airport_ha_noi");
  assert.equal(answers.intended_border_gate_of_exit, "noi_bai_int_airport_ha_noi");
  assert.equal(answers.bought_travel_insurance, "yes");
  assert.equal(answers.expense_coverage, "personal");
});

test("from-records: maps Thailand TDAC profile and alias fields into runner-required answers", () => {
  const profile: ApplicantProfile = {
    id: "test-applicant",
    auth_user_id: "test-user",
    full_name: "CHEN HONGYU",
    date_of_birth: "2006-07-27",
    place_of_birth: "Changsha",
    gender: "male",
    nationality: "CHN",
    occupation: "Software Engineer",
    address: "Changsha, Hunan, China",
    passport_number: "EM7429107",
    passport_issue_date: "2024-06-25",
    passport_expiry_date: "2034-06-24",
    issuing_country: "CHN",
    issuing_authority: "China",
    email: "test.viza.user@example.com",
    phone: "+8613312345678",
    wechat: null,
  };
  const application: Application = {
    id: "11111111-2222-4333-8444-555555555555",
    applicant_id: "test-applicant",
    country: "thailand",
    visa_type: "TH_TDAC_ARRIVAL_CARD",
    status: "submitted",
    arrival_date: "2026-10-01",
    departure_date: "2026-10-10",
    port_of_entry: null,
    purpose: "tourism",
    accommodation_name: null,
    accommodation_address: "1 Test Hotel Road, Bangkok",
    confirmation_number: null,
    submitted_at: null,
    visa_package_id: "test-package",
    ds160_application_id: null,
    ds160_retrieval_url: null,
    ds160_dat_storage_path: null,
  };

  const tdacApplication = buildCountrySubmissionApplication(profile, application, {
    city_state_of_residence: "TIBET",
    phone_number: "13312345678",
    arrival_mode_of_travel: "air",
    arrival_mode_of_transport: "commercial_flight",
    arrival_transport_number: "SQ221",
    departure_mode_of_travel: "air",
    departure_mode_of_transport: "commercial_flight",
    departure_transport_number: "SQ222",
    countries_visited_last_14_days: "CHN",
    accommodation_type: "guest_house",
    province: "bangkok",
    address_in_thailand: "1 Test Hotel Road, Bangkok",
  });
  const provider = getCountrySubmissionProvider("thailand", "TH_TDAC_ARRIVAL_CARD");
  assert.ok(provider);
  const answers = tdacApplication.answers ?? {};

  assert.equal(answers.family_name, "CHEN");
  assert.equal(answers.first_name, "HONGYU");
  assert.equal(answers.country_territory_of_residence, "CHN");
  assert.equal(answers.phone_country_code, "86");
  assert.equal(answers.occupation, "Software Engineer");
  assert.equal(provider.validate(tdacApplication).ok, true);
});

test("registry: Vietnam provider retains seeded answers in dry-run payload", () => {
  const provider = getCountrySubmissionProvider("vietnam", "VN_E_VISA");
  assert.ok(provider);
  const payload = provider.mapToSubmissionPayload(
    baseApplication({
      countryCode: "vietnam",
      visaType: "VN_E_VISA",
      trip: {
        ...baseApplication().trip,
        destinationCountry: "Vietnam",
        destinationCity: "Ho Chi Minh City",
      },
      answers: vietnamAnswers(),
    }),
  );

  assert.equal(payload.countryCode, "VN");
  assert.equal(payload.countrySpecific.surname, "TAN");
  assert.equal(payload.countrySpecific.intended_border_gate_of_entry, "tan_son_nhat_int_airport_ho_chi_minh_city");
  assert.equal(payload.countrySpecific.final_declaration, "true");
});

test("registry: SG Arrival Card maps purpose_of_travel into validation and payload", async () => {
  const provider = getCountrySubmissionProvider("singapore", "SG_ARRIVAL_CARD");
  assert.ok(provider);

  const application = baseApplication({
    countryCode: "singapore",
    visaType: "SG_ARRIVAL_CARD",
    trip: {
      ...baseApplication().trip,
      destinationCountry: "Singapore",
      purpose: null,
    },
    answers: {
      purpose_of_travel: "holiday",
      place_of_birth_country: "Singapore",
      place_of_residence: "CHINA, BEIJING, BEIJING",
      mobile_country_code: "65",
      has_used_different_name_to_enter_singapore: "no",
      last_city_or_port_before_singapore: "Kuala Lumpur",
      next_city_or_port_after_singapore: "Bangkok",
      mode_of_travel: "air",
      air_transport_type: "commercial",
      carrier_code: "SQ",
      transport_number: "SQ317",
      accommodation_type: "others",
      accommodation_other_type: "friends",
      recent_country_visit_history: "none",
      has_health_symptoms: "no",
      health_declaration: "yes",
      official_submission_acknowledgement: "yes",
      final_declaration: "yes",
    },
  });

  const payload = provider.mapToSubmissionPayload(application);
  assert.equal(payload.trip.purpose, "holiday");
  assert.equal(payload.countrySpecific.purpose_of_travel, "holiday");
  assert.equal(payload.countrySpecific.mode_of_travel, "air");

  const result = await runDryRunSubmission(application);
  assert.equal(result.status, "submitted_mock");
  assert.equal(result.targetCountry, "SG");
});

test("registry: SG Arrival Card rejects missing purpose_of_travel without using SG visitor visa", async () => {
  const result = await runDryRunSubmission(
    baseApplication({
      countryCode: "singapore",
      visaType: "SG_ARRIVAL_CARD",
      trip: {
        ...baseApplication().trip,
        destinationCountry: "Singapore",
        purpose: null,
      },
      answers: {
        mode_of_travel: "air",
        transport_number: "SQ317",
        place_of_residence: "CHINA, BEIJING, BEIJING",
        last_city_or_port_before_singapore: "Kuala Lumpur",
        next_city_or_port_after_singapore: "Bangkok",
        accommodation_type: "others",
        health_declaration: "yes",
        official_submission_acknowledgement: "yes",
        final_declaration: "yes",
      },
    }),
  );

  assert.equal(result.status, "unsupported");
  assert.match(result.message, /answers\.purpose_of_travel/);
  assert.equal(result.targetCountry, "SG");
});

test("registry: Vietnam dry-run uses deterministic Vietnam confirmation", async () => {
  const result = await runDryRunSubmission(
    baseApplication({
      countryCode: "vietnam",
      visaType: "VN_E_VISA",
      trip: {
        ...baseApplication().trip,
        destinationCountry: "Vietnam",
        destinationCity: "Ho Chi Minh City",
      },
      answers: vietnamAnswers(),
    }),
  );
  assert.equal(result.status, "submitted_mock");
  assert.equal(result.mode, "dry_run");
  assert.equal(result.targetCountry, "VN");
  assert.match(result.confirmationNumber ?? "", /^DRYRUN-VN-111111112222-\d{14}$/);
});

test("registry: Vietnam legacy evisa_tourism alias resolves to Vietnam dry-run", async () => {
  const result = await runDryRunSubmission(
    baseApplication({
      countryCode: "vietnam",
      visaType: "evisa_tourism",
      trip: {
        ...baseApplication().trip,
        destinationCountry: "Vietnam",
        destinationCity: "Ho Chi Minh City",
      },
      answers: vietnamAnswers(),
    }),
  );
  assert.equal(result.status, "submitted_mock");
  assert.equal(result.targetCountry, "VN");
  assert.match(result.confirmationNumber ?? "", /^DRYRUN-VN-111111112222-\d{14}$/);
});

test("registry: missing required fields fail validation cleanly", async () => {
  const result = await runDryRunSubmission(
    baseApplication({
      profile: {
        ...baseApplication().profile,
        passportNumber: "",
      },
    }),
  );
  assert.equal(result.status, "unsupported");
  assert.match(result.message, /profile\.passportNumber/);
});

test("registry: Vietnam missing required schema answers fail validation cleanly", async () => {
  const answers = vietnamAnswers();
  delete answers.passport_number;
  const result = await runDryRunSubmission(
    baseApplication({
      countryCode: "vietnam",
      visaType: "VN_E_VISA",
      trip: {
        ...baseApplication().trip,
        destinationCountry: "Vietnam",
      },
      answers,
    }),
  );
  assert.equal(result.status, "unsupported");
  assert.match(result.message, /answers\.passport_number/);
});

test("registry: Vietnam conditional schema answers are enforced only when gated on", async () => {
  const answers: Record<string, string> = {
    ...vietnamAnswers(),
    has_relatives_in_vietnam: "yes",
  };
  delete answers.relative_full_name_in_vn;

  const result = await runDryRunSubmission(
    baseApplication({
      countryCode: "vietnam",
      visaType: "VN_E_VISA",
      trip: {
        ...baseApplication().trip,
        destinationCountry: "Vietnam",
      },
      answers,
    }),
  );

  assert.equal(result.status, "unsupported");
  assert.match(result.message, /answers\.relative_full_name_in_vn/);
});

test("registry: unsupported countries return a controlled unsupported result", async () => {
  const result = await runDryRunSubmission(
    baseApplication({
      countryCode: "atlantis",
      visaType: "ATLANTIS_VISITOR",
      trip: {
        ...baseApplication().trip,
        destinationCountry: "Atlantis",
      },
    }),
  );
  assert.equal(result.status, "unsupported");
  assert.equal(result.message, "Submission for this country is not implemented yet.");
});

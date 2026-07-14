import type {
  ApplicantProfile,
  Application,
} from "../types";
import type { CountrySubmissionApplication } from "./types";

function firstAnswer(
  answers: Record<string, string>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = answers[key];
    if (value?.trim()) return value.trim();
  }
  return null;
}

function firstValue(values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (value?.trim()) return value.trim();
  }
  return null;
}

function setIfMissing(
  answers: Record<string, string>,
  key: string,
  values: Array<string | null | undefined>,
): void {
  if (answers[key]?.trim()) return;
  const value = firstValue(values);
  if (value) answers[key] = value;
}

function splitProfileName(fullName: string | null | undefined): {
  givenNames: string | null;
  surname: string | null;
} {
  const parts = fullName?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return { givenNames: null, surname: null };
  if (parts.length === 1) return { givenNames: null, surname: parts[0] ?? null };
  return {
    givenNames: parts.slice(0, -1).join(" "),
    surname: parts.at(-1) ?? null,
  };
}

function splitTdacFullName(fullName: string | null | undefined): {
  familyName: string | null;
  firstName: string | null;
} {
  const parts = fullName?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return { familyName: null, firstName: null };
  return {
    familyName: parts[0] ?? null,
    firstName: parts[1] ?? null,
  };
}

function dayDiffInclusive(start: string | null | undefined, end: string | null | undefined): string | null {
  if (!start || !end) return null;
  const startTime = Date.parse(start);
  const endTime = Date.parse(end);
  if (Number.isNaN(startTime) || Number.isNaN(endTime) || endTime < startTime) return null;
  return String(Math.max(1, Math.round((endTime - startTime) / 86_400_000) + 1));
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isIsoDateOnOrAfter(value: string | null | undefined, minDate: string): boolean {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= minDate);
}

function chooseVietnamFutureDate(...values: Array<string | null | undefined>): string {
  const today = todayIso();
  return values.find((value) => isIsoDateOnOrAfter(value, today)) ?? today;
}

function normalizeVietnamTravelDates(
  answers: Record<string, string>,
  application: Application,
): void {
  const entryDate = chooseVietnamFutureDate(
    application.arrival_date,
    answers.arrival_date,
    answers.planned_arrival_date,
    answers.intended_arrival_date,
    answers.intended_date_of_entry,
    answers.visa_valid_from,
  );
  if (!isIsoDateOnOrAfter(answers.visa_valid_from, todayIso())) {
    answers.visa_valid_from = entryDate;
  }
  if (!isIsoDateOnOrAfter(answers.intended_date_of_entry, todayIso())) {
    answers.intended_date_of_entry = entryDate;
  }
}

function phoneCountryCode(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/[^\d+]/g, "");
  if (!digits.startsWith("+")) return null;
  const number = digits.slice(1);
  const knownCodes = [
    "1",
    "7",
    "20",
    "27",
    "30",
    "31",
    "32",
    "33",
    "34",
    "36",
    "39",
    "40",
    "41",
    "44",
    "45",
    "46",
    "47",
    "48",
    "49",
    "52",
    "55",
    "60",
    "61",
    "62",
    "63",
    "64",
    "65",
    "66",
    "81",
    "82",
    "84",
    "86",
    "90",
    "91",
    "92",
    "93",
    "94",
    "95",
    "98",
    "212",
    "213",
    "216",
    "218",
    "234",
    "251",
    "254",
    "255",
    "256",
    "351",
    "352",
    "353",
    "354",
    "355",
    "356",
    "357",
    "358",
    "359",
    "370",
    "371",
    "372",
    "373",
    "374",
    "375",
    "376",
    "377",
    "380",
    "381",
    "382",
    "385",
    "386",
    "387",
    "389",
    "420",
    "421",
    "852",
    "853",
    "855",
    "856",
    "880",
    "886",
    "971",
    "972",
    "973",
    "974",
    "975",
    "976",
    "977",
    "994",
    "995",
    "996",
    "998",
  ];
  return knownCodes.find((code) => number.startsWith(code)) ?? null;
}

export function applyVietnamAnswerAliases(
  answers: Record<string, string>,
  profile: ApplicantProfile,
  application: Application,
): Record<string, string> {
  const profileName = splitProfileName(profile.full_name);
  const arrivalDate = firstValue([
    answers.expected_arrival_date,
    answers.intended_date_of_entry,
    application.arrival_date,
    answers.intended_arrival_date,
    answers.arrival_date,
    answers.planned_arrival_date,
    answers.trip_start_date,
  ]);
  const departureDate = firstValue([
    answers.visa_valid_to,
    application.departure_date,
    answers.intended_departure_date,
    answers.departure_date,
    answers.planned_departure_date,
    answers.trip_end_date,
  ]);
  const purpose = firstValue([
    answers.purpose_of_entry,
    application.purpose,
    answers.purpose_of_journey,
    answers.main_purpose_of_journey,
    answers.purpose_of_stay,
    answers.purpose_of_visit,
    answers.visit_purpose,
    answers.main_purpose_of_visit,
    answers.purpose_of_trip,
  ]);
  const accommodationName = firstValue([
    answers.accommodation_name,
    application.accommodation_name,
    answers.hotel_name,
    answers.hotel_or_accommodation_name,
    answers.host_name,
    answers.business_company_name,
    answers.residential_address_in_vietnam,
  ]);
  const accommodationAddress = firstValue([
    answers.residential_address_in_vietnam,
    application.accommodation_address,
    answers.accommodation_address_line_1,
    answers.accommodation_address,
    answers.hotel_address,
    answers.host_address,
  ]);
  const email = firstValue([answers.email_address, profile.email, answers.email, answers.contact_email]);
  const phone = firstValue([answers.telephone_number, profile.phone, answers.phone, answers.phone_number, answers.mobile_phone]);
  const address = firstValue([
    answers.permanent_residential_address,
    profile.address,
    answers.home_address_line_1,
    answers.residential_address_line_1,
    answers.contact_address,
  ]);

  setIfMissing(answers, "surname", [answers.family_name, answers.last_name, profileName.surname]);
  setIfMissing(answers, "given_name", [answers.given_names, answers.givenNames, answers.first_name, profileName.givenNames]);
  setIfMissing(answers, "date_of_birth", [profile.date_of_birth, answers.dob, answers.birth_date]);
  setIfMissing(answers, "sex", [answers.gender, profile.gender]);
  setIfMissing(answers, "nationality", [answers.nationality_country, answers.current_nationality, profile.nationality]);
  setIfMissing(answers, "email_address", [email]);
  setIfMissing(answers, "re_enter_email_address", [answers.email_address, email]);
  setIfMissing(answers, "place_of_birth", [profile.place_of_birth, answers.city_of_birth, answers.birth_city]);
  setIfMissing(answers, "purpose_of_entry", [purpose]);
  setIfMissing(answers, "visa_valid_from", [answers.intended_date_of_entry, arrivalDate]);
  setIfMissing(answers, "visa_valid_to", [departureDate]);
  setIfMissing(answers, "passport_number", [profile.passport_number, answers.travel_document_number]);
  setIfMissing(answers, "passport_type", [answers.passport_document_type, answers.travel_document_type]);
  setIfMissing(answers, "passport_issue_date", [profile.passport_issue_date, answers.passport_issuance_date, answers.date_of_issue]);
  setIfMissing(answers, "passport_expiry_date", [profile.passport_expiry_date, answers.passport_expiration_date, answers.valid_until]);
  setIfMissing(answers, "permanent_residential_address", [address]);
  setIfMissing(answers, "contact_address", [answers.mailing_address, address]);
  setIfMissing(answers, "telephone_number", [phone]);
  // Vietnam Pre-Arrival uses its own expected-arrival key rather than the
  // generic e-Visa intended-entry key. Preserve the official declaration
  // value while also making it available to shared trip-date consumers.
  setIfMissing(answers, "expected_arrival_date", [arrivalDate]);
  setIfMissing(answers, "arrival_date", [answers.expected_arrival_date, arrivalDate]);
  setIfMissing(answers, "intended_date_of_entry", [arrivalDate]);
  setIfMissing(answers, "intended_length_of_stay", [
    answers.intended_length_of_stay_value,
    dayDiffInclusive(arrivalDate, departureDate),
  ]);
  setIfMissing(answers, "company_or_school_name", [
    answers.employer_name,
    answers.employer_school,
    answers.school_name,
    answers.current_employer_or_school,
  ]);
  setIfMissing(answers, "position_course", [answers.employer_position, answers.occupation_position, answers.job_title]);
  setIfMissing(answers, "company_address", [answers.employer_address, answers.school_address]);
  setIfMissing(answers, "company_phone", [answers.employer_phone, answers.school_phone]);
  setIfMissing(answers, "phone_in_vietnam", [answers.vietnam_phone_number, answers.local_phone_in_vietnam]);
  setIfMissing(answers, "residential_address_in_vietnam", [accommodationAddress]);
  setIfMissing(answers, "intended_province_city", [answers.province_city, answers.vietnam_province_city]);
  setIfMissing(answers, "intended_ward_commune", [answers.ward_commune, answers.vietnam_ward_commune]);
  setIfMissing(answers, "intended_border_gate_of_entry", [
    answers.intended_border_gate_entry,
    answers.border_gate_entry,
    answers.port_of_entry,
    application.port_of_entry,
  ]);
  setIfMissing(answers, "intended_border_gate_of_exit", [
    answers.intended_border_gate_exit,
    answers.border_gate_exit,
    answers.port_of_exit,
    application.port_of_entry,
  ]);
  setIfMissing(answers, "bought_travel_insurance", [answers.did_you_buy_insurance, answers.travel_insurance]);
  setIfMissing(answers, "expense_coverage", [answers.trip_expense_payer, answers.expense_payer]);
  setIfMissing(answers, "accommodation_name", [accommodationName]);
  normalizeVietnamTravelDates(answers, application);

  return answers;
}

export function applyThailandTdacAnswerAliases(
  answers: Record<string, string>,
  profile: ApplicantProfile,
  application: Application,
): Record<string, string> {
  const tdacName = splitTdacFullName(firstValue([answers.full_name, answers.full_name_en, profile.full_name]));
  const phone = firstValue([
    answers.phone,
    answers.phone_number,
    answers.mobile_number,
    answers.mobile_phone,
    answers.primary_phone_number,
    profile.phone,
  ]);
  const phoneForCountryCode = firstValue([
    answers.phone,
    answers.mobile_phone,
    answers.primary_phone_number,
    profile.phone,
    answers.phone_number,
    answers.mobile_number,
  ]);

  setIfMissing(answers, "family_name", [answers.surname, answers.last_name, tdacName.familyName]);
  setIfMissing(answers, "first_name", [
    answers.given_names,
    answers.givenNames,
    answers.given_name,
    tdacName.firstName,
  ]);
  setIfMissing(answers, "date_of_birth", [answers.dob, answers.birth_date, profile.date_of_birth]);
  setIfMissing(answers, "gender", [answers.sex, profile.gender]);
  setIfMissing(answers, "nationality", [answers.nationality_country, answers.current_nationality, profile.nationality]);
  setIfMissing(answers, "country_territory_of_residence", [
    answers.country_of_residence,
    answers.residence_country,
    answers.home_country,
    answers.nationality,
    profile.nationality,
  ]);
  setIfMissing(answers, "passport_number", [answers.travel_document_number, profile.passport_number]);
  setIfMissing(answers, "email_address", [answers.email, answers.contact_email, profile.email]);
  setIfMissing(answers, "phone_country_code", [
    answers.mobile_country_code,
    answers.country_calling_code,
    phoneCountryCode(phoneForCountryCode),
  ]);
  setIfMissing(answers, "phone_number", [phone]);
  setIfMissing(answers, "occupation", [
    answers.current_occupation,
    answers.primary_occupation,
    answers.current_profession,
    profile.occupation,
  ]);
  setIfMissing(answers, "arrival_date", [
    answers.intended_arrival_date,
    answers.planned_arrival_date,
    answers.trip_start_date,
    application.arrival_date,
  ]);
  setIfMissing(answers, "departure_date", [
    answers.intended_departure_date,
    answers.planned_departure_date,
    answers.trip_end_date,
    application.departure_date,
  ]);
  setIfMissing(answers, "country_boarded", [
    answers.departure_country,
    answers.country_territory_of_residence,
    answers.nationality,
  ]);
  setIfMissing(answers, "purpose_of_travel", [
    answers.purpose_of_visit,
    answers.purpose_of_trip,
    application.purpose,
  ]);
  setIfMissing(answers, "address_in_thailand", [
    answers.accommodation_address,
    answers.hotel_address,
    application.accommodation_address,
  ]);

  return answers;
}

export function buildCountrySubmissionApplication(
  profile: ApplicantProfile,
  application: Application,
  answers: Record<string, string> = {},
): CountrySubmissionApplication {
  const normalizedAnswers = { ...answers };
  const normalizedCountry = application.country.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const normalizedVisaType = application.visa_type.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const isVietnamApplication =
    normalizedCountry === "vn" ||
    normalizedCountry === "vietnam" ||
    normalizedCountry === "viet_nam" ||
    normalizedVisaType === "vn_e_visa" ||
    normalizedVisaType === "vietnam_e_visa" ||
    normalizedVisaType === "vn_prearrival_declaration";
  if (isVietnamApplication) {
    applyVietnamAnswerAliases(normalizedAnswers, profile, application);
  }
  const isThailandTdac =
    (normalizedCountry === "th" || normalizedCountry === "thailand") &&
    normalizedVisaType === "th_tdac_arrival_card";
  if (isThailandTdac) {
    applyThailandTdacAnswerAliases(normalizedAnswers, profile, application);
  }
  const isSgArrivalCard =
    (normalizedCountry === "sg" || normalizedCountry === "singapore") &&
    normalizedVisaType === "sg_arrival_card";
  if (isSgArrivalCard) {
    setIfMissing(normalizedAnswers, "purpose_of_travel", [
      answers.purpose_of_travel,
      answers.purpose_of_visit,
      application.purpose,
    ]);
  }

  const sgacFullName = isSgArrivalCard
    ? firstAnswer(normalizedAnswers, ["full_name", "full_name_en", "applicant_full_name"])
    : null;
  const sgacEmail = isSgArrivalCard
    ? firstAnswer(normalizedAnswers, ["email_address", "email"])
    : null;
  const sgacPhone = isSgArrivalCard
    ? firstValue([
        [normalizedAnswers.mobile_country_code, normalizedAnswers.mobile_number]
          .filter(Boolean)
          .join(""),
        normalizedAnswers.mobile_number,
      ])
    : null;

  return {
    applicationId: application.id,
    userId: profile.auth_user_id,
    applicantId: application.applicant_id,
    countryCode: application.country,
    visaType: application.visa_type,
    profile: {
      fullName: sgacFullName ?? profile.full_name,
      dateOfBirth: profile.date_of_birth,
      gender: profile.gender,
      nationality: profile.nationality,
      passportNumber: profile.passport_number,
      passportIssueDate: profile.passport_issue_date,
      passportExpiryDate: profile.passport_expiry_date,
      passportIssuingCountry: profile.issuing_country,
      email: sgacEmail ?? profile.email,
      phone: sgacPhone ?? profile.phone,
      address: profile.address,
      occupation: profile.occupation,
      employerOrSchool: firstAnswer(normalizedAnswers, [
        "employer_school",
        "employer_name",
        "school_name",
        "current_employer_or_school",
      ]),
    },
    trip: {
      destinationCountry: firstValue([
        firstAnswer(normalizedAnswers, [
          "destination_country",
          "destination_country_schengen",
          "member_state_main_destination",
          "member_state_destination",
        ]),
        application.country,
      ]) ?? application.country,
      destinationCity: firstAnswer(normalizedAnswers, [
        "destination_city",
        "city_of_stay",
        "uk_destination_city",
        "arrival_city",
        "accommodation_city",
      ]) ?? application.port_of_entry,
      arrivalDate: firstValue([
        application.arrival_date,
        firstAnswer(normalizedAnswers, [
          "intended_arrival_date",
          "arrival_date",
          "planned_arrival_date",
          "trip_start_date",
        ]),
      ]),
      departureDate: firstValue([
        application.departure_date,
        firstAnswer(normalizedAnswers, [
          "intended_departure_date",
          "departure_date",
          "planned_departure_date",
          "trip_end_date",
        ]),
      ]),
      purpose: firstValue([
        application.purpose,
        firstAnswer(normalizedAnswers, [
          "purpose_of_travel",
          "purpose_of_journey",
          "main_purpose_of_journey",
          "purpose_of_stay",
          "purpose_of_visit",
          "purpose_of_entry",
        ]),
      ]),
      accommodationName: firstValue([
        application.accommodation_name,
        firstAnswer(normalizedAnswers, [
          "accommodation_name",
          "hotel_name",
          "hotel_or_accommodation_name",
          "host_name",
          "business_company_name",
          "residential_address_in_vietnam",
        ]),
      ]),
      accommodationAddress: firstValue([
        application.accommodation_address,
        firstAnswer(normalizedAnswers, [
          "accommodation_address_line_1",
          "accommodation_address",
          "hotel_address",
          "host_address",
          "business_company_address_line_1",
        ]),
      ]),
      funding: firstAnswer(normalizedAnswers, ["funding", "trip_funding", "funding_source"]),
      budget: firstAnswer(normalizedAnswers, ["travel_budget", "budget", "intended_expenses_usd"]),
    },
    answers: normalizedAnswers,
    metadata: {
      visaPackageId: application.visa_package_id,
      source: "submission-service",
    },
  };
}

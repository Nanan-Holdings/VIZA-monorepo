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

function dayDiffInclusive(start: string | null | undefined, end: string | null | undefined): string | null {
  if (!start || !end) return null;
  const startTime = Date.parse(start);
  const endTime = Date.parse(end);
  if (Number.isNaN(startTime) || Number.isNaN(endTime) || endTime < startTime) return null;
  return String(Math.max(1, Math.round((endTime - startTime) / 86_400_000) + 1));
}

export function applyVietnamAnswerAliases(
  answers: Record<string, string>,
  profile: ApplicantProfile,
  application: Application,
): Record<string, string> {
  const profileName = splitProfileName(profile.full_name);
  const arrivalDate = firstValue([
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
  setIfMissing(answers, "intended_date_of_entry", [arrivalDate]);
  setIfMissing(answers, "intended_length_of_stay", [
    answers.intended_length_of_stay_value,
    dayDiffInclusive(arrivalDate, departureDate),
  ]);
  setIfMissing(answers, "residential_address_in_vietnam", [accommodationAddress]);
  setIfMissing(answers, "accommodation_name", [accommodationName]);

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
    normalizedVisaType === "vietnam_e_visa";
  if (isVietnamApplication) {
    applyVietnamAnswerAliases(normalizedAnswers, profile, application);
  }

  return {
    applicationId: application.id,
    userId: profile.auth_user_id,
    applicantId: application.applicant_id,
    countryCode: application.country,
    visaType: application.visa_type,
    profile: {
      fullName: profile.full_name,
      dateOfBirth: profile.date_of_birth,
      gender: profile.gender,
      nationality: profile.nationality,
      passportNumber: profile.passport_number,
      passportIssueDate: profile.passport_issue_date,
      passportExpiryDate: profile.passport_expiry_date,
      passportIssuingCountry: profile.issuing_country,
      email: profile.email,
      phone: profile.phone,
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

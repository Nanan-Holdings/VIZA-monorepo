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

export function buildCountrySubmissionApplication(
  profile: ApplicantProfile,
  application: Application,
  answers: Record<string, string> = {},
): CountrySubmissionApplication {
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
      employerOrSchool: firstAnswer(answers, [
        "employer_school",
        "employer_name",
        "school_name",
        "current_employer_or_school",
      ]),
    },
    trip: {
      destinationCountry: firstValue([
        firstAnswer(answers, [
          "destination_country",
          "destination_country_schengen",
          "member_state_main_destination",
          "member_state_destination",
        ]),
        application.country,
      ]) ?? application.country,
      destinationCity: firstAnswer(answers, [
        "destination_city",
        "city_of_stay",
        "uk_destination_city",
        "arrival_city",
        "accommodation_city",
      ]) ?? application.port_of_entry,
      arrivalDate: firstValue([
        application.arrival_date,
        firstAnswer(answers, [
          "intended_arrival_date",
          "arrival_date",
          "planned_arrival_date",
          "trip_start_date",
        ]),
      ]),
      departureDate: firstValue([
        application.departure_date,
        firstAnswer(answers, [
          "intended_departure_date",
          "departure_date",
          "planned_departure_date",
          "trip_end_date",
        ]),
      ]),
      purpose: firstValue([
        application.purpose,
        firstAnswer(answers, [
          "purpose_of_journey",
          "main_purpose_of_journey",
          "purpose_of_stay",
          "purpose_of_visit",
        ]),
      ]),
      accommodationName: firstValue([
        application.accommodation_name,
        firstAnswer(answers, [
          "accommodation_name",
          "hotel_name",
          "hotel_or_accommodation_name",
          "host_name",
          "business_company_name",
        ]),
      ]),
      accommodationAddress: firstValue([
        application.accommodation_address,
        firstAnswer(answers, [
          "accommodation_address_line_1",
          "accommodation_address",
          "hotel_address",
          "host_address",
          "business_company_address_line_1",
        ]),
      ]),
      funding: firstAnswer(answers, ["funding", "trip_funding", "funding_source"]),
      budget: firstAnswer(answers, ["travel_budget", "budget", "intended_expenses_usd"]),
    },
    answers,
    metadata: {
      visaPackageId: application.visa_package_id,
      source: "submission-service",
    },
  };
}

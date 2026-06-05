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
      destinationCountry: application.country,
      destinationCity: firstAnswer(answers, [
        "destination_city",
        "city_of_stay",
        "uk_destination_city",
        "arrival_city",
      ]) ?? application.port_of_entry,
      arrivalDate: application.arrival_date,
      departureDate: application.departure_date,
      purpose: application.purpose,
      accommodationName: application.accommodation_name,
      accommodationAddress: application.accommodation_address,
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

import type { SubmissionPayload } from "../country-submissions/types";

export const VN_PREARRIVAL_OFFICIAL_PORTAL_URL = "https://prearrival.immigration.gov.vn/";

export type VnPrearrivalTravelMode = "air" | "land" | "sea";

export interface VnPrearrivalPortalPayload {
  applicationId: string;
  expectedArrivalDate: string;
  passportType: string;
  passportNumber: string;
  passportExpiryDate: string;
  gender: string;
  surname: string | null;
  givenName: string;
  dateOfBirth: string;
  nationality: string;
  emailAddress: string;
  realEmailAddress: string | null;
  phoneCountryCode: string;
  phoneNumber: string;
  visaInformationAcknowledgement: boolean;
  visaType: string;
  visaNumber: string;
  visaIssueDate: string | null;
  visaExpiryDate: string;
  visaIssuedPlace: string | null;
  departureCountryBeforeArrival: string;
  purposeOfTravel: string;
  modeOfTravel: VnPrearrivalTravelMode;
  flightNumber: string | null;
  borderGateAirport: string | null;
  vehicleIdentificationNumber: string | null;
  landBorderGate: string | null;
  seaPort: string | null;
  accommodationType: string;
  provinceCityOfHotel: string;
  wardCommuneOfHotel: string;
  accommodationAddress: string;
  workplaceInformation: string | null;
  departureDateFromVietnam: string | null;
  finalDeclaration: boolean;
}

export class VnPrearrivalPortalValidationError extends Error {
  readonly code = "vn_prearrival_portal_payload_validation_failed";

  constructor(message: string, readonly missingFields: string[]) {
    super(message);
    this.name = "VnPrearrivalPortalValidationError";
  }
}

export function routeVnPrearrivalEmailAnswers(
  answers: Record<string, string>,
  aliasEmailAddress: string,
  profileEmailAddress?: string | null,
): Record<string, string> {
  const alias = aliasEmailAddress.trim().toLowerCase();
  if (!alias) throw new Error("Vietnam Pre-Arrival requires a VIZA-managed alias email.");

  const realEmailAddress = [
    answers.real_email_address,
    profileEmailAddress,
    answers.email_address,
  ].find((value) => value?.trim())?.trim().toLowerCase();

  return {
    ...answers,
    ...(realEmailAddress ? { real_email_address: realEmailAddress } : {}),
    alias_email_address: alias,
  };
}

function answer(payload: SubmissionPayload, key: string): string {
  return (payload.countrySpecific[key] ?? "").trim();
}

function requireAnswer(payload: SubmissionPayload, key: string, missing: string[]): string {
  const value = answer(payload, key);
  if (!value) missing.push(`answers.${key}`);
  return value;
}

function booleanAnswer(payload: SubmissionPayload, key: string): boolean {
  const value = answer(payload, key).toLowerCase();
  return value === "true" || value === "yes" || value === "1";
}

function requireBooleanTrue(payload: SubmissionPayload, key: string, missing: string[]): boolean {
  const value = booleanAnswer(payload, key);
  if (!value) missing.push(`answers.${key}`);
  return value;
}

function travelMode(value: string, missing: string[]): VnPrearrivalTravelMode {
  if (value === "air" || value === "land" || value === "sea") return value;
  missing.push("answers.mode_of_travel");
  return "air";
}

function airportFromFlightNumber(flightNumber: string): string | null {
  const suffix = flightNumber.match(/_([A-Z]{3})$/i)?.[1];
  return suffix ? suffix.toUpperCase() : null;
}

export function normalizeVnPrearrivalPortalPayload(payload: SubmissionPayload): VnPrearrivalPortalPayload {
  const missing: string[] = [];
  if (payload.countryCode !== "VN") missing.push("countryCode");
  if (payload.visaType !== "VN_PREARRIVAL_DECLARATION") missing.push("visaType");

  const modeOfTravel = travelMode(requireAnswer(payload, "mode_of_travel", missing), missing);
  const flightNumber = modeOfTravel === "air" ? requireAnswer(payload, "flight_number", missing) : null;
  const borderGateAirport = modeOfTravel === "air" ? requireAnswer(payload, "border_gate_airport", missing) : null;
  if (!flightNumber && borderGateAirport) {
    missing.push("answers.border_gate_airport(locked_by_flight_number)");
  }
  if (flightNumber && borderGateAirport) {
    const derivedAirport = airportFromFlightNumber(flightNumber);
    if (!derivedAirport || derivedAirport !== borderGateAirport.toUpperCase()) {
      missing.push("answers.border_gate_airport(locked_by_flight_number)");
    }
  }

  const vehicleIdentificationNumber =
    modeOfTravel === "land" || modeOfTravel === "sea"
      ? requireAnswer(payload, "vehicle_identification_number", missing)
      : null;
  const landBorderGate = modeOfTravel === "land" ? requireAnswer(payload, "land_border_gate", missing) : null;
  const seaPort = modeOfTravel === "sea" ? requireAnswer(payload, "sea_port", missing) : null;
  const accommodationType = requireAnswer(payload, "accommodation_type", missing);
  const usesHotelDropdown = accommodationType === "hotel";
  const provinceCityOfHotel = usesHotelDropdown ? requireAnswer(payload, "province_city_of_hotel", missing) : "";
  const wardCommuneOfHotel = usesHotelDropdown ? requireAnswer(payload, "ward_commune_of_hotel", missing) : "";
  const accommodationAddress = usesHotelDropdown
    ? requireAnswer(payload, "hotel_accommodation_address", missing)
    : requireAnswer(payload, "accommodation_address", missing);

  const normalized: VnPrearrivalPortalPayload = {
    applicationId: payload.applicationId,
    expectedArrivalDate: requireAnswer(payload, "expected_arrival_date", missing),
    passportType: requireAnswer(payload, "passport_type", missing),
    passportNumber: requireAnswer(payload, "passport_number", missing),
    passportExpiryDate: requireAnswer(payload, "passport_expiry_date", missing),
    gender: requireAnswer(payload, "gender", missing),
    surname: answer(payload, "surname") || null,
    givenName: requireAnswer(payload, "given_name", missing),
    dateOfBirth: requireAnswer(payload, "date_of_birth", missing),
    nationality: requireAnswer(payload, "nationality", missing),
    emailAddress: requireAnswer(payload, "alias_email_address", missing),
    realEmailAddress: answer(payload, "real_email_address") || answer(payload, "email_address") || null,
    phoneCountryCode: requireAnswer(payload, "phone_country_code", missing),
    phoneNumber: requireAnswer(payload, "phone_number", missing),
    visaInformationAcknowledgement: requireBooleanTrue(payload, "visa_information_acknowledgement", missing),
    visaType: requireAnswer(payload, "visa_type", missing),
    visaNumber: requireAnswer(payload, "visa_number", missing),
    visaIssueDate: answer(payload, "visa_issue_date") || null,
    visaExpiryDate: requireAnswer(payload, "visa_expiry_date", missing),
    visaIssuedPlace: answer(payload, "visa_issued_place") || null,
    departureCountryBeforeArrival: requireAnswer(payload, "departure_country_before_arrival", missing),
    purposeOfTravel: requireAnswer(payload, "purpose_of_travel", missing),
    modeOfTravel,
    flightNumber,
    borderGateAirport,
    vehicleIdentificationNumber,
    landBorderGate,
    seaPort,
    accommodationType,
    provinceCityOfHotel,
    wardCommuneOfHotel,
    accommodationAddress,
    workplaceInformation: answer(payload, "workplace_information") || null,
    departureDateFromVietnam: answer(payload, "departure_date_from_vietnam") || null,
    finalDeclaration: requireBooleanTrue(payload, "final_declaration", missing),
  };

  if (missing.length > 0) {
    throw new VnPrearrivalPortalValidationError(
      `Vietnam Pre-Arrival declaration cannot be submitted because required fields are missing or unsupported: ${missing.join(", ")}.`,
      missing,
    );
  }

  return normalized;
}

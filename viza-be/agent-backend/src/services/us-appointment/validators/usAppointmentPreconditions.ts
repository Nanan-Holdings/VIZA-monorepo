import type {
  AppointmentManualAction,
  USAppointmentApplication,
  ValidationResult,
} from "../types.js";

function isUSApplication(application: USAppointmentApplication): boolean {
  return application.countryCode === "US" || application.country.toLowerCase().includes("united");
}

function isB1B2OrDS160(application: USAppointmentApplication): boolean {
  const visaType = application.visaType?.trim().toUpperCase() ?? "";
  return ["", "B1/B2", "B1_B2", "DS160", "DS-160"].includes(visaType);
}

export function validateUSAppointmentPreconditions(input: {
  application: USAppointmentApplication;
  completedConsent: AppointmentManualAction | null;
  ds160ConfirmationCode: string | null | undefined;
  applyingCountryCode: string | null | undefined;
  applyingPostCity: string | null | undefined;
}): ValidationResult {
  const errors: ValidationResult["errors"] = [];

  if (!isUSApplication(input.application)) {
    errors.push({
      code: "not_us_application",
      message: "Appointment assistance is currently available only for U.S. applications.",
    });
  }
  if (!isB1B2OrDS160(input.application)) {
    errors.push({
      code: "unsupported_visa_type",
      message: "Only U.S. B1/B2 DS-160 appointment assistance is supported.",
    });
  }
  if (!input.completedConsent) {
    errors.push({
      code: "consent_required",
      message: "User consent is required before appointment assistance can start.",
    });
  }
  if (!input.ds160ConfirmationCode?.trim()) {
    errors.push({
      code: "missing_ds160_confirmation",
      message: "DS-160 confirmation code is required before appointment assistance can start.",
    });
  }
  if (!input.applyingCountryCode?.trim() || !input.applyingPostCity?.trim()) {
    errors.push({
      code: "missing_applying_post",
      message: "The DS-160 application must include the interview embassy/consulate city before appointment assistance can start.",
    });
  }

  return { valid: errors.length === 0, errors };
}

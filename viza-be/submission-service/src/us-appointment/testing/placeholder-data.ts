import type {
  AppointmentAccountCredentials,
  SlotInsert,
  USAppointmentJobRow,
} from "../runner";
import {
  buildUSAppointmentApplicantDetails,
  type USAppointmentApplicantDetails,
  type USAppointmentApplicantDetailsResult,
} from "../applicant-details-data";

/** Deliberately synthetic values for local harnesses; never use for live work. */
export const PLACEHOLDER_CREDENTIALS: AppointmentAccountCredentials = {
  email: "placeholder.applicant@example.invalid",
  password: "TestViza9@",
  givenName: "Test",
  surname: "Applicant",
  accountStatus: "account_creation_started",
  emailVerified: false,
};

export const PLACEHOLDER_JOB: USAppointmentJobRow = {
  id: "fixture-job",
  application_id: "fixture-application",
  user_id: "fixture-user",
  appointment_account_id: "fixture-account",
  applying_country_code: "CN",
  applying_post_city: "Beijing",
  scheduling_provider: "usvisascheduling",
  status: "appointment_consent_received",
  mode: "assisted_live",
  user_preferences_json: null,
  requires_user_action: false,
  current_manual_action: null,
  updated_at: "2030-01-01T00:00:00.000Z",
};

const placeholderApplicantDetailsResult: USAppointmentApplicantDetailsResult =
  buildUSAppointmentApplicantDetails({
    profile: {
      given_names_en: "Test",
      surname_en: "Applicant",
      birth_country: "CN",
      date_of_birth: "1990-01-02",
      nationality: "CN",
      passport_number: "E12345678",
      passport_issue_date: "2020-01-02",
      passport_expiry_date: "2035-01-02",
      phone: "+8613800012345",
    },
    answers: {
      country_of_birth: "CN",
      nationality_country: "CN",
      mobile_phone: "+8613800012345",
      mailing_same_as_home: true,
      home_address_line1: "123 Example Road",
      home_address_city: "Beijing",
      home_address_state_province: "Beijing",
      home_address_postal_code: "100000",
      passport_issuance_city: "Beijing",
      national_id_number: "TEST-NATIONAL-ID",
    },
    accountEmail: PLACEHOLDER_CREDENTIALS.email,
  });

function requirePlaceholderApplicantDetails(
  result: USAppointmentApplicantDetailsResult,
): USAppointmentApplicantDetails {
  if (result.state !== "ready") {
    throw new Error("Placeholder applicant details fixture is inconsistent.");
  }
  return result.data;
}

export const PLACEHOLDER_APPLICANT_DETAILS_RESULT = placeholderApplicantDetailsResult;
export const PLACEHOLDER_APPLICANT_DETAILS = requirePlaceholderApplicantDetails(
  placeholderApplicantDetailsResult,
);

export const PLACEHOLDER_VERIFICATION_CODE = "000000";

export const PLACEHOLDER_SLOT: SlotInsert = {
  job_id: PLACEHOLDER_JOB.id,
  application_id: PLACEHOLDER_JOB.application_id,
  appointment_date: "2030-06-15",
  appointment_time: "09:00",
  appointment_location: "Beijing",
  appointment_type: "interview",
  source: "usvisascheduling",
  status: "observed",
  metadata_redacted_json: { fixture: true, simulated: true },
};

export const PLACEHOLDER_DS160_REFERENCE = "SIMULATED-DS160-000001";
export const PLACEHOLDER_CONFIRMATION_REFERENCE = "SIMULATED-US-000001";

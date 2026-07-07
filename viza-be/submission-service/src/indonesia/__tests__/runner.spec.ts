import assert from "node:assert/strict";
import test from "node:test";
import {
  INDONESIA_B1_EVOA_PORTAL_URL,
  INDONESIA_C1_PORTAL_URL,
  normalizeIndonesiaAnswers,
  runIndonesiaLiveSubmission,
} from "../index";
import { shouldSubmitIndonesiaPortalEmailOtp } from "../runner";
import {
  shouldDirectNavigateIndonesiaStepOne,
  actionForIndonesiaPortalState,
  classifyIndonesiaPortalSnapshot,
} from "../portal-state";
import { hasPreparedIndonesiaPortalAccount } from "../managed-account";

test("normalizes Indonesia C1 tourist answers to the official eVisa portal", () => {
  const normalized = normalizeIndonesiaAnswers({
    applicationId: "app-c1",
    visaType: "B211A",
    officialReference: "  REF-C1  ",
    answers: {
      given_name: "Ada",
      surname: "Lovelace",
      passport_number: "P1234567",
      email_address: "ada@example.com",
      intended_date_of_entry: "2026-08-01",
    },
  });

  assert.equal(normalized.packageKey, "c1");
  assert.equal(normalized.provider, "indonesia_c1_live");
  assert.equal(normalized.visaType, "ID_C1_TOURIST");
  assert.equal(normalized.portalUrl, INDONESIA_C1_PORTAL_URL);
  assert.equal(normalized.fullName, "Ada Lovelace");
  assert.equal(normalized.passportNumber, "P1234567");
  assert.equal(normalized.officialReference, "REF-C1");
});

test("normalizes Indonesia B1 e-VoA answers to the official eVisa portal", () => {
  const normalized = normalizeIndonesiaAnswers({
    applicationId: "app-b1",
    visaType: "ID_B1_EVOA",
    answers: {
      traveller_full_name: "Grace Hopper",
      passport_no: "B7654321",
      contact_email: "grace@example.com",
      arrival_port: "Soekarno-Hatta",
      hotel_address: "Jakarta",
    },
  });

  assert.equal(normalized.packageKey, "b1_evoa");
  assert.equal(normalized.provider, "indonesia_b1_evoa_live");
  assert.equal(normalized.visaType, "ID_B1_EVOA");
  assert.equal(normalized.portalUrl, INDONESIA_B1_EVOA_PORTAL_URL);
  assert.equal(normalized.fullName, "Grace Hopper");
  assert.equal(normalized.portOfEntry, "Soekarno-Hatta");
  assert.equal(normalized.accommodationAddress, "Jakarta");
});

test("stops at payment authorization after the managed alias is prepared", async () => {
  const result = await runIndonesiaLiveSubmission({
    applicationId: "app-b1",
    visaType: "ID_B1_EVOA",
    answers: { full_name: "Grace Hopper" },
    managedAccountAvailable: true,
    managedAccountEmail: "appl-test@haggstorm.com",
  });

  assert.equal(result.status, "action_required");
  assert.equal(result.actionType, "official_fee_payment_required");
  assert.equal(result.implementationStatus, "partial");
});

test("treats VIZA-managed Indonesia alias with a vault password as a reusable portal account", () => {
  assert.equal(
    hasPreparedIndonesiaPortalAccount({
      email: "appl-0123456789abcdefghijklmnop@haggstorm.com",
      password: "portal-password",
    }),
    true,
  );
  assert.equal(
    hasPreparedIndonesiaPortalAccount({
      email: "traveler@example.com",
      password: "portal-password",
    }),
    true,
  );
  assert.equal(
    hasPreparedIndonesiaPortalAccount({
      email: "appl-0123456789abcdefghijklmnop@haggstorm.com",
      password: null,
    }),
    false,
  );
});

test("classifies Indonesia portal login and registration gates", () => {
  assert.equal(
    classifyIndonesiaPortalSnapshot({
      url: INDONESIA_C1_PORTAL_URL,
      title: "The Official eVisa website for Indonesia",
      text: "Visa Application Guideline APPLY PAYMENT DOWNLOAD Track Your Application",
    }),
    "landing_visible",
  );
  assert.equal(
    classifyIndonesiaPortalSnapshot({
      url: INDONESIA_B1_EVOA_PORTAL_URL,
      title: "Indonesia e-VoA",
      text: "Login with email and password or Register a new account",
    }),
    "registration_required",
  );
  assert.equal(
    classifyIndonesiaPortalSnapshot({
      url: INDONESIA_C1_PORTAL_URL,
      title: "Indonesia eVisa",
      text: "Email Password Sign In",
    }),
    "login_required",
  );
  assert.equal(
    classifyIndonesiaPortalSnapshot({
      url: `${INDONESIA_C1_PORTAL_URL}web/visa-selection`,
      title: "The Official eVisa website for Indonesia",
      text: "Passport/Country/Region The main purpose of my visit to Indonesia is I want to explore & choose a visa",
    }),
    "visa_selection_visible",
  );
  assert.equal(
    classifyIndonesiaPortalSnapshot({
      url: `${INDONESIA_C1_PORTAL_URL}front/login?menu-token=redacted`,
      title: "The Official eVisa website for Indonesia",
      text: "Track Your Application Email Password",
    }),
    "login_required",
  );
  assert.equal(
    classifyIndonesiaPortalSnapshot({
      url: `${INDONESIA_C1_PORTAL_URL}front/register/wna`,
      title: "The Official Indonesian e-Visa Website | Register",
      text: "Fill out the form to register an account Biography Passport Page Account Information",
    }),
    "account_registration_form_visible",
  );
  assert.equal(
    classifyIndonesiaPortalSnapshot({
      url: `${INDONESIA_C1_PORTAL_URL}payment/otp`,
      title: "Enter OTP Code",
      text: "Enter OTP Code OTP Code Submit",
    }),
    "payment_otp_required",
  );
  assert.equal(
    classifyIndonesiaPortalSnapshot({
      url: `${INDONESIA_C1_PORTAL_URL}web/applications/gywt-XkmT06RwlbgXF3Y9gdtoipwtp7feM2hXLyDnrxjbIHm0oZAFEA0g8k4H90f/list`,
      title: "Indonesia eVisa",
      text: "Passport Travel Document Application Form",
    }),
    "application_form_visible",
  );
  assert.equal(
    classifyIndonesiaPortalSnapshot({
      url: `${INDONESIA_C1_PORTAL_URL}payment/otp`,
      title: "Bayar Sekarang",
      text: "Bayar / Enter OTP",
    }),
    "payment_otp_required",
  );
  assert.equal(
    classifyIndonesiaPortalSnapshot({
      url: `${INDONESIA_C1_PORTAL_URL}web/payment/checkout`,
      title: "Indonesia eVisa",
      text: "Waiting for payment",
    }),
    "payment_required",
  );
});

test("maps portal states to actionable automation checkpoints", () => {
  assert.equal(
    actionForIndonesiaPortalState("captcha_required").actionType,
    "captcha_required",
  );
  assert.equal(
    actionForIndonesiaPortalState("application_form_visible").actionType,
    "official_form_reached",
  );
  assert.equal(
    actionForIndonesiaPortalState("visa_selection_visible").actionType,
    "official_visa_selection_reached",
  );
  assert.equal(
    actionForIndonesiaPortalState("official_application_started").actionType,
    "official_application_started",
  );
  assert.equal(
    actionForIndonesiaPortalState("account_registration_form_visible").actionType,
    "official_account_registration_form_reached",
  );
  assert.equal(
    actionForIndonesiaPortalState("payment_required").actionType,
    "official_fee_payment_required",
  );
  assert.equal(
    actionForIndonesiaPortalState("payment_otp_required").actionType,
    "official_fee_otp_required",
  );
});

test("does not bypass Indonesia official step 1 submit by default", () => {
  assert.equal(shouldDirectNavigateIndonesiaStepOne(undefined), false);
  assert.equal(shouldDirectNavigateIndonesiaStepOne(""), false);
  assert.equal(shouldDirectNavigateIndonesiaStepOne("false"), false);
  assert.equal(shouldDirectNavigateIndonesiaStepOne("true"), true);
});

test("does not auto-submit bank payment OTP with email OTP automation", () => {
  assert.equal(
    shouldSubmitIndonesiaPortalEmailOtp({
      url: `${INDONESIA_C1_PORTAL_URL}payment/otp`,
      text: "Enter OTP Code OTP Code Submit",
    }),
    false,
  );
  assert.equal(
    shouldSubmitIndonesiaPortalEmailOtp({
      url: `${INDONESIA_C1_PORTAL_URL}web/application-detail-otp/abc123`,
      text: "Enter OTP Code OTP Code Submit",
    }),
    true,
  );
});

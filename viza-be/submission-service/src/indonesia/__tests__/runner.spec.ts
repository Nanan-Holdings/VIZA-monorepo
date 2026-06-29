import assert from "node:assert/strict";
import test from "node:test";
import {
  INDONESIA_B1_EVOA_PORTAL_URL,
  INDONESIA_C1_PORTAL_URL,
  normalizeIndonesiaAnswers,
  runIndonesiaLiveSubmission,
} from "../index";
import {
  actionForIndonesiaPortalState,
  classifyIndonesiaPortalSnapshot,
} from "../portal-state";

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

test("normalizes Indonesia B1 e-VoA answers to the VFS e-VoA portal", () => {
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
    actionForIndonesiaPortalState("payment_required").actionType,
    "official_fee_payment_required",
  );
});

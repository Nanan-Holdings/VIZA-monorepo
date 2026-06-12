import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyVietnamPortalSnapshot,
  checkpointForVietnamPortalState,
  extractVietnamRegistrationCode,
  isAutoAcknowledgeableVietnamPortalState,
  type VietnamPortalSnapshot,
} from "../portal-state";

function snapshot(overrides: Partial<VietnamPortalSnapshot>): VietnamPortalSnapshot {
  return {
    url: "https://evisa.gov.vn/",
    title: "Vietnam e-Visa",
    bodyText: "Vietnam e-Visa official portal",
    bodyHtmlLength: 5_000,
    buttonTexts: ["Apply now"],
    linkHrefs: ["https://evisa.gov.vn/e-visa/foreigners"],
    antFormItemCount: 0,
    inputCount: 0,
    hasBody: true,
    hasVisibleModal: false,
    modalText: "",
    hasApplyEntry: true,
    hasLanguageSwitch: false,
    hasCaptcha: false,
    hasPassportUpload: false,
    hasPortraitUpload: false,
    hasPayment: false,
    hasFinalSubmit: false,
    registrationCode: null,
    failedRequestCount: 0,
    mainRequestFailed: false,
    ...overrides,
  };
}

test("Vietnam portal state: NOTE modal is action-required before form selectors", () => {
  const state = classifyVietnamPortalSnapshot(snapshot({
    hasVisibleModal: true,
    modalText: "NOTE: Read the instruction carefully before continuing.",
    antFormItemCount: 0,
  }));

  assert.equal(state, "note_modal_visible");
});

test("Vietnam portal state: white screen is explicit terminal state", () => {
  const state = classifyVietnamPortalSnapshot(snapshot({
    bodyText: "",
    bodyHtmlLength: 120,
    buttonTexts: [],
    linkHrefs: [],
    hasApplyEntry: false,
  }));

  assert.equal(state, "white_screen");
});

test("Vietnam portal state: CAPTCHA and payment are detected before generic form", () => {
  assert.equal(
    classifyVietnamPortalSnapshot(snapshot({
      bodyText: "Please enter CAPTCHA",
      hasCaptcha: true,
      antFormItemCount: 20,
    })),
    "captcha_visible",
  );
  assert.equal(
    classifyVietnamPortalSnapshot(snapshot({
      bodyText: "Payment fee - Pay now",
      hasPayment: true,
      antFormItemCount: 20,
    })),
    "payment_page_visible",
  );
});

test("Vietnam portal checkpoint mapper exposes manual action checkpoints", () => {
  assert.equal(checkpointForVietnamPortalState("application_form_visible"), "form_ready");
  assert.equal(checkpointForVietnamPortalState("note_modal_visible"), "note_modal_required");
  assert.equal(checkpointForVietnamPortalState("captcha_visible"), "captcha_required");
  assert.equal(checkpointForVietnamPortalState("payment_page_visible"), "payment_required");
  assert.equal(checkpointForVietnamPortalState("final_submit_visible"), "final_submit_required");
  assert.equal(checkpointForVietnamPortalState("white_screen"), "official_portal_error");
});

test("Vietnam portal state: NOTE is auto-acknowledgeable, payment and final submit are not", () => {
  assert.equal(isAutoAcknowledgeableVietnamPortalState("note_modal_visible"), true);
  assert.equal(isAutoAcknowledgeableVietnamPortalState("captcha_visible"), false);
  assert.equal(isAutoAcknowledgeableVietnamPortalState("payment_page_visible"), false);
  assert.equal(isAutoAcknowledgeableVietnamPortalState("final_submit_visible"), false);
});

test("Vietnam portal state: registration code extraction is explicit", () => {
  const text = "Registration code: E240610ABC123";

  assert.equal(extractVietnamRegistrationCode(text), "E240610ABC123");
  assert.equal(
    classifyVietnamPortalSnapshot(snapshot({ registrationCode: "E240610ABC123" })),
    "registration_code_visible",
  );
});

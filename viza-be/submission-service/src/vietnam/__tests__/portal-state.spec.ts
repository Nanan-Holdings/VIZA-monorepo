import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chooseVietnamReviewAction,
  classifyVietnamPortalSnapshot,
  checkpointForVietnamPortalState,
  extractVietnamRegistrationCode,
  isAutoAcknowledgeableVietnamPortalState,
  shouldTryVietnamFallbackLanding,
  type VietnamPortalSnapshot,
} from "../portal-state";
import { VN_STOP_BUTTON_PATTERNS } from "../field-mappings.js";

test("Vietnam review action: Next outranks a later primary Save button", () => {
  assert.deepEqual(
    chooseVietnamReviewAction([
      { domIndex: 4, label: "Next", isPrimary: false, type: "button", top: 800 },
      { domIndex: 9, label: "Save", isPrimary: true, type: "submit", top: 900 },
    ]),
    { domIndex: 4, label: "Next", isPrimary: false, type: "button", top: 800 },
  );
});

test("Vietnam review action: accepts localized Continue and ignores unrelated controls", () => {
  assert.deepEqual(
    chooseVietnamReviewAction([
      { domIndex: 1, label: "Cancel", isPrimary: true, type: "button", top: 700 },
      { domIndex: 2, label: "Lưu", isPrimary: true, type: "button", top: 710 },
      { domIndex: 3, label: "Tiếp tục", isPrimary: false, type: "button", top: 705 },
    ]),
    { domIndex: 3, label: "Tiếp tục", isPrimary: false, type: "button", top: 705 },
  );
});

test("Vietnam review action: accepts safe suffix text and excludes disabled candidates", () => {
  assert.deepEqual(
    chooseVietnamReviewAction([
      {
        domIndex: 1,
        label: "Next",
        isPrimary: true,
        type: "button",
        top: 700,
        disabled: true,
      },
      {
        domIndex: 2,
        label: "Continue to review",
        isPrimary: false,
        type: "button",
        top: 705,
        disabled: false,
      },
    ]),
    {
      domIndex: 2,
      label: "Continue to review",
      isPrimary: false,
      type: "button",
      top: 705,
      disabled: false,
    },
  );
});

test("Vietnam review action: ignores the official ordinal review step", () => {
  assert.deepEqual(
    chooseVietnamReviewAction([
      {
        domIndex: 1,
        label: "2Xem lại hồ sơ",
        isPrimary: false,
        type: "button",
        tagName: "div",
        top: 120,
      },
      {
        domIndex: 8,
        label: "Lưu",
        isPrimary: true,
        type: "button",
        tagName: "button",
        top: 920,
      },
    ]),
    {
      domIndex: 8,
      label: "Lưu",
      isPrimary: true,
      type: "button",
      tagName: "button",
      top: 920,
    },
  );
});

test("Vietnam review action: never treats submit or payment labels as review actions", () => {
  const stopped = (label: string) => VN_STOP_BUTTON_PATTERNS.some((pattern) => pattern.test(label));
  assert.equal(stopped("Save and submit"), true);
  assert.equal(stopped("Continue to payment"), true);
  assert.equal(stopped("Proceed to payment"), true);
  assert.equal(stopped("Pay now"), true);
  assert.equal(stopped("Continue to review"), false);
});

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

test("Vietnam portal state: landing-page note copy is not treated as a modal", () => {
  const state = classifyVietnamPortalSnapshot(snapshot({
    bodyText: "THỊ THỰC ĐIỆN TỬ VIỆT NAM Khai báo tại đây Lưu ý: Người nước ngoài...",
    hasVisibleModal: false,
    modalText: "",
    hasApplyEntry: true,
    antFormItemCount: 0,
  }));

  assert.equal(state, "apply_now_visible");
});

test("Vietnam portal state: declaration instruction page is auto-acknowledgeable", () => {
  const state = classifyVietnamPortalSnapshot(snapshot({
    bodyText:
      "NOTE DECLARATION INSTRUCTIONS Confirm compliance with Vietnamese laws upon entry Confirmation of reading carefully instructions and having completed application Cancel Next",
    buttonTexts: ["Cancel", "Next"],
    inputCount: 2,
    hasVisibleModal: false,
    modalText: "",
    hasApplyEntry: true,
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

test("Vietnam portal state: nginx HTTP-to-HTTPS 400 is an official portal error", () => {
  const state = classifyVietnamPortalSnapshot(snapshot({
    title: "400 The plain HTTP request was sent to HTTPS port",
    bodyText: "400 Bad Request The plain HTTP request was sent to HTTPS port nginx",
    buttonTexts: [],
    linkHrefs: [],
    hasApplyEntry: false,
  }));

  assert.equal(state, "portal_error");
  assert.equal(shouldTryVietnamFallbackLanding(state), true);
});

test("Vietnam portal state: asset 502 Error page is a portal error, not a layout change", () => {
  const state = classifyVietnamPortalSnapshot(snapshot({
    title: "Error",
    bodyText: "An unexpected error occurred.",
    bodyHtmlLength: 3_000,
    buttonTexts: [],
    linkHrefs: [],
    hasApplyEntry: false,
    failedRequestCount: 18,
  }));

  assert.equal(state, "portal_error");
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

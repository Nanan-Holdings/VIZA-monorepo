import assert from "node:assert/strict";
import test from "node:test";

import {
  KOREA_VISA_PORTAL_EFORM_URL,
  buildKoreaOfficialEformPayload,
  runKoreaOfficialEform,
  validateKoreaOfficialEformPayload,
} from "../runner";
import { buildKoreaOfficialEformFirstPagePlan } from "../portal";

const completeAnswers = {
  family_name: "ZHANG",
  given_names: "SAN",
  date_of_birth: "1997-04-09",
  gender: "male",
  nationality: "CHINA P. R.",
  passport_number: "E12345678",
  passport_expiry_date: "2032-01-01",
  passport_issue_date: "2022-01-01",
  email: "applicant@example.com",
  phone: "13800138000",
  home_address: "Beijing, China",
};

test("Korea official e-Form payload maps VIZA answers to portal-safe fields", () => {
  const payload = buildKoreaOfficialEformPayload({
    applicationId: "app-1",
    answers: completeAnswers,
  });

  assert.equal(payload.familyName, "ZHANG");
  assert.equal(payload.givenNames, "SAN");
  assert.equal(payload.gender, "male");
  assert.equal(payload.stayStatus, "C-3");
  assert.equal(payload.purpose, "tourism_transit");
});

test("Korea official e-Form first-page plan targets official portal selectors", () => {
  const payload = buildKoreaOfficialEformPayload({
    applicationId: "app-1",
    answers: completeAnswers,
  });

  const plan = buildKoreaOfficialEformFirstPagePlan(payload, {
    visitingPostName: "CHINA-BEIJING",
    visitingPostCode: "CN-BJ",
  });
  const fieldMap = new Map(plan.fields.map((field) => [field.selector, field.value]));
  const radioSelectors = plan.radios.map((radio) => radio.selector);
  const selectMap = new Map(plan.selects.map((field) => [field.selector, field.value]));

  assert.equal(fieldMap.get("#SUR_NM"), "ZHANG");
  assert.equal(fieldMap.get("#GIV_NM"), "SAN");
  assert.equal(fieldMap.get("#BIRTH_YMD"), "19970409");
  assert.equal(fieldMap.get("#PASS_NO"), "E12345678");
  assert.equal(fieldMap.get("#NAT_CD"), "CHN");
  assert.equal(fieldMap.get("#REG_OVERSEA_RES_CD"), "CN-BJ");
  assert.equal(selectMap.get("#EFORM_STAY"), "C3");
  assert.equal(selectMap.get("#PASS_NO_KIND"), "OR");
  assert.ok(radioSelectors.includes("#ENT_PURP_KIND_CD1"));
  assert.ok(radioSelectors.includes("#SEX_CD_M"));
  assert.ok(radioSelectors.includes("#INVIT_YN1"));
});

test("Korea official e-Form validation names missing official fields", () => {
  const payload = buildKoreaOfficialEformPayload({
    applicationId: "app-1",
    answers: { ...completeAnswers, passport_number: "" },
  });

  assert.deepEqual(validateKoreaOfficialEformPayload(payload), ["passport_number"]);
});

test("Korea official e-Form runner reports existing official PDF as ready", async () => {
  const result = await runKoreaOfficialEform({
    applicationId: "app-1",
    answers: {},
    officialPdfStoragePath: "korea/app-1/eform.pdf",
  });

  assert.equal(result.status, "official_eform_ready");
  assert.equal(result.portalUrl, KOREA_VISA_PORTAL_EFORM_URL);
  if (result.status === "official_eform_ready") {
    assert.equal(result.officialPdfStoragePath, "korea/app-1/eform.pdf");
  }
});

test("Korea official e-Form live runner is disabled by default", async () => {
  const previous = process.env.KR_VISA_PORTAL_EFORM_LIVE_ENABLED;
  delete process.env.KR_VISA_PORTAL_EFORM_LIVE_ENABLED;
  try {
    const result = await runKoreaOfficialEform({
      applicationId: "app-1",
      answers: completeAnswers,
    });

    assert.equal(result.status, "manual_required");
    if (result.status === "manual_required") {
      assert.equal(result.manualActionType, "official_eform_generation_required");
    }
  } finally {
    if (previous === undefined) delete process.env.KR_VISA_PORTAL_EFORM_LIVE_ENABLED;
    else process.env.KR_VISA_PORTAL_EFORM_LIVE_ENABLED = previous;
  }
});

test("Korea official e-Form live runner pauses for final portal review", async () => {
  const previous = process.env.KR_VISA_PORTAL_EFORM_LIVE_ENABLED;
  process.env.KR_VISA_PORTAL_EFORM_LIVE_ENABLED = "true";
  try {
    const result = await runKoreaOfficialEform({
      applicationId: "app-1",
      answers: completeAnswers,
    });

    assert.equal(result.status, "manual_required");
    if (result.status === "manual_required") {
      assert.equal(result.manualActionType, "official_eform_portal_review_required");
    }
  } finally {
    if (previous === undefined) delete process.env.KR_VISA_PORTAL_EFORM_LIVE_ENABLED;
    else process.env.KR_VISA_PORTAL_EFORM_LIVE_ENABLED = previous;
  }
});

test("Korea official e-Form live runner requires official PDF capture before success", async () => {
  const previous = process.env.KR_VISA_PORTAL_EFORM_LIVE_ENABLED;
  process.env.KR_VISA_PORTAL_EFORM_LIVE_ENABLED = "true";
  try {
    const result = await runKoreaOfficialEform({
      applicationId: "app-1",
      answers: completeAnswers,
      finalReviewApproved: true,
    });

    assert.equal(result.status, "manual_required");
    if (result.status === "manual_required") {
      assert.equal(result.manualActionType, "official_eform_download_required");
    }
  } finally {
    if (previous === undefined) delete process.env.KR_VISA_PORTAL_EFORM_LIVE_ENABLED;
    else process.env.KR_VISA_PORTAL_EFORM_LIVE_ENABLED = previous;
  }
});

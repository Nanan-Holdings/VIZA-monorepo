import assert from "node:assert/strict";
import test from "node:test";

import {
  KOREA_VISA_PORTAL_EFORM_URL,
  buildKoreaOfficialEformPayload,
  runKoreaOfficialEform,
  validateKoreaOfficialEformPayload,
} from "../runner";
import {
  buildKoreaOfficialEformFirstPagePlan,
  buildKoreaOfficialEformSecondPagePlan,
} from "../portal";

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

const completeAnnex17Answers = {
  family_name_en: "ZHANG",
  given_names_en: "SAN",
  date_of_birth: "1997-04-09",
  sex: "male",
  nationality: "China",
  passport_no: "E12345678",
  passport_date_of_expiry: "2032-01-01",
  passport_date_of_issue: "2022-01-01",
  email: "applicant@example.com",
  cell_phone: "13800138000",
  home_country_address: "Beijing, China",
  marital_status: "single",
  highest_education: "bachelors",
  school_name: "Test University",
  school_location: "Beijing, China",
  employment_status: "employed",
  employer_name: "Test Company",
  employer_position: "Engineer",
  employer_address: "1 Employer Road, Beijing, China",
  employer_telephone: "13800138000",
  intended_period_of_stay: "7",
  intended_date_of_entry: "2026-09-01",
  address_in_korea: "100 Toegye-ro, Jung-gu, Seoul",
  contact_in_korea: "+82 2 1234 5678",
  travelled_to_korea_5y: "no",
  travelled_outside_5y: "no",
  travelling_with_family: "no",
  estimated_travel_costs_usd: "1000",
  payer_name: "ZHANG SAN",
  payer_relationship: "Self",
  payer_support_type: "Travel expenses",
  payer_contact: "13800138000",
  received_form_assistance: "no",
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

test("Korea official e-Form payload accepts Annex-17 seed field aliases", () => {
  const payload = buildKoreaOfficialEformPayload({
    applicationId: "app-1",
    answers: completeAnnex17Answers,
  });

  assert.equal(payload.familyName, "ZHANG");
  assert.equal(payload.givenNames, "SAN");
  assert.equal(payload.gender, "male");
  assert.equal(payload.passportNumber, "E12345678");
  assert.equal(payload.phone, "13800138000");
  assert.equal(payload.homeAddress, "Beijing, China");
  assert.deepEqual(validateKoreaOfficialEformPayload(payload), []);
});

test("Korea official e-Form first-page plan targets official portal selectors", () => {
  const payload = buildKoreaOfficialEformPayload({
    applicationId: "app-1",
    answers: completeAnswers,
  });

  const plan = buildKoreaOfficialEformFirstPagePlan(payload, {
    visitingPostName: "주 중국 대사관",
    visitingPostCode: "CP",
  });
  const fieldMap = new Map(plan.fields.map((field) => [field.selector, field.value]));
  const radioSelectors = plan.radios.map((radio) => radio.selector);
  const selectMap = new Map(plan.selects.map((field) => [field.selector, field.value]));

  assert.equal(fieldMap.get("#SUR_NM"), "ZHANG");
  assert.equal(fieldMap.get("#GIV_NM"), "SAN");
  assert.equal(fieldMap.get("#BIRTH_YMD"), "19970409");
  assert.equal(fieldMap.get("#PASS_NO"), "E12345678");
  assert.equal(fieldMap.get("#NAT_CD"), "CHN");
  assert.equal(fieldMap.get("#REG_OVERSEA_RES_CD"), "CP");
  assert.equal(selectMap.get("#EFORM_STAY"), "C3");
  assert.equal(selectMap.get("#PASS_NO_KIND"), "OR");
  assert.ok(radioSelectors.includes("#ENT_PURP_KIND_CD1"));
  assert.ok(radioSelectors.includes("#SEX_CD_M"));
  assert.ok(radioSelectors.includes("#INVIT_YN1"));
});

test("Korea official e-Form second-page plan targets official portal selectors", () => {
  const plan = buildKoreaOfficialEformSecondPagePlan(completeAnnex17Answers);
  const fieldMap = new Map(plan.fields.map((field) => [field.selector, field.value]));
  const radioSelectors = plan.radios.map((radio) => radio.selector);

  assert.ok(radioSelectors.includes("#MARI_STS_CD_S"));
  assert.ok(radioSelectors.includes("#LAST_DEGREE_2"));
  assert.ok(radioSelectors.includes("#JOB_CD_3"));
  assert.ok(radioSelectors.includes("#BF_VISIT_N"));
  assert.ok(radioSelectors.includes("#VISIT_NAT_N"));
  assert.ok(radioSelectors.includes("#ENT_FML_N"));
  assert.ok(radioSelectors.includes("#DOC_WRIT_HELP_N"));
  assert.equal(fieldMap.get("#LAST_SCH_NM"), "Test University");
  assert.equal(fieldMap.get("#COMPY_NM"), "Test Company");
  assert.equal(fieldMap.get("#APPL_SOJ_DUR"), "7");
  assert.equal(fieldMap.get("#ENTRY_EXP_YMD"), "20260901");
  assert.equal(fieldMap.get("#RNM_ENG_BS_ADDR"), "100 Toegye-ro, Jung-gu, Seoul");
  assert.equal(fieldMap.get("#SOJ_EXP_REGION_TEL_NO"), "+82 2 1234 5678");
  assert.equal(fieldMap.get("#VISIT_COST"), "1000");
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

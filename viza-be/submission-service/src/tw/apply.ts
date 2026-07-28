/**
 * Taiwan Online Entry Permit — main orchestrator.
 *
 * There is no persistent portal account and no cross-day resume (see
 * docs/tw-entry-permit-auto-submit-plan.md "架构修正"): every run is one
 * continuous browser session — open the portal, accept the terms modal,
 * pick delivery location, verify email by OTP, fill every remaining field
 * on the single long "申請表" page in the real top-to-bottom order, then
 * stop at the CAPTCHA. Hence `fillTwEntryPermitApplication()`, not
 * `resumeTwApplication()`.
 *
 * UPDATE — NAME-ATTRIBUTE VERIFICATION PASS: `TW_NAMES`/`KIN_NAMES` below map
 * each seed field_name to the real DOM `name` attribute, confirmed live via
 * direct DOM inspection of an in-progress coa.immigration.gov.tw session
 * (not label-text translation/guessing). This superseded an earlier
 * provisional-label-only version of this file. Two real gaps found during
 * that pass are called out inline rather than silently patched: (1) a
 * required field ("目前戶口登記狀態" / name="householdRevoked") that exists
 * on the live portal but nowhere in the seed contract — see the TODO in
 * fillPhotoAndBasicStatus; (2) the seed's eligibility_category values don't
 * match the real radio codes — fixed locally via ELIGIBILITY_VALUE_FIX
 * rather than editing the cross-package seed script. Primitives still
 * degrade to a safe no-op (field left blank) when a control isn't found.
 */

import type { Page } from "@playwright/test";
import { startTwSession, type TwSession } from "./session";
import {
  isAtTwCaptchaBoundary,
  twClickButtonOrLink,
  twFillByName,
  twFillDateByName,
  twFillText,
  twPickCheckboxByName,
  twPickRadioByValue,
  twSelectByName,
  twUploadFileByName,
  twUploadFileByDocumentDescription,
  type TwScope,
} from "./fillers";
import { TwEmailVerificationError, TwTermsModalError, TwUnexpectedPageError } from "./errors";
import { waitForTwVerificationCode } from "./inbox";
import { solveTwCaptcha } from "./captcha";

export interface TwApplyInput {
  applicantId: string;
  /** Email to use for the /apply/verify OTP step. */
  email: string;
  /** Output of normalizeTwAnswers(). */
  answers: Record<string, string>;
}

export interface TwApplyOptions {
  headless?: boolean;
  runId?: string;
  /** Local filesystem path to the applicant's photo, if already resolved
   *  from Supabase Storage by the caller. Optional — the photo_upload
   *  field is skipped (not blocking) when absent. */
  photoFilePath?: string | null;
  /** Timeout budget for the email OTP round-trip. Default 120s. */
  emailVerificationTimeoutMs?: number;
  /**
   * Local filesystem paths for the "應檢附文件" (supporting documents)
   * section — confirmed live to be a real, required upload block whose
   * exact set of required documents depends on `eligibility_category`
   * (see docs/tw-entry-permit-auto-submit-plan.md). Each is resolved by the
   * caller from Supabase Storage, same pattern as photoFilePath. Uploads are
   * targeted by the document's `reasonCode` (see twUploadFileByReasonCode),
   * not by position, since the slot index shifts per category.
   */
  supportingDocuments?: {
    /** OSFNCN_4_ST_DOC / _5_APRC_DOC / _6_WORK_DOC / _9_RESIDENCE_DOC — the
     *  one proof document specific to whichever eligibility_category was
     *  selected (student enrollment / permanent residency / work / dependent
     *  residency + financial proof). */
    eligibilityProofPath?: string | null;
    /** Mainland-issued travel document (6+ months validity) or HK/Macau
     *  non-permanent-resident travel document — required for every category. */
    mainlandTravelDocumentPath?: string | null;
    /** HK/Macau resident ID (front+back) + valid HK/Macau visa — only
     *  required when embassy_office is a Hong Kong or Macau office. */
    hkMacauIdScanPath?: string | null;
    /** Scan of the other-nationality passport/certificate — only required
     *  when has_other_nationality_passport === "yes". */
    otherNationalityPassportScanPath?: string | null;
    /** Mainland ID card (front+back) — only required when
     *  mainland_id_number_not_applicable !== "true". */
    mainlandIdCardScanPath?: string | null;
    /** Optional catch-all ("其他相關證明文件") — e.g. a Japan juminhyo. Not
     *  required unless the applicant's situation calls for it. */
    otherSupportingDocumentPath?: string | null;
  };
}

/** Local result shape returned by the orchestrator. The queue layer
 *  (src/queue/halt-runners.ts) wraps this into the persisted, country-
 *  tagged `TwSubmissionResult` (mirrors UkResumeResult vs UkSubmissionResult). */
export type TwFillResult =
  | {
      status: "stopped_at_captcha";
      caseNumber?: string;
      portalUrl: string;
      pagesFilled: string[];
      capturedAt: string;
      /** Whether the CAPTCHA was auto-solved and pre-filled (best-effort,
       *  unverified — see solveTwCaptcha in ./captcha.ts). The applicant
       *  should still review the value before submitting themselves. */
      captchaAutoFilled: boolean;
    }
  | {
      status: "failed";
      error: string;
      url?: string;
    };

// ── Real DOM `name` attributes (confirmed live via direct DOM inspection —
// see docs/tw-entry-permit-auto-submit-plan.md "第二次現場核對"). Replaces
// the earlier label-text-guess approach entirely: every field below was
// read straight off the live coa.immigration.gov.tw session's form markup,
// not translated/guessed from the seed script's English labels. ───────────
const TW_NAMES = {
  continent: "continent",
  embassy_office: "overseaOfficeId",
  photo_upload: "documents[0].attachs[0]",
  first_time_applying: "applyCaseExtendTemp.firstApplyFlag", // values N/Y
  permit_type: "traveller.applyVisa", // values 1/2/H — matches seed
  permit_count: "traveller.applyCnt", // values 1/2 — matches seed
  has_other_nationality_passport: "traveller.othPassportFlag", // values N/Y
  eligibility_category: "traveller.applyQualification", // values 4/5/6/9 — see ELIGIBILITY_VALUE_FIX below
  name_chinese: "traveller.chineseName",
  name_english: "traveller.englishName",
  date_of_birth: "traveller.birthDate", // datepicker
  passport_number: "traveller.passportNo",
  passport_expiry_date: "traveller.passportExpiryDate", // datepicker
  gender: "traveller.gender", // values 0=男/1=女 — matches seed
  overseas_residency_id_number: "traveller.overseaIdNo",
  mainland_id_number_not_applicable: "traveller.noPersonIdFlag",
  mainland_id_number: "traveller.personId",
  birth_place_is_mainland: "traveller.birthPlaceCode", // SELECT, values 1=中國大陸/5=其他 (NOT a radio, NOT "mainland"/"other" strings)
  birth_place_other_country: "traveller.birthPlace1",
  local_mobile_phone: "traveller.xtel",
  current_occupation: "traveller.occupation",
  occupation_experience: "traveller.resume",
  company_name: "careersInformations[0].unitTitle",
  job_title: "careersInformations[0].workTitle",
  is_taiwanese_spouse: "traveller.partnerOfTaiwan", // select, values N/Y
  traveling_with_parents: "traveller.accompanyMark", // select, values N/Y
  overseas_address: "traveller.address",
  tw_contact_city: "traveller.city",
  tw_contact_district: "traveller.township",
  tw_contact_village: "traveller.village",
  tw_contact_neighborhood: "traveller.neighborhood",
  tw_contact_road: "traveller.road",
  tw_contact_lane: "traveller.lane",
  tw_contact_alley: "traveller.alley",
  tw_contact_building_number: "traveller.number",
  tw_local_phone: "traveller.twTelNo",
  tw_contact_mobile_not_applicable: "traveller.noTwMobileFlag",
  tw_contact_mobile: "traveller.twMobile",
  other_nationality_country: "coaExtraPassportInfo.othNation",
  other_passport_number: "coaExtraPassportInfo.othPassportNo",
  other_passport_expiry_date: "coaExtraPassportInfo.othPassportExpiryDate", // datepicker
  email: "traveller.email",
  accepted_terms: "agree",
} as const;

const KIN_NAMES = {
  status: "deadMark", // select, values 1=存/2=歿/3=離婚 — matches seed KINSHIP_STATUS
  name: "chineseName",
  date_of_birth: "birthDate", // datepicker
  phone: "telNo",
  occupation: "occupation",
  service_unit: "unitTitle",
  job_title: "workTitle",
  current_address: "address",
} as const;
/** Text of the "copy overseas address" helper button — no name attribute
 *  exists for it (it's a button, not a form field), so it stays text-based,
 *  scoped to the same kinship block via twClickButtonOrLink(scope, …). */
const KIN_SAME_AS_OVERSEAS_BUTTON_TEXT = "同申請人海外地址"; // verbatim

/**
 * The seed contract's eligibility_category option values ("1"–"4", ordinal)
 * do not match the real radio inputs' `value` attributes (confirmed live:
 * "4", "5", "6", "9" — Taiwan's own internal category codes). This maps the
 * seed's stored value to the real DOM value at fill time rather than
 * touching the cross-package seed script; the seed's option *labels* are
 * still correct, only the underlying codes needed translation.
 */
const ELIGIBILITY_VALUE_FIX: Record<string, string> = {
  "1": "4", // 赴國外或香港、澳門留學生
  "2": "5", // 旅居國外或香港、澳門取得當地永久居留權
  "3": "6", // 旅居國外或香港、澳門1年以上且領有工作證明
  "4": "9", // 旅居國外或香港、澳門取得當地依親居留權且有財力證明
};

/**
 * "應檢附文件" (supporting documents) — each row's specific requirement is
 * distinguished ONLY by its own description text (confirmed live: the
 * hidden `documents[N].reasonCode` value is shared across every row within
 * one eligibility category, so it cannot tell the rows apart — see the
 * caveat on twUploadFileByDocumentDescription). These substrings were read
 * directly off the real page for each of the four categories; kept short
 * enough to be robust to minor wording drift but distinctive enough not to
 * collide with a neighboring row.
 */
const ELIGIBILITY_PROOF_DESCRIPTION: Record<string, string> = {
  "1": "在學證明", // 留學生: 有效學生簽證(或再入國簽證)及學校核發之3個月內在學證明
  "2": "永久居留權證明", // 旅居國外或港澳取得當地永久居留權
  "3": "公司在職證明", // 1年以上工作證明: 出入境查驗章戳護照內頁+工作簽證+3個月內公司在職證明
  "4": "依親居留權證明", // 依親居留權+財力證明
};

const MAINLAND_TRAVEL_DOCUMENT_DESCRIPTION =
  "大陸地區所發尚餘6個月以上效期之旅行證件或香港、澳門政府核發之非永久性居民旅行證件";
const HK_MACAU_ID_DESCRIPTION = "旅居香港或澳門之申請人";
const OTHER_SUPPORTING_DOC_DESCRIPTION = "其他相關證明文件";
const OTHER_NATIONALITY_PASSPORT_DOC_DESCRIPTION = "具有他國國籍護(證)照文件";
const MAINLAND_ID_CARD_DOC_DESCRIPTION = "大陸身分證（正、反面）";

/** Embassy offices that are Hong Kong/Macau (not a foreign country office) —
 *  confirmed live: only these two toggle the HK/Macau-resident-ID document
 *  requirement. Values match EMBASSY_OFFICES in the seed contract. */
export const HK_MACAU_EMBASSY_OFFICE_VALUES = new Set(["50", "51"]);

/**
 * traveller.birthPlaceCode is a real <select>, not a radio group, and its
 * values are "1"/"5" (confirmed live), not the seed's "mainland"/"other"
 * strings.
 */
const BIRTH_PLACE_VALUE_FIX: Record<string, string> = { mainland: "1", other: "5" };

const KINSHIP_GROUPS = ["father", "mother", "spouse", "child1", "child2"] as const;
type TwKinshipGroup = (typeof KINSHIP_GROUPS)[number];

/**
 * kinships[0..4] map to 父/母/配偶/子女(1)/子女(2) in exactly that array
 * order — confirmed live by reading each block's hidden `kinships[i].title`
 * value and the nearest section heading. This replaces the earlier
 * anchor-text-plus-nearest-ancestor heuristic entirely: indexing the real
 * repeated-array field names is unambiguous, unlike matching on visible
 * heading text.
 */
const KIN_GROUP_INDEX: Record<TwKinshipGroup, number> = {
  father: 0,
  mother: 1,
  spouse: 2,
  child1: 3,
  child2: 4,
};

function kinName(group: TwKinshipGroup, field: keyof typeof KIN_NAMES): string {
  return `kinships[${KIN_GROUP_INDEX[group]}].${KIN_NAMES[field]}`;
}

/** Scopes the "同申請人海外地址" button click to the correct kinship block,
 *  using the block's own address input (a real, indexed name attribute) as
 *  the anchor rather than guessing at heading text. */
function twKinshipScope(page: Page, group: TwKinshipGroup): TwScope {
  const addressInput = page.locator(`[name="${kinName(group, "current_address")}"]`).first();
  return addressInput.locator("xpath=ancestor::*[self::section or self::div or self::fieldset][1]");
}

// ── Section fillers ──────────────────────────────────────────────────────

async function clickEnterApplication(page: Page): Promise<void> {
  const clicked = await twClickButtonOrLink(page, "我要申請");
  if (!clicked) {
    throw new TwUnexpectedPageError('Could not find the "我要申請" entry control', { url: page.url() });
  }
  await page.waitForLoadState("domcontentloaded", { timeout: 15_000 }).catch(() => undefined);
}

async function acceptTermsModal(page: Page): Promise<void> {
  // "移民署同意條款" modal: one checkbox + "確定"/"取消" buttons (verbatim).
  const checkbox = page.getByRole("checkbox").first();
  if ((await checkbox.count().catch(() => 0)) === 0) {
    throw new TwTermsModalError("Terms modal checkbox not found", { url: page.url() });
  }
  if (!(await checkbox.isChecked().catch(() => false))) {
    await checkbox.check({ timeout: 5_000, force: true }).catch(() => undefined);
  }
  const confirmed = await twClickButtonOrLink(page, "確定");
  if (!confirmed) {
    throw new TwTermsModalError('Terms modal "確定" button not found', { url: page.url() });
  }
  await page.waitForLoadState("domcontentloaded", { timeout: 15_000 }).catch(() => undefined);
}

async function dismissPhotoSpecDialogIfPresent(page: Page): Promise<void> {
  // "照片規格說明" one-time info dialog — non-blocking; close via 關閉/確定.
  const closeBtn = page.getByRole("button", { name: /關閉|確定/ }).first();
  if ((await closeBtn.count().catch(() => 0)) > 0 && (await closeBtn.isVisible().catch(() => false))) {
    await closeBtn.click({ timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(200);
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function fillDeliveryLocationTab(page: Page, a: Record<string, string>): Promise<void> {
  if (a.continent) {
    await twSelectByName(page, TW_NAMES.continent, a.continent);
    // Embassy-office options repopulate based on the chosen continent.
    await page.waitForTimeout(400);
  }
  if (a.embassy_office) await twSelectByName(page, TW_NAMES.embassy_office, a.embassy_office);
  await twClickButtonOrLink(page, "下一步");
  await page.waitForLoadState("domcontentloaded", { timeout: 15_000 }).catch(() => undefined);
}

async function switchToApplicationFormTab(page: Page): Promise<void> {
  const tab = page.getByRole("tab", { name: "申請表" }).first();
  if ((await tab.count().catch(() => 0)) > 0) {
    await tab.click({ timeout: 10_000 }).catch(() => undefined);
  } else {
    await twClickButtonOrLink(page, "申請表");
  }
  await page.waitForTimeout(500);
}

async function verifyTwEmail(
  page: Page,
  applicantId: string,
  email: string,
  timeoutMs: number,
): Promise<void> {
  // /apply/verify: enter email → click send-code → wait for the email →
  // enter the code → click 驗證 → field becomes "xxx@gmail.com 已認證".
  // Confirmed live: the field's own label is literally the English string
  // "e-mail" (not a Chinese label), so this now targets it by its real
  // `name="traveller.email"` attribute instead of guessing at label text.
  await twFillByName(page, TW_NAMES.email, email);
  const sendClicked = await twClickButtonOrLink(page, "寄送驗證碼");
  if (!sendClicked) {
    throw new TwEmailVerificationError('Could not find the send-verification-code control', { url: page.url() });
  }

  const { code } = await waitForTwVerificationCode(applicantId, timeoutMs);
  await twFillText(page, "驗證碼", code);
  const verifyClicked = await twClickButtonOrLink(page, "驗證");
  if (!verifyClicked) {
    throw new TwEmailVerificationError('Could not find the "驗證" confirm control', { url: page.url() });
  }

  const verifiedText = page.getByText(new RegExp(`${escapeRegExp(email)}.*已認證`), { exact: false }).first();
  const ok = await verifiedText
    .waitFor({ state: "visible", timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  if (!ok) {
    throw new TwEmailVerificationError(
      "Email did not flip to the verified '已認證' state after entering the OTP code",
      { url: page.url() },
    );
  }
}

async function fillPhotoAndBasicStatus(
  page: Page,
  a: Record<string, string>,
  photoFilePath: string | null,
): Promise<void> {
  if (photoFilePath) await twUploadFileByName(page, TW_NAMES.photo_upload, photoFilePath);
  if (a.first_time_applying) {
    await twPickRadioByValue(page, TW_NAMES.first_time_applying, a.first_time_applying === "yes" ? "Y" : "N");
  }
  if (a.permit_type) await twPickRadioByValue(page, TW_NAMES.permit_type, a.permit_type);
  if (a.permit_count) await twSelectByName(page, TW_NAMES.permit_count, a.permit_count);
  if (a.has_other_nationality_passport) {
    await twPickRadioByValue(
      page,
      TW_NAMES.has_other_nationality_passport,
      a.has_other_nationality_passport === "yes" ? "Y" : "N",
    );
  }
  if (a.eligibility_category) {
    await twPickRadioByValue(page, TW_NAMES.eligibility_category, ELIGIBILITY_VALUE_FIX[a.eligibility_category] ?? a.eligibility_category);
  }
  // TODO(open gap — needs a product decision, not a guess): the live portal
  // has a required radio group "目前戶口登記狀態" (name="householdRevoked",
  // values N="未註銷戶口登記/已註銷戶口登記，但尚未取得香港、澳門護照" /
  // Y="已註銷戶口登記") that does not exist anywhere in the seed contract or
  // the frontend wizard. Confirmed live via the "asterisk" (required) class
  // on its label. Left unfilled until the field is added upstream — flagged
  // to the user rather than invented here.
  if (a.household_revoked) {
    await twPickRadioByValue(page, "householdRevoked", a.household_revoked === "yes" ? "Y" : "N");
  }
}

/**
 * "應檢附文件" (supporting documents) — a real, required upload block whose
 * exact set of file slots depends on eligibility_category (see the reason-
 * code map above). Must run after fillPhotoAndBasicStatus has already
 * selected eligibility_category and embassy_office, since the relevant
 * reasonCode-tagged file inputs only exist in the DOM once those choices
 * are made.
 */
async function fillSupportingDocumentsSection(
  page: Page,
  a: Record<string, string>,
  docs: TwApplyOptions["supportingDocuments"],
): Promise<void> {
  if (!docs) return;

  // Confirmed live for all 4 categories: this exact document/wording is the
  // first row and applies regardless of eligibility_category.
  if (docs.mainlandTravelDocumentPath) {
    await twUploadFileByDocumentDescription(page, MAINLAND_TRAVEL_DOCUMENT_DESCRIPTION, docs.mainlandTravelDocumentPath);
  }

  const proofDescription = a.eligibility_category ? ELIGIBILITY_PROOF_DESCRIPTION[a.eligibility_category] : undefined;
  if (proofDescription) await twUploadFileByDocumentDescription(page, proofDescription, docs.eligibilityProofPath);

  // Confirmed live for categories tested (4, 5, 6, 9): this row is present
  // for all of them, gated on Hong Kong/Macau embassy office selection.
  if (HK_MACAU_EMBASSY_OFFICE_VALUES.has(a.embassy_office) && docs.hkMacauIdScanPath) {
    await twUploadFileByDocumentDescription(page, HK_MACAU_ID_DESCRIPTION, docs.hkMacauIdScanPath);
  }

  if (a.has_other_nationality_passport === "yes" && docs.otherNationalityPassportScanPath) {
    await twUploadFileByDocumentDescription(page, OTHER_NATIONALITY_PASSPORT_DOC_DESCRIPTION, docs.otherNationalityPassportScanPath);
  }

  if (a.mainland_id_number_not_applicable !== "true" && docs.mainlandIdCardScanPath) {
    await twUploadFileByDocumentDescription(page, MAINLAND_ID_CARD_DOC_DESCRIPTION, docs.mainlandIdCardScanPath);
  }

  if (docs.otherSupportingDocumentPath) {
    await twUploadFileByDocumentDescription(page, OTHER_SUPPORTING_DOC_DESCRIPTION, docs.otherSupportingDocumentPath);
  }

  // NOT modeled here — needs a human product decision, not a guess (see
  // docs/tw-entry-permit-auto-submit-plan.md): a "未成年且無法定代理人或
  // 監護人陪同來臺者" (minor without accompanying guardian) row appeared for
  // categories 1 and 2 during live testing but not for 3 or 4 — the pattern
  // across all 4 categories hasn't been fully confirmed, and VIZA doesn't
  // currently collect a guardian-consent document at all.
}

async function fillApplicantIdentity(page: Page, a: Record<string, string>): Promise<void> {
  await twFillByName(page, TW_NAMES.name_chinese, a.name_chinese);
  await twFillByName(page, TW_NAMES.name_english, a.name_english);
  await twFillDateByName(page, TW_NAMES.date_of_birth, a.date_of_birth);
  await twFillByName(page, TW_NAMES.passport_number, a.passport_number);
  await twFillDateByName(page, TW_NAMES.passport_expiry_date, a.passport_expiry_date);
  if (a.gender) await twSelectByName(page, TW_NAMES.gender, a.gender);
  await twFillByName(page, TW_NAMES.overseas_residency_id_number, a.overseas_residency_id_number);

  // "無大陸身分證號碼" (name="traveller.noPersonIdFlag") is a bare checkbox
  // with plain sibling text — confirmed live there is NO <label> element
  // wrapping it at all, which is why the earlier getByLabel-based lookup
  // was a silent no-op. Name-attribute targeting sidesteps that entirely.
  const noMainlandId = a.mainland_id_number_not_applicable === "true";
  await twPickCheckboxByName(page, TW_NAMES.mainland_id_number_not_applicable, noMainlandId);
  if (!noMainlandId && a.mainland_id_number) {
    await twFillByName(page, TW_NAMES.mainland_id_number, a.mainland_id_number);
  }

  if (a.birth_place_is_mainland) {
    await twSelectByName(page, TW_NAMES.birth_place_is_mainland, BIRTH_PLACE_VALUE_FIX[a.birth_place_is_mainland] ?? a.birth_place_is_mainland);
  }
  if (a.birth_place_is_mainland === "other" && a.birth_place_other_country) {
    await twSelectByName(page, TW_NAMES.birth_place_other_country, a.birth_place_other_country);
  }

  await twFillByName(page, TW_NAMES.local_mobile_phone, a.local_mobile_phone);
  if (a.current_occupation) await twSelectByName(page, TW_NAMES.current_occupation, a.current_occupation);
  if (a.occupation_experience) await twFillByName(page, TW_NAMES.occupation_experience, a.occupation_experience);
  await twFillByName(page, TW_NAMES.company_name, a.company_name);
  await twFillByName(page, TW_NAMES.job_title, a.job_title);
  if (a.is_taiwanese_spouse) await twSelectByName(page, TW_NAMES.is_taiwanese_spouse, a.is_taiwanese_spouse === "yes" ? "Y" : "N");
  if (a.traveling_with_parents) await twSelectByName(page, TW_NAMES.traveling_with_parents, a.traveling_with_parents === "yes" ? "Y" : "N");
  await twFillByName(page, TW_NAMES.overseas_address, a.overseas_address);
}

async function fillTwContactAddress(page: Page, a: Record<string, string>): Promise<void> {
  if (a.tw_contact_city) await twSelectByName(page, TW_NAMES.tw_contact_city, a.tw_contact_city);
  if (a.tw_contact_district) await twSelectByName(page, TW_NAMES.tw_contact_district, a.tw_contact_district);
  if (a.tw_contact_village) await twFillByName(page, TW_NAMES.tw_contact_village, a.tw_contact_village);
  if (a.tw_contact_neighborhood) await twFillByName(page, TW_NAMES.tw_contact_neighborhood, a.tw_contact_neighborhood);
  await twFillByName(page, TW_NAMES.tw_contact_road, a.tw_contact_road);
  if (a.tw_contact_lane) await twFillByName(page, TW_NAMES.tw_contact_lane, a.tw_contact_lane);
  if (a.tw_contact_alley) await twFillByName(page, TW_NAMES.tw_contact_alley, a.tw_contact_alley);
  await twFillByName(page, TW_NAMES.tw_contact_building_number, a.tw_contact_building_number);
  if (a.tw_local_phone) await twFillByName(page, TW_NAMES.tw_local_phone, a.tw_local_phone);

  // "無在臺聯絡手機號碼" (name="traveller.noTwMobileFlag") — same bare-
  // checkbox-no-label situation as mainland_id_number_not_applicable above.
  const noTwMobile = a.tw_contact_mobile_not_applicable === "true";
  await twPickCheckboxByName(page, TW_NAMES.tw_contact_mobile_not_applicable, noTwMobile);
  if (!noTwMobile && a.tw_contact_mobile) {
    await twFillByName(page, TW_NAMES.tw_contact_mobile, a.tw_contact_mobile);
  }
}

async function fillOtherNationalityBlock(page: Page, a: Record<string, string>): Promise<void> {
  if (a.has_other_nationality_passport !== "yes") return;
  if (a.other_nationality_country) await twSelectByName(page, TW_NAMES.other_nationality_country, a.other_nationality_country);
  if (a.other_passport_number) await twFillByName(page, TW_NAMES.other_passport_number, a.other_passport_number);
  if (a.other_passport_expiry_date) await twFillDateByName(page, TW_NAMES.other_passport_expiry_date, a.other_passport_expiry_date);
}

async function fillKinshipSection(page: Page, a: Record<string, string>): Promise<void> {
  for (const group of KINSHIP_GROUPS) {
    const scope = twKinshipScope(page, group);
    const prefix = `kin_${group}_`;

    if (a[`${prefix}status`]) await twSelectByName(scope, kinName(group, "status"), a[`${prefix}status`]);
    if (a[`${prefix}name`]) await twFillByName(scope, kinName(group, "name"), a[`${prefix}name`]);
    if (a[`${prefix}date_of_birth`]) await twFillDateByName(scope, kinName(group, "date_of_birth"), a[`${prefix}date_of_birth`]);
    if (a[`${prefix}phone`]) await twFillByName(scope, kinName(group, "phone"), a[`${prefix}phone`]);
    if (a[`${prefix}occupation`]) await twSelectByName(scope, kinName(group, "occupation"), a[`${prefix}occupation`]);
    if (a[`${prefix}service_unit`]) await twFillByName(scope, kinName(group, "service_unit"), a[`${prefix}service_unit`]);
    if (a[`${prefix}job_title`]) await twFillByName(scope, kinName(group, "job_title"), a[`${prefix}job_title`]);

    const sameAsOverseas = a[`${prefix}current_address_same_as_overseas`] === "true";
    if (sameAsOverseas) {
      await twClickButtonOrLink(scope, KIN_SAME_AS_OVERSEAS_BUTTON_TEXT);
    } else if (a[`${prefix}current_address`]) {
      await twFillByName(scope, kinName(group, "current_address"), a[`${prefix}current_address`]);
    }
  }
}

async function fillDeclarationSection(page: Page, a: Record<string, string>): Promise<void> {
  const past = a.past_mainland_political_military_role === "true";
  await twPickCheckboxByName(page, "traveller.beenCnPartyJob", past);
  if (past && a.past_role_detail) await twFillByName(page, "traveller.beenCnPartyJobDesc", a.past_role_detail);

  const current = a.current_mainland_political_military_role === "true";
  await twPickCheckboxByName(page, "traveller.cnPartyJob", current);
  if (current && a.current_role_detail) await twFillByName(page, "traveller.cnPartyJobDesc", a.current_role_detail);

  const never = a.never_held_mainland_political_military_role === "true";
  await twPickCheckboxByName(page, "traveller.neverCnPartyJob", never);

  // Confirmed live: the real checkbox text is "同意上述條款，請打勾。" — the
  // earlier "我已閱讀並接受下列條款與條件" guess (mismarked "verbatim") did
  // not match anything on the actual page. Targeted by name="agree" now,
  // so the exact text no longer matters for matching, only for this comment.
  await twPickCheckboxByName(page, TW_NAMES.accepted_terms, a.accepted_terms === "true");
}

async function tryReadTwCaseNumber(page: Page): Promise<string | undefined> {
  const body = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
  const m = body.match(/(?:申請案號|案號)[:：]?\s*([A-Z0-9]{10,25})/);
  return m ? m[1] : undefined;
}

/**
 * Main orchestrator: launch → terms modal → delivery location → application
 * form tab → email OTP → every remaining field, top to bottom → stop at
 * CAPTCHA. Auto-solves and pre-fills the CAPTCHA (best-effort, via
 * solveTwCaptcha) but NEVER clicks "確認資料" — that button is a real,
 * irreversible POST of the application directly to the National Immigration
 * Agency (confirmed live: no client-side preview/review step exists), so the
 * applicant always makes that final click themselves.
 */
export async function fillTwEntryPermitApplication(
  input: TwApplyInput,
  options: TwApplyOptions = {},
): Promise<TwFillResult> {
  const headless = options.headless ?? true;
  const emailVerificationTimeoutMs = options.emailVerificationTimeoutMs ?? 120_000;
  const pagesFilled: string[] = [];
  let session: TwSession | null = null;

  try {
    session = await startTwSession({ headless, runId: options.runId });
    const { page } = session;

    await clickEnterApplication(page);
    pagesFilled.push("entry");

    await acceptTermsModal(page);
    pagesFilled.push("terms_modal");

    await dismissPhotoSpecDialogIfPresent(page);

    await fillDeliveryLocationTab(page, input.answers);
    pagesFilled.push("delivery_location");

    await switchToApplicationFormTab(page);

    await verifyTwEmail(page, input.applicantId, input.email, emailVerificationTimeoutMs);
    pagesFilled.push("email_verification");

    await fillPhotoAndBasicStatus(page, input.answers, options.photoFilePath ?? null);
    pagesFilled.push("photo_basic_status");

    await fillSupportingDocumentsSection(page, input.answers, options.supportingDocuments);
    pagesFilled.push("supporting_documents");

    await fillApplicantIdentity(page, input.answers);
    pagesFilled.push("applicant_identity");

    await fillTwContactAddress(page, input.answers);
    pagesFilled.push("tw_contact_address");

    await fillOtherNationalityBlock(page, input.answers);
    pagesFilled.push("other_nationality");

    await fillKinshipSection(page, input.answers);
    pagesFilled.push("kinship");

    await fillDeclarationSection(page, input.answers);
    pagesFilled.push("declaration");

    if (!(await isAtTwCaptchaBoundary(page))) {
      throw new TwUnexpectedPageError("Did not land on the CAPTCHA boundary after filling all fields", {
        url: page.url(),
      });
    }

    // Best-effort only — never blocks the halt, never verified against the
    // real server (that would require the one click this automation refuses
    // to make). See ./captcha.ts for why.
    const captchaOutcome = await solveTwCaptcha(page).catch(
      (): { solved: false } => ({ solved: false }),
    );
    pagesFilled.push(captchaOutcome.solved ? "captcha_auto_filled" : "captcha_boundary");

    const caseNumber = await tryReadTwCaseNumber(page);
    return {
      status: "stopped_at_captcha",
      ...(caseNumber ? { caseNumber } : {}),
      portalUrl: page.url(),
      pagesFilled,
      capturedAt: new Date().toISOString(),
      captchaAutoFilled: captchaOutcome.solved,
    };
  } catch (err) {
    const url = session?.page.url();
    return {
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
      ...(url ? { url } : {}),
    };
  } finally {
    if (session) await session.close();
  }
}

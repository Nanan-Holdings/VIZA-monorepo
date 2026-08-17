/**
 * Taiwan Online Entry Permit — main orchestrator.
 *
 * VIZA does not create or store Taiwan official accounts. The current NIA
 * entry flow is application-level email verification: VIZA enters the
 * controlled Taiwan mailbox configured for this runner, solves the send-code
 * CAPTCHA, receives the official email OTP over dedicated IMAP, verifies the
 * mailbox, fills/uploads, then submits.
 *
 * A replaceable TwOfficialLoginProvider is retained only as a future branch
 * for a real username/password login page. The ordinary email verification
 * entry must not be blocked by missing official-login adapter configuration.
 *
 * UPDATE — NAME-ATTRIBUTE VERIFICATION PASS: `TW_NAMES`/`KIN_NAMES` below map
 * each seed field_name to the real DOM `name` attribute, confirmed live via
 * direct DOM inspection of an in-progress coa.immigration.gov.tw session
 * (not label-text translation/guessing). This superseded an earlier
 * provisional-label-only version of this file. The seed's eligibility_category values don't
 * match the real radio codes — fixed locally via ELIGIBILITY_VALUE_FIX
 * rather than editing the cross-package seed script. Primitives still
 * degrade to a safe no-op (field left blank) when a control isn't found.
 */

import type { Page } from "@playwright/test";
import { startTwSession, type TwSession } from "./session";
import {
  isAtTwCaptchaBoundary,
  twClickButtonOrLink,
  twFillText,
  twFillByNameStrict,
  twFillDateByNameStrict,
  twPickCheckboxByNameStrict,
  twPickRadioByValueStrict,
  twSelectDependentByNameStrict,
  twSelectByNameStrict,
  twUploadFileByNameStrict,
  twUploadFileByDocumentDescriptionStrict,
  type TwFieldVerificationEntry,
  type TwScope,
} from "./fillers";
import {
  TwEmailVerificationError,
  TwOfficialLoginConfigurationError,
  TwOfficialValidationError,
  TwUnexpectedPageError,
} from "./errors";
import {
  TwInboxEmailOtpProvider,
  twFailClosedOfficialLoginProvider,
  twFailClosedOfficialLoginOtpProvider,
  type TwEmailOtpProvider,
  type TwOfficialLoginOtpProvider,
  type TwOfficialLoginProvider,
} from "./auth";
import { buildTwRunMetadata, type TwRunMetadata } from "./run-metadata";
import {
  solveTwCaptchaForSubmitWithRetry,
  solveTwCaptchaAndSubmitWithRetry,
  solveTwEmailCaptchaAndSendCodeWithRetry,
  type TwCaptchaSolveWithTelemetry,
} from "./captcha";
import { readTwOfficialReceiptEvidence, type TwOfficialReceiptEvidence } from "./receipt";
import { isTwHouseholdRevokedRequiredFromAnswers } from "./normalize";
import { acceptTermsModal } from "./terms-modal";
import { dismissTwPhotoSpecModalIfPresent } from "./photo-spec-modal";
import { fillTwDeliveryLocationTabStrict } from "./delivery-location";
import {
  collectTwOfficialValidationIssues,
  runTwRepairSubmissionLoop,
  type TwRepairOperation,
} from "./repair-loop";
import { writeTwContractFixture } from "./contract-fixture";
import {
  assertTwOfficialTermsConsentAudit,
  type TwOfficialTermsConsentAudit,
} from "./official-terms-consent";
import {
  RunnerJobOwnershipLostError,
  type RunnerExecutionContext,
} from "../queue/execution-context";

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
  /** Optional official-account login hook. Used only if a real login page is detected. */
  officialLoginProvider?: TwOfficialLoginProvider;
  /** Optional OTP callback for the official-account login hook. */
  officialLoginOtpProvider?: TwOfficialLoginOtpProvider;
  /** Replaceable provider for the official email OTP inside the application form. */
  emailOtpProvider?: TwEmailOtpProvider;
  /** Directory for masked CAPTCHA-boundary metadata screenshots. Defaults to OS temp. */
  diagnosticsOutputDir?: string;
  /** Directory for redacted official DOM contract fixtures on failures. */
  contractFixtureOutputDir?: string;
  /** France/Vietnam-style safe test mode: fill/verify through final CAPTCHA
   * readiness, but do not click the official final "確認資料" submit control. */
  stopBeforeFinalSubmit?: boolean;
  /** @deprecated use stopBeforeFinalSubmit. Kept temporarily for local callers. */
  mode?: "submit" | "pre_submit";
  /** Auditable VIZA confirmation of the two distinct official terms actions. */
  officialTermsConsent?: TwOfficialTermsConsentAudit;
  /** Live runner lease used to abort the browser and fence final submission. */
  executionContext?: RunnerExecutionContext;
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
      runMetadata: TwRunMetadata;
    }
  | {
      status: "submitted";
      checkpoint: TwPortalCheckpoint;
      caseNumber?: string;
      portalUrl: string;
      pagesFilled: string[];
      capturedAt: string;
      submittedAt: string;
      officialReceipt: TwOfficialReceiptEvidence;
      runMetadata: TwRunMetadata;
      captchaSolve: TwCaptchaSolveWithTelemetry;
    }
  | {
      status: "ready_to_submit";
      checkpoint: TwPortalCheckpoint;
      portalUrl: string;
      pagesFilled: string[];
      capturedAt: string;
      runMetadata: TwRunMetadata;
      captchaSolve: TwCaptchaSolveWithTelemetry;
      repairRounds: number;
      fieldAudit: {
        total: number;
        controls: string[];
      };
    }
  | {
      status: "failed";
      checkpoint: TwPortalCheckpoint;
      error: string;
      validationKeys?: string[];
      url?: string;
      contractFixturePath?: string;
    };

export type TwPortalCheckpoint =
  | "entry"
  | "terms"
  | "delivery"
  | "email_verify"
  | "form"
  | "captcha_boundary"
  | "submitted_receipt"
  | "validation_error"
  | "unknown";

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
  birth_place_mainland_region: "traveller.birthPlace1",
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
  email_verification: "email",
  email_verification_code: "verifyCode",
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
const TW_CONTACT_CITY_LABEL_BY_CODE: Record<string, string> = {
  "1": "臺北市",
  "2": "基隆市",
  "3": "新北市",
  "4": "宜蘭縣",
  "5": "新竹市",
  "6": "新竹縣",
  "7": "桃園市",
  "8": "苗栗縣",
  "9": "臺中市",
  "10": "彰化縣",
  "11": "南投縣",
  "12": "嘉義市",
  "13": "嘉義縣",
  "14": "雲林縣",
  "15": "臺南市",
  "16": "高雄市",
  "17": "澎湖縣",
  "18": "屏東縣",
  "19": "臺東縣",
  "20": "花蓮縣",
  "21": "金門縣",
  "22": "連江縣",
};
const OCCUPATION_STUDENT = "14";
const OCCUPATION_UNEMPLOYED = "61";
const OCCUPATION_RETIRED = "62";

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

const TW_OFFICIAL_HOST = "coa.immigration.gov.tw";
const TW_APPLY_PATH = "/coa-frontend/overseas-foreign-china/apply";
const TW_APPLY_VERIFY_PATH = "/coa-frontend/overseas-foreign-china/apply/verify";
const TW_ENTRY_CONTROL_NAMES = ["我要申請", "我要申请", "I want to apply"] as const;

function isExactTwApplyUrl(url: string): boolean {
  try {
    const current = new URL(url);
    return current.hostname === TW_OFFICIAL_HOST && current.pathname === TW_APPLY_PATH;
  } catch {
    return false;
  }
}

function isTwApplyVerifyUrl(url: string): boolean {
  try {
    const current = new URL(url);
    return current.hostname === TW_OFFICIAL_HOST && current.pathname === TW_APPLY_VERIFY_PATH;
  } catch {
    return false;
  }
}

export async function clickEnterApplication(
  page: Page,
  options: { allowEmailVerifyBoundary?: boolean } = {},
): Promise<void> {
  if (isExactTwApplyUrl(page.url())) return;

  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    for (const name of TW_ENTRY_CONTROL_NAMES) {
      const button = page.getByRole("button", { name, exact: false }).first();
      if ((await button.count().catch(() => 0)) > 0 && (await button.isVisible().catch(() => false))) {
        await button.click({ timeout: 10_000 });
        await page.waitForLoadState("domcontentloaded", { timeout: 15_000 }).catch(() => undefined);
        await waitForExactTwApplyUrl(page, options);
        return;
      }
      const link = page.getByRole("link", { name, exact: false }).first();
      if ((await link.count().catch(() => 0)) > 0 && (await link.isVisible().catch(() => false))) {
        await link.click({ timeout: 10_000 });
        await page.waitForLoadState("domcontentloaded", { timeout: 15_000 }).catch(() => undefined);
        await waitForExactTwApplyUrl(page, options);
        return;
      }
    }
    await page.waitForTimeout(150);
  }

  // Backward-compatible fallback for older traditional Chinese markup.
  const clicked = await twClickButtonOrLink(page, "我要申請");
  if (clicked) {
    await waitForExactTwApplyUrl(page, options);
    return;
  }

  throw new TwUnexpectedPageError('Could not find the Taiwan "I want to apply" entry control', { url: page.url() });
}

async function waitForExactTwApplyUrl(
  page: Page,
  options: { allowEmailVerifyBoundary?: boolean } = {},
): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (isExactTwApplyUrl(page.url())) return;
    if (isTwApplyVerifyUrl(page.url())) {
      if (options.allowEmailVerifyBoundary) return;
      throw new TwUnexpectedPageError("Taiwan entry control landed on the email verification boundary before /apply", {
        url: page.url(),
      });
    }
    await page.waitForTimeout(150);
  }
  throw new TwUnexpectedPageError("Taiwan entry control did not navigate to the official /apply URL", {
    url: page.url(),
  });
}

async function maybeCompleteOfficialLoginIfPresent(
  page: Page,
  input: TwApplyInput,
  options: TwApplyOptions,
  officialLoginProvider: TwOfficialLoginProvider,
  officialLoginOtpProvider: TwOfficialLoginOtpProvider,
): Promise<{ officialLogin: "authenticated"; method: string } | null> {
  if (!(await isTwOfficialLoginPage(page))) return null;
  const result = await officialLoginProvider.completeLogin(page, {
    applicantId: input.applicantId,
    runId: options.runId,
    otpProvider: officialLoginOtpProvider,
  });
  await page.waitForLoadState("domcontentloaded", { timeout: 15_000 }).catch(() => undefined);
  return { officialLogin: result.status, method: result.method };
}

async function isTwOfficialLoginPage(page: Page): Promise<boolean> {
  const passwordInputs = await page.locator('input[type="password"]').count().catch(() => 0);
  if (passwordInputs === 0) return false;
  const accountInputs = await page
    .locator(
      [
        'input[name*="user" i]',
        'input[name*="account" i]',
        'input[name*="login" i]',
        'input[name*="email" i]',
        'input[type="email"]',
      ].join(","),
    )
    .count()
    .catch(() => 0);
  if (accountInputs > 0) return true;
  const loginText = await page
    .getByText(/登入|登录|帳號|账号|password|密碼|密码/i)
    .count()
    .catch(() => 0);
  return loginText > 0;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  otpProvider: TwEmailOtpProvider,
  audit: TwFieldVerificationEntry[],
): Promise<void> {
  // /apply/verify: enter email → click send-code → wait for the email →
  // enter the code → click 驗證 → field becomes "xxx@gmail.com 已認證".
  // Confirmed live: the field's own label is literally the English string
  // "e-mail" (not a Chinese label). The standalone /apply/verify boundary
  // uses name="email"; the later application tab uses name="traveller.email".
  await fillTwVerificationEmail(page, email, audit);
  const sentAfter = new Date();
  await solveTwEmailCaptchaAndSendCodeWithRetry(page, { timeoutMs });

  const { code } = await otpProvider.waitForEmailOtp({ applicantId, email, sentAfter, timeoutMs });
  await fillTwVerificationCode(page, code);
  const verifyClicked = await twClickButtonOrLink(page, "驗證");
  if (!verifyClicked) {
    throw new TwEmailVerificationError('Could not find the "驗證" confirm control', { url: page.url() });
  }

  const verifiedText = page.getByText(new RegExp(`${escapeRegExp(email)}.*已認證`), { exact: false }).first();
  const ok = await waitForTwEmailVerifiedState(page, verifiedText);
  if (!ok) {
    throw new TwEmailVerificationError(
      "Email did not flip to the verified '已認證' state after entering the OTP code",
      { url: page.url() },
    );
  }
}

async function fillTwVerificationEmail(
  page: Page,
  email: string,
  audit: TwFieldVerificationEntry[],
): Promise<void> {
  const boundaryInput = page.locator(`[name="${TW_NAMES.email_verification}"]`).first();
  if ((await boundaryInput.count().catch(() => 0)) > 0 && (await boundaryInput.isVisible().catch(() => false))) {
    await twFillByNameStrict(page, "email", TW_NAMES.email_verification, email, audit);
    return;
  }
  await twFillByNameStrict(page, "email", TW_NAMES.email, email, audit);
}

async function fillTwVerificationCode(page: Page, code: string): Promise<void> {
  const byName = page.locator(`[name="${TW_NAMES.email_verification_code}"]`).first();
  if ((await byName.count().catch(() => 0)) > 0 && (await byName.isVisible().catch(() => false))) {
    await byName.fill(code, { timeout: 10_000 });
    return;
  }
  await twFillText(page, "驗證碼", code);
}

async function waitForTwEmailVerifiedState(page: Page, verifiedText: ReturnType<Page["getByText"]>): Promise<boolean> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (await verifiedText.first().isVisible().catch(() => false)) return true;
    if (isExactTwApplyUrl(page.url())) return true;
    await page.waitForTimeout(150);
  }
  return false;
}

async function fillPhotoAndBasicStatus(
  page: Page,
  a: Record<string, string>,
  photoFilePath: string | null,
  audit: TwFieldVerificationEntry[],
): Promise<void> {
  await twUploadFileByNameStrict(page, "photo", TW_NAMES.photo_upload, photoFilePath, audit);
  await twPickRadioByValueStrict(page, "first_time_applying", TW_NAMES.first_time_applying, a.first_time_applying === "yes" ? "Y" : "N", audit);
  await twPickRadioByValueStrict(page, "permit_type", TW_NAMES.permit_type, a.permit_type, audit);
  await twSelectByNameStrict(page, "permit_count", TW_NAMES.permit_count, a.permit_count, audit);
  await twPickRadioByValueStrict(
      page,
      "has_other_nationality_passport",
      TW_NAMES.has_other_nationality_passport,
      a.has_other_nationality_passport === "yes" ? "Y" : "N",
      audit,
  );
  await twPickRadioByValueStrict(
    page,
    "eligibility_category",
    TW_NAMES.eligibility_category,
    ELIGIBILITY_VALUE_FIX[a.eligibility_category] ?? a.eligibility_category,
    audit,
  );
  if (isTwHouseholdRevokedRequiredFromAnswers(a)) {
    const householdRevokedValue = a.household_revoked === "yes"
      ? "Y"
      : a.household_revoked === "no"
        ? "N"
        : undefined;
    await twPickRadioByValueStrict(page, "household_revoked", "householdRevoked", householdRevokedValue, audit);
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
  audit: TwFieldVerificationEntry[],
): Promise<void> {
  if (!docs) {
    throw new TwUnexpectedPageError("Taiwan supporting document paths were not provided", { url: page.url() });
  }

  // Confirmed live for all 4 categories: this exact document/wording is the
  // first row and applies regardless of eligibility_category.
  await twUploadFileByDocumentDescriptionStrict(
    page,
    "mainland_travel_document",
    MAINLAND_TRAVEL_DOCUMENT_DESCRIPTION,
    docs.mainlandTravelDocumentPath,
    audit,
  );

  const proofDescription = a.eligibility_category ? ELIGIBILITY_PROOF_DESCRIPTION[a.eligibility_category] : undefined;
  if (!proofDescription) {
    throw new TwUnexpectedPageError("Taiwan eligibility category did not map to a document description", { url: page.url() });
  }
  await twUploadFileByDocumentDescriptionStrict(page, "eligibility_supporting_document", proofDescription, docs.eligibilityProofPath, audit);

  // Confirmed live for categories tested (4, 5, 6, 9): this row is present
  // for all of them, gated on Hong Kong/Macau embassy office selection.
  if (HK_MACAU_EMBASSY_OFFICE_VALUES.has(a.embassy_office)) {
    await twUploadFileByDocumentDescriptionStrict(page, "hk_macau_id_scan", HK_MACAU_ID_DESCRIPTION, docs.hkMacauIdScanPath, audit);
  }

  if (a.has_other_nationality_passport === "yes") {
    await twUploadFileByDocumentDescriptionStrict(
      page,
      "other_nationality_passport_scan",
      OTHER_NATIONALITY_PASSPORT_DOC_DESCRIPTION,
      docs.otherNationalityPassportScanPath,
      audit,
    );
  }

  if (a.eligibility_category === "4" || a.mainland_id_number_not_applicable !== "true") {
    await twUploadFileByDocumentDescriptionStrict(page, "mainland_id_card_scan", MAINLAND_ID_CARD_DOC_DESCRIPTION, docs.mainlandIdCardScanPath, audit);
  }

  await twUploadFileByDocumentDescriptionStrict(
    page,
    "other_supporting_document",
    OTHER_SUPPORTING_DOC_DESCRIPTION,
    docs.otherSupportingDocumentPath,
    audit,
    { required: false },
  );

  // NOT modeled here — needs a human product decision, not a guess (see
  // docs/tw-entry-permit-auto-submit-plan.md): a "未成年且無法定代理人或
  // 監護人陪同來臺者" (minor without accompanying guardian) row appeared for
  // categories 1 and 2 during live testing but not for 3 or 4 — the pattern
  // across all 4 categories hasn't been fully confirmed, and VIZA doesn't
  // currently collect a guardian-consent document at all.
}

async function fillApplicantIdentity(page: Page, a: Record<string, string>, audit: TwFieldVerificationEntry[]): Promise<void> {
  await twFillByNameStrict(page, "name_chinese", TW_NAMES.name_chinese, a.name_chinese, audit);
  await twFillByNameStrict(page, "name_english", TW_NAMES.name_english, a.name_english, audit);
  await twFillDateByNameStrict(page, "date_of_birth", TW_NAMES.date_of_birth, a.date_of_birth, audit);
  await twFillByNameStrict(page, "passport_number", TW_NAMES.passport_number, a.passport_number, audit);
  await twFillDateByNameStrict(page, "passport_expiry_date", TW_NAMES.passport_expiry_date, a.passport_expiry_date, audit);
  await twSelectByNameStrict(page, "gender", TW_NAMES.gender, a.gender, audit);
  await twFillByNameStrict(page, "overseas_residency_id_number", TW_NAMES.overseas_residency_id_number, a.overseas_residency_id_number, audit);

  // "無大陸身分證號碼" (name="traveller.noPersonIdFlag") is a bare checkbox
  // with plain sibling text — confirmed live there is NO <label> element
  // wrapping it at all, which is why the earlier getByLabel-based lookup
  // was a silent no-op. Name-attribute targeting sidesteps that entirely.
  const noMainlandId = a.mainland_id_number_not_applicable === "true";
  await twPickCheckboxByNameStrict(page, "mainland_id_number_not_applicable", TW_NAMES.mainland_id_number_not_applicable, noMainlandId, audit);
  if (!noMainlandId && a.mainland_id_number) {
    await twFillByNameStrict(page, "mainland_id_number", TW_NAMES.mainland_id_number, a.mainland_id_number, audit);
  }

  await twSelectByNameStrict(page, "birth_place_is_mainland", TW_NAMES.birth_place_is_mainland, BIRTH_PLACE_VALUE_FIX[a.birth_place_is_mainland] ?? a.birth_place_is_mainland, audit);
  if (a.birth_place_is_mainland === "mainland") {
    await twSelectDependentByNameStrict(
      page,
      "birth_place_mainland_region",
      TW_NAMES.birth_place_mainland_region,
      a.birth_place_mainland_region,
      audit,
    );
  } else if (a.birth_place_other_country) {
    await twSelectByNameStrict(page, "birth_place_other_country", TW_NAMES.birth_place_other_country, a.birth_place_other_country, audit);
  }

  await twFillByNameStrict(page, "local_mobile_phone", TW_NAMES.local_mobile_phone, a.local_mobile_phone, audit);
  await twSelectByNameStrict(page, "current_occupation", TW_NAMES.current_occupation, a.current_occupation, audit);
  await twFillByNameStrict(page, "occupation_experience", TW_NAMES.occupation_experience, a.occupation_experience, audit, { required: false });
  if (a.current_occupation !== OCCUPATION_RETIRED && a.current_occupation !== OCCUPATION_UNEMPLOYED) {
    await twFillByNameStrict(page, "company_name", TW_NAMES.company_name, a.company_name, audit, { required: false });
  }
  if (![OCCUPATION_STUDENT, OCCUPATION_RETIRED, OCCUPATION_UNEMPLOYED].includes(a.current_occupation)) {
    await twFillByNameStrict(page, "job_title", TW_NAMES.job_title, a.job_title, audit, { required: false });
  }
  await twSelectByNameStrict(page, "is_taiwanese_spouse", TW_NAMES.is_taiwanese_spouse, a.is_taiwanese_spouse === "yes" ? "Y" : "N", audit);
  await twSelectByNameStrict(
    page,
    "traveling_with_parents",
    TW_NAMES.traveling_with_parents,
    a.traveling_with_parents ? (a.traveling_with_parents === "yes" ? "Y" : "N") : undefined,
    audit,
    { required: false },
  );
  await twFillByNameStrict(page, "overseas_address", TW_NAMES.overseas_address, a.overseas_address, audit);
}

async function fillTwContactAddress(page: Page, a: Record<string, string>, audit: TwFieldVerificationEntry[]): Promise<void> {
  await twSelectByNameStrict(page, "tw_contact_city", TW_NAMES.tw_contact_city, TW_CONTACT_CITY_LABEL_BY_CODE[a.tw_contact_city] ?? a.tw_contact_city, audit);
  await twSelectByNameStrict(page, "tw_contact_district", TW_NAMES.tw_contact_district, a.tw_contact_district, audit, { required: false });
  await twFillByNameStrict(page, "tw_contact_village", TW_NAMES.tw_contact_village, a.tw_contact_village, audit, { required: false });
  await twFillByNameStrict(page, "tw_contact_neighborhood", TW_NAMES.tw_contact_neighborhood, a.tw_contact_neighborhood, audit, { required: false });
  await twFillByNameStrict(page, "tw_contact_road", TW_NAMES.tw_contact_road, a.tw_contact_road, audit);
  await twFillByNameStrict(page, "tw_contact_lane", TW_NAMES.tw_contact_lane, a.tw_contact_lane, audit, { required: false });
  await twFillByNameStrict(page, "tw_contact_alley", TW_NAMES.tw_contact_alley, a.tw_contact_alley, audit, { required: false });
  await twFillByNameStrict(page, "tw_contact_building_number", TW_NAMES.tw_contact_building_number, a.tw_contact_building_number, audit);
  await twFillByNameStrict(page, "tw_local_phone", TW_NAMES.tw_local_phone, a.tw_local_phone, audit, { required: false });

  // "無在臺聯絡手機號碼" (name="traveller.noTwMobileFlag") — same bare-
  // checkbox-no-label situation as mainland_id_number_not_applicable above.
  const noTwMobile = a.tw_contact_mobile_not_applicable === "true";
  await twPickCheckboxByNameStrict(page, "tw_contact_mobile_not_applicable", TW_NAMES.tw_contact_mobile_not_applicable, noTwMobile, audit);
  if (!noTwMobile && a.tw_contact_mobile) {
    await twFillByNameStrict(page, "tw_contact_mobile", TW_NAMES.tw_contact_mobile, a.tw_contact_mobile, audit);
  }
}

async function fillOtherNationalityBlock(page: Page, a: Record<string, string>, audit: TwFieldVerificationEntry[]): Promise<void> {
  if (a.has_other_nationality_passport !== "yes") return;
  await twSelectByNameStrict(page, "other_nationality_country", TW_NAMES.other_nationality_country, a.other_nationality_country, audit);
  await twFillByNameStrict(page, "other_passport_number", TW_NAMES.other_passport_number, a.other_passport_number, audit);
  await twFillDateByNameStrict(page, "other_passport_expiry_date", TW_NAMES.other_passport_expiry_date, a.other_passport_expiry_date, audit);
}

async function fillKinshipSection(page: Page, a: Record<string, string>, audit: TwFieldVerificationEntry[]): Promise<void> {
  for (const group of KINSHIP_GROUPS) {
    const scope = twKinshipScope(page, group);
    const prefix = `kin_${group}_`;

    await twSelectByNameStrict(scope, `${prefix}status`, kinName(group, "status"), a[`${prefix}status`], audit, { required: false });
    await twFillByNameStrict(scope, `${prefix}name`, kinName(group, "name"), a[`${prefix}name`], audit, { required: false });
    await twFillDateByNameStrict(scope, `${prefix}date_of_birth`, kinName(group, "date_of_birth"), a[`${prefix}date_of_birth`], audit, { required: false });
    await twFillByNameStrict(scope, `${prefix}phone`, kinName(group, "phone"), a[`${prefix}phone`], audit, { required: false });
    await twSelectByNameStrict(scope, `${prefix}occupation`, kinName(group, "occupation"), a[`${prefix}occupation`], audit, { required: false });
    await twFillByNameStrict(scope, `${prefix}service_unit`, kinName(group, "service_unit"), a[`${prefix}service_unit`], audit, { required: false });
    await twFillByNameStrict(scope, `${prefix}job_title`, kinName(group, "job_title"), a[`${prefix}job_title`], audit, { required: false });

    const sameAsOverseas = a[`${prefix}current_address_same_as_overseas`] === "true";
    if (sameAsOverseas) {
      await twClickButtonOrLink(scope, KIN_SAME_AS_OVERSEAS_BUTTON_TEXT);
      await twFillByNameStrict(scope, `${prefix}current_address`, kinName(group, "current_address"), a[`${prefix}current_address`], audit, { required: false });
    } else if (a[`${prefix}current_address`]) {
      await twFillByNameStrict(scope, `${prefix}current_address`, kinName(group, "current_address"), a[`${prefix}current_address`], audit, { required: false });
    }
  }
}

async function fillDeclarationSection(page: Page, a: Record<string, string>, audit: TwFieldVerificationEntry[]): Promise<void> {
  const past = a.past_mainland_political_military_role === "true";
  await twPickCheckboxByNameStrict(page, "past_mainland_political_military_role", "traveller.beenCnPartyJob", past, audit);
  if (past) await twFillByNameStrict(page, "past_role_detail", "traveller.beenCnPartyJobDesc", a.past_role_detail, audit);

  const current = a.current_mainland_political_military_role === "true";
  await twPickCheckboxByNameStrict(page, "current_mainland_political_military_role", "traveller.cnPartyJob", current, audit);
  if (current) await twFillByNameStrict(page, "current_role_detail", "traveller.cnPartyJobDesc", a.current_role_detail, audit);

  const never = a.never_held_mainland_political_military_role === "true";
  await twPickCheckboxByNameStrict(page, "never_held_mainland_political_military_role", "traveller.neverCnPartyJob", never, audit);

  // Confirmed live: the real checkbox text is "同意上述條款，請打勾。" — the
  // earlier "我已閱讀並接受下列條款與條件" guess (mismarked "verbatim") did
  // not match anything on the actual page. Targeted by name="agree" now,
  // so the exact text no longer matters for matching, only for this comment.
  await twPickCheckboxByNameStrict(page, "accepted_terms", TW_NAMES.accepted_terms, a.accepted_terms === "true", audit);
}

function twOp(
  fieldKey: string,
  controlName: string,
  kind: TwRepairOperation["kind"],
  run: () => Promise<void>,
): TwRepairOperation {
  return { fieldKey, controlName, kind, run };
}

export function buildTwApplicationFieldOperations(
  page: Page,
  a: Record<string, string>,
  docs: TwApplyOptions["supportingDocuments"],
  photoFilePath: string | null,
  audit: TwFieldVerificationEntry[],
): TwRepairOperation[] {
  if (!docs) {
    throw new TwUnexpectedPageError("Taiwan supporting document paths were not provided", { url: page.url() });
  }

  const operations: TwRepairOperation[] = [
    twOp("photo", TW_NAMES.photo_upload, "file", () => twUploadFileByNameStrict(page, "photo", TW_NAMES.photo_upload, photoFilePath, audit)),
    twOp("first_time_applying", TW_NAMES.first_time_applying, "radio", () =>
      twPickRadioByValueStrict(page, "first_time_applying", TW_NAMES.first_time_applying, a.first_time_applying === "yes" ? "Y" : "N", audit)),
    twOp("permit_type", TW_NAMES.permit_type, "radio", () => twPickRadioByValueStrict(page, "permit_type", TW_NAMES.permit_type, a.permit_type, audit)),
    twOp("permit_count", TW_NAMES.permit_count, "select", () => twSelectByNameStrict(page, "permit_count", TW_NAMES.permit_count, a.permit_count, audit)),
    twOp("has_other_nationality_passport", TW_NAMES.has_other_nationality_passport, "radio", () =>
      twPickRadioByValueStrict(page, "has_other_nationality_passport", TW_NAMES.has_other_nationality_passport, a.has_other_nationality_passport === "yes" ? "Y" : "N", audit)),
    twOp("eligibility_category", TW_NAMES.eligibility_category, "radio", () =>
      twPickRadioByValueStrict(page, "eligibility_category", TW_NAMES.eligibility_category, ELIGIBILITY_VALUE_FIX[a.eligibility_category] ?? a.eligibility_category, audit)),
  ];

  if (isTwHouseholdRevokedRequiredFromAnswers(a)) {
    const householdRevokedValue = a.household_revoked === "yes" ? "Y" : a.household_revoked === "no" ? "N" : undefined;
    operations.push(twOp("household_revoked", "householdRevoked", "radio", () =>
      twPickRadioByValueStrict(page, "household_revoked", "householdRevoked", householdRevokedValue, audit)));
  }

  const eligibilityDocKey = `eligibility_supporting_document_${a.eligibility_category}`;
  const proofDescription = a.eligibility_category ? ELIGIBILITY_PROOF_DESCRIPTION[a.eligibility_category] : undefined;
  if (!proofDescription) {
    throw new TwUnexpectedPageError("Taiwan eligibility category did not map to a document description", { url: page.url() });
  }
  operations.push(
    twOp("mainland_travel_document", MAINLAND_TRAVEL_DOCUMENT_DESCRIPTION, "file", () =>
      twUploadFileByDocumentDescriptionStrict(page, "mainland_travel_document", MAINLAND_TRAVEL_DOCUMENT_DESCRIPTION, docs.mainlandTravelDocumentPath, audit)),
    twOp(eligibilityDocKey, proofDescription, "file", () =>
      twUploadFileByDocumentDescriptionStrict(page, "eligibility_supporting_document", proofDescription, docs.eligibilityProofPath, audit)),
  );
  if (HK_MACAU_EMBASSY_OFFICE_VALUES.has(a.embassy_office)) {
    operations.push(twOp("hk_macau_id_scan", HK_MACAU_ID_DESCRIPTION, "file", () =>
      twUploadFileByDocumentDescriptionStrict(page, "hk_macau_id_scan", HK_MACAU_ID_DESCRIPTION, docs.hkMacauIdScanPath, audit)));
  }
  if (a.has_other_nationality_passport === "yes") {
    operations.push(twOp("other_nationality_passport_scan", OTHER_NATIONALITY_PASSPORT_DOC_DESCRIPTION, "file", () =>
      twUploadFileByDocumentDescriptionStrict(page, "other_nationality_passport_scan", OTHER_NATIONALITY_PASSPORT_DOC_DESCRIPTION, docs.otherNationalityPassportScanPath, audit)));
  }
  if (a.eligibility_category === "4" || a.mainland_id_number_not_applicable !== "true") {
    operations.push(twOp("mainland_id_card_scan", MAINLAND_ID_CARD_DOC_DESCRIPTION, "file", () =>
      twUploadFileByDocumentDescriptionStrict(page, "mainland_id_card_scan", MAINLAND_ID_CARD_DOC_DESCRIPTION, docs.mainlandIdCardScanPath, audit)));
  }
  operations.push(twOp("other_supporting_document", OTHER_SUPPORTING_DOC_DESCRIPTION, "file", () =>
    twUploadFileByDocumentDescriptionStrict(page, "other_supporting_document", OTHER_SUPPORTING_DOC_DESCRIPTION, docs.otherSupportingDocumentPath, audit, { required: false })));

  operations.push(
    twOp("name_chinese", TW_NAMES.name_chinese, "text", () => twFillByNameStrict(page, "name_chinese", TW_NAMES.name_chinese, a.name_chinese, audit)),
    twOp("name_english", TW_NAMES.name_english, "text", () => twFillByNameStrict(page, "name_english", TW_NAMES.name_english, a.name_english, audit)),
    twOp("date_of_birth", TW_NAMES.date_of_birth, "date", () => twFillDateByNameStrict(page, "date_of_birth", TW_NAMES.date_of_birth, a.date_of_birth, audit)),
    twOp("passport_number", TW_NAMES.passport_number, "text", () => twFillByNameStrict(page, "passport_number", TW_NAMES.passport_number, a.passport_number, audit)),
    twOp("passport_expiry_date", TW_NAMES.passport_expiry_date, "date", () => twFillDateByNameStrict(page, "passport_expiry_date", TW_NAMES.passport_expiry_date, a.passport_expiry_date, audit)),
    twOp("gender", TW_NAMES.gender, "select", () => twSelectByNameStrict(page, "gender", TW_NAMES.gender, a.gender, audit)),
    twOp("overseas_residency_id_number", TW_NAMES.overseas_residency_id_number, "text", () => twFillByNameStrict(page, "overseas_residency_id_number", TW_NAMES.overseas_residency_id_number, a.overseas_residency_id_number, audit)),
  );
  const noMainlandId = a.mainland_id_number_not_applicable === "true";
  operations.push(twOp("mainland_id_number_not_applicable", TW_NAMES.mainland_id_number_not_applicable, "checkbox", () =>
    twPickCheckboxByNameStrict(page, "mainland_id_number_not_applicable", TW_NAMES.mainland_id_number_not_applicable, noMainlandId, audit)));
  if (!noMainlandId && a.mainland_id_number) {
    operations.push(twOp("mainland_id_number", TW_NAMES.mainland_id_number, "text", () => twFillByNameStrict(page, "mainland_id_number", TW_NAMES.mainland_id_number, a.mainland_id_number, audit)));
  }
  operations.push(
    twOp("birth_place_is_mainland", TW_NAMES.birth_place_is_mainland, "select", () =>
      twSelectByNameStrict(page, "birth_place_is_mainland", TW_NAMES.birth_place_is_mainland, BIRTH_PLACE_VALUE_FIX[a.birth_place_is_mainland] ?? a.birth_place_is_mainland, audit)),
    twOp("local_mobile_phone", TW_NAMES.local_mobile_phone, "text", () => twFillByNameStrict(page, "local_mobile_phone", TW_NAMES.local_mobile_phone, a.local_mobile_phone, audit)),
    twOp("current_occupation", TW_NAMES.current_occupation, "select", () => twSelectByNameStrict(page, "current_occupation", TW_NAMES.current_occupation, a.current_occupation, audit)),
    twOp("occupation_experience", TW_NAMES.occupation_experience, "text", () => twFillByNameStrict(page, "occupation_experience", TW_NAMES.occupation_experience, a.occupation_experience, audit, { required: false })),
  );
  if (a.birth_place_is_mainland === "mainland") {
    operations.push(twOp("birth_place_mainland_region", TW_NAMES.birth_place_mainland_region, "select", () =>
      twSelectDependentByNameStrict(
        page,
        "birth_place_mainland_region",
        TW_NAMES.birth_place_mainland_region,
        a.birth_place_mainland_region,
        audit,
      )));
  } else if (a.birth_place_other_country) {
    operations.push(twOp("birth_place_other_country", TW_NAMES.birth_place_other_country, "select", () =>
      twSelectByNameStrict(page, "birth_place_other_country", TW_NAMES.birth_place_other_country, a.birth_place_other_country, audit)));
  }
  if (a.current_occupation !== OCCUPATION_RETIRED && a.current_occupation !== OCCUPATION_UNEMPLOYED) {
    operations.push(twOp("company_name", TW_NAMES.company_name, "text", () => twFillByNameStrict(page, "company_name", TW_NAMES.company_name, a.company_name, audit)));
  }
  if (![OCCUPATION_STUDENT, OCCUPATION_RETIRED, OCCUPATION_UNEMPLOYED].includes(a.current_occupation)) {
    operations.push(twOp("job_title", TW_NAMES.job_title, "text", () => twFillByNameStrict(page, "job_title", TW_NAMES.job_title, a.job_title, audit)));
  }

  operations.push(
    twOp("is_taiwanese_spouse", TW_NAMES.is_taiwanese_spouse, "select", () => twSelectByNameStrict(page, "is_taiwanese_spouse", TW_NAMES.is_taiwanese_spouse, a.is_taiwanese_spouse === "yes" ? "Y" : "N", audit)),
    twOp("traveling_with_parents", TW_NAMES.traveling_with_parents, "select", () => twSelectByNameStrict(page, "traveling_with_parents", TW_NAMES.traveling_with_parents, a.traveling_with_parents ? (a.traveling_with_parents === "yes" ? "Y" : "N") : undefined, audit, { required: false })),
    twOp("overseas_address", TW_NAMES.overseas_address, "text", () => twFillByNameStrict(page, "overseas_address", TW_NAMES.overseas_address, a.overseas_address, audit)),
    twOp("tw_contact_city", TW_NAMES.tw_contact_city, "select", () => twSelectByNameStrict(page, "tw_contact_city", TW_NAMES.tw_contact_city, TW_CONTACT_CITY_LABEL_BY_CODE[a.tw_contact_city] ?? a.tw_contact_city, audit)),
    twOp("tw_contact_district", TW_NAMES.tw_contact_district, "select", () => twSelectByNameStrict(page, "tw_contact_district", TW_NAMES.tw_contact_district, a.tw_contact_district, audit, { required: false })),
    twOp("tw_contact_village", TW_NAMES.tw_contact_village, "text", () => twFillByNameStrict(page, "tw_contact_village", TW_NAMES.tw_contact_village, a.tw_contact_village, audit, { required: false })),
    twOp("tw_contact_neighborhood", TW_NAMES.tw_contact_neighborhood, "text", () => twFillByNameStrict(page, "tw_contact_neighborhood", TW_NAMES.tw_contact_neighborhood, a.tw_contact_neighborhood, audit, { required: false })),
    twOp("tw_contact_road", TW_NAMES.tw_contact_road, "text", () => twFillByNameStrict(page, "tw_contact_road", TW_NAMES.tw_contact_road, a.tw_contact_road, audit)),
    twOp("tw_contact_lane", TW_NAMES.tw_contact_lane, "text", () => twFillByNameStrict(page, "tw_contact_lane", TW_NAMES.tw_contact_lane, a.tw_contact_lane, audit, { required: false })),
    twOp("tw_contact_alley", TW_NAMES.tw_contact_alley, "text", () => twFillByNameStrict(page, "tw_contact_alley", TW_NAMES.tw_contact_alley, a.tw_contact_alley, audit, { required: false })),
    twOp("tw_contact_building_number", TW_NAMES.tw_contact_building_number, "text", () => twFillByNameStrict(page, "tw_contact_building_number", TW_NAMES.tw_contact_building_number, a.tw_contact_building_number, audit)),
    twOp("tw_local_phone", TW_NAMES.tw_local_phone, "text", () => twFillByNameStrict(page, "tw_local_phone", TW_NAMES.tw_local_phone, a.tw_local_phone, audit, { required: false })),
  );
  const noTwMobile = a.tw_contact_mobile_not_applicable === "true";
  operations.push(twOp("tw_contact_mobile_not_applicable", TW_NAMES.tw_contact_mobile_not_applicable, "checkbox", () =>
    twPickCheckboxByNameStrict(page, "tw_contact_mobile_not_applicable", TW_NAMES.tw_contact_mobile_not_applicable, noTwMobile, audit)));
  if (!noTwMobile && a.tw_contact_mobile) {
    operations.push(twOp("tw_contact_mobile", TW_NAMES.tw_contact_mobile, "text", () => twFillByNameStrict(page, "tw_contact_mobile", TW_NAMES.tw_contact_mobile, a.tw_contact_mobile, audit)));
  }
  if (a.has_other_nationality_passport === "yes") {
    operations.push(
      twOp("other_nationality_country", TW_NAMES.other_nationality_country, "select", () => twSelectByNameStrict(page, "other_nationality_country", TW_NAMES.other_nationality_country, a.other_nationality_country, audit)),
      twOp("other_passport_number", TW_NAMES.other_passport_number, "text", () => twFillByNameStrict(page, "other_passport_number", TW_NAMES.other_passport_number, a.other_passport_number, audit)),
      twOp("other_passport_expiry_date", TW_NAMES.other_passport_expiry_date, "date", () => twFillDateByNameStrict(page, "other_passport_expiry_date", TW_NAMES.other_passport_expiry_date, a.other_passport_expiry_date, audit)),
    );
  }

  for (const group of KINSHIP_GROUPS) {
    const prefix = `kin_${group}_`;
    const parentGroup = group === "father" || group === "mother";
    const livingParent = parentGroup && a[`${prefix}status`] === "1";
    operations.push(
      twOp(`${prefix}status`, kinName(group, "status"), "select", () => twSelectByNameStrict(page, `${prefix}status`, kinName(group, "status"), a[`${prefix}status`], audit, { required: parentGroup })),
      twOp(`${prefix}name`, kinName(group, "name"), "text", () => twFillByNameStrict(page, `${prefix}name`, kinName(group, "name"), a[`${prefix}name`], audit, { required: livingParent })),
      twOp(`${prefix}date_of_birth`, kinName(group, "date_of_birth"), "date", () => twFillDateByNameStrict(page, `${prefix}date_of_birth`, kinName(group, "date_of_birth"), a[`${prefix}date_of_birth`], audit, { required: livingParent })),
      twOp(`${prefix}phone`, kinName(group, "phone"), "text", () => twFillByNameStrict(page, `${prefix}phone`, kinName(group, "phone"), a[`${prefix}phone`], audit, { required: livingParent })),
      twOp(`${prefix}occupation`, kinName(group, "occupation"), "select", () => twSelectByNameStrict(page, `${prefix}occupation`, kinName(group, "occupation"), a[`${prefix}occupation`], audit, { required: livingParent })),
      twOp(`${prefix}service_unit`, kinName(group, "service_unit"), "text", () => twFillByNameStrict(page, `${prefix}service_unit`, kinName(group, "service_unit"), a[`${prefix}service_unit`], audit, { required: livingParent })),
      twOp(`${prefix}job_title`, kinName(group, "job_title"), "text", () => twFillByNameStrict(page, `${prefix}job_title`, kinName(group, "job_title"), a[`${prefix}job_title`], audit, { required: livingParent })),
    );
    operations.push(twOp(`${prefix}current_address`, kinName(group, "current_address"), "text", () =>
      twFillByNameStrict(page, `${prefix}current_address`, kinName(group, "current_address"), a[`${prefix}current_address`], audit, { required: livingParent })));
  }

  const past = a.past_mainland_political_military_role === "true";
  const current = a.current_mainland_political_military_role === "true";
  const never = a.never_held_mainland_political_military_role === "true";
  operations.push(
    twOp("past_mainland_political_military_role", "traveller.beenCnPartyJob", "checkbox", () => twPickCheckboxByNameStrict(page, "past_mainland_political_military_role", "traveller.beenCnPartyJob", past, audit)),
    twOp("current_mainland_political_military_role", "traveller.cnPartyJob", "checkbox", () => twPickCheckboxByNameStrict(page, "current_mainland_political_military_role", "traveller.cnPartyJob", current, audit)),
    twOp("never_held_mainland_political_military_role", "traveller.neverCnPartyJob", "checkbox", () => twPickCheckboxByNameStrict(page, "never_held_mainland_political_military_role", "traveller.neverCnPartyJob", never, audit)),
    twOp("accepted_terms", TW_NAMES.accepted_terms, "checkbox", () => twPickCheckboxByNameStrict(page, "accepted_terms", TW_NAMES.accepted_terms, a.accepted_terms === "true", audit)),
  );
  if (past) operations.push(twOp("past_role_detail", "traveller.beenCnPartyJobDesc", "text", () => twFillByNameStrict(page, "past_role_detail", "traveller.beenCnPartyJobDesc", a.past_role_detail, audit)));
  if (current) operations.push(twOp("current_role_detail", "traveller.cnPartyJobDesc", "text", () => twFillByNameStrict(page, "current_role_detail", "traveller.cnPartyJobDesc", a.current_role_detail, audit)));

  return operations;
}

/**
 * Main orchestrator: launch → terms modal → delivery location → application
 * form tab → email OTP → every remaining field, top to bottom → solve the
 * final image CAPTCHA through the shared 2captcha client → click "確認資料".
 * That button is a real POST of the application directly to the National
 * Immigration Agency (confirmed live: no client-side preview/review step
 * exists), so this function only reaches it after every field/file verifier
 * has passed.
 */
export async function fillTwEntryPermitApplication(
  input: TwApplyInput,
  options: TwApplyOptions = {},
): Promise<TwFillResult> {
  const formalSubmit = !options.stopBeforeFinalSubmit && options.mode !== "pre_submit";
  if (formalSubmit) {
    assertTwOfficialTermsConsentAudit(options.officialTermsConsent);
  }
  const maxAttempts = options.stopBeforeFinalSubmit || options.mode === "pre_submit" ? 3 : 1;
  let lastResult: TwFillResult | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await fillTwEntryPermitApplicationOnce(input, {
      ...options,
      runId: attempt === 1 ? options.runId : `${options.runId ?? "tw"}-attempt-${attempt}`,
    });
    if (result.status !== "failed") return result;
    lastResult = result;
    if (!isRetryableTwAttemptFailure(result) || attempt === maxAttempts) return result;
  }
  return lastResult ?? { status: "failed", checkpoint: "unknown", error: "Taiwan runner had no configured attempts" };
}

async function fillTwEntryPermitApplicationOnce(
  input: TwApplyInput,
  options: TwApplyOptions = {},
): Promise<TwFillResult> {
  const headless = options.headless ?? true;
  const stopBeforeFinalSubmit = options.stopBeforeFinalSubmit ?? options.mode === "pre_submit";
  const mode = stopBeforeFinalSubmit ? "pre_submit" : "submit";
  const emailVerificationTimeoutMs = options.emailVerificationTimeoutMs ?? 120_000;
  const officialLoginProvider = options.officialLoginProvider ?? twFailClosedOfficialLoginProvider;
  const officialLoginOtpProvider = options.officialLoginOtpProvider ?? twFailClosedOfficialLoginOtpProvider;
  const emailOtpProvider = options.emailOtpProvider ?? new TwInboxEmailOtpProvider();
  const pagesFilled: string[] = [];
  const fieldAudit: TwFieldVerificationEntry[] = [];
  let officialLoginAuth: { officialLogin: "authenticated"; method: string } | null = null;
  let session: TwSession | null = null;
  let abortListener: (() => void) | null = null;
  let emailVerified = false;
  let checkpoint: TwPortalCheckpoint = "unknown";

  try {
    session = await startTwSession({
      headless,
      runId: options.runId,
    });
    abortListener = () => {
      void session?.close().catch(() => undefined);
    };
    options.executionContext?.signal.addEventListener("abort", abortListener, { once: true });
    options.executionContext?.assertOwned();
    const { page } = session;

    officialLoginAuth = await maybeCompleteOfficialLoginIfPresent(
      page,
      input,
      options,
      officialLoginProvider,
      officialLoginOtpProvider,
    );
    if (officialLoginAuth) pagesFilled.push("authorized_login");

    await clickEnterApplication(page, { allowEmailVerifyBoundary: true });
    pagesFilled.push("entry");
    checkpoint = "entry";
    officialLoginAuth ??= await maybeCompleteOfficialLoginIfPresent(
      page,
      input,
      options,
      officialLoginProvider,
      officialLoginOtpProvider,
    );
    if (officialLoginAuth && !pagesFilled.includes("authorized_login")) pagesFilled.push("authorized_login");

    if (isTwApplyVerifyUrl(page.url())) {
      checkpoint = "email_verify";
      await verifyTwEmail(page, input.applicantId, input.email, emailVerificationTimeoutMs, emailOtpProvider, fieldAudit);
      emailVerified = true;
      pagesFilled.push("email_verification");
      await page.waitForLoadState("domcontentloaded", { timeout: 15_000 }).catch(() => undefined);
    }

    await acceptTermsModal(page);
    pagesFilled.push("terms_modal");
    checkpoint = "terms";

    await dismissTwPhotoSpecModalIfPresent(page);

    await fillTwDeliveryLocationTabStrict(page, input.answers, fieldAudit);
    pagesFilled.push("delivery_location");
    checkpoint = "delivery";

    await switchToApplicationFormTab(page);

    if (!emailVerified) {
      checkpoint = "email_verify";
      await verifyTwEmail(page, input.applicantId, input.email, emailVerificationTimeoutMs, emailOtpProvider, fieldAudit);
      emailVerified = true;
      pagesFilled.push("email_verification");
    }

    checkpoint = "form";
    const operations = buildTwApplicationFieldOperations(
      page,
      input.answers,
      options.supportingDocuments,
      options.photoFilePath ?? null,
      fieldAudit,
    );
    const repairResult = await runTwRepairSubmissionLoop({
      page,
      operations,
      mode,
      validate: () => collectTwOfficialValidationIssues(page),
      prepareSubmit: () => solveTwCaptchaForSubmitWithRetry(page),
      submit: () => solveTwCaptchaAndSubmitWithRetry(page, {
        beforeFinalSubmit: () => options.executionContext?.checkpoint("taiwan final official submit"),
      }),
      readReceipt: () => readTwOfficialReceiptEvidence(page),
      maxRounds: 3,
    });
    pagesFilled.push("application_repair_loop", `repair_rounds_${repairResult.rounds}`, "captcha_solved");
    if (repairResult.status === "submitted") pagesFilled.push("final_submit");
    if (repairResult.status === "ready_to_submit") pagesFilled.push("ready_to_submit");
    checkpoint = repairResult.status === "submitted" ? "submitted_receipt" : "captcha_boundary";

    const runMetadata = await buildTwRunMetadata({
      page,
      runId: options.runId,
      auth: officialLoginAuth ?? { officialLogin: "authenticated", method: "application_email_verification" },
      fields: fieldAudit,
      diagnosticsOutputDir: options.diagnosticsOutputDir,
    });

    if (repairResult.status === "ready_to_submit") {
      const readyResult = {
        status: "ready_to_submit",
        checkpoint,
        portalUrl: page.url(),
        pagesFilled,
        capturedAt: new Date().toISOString(),
        runMetadata,
        captchaSolve: repairResult.captchaSolve,
        repairRounds: repairResult.rounds,
        fieldAudit: {
          total: fieldAudit.length,
          controls: [...new Set(fieldAudit.map((entry) => entry.controlName))].slice(0, 80),
        },
      } as const;
      return readyResult;
    }

    const caseNumber = repairResult.receipt.caseNumber;
    return {
      status: "submitted",
      checkpoint,
      ...(caseNumber ? { caseNumber } : {}),
      portalUrl: page.url(),
      pagesFilled,
      capturedAt: new Date().toISOString(),
      submittedAt: repairResult.receipt.capturedAt,
      officialReceipt: repairResult.receipt,
      runMetadata,
      captchaSolve: repairResult.captchaSolve,
    };
  } catch (err) {
    if (err instanceof RunnerJobOwnershipLostError) throw err;
    if (options.executionContext?.signal.aborted) {
      options.executionContext.assertOwned();
    }
    if (err instanceof TwOfficialLoginConfigurationError) {
      throw err;
    }
    if (err instanceof TwOfficialValidationError) checkpoint = "validation_error";
    const url = session?.page.url();
    const contractFixturePath = session
      ? await writeTwContractFixture({
          page: session.page,
          outputDir: options.contractFixtureOutputDir,
          runId: options.runId,
          phase: pagesFilled.at(-1) ?? "bootstrap",
          error: err,
        }).catch(() => undefined)
      : undefined;
    return {
      status: "failed",
      checkpoint,
      error: err instanceof Error ? err.message : String(err),
      ...(err instanceof TwOfficialValidationError ? { validationKeys: err.validationKeys } : {}),
      ...(url ? { url } : {}),
      ...(contractFixturePath ? { contractFixturePath } : {}),
    };
  } finally {
    if (abortListener) options.executionContext?.signal.removeEventListener("abort", abortListener);
    if (session) await session.close();
  }
}

function isRetryableTwAttemptFailure(result: TwFillResult): boolean {
  if (result.status !== "failed") return false;
  if (result.checkpoint === "submitted_receipt") return false;
  return /not found|not present|not visible|not available|timeout|animation|re-render|inbox timeout|CAPTCHA input|send-verification-code/i.test(result.error);
}

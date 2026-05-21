/**
 * Orchestrator for the Subclass 600 prefill assistant. Walks the
 * 20-page VSS-AP-600 form, fills each section from a normalised
 * answer map, and stops on the Review page (mirrors DS-160's
 * stop-at-sign-and-submit boundary).
 *
 * The orchestrator is intentionally defensive: every page is preceded
 * by a heading-based detection pass, and unknown fields are filled
 * with `No` defaults so the form does not block on questions VIZA
 * does not capture in v1.
 */

import type { Page } from "playwright";
import {
  clickByName,
  clickNext,
  clickYesNo,
  dismissConfirmModalIfShown,
  fillByName,
  fillUncheckedRadiosDefault,
  pickFromCombobox,
  readHeadings,
  readPageMeta,
  readTrn,
  readValidationErrors,
  selectByLabel,
  selectByName,
} from "./aspnet";
import {
  AUTHORISED_RECIPIENT_FIELDS,
  APPLICANT_FIELDS,
  CHARACTER_FIELDS,
  CONTACT_FIELDS,
  CONTEXT_FIELDS,
  CRITICAL_CONFIRM_FIELDS,
  DECLARATION_FIELDS,
  EMPLOYMENT_FIELDS,
  ENTRY_FIELDS,
  FINANCIAL_FIELDS,
  HEALTH_FIELDS,
  NON_ACCOMPANYING_FIELDS,
  TERMS_FIELDS,
  TRAVELLING_FIELDS,
  VALIDATION_MARKERS,
  VISA_HISTORY_FIELDS,
} from "./selectors";
import { detectPage, isFillablePage } from "./pages";
import type { AuPageId } from "./pages";
import {
  NationalityIneligibleError,
  UnexpectedPageError,
  ValidationFailedError,
} from "./errors";
import type { AnswerMap } from "./normalize";

export interface RunOptions {
  /** Maximum pages to walk before bailing out (defensive). */
  maxPages?: number;
  /** If true, stop at the Critical Data Confirmation page (page 4). */
  stopAtCriticalConfirm?: boolean;
}

export interface RunResult {
  reachedPage: AuPageId;
  trn: string | null;
  pagesWalked: number;
  validationErrors: string[];
}

/**
 * Walk the form. Caller is expected to have driven login and clicked
 * `New application → Visitor Visa (600)` already, so the page should
 * land on `1/20 Terms and Conditions`.
 */
export async function runVisitor600Application(
  page: Page,
  answers: AnswerMap,
  options: RunOptions = {},
): Promise<RunResult> {
  const maxPages = options.maxPages ?? 25;
  let trn: string | null = null;
  let lastError: string[] = [];

  for (let i = 0; i < maxPages; i++) {
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    const pageMeta = await readPageMeta(page);
    const headings = await readHeadings(page);
    const id = detectPage({ url: page.url(), headings, pageMeta });

    if (!trn) {
      trn = await readTrn(page);
    }

    if (id === "review_page") {
      return { reachedPage: id, trn, pagesWalked: i, validationErrors: lastError };
    }
    if (id === "payment") {
      return { reachedPage: id, trn, pagesWalked: i, validationErrors: lastError };
    }

    if (id === "unknown") {
      throw new UnexpectedPageError("Could not classify the current page.", {
        detected: "unknown",
        url: page.url(),
        details: { headings, pageMeta },
      });
    }

    await fillPage(page, id, answers);
    if (isFillablePage(id)) {
      await fillUncheckedRadiosDefault(page, "No");
    }
    await clickNext(page);
    // Cross-section Confirm modal sometimes interposes
    await dismissConfirmModalIfShown(page);
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);

    const errs = await readValidationErrors(page);
    if (errs.length > 0) {
      const ineligible = errs.find((e) => VALIDATION_MARKERS.nationalityIneligible.test(e));
      if (ineligible) {
        throw new NationalityIneligibleError(ineligible, { detected: id, url: page.url() });
      }
      lastError = errs;
      // The orchestrator does NOT auto-recover from validation errors
      // — the caller decides whether to surface them or retry with a
      // corrected answer map.
      throw new ValidationFailedError(`Page ${id} validation failed`, {
        detected: id,
        validationMessages: errs,
        url: page.url(),
      });
    }

    if (options.stopAtCriticalConfirm && id === "critical_data_confirmation") {
      return { reachedPage: id, trn, pagesWalked: i + 1, validationErrors: [] };
    }
  }

  throw new UnexpectedPageError(`Walked ${maxPages} pages without reaching the Review page`, {
    url: page.url(),
  });
}

async function fillPage(page: Page, id: AuPageId, answers: AnswerMap): Promise<void> {
  switch (id) {
    case "terms_and_conditions":
      await page.locator(TERMS_FIELDS.agree).check();
      return;
    case "application_context":
      await fillApplicationContext(page, answers);
      return;
    case "primary_applicant":
      await fillPrimaryApplicant(page, answers);
      return;
    case "critical_data_confirmation":
      await clickYesNo(page, CRITICAL_CONFIRM_FIELDS.isCorrect, "Yes");
      return;
    case "travelling_companions":
      await fillTravellingCompanions(page, answers);
      return;
    case "contact_details":
      await fillContactDetails(page, answers);
      return;
    case "authorised_recipient":
      await fillAuthorisedRecipient(page, answers);
      return;
    case "non_accompanying_family":
      await clickYesNo(page, NON_ACCOMPANYING_FIELDS.hasNonAccompanyingFamily, "No");
      return;
    case "entry_to_australia":
      await fillEntryToAustralia(page, answers);
      return;
    case "current_overseas_employment":
      await fillCurrentOverseasEmployment(page, answers);
      return;
    case "financial_support":
      await fillFinancialSupport(page, answers);
      return;
    case "health_declarations":
      // All defaults to No — orchestrator's fallback handles it.
      return;
    case "character_declarations":
      // All defaults to No — orchestrator's fallback handles it.
      return;
    case "visa_history":
      await fillVisaHistory(page, answers);
      return;
    case "declarations":
      await fillDeclarations(page);
      return;
    default:
      // No-op for informational pages
      return;
  }
}

async function fillApplicationContext(page: Page, a: AnswerMap): Promise<void> {
  await clickYesNo(page, CONTEXT_FIELDS.outsideAustralia, asYesNo(a.applying_outside_australia, "Yes"));
  if (asYesNo(a.applying_outside_australia, "Yes") === "Yes") {
    await clickYesNo(page, CONTEXT_FIELDS.allOutsideAustralia, asYesNo(a.applying_all_outside_australia, "Yes"));
  }
  if (a.current_location_country) await selectByName(page, CONTEXT_FIELDS.currentLocation, String(a.current_location_country));
  if (a.current_location_legal_status) {
    const map: Record<string, string> = {
      citizen: "1", permanent_resident: "2", visitor: "3",
      student: "4", work_visa: "5", no_legal_status: "7", other: "99",
    };
    await selectByName(page, CONTEXT_FIELDS.legalStatus, map[String(a.current_location_legal_status)] ?? "1");
  }
  // Initial purpose
  if (a.purpose_of_stay_initial) {
    const map: Record<string, string> = {
      business: "2", tourism: "3", family_visit: "4", study: "5",
      religious_event: "6", other: "7",
    };
    await selectByName(page, CONTEXT_FIELDS.initialPurpose, map[String(a.purpose_of_stay_initial)] ?? "3");
  }
  if (a.significant_dates_in_australia) {
    await fillByName(page, CONTEXT_FIELDS.significantDates, String(a.significant_dates_in_australia));
  }
  // Stream — pick by label match (live values may shift across builds)
  const streamSeed = String(a.stream || "tourist");
  const streamLabelMap: Record<string, RegExp> = {
    business_visitor: /Business Visitor stream/i,
    frequent_traveller: /Frequent Traveller stream/i,
    sponsored_family: /Sponsored Family stream/i,
    tourist: /Tourist stream/i,
  };
  const labelPattern = streamLabelMap[streamSeed] ?? streamLabelMap.tourist;
  const radios = page.locator(`input[name="${CONTEXT_FIELDS.stream}"][type="radio"]`);
  const cnt = await radios.count();
  for (let i = 0; i < cnt; i++) {
    const r = radios.nth(i);
    const label = (await r.evaluate((el) => el.parentElement?.textContent || "")).trim();
    if (labelPattern.test(label)) {
      await r.click();
      break;
    }
  }
}

async function fillPrimaryApplicant(page: Page, a: AnswerMap): Promise<void> {
  if (a.family_name) await fillByName(page, APPLICANT_FIELDS.familyName, String(a.family_name));
  if (a.given_names) await fillByName(page, APPLICANT_FIELDS.givenNames, String(a.given_names));
  if (a.sex) {
    const v = String(a.sex);
    await clickByName(page, APPLICANT_FIELDS.sex, v);
  }
  if (a.date_of_birth) await fillByName(page, APPLICANT_FIELDS.dateOfBirth, String(a.date_of_birth));
  if (a.passport_number) await fillByName(page, APPLICANT_FIELDS.passportNumber, String(a.passport_number));
  if (a.passport_country_of_issue) await selectByName(page, APPLICANT_FIELDS.passportCountry, String(a.passport_country_of_issue));
  if (a.passport_nationality) await selectByName(page, APPLICANT_FIELDS.passportNationality, String(a.passport_nationality));
  if (a.passport_date_of_issue) await fillByName(page, APPLICANT_FIELDS.passportDateOfIssue, String(a.passport_date_of_issue));
  if (a.passport_date_of_expiry) await fillByName(page, APPLICANT_FIELDS.passportDateOfExpiry, String(a.passport_date_of_expiry));
  // Place of issue: prefer the SELECT version if present (PRC), else
  // fall back to the free-text variant.
  const isSelect = await page.locator(`select[name="${APPLICANT_FIELDS.passportPlaceOfIssue}"]`).count();
  if (isSelect && a.passport_place_of_issue) {
    await selectByName(page, APPLICANT_FIELDS.passportPlaceOfIssue, String(a.passport_place_of_issue));
  } else if (a.passport_issuing_authority) {
    await fillByName(page, APPLICANT_FIELDS.passportPlaceOfIssueFreeText, String(a.passport_issuing_authority));
  }
  if (a.has_national_id) await clickYesNo(page, APPLICANT_FIELDS.hasNationalId, asYesNo(a.has_national_id, "No"));
  if (asYesNo(a.has_national_id, "No") === "No" && a.national_id_reason_for_not_providing) {
    await fillByName(page, APPLICANT_FIELDS.nationalIdReason, String(a.national_id_reason_for_not_providing));
  }
  if (a.town_of_birth) await fillByName(page, APPLICANT_FIELDS.bornCity, String(a.town_of_birth));
  if (a.state_or_province_of_birth) await fillByName(page, APPLICANT_FIELDS.bornState, String(a.state_or_province_of_birth));
  if (a.country_of_birth) await selectByName(page, APPLICANT_FIELDS.bornCountry, String(a.country_of_birth));
  if (a.relationship_status) await selectByLabel(page, APPLICANT_FIELDS.relationshipStatus, new RegExp(`^${labelForRelationshipStatus(String(a.relationship_status))}$`, "i"));
}

function labelForRelationshipStatus(seed: string): string {
  switch (seed.toLowerCase()) {
    case "never_married": return "Never Married";
    case "married": return "Married";
    case "de_facto": return "De Facto";
    case "engaged": return "Engaged";
    case "separated": return "Separated";
    case "divorced": return "Divorced";
    case "widowed": return "Widowed";
    default: return "Never Married";
  }
}

async function fillTravellingCompanions(page: Page, _a: AnswerMap): Promise<void> {
  // Default: under-18 not applicable (No), no other companions (No).
  // Caller should override via the orchestrator's per-page fillUncheckedRadiosDefault.
  await clickYesNo(page, TRAVELLING_FIELDS.travellingWithParentOrGuardian, "No").catch(() => undefined);
  await clickYesNo(page, TRAVELLING_FIELDS.otherPersonsTravelling, "No").catch(() => undefined);
}

async function fillContactDetails(page: Page, a: AnswerMap): Promise<void> {
  if (a.country_of_residence) await selectByName(page, CONTACT_FIELDS.countryOfResidence, String(a.country_of_residence));
  // Department office: typeahead. Pick a "Country, City" string from
  // the answer map; default to "China, Beijing" for PRC nationals.
  const officeValue = (a.department_office_label as string) || "China, Beijing";
  await pickFromCombobox(page, "_2a0b0a0a0e0a0a5a3e0b0b", officeValue).catch(() => undefined);
  if (a.residential_address_country) await selectByName(page, CONTACT_FIELDS.addressCountry, String(a.residential_address_country));
  if (a.residential_address_line_1) await fillByName(page, CONTACT_FIELDS.addressLine1, String(a.residential_address_line_1));
  if (a.residential_address_line_2) await fillByName(page, CONTACT_FIELDS.addressLine2, String(a.residential_address_line_2));
  if (a.residential_address_suburb) await fillByName(page, CONTACT_FIELDS.suburb, String(a.residential_address_suburb));
  if (a.residential_address_postcode) await fillByName(page, CONTACT_FIELDS.postalCode, String(a.residential_address_postcode));
  // State: try the SELECT variant first (PRC + structured province
  // countries), else the free text variant.
  if (a.residential_address_state) {
    const isSelect = await page.locator(`select[name="${CONTACT_FIELDS.stateSelect}"]`).count();
    if (isSelect) await selectByName(page, CONTACT_FIELDS.stateSelect, String(a.residential_address_state));
    else await fillByName(page, CONTACT_FIELDS.stateText, String(a.residential_address_state));
  }
  if (a.phone_number_home) await fillByName(page, CONTACT_FIELDS.homePhone, String(a.phone_number_home));
  if (a.phone_number_business) await fillByName(page, CONTACT_FIELDS.businessPhone, String(a.phone_number_business));
  if (a.phone_number_mobile) await fillByName(page, CONTACT_FIELDS.mobilePhone, String(a.phone_number_mobile));
  if (a.email_address) await fillByName(page, CONTACT_FIELDS.email, String(a.email_address));
  await clickYesNo(page, CONTACT_FIELDS.postalSameAsResidential, "Yes").catch(() => undefined);
}

async function fillAuthorisedRecipient(page: Page, a: AnswerMap): Promise<void> {
  // Default: No authorised recipient (4-option radio's first value).
  const radios = page.locator(`input[name="${AUTHORISED_RECIPIENT_FIELDS.recipientType}"][type="radio"]`);
  const cnt = await radios.count();
  for (let i = 0; i < cnt; i++) {
    const r = radios.nth(i);
    const label = (await r.evaluate((el) => el.parentElement?.textContent || "")).trim();
    if (/^\s*No\s*$/.test(label)) {
      await r.click();
      break;
    }
  }
  if (a.email_address) {
    await fillByName(page, AUTHORISED_RECIPIENT_FIELDS.electronicEmail, String(a.email_address));
  }
}

async function fillEntryToAustralia(page: Page, a: AnswerMap): Promise<void> {
  await clickYesNo(page, ENTRY_FIELDS.visaValidSixYears, "No").catch(() => undefined);
  if (a.length_of_stay) await selectByName(page, ENTRY_FIELDS.lengthOfStay, String(a.length_of_stay));
  if (a.intended_arrival_date) await fillByName(page, ENTRY_FIELDS.plannedArrivalDate, String(a.intended_arrival_date));
  if (a.intended_departure_date) await fillByName(page, ENTRY_FIELDS.plannedDepartureDate, String(a.intended_departure_date));
}

async function fillCurrentOverseasEmployment(page: Page, a: AnswerMap): Promise<void> {
  if (a.employment_status) await selectByName(page, EMPLOYMENT_FIELDS.employmentStatus, String(a.employment_status));
  // Sub-block fillers — only the unemployed branch is wired in v1.
  if (String(a.employment_status) === "3" /* Unemployed */) {
    if (a.unemployment_date_from) await fillByName(page, EMPLOYMENT_FIELDS.unemployedDateFrom, String(a.unemployment_date_from));
    if (a.unemployment_last_position) await fillByName(page, EMPLOYMENT_FIELDS.unemployedLastPosition, String(a.unemployment_last_position));
  }
}

async function fillFinancialSupport(page: Page, a: AnswerMap): Promise<void> {
  const radios = page.locator(`input[name="${FINANCIAL_FIELDS.fundingSource}"][type="radio"]`);
  const target = String(a.funding_source || "Self funded");
  const cnt = await radios.count();
  for (let i = 0; i < cnt; i++) {
    const r = radios.nth(i);
    const label = (await r.evaluate((el) => el.parentElement?.textContent || "")).trim();
    if (label === target) {
      await r.click();
      break;
    }
  }
  if (a.funds_available_description) await fillByName(page, FINANCIAL_FIELDS.fundsAvailableDescription, String(a.funds_available_description));
}

async function fillVisaHistory(page: Page, a: AnswerMap): Promise<void> {
  await clickYesNo(page, VISA_HISTORY_FIELDS.heldOrHoldsVisaAnywhere, asYesNo(a.has_current_au_visa, "No"));
  await clickYesNo(page, VISA_HISTORY_FIELDS.notCompliedOrOverstayed, asYesNo(a.has_overstayed_visa, "No"));
  await clickYesNo(page, VISA_HISTORY_FIELDS.refusedOrCancelledAnywhere, asYesNo(a.has_been_refused_visa, "No"));
}

async function fillDeclarations(page: Page): Promise<void> {
  for (const name of Object.values(DECLARATION_FIELDS)) {
    await clickYesNo(page, name, "Yes").catch(() => undefined);
  }
}

function asYesNo(v: unknown, defaultValue: "Yes" | "No"): "Yes" | "No" {
  if (v === undefined || v === null || v === "") return defaultValue;
  if (v === "Yes" || v === "yes" || v === true || v === "1" || v === 1) return "Yes";
  return "No";
}

// Re-export for callers that want to feed in their own filler stubs.
export const __testHooks = {
  fillApplicationContext,
  fillPrimaryApplicant,
  fillContactDetails,
  fillAuthorisedRecipient,
  fillEntryToAustralia,
  fillCurrentOverseasEmployment,
  fillFinancialSupport,
  fillVisaHistory,
  fillDeclarations,
};

// Suppress unused-import warning (selectors are accessed via the exported hooks).
void HEALTH_FIELDS;
void CHARACTER_FIELDS;

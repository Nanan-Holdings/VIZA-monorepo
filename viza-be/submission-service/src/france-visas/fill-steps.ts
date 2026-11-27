/**
 * Per-step fill functions for France-Visas form steps 1-5.
 *
 * Each `fillStepN` takes the current Playwright `Page` + a typed answer
 * subset and drives the page to a valid submittable state. Step 6 is an
 * informational document checklist and has no fill — callers just advance
 * past it via its "Continue" button.
 *
 * Confirmed mechanics (live walk 2026-04-24):
 *   - Cascading selects MUST be filled in dependency order with
 *     `selectPrimeFacesOption()` (which calls selectValue + triggerChange
 *     and waits for the JSF postback).
 *   - Postbacks can clear downstream selects AND text fields, so text
 *     fields are always re-filled AT THE END, after every select in the
 *     step has settled.
 *   - Conditional subsections (e.g. employer in step 2, host in step 5)
 *     only appear after the gating select/checkbox fires — callers must
 *     fill the gate first, wait for the postback, then fill the revealed
 *     fields.
 */

import type { Page } from "@playwright/test";
import {
  selectPrimeFacesOption,
  selectPrimeFacesRadio,
  setJsfCheckbox,
  listVisibleTextFields,
  setJsfCheckboxGroup,
  setJsfTextInputs,
  waitForJsfIdle,
} from "./primefaces-ajax";

/** Optional answer: skip the field when the answer is empty. */
function optional(value: string | null | undefined): string | undefined {
  return value ? value : undefined;
}
import { resolveOptionFromPage } from "./option-match";
import type {
  FvStep1Answers,
  FvStep2Answers,
  FvStep3Answers,
  FvStep4Answers,
  FvStep5Answers,
} from "./field-mappings";

// ──────────────────────────────────────────────────────────────────────────────
// Step 1 — Your plans
// ──────────────────────────────────────────────────────────────────────────────

export async function fillStep1(page: Page, answers: FvStep1Answers): Promise<void> {
  const a = { ...answers };
  // Selects in cascade order. Each triggerChange waits for the server
  // postback before the next call so the dependent select has fresh options.
  await selectPrimeFacesOption(page, "widget_formStep1_visas_selected_nationality", a.nationality);
  await selectPrimeFacesRadio(page, "formStep1:hasNationalFamily", a.hasNationalFamily);
  await selectPrimeFacesOption(page, "widget_formStep1_Visas_selected_deposit_country", a.depositCountry);
  await selectPrimeFacesOption(page, "widget_formStep1_Visas_selected_stayDuration", a.stayDuration);
  await selectPrimeFacesOption(page, "widget_formStep1_Visas_selected_destination", a.destination);
  // France-Visas publishes no town-code list: when only the centre city is
  // known, pick it from the options the deposit-country cascade loaded.
  if (!a.depositTown) {
    a.depositTown = await resolveOptionFromPage(
      page,
      "depositTown",
      "formStep1:Visas-selected-deposit-town_input",
      a.depositTownCity ?? "",
    );
  }
  await selectPrimeFacesOption(page, "widget_formStep1_Visas_selected_deposit_town", a.depositTown);
  await selectPrimeFacesOption(page, "widget_formStep1_Visas_selected_authority", a.authority);
  await selectPrimeFacesOption(page, "widget_formStep1_Visas_dde_travel_document", a.travelDocument);
  await selectPrimeFacesOption(page, "widget_formStep1_Visas_selected_purposeCategory", a.purposeCategory);
  if (!a.purpose) {
    a.purpose = await resolveOptionFromPage(page, "purpose", "formStep1:Visas-selected-purpose_input", "");
  }
  await selectPrimeFacesOption(page, "widget_formStep1_Visas_selected_purpose", a.purpose);

  await waitForJsfIdle(page);

  // Defensive verify-and-refill pass. JSF cascading postbacks observed in
  // the live walk re-render upstream selects with EMPTY values after a
  // downstream choice (e.g. picking purposeCategory blanks the travel
  // document select). Re-set every select that's no longer at its target.
  // Only PrimeFaces selects need this — radios and text fields are not
  // touched by cascade postbacks.
  const targets: Array<{ widget: string; name: string; value: string }> = [
    { widget: "widget_formStep1_visas_selected_nationality", name: "formStep1:visas-selected-nationality_input", value: a.nationality },
    { widget: "widget_formStep1_Visas_selected_deposit_country", name: "formStep1:Visas-selected-deposit-country_input", value: a.depositCountry },
    { widget: "widget_formStep1_Visas_selected_stayDuration", name: "formStep1:Visas-selected-stayDuration_input", value: a.stayDuration },
    { widget: "widget_formStep1_Visas_selected_destination", name: "formStep1:Visas-selected-destination_input", value: a.destination },
    { widget: "widget_formStep1_Visas_selected_deposit_town", name: "formStep1:Visas-selected-deposit-town_input", value: a.depositTown },
    { widget: "widget_formStep1_Visas_selected_authority", name: "formStep1:Visas-selected-authority_input", value: a.authority },
    { widget: "widget_formStep1_Visas_dde_travel_document", name: "formStep1:Visas-dde-travel-document_input", value: a.travelDocument },
    { widget: "widget_formStep1_Visas_selected_purposeCategory", name: "formStep1:Visas-selected-purposeCategory_input", value: a.purposeCategory },
    { widget: "widget_formStep1_Visas_selected_purpose", name: "formStep1:Visas-selected-purpose_input", value: a.purpose },
  ];
  await reapplyClearedSelects(page, targets);

  // Text fields last — every select postback upstream clears these.
  await setJsfTextInputs(page, [
    ["formStep1:Visas-dde-travel-document-number", a.travelDocumentNumber],
    ["formStep1:Visas-dde-release_date_real_input", a.releaseDate],
    ["formStep1:Visas-dde-expiration_date_input", a.expirationDate],
  ]);
}

/**
 * Iterate over every select target in cascade order. For each, read the
 * current native <select>.value; if it diverges from the target, re-fire
 * `selectValue + triggerChange` and wait for the postback. Repeats up to
 * 3 times — each pass might dirty a downstream select, so we converge.
 */
async function reapplyClearedSelects(
  page: Page,
  targets: ReadonlyArray<{ widget: string; name: string; value: string }>,
): Promise<void> {
  const safeNames = JSON.stringify(targets.map((t) => t.name)).replace(/</g, "\\u003c");
  for (let pass = 0; pass < 3; pass += 1) {
    // Read every select in one round trip; re-fire only the ones that drifted.
    const currentValues = await page.evaluate(`(() => {
      return ${safeNames}.map((name) => {
        const escaped = name.replace(/"/g, '\\"');
        const sel = document.querySelector('select[name="' + escaped + '"]');
        return sel ? sel.value : null;
      });
    })()`) as Array<string | null>;
    let anyReapplied = false;
    for (const [index, t] of targets.entries()) {
      if (currentValues[index] === t.value) continue;
      await selectPrimeFacesOption(page, t.widget, t.value);
      anyReapplied = true;
    }
    if (!anyReapplied) return;
    await waitForJsfIdle(page);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Step 2 — Your information
// ──────────────────────────────────────────────────────────────────────────────

export async function fillStep2(page: Page, a: FvStep2Answers): Promise<void> {
  // Identity selects first.
  await selectPrimeFacesOption(page, "widget_formStep2_DDE002_102", a.sex);
  await selectPrimeFacesOption(page, "widget_formStep2_DDE002_104", a.maritalStatus);
  await selectPrimeFacesOption(page, "widget_formStep2_visas_selected_countryOfBirth", a.countryOfBirth);
  await selectPrimeFacesOption(page, "widget_formStep2_visas_selected_nationalityOfBirth", a.nationalityOfBirth);
  await selectPrimeFacesOption(page, "widget_formStep2_visas_selected_applicant_country", a.country);
  await selectPrimeFacesOption(page, "widget_formStep2_visas_input_applicant_activity_occupation", a.occupation);

  // Employer subsection only exists when occupation gates it on. If the
  // caller provided any employer-related field, run the employer fills.
  const hasEmployerData =
    a.occupationOtherSpecify || a.businessSegment || a.employerName || a.employerStreet ||
    a.employerPlace || a.employerCountry || a.employerPhone || a.employerEmail;

  if (hasEmployerData) {
    if (a.businessSegment) {
      await selectPrimeFacesOption(
        page,
        "widget_formStep2_visas_input_applicant_activity_businessSegment",
        a.businessSegment,
      );
    }
    if (a.employerCountry) {
      await selectPrimeFacesOption(
        page,
        "widget_formStep2_visas_selected_applicant_employer_country",
        a.employerCountry,
      );
    }
  }

  // Radios next. JSF radio values are by position — Yes=:0, No=:1.
  await selectPrimeFacesRadio(page, "formStep2:radioNotResident", a.radioNotResident);
  await selectPrimeFacesRadio(page, "formStep2:radioHasFrenchFamily", a.radioHasFrenchFamily);
  await selectPrimeFacesRadio(page, "formStep2:radioHasNationalFamily", a.radioHasNationalFamily);

  await waitForJsfIdle(page);

  // Text fields last — ordered by appearance on the page.
  await setJsfTextInputs(page, [
    ["formStep2:visas-input-applicant-surname", a.surname],
    ["formStep2:visas-input-applicant-surnameAtBirth", optional(a.surnameAtBirth)],
    ["formStep2:visas-input-applicant-firstnames", a.firstnames],
    ["formStep2:visas-input-applicant-dayOfBirth", a.dayOfBirth],
    ["formStep2:visas-input-applicant-monthOfBirth", a.monthOfBirth],
    ["formStep2:visas-input-applicant-yearOfBirth", a.yearOfBirth],
    ["formStep2:visas-input-applicant-placeOfBirth", a.placeOfBirth],
    ["formStep2:visas-input-idcardNumber", optional(a.idCardNumber)],
    ["formStep2:visas-input-applicant-street", a.street],
    ["formStep2:visas-input-applicant-zipcode", optional(a.zipcode)],
    ["formStep2:visas-input-applicant-place", a.place],
    ["formStep2:visas-input-applicant-phoneNumber", a.phoneNumber],
    ["formStep2:visas-input-applicant-email", a.email],
  ]);

  if (hasEmployerData) {
    await setJsfTextInputs(page, [
      ["formStep2:visas-input-applicant-activity-otherOccupation", optional(a.occupationOtherSpecify)],
      ["formStep2:visas-input-applicant-employer-name", optional(a.employerName)],
      ["formStep2:visas-input-applicant-employer-street", optional(a.employerStreet)],
      ["formStep2:visas-input-applicant-employer-place", optional(a.employerPlace)],
      ["formStep2:visas-input-phoneNumber-employer", optional(a.employerPhone)],
      ["formStep2:visas-input-email-employer", optional(a.employerEmail)],
    ]);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Step 3 — Your last visa
// ──────────────────────────────────────────────────────────────────────────────

export async function fillStep3(page: Page, a: FvStep3Answers): Promise<void> {
  await selectPrimeFacesRadio(page, "formStep3:haveOldSchengenVisas", a.haveOldSchengenVisas);
  await waitForJsfIdle(page);

  if (a.haveOldSchengenVisas !== "Yes") return;

  await setJsfTextInputs(page, [
    ["formStep3:valid-visa-start_input", optional(a.validVisaStart)],
    ["formStep3:valid-visa-end_input", optional(a.validVisaEnd)],
  ]);

  if (a.hasFingerPrints) {
    await selectPrimeFacesRadio(page, "formStep3:hasFingerPrints", a.hasFingerPrints);
    await waitForJsfIdle(page);

    if (a.hasFingerPrints === "Yes") {
      await setJsfTextInputs(page, [
        ["formStep3:date-fingerprints_real_input", optional(a.dateFingerprints)],
        ["formStep3:num-visa-biometrique", optional(a.numVisaBiometrique)],
      ]);
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Step 4 — Your stay
// ──────────────────────────────────────────────────────────────────────────────

export async function fillStep4(page: Page, a: FvStep4Answers): Promise<void> {
  await selectPrimeFacesRadio(page, "formStep4:radioHasSeveralDestination", a.radioHasSeveralDestination);
  await selectPrimeFacesOption(page, "widget_formStep4_visas_selected_applicant_country", a.numberOfEntries);
  await selectPrimeFacesOption(page, "widget_formStep4_visas_selected_purposeCategory", a.purposeCategory);

  await waitForJsfIdle(page);

  await setJsfTextInputs(page, [
    ["formStep4:date-of-arrival_input", a.dateOfArrival],
    ["formStep4:date-of-departure_input", a.dateOfDeparture],
    ["formStep4:visas-dde-number-days-travel", a.numberOfDays],
    ["formStep4:visas-input-applicant-numberOfStays_input", a.numberOfStays],
  ]);
}

// ──────────────────────────────────────────────────────────────────────────────
// Step 5 — Your contacts
// ──────────────────────────────────────────────────────────────────────────────

export async function fillStep5(page: Page, a: FvStep5Answers): Promise<void> {
  // Toggle checkboxes first — they gate the conditional subsections.
  await setJsfCheckbox(page, "formStep5:cbxHasHostPerson_input", a.cbxHasHostPerson);
  await setJsfCheckbox(page, "formStep5:cbxHasHostOrganization_input", a.cbxHasHostOrganization);
  await setJsfCheckbox(page, "formStep5:cbxHasPlaceOfApplication_input", a.cbxHasPlaceOfApplication);
  await setJsfCheckbox(page, "formStep5:cbxHasAutoFunding_input", a.cbxHasAutoFunding);
  await setJsfCheckbox(page, "formStep5:cbxHasGuarantor_input", a.cbxHasGuarantor);

  await waitForJsfIdle(page);

  // Host person subsection
  if (a.cbxHasHostPerson) {
    if (a.hostPersonCountry) {
      await selectPrimeFacesOption(page, "widget_formStep5_visas_selected_hostPerson_country", a.hostPersonCountry);
    }
    await waitForJsfIdle(page);
    const host = "formStep5:visas-input-applicant-hostPerson";
    await setJsfTextInputs(page, [
      [`${host}-surname`, optional(a.hostPersonSurname)],
      [`${host}-firstnames`, optional(a.hostPersonFirstnames)],
      [`${host}-address`, optional(a.hostPersonAddress)],
      [`${host}-zipcode`, optional(a.hostPersonZipcode)],
      [`${host}-place`, optional(a.hostPersonPlace)],
      [`${host}-phoneNumber`, optional(a.hostPersonPhone)],
      [`${host}-email`, optional(a.hostPersonEmail)],
    ]);
  }

  // Host organisation subsection (hotel / rental) and its contact person.
  // Field names captured from the live step 5 (2026-11-21).
  if (a.cbxHasHostOrganization) {
    if (a.hostOrgCountry) {
      await selectPrimeFacesOption(page, "widget_formStep5_visas_selected_hostOrganization_country", a.hostOrgCountry);
    }
    if (a.hostOrgContactCountry) {
      await selectPrimeFacesOption(
        page,
        "widget_formStep5_visas_selected_hostOrganization_addressContact_country",
        a.hostOrgContactCountry,
      );
    }
    await waitForJsfIdle(page);
    const org = "formStep5:visas-input-application-hostOrganization";
    await setJsfTextInputs(page, [
      [`${org}-orgname`, optional(a.hostOrgName)],
      [`${org}-address-street`, optional(a.hostOrgStreet)],
      [`${org}-address-zipcode`, optional(a.hostOrgZipcode)],
      [`${org}-address-place`, optional(a.hostOrgPlace)],
      [`${org}-address-phoneNumber`, optional(a.hostOrgPhone)],
      [`${org}-address-email`, optional(a.hostOrgEmail)],
      [`${org}-contactSurname`, optional(a.hostOrgContactSurname)],
      [`${org}-contactFirstNames`, optional(a.hostOrgContactFirstnames)],
      [`${org}-addressContact-address`, optional(a.hostOrgContactAddress)],
      [`${org}-addressContact-zipcode`, optional(a.hostOrgContactZipcode)],
      [`${org}-addressContact-place`, optional(a.hostOrgContactPlace)],
      [`${org}-addressContact-phoneNumber`, optional(a.hostOrgContactPhone)],
      [`${org}-addressContact-email`, optional(a.hostOrgContactEmail)],
    ]);
  }

  // Auto-funding methods (multi-select checkbox group)
  if (a.cbxHasAutoFunding && a.autoFundings && a.autoFundings.length > 0) {
    const shownBefore = new Set(await listVisibleTextFields(page, "formStep5"));
    await setJsfCheckboxGroup(page, "formStep5:autoFundings", a.autoFundings);
    const otherDetail = a.autoFundingOther;
    if (a.autoFundings.includes("AUT") && otherDetail) {
      // "Other" reveals a required box saying what the means are. Its name was
      // never captured live, so fill whichever box the tick revealed.
      await waitForJsfIdle(page);
      let revealed: string[] = [];
      for (let waited = 0; revealed.length === 0 && waited <= 5_000; waited += 250) {
        if (waited > 0) await page.waitForTimeout(250);
        revealed = (await listVisibleTextFields(page, "formStep5"))
          .filter((name) => !shownBefore.has(name));
      }
      console.log(`[france-visas] step5 "Other" funding revealed ${JSON.stringify(revealed)}`);
      await setJsfTextInputs(page, revealed.map((name) => [name, otherDetail] as const));
    }
  }

  // Optional representative
  if (a.representativeCountry) {
    await selectPrimeFacesOption(page, "widget_formStep5_visas_input_application_representative_country", a.representativeCountry);
  }
  await waitForJsfIdle(page);
  const rep = "formStep5:visas-input-application-representative";
  await setJsfTextInputs(page, [
    [`${rep}-surname`, optional(a.representativeSurname)],
    [`${rep}-firstnames`, optional(a.representativeFirstnames)],
    [`${rep}-street`, optional(a.representativeStreet)],
    [`${rep}-zipcode`, optional(a.representativeZipcode)],
    [`${rep}-place`, optional(a.representativePlace)],
    [`${rep}-phoneNumber`, optional(a.representativePhone)],
    [`${rep}-email`, optional(a.representativeEmail)],
  ]);
}

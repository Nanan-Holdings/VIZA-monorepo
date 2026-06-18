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
  setJsfCheckboxGroup,
  setJsfTextInput,
  waitForJsfIdle,
} from "./primefaces-ajax";
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

export async function fillStep1(page: Page, a: FvStep1Answers): Promise<void> {
  // Selects in cascade order. Each triggerChange waits for the server
  // postback before the next call so the dependent select has fresh options.
  await selectPrimeFacesOption(page, "widget_formStep1_visas_selected_nationality", a.nationality);
  await selectPrimeFacesRadio(page, "formStep1:hasNationalFamily", a.hasNationalFamily);
  await selectPrimeFacesOption(page, "widget_formStep1_Visas_selected_deposit_country", a.depositCountry);
  await selectPrimeFacesOption(page, "widget_formStep1_Visas_selected_stayDuration", a.stayDuration);
  await selectPrimeFacesOption(page, "widget_formStep1_Visas_selected_destination", a.destination);
  await selectPrimeFacesOption(page, "widget_formStep1_Visas_selected_deposit_town", a.depositTown);
  await selectPrimeFacesOption(page, "widget_formStep1_Visas_selected_authority", a.authority);
  await selectPrimeFacesOption(page, "widget_formStep1_Visas_dde_travel_document", a.travelDocument);
  await selectPrimeFacesOption(page, "widget_formStep1_Visas_selected_purposeCategory", a.purposeCategory);
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
  await setJsfTextInput(page, "formStep1:Visas-dde-travel-document-number", a.travelDocumentNumber);
  await setJsfTextInput(page, "formStep1:Visas-dde-release_date_real_input", a.releaseDate);
  await setJsfTextInput(page, "formStep1:Visas-dde-expiration_date_input", a.expirationDate);
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
  for (let pass = 0; pass < 3; pass += 1) {
    let anyReapplied = false;
    for (const t of targets) {
      const safeName = JSON.stringify(t.name).replace(/</g, "\\u003c");
      const current = await page.evaluate(`(() => {
        const name = ${safeName};
        const escaped = name.replace(/"/g, '\\"');
        const sel = document.querySelector('select[name="' + escaped + '"]');
        return sel ? sel.value : null;
      })()`);
      if (current === t.value) continue;
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
  await setJsfTextInput(page, "formStep2:visas-input-applicant-surname", a.surname);
  if (a.surnameAtBirth) {
    await setJsfTextInput(page, "formStep2:visas-input-applicant-surnameAtBirth", a.surnameAtBirth);
  }
  await setJsfTextInput(page, "formStep2:visas-input-applicant-firstnames", a.firstnames);
  await setJsfTextInput(page, "formStep2:visas-input-applicant-dayOfBirth", a.dayOfBirth);
  await setJsfTextInput(page, "formStep2:visas-input-applicant-monthOfBirth", a.monthOfBirth);
  await setJsfTextInput(page, "formStep2:visas-input-applicant-yearOfBirth", a.yearOfBirth);
  await setJsfTextInput(page, "formStep2:visas-input-applicant-placeOfBirth", a.placeOfBirth);
  if (a.idCardNumber) {
    await setJsfTextInput(page, "formStep2:visas-input-idcardNumber", a.idCardNumber);
  }
  await setJsfTextInput(page, "formStep2:visas-input-applicant-street", a.street);
  if (a.zipcode) {
    await setJsfTextInput(page, "formStep2:visas-input-applicant-zipcode", a.zipcode);
  }
  await setJsfTextInput(page, "formStep2:visas-input-applicant-place", a.place);
  await setJsfTextInput(page, "formStep2:visas-input-applicant-phoneNumber", a.phoneNumber);
  await setJsfTextInput(page, "formStep2:visas-input-applicant-email", a.email);

  if (hasEmployerData) {
    if (a.occupationOtherSpecify) {
      await setJsfTextInput(
        page,
        "formStep2:visas-input-applicant-activity-otherOccupation",
        a.occupationOtherSpecify,
      );
    }
    if (a.employerName) await setJsfTextInput(page, "formStep2:visas-input-applicant-employer-name", a.employerName);
    if (a.employerStreet) await setJsfTextInput(page, "formStep2:visas-input-applicant-employer-street", a.employerStreet);
    if (a.employerPlace) await setJsfTextInput(page, "formStep2:visas-input-applicant-employer-place", a.employerPlace);
    if (a.employerPhone) await setJsfTextInput(page, "formStep2:visas-input-phoneNumber-employer", a.employerPhone);
    if (a.employerEmail) await setJsfTextInput(page, "formStep2:visas-input-email-employer", a.employerEmail);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Step 3 — Your last visa
// ──────────────────────────────────────────────────────────────────────────────

export async function fillStep3(page: Page, a: FvStep3Answers): Promise<void> {
  await selectPrimeFacesRadio(page, "formStep3:haveOldSchengenVisas", a.haveOldSchengenVisas);
  await waitForJsfIdle(page);

  if (a.haveOldSchengenVisas !== "Yes") return;

  if (a.validVisaStart) {
    await setJsfTextInput(page, "formStep3:valid-visa-start_input", a.validVisaStart);
  }
  if (a.validVisaEnd) {
    await setJsfTextInput(page, "formStep3:valid-visa-end_input", a.validVisaEnd);
  }

  if (a.hasFingerPrints) {
    await selectPrimeFacesRadio(page, "formStep3:hasFingerPrints", a.hasFingerPrints);
    await waitForJsfIdle(page);

    if (a.hasFingerPrints === "Yes") {
      if (a.dateFingerprints) {
        await setJsfTextInput(page, "formStep3:date-fingerprints_real_input", a.dateFingerprints);
      }
      if (a.numVisaBiometrique) {
        await setJsfTextInput(page, "formStep3:num-visa-biometrique", a.numVisaBiometrique);
      }
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

  await setJsfTextInput(page, "formStep4:date-of-arrival_input", a.dateOfArrival);
  await setJsfTextInput(page, "formStep4:date-of-departure_input", a.dateOfDeparture);
  await setJsfTextInput(page, "formStep4:visas-dde-number-days-travel", a.numberOfDays);
  await setJsfTextInput(page, "formStep4:visas-input-applicant-numberOfStays_input", a.numberOfStays);
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
    if (a.hostPersonSurname) await setJsfTextInput(page, "formStep5:visas-input-applicant-hostPerson-surname", a.hostPersonSurname);
    if (a.hostPersonFirstnames) await setJsfTextInput(page, "formStep5:visas-input-applicant-hostPerson-firstnames", a.hostPersonFirstnames);
    if (a.hostPersonAddress) await setJsfTextInput(page, "formStep5:visas-input-applicant-hostPerson-address", a.hostPersonAddress);
    if (a.hostPersonZipcode) await setJsfTextInput(page, "formStep5:visas-input-applicant-hostPerson-zipcode", a.hostPersonZipcode);
    if (a.hostPersonPlace) await setJsfTextInput(page, "formStep5:visas-input-applicant-hostPerson-place", a.hostPersonPlace);
    if (a.hostPersonPhone) await setJsfTextInput(page, "formStep5:visas-input-applicant-hostPerson-phoneNumber", a.hostPersonPhone);
    if (a.hostPersonEmail) await setJsfTextInput(page, "formStep5:visas-input-applicant-hostPerson-email", a.hostPersonEmail);
  }

  // Auto-funding methods (multi-select checkbox group)
  if (a.cbxHasAutoFunding && a.autoFundings && a.autoFundings.length > 0) {
    await setJsfCheckboxGroup(page, "formStep5:autoFundings", a.autoFundings);
  }

  // Optional representative
  if (a.representativeCountry) {
    await selectPrimeFacesOption(page, "widget_formStep5_visas_input_application_representative_country", a.representativeCountry);
  }
  await waitForJsfIdle(page);
  if (a.representativeSurname) await setJsfTextInput(page, "formStep5:visas-input-application-representative-surname", a.representativeSurname);
  if (a.representativeFirstnames) await setJsfTextInput(page, "formStep5:visas-input-application-representative-firstnames", a.representativeFirstnames);
  if (a.representativeStreet) await setJsfTextInput(page, "formStep5:visas-input-application-representative-street", a.representativeStreet);
  if (a.representativeZipcode) await setJsfTextInput(page, "formStep5:visas-input-application-representative-zipcode", a.representativeZipcode);
  if (a.representativePlace) await setJsfTextInput(page, "formStep5:visas-input-application-representative-place", a.representativePlace);
  if (a.representativePhone) await setJsfTextInput(page, "formStep5:visas-input-application-representative-phoneNumber", a.representativePhone);
  if (a.representativeEmail) await setJsfTextInput(page, "formStep5:visas-input-application-representative-email", a.representativeEmail);
}

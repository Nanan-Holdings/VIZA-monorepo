/**
 * UK Standard Visitor — per-page bindings.
 *
 * Maps the 44 application pages of apply-uk-visa.service.gov.uk to their
 * field handlers, using our seed `field_name` (from
 * `viza-be/agent-backend/scripts/seed-uk-standard-visitor-form-fields.ts`)
 * as the lookup key into the answers map loaded from
 * `visa_application_answers`.
 *
 * Coverage is complete (44/44 pages walked live 2026-04-26 — see
 * `uk-walk-out/batch-pages.json`). Selectors, names, options, and
 * radio/checkbox/select shapes are taken from the actual DOM.
 *
 * Pages without explicit bindings rely on the user's prior partial fill
 * (the runner just saves-and-continues without touching anything).
 */

import type { Page } from "@playwright/test";
import {
  ukFillAddressBlock,
  ukFillDateSplit,
  ukFillMonthYearSplit,
  ukFillPhoneSplit,
  ukFillText,
  ukFillTextarea,
  ukPickCheckboxes,
  ukPickRadio,
  ukPickBooleanRadio,
  ukPickCorrespondenceAddressSame,
  ukSelectCountry,
  ukSelectOption,
} from "./fillers";

export type UkPageFiller = (page: Page, answers: Record<string, string>) => Promise<void>;

const yn = (v: string | undefined): "Yes" | "No" => (v === "yes" ? "Yes" : "No");

/**
 * Shared filler for gov.uk's "parentDetails" template — used by both
 * parentOneDetails (Mother) and parentTwoDetails (Father). Confirmed live
 * via view-source that both pages share identical field ids/names:
 * parent_givenName, parent_familyName, parent_dateOfBirth_{day,month,year},
 * parent_nationalityRef, parent.relationshipRef (values "mother"/"father"),
 * parent.hadAlwaysSameNationality (values "true"/"false"),
 * parent_nationalityAtApplicantsBirthRef, and an optional parentIsUnknown
 * checkbox when that parent's details aren't available.
 *
 * Real wizard field names (seed-uk-standard-visitor-form-fields.ts, step 4
 * "Your Family"): mother_given_names/mother_surname/mother_date_of_birth/
 * mother_nationality and the father_* equivalents — both required, no
 * has_parent_details/first_parent_relationship_label field exists upstream
 * (those were guessed names from an earlier version of this filler that
 * never matched real data).
 */
async function fillUkParentDetails(
  page: Page,
  a: Record<string, string>,
  parent: "mother" | "father",
): Promise<void> {
  const givenNames = a[`${parent}_given_names`];
  const surname = a[`${parent}_surname`];
  if (!givenNames && !surname) {
    await ukPickCheckboxes(page, "parentIsUnknown", [
      "I do not have my parents' details",
      "I only have the details of one parent",
    ]);
    return;
  }
  await ukPickRadio(page, "parent.relationshipRef", parent === "mother" ? "Mother" : "Father");
  if (givenNames) await ukFillText(page, "parent_givenName", givenNames);
  if (surname) await ukFillText(page, "parent_familyName", surname);
  const dob = a[`${parent}_date_of_birth`];
  if (dob) await ukFillDateSplit(page, "parent_dateOfBirth", dob);
  const nat = a[`${parent}_nationality_label`] ?? a[`${parent}_nationality`];
  if (nat) await ukSelectCountry(page, "parent_nationalityRef", nat);
  await ukPickRadio(page, "parent.hadAlwaysSameNationality", "Yes");
}

export const UK_PAGE_FILLERS: Record<string, UkPageFiller> = {
  // ── Personal information ────────────────────────────────────────────
  standardApplicantsEmail: async (page, a) => {
    await ukPickRadio(page, "emailOwner", a["email_owner_label"] ?? "You");
    if (a["email_address"]) await ukFillText(page, "emailAddress", a["email_address"]);
  },

  hasAdditionalEmailEV: async (page, a) => {
    const has = a["has_alternative_email"] === "yes" ? "Yes" : "No";
    await ukPickRadio(page, "value", has);
    if (has === "Yes" && a["alternative_email_address"]) {
      await ukFillText(page, "additionalEmail", a["alternative_email_address"]);
    }
  },

  "standardTelephoneDetailsList.0": async (page, a) => {
    if (a["phone_number"]) await ukFillText(page, "telephoneNumber", a["phone_number"]);
    const purposes = a["phone_purpose_labels"]
      ? a["phone_purpose_labels"].split("|")
      : ["For use whilst out of the UK"];
    await ukPickCheckboxes(page, "telephoneNumberPurpose", purposes);
    const types = a["phone_type_labels"]
      ? a["phone_type_labels"].split("|")
      : ["Mobile telephone number"];
    await ukPickCheckboxes(page, "telephoneNumberType", types);
  },

  // Follow-up gate after standardTelephoneDetailsList.0: "Do you have any
  // other telephone numbers?" — same repeatable-list "add another" pattern
  // as identityNameForLeaveToEnterList/otherAccommodationDetailsList.
  // Confirmed live: radio `name="addAnother"` values true/false, labels
  // Yes/No. The wizard only ever collects one phone number, so default No.
  standardTelephoneDetailsList: async (page) => {
    await ukPickBooleanRadio(page, "addAnother", false);
  },

  // RADIO group `contactByTelephone` w/ 4 options (not checkbox group).
  standardContactingYouByTelephone: async (page, a) => {
    const label =
      a["contact_by_phone_label"] ??
      "I can be contacted by telephone call and text message (SMS)";
    await ukPickRadio(page, "contactByTelephone", label);
    if (a["contact_call_only_reason"]) await ukFillTextarea(page, "callOnlyDontContactReason", a["contact_call_only_reason"]);
    if (a["contact_text_only_reason"]) await ukFillTextarea(page, "textOnlyDontContactReason", a["contact_text_only_reason"]);
    if (a["contact_no_contact_reason"]) await ukFillTextarea(page, "noContactDontContactReason", a["contact_no_contact_reason"]);
  },

  "identityNameForLeaveToEnterList.0": async (page, a) => {
    if (a["given_names"]) await ukFillText(page, "givenName", a["given_names"]);
    if (a["surname"]) await ukFillText(page, "familyName", a["surname"]);
    if (a["single_name"]) await ukFillText(page, "singleName", a["single_name"]);
  },

  // Follow-up gate after entering the primary name: "In addition to the
  // names already provided, are you now or have you ever been known by
  // another name?" — a gov.uk repeatable-list "add another" radio
  // (name="addAnother", value="true"/"false"). Missing this filler left the
  // whole 44-page walk stuck here: our index-based walker doesn't recognize
  // this bare slug, gov.uk bounces every later `goto` back to this
  // unanswered required page, and the run silently "skips" everything after
  // it while gov.uk's own state stays parked here.
  identityNameForLeaveToEnterList: async (page, a) => {
    // Real wizard key is `other_names_used` (seed step 1) — `any_other_names`
    // was never a real field name, so this always defaulted to "No"
    // regardless of the actual answer. Note: if the applicant answers "yes"
    // here, gov.uk shows a follow-up detail page for the previous name that
    // we don't have a filler for yet (seed collects previous_given_names/
    // previous_surname/previous_name_change_date/_reason but nothing wires
    // them to a page slug) — flagged for follow-up if this branch is hit live.
    const hasOtherNames = a["other_names_used"] === "yes";
    await ukPickBooleanRadio(page, "addAnother", hasOtherNames);
  },

  // gender = radio (`gender_<value>`); relationshipStatus = SELECT.
  standardGenderRelationshipOOC: async (page, a) => {
    if (a["sex"]) {
      const sexLabel = a["sex"] === "male" ? "Male" : a["sex"] === "female" ? "Female" : "Unspecified";
      await ukPickRadio(page, "gender", sexLabel);
    }
    if (a["marital_status"]) {
      const map: Record<string, string> = {
        single: "Single",
        married: "Married or a civil partner",
        civil_partnership: "Married or a civil partner",
        unmarried_partner: "Unmarried partner",
        divorced: "Divorced or civil partnership dissolved",
        widowed: "Widowed or a surviving civil partner",
        separated: "Separated",
      };
      await ukSelectOption(page, "relationshipStatus", map[a["marital_status"]] ?? a["marital_status"]);
    }
  },

  standardAddressOoC: async (page, a) => {
    await ukFillAddressBlock(page, "outOfCountryAddress", {
      line1: a["home_address_line_1"],
      line2: a["home_address_line_2"],
      townCity: a["home_address_city"],
      province: a["home_address_state"],
      postCode: a["home_address_postcode"],
      countryRefLabel: a["home_address_country_label"] ?? a["home_address_country"],
    });

    const corrLine1 = a["correspondence_address_line_1"];
    const corrCity = a["correspondence_address_city"];
    const corrCountry =
      a["correspondence_address_country_label"] ?? a["correspondence_address_country"];
    const wantsDifferent =
      a["correspondence_address_different"] === "yes" &&
      Boolean(corrLine1 && corrCity && corrCountry);

    if (wantsDifferent) {
      await ukPickCorrespondenceAddressSame(page, false);
      await ukFillAddressBlock(page, "otherOutOfCountryAddress", {
        line1: corrLine1,
        line2: a["correspondence_address_line_2"],
        townCity: corrCity,
        province: a["correspondence_address_state"],
        postCode: a["correspondence_address_postcode"],
        countryRefLabel: corrCountry,
      });
    } else {
      // gov.uk: when correspondence is same as home, leave the second block empty.
      await ukPickCorrespondenceAddressSame(page, true);
    }
  },

  // yearsLived + monthsLived (number splits), ownershipCategory radio.
  standardAboutYourHomeOoC: async (page, a) => {
    await ukFillText(page, "yearsLived", a["years_at_address"] || "0");
    await ukFillText(page, "monthsLived", a["months_at_address"] || "0");
    const ownership =
      a["home_ownership_label"] ??
      (a["owns_home"] === "yes" ? "I own it" : "I rent it");
    await ukPickRadio(page, "ownershipCategory", ownership);
    if (a["other_living_situation_details"]) {
      await ukFillTextarea(page, "otherCategoryDetails", a["other_living_situation_details"]);
    }
  },

  travelDocumentIssueDetails: async (page, a) => {
    if (a["passport_number"]) await ukFillText(page, "travelDocumentNumber", a["passport_number"]);
    const authority =
      a["passport_issuing_authority"] ?? a["passport_place_of_issue"] ?? a["passport_issuing_country"];
    if (authority) await ukFillText(page, "issuingCountry", authority);
    if (a["passport_issue_date"]) await ukFillDateSplit(page, "dateOfIssue", a["passport_issue_date"]);
    if (a["passport_expiry_date"]) await ukFillDateSplit(page, "expiryDate", a["passport_expiry_date"]);
  },

  // hasValidIdCard radio; nationalIdCardNo + issuingAuthority text;
  // issueDate + expiryDate split. NO countryRef.
  standardIdentityCard: async (page, a) => {
    const has = yn(a["has_national_id_card"]);
    await ukPickRadio(page, "hasValidIdCard", has);
    if (has === "Yes") {
      if (a["national_id_number"]) await ukFillText(page, "nationalIdCardNo", a["national_id_number"]);
      if (a["national_id_issuing_authority"]) await ukFillText(page, "issuingAuthority", a["national_id_issuing_authority"]);
      if (a["national_id_issue_date"]) await ukFillDateSplit(page, "issueDate", a["national_id_issue_date"]);
      if (a["national_id_expiry_date"]) await ukFillDateSplit(page, "expiryDate", a["national_id_expiry_date"]);
    }
  },

  standardNationalityDOBOoC: async (page, a) => {
    if (a["country_of_nationality_label"] ?? a["country_of_nationality"]) {
      await ukSelectCountry(page, "nationality", a["country_of_nationality_label"] ?? a["country_of_nationality"]);
    }
    if (a["country_of_birth_label"] ?? a["country_of_birth"]) {
      await ukSelectCountry(page, "countryOfBirth", a["country_of_birth_label"] ?? a["country_of_birth"]);
    }
    if (a["place_of_birth"]) await ukFillText(page, "placeOfBirth", a["place_of_birth"]);
    if (a["date_of_birth"]) await ukFillDateSplit(page, "dob", a["date_of_birth"]);
  },

  standardOtherNationality: async (page, a) => {
    await ukPickRadio(page, "hasOtherNationality", yn(a["has_other_nationalities"]));
  },

  // China-only branch (confirmed live, form action=/save/application.0.adsAgreement):
  // "Are you the employee of a licensed ADS tour operator submitting this
  // application on behalf of an ADS group?" Not in the original 44-page
  // seed walk because that walk wasn't done with a Chinese-nationality
  // profile. Virtually no individual applicant is an ADS tour operator
  // employee, so default "No" unless the wizard says otherwise.
  adsAgreement: async (page, a) => {
    const isAdsOperator = a["ads_tour_operator_employee"] === "yes";
    await ukPickBooleanRadio(page, "yesNo", isAdsOperator);
  },

  // immigrationStatusTypeRef radio (3-option), date splits expirationDate
  // + permanentResidentDate (year only), additionalInformation textarea.
  immigrationStatus: async (page, a) => {
    const map: Record<string, string> = {
      temporary_visa: "I have a temporary visa",
      permanent_resident: "I am a permanent resident",
      none: "I do not have a visa and I am not a permanent resident",
    };
    const statusLabel =
      a["current_immigration_status_label"] ??
      map[a["current_immigration_status"] ?? "none"] ??
      "I do not have a visa and I am not a permanent resident";
    await ukPickRadio(page, "immigrationStatusTypeRef", statusLabel);
    if (a["immigration_status_expiration_date"]) {
      await ukFillDateSplit(page, "expirationDate", a["immigration_status_expiration_date"]);
    }
    if (a["permanent_resident_year"]) {
      await ukFillText(page, "permanentResidentDate_year", a["permanent_resident_year"]);
    }
    if (a["current_immigration_status_details"]) {
      await ukFillTextarea(page, "additionalInformation", a["current_immigration_status_details"]);
    }
  },

  // CHECKBOX group `status[i]`, NOT radio.
  employmentStatus: async (page, a) => {
    const labels = a["employment_status_labels"]
      ? a["employment_status_labels"].split("|")
      : a["employment_status"]
        ? [
            { employed: "Employed", self_employed: "Self-employed", student: "A student", retired: "Retired", unemployed: "Unemployed" }[a["employment_status"] as string] ?? "Employed",
          ]
        : ["Employed"];
    await ukPickCheckboxes(page, "status", labels);
  },

  fundingEmploymentEmployerDetails: async (page, a) => {
    if (a["employment_status"] === "student") {
      if (a["student_institution_name"]) await ukFillText(page, "employer", a["student_institution_name"]);
      const addr = a["student_institution_address"];
      if (addr) {
        await ukFillText(page, "address_line1", addr);
        await ukFillText(page, "address_townCity", addr);
      }
      return;
    }
    if (a["employer_name"]) await ukFillText(page, "employer", a["employer_name"]);
    await ukFillAddressBlock(page, "address", {
      line1: a["employer_address_line_1"],
      line2: a["employer_address_line_2"],
      townCity: a["employer_address_city"],
      province: a["employer_address_state"],
      postCode: a["employer_address_postcode"],
      countryRefLabel: a["employer_address_country_label"] ?? a["employer_address_country"],
    });
    // Real seed key is `employer_phone_code` (not employer_phone_country_code).
    if (a["employer_phone_code"] || a["employer_phone_number"]) {
      await ukFillPhoneSplit(page, a["employer_phone_code"] ?? "", a["employer_phone_number"] ?? "");
    }
    // Real seed key is `job_start_date` (ISO `YYYY-MM-DD` after normalize's
    // pass-through date conversion) — `employer_start_date` never existed,
    // so this never filled anything. ukFillMonthYearSplit only reads the
    // leading `YYYY-MM`, so the day portion is harmlessly ignored.
    if (a["job_start_date"]) {
      await ukFillMonthYearSplit(page, "jobStartDate", a["job_start_date"]);
    }
  },

  // earnings.currencyRef select + earnings.amount, jobDescription textarea.
  fundingEmploymentJobDetails: async (page, a) => {
    if (a["employment_status"] === "student") {
      if (a["student_course_name"]) await ukFillText(page, "jobTitle", a["student_course_name"]);
      if (a["student_course_name"]) {
        await ukFillTextarea(page, "jobDescription", `Studying ${a["student_course_name"]} at ${a["student_institution_name"] ?? "my institution"}.`);
      }
      return;
    }
    if (a["job_title"]) await ukFillText(page, "jobTitle", a["job_title"]);
    // Real seed keys are `monthly_earnings_currency`/`monthly_earnings_amount`
    // (recon-patch fields) — job_earnings_currency/job_earnings_amount never
    // existed upstream, so these always fell back to the "GBP"/blank default.
    await ukSelectOption(page, "earnings_currencyRef", a["job_earnings_currency"] ?? a["monthly_earnings_currency"] ?? "GBP");
    const earnings = a["job_earnings_amount"] ?? a["monthly_earnings_amount"];
    if (earnings) await ukFillText(page, "earnings_amount", earnings);
    if (a["job_description"]) await ukFillTextarea(page, "jobDescription", a["job_description"]);
  },

  // Multi-checkbox typeOfIncomeRefs[i] + sourceRefs[i] + currency/amount
  // pairs. hasNoOtherIncome single checkbox shortcut.
  //
  // The wizard only ever collects a plain yes/no (`has_other_income` /
  // `has_other_income_or_savings`) + a free-text explanation
  // (`other_income_details`) — it does not collect the structured
  // type/source/amount breakdown gov.uk asks for here. The old code checked
  // `other_income_types`/`other_income_none`, neither of which is a real
  // field, so it always silently answered "I do not have any other income
  // or savings" even for applicants who said "yes". We can't fabricate the
  // structured detail, but we should at least not lie: only auto-check "no
  // other income" when the real answer is actually no/absent. On "yes" we
  // leave the page unanswered so it surfaces as a visible save failure
  // instead of a false "no income" submission.
  fundingOtherIncome: async (page, a) => {
    const hasOther = a["has_other_income"] === "yes" || a["has_other_income_or_savings"] === "yes";
    if (!hasOther) {
      await ukPickCheckboxes(page, "hasNoOtherIncome", ["I do not have any other income or savings"]);
      return;
    }
    // TODO: gov.uk wants a structured type/source/amount breakdown that the
    // wizard doesn't collect yet (only other_income_details free text
    // exists). Left unanswered intentionally — see comment above.
  },

  // value.currencyRef + value.amount.
  plannedSpendOnVisitToUK: async (page, a) => {
    await ukSelectOption(page, "value_currencyRef", a["planned_spend_currency"] ?? "GBP");
    if (a["planned_spend_amount"] ?? a["planned_spend_gbp"]) {
      await ukFillText(page, "value_amount", a["planned_spend_amount"] ?? a["planned_spend_gbp"]);
    }
  },

  monthlyOutgoings: async (page, a) => {
    await ukSelectOption(page, "value_currencyRef", a["monthly_outgoings_currency"] ?? "GBP");
    if (a["monthly_outgoings_amount"] ?? a["monthly_outgoings_gbp"]) {
      await ukFillText(page, "value_amount", a["monthly_outgoings_amount"] ?? a["monthly_outgoings_gbp"]);
    }
  },

  // Yes/No on `value` group.
  payingForYourVisit: async (page, a) => {
    await ukPickRadio(page, "value", yn(a["others_paying_for_visit"]));
  },

  // preferredLanguage radio + details textbox when Other.
  spokenLanguagePreference: async (page, a) => {
    const lang = a["preferred_spoken_language_label"] ?? a["preferred_spoken_language"] ?? "English";
    await ukPickRadio(page, "preferredLanguage", lang === "English" ? "English" : "Other");
    if (lang !== "English" && a["preferred_spoken_language_details"]) {
      await ukFillText(page, "details", a["preferred_spoken_language_details"]);
    }
  },

  purposeOfVisitForVV: async (page, a) => {
    const map: Record<string, string> = {
      tourism: "Tourism (including visiting family and friends)",
      business: "Business (including sports and entertainment)",
      transit: "Transit through the UK",
      academic: "Academic visit (including teaching, exchange and visiting as a dependant of an academic visitor)",
      marriage: "Marriage or civil partnership",
      medical: "Private medical treatment or organ donation",
      short_term_study: "Short-term study (up to 6 months), including recreational course",
      other: "Other - I am visiting for another reason",
    };
    const value = a["purpose_of_visit"] ?? "tourism";
    await ukPickRadio(page, "purposeRef", map[value] ?? map.tourism);
  },

  // Tourism sub-purpose: Tourist / Visiting family / Visiting friends.
  purposeOfTourismVisitForVV: async (page, a) => {
    const map: Record<string, string> = {
      tourist: "Tourist",
      visiting_family: "Visiting family",
      visiting_friends: "Visiting friends",
    };
    await ukPickRadio(
      page,
      "purposeRef",
      a["tourism_purpose_label"] ?? map[a["tourism_purpose"] ?? "tourist"] ?? "Tourist",
    );
  },

  // single textarea `details`.
  aboutYourVisit: async (page, a) => {
    if (a["visit_activities_description"]) {
      await ukFillTextarea(page, "details", a["visit_activities_description"]);
    }
  },

  hasDependants: async (page, a) => {
    await ukPickRadio(page, "value", yn(a["has_financial_dependants"]));
  },

  parentOneDetails: async (page, a) => {
    await fillUkParentDetails(page, a, "mother");
  },

  parentTwoDetails: async (page, a) => {
    await fillUkParentDetails(page, a, "father");
  },

  familyInUk: async (page, a) => {
    await ukPickRadio(page, "value", yn(a["has_family_in_uk"]));
  },

  // isTravellingWithOtherPeople radio + companyOrOtherGroup text.
  travellingWithOtherPeople: async (page, a) => {
    const yes = yn(a["travelling_in_organised_group"]);
    await ukPickRadio(page, "isTravellingWithOtherPeople", yes);
    if (yes === "Yes" && a["organised_group_name"]) {
      await ukFillText(page, "companyOrOtherGroup", a["organised_group_name"]);
    }
  },

  // isTravellingWithSomeOneNotPartnerOrSpouse radio + givenName/familyName +
  // nationalityRef select + relationship select + otherRelationshipDescription.
  travellingWithOtherPeopleDetails: async (page, a) => {
    const yes = yn(a["travelling_with_non_partner"]);
    await ukPickRadio(page, "isTravellingWithSomeOneNotPartnerOrSpouse", yes);
    if (yes === "Yes") {
      if (a["companion_given_names"]) await ukFillText(page, "givenName", a["companion_given_names"]);
      if (a["companion_surname"]) await ukFillText(page, "familyName", a["companion_surname"]);
      if (a["companion_nationality_label"] ?? a["companion_nationality"]) {
        await ukSelectCountry(page, "nationalityRef", a["companion_nationality_label"] ?? a["companion_nationality"]);
      }
      if (a["companion_relationship_label"]) {
        await ukSelectOption(page, "travellingWithOtherPeopleRelationshipStatusRef", a["companion_relationship_label"]);
      }
      if (a["companion_relationship_other"]) {
        await ukFillTextarea(page, "otherRelationshipDescription", a["companion_relationship_other"]);
      }
    }
  },

  accommodationArrangements: async (page, a) => {
    const yes = a["has_uk_accommodation_address"] === "yes" || a["uk_accommodation_address_line_1"] ? "Yes" : "No";
    await ukPickRadio(page, "value", yes);
  },

  // Follow-up gate after otherAccommodationDetailsList.0: "Will you be
  // staying anywhere else in the UK?" — same repeatable-list "add another"
  // component as identityNameForLeaveToEnterList/standardCriminalConvictions.
  // The wizard only ever collects one UK accommodation entry (no
  // second-address fields exist upstream), so default to "No". Field name
  // on this specific page hasn't been confirmed live yet — try both
  // conventions used elsewhere on this form ("addAnother" for list gates,
  // "value" for plain Yes/No pages); whichever doesn't match the page is a
  // safe no-op.
  otherAccommodationDetailsList: async (page) => {
    await ukPickBooleanRadio(page, "addAnother", false);
    await ukPickRadio(page, "value", "No");
  },

  "otherAccommodationDetailsList.0": async (page, a) => {
    if (a["uk_accommodation_name"]) await ukFillText(page, "name", a["uk_accommodation_name"]);
    await ukFillAddressBlock(page, "accommodationDetails.address", {
      line1: a["uk_accommodation_address_line_1"],
      line2: a["uk_accommodation_address_line_2"],
      townCity: a["uk_accommodation_city"],
      postCode: a["uk_accommodation_postcode"],
    });
    if (a["uk_accommodation_arrival_date"]) {
      await ukFillDateSplit(page, "accommodationDetails.dateRange.from", a["uk_accommodation_arrival_date"]);
    }
    if (a["uk_accommodation_departure_date"]) {
      await ukFillDateSplit(page, "accommodationDetails.dateRange.to", a["uk_accommodation_departure_date"]);
    }
  },

  // haveBeenToTheUK + numberOfTimes (when yes).
  standardTimesTravelledToUK: async (page, a) => {
    const has = yn(a["travelled_to_uk_before"]);
    await ukPickRadio(page, "haveBeenToTheUK", has);
    if (has === "Yes" && a["uk_visit_count"]) {
      await ukFillText(page, "numberOfTimes", a["uk_visit_count"]);
    }
  },

  // Single bandRef radio (Zero/Once/2-5/6+) — applied per country
  // (the country is in the URL path).
  timesTravelledToOtherCountries: async (page, a) => {
    const map: Record<string, string> = {
      zero: "Zero",
      once: "Once",
      "2_to_5": "2 to 5 times",
      "6_or_more": "6 or more times",
    };
    const band = a["times_other_country_label"] ?? map[a["times_other_country"] ?? "zero"] ?? "Zero";
    await ukPickRadio(page, "bandRef", band);
  },

  standardWorldTravelHistory: async (page, a) => {
    // Real seed key is `has_other_country_visits` — `travelled_to_other_countries`
    // never existed upstream, so this always defaulted to "No".
    await ukPickRadio(page, "value", yn(a["has_other_country_visits"]));
  },

  odwPlannedTravelInformation: async (page, a) => {
    if (a["planned_arrival_date"]) await ukFillDateSplit(page, "dateOfArrival", a["planned_arrival_date"]);
    if (a["planned_departure_date"]) await ukFillDateSplit(page, "dateOfLeave", a["planned_departure_date"]);
  },

  standardImmigrationProblems: async (page, a) => {
    await ukPickRadio(page, "value", yn(a["has_immigration_problems"]));
  },

  standardImmigrationBreach: async (page, a) => {
    await ukPickRadio(page, "value", yn(a["has_immigration_breach"]));
  },

  // convictionTypeRef radio (7 options) — NOT a separate gate + detail page
  // as we previously assumed. Confirmed live via view-source: there is no
  // standalone "do you have convictions" question — this single page
  // ("Convictions and other penalties") directly asks "At any time have you
  // ever had any of the following..." with 6 conviction-type options PLUS a
  // 7th option "No, I have never had any of these" (value="none"). The old
  // code invented a fictional bare `standardCriminalConvictions` gate page
  // (which doesn't exist — gov.uk just serves this exact page directly) and
  // then returned early without selecting anything when there were no
  // convictions, leaving the required radio group unanswered.
  "standardCriminalConvictions.0.standardCriminalConvictionType": async (page, a) => {
    const map: Record<string, string> = {
      criminal: "A criminal conviction",
      driving: "A penalty for a driving offence, for example disqualification for speeding or no motor insurance",
      arrest: "An arrest or charge for which you are currently on, or awaiting trial",
      caution: "A caution, warning, reprimand or other out-of-court penalty",
      civil: "A civil court judgment against you, for example for non payment of debt, bankruptcy proceedings or anti-social behaviour",
      civil_immigration: "A civil penalty issued under UK immigration law",
    };
    if (a["has_criminal_convictions"] !== "yes") {
      await ukPickRadio(page, "convictionTypeRef", "No, I have never had any of these");
      return;
    }
    const label =
      a["criminal_conviction_type_label"] ??
      map[a["criminal_conviction_type"] ?? "criminal"] ??
      "A criminal conviction";
    await ukPickRadio(page, "convictionTypeRef", label);
  },

  // warCrimesInvolvement Yes/No + details textarea + readAllInfo[0] checkbox.
  standardWarCrimes: async (page, a) => {
    const has = yn(a["war_crimes_involvement"]);
    await ukPickRadio(page, "warCrimesInvolvement", has);
    if (has === "Yes" && a["war_crimes_details"]) {
      await ukFillTextarea(page, "warCrimesDetails", a["war_crimes_details"]);
    }
    await ukPickCheckboxes(page, "readAllInfo", [
      "I have read all of the information about war crimes, including the guidance",
    ]);
  },

  // Three Yes/No radios + their detail textareas + readAllInfo[0] ack.
  standardTerroristActivities: async (page, a) => {
    const a1 = yn(a["terrorist_activity"]);
    await ukPickRadio(page, "terroristActivitiesInvolvement", a1);
    // Real seed key is `terrorism_details` — `terrorist_activity_details`
    // never existed upstream, so this detail box was never filled.
    if (a1 === "Yes" && a["terrorism_details"]) {
      await ukFillTextarea(page, "terroristActivitiesDetails", a["terrorism_details"]);
    }
    // Real seed keys are `organisations_concern`/`organisations_concern_details`
    // — `terrorist_org_member`/`terrorist_org_details` never existed upstream,
    // so this always defaulted to "No" regardless of the real answer.
    const a2 = yn(a["organisations_concern"]);
    await ukPickRadio(page, "terroristOrganisationsInvolvement", a2);
    if (a2 === "Yes" && a["organisations_concern_details"]) {
      await ukFillTextarea(page, "terroristOrganisationsDetails", a["organisations_concern_details"]);
    }
    // No seed field captures "expressed views justifying terrorism"
    // specifically — defaults to "No" (documented gap, not a key mismatch).
    const a3 = yn(a["terrorist_views"]);
    await ukPickRadio(page, "terroristViewsExpressed", a3);
    if (a3 === "Yes" && a["terrorist_views_details"]) {
      await ukFillTextarea(page, "terroristViewsDetails", a["terrorist_views_details"]);
    }
    await ukPickCheckboxes(page, "readAllInfo", [
      "I have read all of the information about terrorist activities, organisations and views, including the guidance",
    ]);
  },

  standardExtremistActivities: async (page, a) => {
    const a1 = yn(a["extremist_org_member"]);
    await ukPickRadio(page, "extremistOrganisationsInvolvement", a1);
    if (a1 === "Yes" && a["extremist_org_details"]) {
      await ukFillTextarea(page, "extremistOrganisationsDetails", a["extremist_org_details"]);
    }
    const a2 = yn(a["extremist_views"]);
    await ukPickRadio(page, "extremistViewsExpressed", a2);
    if (a2 === "Yes" && a["extremist_views_details"]) {
      await ukFillTextarea(page, "extremistViewsDetails", a["extremist_views_details"]);
    }
    await ukPickCheckboxes(page, "readAllInfo", [
      "I have read all of the information about extremist organisations and views, including the guidance",
    ]);
  },

  // personOfGoodCharacter / otherActivities / anyOtherInfo trio,
  // each with its own details textarea.
  standardPersonOfGoodCharacter: async (page, a) => {
    const a1 = yn(a["non_uk_government_activities"]);
    await ukPickRadio(page, "personOfGoodCharacter", a1);
    if (a1 === "Yes" && a["non_uk_government_activities_details"]) {
      await ukFillTextarea(page, "pgcDetails", a["non_uk_government_activities_details"]);
    }
    // Real seed keys are `bad_character`/`bad_character_details` —
    // `other_character_activities`/`_details` never existed upstream, so
    // this always defaulted to "No" regardless of the real answer.
    const a2 = yn(a["bad_character"]);
    await ukPickRadio(page, "otherActivities", a2);
    if (a2 === "Yes" && a["bad_character_details"]) {
      await ukFillTextarea(page, "otherActivitiesDetails", a["bad_character_details"]);
    }
    const a3 = yn(a["other_character_information"]);
    await ukPickRadio(page, "anyOtherInfo", a3);
    if (a3 === "Yes" && a["other_character_information_details"]) {
      await ukFillTextarea(page, "anyOtherInfoDetails", a["other_character_information_details"]);
    }
  },

  // 7 single-item checkbox groups + paired details textareas + `none[0]` shortcut.
  standardEmploymentHistory: async (page, a) => {
    if (!a["employment_history_categories"]) {
      await ukPickCheckboxes(page, "none", ["I have not worked in any of the jobs listed above"]);
      return;
    }
    const cats = new Set(a["employment_history_categories"].split("|"));
    const def: Array<[string, string, string]> = [
      ["armed_forces_career", "armedForcesCareer", "armedForcesCareerDetails"],
      ["armed_forces_compulsory", "armedForcesCompulsory", "armedForcesCompulsoryDetails"],
      ["government", "government", "governmentDetails"],
      ["intelligence", "intelligence", "intelligenceDetails"],
      ["security", "security", "securityDetails"],
      ["media", "media", "mediaDetails"],
      ["judiciary", "judiciary", "judiciaryDetails"],
    ];
    for (const [key, prefix, detailsId] of def) {
      if (!cats.has(key)) continue;
      // Ticking by visible label of the only checkbox in the group.
      const label = labelForEmploymentHistory(key);
      await ukPickCheckboxes(page, prefix, [label]);
      const details = a[`${key}_details`];
      if (details) await ukFillTextarea(page, detailsId, details);
    }
  },

  otherInformation: async (page, a) => {
    // Real seed key is `additional_information` — `additional_application_info`
    // never existed upstream, so this box was never filled.
    if (a["additional_information"]) {
      await ukFillTextarea(page, "otherInformation", a["additional_information"]);
    }
  },
};

function labelForEmploymentHistory(key: string): string {
  switch (key) {
    case "armed_forces_career": return "Armed Forces (career)";
    case "armed_forces_compulsory": return "Armed Forces (compulsory national or military service)";
    case "government": return "Government (including Public or Civil Administration and non-military compulsory national service)";
    case "intelligence": return "Intelligence services";
    case "security": return "Security organisations (including police and private security services)";
    case "media": return "Media organisations";
    case "judiciary": return "Judiciary (including work as a judge or magistrate)";
    default: return key;
  }
}

/**
 * Documents step — tick every visible checkbox (covers mandatory passport
 * doc + optional acks).
 */
export const UK_DOCUMENTS_FILLER: UkPageFiller = async (page) => {
  const boxes = page.locator('input[type="checkbox"]');
  const n = await boxes.count();
  for (let i = 0; i < n; i++) {
    await boxes.nth(i).check({ force: true, timeout: 5_000 }).catch(() => undefined);
  }
};

function computeAgeYears(isoDob: string | undefined): number | undefined {
  if (!isoDob) return undefined;
  const dob = new Date(isoDob);
  if (Number.isNaN(dob.getTime())) return undefined;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const hadBirthdayThisYear =
    now.getMonth() > dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate());
  if (!hadBirthdayThisYear) age -= 1;
  return age;
}

/**
 * Declaration step — covers every gov.uk sub-page under the "Declaration"
 * progress-bar step (confirmed live: this is *two* separate pages, not
 * one):
 *   - /edit/declaration.standardConditionsVisitor ("Declaration - Visitor
 *     conditions") — single ack checkbox, already ships checked by
 *     default.
 *   - /edit/declaration.standardDeclaration ("Declaration") — radio group
 *     `agreement` (forMyself / forMyselfUnder18 / forChildUnder18 / forRep)
 *     for who is declaring.
 * resume.ts loops this filler + a Save click until the title stops
 * matching /Declaration/i (i.e. gov.uk has advanced to the Pay step).
 */
export const UK_DECLARATION_FILLER: UkPageFiller = async (page, a) => {
  const boxes = page.locator('input[type="checkbox"]');
  const n = await boxes.count();
  for (let i = 0; i < n; i++) {
    await boxes.nth(i).check({ force: true, timeout: 5_000 }).catch(() => undefined);
  }
  const agreement = page.locator('input[name="agreement"]');
  if ((await agreement.count()) > 0) {
    const age = computeAgeYears(a["date_of_birth"]);
    // A minor filling this out under their own login would be unusual for
    // an account-holder-driven flow — assume a parent/guardian completes
    // it on the applicant's behalf when under 18, rather than guessing
    // "forMyselfUnder18".
    const value = age !== undefined && age < 18 ? "forChildUnder18" : "forMyself";
    await page
      .locator(`input[name="agreement"][value="${value}"]`)
      .check({ force: true, timeout: 5_000 })
      .catch(() => undefined);
  }
};

/** Page slugs in the order the runner walks them. */
export const UK_PAGE_ORDER: string[] = Object.keys(UK_PAGE_FILLERS);

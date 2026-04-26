/**
 * UK Standard Visitor — per-page bindings.
 *
 * Maps the 44 application pages of apply-uk-visa.service.gov.uk to their
 * field handlers, using our seed `field_name` (from
 * `viza-be/agent-backend/scripts/seed-uk-standard-visitor-form-fields.ts`)
 * as the lookup key into the answers map loaded from
 * `visa_application_answers`.
 *
 * Coverage is incremental — pages with explicit bindings get filled
 * field-by-field, and the resume walker calls `ukClickSaveContinue` on
 * every page regardless. Pages without bindings rely on the user's
 * prior partial fill (the runner just saves-and-continues without
 * touching anything).
 *
 * Source of truth for selector patterns: docs/uk-standard-visitor-walk-report.md §4.
 * Page slugs from the Check-Your-Answers inventory (44 pages, §3).
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
  ukSelectCountry,
  ukSelectOption,
} from "./fillers";

/**
 * A binding is a function that takes the page (already on the right URL)
 * + the answers map, and fills whatever fields it knows about. Returns
 * void; the caller is responsible for clicking Save and continue.
 */
export type UkPageFiller = (page: Page, answers: Record<string, string>) => Promise<void>;

/**
 * Page slug → filler. The slug is the suffix in
 * `/edit/application.0.<slug>`. Repeatable indices (.0, .1, ...) are
 * matched by `slug.startsWith(...)` so the runner can iterate.
 */
export const UK_PAGE_FILLERS: Record<string, UkPageFiller> = {
  // ── Personal information ────────────────────────────────────────────
  standardApplicantsEmail: async (page, a) => {
    // emailOwner is a yes/someone-else radio. Default to "You".
    await ukPickRadio(page, "emailOwner", a["email_owner_label"] ?? "You");
    if (a["email_address"]) {
      await ukFillText(page, "emailAddress", a["email_address"]);
    }
  },

  hasAdditionalEmailEV: async (page, a) => {
    // Single yes/no gate. Default "No" if no second-email answer present.
    const has = a["has_alternative_email"] === "yes" ? "Yes" : "No";
    await ukPickRadio(page, "hasAdditionalEmailEV", has);
    if (has === "Yes" && a["alternative_email_address"]) {
      await ukFillText(page, "additionalEmail", a["alternative_email_address"]);
    }
  },

  "standardTelephoneDetailsList.0": async (page, a) => {
    if (a["phone_number"]) await ukFillText(page, "telephoneNumber", a["phone_number"]);
    // Sensible default purpose: outside-UK + mobile. Override via answers
    // when the FE collects a more specific intent.
    const purposes = a["phone_purpose_labels"]
      ? a["phone_purpose_labels"].split("|")
      : ["For use whilst out of the UK"];
    await ukPickCheckboxes(page, "telephoneNumberPurpose", purposes);
    const types = a["phone_type_labels"]
      ? a["phone_type_labels"].split("|")
      : ["Mobile telephone number"];
    await ukPickCheckboxes(page, "telephoneNumberType", types);
  },

  standardContactingYouByTelephone: async (page, a) => {
    // Multi-checkbox: "I can be contacted by telephone call and text message (SMS)" etc.
    const labels = a["contact_by_phone_labels"]
      ? a["contact_by_phone_labels"].split("|")
      : ["I can be contacted by telephone call and text message (SMS)"];
    await ukPickCheckboxes(page, "telephoneContact", labels);
  },

  "identityNameForLeaveToEnterList.0": async (page, a) => {
    if (a["given_names"]) await ukFillText(page, "givenName", a["given_names"]);
    if (a["surname"]) await ukFillText(page, "familyName", a["surname"]);
    // singleName is for applicants whose passport shows only one name —
    // ignore unless explicitly provided.
    if (a["single_name"]) await ukFillText(page, "singleName", a["single_name"]);
  },

  standardGenderRelationshipOOC: async (page, a) => {
    if (a["sex"]) {
      const sexLabel = a["sex"] === "male" ? "Male" : a["sex"] === "female" ? "Female" : "Unspecified";
      await ukPickRadio(page, "gender", sexLabel);
    }
    if (a["marital_status"]) {
      const map: Record<string, string> = {
        single: "Single",
        married: "Married",
        civil_partnership: "In a civil partnership",
        unmarried_partner: "Unmarried partner",
        divorced: "Divorced",
        widowed: "Widowed",
        separated: "Separated",
      };
      await ukPickRadio(page, "relationshipStatus", map[a["marital_status"]] ?? a["marital_status"]);
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
    const sameAsCorrespondence = a["correspondence_address_different"] === "yes" ? "No" : "Yes";
    await ukPickRadio(page, "isCorrespondenceAddress", sameAsCorrespondence);
    if (sameAsCorrespondence === "No") {
      await ukFillAddressBlock(page, "otherOutOfCountryAddress", {
        line1: a["correspondence_address_line_1"],
        townCity: a["correspondence_address_city"],
        countryRefLabel: a["correspondence_address_country_label"] ?? a["correspondence_address_country"],
      });
    }
  },

  standardAboutYourHomeOoC: async (page, a) => {
    if (a["how_long_at_address"]) await ukFillText(page, "lengthAtAddress", a["how_long_at_address"]);
    if (a["owns_home"] !== undefined) {
      await ukPickRadio(
        page,
        "homeOwnership",
        a["owns_home"] === "yes" ? "I own it" : "I rent it",
      );
    }
  },

  travelDocumentIssueDetails: async (page, a) => {
    if (a["passport_number"]) await ukFillText(page, "travelDocumentNumber", a["passport_number"]);
    if (a["passport_issuing_authority"]) await ukFillText(page, "issuingCountry", a["passport_issuing_authority"]);
    if (a["passport_issue_date"]) await ukFillDateSplit(page, "dateOfIssue", a["passport_issue_date"]);
    if (a["passport_expiry_date"]) await ukFillDateSplit(page, "expiryDate", a["passport_expiry_date"]);
  },

  standardIdentityCard: async (page, a) => {
    const has = a["has_national_id_card"] === "yes" ? "Yes" : "No";
    await ukPickRadio(page, "hasIdentityCard", has);
    if (has === "Yes") {
      if (a["national_id_number"]) await ukFillText(page, "identityCardNumber", a["national_id_number"]);
      if (a["national_id_issuing_country_label"] ?? a["national_id_issuing_country"]) {
        await ukSelectCountry(
          page,
          "identityCardCountry",
          a["national_id_issuing_country_label"] ?? a["national_id_issuing_country"],
        );
      }
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
    const has = a["has_other_nationalities"] === "yes" ? "Yes" : "No";
    await ukPickRadio(page, "hasOtherNationality", has);
    // Repeatable list deferred — per-instance fill happens on
    // /edit/application.0.standardOtherNationalityList.<n>.
  },

  immigrationStatus: async (page, a) => {
    if (a["current_immigration_status_label"]) {
      await ukPickRadio(page, "immigrationStatus", a["current_immigration_status_label"]);
    }
    if (a["current_immigration_status_details"]) {
      await ukFillTextarea(page, "immigrationStatusDetails", a["current_immigration_status_details"]);
    }
  },

  employmentStatus: async (page, a) => {
    if (a["employment_status_label"]) {
      await ukPickRadio(page, "employmentStatus", a["employment_status_label"]);
    }
  },

  fundingEmploymentEmployerDetails: async (page, a) => {
    if (a["employer_name"]) await ukFillText(page, "employer", a["employer_name"]);
    await ukFillAddressBlock(page, "address", {
      line1: a["employer_address_line_1"],
      line2: a["employer_address_line_2"],
      townCity: a["employer_address_city"],
      province: a["employer_address_state"],
      postCode: a["employer_address_postcode"],
      countryRefLabel: a["employer_address_country_label"] ?? a["employer_address_country"],
    });
    if (a["employer_phone_country_code"] || a["employer_phone_number"]) {
      await ukFillPhoneSplit(
        page,
        a["employer_phone_country_code"] ?? "",
        a["employer_phone_number"] ?? "",
      );
    }
    if (a["employer_start_date"]) {
      await ukFillMonthYearSplit(page, "jobStartDate", a["employer_start_date"]);
    }
  },

  fundingEmploymentJobDetails: async (page, a) => {
    if (a["job_title"]) await ukFillText(page, "jobTitle", a["job_title"]);
    if (a["monthly_income_gbp"]) await ukFillText(page, "monthlyIncome", a["monthly_income_gbp"]);
    if (a["job_description"]) await ukFillTextarea(page, "jobDescription", a["job_description"]);
  },

  fundingOtherIncome: async (page, a) => {
    if (a["other_income_label"]) {
      await ukPickRadio(page, "otherIncome", a["other_income_label"]);
    }
  },

  plannedSpendOnVisitToUK: async (page, a) => {
    if (a["planned_spend_gbp"]) await ukFillText(page, "plannedSpend", a["planned_spend_gbp"]);
  },

  monthlyOutgoings: async (page, a) => {
    if (a["monthly_outgoings_gbp"]) await ukFillText(page, "monthlyOutgoings", a["monthly_outgoings_gbp"]);
  },

  payingForYourVisit: async (page, a) => {
    const others = a["others_paying_for_visit"] === "yes" ? "Yes" : "No";
    await ukPickRadio(page, "othersPayingForVisit", others);
  },

  odwPlannedTravelInformation: async (page, a) => {
    if (a["planned_arrival_date"]) await ukFillDateSplit(page, "dateOfArrival", a["planned_arrival_date"]);
    if (a["planned_departure_date"]) await ukFillDateSplit(page, "dateOfLeave", a["planned_departure_date"]);
  },

  spokenLanguagePreference: async (page, a) => {
    await ukPickRadio(page, "spokenLanguage", a["preferred_spoken_language"] ?? "English");
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

  purposeOfTourismVisitForVV: async (page, a) => {
    await ukPickRadio(page, "purposeOfTourismVisitForVV", a["tourism_purpose_label"] ?? "Tourist");
  },

  aboutYourVisit: async (page, a) => {
    if (a["visit_activities_description"]) {
      await ukFillTextarea(page, "aboutYourVisit", a["visit_activities_description"]);
    }
  },

  hasDependants: async (page, a) => {
    const has = a["has_financial_dependants"] === "yes" ? "Yes" : "No";
    await ukPickRadio(page, "hasDependants", has);
  },

  parentOneDetails: async (page, a) => {
    // Single-checkbox shortcut: "I do not have my parents' details".
    if (a["has_parent_details"] === "no") {
      await ukPickCheckboxes(page, "noParentDetails", ["I do not have my parents' details"]);
      return;
    }
    if (a["father_given_names"]) await ukFillText(page, "givenName", a["father_given_names"]);
    if (a["father_surname"]) await ukFillText(page, "familyName", a["father_surname"]);
    if (a["father_date_of_birth"]) await ukFillDateSplit(page, "dob", a["father_date_of_birth"]);
    if (a["father_nationality_label"] ?? a["father_nationality"]) {
      await ukSelectCountry(page, "nationality", a["father_nationality_label"] ?? a["father_nationality"]);
    }
  },

  familyInUk: async (page, a) => {
    const has = a["has_family_in_uk"] === "yes" ? "Yes" : "No";
    await ukPickRadio(page, "familyInUk", has);
  },

  travellingWithOtherPeople: async (page, a) => {
    const yes = a["travelling_in_organised_group"] === "yes" ? "Yes" : "No";
    await ukPickRadio(page, "travellingWithOtherPeople", yes);
  },

  travellingWithOtherPeopleDetails: async (page, a) => {
    const yes = a["travelling_with_non_partner"] === "yes" ? "Yes" : "No";
    await ukPickRadio(page, "travellingWithOtherPeopleDetails", yes);
  },

  accommodationArrangements: async (page, a) => {
    const yes = a["has_uk_accommodation_address"] === "yes" || a["uk_accommodation_address_line_1"] ? "Yes" : "No";
    await ukPickRadio(page, "accommodationArrangements", yes);
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

  standardTimesTravelledToUK: async (page, a) => {
    const has = a["travelled_to_uk_before"] === "yes" ? "Yes" : "No";
    await ukPickRadio(page, "haveYouTravelledToTheUK", has);
  },

  timesTravelledToOtherCountries: async (page, a) => {
    // Each country gets a "How many times" select. Default to "Zero" when
    // we have no data.
    const fallback = a["times_other_countries_label"] ?? "Zero";
    await ukSelectOption(page, "australia", fallback);
    await ukSelectOption(page, "canada", fallback);
    await ukSelectOption(page, "newZealand", fallback);
    await ukSelectOption(page, "usa", fallback);
    await ukSelectOption(page, "switzerland", fallback);
    await ukSelectOption(page, "europeanEconomicArea", fallback);
  },

  standardWorldTravelHistory: async (page, a) => {
    const has = a["travelled_to_other_countries"] === "yes" ? "Yes" : "No";
    await ukPickRadio(page, "worldTravelHistory", has);
  },

  standardImmigrationProblems: async (page, a) => {
    const has = a["has_immigration_problems"] === "yes" ? "Yes" : "No";
    await ukPickRadio(page, "immigrationProblems", has);
  },

  standardImmigrationBreach: async (page, a) => {
    const has = a["has_immigration_breach"] === "yes" ? "Yes" : "No";
    await ukPickRadio(page, "immigrationBreach", has);
  },

  "standardCriminalConvictions.0.standardCriminalConvictionType": async (page, a) => {
    const has = a["has_criminal_convictions"] === "yes" ? "Yes" : "No, I have never had any of these";
    await ukPickRadio(page, "standardCriminalConvictionType", has);
  },

  standardWarCrimes: async (page, a) => {
    const has = a["war_crimes_involvement"] === "yes" ? "Yes" : "No";
    await ukPickRadio(page, "warCrimes", has);
    await ukPickCheckboxes(page, "warCrimesAcknowledgement", [
      "I have read all of the information about war crimes, including the guidance",
    ]);
  },

  standardTerroristActivities: async (page, a) => {
    const no = "No";
    await ukPickRadio(page, "terroristActivity", a["terrorist_activity"] === "yes" ? "Yes" : no);
    await ukPickRadio(page, "terroristOrganisationMembership", a["terrorist_org_member"] === "yes" ? "Yes" : no);
    await ukPickRadio(page, "terroristViews", a["terrorist_views"] === "yes" ? "Yes" : no);
    await ukPickCheckboxes(page, "terroristAcknowledgement", [
      "I have read all of the information about terrorist activities, organisations and views, including the guidance",
    ]);
  },

  standardExtremistActivities: async (page, a) => {
    const no = "No";
    await ukPickRadio(page, "extremistOrganisationMembership", a["extremist_org_member"] === "yes" ? "Yes" : no);
    await ukPickRadio(page, "extremistViews", a["extremist_views"] === "yes" ? "Yes" : no);
    await ukPickCheckboxes(page, "extremistAcknowledgement", [
      "I have read all of the information about extremist organisations and views, including the guidance",
    ]);
  },

  standardPersonOfGoodCharacter: async (page, a) => {
    const no = "No";
    await ukPickRadio(page, "nonUkGovernmentActivities", a["non_uk_government_activities"] === "yes" ? "Yes" : no);
    await ukPickRadio(page, "otherCharacterActivities", a["other_character_activities"] === "yes" ? "Yes" : no);
    await ukPickRadio(page, "otherCharacterInformation", a["other_character_information"] === "yes" ? "Yes" : no);
  },

  standardEmploymentHistory: async (page, a) => {
    await ukPickCheckboxes(
      page,
      "employmentHistory",
      a["employment_history_labels"]
        ? a["employment_history_labels"].split("|")
        : ["I have not worked in any of the jobs listed above"],
    );
  },

  otherInformation: async (page, a) => {
    if (a["additional_application_info"]) {
      await ukFillTextarea(page, "otherInformation", a["additional_application_info"]);
    }
  },
};

/**
 * Documents step — the single mandatory checkbox + optional acks.
 * Lives on `/next?hasResumed=true` (the post-Application landing).
 */
export const UK_DOCUMENTS_FILLER: UkPageFiller = async (page) => {
  // Tick every visible checkbox on the Documents page; gov.uk requires
  // the mandatory passport-doc checkbox at minimum, and ticking the
  // optional "evidence of funds" + residence acks is harmless.
  const boxes = page.locator('input[type="checkbox"]');
  const n = await boxes.count();
  for (let i = 0; i < n; i++) {
    await boxes.nth(i).check({ force: true, timeout: 5_000 }).catch(() => undefined);
  }
};

/**
 * Declaration step — the single attestation checkbox.
 * Halts the runner immediately AFTER ticking but BEFORE clicking continue,
 * since the next page is Pay.
 */
export const UK_DECLARATION_FILLER: UkPageFiller = async (page) => {
  const boxes = page.locator('input[type="checkbox"]');
  const n = await boxes.count();
  for (let i = 0; i < n; i++) {
    await boxes.nth(i).check({ force: true, timeout: 5_000 }).catch(() => undefined);
  }
};

/** Page slugs in the order the runner walks them. */
export const UK_PAGE_ORDER: string[] = Object.keys(UK_PAGE_FILLERS);

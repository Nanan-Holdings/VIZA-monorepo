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
  ukSelectCountry,
  ukSelectOption,
} from "./fillers";

export type UkPageFiller = (page: Page, answers: Record<string, string>) => Promise<void>;

const yn = (v: string | undefined): "Yes" | "No" => (v === "yes" ? "Yes" : "No");

export const UK_PAGE_FILLERS: Record<string, UkPageFiller> = {
  // ── Personal information ────────────────────────────────────────────
  standardApplicantsEmail: async (page, a) => {
    await ukPickRadio(page, "emailOwner", a["email_owner_label"] ?? "You");
    if (a["email_address"]) await ukFillText(page, "emailAddress", a["email_address"]);
  },

  hasAdditionalEmailEV: async (page, a) => {
    const has = a["has_alternative_email"] === "yes" ? "Yes" : "No";
    await ukPickRadio(page, "hasAdditionalEmailEV", has);
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

  // yearsLived + monthsLived (number splits), ownershipCategory radio.
  standardAboutYourHomeOoC: async (page, a) => {
    if (a["years_at_address"]) await ukFillText(page, "yearsLived", a["years_at_address"]);
    if (a["months_at_address"]) await ukFillText(page, "monthsLived", a["months_at_address"]);
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
    if (a["passport_issuing_authority"]) await ukFillText(page, "issuingCountry", a["passport_issuing_authority"]);
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
      await ukFillPhoneSplit(page, a["employer_phone_country_code"] ?? "", a["employer_phone_number"] ?? "");
    }
    if (a["employer_start_date"]) {
      await ukFillMonthYearSplit(page, "jobStartDate", a["employer_start_date"]);
    }
  },

  // earnings.currencyRef select + earnings.amount, jobDescription textarea.
  fundingEmploymentJobDetails: async (page, a) => {
    if (a["job_title"]) await ukFillText(page, "jobTitle", a["job_title"]);
    await ukSelectOption(page, "earnings_currencyRef", a["job_earnings_currency"] ?? "GBP");
    if (a["job_earnings_amount"]) await ukFillText(page, "earnings_amount", a["job_earnings_amount"]);
    if (a["job_description"]) await ukFillTextarea(page, "jobDescription", a["job_description"]);
  },

  // Multi-checkbox typeOfIncomeRefs[i] + sourceRefs[i] + currency/amount
  // pairs. hasNoOtherIncome single checkbox shortcut.
  fundingOtherIncome: async (page, a) => {
    if (a["other_income_none"] === "yes" || !a["other_income_types"]) {
      await ukPickCheckboxes(page, "hasNoOtherIncome", ["I do not have any other income or savings"]);
      return;
    }
    const types = a["other_income_types"].split("|");
    await ukPickCheckboxes(page, "typeOfIncomeRefs", types);
    if (a["other_income_sources"]) {
      const sources = a["other_income_sources"].split("|");
      await ukPickCheckboxes(page, "sourceRefs", sources);
    }
    if (a["other_income_amount"]) {
      await ukSelectOption(page, "income_currencyRef", a["other_income_currency"] ?? "GBP");
      await ukFillText(page, "income_amount", a["other_income_amount"]);
    }
    if (a["money_in_bank_amount"]) {
      await ukSelectOption(page, "moneyInBankAmount_currencyRef", a["money_in_bank_currency"] ?? "GBP");
      await ukFillText(page, "moneyInBankAmount_amount", a["money_in_bank_amount"]);
    }
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

  // parentIsUnknown checkbox shortcut OR parent.* fields.
  parentOneDetails: async (page, a) => {
    if (a["has_parent_details"] === "no") {
      await ukPickCheckboxes(page, "parentIsUnknown", ["I do not have my parents' details"]);
      return;
    }
    await ukPickRadio(page, "parent.relationshipRef", a["first_parent_relationship_label"] ?? "Mother");
    if (a["mother_given_names"] ?? a["father_given_names"]) {
      await ukFillText(page, "parent_givenName", a["mother_given_names"] ?? a["father_given_names"] ?? "");
    }
    if (a["mother_surname"] ?? a["father_surname"]) {
      await ukFillText(page, "parent_familyName", a["mother_surname"] ?? a["father_surname"] ?? "");
    }
    const dob = a["mother_date_of_birth"] ?? a["father_date_of_birth"];
    if (dob) await ukFillDateSplit(page, "parent_dateOfBirth", dob);
    const nat = a["mother_nationality_label"] ?? a["father_nationality_label"] ?? a["mother_nationality"] ?? a["father_nationality"];
    if (nat) await ukSelectCountry(page, "parent_nationalityRef", nat);
    const sameNat = a["parent_same_nationality_at_applicants_birth"] === "no" ? "No" : "Yes";
    await ukPickRadio(page, "parent.hadAlwaysSameNationality", sameNat);
    if (sameNat === "No" && a["parent_nationality_at_applicants_birth_label"]) {
      await ukSelectCountry(page, "parent_nationalityAtApplicantsBirthRef", a["parent_nationality_at_applicants_birth_label"]);
    }
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
    await ukPickRadio(page, "value", yn(a["travelled_to_other_countries"]));
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

  // convictionTypeRef radio (6 options) — answer maps to a specific
  // conviction type when has_criminal_convictions=yes.
  "standardCriminalConvictions.0.standardCriminalConvictionType": async (page, a) => {
    const map: Record<string, string> = {
      criminal: "A criminal conviction",
      driving: "A penalty for a driving offence, for example disqualification for speeding or no motor insurance",
      arrest: "An arrest or charge for which you are currently on, or awaiting trial",
      caution: "A caution, warning, reprimand or other out-of-court penalty",
      civil: "A civil court judgment against you, for example for non payment of debt, bankruptcy proceedings or anti-social behaviour",
      civil_immigration: "A civil penalty issued under UK immigration law",
    };
    if (a["has_criminal_convictions"] !== "yes") return;
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
    if (a1 === "Yes" && a["terrorist_activity_details"]) {
      await ukFillTextarea(page, "terroristActivitiesDetails", a["terrorist_activity_details"]);
    }
    const a2 = yn(a["terrorist_org_member"]);
    await ukPickRadio(page, "terroristOrganisationsInvolvement", a2);
    if (a2 === "Yes" && a["terrorist_org_details"]) {
      await ukFillTextarea(page, "terroristOrganisationsDetails", a["terrorist_org_details"]);
    }
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
    const a2 = yn(a["other_character_activities"]);
    await ukPickRadio(page, "otherActivities", a2);
    if (a2 === "Yes" && a["other_character_activities_details"]) {
      await ukFillTextarea(page, "otherActivitiesDetails", a["other_character_activities_details"]);
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
    if (a["additional_application_info"]) {
      await ukFillTextarea(page, "otherInformation", a["additional_application_info"]);
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

/**
 * Declaration step — tick the attestation but caller must NOT click Save
 * (next route is Pay).
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

/**
 * Page-identity detection for the UK Standard Visitor visa flow.
 *
 * Unlike CEAC (where every section has its own URL), the UKVI flow lives
 * mostly at the shared path `/next`. The stable discriminator is the
 * form's `action` attribute, which encodes the current state — e.g.
 * `/save/start.contactEmail` for the register-email page. We combine
 * form.action, h1 text, and document.title to resolve identity.
 */

import type { Page } from "@playwright/test";
import { UK_HEADING_SELECTOR, UK_MARKERS } from "./selectors";
import { UkUnexpectedPageError } from "./errors";

/** UK Standard Visitor page identities — full set verified by walking
 *  the form end-to-end on 2026-04-25. Additions here should also
 *  extend `PAGE_SIGNATURES` below. Post-auth identifiers are derived
 *  from the form `action` suffix (the UKVI step identifier).
 *
 *  The 44 post-auth identifiers below come from the review page's
 *  "Change ___" edit links, which enumerate every section the form
 *  walks. Some (email/phone/name) are filled at registration time so
 *  weren't visited during the resumed walk.
 */
export type UkPageId =
  // ── Pre-auth (no account) ───────────────────────────────────────
  | "language_selection"
  | "country_selection"
  | "vac_information"
  | "visa_type_start"
  | "registration"
  | "resume_sign_in"                 // /resume/{uuid} password gate
  | "resume_warning"                 // /resumeApplicationInProgressWarning/{uuid}
  | "sign_in"                        // alt sign-in shell discriminated by hasPassword hidden
  | "session_expired"
  // ── Post-auth: identity + contact ───────────────────────────────
  | "applicants_email"               // standardApplicantsEmail
  | "additional_email"               // hasAdditionalEmailEV
  | "telephone_details"              // standardTelephoneDetailsList.N
  | "contacting_by_telephone"        // standardContactingYouByTelephone
  | "name"                           // identityNameForLeaveToEnterList.N
  | "gender_relationship"            // standardGenderRelationshipOOC
  | "address"                        // standardAddressOoC
  | "about_your_home"                // standardAboutYourHomeOoC
  | "passport"                       // travelDocumentIssueDetails
  | "identity_card"                  // standardIdentityCard
  | "nationality_dob"                // standardNationalityDOBOoC
  | "other_nationality"              // standardOtherNationality
  | "immigration_status"             // immigrationStatus
  // ── Employment + finances ───────────────────────────────────────
  | "employment_status"              // employmentStatus
  | "employer_details"               // fundingEmploymentEmployerDetails
  | "job_details"                    // fundingEmploymentJobDetails
  | "other_income"                   // fundingOtherIncome
  | "planned_spend"                  // plannedSpendOnVisitToUK
  | "monthly_outgoings"              // monthlyOutgoings
  | "paying_for_visit"               // payingForYourVisit
  // ── Trip details ────────────────────────────────────────────────
  | "planned_travel"                 // odwPlannedTravelInformation
  | "spoken_language"                // spokenLanguagePreference
  | "purpose_of_visit"               // purposeOfVisitForVV
  | "purpose_of_tourism"             // purposeOfTourismVisitForVV
  | "about_your_visit"               // aboutYourVisit
  | "has_dependants"                 // hasDependants
  | "parent_one"                     // parentOneDetails
  | "family_in_uk"                   // familyInUk
  | "travelling_with_others"         // travellingWithOtherPeople
  | "travelling_with_others_details" // travellingWithOtherPeopleDetails
  | "accommodation_arrangements"     // accommodationArrangements
  | "other_accommodation"            // otherAccommodationDetailsList.N
  // ── Travel & immigration history ────────────────────────────────
  | "uk_travel_history"              // standardTimesTravelledToUK
  | "other_country_travel"           // timesTravelledToOtherCountries
  | "world_travel_history"           // standardWorldTravelHistory
  | "immigration_history"            // standardImmigrationProblems
  | "immigration_breach"             // standardImmigrationBreach
  // ── Character / declarations ────────────────────────────────────
  | "criminal_convictions"           // standardCriminalConvictions.N.standardCriminalConvictionType
  | "war_crimes"                     // standardWarCrimes
  | "terrorist_activities"           // standardTerroristActivities
  | "extremist_activities"           // standardExtremistActivities
  | "person_of_good_character"       // standardPersonOfGoodCharacter
  | "employment_history"             // standardEmploymentHistory
  | "other_information"              // otherInformation
  // ── Final pages ─────────────────────────────────────────────────
  | "review"                         // h1 "Check your answers"; form action /next
  | "documents"                      // documents.requiredDocuments — terminal page for orchestrator handoff
  // ── Fallback ────────────────────────────────────────────────────
  | "post_auth_unknown"
  | "unknown";

export interface UkPageIdentity {
  id: UkPageId;
  url: string;
  heading: string | null;
  formAction: string | null;
  title: string;
}

interface PageSignature {
  id: UkPageId;
  urlPattern?: RegExp;
  actionPattern?: RegExp;
  headingPattern?: RegExp;
  titlePattern?: RegExp;
}

/** Order matters: more specific first. */
const PAGE_SIGNATURES: ReadonlyArray<PageSignature> = [
  // Gates — match before content pages
  {
    id: "session_expired",
    headingPattern: UK_MARKERS.sessionExpiredHeadingPattern,
  },

  // Pre-auth flow
  {
    id: "language_selection",
    urlPattern: /\/alt-language-selection-skip-visa$/i,
    headingPattern: /^select your language$/i,
  },
  {
    id: "country_selection",
    urlPattern: /\/country-selection$/i,
    headingPattern: /select a country to provide your biometrics/i,
  },
  {
    id: "vac_information",
    urlPattern: /\/vac-information-page\//i,
    headingPattern: /check available visa application centre locations/i,
  },
  {
    id: "visa_type_start",
    urlPattern: /\/visa-type$/i,
    headingPattern: /apply for a uk (visit )?visa/i,
  },
  {
    id: "resume_sign_in",
    urlPattern: /\/resume\/[0-9a-f-]{36}/i,
    headingPattern: /sign in to your uk visa application/i,
  },
  {
    id: "resume_warning",
    urlPattern: /\/resumeApplicationInProgressWarning\//i,
    headingPattern: /do you want to resume your old application/i,
  },
  {
    id: "registration",
    actionPattern: /\/save\/start\.contactEmail$/i,
    headingPattern: /^register an email$/i,
  },
  {
    id: "sign_in",
    actionPattern: /\/save\/start\.contactEmail$/i,
    titlePattern: /sign ?in/i,
  },

  // Post-auth: action-suffix anchors on the UKVI camelCase stepIdentifier.
  // Some sections are repeatable lists; .N suffix tolerated via $|\..
  { id: "applicants_email",               actionPattern: /\.standardApplicantsEmail$/i },
  { id: "additional_email",               actionPattern: /\.hasAdditionalEmailEV$/i },
  { id: "telephone_details",              actionPattern: /\.standardTelephoneDetailsList(\.\d+)?$/i },
  { id: "contacting_by_telephone",        actionPattern: /\.standardContactingYouByTelephone$/i },
  { id: "name",                           actionPattern: /\.identityNameForLeaveToEnterList(\.\d+)?$/i },
  { id: "gender_relationship",            actionPattern: /\.standardGenderRelationshipOOC$/i },
  { id: "address",                        actionPattern: /\.standardAddressOoC$/i },
  { id: "about_your_home",                actionPattern: /\.standardAboutYourHomeOoC$/i },
  { id: "passport",                       actionPattern: /\.travelDocumentIssueDetails$/i },
  { id: "identity_card",                  actionPattern: /\.standardIdentityCard$/i },
  { id: "nationality_dob",                actionPattern: /\.standardNationalityDOBOoC$/i },
  { id: "other_nationality",              actionPattern: /\.standardOtherNationality$/i },
  { id: "immigration_status",             actionPattern: /\.immigrationStatus$/i },
  { id: "employment_status",              actionPattern: /\.employmentStatus$/i },
  { id: "employer_details",               actionPattern: /\.fundingEmploymentEmployerDetails$/i },
  { id: "job_details",                    actionPattern: /\.fundingEmploymentJobDetails$/i },
  { id: "other_income",                   actionPattern: /\.fundingOtherIncome$/i },
  { id: "planned_spend",                  actionPattern: /\.plannedSpendOnVisitToUK$/i },
  { id: "monthly_outgoings",              actionPattern: /\.monthlyOutgoings$/i },
  { id: "paying_for_visit",               actionPattern: /\.payingForYourVisit$/i },
  { id: "planned_travel",                 actionPattern: /\.odwPlannedTravelInformation$/i },
  { id: "spoken_language",                actionPattern: /\.spokenLanguagePreference$/i },
  { id: "purpose_of_visit",               actionPattern: /\.purposeOfVisitForVV$/i },
  { id: "purpose_of_tourism",             actionPattern: /\.purposeOfTourismVisitForVV$/i },
  { id: "about_your_visit",               actionPattern: /\.aboutYourVisit$/i },
  { id: "has_dependants",                 actionPattern: /\.hasDependants$/i },
  { id: "parent_one",                     actionPattern: /\.parentOneDetails$/i },
  { id: "family_in_uk",                   actionPattern: /\.familyInUk$/i },
  { id: "travelling_with_others_details", actionPattern: /\.travellingWithOtherPeopleDetails$/i },
  { id: "travelling_with_others",         actionPattern: /\.travellingWithOtherPeople$/i },
  { id: "accommodation_arrangements",     actionPattern: /\.accommodationArrangements$/i },
  { id: "other_accommodation",            actionPattern: /\.otherAccommodationDetailsList(\.\d+)?$/i },
  { id: "uk_travel_history",              actionPattern: /\.standardTimesTravelledToUK$/i },
  { id: "other_country_travel",           actionPattern: /\.timesTravelledToOtherCountries$/i },
  { id: "world_travel_history",           actionPattern: /\.standardWorldTravelHistory$/i },
  { id: "immigration_history",            actionPattern: /\.standardImmigrationProblems$/i },
  { id: "immigration_breach",             actionPattern: /\.standardImmigrationBreach$/i },
  { id: "criminal_convictions",           actionPattern: /\.standardCriminalConvictions(\.\d+)?\.standardCriminalConvictionType$/i },
  { id: "war_crimes",                     actionPattern: /\.standardWarCrimes$/i },
  { id: "terrorist_activities",           actionPattern: /\.standardTerroristActivities$/i },
  { id: "extremist_activities",           actionPattern: /\.standardExtremistActivities$/i },
  { id: "person_of_good_character",       actionPattern: /\.standardPersonOfGoodCharacter$/i },
  { id: "employment_history",             actionPattern: /\.standardEmploymentHistory$/i },
  { id: "other_information",              actionPattern: /\.otherInformation$/i },
  { id: "review",                         urlPattern: /\/next/i, headingPattern: /^check your answers$/i },
  { id: "documents",                      actionPattern: /\/save\/documents\.requiredDocuments$/i },
];

/** Probe the current page for its identity signature.
 *  Returns `unknown` if nothing matches — caller decides how to handle. */
export async function detectPage(page: Page): Promise<UkPageIdentity> {
  const probe = await page.evaluate((headingSelector) => {
    const heading = document.querySelector<HTMLElement>(headingSelector);
    const form = document.querySelector<HTMLFormElement>("form");
    return {
      url: location.href,
      heading: heading?.innerText?.trim() ?? null,
      formAction: form?.getAttribute("action") ?? null,
      title: document.title,
    };
  }, UK_HEADING_SELECTOR);

  for (const sig of PAGE_SIGNATURES) {
    if (sig.urlPattern && !sig.urlPattern.test(probe.url)) continue;
    if (sig.actionPattern) {
      if (!probe.formAction || !sig.actionPattern.test(probe.formAction)) continue;
    }
    if (sig.headingPattern) {
      if (!probe.heading || !sig.headingPattern.test(probe.heading)) continue;
    }
    if (sig.titlePattern && !sig.titlePattern.test(probe.title)) continue;
    return { id: sig.id, ...probe };
  }

  // If we're at /next (the shared post-auth shell) but no signature matched,
  // flag as post_auth_unknown so the orchestrator can stop with a clear
  // message instead of silently continuing to fill nothing.
  if (/\/next$/i.test(probe.url) || /\/save\//i.test(probe.formAction ?? "")) {
    return { id: "post_auth_unknown", ...probe };
  }

  return { id: "unknown", ...probe };
}

export async function assertPage(
  page: Page,
  expected: UkPageId,
): Promise<UkPageIdentity> {
  const identity = await detectPage(page);
  if (identity.id !== expected) {
    throw new UkUnexpectedPageError(
      `UK page identity mismatch: expected "${expected}", detected "${identity.id}"`,
      {
        expected,
        detected: identity.id,
        url: identity.url,
        details: { heading: identity.heading, formAction: identity.formAction, title: identity.title },
      },
    );
  }
  return identity;
}

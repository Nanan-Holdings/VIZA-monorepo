import { createElement } from "react";
import { StepGenericFields, type GenericField } from "../shell/shared-steps/step-generic-fields";
import { StepPurposeCards, type PurposeOption } from "../shell/shared-steps/step-purpose-cards";
import { StepTripDates, type EntryOption } from "../shell/shared-steps/step-trip-dates";
import { StepFundingBlock } from "../shell/shared-steps/step-funding-block";
import { StepYesNoChecklist, type ChecklistItem } from "../shell/shared-steps/step-yesno-checklist";
import type { WizardConfig, WizardReviewSection } from "../shell/types";

export type UkForm = Record<string, string>;

const NAMESPACE = "simplifiedForm.uk";
const UK_VISITOR_MAX_STAY_DAYS = 180;

// ---------------------------------------------------------------------------
// Field groups (expanded against the UK Standard Visitor application).
// ---------------------------------------------------------------------------

const PERSONAL_FIELDS: GenericField[] = [
  { kind: "text", key: "given_names", labelKey: "fields.givenNames", placeholderKey: "fields.givenNamesPlaceholder", required: true },
  { kind: "text", key: "surname", labelKey: "fields.surname", placeholderKey: "fields.surnamePlaceholder", required: true },
  { kind: "yesno", key: "any_other_names", labelKey: "fields.anyOtherNames" },
  { kind: "text", key: "other_names", labelKey: "fields.otherNames" },
  { kind: "date", key: "date_of_birth", labelKey: "fields.dob" },
  { kind: "select", key: "sex", labelKey: "fields.sex", options: [
    { value: "Male", labelKey: "options.sex.male" },
    { value: "Female", labelKey: "options.sex.female" },
  ] },
  { kind: "country", key: "country_of_nationality", labelKey: "fields.nationality" },
  { kind: "yesno", key: "has_other_nationalities", labelKey: "fields.hasOtherNationalities" },
  { kind: "country", key: "country_of_birth", labelKey: "fields.countryOfBirth" },
  { kind: "text", key: "place_of_birth", labelKey: "fields.placeOfBirth", placeholderKey: "fields.placeOfBirthPlaceholder" },
  { kind: "select", key: "marital_status", labelKey: "fields.maritalStatus", options: [
    { value: "single", labelKey: "options.marital.single" },
    { value: "married", labelKey: "options.marital.married" },
    { value: "civil_partnership", labelKey: "options.marital.civilPartnership" },
    { value: "unmarried_partner", labelKey: "options.marital.unmarriedPartner" },
    { value: "divorced", labelKey: "options.marital.divorced" },
    { value: "widowed", labelKey: "options.marital.widowed" },
    { value: "separated", labelKey: "options.marital.separated" },
  ] },
];

const PASSPORT_FIELDS: GenericField[] = [
  { kind: "text", key: "passport_number", labelKey: "fields.passportNumber", placeholderKey: "fields.passportNumberPlaceholder" },
  { kind: "country", key: "passport_issuing_authority", labelKey: "fields.passportIssuingCountry" },
  { kind: "text", key: "passport_place_of_issue", labelKey: "fields.passportPlaceOfIssue" },
  { kind: "date", key: "passport_date_of_issue", labelKey: "fields.passportIssueDate" },
  { kind: "date", key: "passport_date_of_expiry", labelKey: "fields.passportExpiryDate" },
];

const CONTACT_FIELDS: GenericField[] = [
  { kind: "email", key: "email_address", labelKey: "fields.email", placeholderKey: "fields.emailPlaceholder" },
  { kind: "phone", key: "telephone_number", labelKey: "fields.phone", placeholderKey: "fields.phonePlaceholder" },
  { kind: "text", key: "home_address_line1", labelKey: "fields.homeAddressLine1", placeholderKey: "fields.homeAddressLine1Placeholder" },
  { kind: "text", key: "home_address_city", labelKey: "fields.homeAddressCity" },
  { kind: "text", key: "home_address_postcode", labelKey: "fields.postalCode" },
  { kind: "country", key: "home_country", labelKey: "fields.homeCountry" },
  { kind: "yesno", key: "owns_home", labelKey: "fields.ownsHome" },
];

const UKVI_FIELDS: GenericField[] = [
  { kind: "yesno", key: "has_existing_ukvi_account", labelKey: "fields.hasUkviAccount" },
  { kind: "email", key: "ukvi_account_email", labelKey: "fields.ukviEmail", placeholderKey: "fields.ukviEmailPlaceholder" },
];

const UK_ADDRESS_FIELDS: GenericField[] = [
  { kind: "text", key: "uk_address_line1", labelKey: "fields.ukAddress", placeholderKey: "fields.ukAddressPlaceholder" },
  { kind: "text", key: "uk_address_city", labelKey: "fields.ukCity" },
  { kind: "text", key: "uk_address_postcode", labelKey: "fields.ukPostcode" },
  { kind: "phone", key: "uk_contact_phone", labelKey: "fields.ukContactPhone" },
  { kind: "yesno", key: "staying_with_someone", labelKey: "fields.stayingWithSomeone" },
  { kind: "text", key: "host_name", labelKey: "fields.hostName" },
  { kind: "text", key: "host_relationship", labelKey: "fields.hostRelationship" },
];

const EMPLOYMENT_FIELDS: GenericField[] = [
  { kind: "select", key: "employment_status", labelKey: "fields.employmentStatus", options: [
    { value: "employed", labelKey: "options.employment.employed" },
    { value: "self_employed", labelKey: "options.employment.selfEmployed" },
    { value: "student", labelKey: "options.employment.student" },
    { value: "retired", labelKey: "options.employment.retired" },
    { value: "unemployed", labelKey: "options.employment.unemployed" },
  ] },
  { kind: "text", key: "employer_name", labelKey: "fields.employerName" },
  { kind: "text", key: "job_title", labelKey: "fields.jobTitle" },
  { kind: "text", key: "employer_address", labelKey: "fields.employerAddress" },
  { kind: "phone", key: "employer_phone", labelKey: "fields.employerPhone" },
  { kind: "text", key: "monthly_income", labelKey: "fields.monthlyIncome", placeholderKey: "fields.monthlyIncomePlaceholder" },
];

const HISTORY_FIELDS: GenericField[] = [
  { kind: "yesno", key: "has_visited_uk_before", labelKey: "fields.hasVisitedUkBefore" },
  { kind: "text", key: "previous_uk_visit_dates", labelKey: "fields.previousUkVisitDates" },
  { kind: "yesno", key: "has_been_refused_uk_visa", labelKey: "fields.hasBeenRefusedUkVisa" },
  { kind: "textarea", key: "uk_refusal_explanation", labelKey: "fields.ukRefusalExplanation" },
  { kind: "yesno", key: "has_been_refused_other_visa", labelKey: "fields.hasBeenRefusedOtherVisa" },
];

// Extra UKVI questions the gov.uk form asks that aren't covered elsewhere.
// Field keys deliberately match the seed field_names the submission-service
// page-bindings fillers consume, so normalizeUkAnswers passes them straight
// through (familyInUk, hasDependants, travellingWithOtherPeople, …).
const BACKGROUND_FIELDS: GenericField[] = [
  { kind: "textarea", key: "visit_activities_description", labelKey: "fields.visitActivitiesDescription" },
  { kind: "yesno", key: "has_family_in_uk", labelKey: "fields.hasFamilyInUk" },
  { kind: "yesno", key: "has_financial_dependants", labelKey: "fields.hasFinancialDependants" },
  { kind: "yesno", key: "travelling_in_organised_group", labelKey: "fields.travellingInOrganisedGroup" },
  { kind: "yesno", key: "travelling_with_non_partner", labelKey: "fields.travellingWithNonPartner" },
];

// Bespoke step inputs ---------------------------------------------------------

const PURPOSE_OPTIONS: PurposeOption[] = [
  { value: "tourism", labelKey: "options.purpose.tourism", descriptionKey: "options.purposeDesc.tourism" },
  { value: "business", labelKey: "options.purpose.business", descriptionKey: "options.purposeDesc.business" },
  { value: "visiting_family", labelKey: "options.purpose.visitingFamily", descriptionKey: "options.purposeDesc.family" },
  { value: "study", labelKey: "options.purpose.study", descriptionKey: "options.purposeDesc.study" },
  { value: "medical", labelKey: "options.purpose.medical", descriptionKey: "options.purposeDesc.medical" },
  { value: "wedding_civil_partnership", labelKey: "options.purpose.wedding", descriptionKey: "options.purposeDesc.wedding" },
  { value: "transit", labelKey: "options.purpose.transit", descriptionKey: "options.purposeDesc.transit" },
  { value: "other", labelKey: "options.purpose.other", descriptionKey: "options.purposeDesc.other" },
];

const ENTRIES_OPTIONS: EntryOption[] = [
  { value: "single", labelKey: "options.entries.single" },
  { value: "multiple_2y", labelKey: "options.entries.multi2y" },
  { value: "multiple_5y", labelKey: "options.entries.multi5y" },
  { value: "multiple_10y", labelKey: "options.entries.multi10y" },
];

const FUNDING_SOURCE_OPTIONS = [
  { value: "self", labelKey: "options.funding.self" },
  { value: "family", labelKey: "options.funding.family" },
  { value: "employer", labelKey: "options.funding.employer" },
  { value: "sponsor", labelKey: "options.funding.sponsor" },
];

const CURRENCY_OPTIONS = [
  { value: "GBP", labelKey: "options.currency.gbp" },
  { value: "USD", labelKey: "options.currency.usd" },
  { value: "EUR", labelKey: "options.currency.eur" },
  { value: "CNY", labelKey: "options.currency.cny" },
];

const DECLARATION_ITEMS: ChecklistItem[] = [
  { key: "decl_information_correct", labelKey: "declarations.informationCorrect" },
  { key: "decl_no_criminal_convictions", labelKey: "declarations.noCriminalConvictions", explainOnYes: true },
  { key: "decl_no_war_crimes", labelKey: "declarations.noWarCrimes", explainOnYes: true },
  { key: "decl_no_terrorism", labelKey: "declarations.noTerrorism", explainOnYes: true },
  { key: "decl_will_leave_before_visa_expires", labelKey: "declarations.willLeaveBeforeExpiry" },
];

// Tracked field-key lists for review/payload of bespoke steps.
const PURPOSE_KEYS = ["purpose_of_visit"];
const TRIP_DATES_KEYS = [
  "intended_arrival_date",
  "intended_departure_date",
  "number_of_entries",
];
const FUNDING_KEYS = [
  "trip_funding_source",
  "sponsor_name",
  "sponsor_relationship",
  "estimated_trip_cost",
  "trip_cost_currency",
  "has_savings",
];
const DECLARATION_KEYS = DECLARATION_ITEMS.map((i) => i.key);

// ---------------------------------------------------------------------------

const STEP_FIELD_MAP: Record<string, GenericField[]> = {
  personal: PERSONAL_FIELDS,
  passport: PASSPORT_FIELDS,
  contact: CONTACT_FIELDS,
  ukvi: UKVI_FIELDS,
  uk_address: UK_ADDRESS_FIELDS,
  employment: EMPLOYMENT_FIELDS,
  history: HISTORY_FIELDS,
  background: BACKGROUND_FIELDS,
};

function camelCase(s: string): string {
  return s.replace(/_(.)/g, (_, c) => c.toUpperCase());
}

function fieldRows(form: UkForm, keys: string[]): WizardReviewSection["rows"] {
  return keys.map((k) => ({ labelKey: `fields.${camelCase(k)}`, value: form[k] ?? "" }));
}

function reviewSections(form: UkForm): WizardReviewSection[] {
  return [
    { titleKey: "review.purpose", editStepKey: "purpose", rows: fieldRows(form, PURPOSE_KEYS) },
    { titleKey: "review.personal", editStepKey: "personal", rows: fieldRows(form, PERSONAL_FIELDS.map((f) => f.key)) },
    { titleKey: "review.passport", editStepKey: "passport", rows: fieldRows(form, PASSPORT_FIELDS.map((f) => f.key)) },
    { titleKey: "review.contact", editStepKey: "contact", rows: fieldRows(form, CONTACT_FIELDS.map((f) => f.key)) },
    { titleKey: "review.ukvi", editStepKey: "ukvi", rows: fieldRows(form, UKVI_FIELDS.map((f) => f.key)) },
    { titleKey: "review.tripDates", editStepKey: "trip_dates", rows: fieldRows(form, TRIP_DATES_KEYS) },
    { titleKey: "review.ukAddress", editStepKey: "uk_address", rows: fieldRows(form, UK_ADDRESS_FIELDS.map((f) => f.key)) },
    { titleKey: "review.employment", editStepKey: "employment", rows: fieldRows(form, EMPLOYMENT_FIELDS.map((f) => f.key)) },
    { titleKey: "review.history", editStepKey: "history", rows: fieldRows(form, HISTORY_FIELDS.map((f) => f.key)) },
    { titleKey: "review.background", editStepKey: "background", rows: fieldRows(form, BACKGROUND_FIELDS.map((f) => f.key)) },
    { titleKey: "review.funding", editStepKey: "funding", rows: fieldRows(form, FUNDING_KEYS) },
    { titleKey: "review.declaration", editStepKey: "declaration", rows: fieldRows(form, DECLARATION_KEYS) },
  ];
}

function buildPayload(form: UkForm): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(form)) {
    if (typeof v === "string" && v.trim() !== "") out[k] = v.trim();
  }
  return out;
}

function genericStep(key: string, fieldsKey: keyof typeof STEP_FIELD_MAP) {
  return {
    key,
    titleKey: `steps.${key}.label`,
    render: ({ form, setForm, onContinue }: { form: UkForm; setForm: (u: (p: UkForm) => UkForm) => void; onContinue: () => void }) =>
      createElement(StepGenericFields, {
        i18nNamespace: NAMESPACE,
        titleKey: `steps.${key}.title`,
        subtitleKey: `steps.${key}.subtitle`,
        fields: STEP_FIELD_MAP[fieldsKey],
        values: form,
        onChange: (next) => setForm(() => next),
        onContinue,
      }),
  };
}

export const ukConfig: WizardConfig<UkForm> = {
  visaType: "UK_STANDARD_VISITOR",
  defaultCountry: "uk",
  defaultVisaType: "UK_STANDARD_VISITOR",
  emptyForm: () => ({}),
  buildAnswerPayload: buildPayload,
  i18nNamespace: NAMESPACE,
  seedAuthEmail: (form, email) => ({ ...form, email_address: form.email_address || email }),
  reviewSections,
  steps: [
    {
      key: "purpose",
      titleKey: "steps.purpose.label",
      render: ({ form, setForm, onContinue }) =>
        createElement(StepPurposeCards, {
          i18nNamespace: NAMESPACE,
          titleKey: "steps.purpose.title",
          subtitleKey: "steps.purpose.subtitle",
          fieldKey: "purpose_of_visit",
          value: form.purpose_of_visit ?? "",
          onChange: (v) => setForm((prev) => ({ ...prev, purpose_of_visit: v })),
          options: PURPOSE_OPTIONS,
          onContinue,
        }),
    },
    genericStep("personal", "personal"),
    genericStep("passport", "passport"),
    genericStep("contact", "contact"),
    genericStep("ukvi", "ukvi"),
    {
      key: "trip_dates",
      titleKey: "steps.tripDates.label",
      render: ({ form, setForm, onContinue }) =>
        createElement(StepTripDates, {
          i18nNamespace: NAMESPACE,
          titleKey: "steps.tripDates.title",
          subtitleKey: "steps.tripDates.subtitle",
          arrivalKey: "intended_arrival_date",
          departureKey: "intended_departure_date",
          entriesKey: "number_of_entries",
          arrivalLabelKey: "fields.arrivalDate",
          departureLabelKey: "fields.departureDate",
          entriesLabelKey: "fields.numberOfEntries",
          entriesOptions: ENTRIES_OPTIONS,
          maxStayDays: UK_VISITOR_MAX_STAY_DAYS,
          maxStayHintKey: "tripDates.over180Hint",
          values: {
            arrival: form.intended_arrival_date ?? "",
            departure: form.intended_departure_date ?? "",
            entries: form.number_of_entries ?? "",
          },
          onChange: (next) =>
            setForm((prev) => ({
              ...prev,
              intended_arrival_date: next.arrival,
              intended_departure_date: next.departure,
              number_of_entries: next.entries ?? prev.number_of_entries ?? "",
            })),
          onContinue,
        }),
    },
    genericStep("uk_address", "uk_address"),
    genericStep("employment", "employment"),
    genericStep("history", "history"),
    genericStep("background", "background"),
    {
      key: "funding",
      titleKey: "steps.funding.label",
      render: ({ form, setForm, onContinue }) =>
        createElement(StepFundingBlock, {
          i18nNamespace: NAMESPACE,
          titleKey: "steps.funding.title",
          subtitleKey: "steps.funding.subtitle",
          sourceKey: "trip_funding_source",
          sourceLabelKey: "fields.fundingSource",
          sourceOptions: FUNDING_SOURCE_OPTIONS,
          sponsorTriggerValues: ["family", "sponsor", "employer"],
          sponsorNameKey: "sponsor_name",
          sponsorRelationshipKey: "sponsor_relationship",
          amountKey: "estimated_trip_cost",
          currencyKey: "trip_cost_currency",
          currencyOptions: CURRENCY_OPTIONS,
          insuranceKey: "has_savings",
          insuranceLabelKey: "fields.hasSavings",
          values: form,
          onChange: (next) => setForm(() => next),
          onContinue,
        }),
    },
    {
      key: "declaration",
      titleKey: "steps.declaration.label",
      render: ({ form, setForm, onContinue }) =>
        createElement(StepYesNoChecklist, {
          i18nNamespace: NAMESPACE,
          titleKey: "steps.declaration.title",
          subtitleKey: "steps.declaration.subtitle",
          items: DECLARATION_ITEMS,
          values: form,
          onChange: (next) => setForm(() => next),
          onContinue,
        }),
    },
  ],
};

import { createElement } from "react";
import { StepGenericFields, type GenericField } from "../shell/shared-steps/step-generic-fields";
import { StepPurposeCards, type PurposeOption } from "../shell/shared-steps/step-purpose-cards";
import { StepTripDates, type EntryOption } from "../shell/shared-steps/step-trip-dates";
import { StepFundingBlock } from "../shell/shared-steps/step-funding-block";
import { StepYesNoChecklist, type ChecklistItem } from "../shell/shared-steps/step-yesno-checklist";
import type { WizardConfig, WizardReviewSection } from "../shell/types";

export type SchengenForm = Record<string, string>;

const NAMESPACE = "simplifiedForm.schengen";
const SCHENGEN_MAX_STAY_DAYS = 90;

// ---------------------------------------------------------------------------
// Field groups (expanded against Annex I of the Visa Code).
// ---------------------------------------------------------------------------

const PERSONAL_FIELDS: GenericField[] = [
  { kind: "text", key: "surname", labelKey: "fields.surname", required: true },
  { kind: "yesno", key: "surname_at_birth_different", labelKey: "fields.surnameAtBirthDifferent" },
  { kind: "text", key: "surname_at_birth", labelKey: "fields.surnameAtBirth" },
  { kind: "text", key: "given_names", labelKey: "fields.givenNames", required: true },
  { kind: "date", key: "date_of_birth", labelKey: "fields.dob" },
  { kind: "text", key: "place_of_birth", labelKey: "fields.placeOfBirth" },
  { kind: "country", key: "country_of_birth", labelKey: "fields.countryOfBirth" },
  { kind: "country", key: "current_nationality", labelKey: "fields.nationality" },
  { kind: "country", key: "nationality_at_birth", labelKey: "fields.nationalityAtBirth" },
  { kind: "text", key: "national_identity_number", labelKey: "fields.nationalIdNumber" },
  { kind: "select", key: "sex", labelKey: "fields.sex", options: [
    { value: "M", labelKey: "options.sex.male" },
    { value: "F", labelKey: "options.sex.female" },
  ] },
  { kind: "select", key: "civil_status", labelKey: "fields.civilStatus", options: [
    { value: "single", labelKey: "options.civil.single" },
    { value: "married", labelKey: "options.civil.married" },
    { value: "registered_partnership", labelKey: "options.civil.registeredPartnership" },
    { value: "separated", labelKey: "options.civil.separated" },
    { value: "divorced", labelKey: "options.civil.divorced" },
    { value: "widowed", labelKey: "options.civil.widowed" },
  ] },
];

const TRAVEL_DOC_FIELDS: GenericField[] = [
  { kind: "select", key: "type_of_travel_document", labelKey: "fields.passportType", options: [
    { value: "ordinary", labelKey: "options.passport.ordinary" },
    { value: "diplomatic", labelKey: "options.passport.diplomatic" },
    { value: "service", labelKey: "options.passport.service" },
    { value: "official", labelKey: "options.passport.official" },
    { value: "special", labelKey: "options.passport.special" },
    { value: "other", labelKey: "options.passport.other" },
  ] },
  { kind: "text", key: "travel_document_number", labelKey: "fields.passportNumber" },
  { kind: "date", key: "date_of_issue", labelKey: "fields.passportIssueDate" },
  { kind: "date", key: "valid_until", labelKey: "fields.passportExpiryDate" },
  { kind: "country", key: "issued_by_country", labelKey: "fields.passportIssuingCountry" },
];

const CONTACT_FIELDS: GenericField[] = [
  { kind: "text", key: "applicants_home_address", labelKey: "fields.homeAddress" },
  { kind: "text", key: "applicants_home_city", labelKey: "fields.city" },
  { kind: "text", key: "applicants_home_postal_code", labelKey: "fields.postalCode" },
  { kind: "country", key: "country_of_residence", labelKey: "fields.countryOfResidence" },
  { kind: "email", key: "applicants_email", labelKey: "fields.email" },
  { kind: "phone", key: "applicants_phone", labelKey: "fields.phone" },
];

// Trip "where" — destination-side details, separate from the dates step.
const TRIP_DESTINATION_FIELDS: GenericField[] = [
  { kind: "country", key: "main_destination", labelKey: "fields.mainDestination" },
  { kind: "country", key: "first_entry_country", labelKey: "fields.firstEntry" },
];

const ACCOMMODATION_FIELDS: GenericField[] = [
  { kind: "select", key: "accommodation_type", labelKey: "fields.accommodationType", options: [
    { value: "hotel", labelKey: "options.accommodation.hotel" },
    { value: "private", labelKey: "options.accommodation.private" },
    { value: "rental", labelKey: "options.accommodation.rental" },
    { value: "other", labelKey: "options.accommodation.other" },
  ] },
  { kind: "text", key: "accommodation_name", labelKey: "fields.accommodationName" },
  { kind: "text", key: "accommodation_address", labelKey: "fields.accommodationAddress" },
  { kind: "text", key: "accommodation_city", labelKey: "fields.accommodationCity" },
  { kind: "country", key: "accommodation_country", labelKey: "fields.accommodationCountry" },
  { kind: "phone", key: "accommodation_phone", labelKey: "fields.accommodationPhone" },
];

const OCCUPATION_FIELDS: GenericField[] = [
  { kind: "text", key: "current_occupation", labelKey: "fields.occupation" },
  { kind: "text", key: "employer_name", labelKey: "fields.employerName" },
  { kind: "text", key: "employer_address", labelKey: "fields.employerAddress" },
  { kind: "phone", key: "employer_phone", labelKey: "fields.employerPhone" },
];

const FAMILY_EU_FIELDS: GenericField[] = [
  { kind: "yesno", key: "is_family_member_of_eu", labelKey: "fields.isFamilyMemberOfEu" },
  { kind: "text", key: "eu_family_member_surname", labelKey: "fields.euFamilySurname" },
  { kind: "text", key: "eu_family_member_given_names", labelKey: "fields.euFamilyGivenNames" },
  { kind: "date", key: "eu_family_member_dob", labelKey: "fields.euFamilyDob" },
  { kind: "country", key: "eu_family_member_nationality", labelKey: "fields.euFamilyNationality" },
  { kind: "select", key: "eu_family_member_relationship", labelKey: "fields.euFamilyRelationship", options: [
    { value: "spouse", labelKey: "options.relationship.spouse" },
    { value: "child", labelKey: "options.relationship.child" },
    { value: "grandchild", labelKey: "options.relationship.grandchild" },
    { value: "dependent_ascendant", labelKey: "options.relationship.dependentAscendant" },
    { value: "registered_partner", labelKey: "options.relationship.registeredPartner" },
  ] },
];

const TRAVEL_HISTORY_FIELDS: GenericField[] = [
  { kind: "yesno", key: "had_previous_schengen_visas", labelKey: "fields.hadPreviousSchengenVisas" },
  { kind: "text", key: "previous_schengen_visa_dates", labelKey: "fields.previousSchengenVisaDates" },
  { kind: "yesno", key: "fingerprints_collected_previously", labelKey: "fields.fingerprintsCollectedPreviously" },
  { kind: "date", key: "fingerprints_collected_date", labelKey: "fields.fingerprintsCollectedDate" },
  { kind: "yesno", key: "destination_country_entry_permit", labelKey: "fields.hasOnwardEntryPermit" },
];

// Bespoke step inputs ---------------------------------------------------------

const PURPOSE_OPTIONS: PurposeOption[] = [
  { value: "tourism", labelKey: "options.purpose.tourism", descriptionKey: "options.purposeDesc.tourism" },
  { value: "business", labelKey: "options.purpose.business", descriptionKey: "options.purposeDesc.business" },
  { value: "visiting_family_friends", labelKey: "options.purpose.family", descriptionKey: "options.purposeDesc.family" },
  { value: "cultural", labelKey: "options.purpose.cultural", descriptionKey: "options.purposeDesc.cultural" },
  { value: "sports", labelKey: "options.purpose.sports", descriptionKey: "options.purposeDesc.sports" },
  { value: "official_visit", labelKey: "options.purpose.official", descriptionKey: "options.purposeDesc.official" },
  { value: "medical", labelKey: "options.purpose.medical", descriptionKey: "options.purposeDesc.medical" },
  { value: "study", labelKey: "options.purpose.study", descriptionKey: "options.purposeDesc.study" },
  { value: "airport_transit", labelKey: "options.purpose.transit", descriptionKey: "options.purposeDesc.transit" },
  { value: "other", labelKey: "options.purpose.other", descriptionKey: "options.purposeDesc.other" },
];

const ENTRIES_OPTIONS: EntryOption[] = [
  { value: "single", labelKey: "options.entries.single" },
  { value: "two", labelKey: "options.entries.two" },
  { value: "multiple", labelKey: "options.entries.multiple" },
];

const FUNDING_SOURCE_OPTIONS = [
  { value: "self", labelKey: "options.funding.self" },
  { value: "sponsor", labelKey: "options.funding.sponsor" },
  { value: "employer", labelKey: "options.funding.employer" },
  { value: "both", labelKey: "options.funding.both" },
];

const CURRENCY_OPTIONS = [
  { value: "EUR", labelKey: "options.currency.eur" },
  { value: "USD", labelKey: "options.currency.usd" },
  { value: "GBP", labelKey: "options.currency.gbp" },
  { value: "CNY", labelKey: "options.currency.cny" },
];

const DECLARATION_ITEMS: ChecklistItem[] = [
  { key: "decl_information_correct", labelKey: "declarations.informationCorrect" },
  { key: "decl_will_leave_before_visa_expires", labelKey: "declarations.willLeaveBeforeExpiry" },
  { key: "decl_understands_visa_does_not_guarantee_entry", labelKey: "declarations.understandsNoEntryGuarantee" },
  { key: "decl_aware_of_data_processing", labelKey: "declarations.awareDataProcessing" },
];

// Tracked field-key lists (used by review/payload). These mirror the visible
// fields the bespoke steps drive — keep in sync if you add/remove a field.
const TRIP_DATES_KEYS = [
  "intended_date_of_arrival",
  "intended_date_of_departure",
  "number_of_entries",
];
const FUNDING_KEYS = [
  "cost_covered_by",
  "sponsor_name",
  "sponsor_relationship",
  "funds_amount",
  "funds_currency",
  "has_travel_medical_insurance",
];
const PURPOSE_KEYS = ["purpose_of_journey"];
const DECLARATION_KEYS = DECLARATION_ITEMS.map((i) => i.key);

// ---------------------------------------------------------------------------
// Step factory.
// ---------------------------------------------------------------------------

const STEP_FIELD_MAP: Record<string, GenericField[]> = {
  personal: PERSONAL_FIELDS,
  document: TRAVEL_DOC_FIELDS,
  contact: CONTACT_FIELDS,
  trip_destination: TRIP_DESTINATION_FIELDS,
  accommodation: ACCOMMODATION_FIELDS,
  occupation: OCCUPATION_FIELDS,
  family_eu: FAMILY_EU_FIELDS,
  travel_history: TRAVEL_HISTORY_FIELDS,
};

function genericStep(key: string, fieldsKey: keyof typeof STEP_FIELD_MAP) {
  return {
    key,
    titleKey: `steps.${key}.label`,
    render: ({ form, setForm, onContinue }: { form: SchengenForm; setForm: (u: (p: SchengenForm) => SchengenForm) => void; onContinue: () => void }) =>
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

// ---------------------------------------------------------------------------
// Review.
// ---------------------------------------------------------------------------

function camelCase(s: string): string {
  return s.replace(/_(.)/g, (_, c) => c.toUpperCase());
}

function fieldRows(form: SchengenForm, keys: string[]): WizardReviewSection["rows"] {
  return keys.map((k) => ({ labelKey: `fields.${camelCase(k)}`, value: form[k] ?? "" }));
}

function reviewSections(form: SchengenForm): WizardReviewSection[] {
  return [
    { titleKey: "review.purpose", editStepKey: "purpose", rows: fieldRows(form, PURPOSE_KEYS) },
    { titleKey: "review.personal", editStepKey: "personal", rows: fieldRows(form, PERSONAL_FIELDS.map((f) => f.key)) },
    { titleKey: "review.document", editStepKey: "document", rows: fieldRows(form, TRAVEL_DOC_FIELDS.map((f) => f.key)) },
    { titleKey: "review.contact", editStepKey: "contact", rows: fieldRows(form, CONTACT_FIELDS.map((f) => f.key)) },
    { titleKey: "review.tripDates", editStepKey: "trip_dates", rows: fieldRows(form, TRIP_DATES_KEYS) },
    { titleKey: "review.tripDestination", editStepKey: "trip_destination", rows: fieldRows(form, TRIP_DESTINATION_FIELDS.map((f) => f.key)) },
    { titleKey: "review.accommodation", editStepKey: "accommodation", rows: fieldRows(form, ACCOMMODATION_FIELDS.map((f) => f.key)) },
    { titleKey: "review.occupation", editStepKey: "occupation", rows: fieldRows(form, OCCUPATION_FIELDS.map((f) => f.key)) },
    { titleKey: "review.familyEu", editStepKey: "family_eu", rows: fieldRows(form, FAMILY_EU_FIELDS.map((f) => f.key)) },
    { titleKey: "review.travelHistory", editStepKey: "travel_history", rows: fieldRows(form, TRAVEL_HISTORY_FIELDS.map((f) => f.key)) },
    { titleKey: "review.funding", editStepKey: "funding", rows: fieldRows(form, FUNDING_KEYS) },
    { titleKey: "review.declaration", editStepKey: "declaration", rows: fieldRows(form, DECLARATION_KEYS) },
  ];
}

function buildPayload(form: SchengenForm): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(form)) if (typeof v === "string" && v.trim() !== "") out[k] = v.trim();
  return out;
}

// ---------------------------------------------------------------------------
// Wizard config.
// ---------------------------------------------------------------------------

export const schengenConfig: WizardConfig<SchengenForm> = {
  visaType: "EU_SCHENGEN_C_SHORT_STAY",
  defaultCountry: "schengen",
  defaultVisaType: "EU_SCHENGEN_C_SHORT_STAY",
  emptyForm: () => ({}),
  buildAnswerPayload: buildPayload,
  i18nNamespace: NAMESPACE,
  seedAuthEmail: (form, email) => ({ ...form, applicants_email: form.applicants_email || email }),
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
          fieldKey: "purpose_of_journey",
          value: form.purpose_of_journey ?? "",
          onChange: (v) => setForm((prev) => ({ ...prev, purpose_of_journey: v })),
          options: PURPOSE_OPTIONS,
          onContinue,
        }),
    },
    genericStep("personal", "personal"),
    genericStep("document", "document"),
    genericStep("contact", "contact"),
    {
      key: "trip_dates",
      titleKey: "steps.tripDates.label",
      render: ({ form, setForm, onContinue }) =>
        createElement(StepTripDates, {
          i18nNamespace: NAMESPACE,
          titleKey: "steps.tripDates.title",
          subtitleKey: "steps.tripDates.subtitle",
          arrivalKey: "intended_date_of_arrival",
          departureKey: "intended_date_of_departure",
          entriesKey: "number_of_entries",
          arrivalLabelKey: "fields.arrivalDate",
          departureLabelKey: "fields.departureDate",
          entriesLabelKey: "fields.numberOfEntries",
          entriesOptions: ENTRIES_OPTIONS,
          maxStayDays: SCHENGEN_MAX_STAY_DAYS,
          maxStayHintKey: "tripDates.over90Hint",
          values: {
            arrival: form.intended_date_of_arrival ?? "",
            departure: form.intended_date_of_departure ?? "",
            entries: form.number_of_entries ?? "",
          },
          onChange: (next) =>
            setForm((prev) => ({
              ...prev,
              intended_date_of_arrival: next.arrival,
              intended_date_of_departure: next.departure,
              number_of_entries: next.entries ?? prev.number_of_entries ?? "",
            })),
          onContinue,
        }),
    },
    genericStep("trip_destination", "trip_destination"),
    genericStep("accommodation", "accommodation"),
    genericStep("occupation", "occupation"),
    genericStep("family_eu", "family_eu"),
    genericStep("travel_history", "travel_history"),
    {
      key: "funding",
      titleKey: "steps.funding.label",
      render: ({ form, setForm, onContinue }) =>
        createElement(StepFundingBlock, {
          i18nNamespace: NAMESPACE,
          titleKey: "steps.funding.title",
          subtitleKey: "steps.funding.subtitle",
          sourceKey: "cost_covered_by",
          sourceLabelKey: "fields.costsCoveredBy",
          sourceOptions: FUNDING_SOURCE_OPTIONS,
          sponsorTriggerValues: ["sponsor", "both"],
          sponsorNameKey: "sponsor_name",
          sponsorRelationshipKey: "sponsor_relationship",
          amountKey: "funds_amount",
          currencyKey: "funds_currency",
          currencyOptions: CURRENCY_OPTIONS,
          insuranceKey: "has_travel_medical_insurance",
          insuranceLabelKey: "fields.hasInsurance",
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

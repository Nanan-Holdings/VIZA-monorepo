import { createElement } from "react";
import { StepGenericFields, type GenericField } from "../shell/shared-steps/step-generic-fields";
import { StepPurposeCards, type PurposeOption } from "../shell/shared-steps/step-purpose-cards";
import { StepTripDates } from "../shell/shared-steps/step-trip-dates";
import { StepFundingBlock } from "../shell/shared-steps/step-funding-block";
import { StepYesNoChecklist, type ChecklistItem } from "../shell/shared-steps/step-yesno-checklist";
import type { WizardConfig, WizardReviewSection } from "../shell/types";

export type AuForm = Record<string, string>;

const NAMESPACE = "simplifiedForm.au";
// Subclass 600 streams cap at 12 months in Australia per visit (most streams
// are limited to 3 / 6 / 12 months depending on purpose). Use 365 as the
// safe headline.
const AU_VISITOR_MAX_STAY_DAYS = 365;

// ---------------------------------------------------------------------------
// Field groups (expanded against the live VSS-AP-600 form walk + 216-field
// seed). The seed remains the source of truth — these are the high-signal
// fields surfaced in the simplified intake.
// ---------------------------------------------------------------------------

const PERSONAL_FIELDS: GenericField[] = [
  { kind: "text", key: "given_names", labelKey: "fields.givenNames", required: true },
  { kind: "text", key: "family_name", labelKey: "fields.familyName", required: true },
  { kind: "yesno", key: "any_other_names", labelKey: "fields.anyOtherNames" },
  { kind: "text", key: "other_names", labelKey: "fields.otherNames" },
  { kind: "date", key: "date_of_birth", labelKey: "fields.dob" },
  { kind: "select", key: "sex", labelKey: "fields.sex", options: [
    { value: "male", labelKey: "options.sex.male" },
    { value: "female", labelKey: "options.sex.female" },
    { value: "indeterminate", labelKey: "options.sex.indeterminate" },
  ] },
  { kind: "country", key: "country_of_nationality", labelKey: "fields.nationality" },
  { kind: "country", key: "country_of_birth", labelKey: "fields.countryOfBirth" },
  { kind: "text", key: "town_or_city_of_birth", labelKey: "fields.placeOfBirth" },
  { kind: "select", key: "relationship_status", labelKey: "fields.relationshipStatus", options: [
    { value: "never_married", labelKey: "options.rel.never" },
    { value: "married", labelKey: "options.rel.married" },
    { value: "de_facto", labelKey: "options.rel.deFacto" },
    { value: "engaged", labelKey: "options.rel.engaged" },
    { value: "separated", labelKey: "options.rel.separated" },
    { value: "divorced", labelKey: "options.rel.divorced" },
    { value: "widowed", labelKey: "options.rel.widowed" },
  ] },
  // Live-portal additions (2026-04-27 walk).
  { kind: "yesno", key: "has_national_id", labelKey: "fields.hasNationalId" },
  { kind: "text", key: "national_id_number", labelKey: "fields.nationalIdNumber" },
  { kind: "yesno", key: "pacific_australia_card_holder", labelKey: "fields.pacificAustraliaCardHolder" },
];

const PASSPORT_FIELDS: GenericField[] = [
  { kind: "text", key: "passport_number", labelKey: "fields.passportNumber" },
  { kind: "country", key: "passport_country_of_issue", labelKey: "fields.passportIssuing" },
  { kind: "date", key: "passport_date_of_issue", labelKey: "fields.passportIssueDate" },
  { kind: "date", key: "passport_date_of_expiry", labelKey: "fields.passportExpiryDate" },
  { kind: "text", key: "passport_place_of_issue", labelKey: "fields.passportPlaceOfIssue" },
  { kind: "text", key: "chinese_commercial_code_number", labelKey: "fields.chineseCommercialCodeNumber" },
];

const CONTACT_FIELDS: GenericField[] = [
  { kind: "email", key: "email_address", labelKey: "fields.email" },
  { kind: "phone", key: "telephone_mobile", labelKey: "fields.phoneMobile" },
  { kind: "phone", key: "telephone_home", labelKey: "fields.phoneHome" },
  { kind: "phone", key: "telephone_business", labelKey: "fields.phoneBusiness" },
  { kind: "text", key: "residential_address_line1", labelKey: "fields.residentialAddress" },
  { kind: "text", key: "residential_address_city", labelKey: "fields.city" },
  { kind: "text", key: "residential_address_postcode", labelKey: "fields.postcode" },
  { kind: "country", key: "residential_address_country", labelKey: "fields.country" },
];

// Application context (added from page-2 of the live ImmiAccount walk).
const APPLICATION_CONTEXT_FIELDS: GenericField[] = [
  { kind: "yesno", key: "applying_all_outside_australia", labelKey: "fields.applyingAllOutside" },
  { kind: "select", key: "current_location_legal_status", labelKey: "fields.currentLocationLegalStatus", options: [
    { value: "citizen", labelKey: "options.locStatus.citizen" },
    { value: "permanent_resident", labelKey: "options.locStatus.pr" },
    { value: "temporary_visa", labelKey: "options.locStatus.temporary" },
    { value: "visitor", labelKey: "options.locStatus.visitor" },
    { value: "other", labelKey: "options.locStatus.other" },
  ] },
  { kind: "select", key: "purpose_of_stay_initial", labelKey: "fields.purposeOfStayInitial", options: [
    { value: "business", labelKey: "options.initial.business" },
    { value: "tourism", labelKey: "options.initial.tourism" },
    { value: "family_visit", labelKey: "options.initial.family" },
    { value: "study", labelKey: "options.initial.study" },
    { value: "religious", labelKey: "options.initial.religious" },
    { value: "other", labelKey: "options.initial.other" },
  ] },
  { kind: "textarea", key: "significant_dates_in_australia", labelKey: "fields.significantDatesInAustralia" },
  { kind: "yesno", key: "event_invited_by_organisation", labelKey: "fields.eventInvitedByOrganisation" },
  { kind: "yesno", key: "event_paid_by_australian_organisation", labelKey: "fields.eventPaidByAustralianOrganisation" },
  { kind: "yesno", key: "applying_as_part_of_group_of_applications", labelKey: "fields.applyingAsPartOfGroup" },
];

const VISIT_FIELDS: GenericField[] = [
  { kind: "text", key: "main_reason_for_visit", labelKey: "fields.mainReason" },
  { kind: "select", key: "port_of_arrival", labelKey: "fields.portOfArrival", options: [
    { value: "sydney", labelKey: "options.port.sydney" },
    { value: "melbourne", labelKey: "options.port.melbourne" },
    { value: "brisbane", labelKey: "options.port.brisbane" },
    { value: "perth", labelKey: "options.port.perth" },
    { value: "adelaide", labelKey: "options.port.adelaide" },
    { value: "gold_coast", labelKey: "options.port.goldCoast" },
    { value: "cairns", labelKey: "options.port.cairns" },
    { value: "darwin", labelKey: "options.port.darwin" },
    { value: "hobart", labelKey: "options.port.hobart" },
    { value: "other", labelKey: "options.port.other" },
  ] },
  { kind: "yesno", key: "previously_travelled_to_australia", labelKey: "fields.previousAuTravel" },
  { kind: "text", key: "previous_au_visa_grant_dates", labelKey: "fields.previousAuVisaGrantDates" },
];

const COMPANIONS_FIELDS: GenericField[] = [
  { kind: "yesno", key: "has_accompanying_family", labelKey: "fields.hasAccompanyingFamily" },
  { kind: "text", key: "accompanying_family_count", labelKey: "fields.accompanyingFamilyCount" },
  { kind: "yesno", key: "has_non_accompanying_family", labelKey: "fields.hasNonAccompanyingFamily" },
];

// Bespoke step inputs ---------------------------------------------------------

const STREAM_OPTIONS: PurposeOption[] = [
  { value: "tourist", labelKey: "options.stream.tourist", descriptionKey: "options.streamDesc.tourist" },
  { value: "business_visitor", labelKey: "options.stream.business", descriptionKey: "options.streamDesc.business" },
  { value: "sponsored_family", labelKey: "options.stream.sponsored", descriptionKey: "options.streamDesc.sponsored" },
  { value: "frequent_traveller", labelKey: "options.stream.frequent", descriptionKey: "options.streamDesc.frequent" },
];

const FUNDING_SOURCE_OPTIONS = [
  { value: "self", labelKey: "options.funding.self" },
  { value: "family", labelKey: "options.funding.family" },
  { value: "employer", labelKey: "options.funding.employer" },
  { value: "sponsor", labelKey: "options.funding.sponsor" },
];

const CURRENCY_OPTIONS = [
  { value: "AUD", labelKey: "options.currency.aud" },
  { value: "USD", labelKey: "options.currency.usd" },
  { value: "EUR", labelKey: "options.currency.eur" },
  { value: "GBP", labelKey: "options.currency.gbp" },
  { value: "CNY", labelKey: "options.currency.cny" },
];

// Health declarations — derived from the live page-16 walk (7 questions).
const HEALTH_ITEMS: ChecklistItem[] = [
  { key: "decl_health_lived_outside_passport_country", labelKey: "declarations.healthLivedOutsidePassport", explainOnYes: true },
  { key: "decl_health_visited_health_facility", labelKey: "declarations.healthVisitedFacility", explainOnYes: true },
  { key: "decl_health_healthcare_worker", labelKey: "declarations.healthHealthcareWorker", explainOnYes: true },
  { key: "decl_health_aged_or_childcare", labelKey: "declarations.healthAgedOrChildcare", explainOnYes: true },
  { key: "decl_health_classroom_3plus_months", labelKey: "declarations.healthClassroom3Months", explainOnYes: true },
  { key: "decl_health_tb_or_chest_xray", labelKey: "declarations.healthTbOrChestXray", explainOnYes: true },
  { key: "has_health_insurance", labelKey: "declarations.hasHealthInsurance" },
];

// Character declarations — subset of the 18 live questions on page 17.
const CHARACTER_ITEMS: ChecklistItem[] = [
  { key: "decl_char_criminal_convictions", labelKey: "declarations.charCriminalConvictions", explainOnYes: true },
  { key: "decl_char_war_crimes", labelKey: "declarations.charWarCrimes", explainOnYes: true },
  { key: "decl_char_sexual_offence", labelKey: "declarations.charSexualOffence", explainOnYes: true },
  { key: "decl_char_terrorism", labelKey: "declarations.charTerrorism", explainOnYes: true },
  { key: "decl_char_people_smuggling", labelKey: "declarations.charPeopleSmuggling", explainOnYes: true },
  { key: "decl_char_military_training", labelKey: "declarations.charMilitaryTraining", explainOnYes: true },
  { key: "decl_char_visa_refused", labelKey: "declarations.charVisaRefused", explainOnYes: true },
];

// Final attestations — page-20 in the live walk has 16; we surface the
// most consequential 5 here.
const DECLARATION_ITEMS: ChecklistItem[] = [
  { key: "decl_information_correct", labelKey: "declarations.informationCorrect" },
  { key: "decl_understands_visa_does_not_guarantee_entry", labelKey: "declarations.understandsNoEntryGuarantee" },
  { key: "decl_aware_of_data_processing", labelKey: "declarations.awareDataProcessing" },
  { key: "decl_will_leave_before_visa_expires", labelKey: "declarations.willLeaveBeforeExpiry" },
  { key: "decl_genuine_visitor", labelKey: "declarations.genuineVisitor" },
];

const STREAM_KEYS = ["stream"];
const TRIP_DATES_KEYS = ["intended_arrival_date", "intended_departure_date"];
const FUNDING_KEYS = [
  "funding_source",
  "sponsor_name",
  "sponsor_relationship",
  "funds_amount",
  "funds_currency",
];
const HEALTH_KEYS = HEALTH_ITEMS.map((i) => i.key);
const CHARACTER_KEYS = CHARACTER_ITEMS.map((i) => i.key);
const DECLARATION_KEYS = DECLARATION_ITEMS.map((i) => i.key);

// ---------------------------------------------------------------------------

const STEP_FIELD_MAP: Record<string, GenericField[]> = {
  personal: PERSONAL_FIELDS,
  passport: PASSPORT_FIELDS,
  contact: CONTACT_FIELDS,
  application_context: APPLICATION_CONTEXT_FIELDS,
  visit: VISIT_FIELDS,
  companions: COMPANIONS_FIELDS,
};

function camelCase(s: string): string {
  return s.replace(/_(.)/g, (_, c) => c.toUpperCase());
}

function fieldRows(form: AuForm, keys: string[]): WizardReviewSection["rows"] {
  return keys.map((k) => ({ labelKey: `fields.${camelCase(k)}`, value: form[k] ?? "" }));
}

function reviewSections(form: AuForm): WizardReviewSection[] {
  return [
    { titleKey: "review.stream", editStepKey: "stream", rows: fieldRows(form, STREAM_KEYS) },
    { titleKey: "review.personal", editStepKey: "personal", rows: fieldRows(form, PERSONAL_FIELDS.map((f) => f.key)) },
    { titleKey: "review.passport", editStepKey: "passport", rows: fieldRows(form, PASSPORT_FIELDS.map((f) => f.key)) },
    { titleKey: "review.contact", editStepKey: "contact", rows: fieldRows(form, CONTACT_FIELDS.map((f) => f.key)) },
    { titleKey: "review.applicationContext", editStepKey: "application_context", rows: fieldRows(form, APPLICATION_CONTEXT_FIELDS.map((f) => f.key)) },
    { titleKey: "review.tripDates", editStepKey: "trip_dates", rows: fieldRows(form, TRIP_DATES_KEYS) },
    { titleKey: "review.visit", editStepKey: "visit", rows: fieldRows(form, VISIT_FIELDS.map((f) => f.key)) },
    { titleKey: "review.companions", editStepKey: "companions", rows: fieldRows(form, COMPANIONS_FIELDS.map((f) => f.key)) },
    { titleKey: "review.funding", editStepKey: "funding", rows: fieldRows(form, FUNDING_KEYS) },
    { titleKey: "review.health", editStepKey: "health", rows: fieldRows(form, HEALTH_KEYS) },
    { titleKey: "review.character", editStepKey: "character", rows: fieldRows(form, CHARACTER_KEYS) },
    { titleKey: "review.declaration", editStepKey: "declaration", rows: fieldRows(form, DECLARATION_KEYS) },
  ];
}

function buildPayload(form: AuForm): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(form)) if (typeof v === "string" && v.trim() !== "") out[k] = v.trim();
  return out;
}

function genericStep(key: string, fieldsKey: keyof typeof STEP_FIELD_MAP) {
  return {
    key,
    titleKey: `steps.${key}.label`,
    render: ({ form, setForm, onContinue }: { form: AuForm; setForm: (u: (p: AuForm) => AuForm) => void; onContinue: () => void }) =>
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

export const auConfig: WizardConfig<AuForm> = {
  visaType: "AU_VISITOR_600",
  defaultCountry: "australia",
  defaultVisaType: "AU_VISITOR_600",
  emptyForm: () => ({}),
  buildAnswerPayload: buildPayload,
  i18nNamespace: NAMESPACE,
  seedAuthEmail: (form, email) => ({ ...form, email_address: form.email_address || email }),
  reviewSections,
  steps: [
    {
      key: "stream",
      titleKey: "steps.stream.label",
      render: ({ form, setForm, onContinue }) =>
        createElement(StepPurposeCards, {
          i18nNamespace: NAMESPACE,
          titleKey: "steps.stream.title",
          subtitleKey: "steps.stream.subtitle",
          fieldKey: "stream",
          value: form.stream ?? "",
          onChange: (v) => setForm((prev) => ({ ...prev, stream: v })),
          options: STREAM_OPTIONS,
          onContinue,
        }),
    },
    genericStep("personal", "personal"),
    genericStep("passport", "passport"),
    genericStep("contact", "contact"),
    genericStep("application_context", "application_context"),
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
          arrivalLabelKey: "fields.arrivalDate",
          departureLabelKey: "fields.departureDate",
          maxStayDays: AU_VISITOR_MAX_STAY_DAYS,
          maxStayHintKey: "tripDates.over12mHint",
          values: {
            arrival: form.intended_arrival_date ?? "",
            departure: form.intended_departure_date ?? "",
          },
          onChange: (next) =>
            setForm((prev) => ({
              ...prev,
              intended_arrival_date: next.arrival,
              intended_departure_date: next.departure,
            })),
          onContinue,
        }),
    },
    genericStep("visit", "visit"),
    genericStep("companions", "companions"),
    {
      key: "funding",
      titleKey: "steps.funding.label",
      render: ({ form, setForm, onContinue }) =>
        createElement(StepFundingBlock, {
          i18nNamespace: NAMESPACE,
          titleKey: "steps.funding.title",
          subtitleKey: "steps.funding.subtitle",
          sourceKey: "funding_source",
          sourceLabelKey: "fields.fundingSource",
          sourceOptions: FUNDING_SOURCE_OPTIONS,
          sponsorTriggerValues: ["family", "sponsor", "employer"],
          sponsorNameKey: "sponsor_name",
          sponsorRelationshipKey: "sponsor_relationship",
          amountKey: "funds_amount",
          currencyKey: "funds_currency",
          currencyOptions: CURRENCY_OPTIONS,
          values: form,
          onChange: (next) => setForm(() => next),
          onContinue,
        }),
    },
    {
      key: "health",
      titleKey: "steps.health.label",
      render: ({ form, setForm, onContinue }) =>
        createElement(StepYesNoChecklist, {
          i18nNamespace: NAMESPACE,
          titleKey: "steps.health.title",
          subtitleKey: "steps.health.subtitle",
          items: HEALTH_ITEMS,
          values: form,
          onChange: (next) => setForm(() => next),
          onContinue,
        }),
    },
    {
      key: "character",
      titleKey: "steps.character.label",
      render: ({ form, setForm, onContinue }) =>
        createElement(StepYesNoChecklist, {
          i18nNamespace: NAMESPACE,
          titleKey: "steps.character.title",
          subtitleKey: "steps.character.subtitle",
          items: CHARACTER_ITEMS,
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

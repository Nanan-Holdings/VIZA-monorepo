import { createElement } from "react";
import { StepGenericFields, type GenericField } from "../shell/shared-steps/step-generic-fields";
import type { WizardConfig, WizardReviewSection } from "../shell/types";

export type AuForm = Record<string, string>;

const NAMESPACE = "simplifiedForm.au";

const STREAM_FIELDS: GenericField[] = [
  { kind: "select", key: "stream", labelKey: "fields.stream", options: [
    { value: "tourist", labelKey: "options.stream.tourist" },
    { value: "business_visitor", labelKey: "options.stream.business" },
    { value: "sponsored_family", labelKey: "options.stream.sponsored" },
    { value: "ads", labelKey: "options.stream.ads" },
    { value: "frequent_traveller", labelKey: "options.stream.frequent" },
  ] },
];

const PERSONAL_FIELDS: GenericField[] = [
  { kind: "text", key: "given_names", labelKey: "fields.givenNames", required: true },
  { kind: "text", key: "family_name", labelKey: "fields.familyName", required: true },
  { kind: "date", key: "date_of_birth", labelKey: "fields.dob" },
  { kind: "select", key: "sex", labelKey: "fields.sex", options: [
    { value: "male", labelKey: "options.sex.male" },
    { value: "female", labelKey: "options.sex.female" },
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
];

const PASSPORT_FIELDS: GenericField[] = [
  { kind: "text", key: "passport_number", labelKey: "fields.passportNumber" },
  { kind: "country", key: "passport_country_of_issue", labelKey: "fields.passportIssuing" },
  { kind: "date", key: "passport_date_of_issue", labelKey: "fields.passportIssueDate" },
  { kind: "date", key: "passport_date_of_expiry", labelKey: "fields.passportExpiryDate" },
  { kind: "text", key: "passport_place_of_issue", labelKey: "fields.passportPlaceOfIssue" },
];

const CONTACT_FIELDS: GenericField[] = [
  { kind: "email", key: "email_address", labelKey: "fields.email" },
  { kind: "phone", key: "telephone_number", labelKey: "fields.phone" },
  { kind: "text", key: "residential_address_line1", labelKey: "fields.residentialAddress" },
  { kind: "text", key: "residential_address_city", labelKey: "fields.city" },
  { kind: "country", key: "residential_address_country", labelKey: "fields.country" },
];

const VISIT_FIELDS: GenericField[] = [
  { kind: "date", key: "intended_arrival_date", labelKey: "fields.arrivalDate" },
  { kind: "date", key: "intended_departure_date", labelKey: "fields.departureDate" },
  { kind: "text", key: "main_reason_for_visit", labelKey: "fields.mainReason" },
  { kind: "select", key: "port_of_arrival", labelKey: "fields.portOfArrival", options: [
    { value: "sydney", labelKey: "options.port.sydney" },
    { value: "melbourne", labelKey: "options.port.melbourne" },
    { value: "brisbane", labelKey: "options.port.brisbane" },
    { value: "perth", labelKey: "options.port.perth" },
    { value: "adelaide", labelKey: "options.port.adelaide" },
    { value: "other", labelKey: "options.port.other" },
  ] },
  { kind: "yesno", key: "previously_travelled_to_australia", labelKey: "fields.previousAuTravel" },
];

const FUNDING_FIELDS: GenericField[] = [
  { kind: "select", key: "funding_source", labelKey: "fields.fundingSource", options: [
    { value: "self", labelKey: "options.funding.self" },
    { value: "family", labelKey: "options.funding.family" },
    { value: "employer", labelKey: "options.funding.employer" },
    { value: "sponsor", labelKey: "options.funding.sponsor" },
    { value: "other", labelKey: "options.funding.other" },
  ] },
  { kind: "text", key: "funds_amount", labelKey: "fields.fundsAmount" },
  { kind: "select", key: "funds_currency", labelKey: "fields.fundsCurrency", options: [
    { value: "AUD", labelKey: "options.currency.aud" },
    { value: "USD", labelKey: "options.currency.usd" },
    { value: "EUR", labelKey: "options.currency.eur" },
    { value: "GBP", labelKey: "options.currency.gbp" },
    { value: "CNY", labelKey: "options.currency.cny" },
  ] },
];

const HEALTH_FIELDS: GenericField[] = [
  { kind: "yesno", key: "has_health_insurance", labelKey: "fields.hasHealthInsurance" },
  { kind: "text", key: "health_insurance_provider", labelKey: "fields.insuranceProvider" },
];

const CHARACTER_FIELDS: GenericField[] = [
  { kind: "yesno", key: "has_criminal_convictions", labelKey: "fields.hasCriminalConvictions" },
  { kind: "yesno", key: "has_been_refused_visa", labelKey: "fields.hasBeenRefusedVisa" },
  { kind: "yesno", key: "has_served_in_military", labelKey: "fields.hasServedMilitary" },
];

const STEP_FIELD_MAP: Record<string, GenericField[]> = {
  stream: STREAM_FIELDS,
  personal: PERSONAL_FIELDS,
  passport: PASSPORT_FIELDS,
  contact: CONTACT_FIELDS,
  visit: VISIT_FIELDS,
  funding: FUNDING_FIELDS,
  health: HEALTH_FIELDS,
  character: CHARACTER_FIELDS,
};

function camelCase(s: string): string {
  return s.replace(/_(.)/g, (_, c) => c.toUpperCase());
}

function fieldRows(form: AuForm, keys: string[]): WizardReviewSection["rows"] {
  return keys.map((k) => ({ labelKey: `fields.${camelCase(k)}`, value: form[k] ?? "" }));
}

function reviewSections(form: AuForm): WizardReviewSection[] {
  return [
    { titleKey: "review.stream", editStepKey: "stream", rows: fieldRows(form, STREAM_FIELDS.map((f) => f.key)) },
    { titleKey: "review.personal", editStepKey: "personal", rows: fieldRows(form, PERSONAL_FIELDS.map((f) => f.key)) },
    { titleKey: "review.passport", editStepKey: "passport", rows: fieldRows(form, PASSPORT_FIELDS.map((f) => f.key)) },
    { titleKey: "review.contact", editStepKey: "contact", rows: fieldRows(form, CONTACT_FIELDS.map((f) => f.key)) },
    { titleKey: "review.visit", editStepKey: "visit", rows: fieldRows(form, VISIT_FIELDS.map((f) => f.key)) },
    { titleKey: "review.funding", editStepKey: "funding", rows: fieldRows(form, FUNDING_FIELDS.map((f) => f.key)) },
    { titleKey: "review.health", editStepKey: "health", rows: fieldRows(form, HEALTH_FIELDS.map((f) => f.key)) },
    { titleKey: "review.character", editStepKey: "character", rows: fieldRows(form, CHARACTER_FIELDS.map((f) => f.key)) },
  ];
}

function buildPayload(form: AuForm): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(form)) if (typeof v === "string" && v.trim() !== "") out[k] = v.trim();
  return out;
}

function step(key: string, fieldsKey: keyof typeof STEP_FIELD_MAP) {
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
    step("stream", "stream"),
    step("personal", "personal"),
    step("passport", "passport"),
    step("contact", "contact"),
    step("visit", "visit"),
    step("funding", "funding"),
    step("health", "health"),
    step("character", "character"),
  ],
};

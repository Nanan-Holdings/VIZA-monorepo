import { createElement } from "react";
import { StepGenericFields, type GenericField } from "../shell/shared-steps/step-generic-fields";
import type { WizardConfig, WizardReviewSection } from "../shell/types";

export type VnForm = Record<string, string>;

const NAMESPACE = "simplifiedForm.vn";

const PERSONAL_FIELDS: GenericField[] = [
  { kind: "text", key: "surname", labelKey: "fields.surname", required: true },
  { kind: "text", key: "given_name", labelKey: "fields.givenName", required: true },
  { kind: "date", key: "date_of_birth", labelKey: "fields.dob" },
  { kind: "select", key: "sex", labelKey: "fields.sex", options: [
    { value: "Male", labelKey: "options.sex.male" },
    { value: "Female", labelKey: "options.sex.female" },
  ] },
  { kind: "country", key: "nationality", labelKey: "fields.nationality" },
  { kind: "text", key: "place_of_birth", labelKey: "fields.placeOfBirth" },
  { kind: "country", key: "country_of_birth", labelKey: "fields.countryOfBirth" },
  { kind: "select", key: "religion", labelKey: "fields.religion", options: [
    { value: "none", labelKey: "options.religion.none" },
    { value: "buddhism", labelKey: "options.religion.buddhism" },
    { value: "christianity", labelKey: "options.religion.christianity" },
    { value: "islam", labelKey: "options.religion.islam" },
    { value: "hinduism", labelKey: "options.religion.hinduism" },
    { value: "other", labelKey: "options.religion.other" },
  ] },
];

const PASSPORT_FIELDS: GenericField[] = [
  { kind: "text", key: "passport_number", labelKey: "fields.passportNumber" },
  { kind: "select", key: "type_of_passport", labelKey: "fields.passportType", options: [
    { value: "ordinary", labelKey: "options.passport.ordinary" },
    { value: "diplomatic", labelKey: "options.passport.diplomatic" },
    { value: "official", labelKey: "options.passport.official" },
  ] },
  { kind: "country", key: "issuing_authority", labelKey: "fields.passportIssuing" },
  { kind: "date", key: "passport_issue_date", labelKey: "fields.passportIssueDate" },
  { kind: "date", key: "passport_expiry_date", labelKey: "fields.passportExpiryDate" },
];

const CONTACT_FIELDS: GenericField[] = [
  { kind: "text", key: "permanent_residential_address", labelKey: "fields.permanentAddress" },
  { kind: "text", key: "contact_address", labelKey: "fields.contactAddress" },
  { kind: "phone", key: "telephone_number", labelKey: "fields.phone" },
  { kind: "email", key: "email_address", labelKey: "fields.email" },
];

const TRIP_FIELDS: GenericField[] = [
  { kind: "select", key: "purpose_of_entry", labelKey: "fields.purpose", options: [
    { value: "tourism", labelKey: "options.purpose.tourism" },
    { value: "business", labelKey: "options.purpose.business" },
    { value: "visiting_relatives", labelKey: "options.purpose.relatives" },
    { value: "investment", labelKey: "options.purpose.investment" },
    { value: "study", labelKey: "options.purpose.study" },
    { value: "work", labelKey: "options.purpose.work" },
    { value: "other", labelKey: "options.purpose.other" },
  ] },
  { kind: "date", key: "intended_date_of_entry", labelKey: "fields.entryDate" },
  { kind: "date", key: "intended_date_of_exit", labelKey: "fields.exitDate" },
  { kind: "text", key: "intended_temporary_residential_address", labelKey: "fields.intendedAddress" },
  { kind: "select", key: "border_gate_entry", labelKey: "fields.borderGateEntry", options: [
    { value: "noi_bai", labelKey: "options.gates.noiBai" },
    { value: "tan_son_nhat", labelKey: "options.gates.tanSonNhat" },
    { value: "da_nang", labelKey: "options.gates.daNang" },
    { value: "cam_ranh", labelKey: "options.gates.camRanh" },
    { value: "other", labelKey: "options.gates.other" },
  ] },
];

const REQUESTED_FIELDS: GenericField[] = [
  { kind: "select", key: "type_of_visa", labelKey: "fields.requestedVisaType", options: [
    { value: "single_entry", labelKey: "options.visa.single" },
    { value: "multiple_entry", labelKey: "options.visa.multiple" },
  ] },
  { kind: "date", key: "valid_from", labelKey: "fields.validFrom" },
  { kind: "date", key: "valid_to", labelKey: "fields.validTo" },
];

const OCCUPATION_FIELDS: GenericField[] = [
  { kind: "text", key: "occupation", labelKey: "fields.occupation" },
  { kind: "text", key: "employer_or_school_name", labelKey: "fields.employerOrSchool" },
  { kind: "text", key: "employer_address", labelKey: "fields.employerAddress" },
  { kind: "text", key: "position", labelKey: "fields.position" },
];

const STEP_FIELD_MAP: Record<string, GenericField[]> = {
  personal: PERSONAL_FIELDS,
  passport: PASSPORT_FIELDS,
  contact: CONTACT_FIELDS,
  trip: TRIP_FIELDS,
  requested: REQUESTED_FIELDS,
  occupation: OCCUPATION_FIELDS,
};

function camelCase(s: string): string {
  return s.replace(/_(.)/g, (_, c) => c.toUpperCase());
}

function fieldRows(form: VnForm, keys: string[]): WizardReviewSection["rows"] {
  return keys.map((k) => ({ labelKey: `fields.${camelCase(k)}`, value: form[k] ?? "" }));
}

function reviewSections(form: VnForm): WizardReviewSection[] {
  return [
    { titleKey: "review.personal", editStepKey: "personal", rows: fieldRows(form, PERSONAL_FIELDS.map((f) => f.key)) },
    { titleKey: "review.passport", editStepKey: "passport", rows: fieldRows(form, PASSPORT_FIELDS.map((f) => f.key)) },
    { titleKey: "review.contact", editStepKey: "contact", rows: fieldRows(form, CONTACT_FIELDS.map((f) => f.key)) },
    { titleKey: "review.trip", editStepKey: "trip", rows: fieldRows(form, TRIP_FIELDS.map((f) => f.key)) },
    { titleKey: "review.requested", editStepKey: "requested", rows: fieldRows(form, REQUESTED_FIELDS.map((f) => f.key)) },
    { titleKey: "review.occupation", editStepKey: "occupation", rows: fieldRows(form, OCCUPATION_FIELDS.map((f) => f.key)) },
  ];
}

function buildPayload(form: VnForm): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(form)) if (typeof v === "string" && v.trim() !== "") out[k] = v.trim();
  return out;
}

function step(key: string, fieldsKey: keyof typeof STEP_FIELD_MAP) {
  return {
    key,
    titleKey: `steps.${key}.label`,
    render: ({ form, setForm, onContinue }: { form: VnForm; setForm: (u: (p: VnForm) => VnForm) => void; onContinue: () => void }) =>
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

export const vnConfig: WizardConfig<VnForm> = {
  visaType: "VN_E_VISA",
  defaultCountry: "vietnam",
  defaultVisaType: "VN_E_VISA",
  emptyForm: () => ({}),
  buildAnswerPayload: buildPayload,
  i18nNamespace: NAMESPACE,
  seedAuthEmail: (form, email) => ({ ...form, email_address: form.email_address || email }),
  reviewSections,
  steps: [
    step("personal", "personal"),
    step("passport", "passport"),
    step("contact", "contact"),
    step("trip", "trip"),
    step("requested", "requested"),
    step("occupation", "occupation"),
  ],
};

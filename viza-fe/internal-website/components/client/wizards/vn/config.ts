import { createElement } from "react";
import { StepGenericFields, type GenericField } from "../shell/shared-steps/step-generic-fields";
import { StepPurposeCards, type PurposeOption } from "../shell/shared-steps/step-purpose-cards";
import { StepTripDates, type EntryOption } from "../shell/shared-steps/step-trip-dates";
import { StepFundingBlock } from "../shell/shared-steps/step-funding-block";
import { StepYesNoChecklist, type ChecklistItem } from "../shell/shared-steps/step-yesno-checklist";
import type { WizardConfig, WizardReviewSection } from "../shell/types";

export type VnForm = Record<string, string>;

const NAMESPACE = "simplifiedForm.vn";
// Vietnam e-visa: max 90 days for single OR multiple-entry (since Aug 2023).
const VN_EVISA_MAX_STAY_DAYS = 90;

// ---------------------------------------------------------------------------
// Field groups.
// ---------------------------------------------------------------------------

const PERSONAL_FIELDS: GenericField[] = [
  { kind: "text", key: "surname", labelKey: "fields.surname", required: true },
  { kind: "text", key: "given_name", labelKey: "fields.givenName", required: true },
  { kind: "text", key: "other_names_used", labelKey: "fields.otherNamesUsed" },
  { kind: "date", key: "date_of_birth", labelKey: "fields.dob" },
  { kind: "select", key: "sex", labelKey: "fields.sex", options: [
    { value: "Male", labelKey: "options.sex.male" },
    { value: "Female", labelKey: "options.sex.female" },
  ] },
  { kind: "country", key: "nationality", labelKey: "fields.nationality" },
  { kind: "country", key: "nationality_at_birth", labelKey: "fields.nationalityAtBirth" },
  { kind: "country", key: "country_of_birth", labelKey: "fields.countryOfBirth" },
  { kind: "text", key: "place_of_birth", labelKey: "fields.placeOfBirth" },
  { kind: "text", key: "national_identity_number", labelKey: "fields.nationalIdNumber" },
  { kind: "select", key: "religion", labelKey: "fields.religion", options: [
    { value: "none", labelKey: "options.religion.none" },
    { value: "buddhism", labelKey: "options.religion.buddhism" },
    { value: "christianity", labelKey: "options.religion.christianity" },
    { value: "islam", labelKey: "options.religion.islam" },
    { value: "hinduism", labelKey: "options.religion.hinduism" },
    { value: "other", labelKey: "options.religion.other" },
  ] },
  { kind: "select", key: "marital_status", labelKey: "fields.maritalStatus", options: [
    { value: "single", labelKey: "options.marital.single" },
    { value: "married", labelKey: "options.marital.married" },
    { value: "divorced", labelKey: "options.marital.divorced" },
    { value: "widowed", labelKey: "options.marital.widowed" },
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
  { kind: "yesno", key: "has_other_passports", labelKey: "fields.hasOtherPassports" },
];

const CONTACT_FIELDS: GenericField[] = [
  { kind: "text", key: "permanent_residential_address", labelKey: "fields.permanentAddress" },
  { kind: "text", key: "contact_address", labelKey: "fields.contactAddress" },
  { kind: "text", key: "contact_address_city", labelKey: "fields.city" },
  { kind: "country", key: "contact_address_country", labelKey: "fields.country" },
  { kind: "phone", key: "telephone_number", labelKey: "fields.phone" },
  { kind: "email", key: "email_address", labelKey: "fields.email" },
  { kind: "text", key: "emergency_contact_name", labelKey: "fields.emergencyContactName" },
  { kind: "phone", key: "emergency_contact_phone", labelKey: "fields.emergencyContactPhone" },
];

// Vietnam-specific destination details — kept generic since the border-gate
// enum + intended address don't benefit from a bespoke component (yet).
const VN_DESTINATION_FIELDS: GenericField[] = [
  { kind: "text", key: "intended_temporary_residential_address", labelKey: "fields.intendedAddress", required: true },
  { kind: "text", key: "intended_address_city", labelKey: "fields.city" },
  { kind: "select", key: "border_gate_entry", labelKey: "fields.borderGateEntry", options: [
    { value: "noi_bai", labelKey: "options.gates.noiBai" },
    { value: "tan_son_nhat", labelKey: "options.gates.tanSonNhat" },
    { value: "da_nang", labelKey: "options.gates.daNang" },
    { value: "cam_ranh", labelKey: "options.gates.camRanh" },
    { value: "phu_quoc", labelKey: "options.gates.phuQuoc" },
    { value: "land_border", labelKey: "options.gates.landBorder" },
    { value: "other", labelKey: "options.gates.other" },
  ] },
  { kind: "select", key: "border_gate_exit", labelKey: "fields.borderGateExit", options: [
    { value: "noi_bai", labelKey: "options.gates.noiBai" },
    { value: "tan_son_nhat", labelKey: "options.gates.tanSonNhat" },
    { value: "da_nang", labelKey: "options.gates.daNang" },
    { value: "cam_ranh", labelKey: "options.gates.camRanh" },
    { value: "phu_quoc", labelKey: "options.gates.phuQuoc" },
    { value: "land_border", labelKey: "options.gates.landBorder" },
    { value: "other", labelKey: "options.gates.other" },
  ] },
];

const HOST_FIELDS: GenericField[] = [
  { kind: "yesno", key: "has_vn_contact", labelKey: "fields.hasVnContact" },
  { kind: "text", key: "vn_contact_name", labelKey: "fields.vnContactName" },
  { kind: "text", key: "vn_contact_relationship", labelKey: "fields.vnContactRelationship" },
  { kind: "phone", key: "vn_contact_phone", labelKey: "fields.vnContactPhone" },
  { kind: "text", key: "vn_contact_address", labelKey: "fields.vnContactAddress" },
];

const OCCUPATION_FIELDS: GenericField[] = [
  { kind: "text", key: "occupation", labelKey: "fields.occupation" },
  { kind: "text", key: "employer_or_school_name", labelKey: "fields.employerOrSchool" },
  { kind: "text", key: "employer_address", labelKey: "fields.employerAddress" },
  { kind: "text", key: "position", labelKey: "fields.position" },
  { kind: "phone", key: "employer_phone", labelKey: "fields.employerPhone" },
];

const COMPANIONS_FIELDS: GenericField[] = [
  { kind: "yesno", key: "is_accompanied_by_minor", labelKey: "fields.isAccompaniedByMinor" },
  { kind: "text", key: "accompanying_minor_count", labelKey: "fields.accompanyingMinorCount" },
  { kind: "text", key: "parent_or_guardian_name", labelKey: "fields.parentOrGuardianName" },
];

// Bespoke step inputs ---------------------------------------------------------

const PURPOSE_OPTIONS: PurposeOption[] = [
  { value: "tourism", labelKey: "options.purpose.tourism", descriptionKey: "options.purposeDesc.tourism" },
  { value: "business", labelKey: "options.purpose.business", descriptionKey: "options.purposeDesc.business" },
  { value: "visiting_relatives", labelKey: "options.purpose.relatives", descriptionKey: "options.purposeDesc.relatives" },
  { value: "investment", labelKey: "options.purpose.investment", descriptionKey: "options.purposeDesc.investment" },
  { value: "study", labelKey: "options.purpose.study", descriptionKey: "options.purposeDesc.study" },
  { value: "work", labelKey: "options.purpose.work", descriptionKey: "options.purposeDesc.work" },
  { value: "press", labelKey: "options.purpose.press", descriptionKey: "options.purposeDesc.press" },
  { value: "other", labelKey: "options.purpose.other", descriptionKey: "options.purposeDesc.other" },
];

const ENTRIES_OPTIONS: EntryOption[] = [
  { value: "single_entry", labelKey: "options.visa.single" },
  { value: "multiple_entry", labelKey: "options.visa.multiple" },
];

const FUNDING_SOURCE_OPTIONS = [
  { value: "self", labelKey: "options.funding.self" },
  { value: "family", labelKey: "options.funding.family" },
  { value: "employer", labelKey: "options.funding.employer" },
  { value: "host", labelKey: "options.funding.host" },
];

const CURRENCY_OPTIONS = [
  { value: "USD", labelKey: "options.currency.usd" },
  { value: "VND", labelKey: "options.currency.vnd" },
  { value: "EUR", labelKey: "options.currency.eur" },
  { value: "CNY", labelKey: "options.currency.cny" },
];

const DECLARATION_ITEMS: ChecklistItem[] = [
  { key: "decl_information_correct", labelKey: "declarations.informationCorrect" },
  { key: "decl_no_criminal_convictions", labelKey: "declarations.noCriminalConvictions", explainOnYes: true },
  { key: "decl_no_communicable_disease", labelKey: "declarations.noCommunicableDisease", explainOnYes: true },
  { key: "decl_no_drug_addiction", labelKey: "declarations.noDrugAddiction", explainOnYes: true },
  { key: "decl_will_obey_local_laws", labelKey: "declarations.willObeyLocalLaws" },
];

const PURPOSE_KEYS = ["purpose_of_entry"];
const TRIP_DATES_KEYS = ["intended_date_of_entry", "intended_date_of_exit", "type_of_visa"];
const FUNDING_KEYS = [
  "trip_payer",
  "sponsor_name",
  "sponsor_relationship",
  "trip_budget",
  "trip_budget_currency",
  "has_travel_insurance",
];
const DECLARATION_KEYS = DECLARATION_ITEMS.map((i) => i.key);

// ---------------------------------------------------------------------------

const STEP_FIELD_MAP: Record<string, GenericField[]> = {
  personal: PERSONAL_FIELDS,
  passport: PASSPORT_FIELDS,
  contact: CONTACT_FIELDS,
  vn_destination: VN_DESTINATION_FIELDS,
  host: HOST_FIELDS,
  occupation: OCCUPATION_FIELDS,
  companions: COMPANIONS_FIELDS,
};

function camelCase(s: string): string {
  return s.replace(/_(.)/g, (_, c) => c.toUpperCase());
}

function fieldRows(form: VnForm, keys: string[]): WizardReviewSection["rows"] {
  return keys.map((k) => ({ labelKey: `fields.${camelCase(k)}`, value: form[k] ?? "" }));
}

function reviewSections(form: VnForm): WizardReviewSection[] {
  return [
    { titleKey: "review.purpose", editStepKey: "purpose", rows: fieldRows(form, PURPOSE_KEYS) },
    { titleKey: "review.personal", editStepKey: "personal", rows: fieldRows(form, PERSONAL_FIELDS.map((f) => f.key)) },
    { titleKey: "review.passport", editStepKey: "passport", rows: fieldRows(form, PASSPORT_FIELDS.map((f) => f.key)) },
    { titleKey: "review.contact", editStepKey: "contact", rows: fieldRows(form, CONTACT_FIELDS.map((f) => f.key)) },
    { titleKey: "review.tripDates", editStepKey: "trip_dates", rows: fieldRows(form, TRIP_DATES_KEYS) },
    { titleKey: "review.vnDestination", editStepKey: "vn_destination", rows: fieldRows(form, VN_DESTINATION_FIELDS.map((f) => f.key)) },
    { titleKey: "review.host", editStepKey: "host", rows: fieldRows(form, HOST_FIELDS.map((f) => f.key)) },
    { titleKey: "review.occupation", editStepKey: "occupation", rows: fieldRows(form, OCCUPATION_FIELDS.map((f) => f.key)) },
    { titleKey: "review.companions", editStepKey: "companions", rows: fieldRows(form, COMPANIONS_FIELDS.map((f) => f.key)) },
    { titleKey: "review.funding", editStepKey: "funding", rows: fieldRows(form, FUNDING_KEYS) },
    { titleKey: "review.declaration", editStepKey: "declaration", rows: fieldRows(form, DECLARATION_KEYS) },
  ];
}

function buildPayload(form: VnForm): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(form)) if (typeof v === "string" && v.trim() !== "") out[k] = v.trim();
  return out;
}

function genericStep(key: string, fieldsKey: keyof typeof STEP_FIELD_MAP) {
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
    {
      key: "purpose",
      titleKey: "steps.purpose.label",
      render: ({ form, setForm, onContinue }) =>
        createElement(StepPurposeCards, {
          i18nNamespace: NAMESPACE,
          titleKey: "steps.purpose.title",
          subtitleKey: "steps.purpose.subtitle",
          fieldKey: "purpose_of_entry",
          value: form.purpose_of_entry ?? "",
          onChange: (v) => setForm((prev) => ({ ...prev, purpose_of_entry: v })),
          options: PURPOSE_OPTIONS,
          onContinue,
        }),
    },
    genericStep("personal", "personal"),
    genericStep("passport", "passport"),
    genericStep("contact", "contact"),
    {
      key: "trip_dates",
      titleKey: "steps.tripDates.label",
      render: ({ form, setForm, onContinue }) =>
        createElement(StepTripDates, {
          i18nNamespace: NAMESPACE,
          titleKey: "steps.tripDates.title",
          subtitleKey: "steps.tripDates.subtitle",
          arrivalKey: "intended_date_of_entry",
          departureKey: "intended_date_of_exit",
          entriesKey: "type_of_visa",
          arrivalLabelKey: "fields.entryDate",
          departureLabelKey: "fields.exitDate",
          entriesLabelKey: "fields.requestedVisaType",
          entriesOptions: ENTRIES_OPTIONS,
          maxStayDays: VN_EVISA_MAX_STAY_DAYS,
          maxStayHintKey: "tripDates.over90Hint",
          values: {
            arrival: form.intended_date_of_entry ?? "",
            departure: form.intended_date_of_exit ?? "",
            entries: form.type_of_visa ?? "",
          },
          onChange: (next) =>
            setForm((prev) => ({
              ...prev,
              intended_date_of_entry: next.arrival,
              intended_date_of_exit: next.departure,
              type_of_visa: next.entries ?? prev.type_of_visa ?? "",
            })),
          onContinue,
        }),
    },
    genericStep("vn_destination", "vn_destination"),
    genericStep("host", "host"),
    genericStep("occupation", "occupation"),
    genericStep("companions", "companions"),
    {
      key: "funding",
      titleKey: "steps.funding.label",
      render: ({ form, setForm, onContinue }) =>
        createElement(StepFundingBlock, {
          i18nNamespace: NAMESPACE,
          titleKey: "steps.funding.title",
          subtitleKey: "steps.funding.subtitle",
          sourceKey: "trip_payer",
          sourceLabelKey: "fields.tripPayer",
          sourceOptions: FUNDING_SOURCE_OPTIONS,
          sponsorTriggerValues: ["family", "employer", "host"],
          sponsorNameKey: "sponsor_name",
          sponsorRelationshipKey: "sponsor_relationship",
          amountKey: "trip_budget",
          currencyKey: "trip_budget_currency",
          currencyOptions: CURRENCY_OPTIONS,
          insuranceKey: "has_travel_insurance",
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

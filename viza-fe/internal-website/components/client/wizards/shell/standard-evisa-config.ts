import { createElement } from "react";
import { StepGenericFields, type GenericField } from "./shared-steps/step-generic-fields";
import { StepYesNoChecklist, type ChecklistItem } from "./shared-steps/step-yesno-checklist";
import type { WizardConfig, WizardReviewSection } from "./types";

/**
 * Shared standard-e-Visa wizard factory (POR-003/004/005).
 *
 * Most launch e-Visa portals (SA/MY/TH/AE/CA/TR/IN, and the JP paper pack)
 * collect the same canonical applicant set. Rather than hand-author a config
 * per country, this factory produces one from `{ visaType, defaultCountry }`.
 *
 * Field KEYS are the canonical answer keys consumed by the submission-service
 * runners' field-mappings (src/<cc>/field-mappings.ts via the shared
 * standard-evisa core) — surname, given_names, date_of_birth, nationality,
 * passport_number, passport_expiry_date, passport_issuing_country, email,
 * phone, intended_arrival_date — so the wizard answers map straight through
 * (POR-002 parity). All countries share the `simplifiedForm.standardEvisa`
 * i18n namespace.
 */

export type StandardForm = Record<string, string>;

const NAMESPACE = "simplifiedForm.standardEvisa";

const PERSONAL_FIELDS: GenericField[] = [
  { kind: "text", key: "surname", labelKey: "fields.surname", required: true },
  { kind: "text", key: "given_names", labelKey: "fields.givenNames", required: true },
  { kind: "select", key: "sex", labelKey: "fields.sex", options: [
    { value: "male", labelKey: "options.sex.male" },
    { value: "female", labelKey: "options.sex.female" },
  ] },
  { kind: "date", key: "date_of_birth", labelKey: "fields.dob" },
  { kind: "text", key: "place_of_birth_city", labelKey: "fields.placeOfBirthCity" },
  { kind: "country", key: "nationality", labelKey: "fields.nationality" },
];

const PASSPORT_FIELDS: GenericField[] = [
  { kind: "text", key: "passport_number", labelKey: "fields.passportNumber", required: true },
  { kind: "country", key: "passport_issuing_country", labelKey: "fields.passportIssuingCountry" },
  { kind: "date", key: "passport_expiry_date", labelKey: "fields.passportExpiryDate" },
];

const CONTACT_FIELDS: GenericField[] = [
  { kind: "email", key: "email", labelKey: "fields.email" },
  { kind: "phone", key: "phone", labelKey: "fields.phone" },
  { kind: "text", key: "home_address", labelKey: "fields.homeAddress" },
];

const TRIP_FIELDS: GenericField[] = [
  { kind: "date", key: "intended_arrival_date", labelKey: "fields.intendedArrival" },
  { kind: "date", key: "intended_departure_date", labelKey: "fields.intendedDeparture" },
  { kind: "text", key: "purpose_of_visit", labelKey: "fields.purposeOfVisit" },
  { kind: "text", key: "occupation", labelKey: "fields.occupation" },
];

const DECLARATION_ITEMS: ChecklistItem[] = [
  { key: "has_criminal_record", labelKey: "declarations.hasCriminalRecord", explainOnYes: true },
  { key: "final_declaration", labelKey: "declarations.finalDeclaration" },
];

const STEP_FIELDS: Record<string, GenericField[]> = {
  personal: PERSONAL_FIELDS,
  passport: PASSPORT_FIELDS,
  contact: CONTACT_FIELDS,
  trip: TRIP_FIELDS,
};

function camelCase(s: string): string {
  return s.replace(/_(.)/g, (_, c) => c.toUpperCase());
}

function fieldRows(form: StandardForm, keys: string[]): WizardReviewSection["rows"] {
  return keys.map((k) => ({ labelKey: `fields.${camelCase(k)}`, value: form[k] ?? "" }));
}

function genericStep(key: keyof typeof STEP_FIELDS) {
  return {
    key,
    titleKey: `steps.${key}.label`,
    render: ({ form, setForm, onContinue }: { form: StandardForm; setForm: (u: (p: StandardForm) => StandardForm) => void; onContinue: () => void }) =>
      createElement(StepGenericFields, {
        i18nNamespace: NAMESPACE,
        titleKey: `steps.${key}.title`,
        subtitleKey: `steps.${key}.subtitle`,
        fields: STEP_FIELDS[key],
        values: form,
        onChange: (next) => setForm(() => next),
        onContinue,
      }),
  };
}

export interface StandardWizardOpts {
  visaType: string;
  defaultCountry: string;
  /** Optional note surfaced in code/review (e.g. JP paper-only, IT VFS flow). */
  note?: string;
}

export function makeStandardEvisaWizard(opts: StandardWizardOpts): WizardConfig<StandardForm> {
  return {
    visaType: opts.visaType,
    defaultCountry: opts.defaultCountry,
    defaultVisaType: opts.visaType,
    emptyForm: () => ({}),
    i18nNamespace: NAMESPACE,
    seedAuthEmail: (form, email) => ({ ...form, email: form.email || email }),
    buildAnswerPayload: (form) => {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(form)) if (typeof v === "string" && v.trim() !== "") out[k] = v.trim();
      return out;
    },
    reviewSections: (form) => [
      { titleKey: "review.personal", editStepKey: "personal", rows: fieldRows(form, PERSONAL_FIELDS.map((f) => f.key)) },
      { titleKey: "review.passport", editStepKey: "passport", rows: fieldRows(form, PASSPORT_FIELDS.map((f) => f.key)) },
      { titleKey: "review.contact", editStepKey: "contact", rows: fieldRows(form, CONTACT_FIELDS.map((f) => f.key)) },
      { titleKey: "review.trip", editStepKey: "trip", rows: fieldRows(form, TRIP_FIELDS.map((f) => f.key)) },
      { titleKey: "review.declaration", editStepKey: "declaration", rows: fieldRows(form, DECLARATION_ITEMS.map((i) => i.key)) },
    ],
    steps: [
      genericStep("personal"),
      genericStep("passport"),
      genericStep("contact"),
      genericStep("trip"),
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
}

import { createElement } from "react";
import { StepIdentity } from "@/components/client/simplified-form/step-identity";
import { StepContact } from "@/components/client/simplified-form/step-contact";
import { StepPassport } from "@/components/client/simplified-form/step-passport";
import { StepTravel } from "@/components/client/simplified-form/step-travel";
import { StepUsStay } from "@/components/client/simplified-form/step-us-stay";
import { StepUsContact } from "@/components/client/simplified-form/step-us-contact";
import { StepFamily } from "@/components/client/simplified-form/step-family";
import { StepBackground } from "@/components/client/simplified-form/step-background";
import { StepWorkEducation } from "@/components/client/simplified-form/step-work-education";
import {
  buildAnswerPayload as buildUsPayload,
  emptySimplifiedForm,
  type SimplifiedFormData,
} from "@/components/client/simplified-form/types";
import type { WizardConfig, WizardReviewSection } from "../shell/types";

const NAMESPACE = "simplifiedForm.us";

function reviewSections(form: SimplifiedFormData): WizardReviewSection[] {
  const fmtName = (first: string, last: string) => [first, last].filter(Boolean).join(" ");
  return [
    {
      titleKey: "review.identity",
      editStepKey: "identity",
      rows: [
        { labelKey: "review.fields.fullName", value: fmtName(form.identity.firstName, form.identity.lastName) },
        { labelKey: "review.fields.dob", value: form.identity.dob },
        { labelKey: "review.fields.sex", value: form.identity.gender },
        { labelKey: "review.fields.nationality", value: form.identity.nationality },
        { labelKey: "review.fields.maritalStatus", value: form.identity.maritalStatus },
      ],
    },
    {
      titleKey: "review.contact",
      editStepKey: "contact",
      rows: [
        { labelKey: "review.fields.email", value: form.contact.email },
        { labelKey: "review.fields.phone", value: form.contact.phone },
        { labelKey: "review.fields.homeCountry", value: form.contact.homeCountry },
        { labelKey: "review.fields.homeAddress", value: [form.contact.street1, form.contact.city, form.contact.state, form.contact.postalCode].filter(Boolean).join(", ") },
      ],
    },
    {
      titleKey: "review.passport",
      editStepKey: "passport",
      rows: [
        { labelKey: "review.fields.passportNumber", value: form.passport.number },
        { labelKey: "review.fields.passportIssuing", value: form.passport.issuingCountry },
        { labelKey: "review.fields.passportIssueDate", value: form.passport.issueDate },
        { labelKey: "review.fields.passportExpiry", value: form.passport.expiryDate },
      ],
    },
    {
      titleKey: "review.travel",
      editStepKey: "travel",
      rows: [
        { labelKey: "review.fields.arrivalDate", value: form.travel.arrivalDate },
        { labelKey: "review.fields.departureDate", value: form.travel.departureDate },
        { labelKey: "review.fields.purposeOfTrip", value: "B1/B2 — Business / Tourism" },
        { labelKey: "review.fields.tripPayer", value: form.travel.tripPayer },
      ],
    },
    {
      titleKey: "review.work",
      editStepKey: "work",
      rows: [
        { labelKey: "review.fields.occupation", value: form.work.primaryOccupation },
        { labelKey: "review.fields.employerName", value: form.work.employerName },
        { labelKey: "review.fields.jobTitle", value: form.work.jobTitle },
      ],
    },
    {
      titleKey: "review.usContact",
      editStepKey: "usContact",
      rows: [
        {
          labelKey: "review.fields.usContactName",
          value: form.usContact.isOrganization
            ? form.usContact.organizationName
            : fmtName(form.usContact.contactFirstName, form.usContact.contactLastName),
        },
        { labelKey: "review.fields.usContactRelationship", value: form.usContact.relationship },
        { labelKey: "review.fields.usContactPhone", value: form.usContact.phone },
      ],
    },
    {
      titleKey: "review.family",
      editStepKey: "family",
      rows: [
        { labelKey: "review.fields.father", value: fmtName(form.family.fatherFirstName, form.family.fatherLastName) },
        { labelKey: "review.fields.mother", value: fmtName(form.family.motherFirstName, form.family.motherLastName) },
        {
          labelKey: "review.fields.spouse",
          value: form.family.spouseFirstName
            ? fmtName(form.family.spouseFirstName, form.family.spouseLastName)
            : "",
        },
      ],
    },
    {
      titleKey: "review.background",
      editStepKey: "background",
      rows: [
        {
          labelKey: "review.fields.backgroundFlag",
          value: form.background.noneApply
            ? "literal:None apply"
            : `${form.background.categories.length} categories flagged`,
        },
      ],
    },
  ];
}

export const usConfig: WizardConfig<SimplifiedFormData> = {
  visaType: "DS160",
  defaultCountry: "US",
  defaultVisaType: "B1/B2",
  emptyForm: emptySimplifiedForm,
  buildAnswerPayload: buildUsPayload,
  i18nNamespace: NAMESPACE,
  // The US wizard previously redirected to its own review page; with the
  // built-in WizardReview screen we send the user to the long form to fill
  // any remaining DS-160 sections (security explains, etc).
  onSubmitRedirect: "/client/application/long-form?step=review",
  seedAuthEmail: (form, email) => ({
    ...form,
    contact: { ...form.contact, email: form.contact.email || email },
  }),
  reviewSections,
  steps: [
    {
      key: "identity",
      titleKey: "steps.identity",
      render: ({ form, setForm, onContinue, applicationId }) =>
        createElement(StepIdentity, {
          value: form.identity,
          onChange: (next) => setForm((f) => ({ ...f, identity: next })),
          onContinue,
          applicationId,
          onPassportExtracted: (passportPatch) =>
            setForm((f) => ({ ...f, passport: { ...f.passport, ...passportPatch } })),
        }),
    },
    {
      key: "contact",
      titleKey: "steps.contact",
      render: ({ form, setForm, onContinue }) =>
        createElement(StepContact, {
          value: form.contact,
          onChange: (next) => setForm((f) => ({ ...f, contact: next })),
          onContinue,
        }),
    },
    {
      key: "passport",
      titleKey: "steps.passport",
      render: ({ form, setForm, onContinue }) =>
        createElement(StepPassport, {
          value: form.passport,
          onChange: (next) => setForm((f) => ({ ...f, passport: next })),
          onContinue,
        }),
    },
    {
      key: "travel",
      titleKey: "steps.travel",
      render: ({ form, setForm, onContinue }) =>
        createElement(StepTravel, {
          value: form.travel,
          onChange: (next) => setForm((f) => ({ ...f, travel: next })),
          onContinue,
        }),
    },
    {
      key: "usStay",
      titleKey: "steps.usStay",
      showIf: (form) => {
        if (form.travel.plansState === "unsure") return false;
        if (form.travel.plansState === "idea" && form.travel.lengthUnit === "LessThan24Hours") return false;
        return true;
      },
      render: ({ form, setForm, onContinue }) =>
        createElement(StepUsStay, {
          value: form.travel,
          onChange: (next) => setForm((f) => ({ ...f, travel: next })),
          onContinue,
        }),
    },
    {
      key: "work",
      titleKey: "steps.work",
      render: ({ form, setForm, onContinue }) =>
        createElement(StepWorkEducation, {
          value: form.work,
          onChange: (next) => setForm((f) => ({ ...f, work: next })),
          onContinue,
        }),
    },
    {
      key: "usContact",
      titleKey: "steps.usContact",
      render: ({ form, setForm, onContinue }) =>
        createElement(StepUsContact, {
          value: form.usContact,
          onChange: (next) => setForm((f) => ({ ...f, usContact: next })),
          onContinue,
        }),
    },
    {
      key: "family",
      titleKey: "steps.family",
      render: ({ form, setForm, onContinue, goToStep }) =>
        createElement(StepFamily, {
          value: form.family,
          onChange: (next) => setForm((f) => ({ ...f, family: next })),
          onContinue,
          maritalStatus: form.identity.maritalStatus,
          onChangeMaritalStatus: () => goToStep(0),
        }),
    },
    {
      key: "background",
      titleKey: "steps.background",
      render: ({ form, setForm, onContinue }) =>
        createElement(StepBackground, {
          value: form.background,
          onChange: (next) => setForm((f) => ({ ...f, background: next })),
          // Background's onSubmit historically meant "continue to review";
          // wire it to onContinue so the shell drives navigation to its
          // built-in review step.
          onSubmit: onContinue,
          submitting: false,
        }),
    },
  ],
};

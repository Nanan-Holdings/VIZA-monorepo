"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import { AiAssistButton } from "@/components/ui/ai-assist-button";
import {
  Alert,
  AlertAction,
  AlertActions,
  AlertDescription,
  AlertIcon,
  AlertTitle,
} from "@/components/ui/alert";
import { ActionButton } from "@/components/ui/action-button";
import { AlertToast, AlertToastAction, alertToast } from "@/components/ui/alert-toast";
import { ApplicationCheckbox, ApplicationRadio } from "@/components/ui/application-checkbox";
import { ApplicationConditionalFieldsPanel } from "@/components/ui/application-conditional-fields-panel";
import { ApplicationFormDatePicker } from "@/components/ui/application-form-date-picker";
import { ApplicationFormField } from "@/components/ui/application-form-field";
import {
  ApplicationFormControlDisplay,
  ApplicationFormInputGroup,
} from "@/components/ui/application-form-input";
import { ApplicationFormPanel } from "@/components/ui/application-form-panel";
import {
  ApplicationFormSelectContent,
  ApplicationFormSelectItem,
  ApplicationFormSelectTrigger,
  ApplicationSearchableMultiSelect,
} from "@/components/ui/application-form-select";
import { ApplicationFormTextarea } from "@/components/ui/application-form-textarea";
import { ApplicationYesNoControl } from "@/components/ui/application-yes-no-control";
import { CountryDropdown } from "@/components/ui/country-dropdown";
import { DocumentUploadField } from "@/components/ui/document-upload-field";
import { InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectValue } from "@/components/ui/select";
import { SupportingDocumentCard } from "@/components/ui/supporting-document-card";

const destinations = ["Japan", "Singapore", "France"];
const fundingProviders = [
  { value: "self", text: "Myself" },
  { value: "sponsor", text: "A sponsor" },
  { value: "both", text: "Both myself and a sponsor" },
];
const selfFundingMethods = [
  { value: "self-cash", text: "Self: cash" },
  { value: "self-credit-card", text: "Self: credit card" },
];
const sponsorFundingMethods = [
  { value: "sponsor-accommodation", text: "Sponsor: accommodation provided" },
  { value: "sponsor-expenses", text: "Sponsor: all expenses covered during the stay" },
];
const visitPurposes = [
  { value: "tourism", text: "Tourism" },
  { value: "business", text: "Business" },
  { value: "family", text: "Visit family or friends" },
  { value: "transit", text: "Transit" },
];

const galleryVisaTypes = [
  { value: "tourist", text: "Tourist (B211A)" },
  { value: "business", text: "Business" },
  { value: "work", text: "Work permit" },
  { value: "student", text: "Student", disabled: true },
];
const galleryProcessingSpeeds = [
  {
    value: "standard",
    text: "Standard processing",
    description:
      "10 business days from the date the embassy accepts a complete file. Government fee and VIZA service charge are billed together at submission.",
  },
  {
    value: "priority",
    text: "Priority processing",
    description: "5 business days, including a consultant review call before the file is lodged.",
  },
];

function GalleryFieldAiAssist({ field }: { field: string }) {
  return (
    <AiAssistButton
      label={`Ask AI about ${field}`}
      variant="field"
      className="application-form-ai-trigger"
    />
  );
}

export default function UiComponentsPage() {
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [country, setCountry] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [hasOtherNationality, setHasOtherNationality] = useState("");
  const [otherNationalities, setOtherNationalities] = useState([""]);
  const [needsVisa, setNeedsVisa] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedVisitPurposes, setSelectedVisitPurposes] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [declarationsAccepted, setDeclarationsAccepted] = useState(false);
  const [documentsConfirmed, setDocumentsConfirmed] = useState(true);
  const [authorityGranted, setAuthorityGranted] = useState(false);
  const [visaType, setVisaType] = useState("business");
  const [processingSpeed, setProcessingSpeed] = useState("standard");
  const [fundingProvider, setFundingProvider] = useState("self");
  const [fundingMethods, setFundingMethods] = useState<Record<string, string>>({});

  const setFundingMethod = (fieldName: string, value: string) => {
    setFundingMethods((current) => ({ ...current, [fieldName]: value }));
  };

  return (
    <main className="min-h-screen bg-[#fafafa] px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 max-w-2xl">
          <p className="mb-2 text-sm font-medium text-brand-500">VIZA component gallery</p>
          <h1 className="text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
            Application form components
          </h1>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Shared form primitives displayed together for visual review.
          </p>
        </header>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <ApplicationFormPanel className="p-5">
            <h2 className="text-base font-semibold text-foreground">Panel + input</h2>
            <ApplicationFormField
              label="Full name"
              htmlFor="gallery-name"
              labelAction={<GalleryFieldAiAssist field="Full name" />}
              className="mt-5"
            >
              <ApplicationFormInputGroup className="h-12" filled={Boolean(name)}>
                <InputGroupInput
                  id="gallery-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Enter your full name"
                  className="h-12 text-[15px]"
                />
              </ApplicationFormInputGroup>
            </ApplicationFormField>
          </ApplicationFormPanel>

          <ApplicationFormPanel className="p-5">
            <h2 className="text-base font-semibold text-foreground">Read-only field</h2>
            <ApplicationFormField label="Email" required className="mt-5">
              <ApplicationFormControlDisplay
                role="textbox"
                aria-label="Email"
                aria-readonly="true"
                className="h-12 bg-gray-50 text-[15px] text-gray-700"
              >
                appl-01kz0prkbncz7sstraymxejfeg@viza.it.com
              </ApplicationFormControlDisplay>
            </ApplicationFormField>
          </ApplicationFormPanel>

          <ApplicationFormPanel className="p-5">
            <h2 className="text-base font-semibold text-foreground">Yes / no</h2>
            <ApplicationFormField
              label="Do you need a visa?"
              labelAction={<GalleryFieldAiAssist field="Do you need a visa?" />}
              className="mt-5"
            >
              <ApplicationYesNoControl
                name="gallery-needs-visa"
                value={needsVisa}
                options={[
                  { value: "yes", text: "Yes" },
                  { value: "no", text: "No" },
                ]}
                onValueChange={setNeedsVisa}
              />
            </ApplicationFormField>
          </ApplicationFormPanel>

          <section className="md:col-span-2 xl:col-span-3">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-foreground">Checkbox &amp; radio</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                18px control, brand navy when selected. The control pins to the cap-height of the
                first line, so long declarations keep a hanging indent.
              </p>
            </div>
            <ApplicationFormPanel className="flex flex-col gap-6 p-5">
              <div className="flex flex-col gap-[14px]">
                <h3 className="text-[11px] font-medium uppercase leading-none tracking-[0.06em] text-black/45">Checkbox · states</h3>
                <div className="flex flex-wrap items-center gap-5">
                  <ApplicationCheckbox
                    checked={declarationsAccepted}
                    label="Unchecked"
                    onCheckedChange={setDeclarationsAccepted}
                  />
                  <ApplicationCheckbox checked label="Checked" onCheckedChange={() => undefined} />
                  <ApplicationCheckbox
                    checked={false}
                    indeterminate
                    label="Mixed"
                    onCheckedChange={() => undefined}
                  />
                  <ApplicationCheckbox
                    checked={false}
                    disabled
                    label="Disabled"
                    onCheckedChange={() => undefined}
                  />
                  <ApplicationCheckbox
                    checked={false}
                    invalid
                    label="Error"
                    onCheckedChange={() => undefined}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-[14px]">
                <h3 className="text-[11px] font-medium uppercase leading-none tracking-[0.06em] text-black/45">Radio · inline</h3>
                <div className="flex flex-wrap items-center gap-5">
                  {galleryVisaTypes.map((option) => (
                    <ApplicationRadio
                      key={option.value}
                      name="gallery-visa-type"
                      value={option.value}
                      checked={visaType === option.value}
                      label={option.text}
                      disabled={option.disabled}
                      onCheckedChange={() => setVisaType(option.value)}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-[14px]">
                <h3 className="text-[11px] font-medium uppercase leading-none tracking-[0.06em] text-black/45">
                  Checkbox · long text &amp; description
                </h3>
                <div className="flex max-w-[560px] flex-col gap-[14px]">
                  <ApplicationCheckbox
                    checked={documentsConfirmed}
                    required
                    label="I confirm that every document uploaded above belongs to the applicant and that the passport remains valid for at least six months beyond the intended date of entry."
                    onCheckedChange={setDocumentsConfirmed}
                  />
                  <ApplicationCheckbox
                    checked={authorityGranted}
                    label="Authorise VIZA to act on my behalf"
                    description="We will submit the application, respond to routine embassy queries, and collect the passport once the decision is issued. You can revoke this at any time before submission."
                    onCheckedChange={setAuthorityGranted}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-[14px]">
                <h3 className="text-[11px] font-medium uppercase leading-none tracking-[0.06em] text-black/45">
                  Radio · long text &amp; description
                </h3>
                <div className="flex max-w-[560px] flex-col gap-[14px]">
                  {galleryProcessingSpeeds.map((option) => (
                    <ApplicationRadio
                      key={option.value}
                      name="gallery-processing-speed"
                      value={option.value}
                      checked={processingSpeed === option.value}
                      label={option.text}
                      description={option.description}
                      onCheckedChange={() => setProcessingSpeed(option.value)}
                    />
                  ))}
                </div>
              </div>
            </ApplicationFormPanel>
          </section>

          <ApplicationFormPanel className="p-5">
            <h2 className="text-base font-semibold text-foreground">Dropdown</h2>
            <ApplicationFormField
              label="Destination"
              labelAction={<GalleryFieldAiAssist field="Destination" />}
              className="mt-5"
            >
              <Select value={destination} onValueChange={setDestination}>
                <ApplicationFormSelectTrigger className="h-12" filled={Boolean(destination)}>
                  <SelectValue placeholder="Select..." />
                </ApplicationFormSelectTrigger>
                <ApplicationFormSelectContent>
                  {destinations.map((item) => (
                    <ApplicationFormSelectItem key={item} value={item}>
                      {item}
                    </ApplicationFormSelectItem>
                  ))}
                </ApplicationFormSelectContent>
              </Select>
            </ApplicationFormField>
          </ApplicationFormPanel>

          <ApplicationFormPanel className="p-5">
            <h2 className="text-base font-semibold text-foreground">Searchable country dropdown</h2>
            <ApplicationFormField
              label="Place of birth — Country"
              required
              labelAction={<GalleryFieldAiAssist field="Place of birth — Country" />}
              className="mt-5"
            >
              <CountryDropdown
                defaultValue={country}
                onChange={(selectedCountry) => setCountry(selectedCountry.name)}
                placeholder="Select a country"
                displayLocale="en"
              />
            </ApplicationFormField>
          </ApplicationFormPanel>

          <ApplicationFormPanel className="p-5">
            <h2 className="text-base font-semibold text-foreground">Date picker</h2>
            <ApplicationFormField
              label="Date of birth"
              labelAction={<GalleryFieldAiAssist field="Date of birth" />}
              className="mt-5"
            >
              <ApplicationFormDatePicker
                value={dateOfBirth}
                onChange={setDateOfBirth}
                placeholder="Select date of birth"
                displayLocale="en"
              />
            </ApplicationFormField>
          </ApplicationFormPanel>

          <ApplicationFormPanel className="p-5">
            <h2 className="text-base font-semibold text-foreground">Textarea</h2>
            <ApplicationFormField
              label="Travel notes"
              htmlFor="gallery-notes"
              labelAction={<GalleryFieldAiAssist field="Travel notes" />}
              className="mt-5"
            >
              <ApplicationFormTextarea
                id="gallery-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Add any details you want VIZA to know"
                className="min-h-32 text-[15px]"
              />
            </ApplicationFormField>
          </ApplicationFormPanel>

          <ApplicationFormPanel className="p-5">
            <h2 className="text-base font-semibold text-foreground">Searchable multi-select</h2>
            <ApplicationFormField
              label="Purpose of visit"
              labelAction={<GalleryFieldAiAssist field="Purpose of visit" />}
              className="mt-5"
            >
              <ApplicationSearchableMultiSelect
                value={selectedVisitPurposes}
                onValueChange={setSelectedVisitPurposes}
                options={visitPurposes}
                placeholder="Select one or more..."
              />
            </ApplicationFormField>
          </ApplicationFormPanel>

          <ApplicationFormPanel className="p-5 md:col-span-2 xl:col-span-3">
            <h2 className="text-base font-semibold text-foreground">Conditional repeat group</h2>
            <div className="mt-5 flex flex-col gap-2">
              <ApplicationFormField
                label="Do you hold any other nationality / citizenship (current or former)?"
                required
                labelAction={<GalleryFieldAiAssist field="Other nationality or citizenship status" />}
              >
                <ApplicationYesNoControl
                  name="gallery-other-nationality"
                  value={hasOtherNationality}
                  options={[
                    { value: "yes", text: "Yes" },
                    { value: "no", text: "No" },
                  ]}
                  onValueChange={setHasOtherNationality}
                />
              </ApplicationFormField>

              {hasOtherNationality === "yes" && (
                <ApplicationConditionalFieldsPanel
                  aria-label="Other nationality details"
                  className="-mt-1"
                  canAdd={otherNationalities.length < 5}
                  onAdd={() => setOtherNationalities((current) => [...current, ""])}
                  addLabel="Add another"
                >
                  {otherNationalities.map((nationality, index) => (
                    <div
                      key={index}
                      className={index === 0 ? "flex flex-col gap-2" : "mt-4 flex flex-col gap-2"}
                    >
                      {otherNationalities.length > 1 && (
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] font-medium text-gray-500">#{index + 1}</span>
                          <button
                            type="button"
                            onClick={() => setOtherNationalities((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                            className="flex cursor-pointer items-center gap-1 text-[13px] text-red-500 transition-colors hover:text-red-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </button>
                        </div>
                      )}
                      <ApplicationFormField
                        label="Other nationality / citizenship"
                        required
                        labelAction={<GalleryFieldAiAssist field="Other nationality or citizenship" />}
                      >
                        <CountryDropdown
                          defaultValue={nationality}
                          onChange={(selectedCountry) => setOtherNationalities((current) =>
                            current.map((item, itemIndex) => itemIndex === index ? selectedCountry.name : item)
                          )}
                          placeholder="Select..."
                          displayLocale="en"
                        />
                      </ApplicationFormField>
                    </div>
                  ))}
                </ApplicationConditionalFieldsPanel>
              )}
            </div>
          </ApplicationFormPanel>

          <ApplicationFormPanel className="p-5 md:col-span-2 xl:col-span-3">
            <h2 className="text-base font-semibold text-foreground">
              Conditional multi-option group
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              One dropdown controls multiple answer branches inside a single shared panel.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <ApplicationFormField
                label="Who will cover the cost of travelling and living during your stay?"
                required
                labelAction={<GalleryFieldAiAssist field="Financial support" />}
              >
                <Select value={fundingProvider} onValueChange={setFundingProvider}>
                  <ApplicationFormSelectTrigger className="h-12" filled={Boolean(fundingProvider)}>
                    <SelectValue placeholder="Select..." />
                  </ApplicationFormSelectTrigger>
                  <ApplicationFormSelectContent>
                    {fundingProviders.map((option) => (
                      <ApplicationFormSelectItem key={option.value} value={option.value}>
                        {option.text}
                      </ApplicationFormSelectItem>
                    ))}
                  </ApplicationFormSelectContent>
                </Select>
              </ApplicationFormField>

              <ApplicationConditionalFieldsPanel
                aria-label="Financial support details"
                className="-mt-1"
                data-conditional-controller="funding-provider"
              >
                {(fundingProvider === "self" || fundingProvider === "both") &&
                  selfFundingMethods.map((option) => (
                    <ApplicationFormField
                      key={option.value}
                      label={option.text}
                      required
                      className="py-1.5"
                      labelAction={<GalleryFieldAiAssist field={option.text} />}
                    >
                      <ApplicationYesNoControl
                        name={`gallery-${option.value}`}
                        value={fundingMethods[option.value] ?? ""}
                        options={[
                          { value: "yes", text: "Yes" },
                          { value: "no", text: "No" },
                        ]}
                        onValueChange={(value) => setFundingMethod(option.value, value)}
                      />
                    </ApplicationFormField>
                  ))}

                {(fundingProvider === "sponsor" || fundingProvider === "both") &&
                  sponsorFundingMethods.map((option) => (
                    <ApplicationFormField
                      key={option.value}
                      label={option.text}
                      required
                      className="py-1.5"
                      labelAction={<GalleryFieldAiAssist field={option.text} />}
                    >
                      <ApplicationYesNoControl
                        name={`gallery-${option.value}`}
                        value={fundingMethods[option.value] ?? ""}
                        options={[
                          { value: "yes", text: "Yes" },
                          { value: "no", text: "No" },
                        ]}
                        onValueChange={(value) => setFundingMethod(option.value, value)}
                      />
                    </ApplicationFormField>
                  ))}
              </ApplicationConditionalFieldsPanel>
            </div>
          </ApplicationFormPanel>

          <ApplicationFormPanel className="p-5 md:col-span-2 xl:col-span-3">
            <div className="mb-5">
              <h2 className="text-base font-semibold text-foreground">Supporting document card</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The single upload surface for every document field — the passport step at the
                top of each application wizard, the document centre checklist, and the
                Universal Profile all render this exact component.
              </p>
            </div>
            <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
              <SupportingDocumentCard
                title="Passport bio page"
                description="Clear scan or photo of the passport bio-data page."
                required
                headerLayout="stacked"
                headerAside={
                  <AiAssistButton
                    label="Ask AI about Passport bio page"
                    variant="field"
                    className="opacity-0 focus-visible:opacity-100 group-hover/document-card:opacity-100 group-focus-within/document-card:opacity-100"
                  />
                }
              >
                <DocumentUploadField
                  status={documentFile ? "in_review" : "missing"}
                  statusLabel={documentFile ? "Uploaded" : "Missing"}
                  file={documentFile ? { source: documentFile } : null}
                  dropLabel="Drop file or browse"
                  acceptHint="PDF, JPG or PNG · max 10 MB"
                  removeLabel="Remove file"
                  onRemove={() => setDocumentFile(null)}
                  inputAriaLabel="Choose Passport bio page"
                  onFileSelected={setDocumentFile}
                />
              </SupportingDocumentCard>

              <SupportingDocumentCard
                title="Passport-size photo"
                description="Recent passport-style photo that follows the destination photo rules."
                required
                headerLayout="stacked"
              >
                <DocumentUploadField
                  status="attached"
                  statusLabel="Attached from saved profile"
                  statusMeta="640 KB"
                  file={{ name: "profile-photo.jpg", kind: "image" }}
                  dropLabel="Drop file or browse"
                  acceptHint="PDF, JPG or PNG · max 10 MB"
                  removeLabel="Remove file"
                  onFileSelected={() => undefined}
                />
              </SupportingDocumentCard>

              <SupportingDocumentCard
                title="Travel itinerary"
                description="Day-by-day route, dates, cities, and major planned activities."
                required
                headerLayout="stacked"
              >
                <DocumentUploadField
                  status="missing"
                  statusLabel="Missing"
                  dropLabel="Drop file or browse"
                  acceptHint="PDF, JPG or PNG · max 10 MB"
                  action={{
                    label: "Select from Travel AI",
                    onClick: () => undefined,
                  }}
                  removeLabel="Remove file"
                  onFileSelected={() => undefined}
                />
              </SupportingDocumentCard>

              <SupportingDocumentCard
                title="Proof of funds"
                description="Recent bank statement or equivalent financial evidence."
                required
                headerLayout="stacked"
              >
                <DocumentUploadField
                  status="in_review"
                  statusLabel="In review"
                  statusMeta="2 days ago"
                  file={{ name: "bank-statement-jul.pdf" }}
                  dropLabel="Drop file or browse"
                  acceptHint="PDF, JPG or PNG · max 10 MB"
                  removeLabel="Remove file"
                  onFileSelected={() => undefined}
                />
              </SupportingDocumentCard>

              <SupportingDocumentCard
                title="Passport-size photo"
                description="Recent passport-style photo that follows the destination photo rules."
                required
                headerLayout="stacked"
              >
                <DocumentUploadField
                  status="rejected"
                  statusLabel="Rejected"
                  statusMeta="1 day ago"
                  file={{ name: "photo-01.jpg", kind: "image" }}
                  reason="The background is not plain white. Upload a photo that follows the Japan photo rules."
                  dropLabel="Drop file or browse"
                  acceptHint="PDF, JPG or PNG · max 10 MB"
                  removeLabel="Remove file"
                  onFileSelected={() => undefined}
                />
              </SupportingDocumentCard>

              <SupportingDocumentCard
                title="Flight booking"
                description="Reservation or planned arrival and departure details, if available."
                headerLayout="stacked"
              >
                <DocumentUploadField
                  status="optional"
                  statusLabel="Not uploaded"
                  dropLabel="Drop file or browse"
                  acceptHint="PDF, JPG or PNG · max 10 MB"
                  removeLabel="Remove file"
                  onFileSelected={() => undefined}
                />
              </SupportingDocumentCard>
            </div>
          </ApplicationFormPanel>

          <section className="md:col-span-2 xl:col-span-3">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-foreground">Buttons</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Three sizes carry the whole hierarchy. Filled and outline variants are pills;
                ghost is the exception — a 6px rectangle on its own height scale.
              </p>
            </div>
            <div className="space-y-6">
              {(
                [
                  { size: "lg", label: "Large · 48px — flow CTAs, page-level actions" },
                  { size: "sm", label: "Small · 38px — alerts, empty / error states, cards, toolbars" },
                  { size: "xs", label: "Extra-small · 28px — inline actions inside alerts and rows" },
                ] as const
              ).map((row) => (
                <div key={row.size}>
                  <p className="mb-3.5 border-b border-[#efefef] pb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                    {row.label}
                  </p>
                  <div className="flex flex-wrap items-start gap-3">
                    <ActionButton size={row.size} variant="primary">
                      Continue
                    </ActionButton>
                    <ActionButton size={row.size} variant="primary" loading loadingText="Validating…">
                      Continue
                    </ActionButton>
                    <ActionButton size={row.size} variant="primary" disabled>
                      Continue
                    </ActionButton>
                    <ActionButton size={row.size} variant="secondary">
                      Re-validate
                    </ActionButton>
                    <ActionButton size={row.size} variant="secondary" loading loadingText="Checking…">
                      Re-validate
                    </ActionButton>
                    <ActionButton size={row.size} variant="neutral">
                      Check requirements
                    </ActionButton>
                    <ActionButton size={row.size} variant="outline">
                      Dismiss
                    </ActionButton>
                    <ActionButton size={row.size} variant="warning">
                      Renew passport
                    </ActionButton>
                    <ActionButton size={row.size} variant="destructive">
                      Re-upload photo
                    </ActionButton>
                    <ActionButton size={row.size} variant="ghost">
                      + Add document
                    </ActionButton>
                    <ActionButton
                      size={row.size}
                      variant="ghost"
                      className="!text-[hsl(0_84%_60%)]"
                    >
                      Delete
                    </ActionButton>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="md:col-span-2 xl:col-span-3">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-foreground">Alert</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Every inline notice across the visa application flow. Actions are 28px so they
                never compete with the page&apos;s primary CTA.
              </p>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <Alert variant="info">
                <AlertIcon variant="info" />
                <AlertTitle>Consultant reviewing</AlertTitle>
                <AlertDescription>
                  <p>
                    A human consultant will verify your documents within 24 hours. You&apos;ll be
                    notified by email.
                  </p>
                </AlertDescription>
              </Alert>

              <Alert variant="success">
                <AlertIcon variant="success" />
                <AlertTitle>Application submitted</AlertTitle>
                <AlertDescription>
                  <p>Confirmation number VZ-2026-0142 has been sent to your email.</p>
                </AlertDescription>
              </Alert>

              <Alert variant="warning">
                <AlertIcon variant="warning" />
                <AlertTitle>Passport expires soon</AlertTitle>
                <AlertDescription>
                  <p>
                    Some countries require 6 months remaining validity. Consider renewing before
                    travel.
                  </p>
                  <AlertActions>
                    <AlertAction>Check requirements</AlertAction>
                    <AlertAction variant="secondary">Dismiss</AlertAction>
                  </AlertActions>
                </AlertDescription>
              </Alert>

              <Alert variant="destructive">
                <AlertIcon variant="destructive" />
                <AlertTitle>Document rejected</AlertTitle>
                <AlertDescription>
                  <p>Passport photo doesn&apos;t meet ICAO standards. Please retake and re-upload.</p>
                  <AlertActions>
                    <AlertAction>Re-upload photo</AlertAction>
                  </AlertActions>
                </AlertDescription>
              </Alert>
            </div>
          </section>

          <section className="md:col-span-2 xl:col-span-3">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-foreground">Alert toast</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Floating form of the same notice. Fires top-right through{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">alertToast()</code>.
              </p>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <AlertToast
                variant="success"
                title="Passport uploaded"
                description="We'll let you know when review is complete."
                onDismiss={() => undefined}
              />
              <AlertToast
                variant="info"
                title="Application saved"
                description="Draft synced 2 seconds ago."
                action={<AlertToastAction>View</AlertToastAction>}
                onDismiss={() => undefined}
              />
              <AlertToast
                variant="destructive"
                title="Upload failed"
                description="Your connection dropped. Please try again."
                onDismiss={() => undefined}
              />
              <div className="flex flex-wrap items-center gap-2">
                <AlertAction
                  onClick={() =>
                    alertToast("Passport uploaded", {
                      variant: "success",
                      description: "We'll let you know when review is complete.",
                    })
                  }
                >
                  Fire success toast
                </AlertAction>
                <AlertAction
                  variant="secondary"
                  onClick={() =>
                    alertToast("Upload failed", {
                      variant: "destructive",
                      description: "Your connection dropped. Please try again.",
                      action: { label: "Retry", onClick: () => undefined },
                    })
                  }
                >
                  Fire destructive toast
                </AlertAction>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

"use client";

import { useState } from "react";
import { FileText, Trash2, UploadCloud } from "lucide-react";

import { AiAssistButton } from "@/components/ui/ai-assist-button";
import { ApplicationConditionalFieldsPanel } from "@/components/ui/application-conditional-fields-panel";
import { ApplicationFormDatePicker } from "@/components/ui/application-form-date-picker";
import { ApplicationFormField } from "@/components/ui/application-form-field";
import { ApplicationFormInputGroup } from "@/components/ui/application-form-input";
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
import { InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectValue } from "@/components/ui/select";
import { SupportingDocumentCard } from "@/components/ui/supporting-document-card";

const destinations = ["Japan", "Singapore", "France"];
const visitPurposes = [
  { value: "tourism", text: "Tourism" },
  { value: "business", text: "Business" },
  { value: "family", text: "Visit family or friends" },
  { value: "transit", text: "Transit" },
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
  const [documentFileName, setDocumentFileName] = useState("");

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

          <section className="md:col-span-2 xl:col-span-3">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-foreground">Supporting document card</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Shared by application document checklists and the Universal Profile.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <SupportingDocumentCard
                icon={<FileText className="h-5 w-5" />}
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
                <label className="relative mt-auto flex min-h-24 cursor-pointer items-center gap-3 rounded-lg border border-dashed border-brand-200 bg-brand-50/40 px-4 py-3 transition-colors hover:border-brand-400 hover:bg-brand-50 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
                  <input
                    type="file"
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    onChange={(event) => setDocumentFileName(event.target.files?.[0]?.name ?? "")}
                    aria-label="Choose Passport bio page"
                  />
                  <UploadCloud className="h-5 w-5 shrink-0 text-brand-500" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {documentFileName || "Drop a file here, or click to choose"}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      PDF, JPG, PNG, WebP, DOC or DOCX
                    </span>
                  </span>
                </label>
              </SupportingDocumentCard>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

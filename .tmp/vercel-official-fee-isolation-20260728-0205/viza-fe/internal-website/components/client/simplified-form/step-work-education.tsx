"use client";

import { BriefcaseBusiness, GraduationCap, Plus, Shield, Trash2, Users, Wrench } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CountryDropdown } from "@/components/ui/country-dropdown";
import { DatePicker } from "@/components/ui/date-picker";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BrandField, BrandInput } from "@/components/client/brand-field";
import { TabChoice } from "@/components/client/simplified-form/tab-choice";
import type { EducationEntry, MilitaryService, OccupationKey, PreviousEmployer, SimplifiedWork } from "./types";
import { isEmployedOccupation } from "./types";

const OCCUPATIONS: OccupationKey[] = [
  "AGRICULTURE",
  "ARTIST/PERFORMER",
  "BUSINESS",
  "COMMUNICATIONS",
  "COMPUTER SCIENCE",
  "CULINARY/FOOD SERVICES",
  "EDUCATION",
  "ENGINEERING",
  "GOVERNMENT",
  "LEGAL PROFESSION",
  "MEDICAL/HEALTH",
  "MILITARY",
  "NATURAL SCIENCE",
  "PHYSICAL SCIENCES",
  "RELIGIOUS VOCATION",
  "RESEARCH",
  "SOCIAL SCIENCE",
  "STUDENT",
  "HOMEMAKER",
  "RETIRED",
  "NOT EMPLOYED",
  "OTHER",
];

const DIAL_CODES: Array<{ label: string; value: string }> = [
  { label: "🇨🇳 +86", value: "+86" },
  { label: "🇸🇬 +65", value: "+65" },
  { label: "🇺🇸 +1", value: "+1" },
  { label: "🇬🇧 +44", value: "+44" },
  { label: "🇲🇾 +60", value: "+60" },
  { label: "🇮🇳 +91", value: "+91" },
  { label: "🇵🇭 +63", value: "+63" },
  { label: "🇯🇵 +81", value: "+81" },
  { label: "🇰🇷 +82", value: "+82" },
];

const SALARY_CURRENCIES = ["USD", "CNY", "SGD", "MYR", "PHP", "EUR", "GBP"] as const;

function emptyPreviousEmployer(): PreviousEmployer {
  return {
    employerName: "",
    jobTitle: "",
    jobDuties: "",
    city: "",
    country: "",
    street: "",
    supervisorFirstName: "",
    supervisorLastName: "",
    phoneDialCode: "+86",
    phone: "",
    startDate: "",
    endDate: "",
  };
}

function emptyEducationEntry(): EducationEntry {
  return {
    level: "",
    institution: "",
    course: "",
    city: "",
    country: "",
    startDate: "",
    endDate: "",
  };
}

function emptyMilitaryService(): MilitaryService {
  return {
    country: "",
    branch: "",
    rank: "",
    specialty: "",
    startDate: "",
    endDate: "",
  };
}

interface StepWorkEducationProps {
  value: SimplifiedWork;
  onChange: (value: SimplifiedWork) => void;
  onContinue: () => void;
}

export function StepWorkEducation({ value, onChange, onContinue }: StepWorkEducationProps) {
  const t = useTranslations("simplifiedForm.workEducation");
  const tCommon = useTranslations("simplifiedForm.common");

  const set = <K extends keyof SimplifiedWork>(key: K, next: SimplifiedWork[K]) =>
    onChange({ ...value, [key]: next });

  const showCurrentWork = isEmployedOccupation(value.primaryOccupation) || value.primaryOccupation === "OTHER";
  const showStudentDetails = value.primaryOccupation === "STUDENT";
  const showOccupationExplanation = value.primaryOccupation === "OTHER" || value.primaryOccupation === "NOT EMPLOYED";
  const showDetails = showCurrentWork || showStudentDetails;
  const previousEmployers = value.previousEmployers.length ? value.previousEmployers : [emptyPreviousEmployer()];
  const canAddPreviousEmployer = previousEmployers.length < 5;
  const educationEntries = value.educationEntries.length ? value.educationEntries : [emptyEducationEntry()];
  const canAddEducation = educationEntries.length < 5;
  const organizations = value.organizations.length ? value.organizations : [""];
  const canAddOrganization = organizations.length < 10;
  const militaryServices = value.militaryServices.length ? value.militaryServices : [emptyMilitaryService()];
  const canAddMilitaryService = militaryServices.length < 5;

  const setPreviousEmployer = <K extends keyof PreviousEmployer>(
    index: number,
    key: K,
    next: PreviousEmployer[K],
  ) => {
    const current = value.previousEmployers.length ? value.previousEmployers : [emptyPreviousEmployer()];
    set("previousEmployers", current.map((employer, i) => (i === index ? { ...employer, [key]: next } : employer)));
  };

  const setEducationEntry = <K extends keyof EducationEntry>(
    index: number,
    key: K,
    next: EducationEntry[K],
  ) => {
    const current = value.educationEntries.length ? value.educationEntries : [emptyEducationEntry()];
    set("educationEntries", current.map((education, i) => (i === index ? { ...education, [key]: next } : education)));
  };

  const setMilitaryService = <K extends keyof MilitaryService>(
    index: number,
    key: K,
    next: MilitaryService[K],
  ) => {
    const current = value.militaryServices.length ? value.militaryServices : [emptyMilitaryService()];
    set("militaryServices", current.map((service, i) => (i === index ? { ...service, [key]: next } : service)));
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">{t("subtitle")}</p>
      </header>

      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <BriefcaseBusiness className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {showStudentDetails ? t("educationDetailsTitle") : t("currentTitle")}
            </p>
            <p className="text-xs text-muted-foreground">
              {showStudentDetails ? t("educationDetailsSubtitle") : t("currentSubtitle")}
            </p>
          </div>
        </div>

        <BrandField label={t("primaryOccupation")} required>
          <Select value={value.primaryOccupation} onValueChange={(next) => set("primaryOccupation", next as OccupationKey)}>
            <SelectTrigger className="h-12 rounded-lg border-[#e8e8e8] text-[15px]">
              <SelectValue placeholder={t("primaryOccupationPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {OCCUPATIONS.map((occupation) => (
                <SelectItem key={occupation} value={occupation}>
                  {t(`occupation.${occupation}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </BrandField>

        {showOccupationExplanation ? (
          <BrandField label={t("occupationOtherExplain")} required>
            <textarea
              value={value.occupationOtherExplain}
              onChange={(e) => set("occupationOtherExplain", e.target.value)}
              placeholder={t("occupationOtherExplainPlaceholder")}
              rows={4}
              className="w-full resize-none rounded-lg border border-[#e8e8e8] px-3 py-2.5 text-[15px] focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </BrandField>
        ) : null}

        {showDetails ? (
          <div className="grid gap-x-4 gap-y-4 border-t border-border/60 pt-4 sm:grid-cols-2">
            <BrandField label={showStudentDetails ? t("schoolName") : t("employerName")} required className="sm:col-span-2">
              <BrandInput
                value={value.employerName}
                onChange={(e) => set("employerName", e.target.value)}
                placeholder={showStudentDetails ? t("schoolNamePlaceholder") : t("employerNamePlaceholder")}
              />
            </BrandField>
            {showCurrentWork ? (
              <>
                <BrandField label={t("jobTitle")} className="sm:col-span-2">
                  <BrandInput
                    value={value.jobTitle}
                    onChange={(e) => set("jobTitle", e.target.value)}
                    placeholder={t("jobTitlePlaceholder")}
                  />
                </BrandField>
                <BrandField label={t("jobDuties")} required className="sm:col-span-2">
                  <textarea
                    value={value.jobDuties}
                    onChange={(e) => set("jobDuties", e.target.value)}
                    rows={4}
                    placeholder={t("jobDutiesPlaceholder")}
                    className="w-full resize-none rounded-lg border border-[#e8e8e8] px-3 py-2.5 text-[15px] focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </BrandField>
              </>
            ) : null}
            <BrandField label={showStudentDetails ? t("schoolStreet") : t("employerStreet")} required className="sm:col-span-2">
              <BrandInput
                value={value.employerStreet}
                onChange={(e) => set("employerStreet", e.target.value)}
                placeholder={t("streetPlaceholder")}
              />
            </BrandField>
            <BrandField label={t("employerCity")} required>
              <BrandInput
                value={value.employerCity}
                onChange={(e) => set("employerCity", e.target.value)}
                placeholder={t("cityPlaceholder")}
              />
            </BrandField>
            <BrandField label={t("employerState")}>
              <BrandInput
                value={value.employerState}
                onChange={(e) => set("employerState", e.target.value)}
                placeholder={t("statePlaceholder")}
              />
            </BrandField>
            <BrandField label={t("employerPostal")}>
              <BrandInput
                value={value.employerPostal}
                onChange={(e) => set("employerPostal", e.target.value)}
                placeholder={t("postalPlaceholder")}
              />
            </BrandField>
            <BrandField label={t("employerCountry")} required>
              <CountryDropdown
                defaultValue={value.employerCountry}
                onChange={(country) => {
                  const dialCode = country.countryCallingCodes[0];
                  onChange({
                    ...value,
                    employerCountry: country.alpha3,
                    employerPhoneDialCode: dialCode || value.employerPhoneDialCode,
                  });
                }}
                placeholder={t("countryPlaceholder")}
              />
            </BrandField>
            <BrandField label={showStudentDetails ? t("schoolPhone") : t("employerPhone")} required className="sm:col-span-2">
              <InputGroup className="h-12">
                <InputGroupAddon className="h-12 rounded-l-lg border-[#e8e8e8] bg-white px-2">
                  <select
                    value={value.employerPhoneDialCode}
                    onChange={(e) => set("employerPhoneDialCode", e.target.value)}
                    className="h-8 border-0 bg-transparent pr-1 text-sm outline-none"
                    aria-label={t("dialCode")}
                  >
                    {DIAL_CODES.map((code) => (
                      <option key={code.value} value={code.value}>
                        {code.label}
                      </option>
                    ))}
                  </select>
                </InputGroupAddon>
                <InputGroupInput
                  value={value.employerPhone}
                  onChange={(e) => set("employerPhone", e.target.value)}
                  placeholder={t("phonePlaceholder")}
                />
              </InputGroup>
            </BrandField>
            <BrandField label={t("employmentStartDate")} required className="sm:col-span-2">
              <DatePicker
                value={value.employmentStartDate}
                onChange={(next) => set("employmentStartDate", next)}
                placeholder={t("datePlaceholder")}
              />
            </BrandField>
            <BrandField label={t("monthlySalary")} hint={t("monthlySalaryHint")} className="sm:col-span-2">
              <label className="mb-1 inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox
                  checked={value.noMonthlySalary}
                  onCheckedChange={(checked) => {
                    const next = checked === true;
                    onChange({
                      ...value,
                      noMonthlySalary: next,
                      monthlySalary: next ? "" : value.monthlySalary,
                    });
                  }}
                />
                {t("noMonthlySalary")}
              </label>
              {!value.noMonthlySalary ? (
                <InputGroup className="h-12">
                  <InputGroupAddon className="h-12 rounded-l-lg border-[#e8e8e8] bg-white px-2">
                    <select
                      value={value.monthlySalaryCurrency}
                      onChange={(e) => set("monthlySalaryCurrency", e.target.value)}
                      className="h-8 border-0 bg-transparent pr-1 text-sm outline-none"
                      aria-label={t("salaryCurrency")}
                    >
                      {SALARY_CURRENCIES.map((currency) => (
                        <option key={currency} value={currency}>
                          {currency}
                        </option>
                      ))}
                    </select>
                  </InputGroupAddon>
                  <InputGroupInput
                    value={value.monthlySalary}
                    onChange={(e) => set("monthlySalary", e.target.value)}
                    placeholder={t("monthlySalaryPlaceholder")}
                  />
                </InputGroup>
              ) : null}
            </BrandField>
            {showStudentDetails ? (
              <BrandField label={t("courseOfStudy")} required className="sm:col-span-2">
                <textarea
                  value={value.jobTitle}
                  onChange={(e) => set("jobTitle", e.target.value)}
                  rows={3}
                  placeholder={t("courseOfStudyPlaceholder")}
                  className="w-full resize-none rounded-lg border border-[#e8e8e8] px-3 py-2.5 text-[15px] focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </BrandField>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <BriefcaseBusiness className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{t("previousEmployerTitle")}</p>
            <p className="text-xs text-muted-foreground">{t("previousEmployerSubtitle")}</p>
          </div>
        </div>

        <TabChoice
          name="has-previous-employer"
          value={value.hasPreviousEmployer}
          columns={2}
          onChange={(next) => {
            const hasPreviousEmployer = next as "yes" | "no";
            onChange({
              ...value,
              hasPreviousEmployer,
              previousEmployers: hasPreviousEmployer === "yes" && !value.previousEmployers.length
                ? [emptyPreviousEmployer()]
                : value.previousEmployers,
            });
          }}
          ariaLabel={t("hasPreviousEmployer")}
          options={[
            { value: "yes", label: tCommon("yes") },
            { value: "no", label: tCommon("no") },
          ]}
        />

        {value.hasPreviousEmployer === "yes" ? (
          <div className="flex flex-col gap-4 border-t border-border/60 pt-4">
            {previousEmployers.map((employer, index) => (
              <div key={index} className="flex flex-col gap-4 rounded-xl bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">{t("previousEmployerN", { n: index + 1 })}</p>
                  {previousEmployers.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => set("previousEmployers", previousEmployers.filter((_, i) => i !== index))}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={t("removePreviousEmployer")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>

                <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
                  <BrandField label={t("prevEmployerName")} required>
                    <BrandInput
                      value={employer.employerName}
                      onChange={(e) => setPreviousEmployer(index, "employerName", e.target.value)}
                      placeholder={t("employerNamePlaceholder")}
                    />
                  </BrandField>
                  <BrandField label={t("prevJobTitle")} required>
                    <BrandInput
                      value={employer.jobTitle}
                      onChange={(e) => setPreviousEmployer(index, "jobTitle", e.target.value)}
                      placeholder={t("jobTitlePlaceholder")}
                    />
                  </BrandField>
                  <BrandField label={t("prevJobDuties")} className="sm:col-span-2">
                    <BrandInput
                      value={employer.jobDuties}
                      onChange={(e) => setPreviousEmployer(index, "jobDuties", e.target.value)}
                      placeholder={t("prevJobDutiesPlaceholder")}
                    />
                  </BrandField>
                  <BrandField label={t("employerCity")} required>
                    <BrandInput
                      value={employer.city}
                      onChange={(e) => setPreviousEmployer(index, "city", e.target.value)}
                      placeholder={t("cityPlaceholder")}
                    />
                  </BrandField>
                  <BrandField label={t("employerCountry")} required>
                    <CountryDropdown
                      defaultValue={employer.country}
                      onChange={(country) => {
                        const dialCode = country.countryCallingCodes[0];
                        const current = value.previousEmployers.length ? value.previousEmployers : [emptyPreviousEmployer()];
                        set("previousEmployers", current.map((item, i) => (
                          i === index
                            ? { ...item, country: country.alpha3, phoneDialCode: dialCode || item.phoneDialCode }
                            : item
                        )));
                      }}
                      placeholder={t("countryPlaceholder")}
                    />
                  </BrandField>
                  <BrandField label={t("employerStreet")} required className="sm:col-span-2">
                    <BrandInput
                      value={employer.street}
                      onChange={(e) => setPreviousEmployer(index, "street", e.target.value)}
                      placeholder={t("streetPlaceholder")}
                    />
                  </BrandField>
                  <BrandField label={t("supervisorFirstName")}>
                    <BrandInput
                      value={employer.supervisorFirstName}
                      onChange={(e) => setPreviousEmployer(index, "supervisorFirstName", e.target.value)}
                      placeholder={t("supervisorFirstNamePlaceholder")}
                    />
                  </BrandField>
                  <BrandField label={t("supervisorLastName")}>
                    <BrandInput
                      value={employer.supervisorLastName}
                      onChange={(e) => setPreviousEmployer(index, "supervisorLastName", e.target.value)}
                      placeholder={t("supervisorLastNamePlaceholder")}
                    />
                  </BrandField>
                  <BrandField label={t("employerPhone")} required className="sm:col-span-2">
                    <InputGroup className="h-12">
                      <InputGroupAddon className="h-12 rounded-l-lg border-[#e8e8e8] bg-white px-2">
                        <select
                          value={employer.phoneDialCode}
                          onChange={(e) => setPreviousEmployer(index, "phoneDialCode", e.target.value)}
                          className="h-8 border-0 bg-transparent pr-1 text-sm outline-none"
                          aria-label={t("dialCode")}
                        >
                          {DIAL_CODES.map((code) => (
                            <option key={code.value} value={code.value}>
                              {code.label}
                            </option>
                          ))}
                        </select>
                      </InputGroupAddon>
                      <InputGroupInput
                        value={employer.phone}
                        onChange={(e) => setPreviousEmployer(index, "phone", e.target.value)}
                        placeholder={t("phonePlaceholder")}
                      />
                    </InputGroup>
                  </BrandField>
                  <BrandField label={t("prevEmploymentStart")} required>
                    <DatePicker
                      value={employer.startDate}
                      onChange={(next) => setPreviousEmployer(index, "startDate", next)}
                      placeholder={t("datePlaceholder")}
                    />
                  </BrandField>
                  <BrandField label={t("prevEmploymentEnd")} required>
                    <DatePicker
                      value={employer.endDate}
                      onChange={(next) => setPreviousEmployer(index, "endDate", next)}
                      placeholder={t("datePlaceholder")}
                    />
                  </BrandField>
                </div>
              </div>
            ))}

            {canAddPreviousEmployer ? (
              <button
                type="button"
                onClick={() => set("previousEmployers", [...previousEmployers, emptyPreviousEmployer()])}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-4 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-500"
              >
                <Plus className="h-4 w-4" />
                {t("addPreviousEmployer")}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <GraduationCap className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{t("educationHistoryTitle")}</p>
            <p className="text-xs text-muted-foreground">{t("educationHistorySubtitle")}</p>
          </div>
        </div>

        <TabChoice
          name="has-attended-education"
          value={value.hasAttendedEducation}
          columns={2}
          onChange={(next) => {
            const hasAttendedEducation = next as "yes" | "no";
            onChange({
              ...value,
              hasAttendedEducation,
              educationEntries: hasAttendedEducation === "yes" && !value.educationEntries.length
                ? [emptyEducationEntry()]
                : value.educationEntries,
            });
          }}
          ariaLabel={t("hasAttendedEducation")}
          options={[
            { value: "yes", label: tCommon("yes") },
            { value: "no", label: tCommon("no") },
          ]}
        />

        {value.hasAttendedEducation === "yes" ? (
          <div className="flex flex-col gap-4 border-t border-border/60 pt-4">
            {educationEntries.map((education, index) => (
              <div key={index} className="flex flex-col gap-4 rounded-xl bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">{t("educationN", { n: index + 1 })}</p>
                  {educationEntries.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => set("educationEntries", educationEntries.filter((_, i) => i !== index))}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={t("removeEducation")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>

                <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
                  <BrandField label={t("educationLevel")}>
                    <Select value={education.level} onValueChange={(next) => setEducationEntry(index, "level", next)}>
                      <SelectTrigger className="h-12 rounded-lg border-[#e8e8e8] text-[15px]">
                        <SelectValue placeholder={t("educationLevelPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="secondary">{t("educationLevelSecondary")}</SelectItem>
                        <SelectItem value="college">{t("educationLevelCollege")}</SelectItem>
                        <SelectItem value="vocational_other">{t("educationLevelVocationalOther")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </BrandField>
                  <div />
                  <BrandField label={t("educationInstitution")} required className="sm:col-span-2">
                    <BrandInput
                      value={education.institution}
                      onChange={(e) => setEducationEntry(index, "institution", e.target.value)}
                      placeholder={t("educationInstitutionPlaceholder")}
                    />
                  </BrandField>
                  <BrandField label={t("educationCourse")} required className="sm:col-span-2">
                    <BrandInput
                      value={education.course}
                      onChange={(e) => setEducationEntry(index, "course", e.target.value)}
                      placeholder={t("courseOfStudyPlaceholder")}
                    />
                  </BrandField>
                  <BrandField label={t("educationCity")} required>
                    <BrandInput
                      value={education.city}
                      onChange={(e) => setEducationEntry(index, "city", e.target.value)}
                      placeholder={t("cityPlaceholder")}
                    />
                  </BrandField>
                  <BrandField label={t("educationCountry")} required>
                    <CountryDropdown
                      defaultValue={education.country}
                      onChange={(country) => setEducationEntry(index, "country", country.alpha3)}
                      placeholder={t("countryPlaceholder")}
                    />
                  </BrandField>
                  <BrandField label={t("educationStart")} required>
                    <DatePicker value={education.startDate} onChange={(next) => setEducationEntry(index, "startDate", next)} placeholder={t("datePlaceholder")} />
                  </BrandField>
                  <BrandField label={t("educationEnd")} required>
                    <DatePicker value={education.endDate} onChange={(next) => setEducationEntry(index, "endDate", next)} placeholder={t("datePlaceholder")} />
                  </BrandField>
                </div>
              </div>
            ))}

            {canAddEducation ? (
              <button
                type="button"
                onClick={() => set("educationEntries", [...educationEntries, emptyEducationEntry()])}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-4 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-500"
              >
                <Plus className="h-4 w-4" />
                {t("addEducation")}
              </button>
            ) : null}
            <p className="text-center text-xs text-muted-foreground">{t("educationHistoryFootnote")}</p>
          </div>
        ) : (
          <p className="border-t border-border/60 pt-4 text-center text-sm text-muted-foreground">{t("noEducationHint")}</p>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{t("organizationTitle")}</p>
            <p className="text-xs text-muted-foreground">{t("organizationSubtitle")}</p>
          </div>
        </div>

        <TabChoice
          name="has-belonged-to-organization"
          value={value.hasBelongedToOrganization}
          columns={2}
          onChange={(next) => {
            const hasBelongedToOrganization = next as "yes" | "no";
            onChange({
              ...value,
              hasBelongedToOrganization,
              organizations: hasBelongedToOrganization === "yes" && !value.organizations.length ? [""] : value.organizations,
            });
          }}
          ariaLabel={t("organizationTitle")}
          options={[
            { value: "yes", label: tCommon("yes") },
            { value: "no", label: tCommon("no") },
          ]}
        />

        {value.hasBelongedToOrganization === "yes" ? (
          <div className="flex flex-col gap-4 border-t border-border/60 pt-4">
            {organizations.map((organization, index) => (
              <div key={index} className="flex flex-col gap-4 rounded-xl bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">{t("organizationN", { n: index + 1 })}</p>
                  {organizations.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => set("organizations", organizations.filter((_, i) => i !== index))}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={t("removeOrganization")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                <BrandField label={t("organizationName")}>
                  <BrandInput
                    value={organization}
                    onChange={(e) => set("organizations", organizations.map((item, i) => (i === index ? e.target.value : item)))}
                    placeholder={t("organizationNamePlaceholder")}
                  />
                </BrandField>
              </div>
            ))}

            {canAddOrganization ? (
              <button
                type="button"
                onClick={() => set("organizations", [...organizations, ""])}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-4 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-500"
              >
                <Plus className="h-4 w-4" />
                {t("addOrganization")}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Shield className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{t("militaryTitle")}</p>
            <p className="text-xs text-muted-foreground">{t("militarySubtitle")}</p>
          </div>
        </div>

        <TabChoice
          name="has-served-military"
          value={value.hasServedMilitary}
          columns={2}
          onChange={(next) => {
            const hasServedMilitary = next as "yes" | "no";
            onChange({
              ...value,
              hasServedMilitary,
              militaryServices: hasServedMilitary === "yes" && !value.militaryServices.length
                ? [emptyMilitaryService()]
                : value.militaryServices,
            });
          }}
          ariaLabel={t("militaryTitle")}
          options={[
            { value: "yes", label: tCommon("yes") },
            { value: "no", label: tCommon("no") },
          ]}
        />

        {value.hasServedMilitary === "yes" ? (
          <div className="flex flex-col gap-4 border-t border-border/60 pt-4">
            {militaryServices.map((service, index) => (
              <div key={index} className="flex flex-col gap-4 rounded-xl bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">{t("militaryServiceN", { n: index + 1 })}</p>
                  {militaryServices.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => set("militaryServices", militaryServices.filter((_, i) => i !== index))}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={t("removeMilitaryService")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
                  <BrandField label={t("militaryCountry")} required className="sm:col-span-2">
                    <CountryDropdown
                      defaultValue={service.country}
                      onChange={(country) => setMilitaryService(index, "country", country.alpha3)}
                      placeholder={t("countryPlaceholder")}
                    />
                  </BrandField>
                  <BrandField label={t("militaryBranch")} required>
                    <BrandInput value={service.branch} onChange={(e) => setMilitaryService(index, "branch", e.target.value)} placeholder={t("militaryBranchPlaceholder")} />
                  </BrandField>
                  <BrandField label={t("militaryRank")} required>
                    <BrandInput value={service.rank} onChange={(e) => setMilitaryService(index, "rank", e.target.value)} placeholder={t("militaryRankPlaceholder")} />
                  </BrandField>
                  <BrandField label={t("militarySpecialty")} className="sm:col-span-2">
                    <BrandInput value={service.specialty} onChange={(e) => setMilitaryService(index, "specialty", e.target.value)} placeholder={t("militarySpecialtyPlaceholder")} />
                  </BrandField>
                  <BrandField label={t("militaryStartDate")} required>
                    <DatePicker value={service.startDate} onChange={(next) => setMilitaryService(index, "startDate", next)} placeholder={t("datePlaceholder")} />
                  </BrandField>
                  <BrandField label={t("militaryEndDate")} required>
                    <DatePicker value={service.endDate} onChange={(next) => setMilitaryService(index, "endDate", next)} placeholder={t("datePlaceholder")} />
                  </BrandField>
                </div>
              </div>
            ))}

            {canAddMilitaryService ? (
              <button
                type="button"
                onClick={() => set("militaryServices", [...militaryServices, emptyMilitaryService()])}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-4 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-500"
              >
                <Plus className="h-4 w-4" />
                {t("addMilitaryService")}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Wrench className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{t("specializedSkillsTitle")}</p>
            <p className="text-xs text-muted-foreground">{t("specializedSkillsSubtitle")}</p>
          </div>
        </div>

        <TabChoice
          name="has-specialized-skills"
          value={value.hasSpecializedSkills}
          columns={2}
          onChange={(next) => set("hasSpecializedSkills", next as "yes" | "no")}
          ariaLabel={t("specializedSkillsTitle")}
          options={[
            { value: "yes", label: tCommon("yes") },
            { value: "no", label: tCommon("no") },
          ]}
        />

        {value.hasSpecializedSkills === "yes" ? (
          <BrandField label={t("specializedSkillsExplain")}>
            <textarea
              value={value.specializedSkillsExplain}
              onChange={(e) => set("specializedSkillsExplain", e.target.value)}
              rows={4}
              placeholder={t("specializedSkillsExplainPlaceholder")}
              className="w-full resize-none rounded-lg border border-[#e8e8e8] px-3 py-2.5 text-[15px] focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </BrandField>
        ) : null}
      </div>

      <Button
        type="button"
        onClick={onContinue}
        className="mt-2 h-12 rounded-lg bg-brand-500 text-[15px] font-medium text-white hover:bg-brand-500/90"
      >
        {tCommon("continue")}
      </Button>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, ScanLine, Keyboard, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandInput, BrandField } from "@/components/client/brand-field";
import { DatePicker } from "@/components/ui/date-picker";
import { CountryDropdown } from "@/components/ui/country-dropdown";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TabChoice } from "./tab-choice";
import { StepIdentityScan } from "./step-identity-scan";
import type { SimplifiedIdentity, SimplifiedPassport } from "./types";

interface StepIdentityProps {
  value: SimplifiedIdentity;
  onChange: (value: SimplifiedIdentity) => void;
  onContinue: () => void;
  applicationId?: string | null;
  onPassportExtracted?: (passport: Partial<SimplifiedPassport>) => void;
}

export function StepIdentity({
  value,
  onChange,
  onContinue,
  applicationId = null,
  onPassportExtracted,
}: StepIdentityProps) {
  const t = useTranslations("simplifiedForm.identity");
  const tCommon = useTranslations("simplifiedForm.common");
  const [openHelp, setOpenHelp] = useState<"hasOtherName" | "hasNativeAlphabet" | "hasTelecode" | null>(
    null,
  );
  const [mode, setMode] = useState<"choose" | "scan" | "manual">(
    value.firstName || value.lastName ? "manual" : "choose",
  );
  const [passportUploadSaved, setPassportUploadSaved] = useState(false);

  const set = <K extends keyof SimplifiedIdentity>(key: K, next: SimplifiedIdentity[K]) =>
    onChange({ ...value, [key]: next });

  const renderFieldLabel = (
    label: string,
    key: "hasOtherName" | "hasNativeAlphabet" | "hasTelecode",
    tooltip: string,
  ) => {
    const [description, example] = tooltip
      .split(/例如：|For example:/)
      .map((part) => part.trim());

    return (
      <span className="inline-flex items-center gap-2">
        <span>{label}</span>
        <Popover open={openHelp === key} onOpenChange={(open) => setOpenHelp(open ? key : null)}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={label}
              className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#d0d9e6] bg-white text-[#4f5d75] transition-colors hover:bg-muted"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={8}
            className="w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-[#e8edf4] bg-white p-4 text-[15px] text-foreground shadow-lg"
          >
            <button
              type="button"
              onClick={() => setOpenHelp(null)}
              className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
              aria-label="Close help"
            >
              <X className="h-4 w-4" />
            </button>
            <p className="pr-8 leading-7">{description}</p>
            {example ? (
              <div className="mt-3 rounded-xl bg-muted/50 px-4 py-2.5 text-muted-foreground">
                Example: {example}
              </div>
            ) : null}
          </PopoverContent>
        </Popover>
      </span>
    );
  };

  const canContinue = true;

  if (mode === "scan") {
    return (
      <StepIdentityScan
        applicationId={applicationId}
        onExtracted={(identityPatch, passportPatch) => {
          onChange({ ...value, ...identityPatch });
          if (onPassportExtracted && Object.keys(passportPatch).length > 0) {
            onPassportExtracted(passportPatch);
          }
          setPassportUploadSaved(true);
          setMode("manual");
        }}
        onCancel={() => setMode("choose")}
        onFallbackManual={() => setMode("manual")}
      />
    );
  }

  if (mode === "choose") {
    return (
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {t("scanTitle")}
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">{t("scanSubtitle")}</p>
        </header>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMode("scan")}
            className="group flex flex-col items-start gap-3 rounded-xl border border-input bg-white p-5 text-left transition-colors hover:border-brand-500 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-500 group-hover:bg-white">
              <ScanLine className="h-5 w-5" />
            </span>
            <div className="flex flex-col gap-1">
              <span className="text-[15px] font-semibold text-foreground">{t("scanOption")}</span>
              <span className="text-xs text-muted-foreground">{t("scanOptionHint")}</span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setMode("manual")}
            className="group flex flex-col items-start gap-3 rounded-xl border border-input bg-white p-5 text-left transition-colors hover:border-brand-500 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-500 group-hover:bg-white">
              <Keyboard className="h-5 w-5" />
            </span>
            <div className="flex flex-col gap-1">
              <span className="text-[15px] font-semibold text-foreground">{t("manualOption")}</span>
              <span className="text-xs text-muted-foreground">{t("manualDescription")}</span>
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">{t("subtitle")}</p>
      </header>
      {passportUploadSaved ? (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">{t("scanUploadedSuccess")}</p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <BrandField label={t("firstName")} htmlFor="first-name" required>
          <BrandInput
            id="first-name"
            value={value.firstName}
            onChange={(e) => set("firstName", e.target.value)}
            placeholder={t("firstNamePlaceholder")}
            autoComplete="given-name"
            required
          />
        </BrandField>
        <BrandField label={t("lastName")} htmlFor="last-name" required>
          <BrandInput
            id="last-name"
            value={value.lastName}
            onChange={(e) => set("lastName", e.target.value)}
            placeholder={t("lastNamePlaceholder")}
            autoComplete="family-name"
            required
          />
        </BrandField>
      </div>

      {/* Date of Birth * */}
      <div>
        <BrandField label={t("dateOfBirth")} required>
          <DatePicker
            value={value.dob}
            onChange={(next) => set("dob", next)}
            placeholder={t("dateOfBirthPlaceholder")}
          />
        </BrandField>
      </div>

      {/* Gender * */}
      <div>
        <BrandField label={t("gender")} required>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="gender"
                value="Male"
                checked={value.gender === "Male"}
                onChange={() => set("gender", "Male")}
                className="w-4 h-4"
              />
              <span>{t("male")}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="gender"
                value="Female"
                checked={value.gender === "Female"}
                onChange={() => set("gender", "Female")}
                className="w-4 h-4"
              />
              <span>{t("female")}</span>
            </label>
          </div>
        </BrandField>
      </div>

      {/* Country of Birth * */}
      <div>
        <label className="block font-medium mb-2">
          {t("countryOfBirth")} <span className="text-red-500">*</span>
        </label>
        <CountryDropdown
          defaultValue={value.countryOfBirth}
          placeholder={t("countryOfBirthPlaceholder")}
          onChange={(country) =>
            onChange({
              ...value,
              countryOfBirth: country.alpha3,
              nationality: value.nationality || country.alpha3,
            })
          }
        />
      </div>

      {/* City of Birth * */}
      <div>
        <label className="block font-medium mb-2">
          {t("cityOfBirth")} <span className="text-red-500">*</span>
        </label>
        <BrandInput
          value={value.cityOfBirth}
          onChange={(e) => set("cityOfBirth", e.target.value)}
          placeholder={t("cityOfBirthPlaceholder")}
          required
        />
      </div>

      {/* No State/Province Checkbox */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="no-state"
          checked={value.hasNoStateOfBirth}
          onChange={(e) => set("hasNoStateOfBirth", e.target.checked)}
          className="w-4 h-4 cursor-pointer"
        />
        <label htmlFor="no-state" className="cursor-pointer">
          {t("noStateProvince")}
        </label>
      </div>

      {/* State/Province (conditional) */}
      {!value.hasNoStateOfBirth && (
        <div>
          <label className="block font-medium mb-2">
            {t("stateOfBirth")} <span className="text-red-500">*</span>
          </label>
          <BrandInput
            value={value.stateOfBirth}
            onChange={(e) => set("stateOfBirth", e.target.value)}
            placeholder={t("stateOfBirthPlaceholder")}
          />
        </div>
      )}

      {/* Nationality * */}
      <div>
        <label className="block font-medium mb-2">
          {t("nationality")} <span className="text-red-500">*</span>
        </label>
        <CountryDropdown
          defaultValue={value.nationality}
          placeholder={t("nationalityPlaceholder")}
          onChange={(country) => set("nationality", country.alpha3)}
        />
      </div>

      {/* Marital Status * */}
      <div>
        <label className="block font-medium mb-2">
          {t("maritalStatus")} <span className="text-red-500">*</span>
        </label>
        <select
          value={value.maritalStatus}
          onChange={(e) => set("maritalStatus", e.target.value as SimplifiedIdentity["maritalStatus"])}
          className="w-full border rounded-lg px-3 py-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
          required
        >
          <option value="">{t("maritalStatusPlaceholder")}</option>
          <option value="Single">{t("single")}</option>
          <option value="Married">{t("married")}</option>
          <option value="Common Law Marriage">{t("commonLawMarriage")}</option>
          <option value="Civil Union / Domestic Partnership">{t("civilUnion")}</option>
          <option value="Legally Separated">{t("legallySeparated")}</option>
          <option value="Divorced">{t("divorced")}</option>
          <option value="Widowed">{t("widowed")}</option>
          <option value="Other">{t("other")}</option>
        </select>
      </div>

      {value.maritalStatus === "Other" ? (
        <BrandField label={t("maritalStatusOtherExplain")} required>
          <BrandInput
            value={value.maritalStatusOtherExplain}
            onChange={(e) => set("maritalStatusOtherExplain", e.target.value)}
            placeholder={t("maritalStatusOtherExplainPlaceholder")}
          />
        </BrandField>
      ) : null}

      <BrandField
        label={renderFieldLabel(t("hasOtherName"), "hasOtherName", t("hasOtherNameTooltip"))}
      >
        <TabChoice
          name="has-other-name"
          value={value.hasOtherName ? "yes" : "no"}
          columns={2}
          onChange={(next) => set("hasOtherName", next === "yes")}
          ariaLabel={t("hasOtherName")}
          options={[
            { value: "yes", label: tCommon("yes") },
            { value: "no", label: tCommon("no") },
          ]}
        />
        {value.hasOtherName ? (
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <BrandInput
              value={value.otherFirstName}
              onChange={(e) => set("otherFirstName", e.target.value)}
              placeholder={t("otherFirstNamePlaceholder")}
              aria-label={t("otherFirstName")}
            />
            <BrandInput
              value={value.otherLastName}
              onChange={(e) => set("otherLastName", e.target.value)}
              placeholder={t("otherLastNamePlaceholder")}
              aria-label={t("otherLastName")}
            />
          </div>
        ) : null}
      </BrandField>

      <BrandField
        label={renderFieldLabel(
          t("hasNativeAlphabet"),
          "hasNativeAlphabet",
          t("hasNativeAlphabetTooltip"),
        )}
      >
        <TabChoice
          name="has-native-alphabet"
          value={value.hasNativeAlphabetName ? "yes" : "no"}
          columns={2}
          onChange={(next) => set("hasNativeAlphabetName", next === "yes")}
          ariaLabel={t("hasNativeAlphabet")}
          options={[
            { value: "yes", label: tCommon("yes") },
            { value: "no", label: tCommon("no") },
          ]}
        />
        {value.hasNativeAlphabetName ? (
          <BrandInput
            value={value.nativeAlphabetName}
            onChange={(e) => set("nativeAlphabetName", e.target.value)}
            placeholder={t("nativeAlphabetNamePlaceholder")}
            aria-label={t("nativeAlphabetName")}
            className="mt-2"
          />
        ) : null}
      </BrandField>

      <BrandField
        label={renderFieldLabel(t("hasTelecode"), "hasTelecode", t("hasTelecodeTooltip"))}
      >
        <TabChoice
          name="has-telecode"
          value={value.hasTelecode ? "yes" : "no"}
          columns={2}
          onChange={(next) => set("hasTelecode", next === "yes")}
          ariaLabel={t("hasTelecode")}
          options={[
            { value: "yes", label: tCommon("yes") },
            { value: "no", label: tCommon("no") },
          ]}
        />
        {value.hasTelecode ? (
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <BrandInput
              value={value.telecodeFirstName}
              onChange={(e) => set("telecodeFirstName", e.target.value)}
              placeholder={t("telecodeFirstNamePlaceholder")}
              aria-label={t("telecodeFirstName")}
            />
            <BrandInput
              value={value.telecodeLastName}
              onChange={(e) => set("telecodeLastName", e.target.value)}
              placeholder={t("telecodeLastNamePlaceholder")}
              aria-label={t("telecodeLastName")}
            />
          </div>
        ) : null}
      </BrandField>

      <Button
        type="button"
        onClick={onContinue}
        disabled={!canContinue}
        className="mt-2 h-12 rounded-lg bg-brand-500 text-[15px] font-medium text-white hover:bg-brand-500/90"
      >
        {tCommon("continue")}
      </Button>
    </div>
  );
}

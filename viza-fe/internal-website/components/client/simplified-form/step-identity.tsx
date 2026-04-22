"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ScanLine, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandInput, BrandField } from "@/components/client/brand-field";
import { DatePicker } from "@/components/ui/date-picker";
import { CountryDropdown } from "@/components/ui/country-dropdown";
import { TabChoice } from "./tab-choice";
import type { SimplifiedIdentity } from "./types";

interface StepIdentityProps {
  value: SimplifiedIdentity;
  onChange: (value: SimplifiedIdentity) => void;
  onContinue: () => void;
}

export function StepIdentity({ value, onChange, onContinue }: StepIdentityProps) {
  const t = useTranslations("simplifiedForm.identity");
  const tCommon = useTranslations("simplifiedForm.common");
  const [mode, setMode] = useState<"choose" | "manual">(
    value.firstName || value.lastName ? "manual" : "choose",
  );

  const set = <K extends keyof SimplifiedIdentity>(key: K, next: SimplifiedIdentity[K]) =>
    onChange({ ...value, [key]: next });

  const canContinue =
    value.firstName.trim() &&
    value.lastName.trim() &&
    value.dob &&
    value.gender &&
    value.countryOfBirth &&
    value.cityOfBirth.trim() &&
    value.nationality &&
    value.maritalStatus &&
    (!value.hasOtherName || (value.otherFirstName.trim() && value.otherLastName.trim())) &&
    (!value.hasNativeAlphabetName || value.nativeAlphabetName.trim());

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
            disabled
            className="group flex cursor-not-allowed flex-col items-start gap-3 rounded-xl border border-input bg-white p-5 text-left opacity-70"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-500">
              <ScanLine className="h-5 w-5" />
            </span>
            <div className="flex flex-col gap-1">
              <span className="text-[15px] font-semibold text-foreground">{t("scanOption")}</span>
              <span className="text-xs text-muted-foreground">{t("scanComingSoon")}</span>
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
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canContinue) onContinue();
      }}
      className="flex flex-col gap-6"
    >
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">{t("subtitle")}</p>
      </header>

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

      <div className="grid gap-4 sm:grid-cols-2">
        <BrandField label={t("dateOfBirth")} required>
          <DatePicker
            value={value.dob}
            onChange={(next) => set("dob", next)}
            placeholder={t("dateOfBirthPlaceholder")}
          />
        </BrandField>
        <BrandField label={t("gender")} required>
          <TabChoice
            name="gender"
            value={value.gender}
            columns={2}
            onChange={(next) => set("gender", next)}
            ariaLabel={t("gender")}
            options={[
              { value: "Male", label: t("male") },
              { value: "Female", label: t("female") },
            ]}
          />
        </BrandField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <BrandField label={t("countryOfBirth")} required>
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
        </BrandField>
        <BrandField label={t("cityOfBirth")} htmlFor="city-birth" required>
          <BrandInput
            id="city-birth"
            value={value.cityOfBirth}
            onChange={(e) => set("cityOfBirth", e.target.value)}
            placeholder={t("cityOfBirthPlaceholder")}
            required
          />
        </BrandField>
      </div>

      <BrandField label={t("nationality")} required>
        <CountryDropdown
          defaultValue={value.nationality}
          placeholder={t("nationalityPlaceholder")}
          onChange={(country) => set("nationality", country.alpha3)}
        />
      </BrandField>

      <BrandField label={t("maritalStatus")} required>
        <TabChoice
          name="marital-status"
          value={value.maritalStatus}
          columns={4}
          onChange={(next) => set("maritalStatus", next)}
          ariaLabel={t("maritalStatus")}
          options={[
            { value: "Single", label: t("single") },
            { value: "Married", label: t("married") },
            { value: "Divorced", label: t("divorced") },
            { value: "Widowed", label: t("widowed") },
          ]}
        />
      </BrandField>

      {value.maritalStatus === "Married" ? (
        <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-muted/40 p-4">
          <p className="text-sm font-semibold text-foreground">{t("spouseTitle")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <BrandField label={t("spouseFirstName")}>
              <BrandInput
                value={value.spouseFirstName}
                onChange={(e) => set("spouseFirstName", e.target.value)}
                placeholder={t("firstNamePlaceholder")}
              />
            </BrandField>
            <BrandField label={t("spouseLastName")}>
              <BrandInput
                value={value.spouseLastName}
                onChange={(e) => set("spouseLastName", e.target.value)}
                placeholder={t("lastNamePlaceholder")}
              />
            </BrandField>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <BrandField label={t("spouseDob")}>
              <DatePicker
                value={value.spouseDob}
                onChange={(next) => set("spouseDob", next)}
                placeholder={t("dateOfBirthPlaceholder")}
              />
            </BrandField>
            <BrandField label={t("spouseNationality")}>
              <CountryDropdown
                defaultValue={value.spouseNationality}
                placeholder={t("nationalityPlaceholder")}
                onChange={(country) => set("spouseNationality", country.alpha3)}
              />
            </BrandField>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <BrandField label={t("spouseCityOfBirth")}>
              <BrandInput
                value={value.spouseCityOfBirth}
                onChange={(e) => set("spouseCityOfBirth", e.target.value)}
                placeholder={t("cityOfBirthPlaceholder")}
              />
            </BrandField>
            <BrandField label={t("spouseCountryOfBirth")}>
              <CountryDropdown
                defaultValue={value.spouseCountryOfBirth}
                placeholder={t("countryOfBirthPlaceholder")}
                onChange={(country) => set("spouseCountryOfBirth", country.alpha3)}
              />
            </BrandField>
          </div>
        </div>
      ) : null}

      <BrandField label={t("hasOtherName")}>
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

      <BrandField label={t("hasNativeAlphabet")} hint={t("hasNativeAlphabetHint")}>
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

      <BrandField label={t("hasTelecode")} hint={t("hasTelecodeHint")}>
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

      <BrandField label={t("hasPermanentResidence")} hint={t("hasPermanentResidenceHint")}>
        <TabChoice
          name="has-permanent-residence"
          value={value.hasPermanentResidenceOther ? "yes" : "no"}
          columns={2}
          onChange={(next) => set("hasPermanentResidenceOther", next === "yes")}
          ariaLabel={t("hasPermanentResidence")}
          options={[
            { value: "yes", label: tCommon("yes") },
            { value: "no", label: tCommon("no") },
          ]}
        />
        {value.hasPermanentResidenceOther ? (
          <div className="mt-2">
            <CountryDropdown
              defaultValue={value.permanentResidenceCountry}
              placeholder={t("permanentResidenceCountryPlaceholder")}
              onChange={(country) => set("permanentResidenceCountry", country.alpha3)}
            />
          </div>
        ) : null}
      </BrandField>

      <Button
        type="submit"
        disabled={!canContinue}
        className="mt-2 h-12 rounded-lg bg-brand-500 text-[15px] font-medium text-white hover:bg-brand-500/90"
      >
        {tCommon("continue")}
      </Button>
    </form>
  );
}

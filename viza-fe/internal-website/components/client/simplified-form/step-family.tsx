"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Flag, Globe2, Heart, Plus, Trash2, User, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { BrandField, BrandInput } from "@/components/client/brand-field";
import { DatePicker } from "@/components/ui/date-picker";
import { CountryDropdown } from "@/components/ui/country-dropdown";
import { TabChoice } from "@/components/client/simplified-form/tab-choice";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FormerSpouse, SimplifiedFamily, UsRelative } from "./types";

const SPOUSE_STATUSES = [
  "Married",
  "Common Law Marriage",
  "Civil Union / Domestic Partnership",
  "Legally Separated",
] as const;

const LANGUAGE_OPTIONS = [
  { value: "English", labelKey: "languageEnglish" },
  { value: "Spanish", labelKey: "languageSpanish" },
  { value: "French", labelKey: "languageFrench" },
  { value: "Arabic", labelKey: "languageArabic" },
  { value: "Chinese (Mandarin)", labelKey: "languageChineseMandarin" },
  { value: "Chinese (Cantonese)", labelKey: "languageChineseCantonese" },
  { value: "Hindi", labelKey: "languageHindi" },
  { value: "Portuguese", labelKey: "languagePortuguese" },
  { value: "Russian", labelKey: "languageRussian" },
  { value: "Japanese", labelKey: "languageJapanese" },
  { value: "Korean", labelKey: "languageKorean" },
  { value: "German", labelKey: "languageGerman" },
  { value: "Italian", labelKey: "languageItalian" },
  { value: "Turkish", labelKey: "languageTurkish" },
  { value: "Vietnamese", labelKey: "languageVietnamese" },
  { value: "Thai", labelKey: "languageThai" },
  { value: "Malay", labelKey: "languageMalay" },
  { value: "Tamil", labelKey: "languageTamil" },
] as const;

const RECOMMENDED_LANGUAGES = [
  "English",
  "Chinese (Mandarin)",
  "Chinese (Cantonese)",
  "Malay",
  "Tamil",
] as const;

type MaritalStatus = string;

interface StepFamilyProps {
  value: SimplifiedFamily;
  onChange: (value: SimplifiedFamily) => void;
  onContinue: () => void;
  maritalStatus: MaritalStatus;
  onChangeMaritalStatus: () => void;
}

function emptyFormerSpouse(): FormerSpouse {
  return {
    firstName: "",
    lastName: "",
    dob: "",
    nationality: "",
    cityOfBirth: "",
    countryOfBirth: "",
    marriageDate: "",
    divorceDate: "",
    howEnded: "",
    divorceCountry: "",
  };
}

function emptyUsRelative(): UsRelative {
  return {
    firstName: "",
    lastName: "",
    relationship: "",
    status: "",
  };
}

function isParentValid(
  known: boolean,
  firstNameUnknown: boolean,
  firstName: string,
  lastNameUnknown: boolean,
  lastName: string,
) {
  if (!known) return true;
  return (firstNameUnknown || firstName.trim().length > 0) &&
    (lastNameUnknown || lastName.trim().length > 0);
}

export function StepFamily({
  value,
  onChange,
  onContinue,
  maritalStatus,
  onChangeMaritalStatus,
}: StepFamilyProps) {
  const t = useTranslations("simplifiedForm.family");
  const tCommon = useTranslations("simplifiedForm.common");
  const [showErrors, setShowErrors] = useState(false);

  const set = <K extends keyof SimplifiedFamily>(key: K, next: SimplifiedFamily[K]) =>
    onChange({ ...value, [key]: next });

  const isSpouseStatus = SPOUSE_STATUSES.includes(maritalStatus as typeof SPOUSE_STATUSES[number]);
  const isWidowed = maritalStatus === "Widowed";
  const isDivorced = maritalStatus === "Divorced";

  const fatherValid = isParentValid(
    value.fatherKnown, value.fatherFirstNameUnknown, value.fatherFirstName,
    value.fatherLastNameUnknown, value.fatherLastName,
  );
  const motherValid = isParentValid(
    value.motherKnown, value.motherFirstNameUnknown, value.motherFirstName,
    value.motherLastNameUnknown, value.motherLastName,
  );

  function handleContinue() {
    if (!fatherValid || !motherValid) {
      setShowErrors(true);
      return;
    }
    onContinue();
  }

  // ── Shared parent card ────────────────────────────────────────────────────
  function parentCard({
    known, firstNameUnknown, firstName, lastNameUnknown, lastName,
    titleKey, unknownKey, markedUnknownKey,
    onKnownChange, onFirstNameUnknownChange, onFirstNameChange,
    onLastNameUnknownChange, onLastNameChange,
  }: {
    known: boolean; firstNameUnknown: boolean; firstName: string;
    lastNameUnknown: boolean; lastName: string;
    titleKey: string; unknownKey: string; markedUnknownKey: string;
    onKnownChange: (v: boolean) => void;
    onFirstNameUnknownChange: (v: boolean) => void;
    onFirstNameChange: (v: string) => void;
    onLastNameUnknownChange: (v: boolean) => void;
    onLastNameChange: (v: string) => void;
  }) {
    const givenError = showErrors && known && !firstNameUnknown && !firstName.trim() ? t("required") : undefined;
    const surnameError = showErrors && known && !lastNameUnknown && !lastName.trim() ? t("required") : undefined;

    return (
      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <User className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{t(titleKey)}</p>
            <p className="text-xs text-muted-foreground">{t("parentSubtitle")}</p>
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2.5">
          <Checkbox checked={!known} onCheckedChange={(c) => onKnownChange(!c)} />
          <span className="text-sm text-foreground">{t(unknownKey)}</span>
        </label>

        {!known ? (
          <p className="text-sm italic text-muted-foreground">{t(markedUnknownKey)}</p>
        ) : (
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <BrandField label={t("givenName")} required={!firstNameUnknown} error={givenError}>
                {firstNameUnknown ? (
                  <p className="text-sm italic text-muted-foreground">{t("notApplicable")}</p>
                ) : (
                  <BrandInput value={firstName} onChange={(e) => onFirstNameChange(e.target.value)} placeholder={t("givenNamePlaceholder")} />
                )}
              </BrandField>
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox checked={firstNameUnknown} onCheckedChange={(c) => { onFirstNameUnknownChange(!!c); if (c) onFirstNameChange(""); }} />
                <span className="text-sm text-muted-foreground">{t("noGivenName")}</span>
              </label>
            </div>
            <div className="flex flex-col gap-1.5">
              <BrandField label={t("surname")} required={!lastNameUnknown} error={surnameError}>
                {lastNameUnknown ? (
                  <p className="text-sm italic text-muted-foreground">{t("notApplicable")}</p>
                ) : (
                  <BrandInput value={lastName} onChange={(e) => onLastNameChange(e.target.value)} placeholder={t("surnamePlaceholder")} />
                )}
              </BrandField>
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox checked={lastNameUnknown} onCheckedChange={(c) => { onLastNameUnknownChange(!!c); if (c) onLastNameChange(""); }} />
                <span className="text-sm text-muted-foreground">{t("noGivenName")}</span>
              </label>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Spouse card header (shared for married / widowed) ──────────────────────
  function spouseCardHeader(titleKey: string, subtitleKey: string) {
    return (
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Heart className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{t(titleKey)}</p>
            <p className="text-xs text-muted-foreground">{t(subtitleKey)}</p>
          </div>
        </div>
        <button type="button" onClick={onChangeMaritalStatus} className="shrink-0 text-xs text-brand-500 hover:underline whitespace-nowrap">
          {t("wrongStatus")}
        </button>
      </div>
    );
  }

  // ── Spouse card (married / common law / civil union / legally separated) ──
  function spouseCard() {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-white p-5">
        {spouseCardHeader("spouseTitle", "spouseSubtitle")}

        <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
          <BrandField label={t("givenName")} required>
            <BrandInput value={value.spouseFirstName} onChange={(e) => set("spouseFirstName", e.target.value)} placeholder={t("givenNamePlaceholder")} />
          </BrandField>
          <BrandField label={t("surname")} required>
            <BrandInput value={value.spouseLastName} onChange={(e) => set("spouseLastName", e.target.value)} placeholder={t("surnamePlaceholder")} />
          </BrandField>
        </div>

        <BrandField label={t("dateOfBirth")} required>
          <DatePicker value={value.spouseDob} onChange={(v) => set("spouseDob", v)} placeholder={t("dateOfBirthPlaceholder")} />
        </BrandField>

        <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
          <BrandField label={t("nationality")} required>
            <CountryDropdown defaultValue={value.spouseNationality} placeholder={t("countryPlaceholder")} onChange={(c) => set("spouseNationality", c.alpha3)} />
          </BrandField>
          <BrandField label={t("cityOfBirth")} required>
            <BrandInput value={value.spouseCityOfBirth} onChange={(e) => set("spouseCityOfBirth", e.target.value)} placeholder={t("cityOfBirthPlaceholder")} />
          </BrandField>
        </div>

        <BrandField label={t("countryOfBirth")} required>
          <CountryDropdown defaultValue={value.spouseCountryOfBirth} placeholder={t("countryPlaceholder")} onChange={(c) => set("spouseCountryOfBirth", c.alpha3)} />
        </BrandField>

        <BrandField label={t("spouseAddressType")}>
          <Select value={value.spouseAddressType} onValueChange={(v) => set("spouseAddressType", v as SimplifiedFamily["spouseAddressType"])}>
            <SelectTrigger className="h-12 rounded-lg border-[#e8e8e8] text-[15px]">
              <SelectValue placeholder={t("spouseAddressTypePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="home">{t("addressHome")}</SelectItem>
              <SelectItem value="work">{t("addressWork")}</SelectItem>
              <SelectItem value="other">{t("addressOther")}</SelectItem>
            </SelectContent>
          </Select>
        </BrandField>

        {value.spouseAddressType === "other" ? (
          <div className="grid gap-x-5 gap-y-4 border-l-2 border-brand-100 pl-3 sm:grid-cols-2">
            <BrandField label={t("street1")} required>
              <BrandInput
                value={value.spouseAddressStreet1}
                onChange={(e) => set("spouseAddressStreet1", e.target.value)}
                placeholder={t("street1Placeholder")}
              />
            </BrandField>
            <BrandField label={t("street2")}>
              <BrandInput
                value={value.spouseAddressStreet2}
                onChange={(e) => set("spouseAddressStreet2", e.target.value)}
                placeholder={t("street2Placeholder")}
              />
            </BrandField>
            <BrandField label={t("city")} required>
              <BrandInput
                value={value.spouseAddressCity}
                onChange={(e) => set("spouseAddressCity", e.target.value)}
                placeholder={t("cityPlaceholder")}
              />
            </BrandField>
            <div className="flex flex-col gap-2">
              <BrandField label={t("stateProvince")}>
                <BrandInput
                  value={value.spouseAddressState}
                  onChange={(e) => set("spouseAddressState", e.target.value)}
                  placeholder={t("stateProvincePlaceholder")}
                  disabled={value.spouseAddressNoState}
                />
              </BrandField>
              <label className="inline-flex items-center gap-2 text-sm text-foreground">
                <Checkbox
                  checked={value.spouseAddressNoState}
                  onCheckedChange={(checked) => {
                    const next = checked === true;
                    onChange({
                      ...value,
                      spouseAddressNoState: next,
                      spouseAddressState: next ? "" : value.spouseAddressState,
                    });
                  }}
                />
                {t("noStateProvince")}
              </label>
            </div>
            <div className="flex flex-col gap-2">
              <BrandField label={t("postalCode")}>
                <BrandInput
                  value={value.spouseAddressPostalCode}
                  onChange={(e) => set("spouseAddressPostalCode", e.target.value)}
                  placeholder={t("postalCodePlaceholder")}
                  disabled={value.spouseAddressNoPostalCode}
                />
              </BrandField>
              <label className="inline-flex items-center gap-2 text-sm text-foreground">
                <Checkbox
                  checked={value.spouseAddressNoPostalCode}
                  onCheckedChange={(checked) => {
                    const next = checked === true;
                    onChange({
                      ...value,
                      spouseAddressNoPostalCode: next,
                      spouseAddressPostalCode: next ? "" : value.spouseAddressPostalCode,
                    });
                  }}
                />
                {t("noPostalCode")}
              </label>
            </div>
            <BrandField label={t("country")} required>
              <CountryDropdown
                defaultValue={value.spouseAddressCountry}
                placeholder={t("countryPlaceholder")}
                onChange={(c) => set("spouseAddressCountry", c.alpha3)}
              />
            </BrandField>
          </div>
        ) : null}
      </div>
    );
  }

  // ── Deceased spouse card (widowed) ─────────────────────────────────────────
  function deceasedSpouseCard() {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-white p-5">
        {spouseCardHeader("deceasedSpouseTitle", "spouseSubtitle")}

        <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
          <BrandField label={t("givenName")} required>
            <BrandInput value={value.deceasedSpouseFirstName} onChange={(e) => set("deceasedSpouseFirstName", e.target.value)} placeholder={t("givenNamePlaceholder")} />
          </BrandField>
          <BrandField label={t("surname")} required>
            <BrandInput value={value.deceasedSpouseLastName} onChange={(e) => set("deceasedSpouseLastName", e.target.value)} placeholder={t("surnamePlaceholder")} />
          </BrandField>
        </div>

        <BrandField label={t("dateOfBirth")} required>
          <DatePicker value={value.deceasedSpouseDob} onChange={(v) => set("deceasedSpouseDob", v)} placeholder={t("dateOfBirthPlaceholder")} />
        </BrandField>

        <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
          <BrandField label={t("nationality")} required>
            <CountryDropdown defaultValue={value.deceasedSpouseNationality} placeholder={t("countryPlaceholder")} onChange={(c) => set("deceasedSpouseNationality", c.alpha3)} />
          </BrandField>
          <BrandField label={t("cityOfBirth")} required>
            <BrandInput value={value.deceasedSpouseCityOfBirth} onChange={(e) => set("deceasedSpouseCityOfBirth", e.target.value)} placeholder={t("cityOfBirthPlaceholder")} />
          </BrandField>
        </div>

        <BrandField label={t("countryOfBirth")} required>
          <CountryDropdown defaultValue={value.deceasedSpouseCountryOfBirth} placeholder={t("countryPlaceholder")} onChange={(c) => set("deceasedSpouseCountryOfBirth", c.alpha3)} />
        </BrandField>
      </div>
    );
  }

  // ── Former spouse entry ────────────────────────────────────────────────────
  function formerSpouseEntry(fs: FormerSpouse, idx: number) {
    const setFs = <K extends keyof FormerSpouse>(key: K, v: FormerSpouse[K]) => {
      const next = value.formerSpouses.map((s, i) => (i === idx ? { ...s, [key]: v } : s));
      set("formerSpouses", next);
    };

    return (
      <div key={idx} className="flex flex-col gap-4 rounded-xl border border-border/50 bg-muted/30 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">{t("formerSpouseN", { n: idx + 1 })}</p>
          <button type="button" onClick={() => set("formerSpouses", value.formerSpouses.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
          <BrandField label={t("givenName")} required>
            <BrandInput value={fs.firstName} onChange={(e) => setFs("firstName", e.target.value)} placeholder={t("givenNamePlaceholder")} />
          </BrandField>
          <BrandField label={t("surname")} required>
            <BrandInput value={fs.lastName} onChange={(e) => setFs("lastName", e.target.value)} placeholder={t("surnamePlaceholder")} />
          </BrandField>
        </div>

        <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
          <BrandField label={t("dateOfBirth")} required>
            <DatePicker value={fs.dob} onChange={(v) => setFs("dob", v)} placeholder={t("dateOfBirthPlaceholder")} />
          </BrandField>
          <BrandField label={t("nationality")} required>
            <CountryDropdown defaultValue={fs.nationality} placeholder={t("countryPlaceholder")} onChange={(c) => setFs("nationality", c.alpha3)} />
          </BrandField>
        </div>

        <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
          <BrandField label={t("cityOfBirth")} required>
            <BrandInput value={fs.cityOfBirth} onChange={(e) => setFs("cityOfBirth", e.target.value)} placeholder={t("cityOfBirthPlaceholder")} />
          </BrandField>
          <BrandField label={t("countryOfBirth")} required>
            <CountryDropdown defaultValue={fs.countryOfBirth} placeholder={t("countryPlaceholder")} onChange={(c) => setFs("countryOfBirth", c.alpha3)} />
          </BrandField>
        </div>

        <BrandField label={t("marriageDate")} required>
          <DatePicker value={fs.marriageDate} onChange={(v) => setFs("marriageDate", v)} placeholder={t("datePlaceholder")} />
        </BrandField>

        <BrandField label={t("divorceDate")} required>
          <DatePicker value={fs.divorceDate} onChange={(v) => setFs("divorceDate", v)} placeholder={t("datePlaceholder")} />
        </BrandField>

        <BrandField label={t("howEnded")} required hint={t("howEndedHint")}>
          <textarea
            value={fs.howEnded}
            onChange={(e) => setFs("howEnded", e.target.value)}
            maxLength={200}
            rows={3}
            placeholder={t("howEndedPlaceholder")}
            className="w-full resize-none rounded-lg border border-[#e8e8e8] px-3 py-2.5 text-[15px] focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
          />
        </BrandField>

        <BrandField label={t("divorceCountry")} required>
          <CountryDropdown defaultValue={fs.divorceCountry} placeholder={t("countryPlaceholder")} onChange={(c) => setFs("divorceCountry", c.alpha3)} />
        </BrandField>
      </div>
    );
  }

  // ── Former spouses card (divorced) ─────────────────────────────────────────
  function formerSpousesCard() {
    const canAdd = value.formerSpouses.length < 5;
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Heart className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{t("formerSpouseTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("formerSpouseSubtitle")}</p>
            </div>
          </div>
          <button type="button" onClick={onChangeMaritalStatus} className="shrink-0 text-xs text-brand-500 hover:underline whitespace-nowrap">
            {t("wrongStatus")}
          </button>
        </div>

        {value.formerSpouses.length === 0 ? null : (
          <div className="flex flex-col gap-4">
            {value.formerSpouses.map((fs, idx) => formerSpouseEntry(fs, idx))}
          </div>
        )}

        {canAdd && (
          <button
            type="button"
            onClick={() => set("formerSpouses", [...value.formerSpouses, emptyFormerSpouse()])}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-4 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-500"
          >
            <Plus className="h-4 w-4" />
            {value.formerSpouses.length === 0 ? t("addFormerSpouse") : t("addAnotherFormerSpouse")}
          </button>
        )}
      </div>
    );
  }

  function usRelativesCard() {
    const showRelativeDetails = value.relativesInUs === "yes" || value.hasOtherRelatives === "yes";
    const showOtherRelativesQuestion = value.relativesInUs !== "yes";
    const relatives = value.usRelatives.length ? value.usRelatives : [emptyUsRelative()];
    const canAdd = relatives.length < 5;

    const setRelative = <K extends keyof UsRelative>(index: number, key: K, next: UsRelative[K]) => {
      const current = value.usRelatives.length ? value.usRelatives : [emptyUsRelative()];
      set("usRelatives", current.map((relative, i) => (i === index ? { ...relative, [key]: next } : relative)));
    };

    const setRelativesInUs = (next: "yes" | "no") => {
      onChange({
        ...value,
        relativesInUs: next,
        hasOtherRelatives: next === "yes" ? "no" : value.hasOtherRelatives,
        usRelatives: next === "yes" && !value.usRelatives.length ? [emptyUsRelative()] : value.usRelatives,
      });
    };

    const setHasOtherRelatives = (next: "yes" | "no") => {
      onChange({
        ...value,
        hasOtherRelatives: next,
        usRelatives: next === "yes" && !value.usRelatives.length ? [emptyUsRelative()] : value.usRelatives,
      });
    };

    return (
      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{t("relativesInUs")}</p>
            <p className="text-xs text-muted-foreground">{t("relativesInUsHint")}</p>
          </div>
        </div>

        <TabChoice
          name="relatives-in-us"
          value={value.relativesInUs}
          columns={2}
          onChange={(next) => setRelativesInUs(next as "yes" | "no")}
          ariaLabel={t("relativesInUs")}
          options={[
            { value: "yes", label: tCommon("yes") },
            { value: "no", label: tCommon("no") },
          ]}
        />

        {showOtherRelativesQuestion ? (
          <div className="border-t border-border/60 pt-4">
            <BrandField label={t("hasOtherRelatives")} hint={t("hasOtherRelativesHint")}>
              <TabChoice
                name="has-other-us-relatives"
                value={value.hasOtherRelatives}
                columns={2}
                onChange={(next) => setHasOtherRelatives(next as "yes" | "no")}
                ariaLabel={t("hasOtherRelatives")}
                options={[
                  { value: "yes", label: tCommon("yes") },
                  { value: "no", label: tCommon("no") },
                ]}
              />
            </BrandField>
          </div>
        ) : null}

        {showRelativeDetails ? (
          <div className="flex flex-col gap-4 border-t border-border/60 pt-4">
            {relatives.map((relative, index) => (
              <div key={index} className="flex flex-col gap-4 rounded-xl bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">{t("relativeN", { n: index + 1 })}</p>
                  {relatives.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => set("usRelatives", relatives.filter((_, i) => i !== index))}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={t("removeRelative")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>

                <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
                  <BrandField label={t("relativeFirstName")} required>
                    <BrandInput
                      value={relative.firstName}
                      onChange={(e) => setRelative(index, "firstName", e.target.value)}
                      placeholder={t("relativeFirstNamePlaceholder")}
                    />
                  </BrandField>
                  <BrandField label={t("relativeLastName")} required>
                    <BrandInput
                      value={relative.lastName}
                      onChange={(e) => setRelative(index, "lastName", e.target.value)}
                      placeholder={t("relativeLastNamePlaceholder")}
                    />
                  </BrandField>
                </div>

                <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
                  <BrandField label={t("relativeRelationship")} required>
                    <Select value={relative.relationship} onValueChange={(next) => setRelative(index, "relationship", next as UsRelative["relationship"])}>
                      <SelectTrigger className="h-12 rounded-lg border-[#e8e8e8] text-[15px]">
                        <SelectValue placeholder={t("relativeRelationship")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="spouse">{t("relationSpouse")}</SelectItem>
                        <SelectItem value="fiance">{t("relationFiance")}</SelectItem>
                        <SelectItem value="child">{t("relationChild")}</SelectItem>
                        <SelectItem value="sibling">{t("relationSibling")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </BrandField>
                  <BrandField label={t("relativeStatus")} required>
                    <Select value={relative.status} onValueChange={(next) => setRelative(index, "status", next as UsRelative["status"])}>
                      <SelectTrigger className="h-12 rounded-lg border-[#e8e8e8] text-[15px]">
                        <SelectValue placeholder={t("relativeStatus")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="citizen">{t("statusCitizen")}</SelectItem>
                        <SelectItem value="lpr">{t("statusLpr")}</SelectItem>
                        <SelectItem value="nonimmigrant">{t("statusNonimmigrant")}</SelectItem>
                        <SelectItem value="other_unknown">{t("statusOther")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </BrandField>
                </div>
              </div>
            ))}

            {canAdd ? (
              <button
                type="button"
                onClick={() => set("usRelatives", [...relatives, emptyUsRelative()])}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-4 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-500"
              >
                <Plus className="h-4 w-4" />
                {t("addAnotherRelative")}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  function clanTribeCard() {
    const setHasClanTribe = (next: "yes" | "no") => {
      onChange({
        ...value,
        hasClanTribe: next,
        clanTribeName: next === "yes" ? value.clanTribeName : "",
      });
    };

    return (
      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Flag className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{t("clanTribe")}</p>
            <p className="text-xs text-muted-foreground">{t("clanTribeHint")}</p>
          </div>
        </div>

        <TabChoice
          name="has-clan-tribe"
          value={value.hasClanTribe}
          columns={2}
          onChange={(next) => setHasClanTribe(next as "yes" | "no")}
          ariaLabel={t("clanTribe")}
          options={[
            { value: "yes", label: tCommon("yes") },
            { value: "no", label: tCommon("no") },
          ]}
        />

        {value.hasClanTribe === "yes" ? (
          <BrandField label={t("clanTribeName")} required>
            <BrandInput
              value={value.clanTribeName}
              onChange={(e) => set("clanTribeName", e.target.value)}
              placeholder={t("clanTribeNamePlaceholder")}
            />
          </BrandField>
        ) : null}
      </div>
    );
  }

  function languagesCard() {
    const languages = value.languages.length ? value.languages : [""];
    const canAdd = languages.length < 10;
    const languageLabel = (language: string) =>
      t(LANGUAGE_OPTIONS.find((option) => option.value === language)?.labelKey ?? "languageN", { n: "" }).trim();

    const setLanguage = (index: number, next: string) => {
      set("languages", languages.map((language, i) => (i === index ? next : language)));
    };

    const addRecommendedLanguage = (language: string) => {
      if (languages.includes(language)) return;
      if (languages.length === 1 && languages[0] === "") {
        set("languages", [language]);
        return;
      }
      if (canAdd) set("languages", [...languages, language]);
    };

    return (
      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Globe2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {t("languages")} <span className="text-destructive">*</span>
            </p>
            <p className="text-xs text-muted-foreground">{t("languagesHint")}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">{t("recommendedLanguages")}</p>
          <div className="flex flex-wrap gap-2">
            {RECOMMENDED_LANGUAGES.map((language) => {
              const selected = languages.includes(language);
              return (
                <button
                  key={language}
                  type="button"
                  onClick={() => addRecommendedLanguage(language)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    selected
                      ? "border-brand-200 bg-brand-50 text-brand-500"
                      : "border-border bg-muted/50 text-muted-foreground hover:border-brand-200 hover:text-brand-500"
                  }`}
                >
                  {selected ? <Check className="h-3.5 w-3.5" /> : null}
                  {languageLabel(language)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {languages.map((language, index) => (
            <div key={index} className="flex items-center gap-3">
              <Select value={language} onValueChange={(next) => setLanguage(index, next)}>
                <SelectTrigger className="h-12 rounded-lg border-[#e8e8e8] text-[15px]">
                  <SelectValue placeholder={t("languageN", { n: index + 1 })} />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={() => set("languages", languages.length === 1 ? [""] : languages.filter((_, i) => i !== index))}
                className="shrink-0 text-muted-foreground hover:text-destructive"
                aria-label={t("removeLanguage", { lang: language ? languageLabel(language) : t("languageN", { n: index + 1 }) })}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          {canAdd ? (
            <button
              type="button"
              onClick={() => set("languages", [...languages, ""])}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-4 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-500"
            >
              <Plus className="h-4 w-4" />
              {t("addLanguage")}
            </button>
          ) : null}
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

      {parentCard({
        known: value.fatherKnown, firstNameUnknown: value.fatherFirstNameUnknown,
        firstName: value.fatherFirstName, lastNameUnknown: value.fatherLastNameUnknown,
        lastName: value.fatherLastName,
        titleKey: "fatherTitle", unknownKey: "fatherUnknown", markedUnknownKey: "fatherMarkedUnknown",
        onKnownChange: (v) => set("fatherKnown", v),
        onFirstNameUnknownChange: (v) => set("fatherFirstNameUnknown", v),
        onFirstNameChange: (v) => set("fatherFirstName", v),
        onLastNameUnknownChange: (v) => set("fatherLastNameUnknown", v),
        onLastNameChange: (v) => set("fatherLastName", v),
      })}

      {parentCard({
        known: value.motherKnown, firstNameUnknown: value.motherFirstNameUnknown,
        firstName: value.motherFirstName, lastNameUnknown: value.motherLastNameUnknown,
        lastName: value.motherLastName,
        titleKey: "motherTitle", unknownKey: "motherUnknown", markedUnknownKey: "motherMarkedUnknown",
        onKnownChange: (v) => set("motherKnown", v),
        onFirstNameUnknownChange: (v) => set("motherFirstNameUnknown", v),
        onFirstNameChange: (v) => set("motherFirstName", v),
        onLastNameUnknownChange: (v) => set("motherLastNameUnknown", v),
        onLastNameChange: (v) => set("motherLastName", v),
      })}

      {isSpouseStatus && spouseCard()}
      {isWidowed && deceasedSpouseCard()}
      {isDivorced && formerSpousesCard()}
      {usRelativesCard()}
      {clanTribeCard()}
      {languagesCard()}

      <Button
        type="button"
        onClick={handleContinue}
        className="mt-2 h-12 rounded-lg bg-brand-500 text-[15px] font-medium text-white hover:bg-brand-500/90"
      >
        {tCommon("continue")}
      </Button>
    </div>
  );
}

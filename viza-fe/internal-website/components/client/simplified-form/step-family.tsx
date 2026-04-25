"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Heart, Plus, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { BrandField, BrandInput } from "@/components/client/brand-field";
import { DatePicker } from "@/components/ui/date-picker";
import { CountryDropdown } from "@/components/ui/country-dropdown";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FormerSpouse, SimplifiedFamily } from "./types";

const SPOUSE_STATUSES = [
  "Married",
  "Common Law Marriage",
  "Civil Union / Domestic Partnership",
  "Legally Separated",
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

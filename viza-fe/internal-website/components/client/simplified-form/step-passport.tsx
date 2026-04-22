"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { BrandInput, BrandField } from "@/components/client/brand-field";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { CountryDropdown } from "@/components/ui/country-dropdown";
import { TabChoice } from "./tab-choice";
import type { SimplifiedPassport } from "./types";

interface StepPassportProps {
  value: SimplifiedPassport;
  onChange: (value: SimplifiedPassport) => void;
  onContinue: () => void;
}

export function StepPassport({ value, onChange, onContinue }: StepPassportProps) {
  const t = useTranslations("simplifiedForm.passport");
  const tCommon = useTranslations("simplifiedForm.common");

  const set = <K extends keyof SimplifiedPassport>(key: K, next: SimplifiedPassport[K]) =>
    onChange({ ...value, [key]: next });

  const canContinue =
    value.number.trim() &&
    value.issuingCountry &&
    value.issueDate &&
    value.expiryDate &&
    value.type &&
    (!value.hasAdditionalNationality || value.additionalNationality) &&
    (!value.hasNationalId || value.nationalId.trim()) &&
    (!value.hasLostPassport || value.lostPassportExplanation.trim());

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

      <BrandField label={t("type")} required>
        <TabChoice
          name="passport-type"
          value={value.type}
          columns={4}
          onChange={(next) => set("type", next)}
          ariaLabel={t("type")}
          options={[
            { value: "Regular", label: t("typeRegular"), description: t("typeRegularHint") },
            { value: "Official", label: t("typeOfficial") },
            { value: "Diplomatic", label: t("typeDiplomatic") },
            { value: "Other", label: t("typeOther") },
          ]}
        />
      </BrandField>

      <div className="grid gap-4 sm:grid-cols-2">
        <BrandField label={t("number")} htmlFor="passport-number" required>
          <BrandInput
            id="passport-number"
            value={value.number}
            onChange={(e) => set("number", e.target.value.toUpperCase())}
            placeholder={t("numberPlaceholder")}
            autoComplete="off"
            required
          />
        </BrandField>
        <BrandField label={t("bookNumber")} htmlFor="book-number" hint={t("bookNumberHint")}>
          <BrandInput
            id="book-number"
            value={value.bookNumber}
            onChange={(e) => set("bookNumber", e.target.value)}
            placeholder={t("bookNumberPlaceholder")}
          />
        </BrandField>
      </div>

      <BrandField label={t("issuingCountry")} required>
        <CountryDropdown
          defaultValue={value.issuingCountry}
          placeholder={t("issuingCountryPlaceholder")}
          onChange={(country) => set("issuingCountry", country.alpha3)}
        />
      </BrandField>

      <div className="grid gap-4 sm:grid-cols-2">
        <BrandField label={t("issueDate")} required>
          <DatePicker
            value={value.issueDate}
            onChange={(next) => set("issueDate", next)}
            placeholder={t("issueDatePlaceholder")}
          />
        </BrandField>
        <BrandField label={t("expiryDate")} required>
          <DatePicker
            value={value.expiryDate}
            onChange={(next) => set("expiryDate", next)}
            placeholder={t("expiryDatePlaceholder")}
          />
        </BrandField>
      </div>

      <BrandField label={t("additionalNationality")}>
        <TabChoice
          name="additional-nationality"
          value={value.hasAdditionalNationality ? "yes" : "no"}
          columns={2}
          onChange={(next) => set("hasAdditionalNationality", next === "yes")}
          ariaLabel={t("additionalNationality")}
          options={[
            { value: "yes", label: tCommon("yes") },
            { value: "no", label: tCommon("no") },
          ]}
        />
        {value.hasAdditionalNationality ? (
          <div className="mt-2">
            <CountryDropdown
              defaultValue={value.additionalNationality}
              placeholder={t("additionalNationalityPlaceholder")}
              onChange={(country) => set("additionalNationality", country.alpha3)}
            />
          </div>
        ) : null}
      </BrandField>

      <BrandField label={t("nationalId")} hint={t("nationalIdHint")}>
        <TabChoice
          name="has-national-id"
          value={value.hasNationalId ? "yes" : "no"}
          columns={2}
          onChange={(next) => set("hasNationalId", next === "yes")}
          ariaLabel={t("nationalId")}
          options={[
            { value: "yes", label: tCommon("yes") },
            { value: "no", label: tCommon("no") },
          ]}
        />
        {value.hasNationalId ? (
          <BrandInput
            value={value.nationalId}
            onChange={(e) => set("nationalId", e.target.value)}
            placeholder={t("nationalIdPlaceholder")}
            aria-label={t("nationalId")}
            className="mt-2"
          />
        ) : null}
      </BrandField>

      <BrandField label={t("lostPassport")}>
        <TabChoice
          name="lost-passport"
          value={value.hasLostPassport ? "yes" : "no"}
          columns={2}
          onChange={(next) => set("hasLostPassport", next === "yes")}
          ariaLabel={t("lostPassport")}
          options={[
            { value: "no", label: tCommon("no") },
            { value: "yes", label: tCommon("yes") },
          ]}
        />
        {value.hasLostPassport ? (
          <Textarea
            value={value.lostPassportExplanation}
            onChange={(e) => set("lostPassportExplanation", e.target.value)}
            placeholder={t("lostPassportExplanationPlaceholder")}
            aria-label={t("lostPassportExplanation")}
            rows={3}
            className="mt-2 rounded-lg border-[#e8e8e8] text-[15px] focus-visible:ring-1 focus-visible:ring-brand-500 focus-visible:border-brand-500"
          />
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

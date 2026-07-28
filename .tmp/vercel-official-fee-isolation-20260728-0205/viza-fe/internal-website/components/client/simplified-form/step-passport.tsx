"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Info, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandInput, BrandField } from "@/components/client/brand-field";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { CountryDropdown } from "@/components/ui/country-dropdown";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  const [openHelp, setOpenHelp] = useState<"passportNumber" | "bookNumber" | "nationalId" | "itin" | null>(null);
  const additionalCitizenships = value.additionalCitizenships ?? [
    { country: "", hasPassport: false, passportNumber: "" },
  ];
  const permanentResidenceCountries = value.permanentResidenceCountries ?? [""];

  const set = <K extends keyof SimplifiedPassport>(key: K, next: SimplifiedPassport[K]) =>
    onChange({ ...value, [key]: next });

  const canContinue = true;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">{t("subtitle")}</p>
      </header>

      <BrandField label={t("type")}>
        <TabChoice
          name="passport-type"
          value={value.type}
          columns={5}
          onChange={(next) => set("type", next)}
          ariaLabel={t("type")}
          options={[
            { value: "Regular", label: t("typeRegular"), description: t("typeRegularHint") },
            { value: "Official", label: t("typeOfficial") },
            { value: "Diplomatic", label: t("typeDiplomatic") },
            { value: "Permit", label: t("typePermit") },
            { value: "Other", label: t("typeOther") },
          ]}
        />
      </BrandField>

      <BrandField
        label={
          <span className="inline-flex items-center gap-2">
            <span>{t("number")}</span>
            <Popover
              open={openHelp === "passportNumber"}
              onOpenChange={(open) => setOpenHelp(open ? "passportNumber" : null)}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={t("number")}
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
                <p className="pr-8 leading-7">{t("numberHint")}</p>
              </PopoverContent>
            </Popover>
          </span>
        }
        htmlFor="passport-number"
        required
      >
        <BrandInput
          id="passport-number"
          value={value.number}
          onChange={(e) => set("number", e.target.value.toUpperCase())}
          placeholder={t("numberPlaceholder")}
          autoComplete="off"
        />
      </BrandField>

      <BrandField
        label={
          <span className="inline-flex items-center gap-2">
            <span>{t("bookNumberQuestion")}</span>
            <Popover open={openHelp === "bookNumber"} onOpenChange={(open) => setOpenHelp(open ? "bookNumber" : null)}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={t("bookNumberQuestion")}
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
                <p className="pr-8 leading-7">{t("bookNumberHelp")}</p>
              </PopoverContent>
            </Popover>
          </span>
        }
      >
        <TabChoice
          name="has-book-number"
          value={value.hasBookNumber ? "yes" : "no"}
          columns={2}
          onChange={(next) => {
            const hasBookNumber = next === "yes";
            onChange({
              ...value,
              hasBookNumber,
              bookNumber: hasBookNumber ? value.bookNumber : "",
            });
          }}
          ariaLabel={t("bookNumberQuestion")}
          options={[
            { value: "yes", label: tCommon("yes") },
            { value: "no", label: tCommon("no") },
          ]}
        />
        {value.hasBookNumber ? (
          <BrandField label={t("bookNumber")} htmlFor="book-number" required className="mt-2">
            <BrandInput
              id="book-number"
              value={value.bookNumber}
              onChange={(e) => set("bookNumber", e.target.value)}
              placeholder={t("bookNumberPlaceholder")}
              aria-label={t("bookNumber")}
            />
          </BrandField>
        ) : null}
      </BrandField>

      <BrandField label={t("issuingCountry")}>
        <CountryDropdown
          defaultValue={value.issuingCountry}
          placeholder={t("issuingCountryPlaceholder")}
          onChange={(country) => set("issuingCountry", country.alpha3)}
        />
      </BrandField>

      <BrandField label={t("issuedInAnotherCountry")}>
        <TabChoice
          name="issued-in-another-country"
          value={value.issuedInAnotherCountry ? "yes" : "no"}
          columns={2}
          onChange={(next) => {
            const issuedInAnotherCountry = next === "yes";
            onChange({
              ...value,
              issuedInAnotherCountry,
              issuedInAnotherCountryValue: issuedInAnotherCountry
                ? value.issuedInAnotherCountryValue
                : "",
            });
          }}
          ariaLabel={t("issuedInAnotherCountry")}
          options={[
            { value: "yes", label: tCommon("yes") },
            { value: "no", label: tCommon("no") },
          ]}
        />
        {value.issuedInAnotherCountry ? (
          <div className="mt-2">
            <BrandField label={t("issuedInAnotherCountryCountry")}>
              <CountryDropdown
                defaultValue={value.issuedInAnotherCountryValue}
                placeholder={t("issuingCountryPlaceholder")}
                onChange={(country) => set("issuedInAnotherCountryValue", country.alpha3)}
              />
            </BrandField>
          </div>
        ) : null}
      </BrandField>

      <div className="grid gap-3 sm:grid-cols-2">
        <BrandField label={t("issuanceCity")} htmlFor="issuance-city">
          <BrandInput
            id="issuance-city"
            value={value.issuanceCity}
            onChange={(e) => set("issuanceCity", e.target.value)}
            placeholder={t("issuanceCityPlaceholder")}
          />
        </BrandField>
        <BrandField label={t("issuanceProvince")} htmlFor="issuance-province">
          <BrandInput
            id="issuance-province"
            value={value.issuanceProvince}
            onChange={(e) => set("issuanceProvince", e.target.value)}
            placeholder={t("issuanceProvincePlaceholder")}
          />
        </BrandField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <BrandField label={t("issueDate")}>
          <DatePicker
            value={value.issueDate}
            onChange={(next) => set("issueDate", next)}
            placeholder={t("issueDatePlaceholder")}
          />
        </BrandField>
        <BrandField label={t("expiryDate")}>
          <DatePicker
            value={value.expiryDate}
            onChange={(next) => set("expiryDate", next)}
            placeholder={t("expiryDatePlaceholder")}
          />
        </BrandField>
      </div>

      <div className="flex flex-col gap-5 pt-1">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">{t("extraQuestionsTitle")}</h2>

        <BrandField label={t("extraOtherCitizenship")}>
          <TabChoice
            name="extra-other-citizenship"
            value={value.hasAdditionalNationality ? "yes" : "no"}
            columns={2}
            onChange={(next) => {
              const enabled = next === "yes";
              onChange({
                ...value,
                hasAdditionalNationality: enabled,
                additionalCitizenships: enabled
                  ? additionalCitizenships.length
                    ? additionalCitizenships
                    : [{ country: "", hasPassport: false, passportNumber: "" }]
                  : [{ country: "", hasPassport: false, passportNumber: "" }],
              });
            }}
            ariaLabel={t("extraOtherCitizenship")}
            options={[
              { value: "yes", label: tCommon("yes") },
              { value: "no", label: tCommon("no") },
            ]}
          />
          {value.hasAdditionalNationality ? (
            <div className="mt-3 flex flex-col gap-3">
              {additionalCitizenships.map((entry, idx) => (
                <div key={`citizenship-${idx}`} className="rounded-xl border border-input bg-white p-4">
                  <p className="mb-3 text-lg font-semibold text-foreground">
                    {t("extraNationalityCardTitle", { index: idx + 1 })}
                  </p>
                  <BrandField label={t("extraNationalityCountry")}>
                    <CountryDropdown
                      defaultValue={entry.country}
                      placeholder={t("extraNationalityCountryPlaceholder")}
                      onChange={(country) => {
                        const next = [...additionalCitizenships];
                        next[idx] = { ...entry, country: country.alpha3 };
                        set("additionalCitizenships", next);
                      }}
                    />
                  </BrandField>
                  <BrandField label={t("extraNationalityHasPassport")} className="mt-3">
                    <TabChoice
                      name={`citizenship-passport-${idx}`}
                      value={entry.hasPassport ? "yes" : "no"}
                      columns={2}
                      onChange={(next) => {
                        const items = [...additionalCitizenships];
                        const hasPassport = next === "yes";
                        items[idx] = {
                          ...entry,
                          hasPassport,
                          passportNumber: hasPassport ? entry.passportNumber : "",
                        };
                        set("additionalCitizenships", items);
                      }}
                      ariaLabel={t("extraNationalityHasPassport")}
                      options={[
                        { value: "yes", label: tCommon("yes") },
                        { value: "no", label: tCommon("no") },
                      ]}
                    />
                  </BrandField>
                  {entry.hasPassport ? (
                    <BrandField label={t("extraNationalityPassportNumber")} className="mt-3">
                      <BrandInput
                        value={entry.passportNumber}
                        onChange={(e) => {
                          const items = [...additionalCitizenships];
                          items[idx] = { ...entry, passportNumber: e.target.value.toUpperCase() };
                          set("additionalCitizenships", items);
                        }}
                        placeholder={t("extraNationalityPassportNumberPlaceholder")}
                      />
                    </BrandField>
                  ) : null}
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  set("additionalCitizenships", [
                    ...additionalCitizenships,
                    { country: "", hasPassport: false, passportNumber: "" },
                  ])
                }
                className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-brand-500 hover:text-brand-400"
              >
                <Plus className="h-4 w-4" />
                {t("extraAddNationality")}
              </button>
            </div>
          ) : null}
        </BrandField>

        <BrandField label={t("extraOtherCountryPermanentResidence")}>
          <TabChoice
            name="extra-other-country-permanent-residence"
            value={value.hasOtherCountryPermanentResidence ? "yes" : "no"}
            columns={2}
            onChange={(next) => {
              const enabled = next === "yes";
              onChange({
                ...value,
                hasOtherCountryPermanentResidence: enabled,
                permanentResidenceCountries: enabled
                  ? permanentResidenceCountries.length
                    ? permanentResidenceCountries
                    : [""]
                  : [""],
              });
            }}
            ariaLabel={t("extraOtherCountryPermanentResidence")}
            options={[
              { value: "yes", label: tCommon("yes") },
              { value: "no", label: tCommon("no") },
            ]}
          />
          {value.hasOtherCountryPermanentResidence ? (
            <div className="mt-3 flex flex-col gap-3">
              {permanentResidenceCountries.map((countryCode, idx) => (
                <CountryDropdown
                  key={`perm-country-${idx}`}
                  defaultValue={countryCode}
                  placeholder={t("extraNationalityCountryPlaceholder")}
                  onChange={(country) => {
                    const next = [...permanentResidenceCountries];
                    next[idx] = country.alpha3;
                    set("permanentResidenceCountries", next);
                  }}
                />
              ))}
              <button
                type="button"
                onClick={() => set("permanentResidenceCountries", [...permanentResidenceCountries, ""])}
                className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-brand-500 hover:text-brand-400"
              >
                <Plus className="h-4 w-4" />
                {t("extraAddCountry")}
              </button>
            </div>
          ) : null}
        </BrandField>

        <BrandField label={t("extraUsSocialSecurityOrTaxId")}>
          <TabChoice
            name="extra-us-social-security-or-tax-id"
            value={value.hasUsSocialSecurityOrTaxId ? "yes" : "no"}
            columns={2}
            onChange={(next) => {
              const enabled = next === "yes";
              onChange({
                ...value,
                hasUsSocialSecurityOrTaxId: enabled,
                hasSsn: enabled ? value.hasSsn : false,
                ssn: enabled ? value.ssn : "",
                hasItin: enabled ? value.hasItin : false,
                itin: enabled ? value.itin : "",
              });
            }}
            ariaLabel={t("extraUsSocialSecurityOrTaxId")}
            options={[
              { value: "yes", label: tCommon("yes") },
              { value: "no", label: tCommon("no") },
            ]}
          />
          {value.hasUsSocialSecurityOrTaxId ? (
            <div className="mt-3 flex flex-col gap-4 border-l-2 border-brand-50 pl-3">
              <div className="space-y-2">
                <BrandField label={t("extraSsnLabel")}>
                  <TabChoice
                    name="has-ssn"
                    value={value.hasSsn ? "yes" : "no"}
                    columns={2}
                    onChange={(next) => {
                      const hasSsn = next === "yes";
                      onChange({ ...value, hasSsn, ssn: hasSsn ? value.ssn : "" });
                    }}
                    ariaLabel={t("extraSsnLabel")}
                    options={[
                      { value: "yes", label: tCommon("yes") },
                      { value: "no", label: tCommon("no") },
                    ]}
                  />
                </BrandField>
                {value.hasSsn ? (
                  <BrandField label={t("extraSsnInputLabel")} hint={t("extraSsnHint")}>
                    <BrandInput
                      value={value.ssn}
                      onChange={(e) => set("ssn", e.target.value)}
                      placeholder={t("extraSsnPlaceholder")}
                    />
                  </BrandField>
                ) : null}
              </div>

              <div className="space-y-2">
                <BrandField label={t("extraItinLabel")}>
                  <TabChoice
                    name="has-itin"
                    value={value.hasItin ? "yes" : "no"}
                    columns={2}
                    onChange={(next) => {
                      const hasItin = next === "yes";
                      onChange({ ...value, hasItin, itin: hasItin ? value.itin : "" });
                    }}
                    ariaLabel={t("extraItinLabel")}
                    options={[
                      { value: "yes", label: tCommon("yes") },
                      { value: "no", label: tCommon("no") },
                    ]}
                  />
                </BrandField>
                {value.hasItin ? (
                  <BrandField
                    label={
                      <span className="inline-flex items-center gap-2">
                        <span>{t("extraItinInputLabel")}</span>
                        <Popover open={openHelp === "itin"} onOpenChange={(open) => setOpenHelp(open ? "itin" : null)}>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              aria-label={t("extraItinInputLabel")}
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
                            <p className="pr-8 leading-7">{t("extraItinHint")}</p>
                          </PopoverContent>
                        </Popover>
                      </span>
                    }
                  >
                    <BrandInput
                      value={value.itin}
                      onChange={(e) => set("itin", e.target.value)}
                      placeholder={t("extraItinPlaceholder")}
                    />
                  </BrandField>
                ) : null}
              </div>
            </div>
          ) : null}
        </BrandField>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-white p-4">
        <h3 className="text-[28px] font-semibold tracking-tight text-foreground">{t("nationalIdSectionTitle")}</h3>
        <BrandField
          label={
            <span className="inline-flex items-center gap-2">
              <span>{t("nationalIdInputLabel")}</span>
              <Popover open={openHelp === "nationalId"} onOpenChange={(open) => setOpenHelp(open ? "nationalId" : null)}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label={t("nationalIdInputLabel")}
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
                  <p className="pr-8 leading-7">{t("nationalIdHelp")}</p>
                </PopoverContent>
              </Popover>
            </span>
          }
          required
        >
          {!value.hasNationalId ? (
            <BrandInput
              value={value.nationalId}
              onChange={(e) => set("nationalId", e.target.value)}
              placeholder={t("nationalIdPlaceholderLong")}
            />
          ) : null}
        </BrandField>
        <label className="inline-flex items-center gap-2 text-base font-medium text-foreground">
          <input
            type="checkbox"
            checked={value.hasNationalId}
            onChange={(e) => {
              const noNationalId = e.target.checked;
              onChange({
                ...value,
                hasNationalId: noNationalId,
                nationalId: noNationalId ? "" : value.nationalId,
              });
            }}
            className="h-5 w-5 rounded border-input"
          />
          <span>{t("nationalIdNone")}</span>
        </label>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-white p-4">
        <h3 className="text-[28px] font-semibold tracking-tight text-foreground">{t("lostPassportSectionTitle")}</h3>
        <BrandField label={t("lostPassportQuestion")}>
          <TabChoice
            name="lost-passport"
            value={value.hasLostPassport ? "yes" : "no"}
            columns={2}
            onChange={(next) => {
              const hasLostPassport = next === "yes";
              onChange({
                ...value,
                hasLostPassport,
                lostPassportKnowsNumber: hasLostPassport ? value.lostPassportKnowsNumber : false,
                lostPassportNumber: hasLostPassport ? value.lostPassportNumber : "",
                lostPassportCountry: hasLostPassport ? value.lostPassportCountry : "",
                lostPassportExplanation: hasLostPassport ? value.lostPassportExplanation : "",
              });
            }}
            ariaLabel={t("lostPassportQuestion")}
            options={[
              { value: "no", label: tCommon("no") },
              { value: "yes", label: tCommon("yes") },
            ]}
          />
        </BrandField>
        {value.hasLostPassport ? (
          <div className="rounded-xl border border-[#f3e7cc] bg-[#fffaf1] p-4">
            <p className="mb-3 text-lg font-semibold text-foreground">{t("lostPassportCardTitle")}</p>
            <BrandField label={t("lostPassportKnowNumber")}>
              <TabChoice
                name="lost-passport-know-number"
                value={value.lostPassportKnowsNumber ? "yes" : "no"}
                columns={2}
                onChange={(next) => {
                  const knows = next === "yes";
                  onChange({
                    ...value,
                    lostPassportKnowsNumber: knows,
                    lostPassportNumber: knows ? value.lostPassportNumber : "",
                  });
                }}
                ariaLabel={t("lostPassportKnowNumber")}
                options={[
                  { value: "yes", label: tCommon("yes") },
                  { value: "no", label: tCommon("no") },
                ]}
              />
            </BrandField>
            {value.lostPassportKnowsNumber ? (
              <BrandField label={t("lostPassportNumber")} className="mt-3">
                <BrandInput
                  value={value.lostPassportNumber}
                  onChange={(e) => set("lostPassportNumber", e.target.value.toUpperCase())}
                  placeholder={t("numberPlaceholder")}
                />
              </BrandField>
            ) : null}
            <BrandField label={t("lostPassportCountry")} required className="mt-3">
              <CountryDropdown
                defaultValue={value.lostPassportCountry}
                placeholder={t("extraNationalityCountryPlaceholder")}
                onChange={(country) => set("lostPassportCountry", country.alpha3)}
              />
            </BrandField>
            <BrandField label={t("lostPassportExplanation")} required className="mt-3">
              <Textarea
                value={value.lostPassportExplanation}
                onChange={(e) => set("lostPassportExplanation", e.target.value)}
                placeholder={t("lostPassportExplanationPlaceholderLong")}
                rows={4}
                className="rounded-lg border-[#e8e8e8] text-[15px] focus-visible:ring-1 focus-visible:ring-brand-500 focus-visible:border-brand-500"
              />
            </BrandField>
          </div>
        ) : null}
      </div>

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

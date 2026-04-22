"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { BrandInput, BrandField } from "@/components/client/brand-field";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { TabChoice } from "./tab-choice";
import type { SimplifiedTravel } from "./types";

interface StepTravelProps {
  value: SimplifiedTravel;
  onChange: (value: SimplifiedTravel) => void;
  onContinue: () => void;
}

export function StepTravel({ value, onChange, onContinue }: StepTravelProps) {
  const t = useTranslations("simplifiedForm.travel");
  const tCommon = useTranslations("simplifiedForm.common");

  const set = <K extends keyof SimplifiedTravel>(key: K, next: SimplifiedTravel[K]) =>
    onChange({ ...value, [key]: next });

  const hasPlans = value.plansState !== "unsure";
  const plansDetailsValid = hasPlans
    ? value.arrivalDate && value.lengthValue.trim() && value.accommodationType
    : true;
  const canContinue = Boolean(
    value.plansState &&
      value.tripPayer &&
      plansDetailsValid &&
      (value.previousRefusal !== "yes" || value.refusalExplanation.trim()),
  );

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

      <BrandField label={t("plans")} required>
        <TabChoice
          name="travel-plans"
          value={value.plansState}
          columns={3}
          onChange={(next) => set("plansState", next)}
          ariaLabel={t("plans")}
          options={[
            { value: "yes", label: t("plansYes"), description: t("plansYesHint") },
            { value: "idea", label: t("plansIdea"), description: t("plansIdeaHint") },
            { value: "unsure", label: t("plansUnsure"), description: t("plansUnsureHint") },
          ]}
        />
      </BrandField>

      {hasPlans ? (
        <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-muted/40 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <BrandField label={t("arrivalDate")} required>
              <DatePicker
                value={value.arrivalDate}
                onChange={(next) => set("arrivalDate", next)}
                placeholder={t("arrivalDatePlaceholder")}
              />
            </BrandField>
            <BrandField label={t("lengthOfStay")} htmlFor="length" required>
              <div className="flex gap-2">
                <BrandInput
                  id="length"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={value.lengthValue}
                  onChange={(e) => set("lengthValue", e.target.value)}
                  placeholder={t("lengthOfStayPlaceholder")}
                  className="w-28"
                />
                <TabChoice
                  name="length-unit"
                  value={value.lengthUnit}
                  columns={3}
                  onChange={(next) => set("lengthUnit", next)}
                  ariaLabel={t("lengthUnit")}
                  className="flex-1"
                  options={[
                    { value: "Days", label: t("days") },
                    { value: "Weeks", label: t("weeks") },
                    { value: "Months", label: t("months") },
                  ]}
                />
              </div>
            </BrandField>
          </div>

          <BrandField label={t("accommodation")} required>
            <TabChoice
              name="accommodation-type"
              value={value.accommodationType}
              columns={3}
              onChange={(next) => set("accommodationType", next)}
              ariaLabel={t("accommodation")}
              options={[
                { value: "Hotel", label: t("hotel") },
                { value: "Private Home", label: t("privateHome") },
                { value: "Other", label: t("other") },
              ]}
            />
          </BrandField>

          <BrandField label={t("usStreet")} htmlFor="us-street">
            <BrandInput
              id="us-street"
              value={value.usStreet}
              onChange={(e) => set("usStreet", e.target.value)}
              placeholder={t("usStreetPlaceholder")}
              autoComplete="address-line1"
            />
          </BrandField>
          <div className="grid gap-4 sm:grid-cols-3">
            <BrandInput
              value={value.usCity}
              onChange={(e) => set("usCity", e.target.value)}
              placeholder={t("usCityPlaceholder")}
              aria-label={t("usCity")}
              autoComplete="address-level2"
            />
            <BrandInput
              value={value.usState}
              onChange={(e) => set("usState", e.target.value)}
              placeholder={t("usStatePlaceholder")}
              aria-label={t("usState")}
              autoComplete="address-level1"
            />
            <BrandInput
              value={value.usZip}
              onChange={(e) => set("usZip", e.target.value)}
              placeholder={t("usZipPlaceholder")}
              aria-label={t("usZip")}
              autoComplete="postal-code"
            />
          </div>
        </div>
      ) : null}

      <BrandField label={t("payer")} required>
        <TabChoice
          name="trip-payer"
          value={value.tripPayer}
          columns={4}
          onChange={(next) => set("tripPayer", next)}
          ariaLabel={t("payer")}
          options={[
            { value: "Self", label: t("payerSelf") },
            { value: "Family", label: t("payerFamily") },
            { value: "Employer", label: t("payerEmployer") },
            { value: "Other", label: t("payerOther") },
          ]}
        />
      </BrandField>

      <BrandField label={t("embassyLocation")} hint={t("embassyLocationHint")}>
        <BrandInput
          value={value.embassyLocation}
          onChange={(e) => set("embassyLocation", e.target.value)}
          placeholder={t("embassyLocationPlaceholder")}
        />
      </BrandField>

      <BrandField label={t("hasCompanions")} hint={t("hasCompanionsHint")}>
        <TabChoice
          name="has-companions"
          value={value.hasCompanions}
          columns={2}
          onChange={(next) => set("hasCompanions", next)}
          ariaLabel={t("hasCompanions")}
          options={[
            { value: "no", label: tCommon("no") },
            { value: "yes", label: tCommon("yes") },
          ]}
        />
        {value.hasCompanions === "yes" ? (
          <div className="mt-2 flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <BrandInput
                value={value.companionFirstName}
                onChange={(e) => set("companionFirstName", e.target.value)}
                placeholder={t("companionFirstNamePlaceholder")}
                aria-label={t("companionFirstName")}
              />
              <BrandInput
                value={value.companionLastName}
                onChange={(e) => set("companionLastName", e.target.value)}
                placeholder={t("companionLastNamePlaceholder")}
                aria-label={t("companionLastName")}
              />
            </div>
            <BrandInput
              value={value.companionRelationship}
              onChange={(e) => set("companionRelationship", e.target.value)}
              placeholder={t("companionRelationshipPlaceholder")}
              aria-label={t("companionRelationship")}
            />
          </div>
        ) : null}
      </BrandField>

      <BrandField label={t("hasBeenInUs")} hint={t("hasBeenInUsHint")}>
        <TabChoice
          name="has-been-in-us"
          value={value.hasBeenInUs}
          columns={2}
          onChange={(next) => set("hasBeenInUs", next)}
          ariaLabel={t("hasBeenInUs")}
          options={[
            { value: "no", label: tCommon("no") },
            { value: "yes", label: tCommon("yes") },
          ]}
        />
        {value.hasBeenInUs === "yes" ? (
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <DatePicker
              value={value.previousVisitDate}
              onChange={(next) => set("previousVisitDate", next)}
              placeholder={t("previousVisitDatePlaceholder")}
            />
            <div className="flex gap-2">
              <BrandInput
                type="number"
                inputMode="numeric"
                min={1}
                value={value.previousVisitLengthValue}
                onChange={(e) => set("previousVisitLengthValue", e.target.value)}
                placeholder={t("previousVisitLengthPlaceholder")}
                aria-label={t("previousVisitLength")}
                className="w-24"
              />
              <TabChoice
                name="previous-visit-unit"
                value={value.previousVisitLengthUnit}
                columns={3}
                onChange={(next) => set("previousVisitLengthUnit", next)}
                ariaLabel={t("lengthUnit")}
                className="flex-1"
                options={[
                  { value: "Days", label: t("days") },
                  { value: "Weeks", label: t("weeks") },
                  { value: "Months", label: t("months") },
                ]}
              />
            </div>
          </div>
        ) : null}
      </BrandField>

      {value.hasBeenInUs === "yes" ? (
        <BrandField label={t("hasUsDriversLicense")}>
          <TabChoice
            name="has-us-dl"
            value={value.hasUsDriversLicense}
            columns={2}
            onChange={(next) => set("hasUsDriversLicense", next)}
            ariaLabel={t("hasUsDriversLicense")}
            options={[
              { value: "no", label: tCommon("no") },
              { value: "yes", label: tCommon("yes") },
            ]}
          />
          {value.hasUsDriversLicense === "yes" ? (
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <BrandInput
                value={value.driversLicenseNumber}
                onChange={(e) => set("driversLicenseNumber", e.target.value)}
                placeholder={t("driversLicenseNumberPlaceholder")}
                aria-label={t("driversLicenseNumber")}
              />
              <BrandInput
                value={value.driversLicenseState}
                onChange={(e) => set("driversLicenseState", e.target.value)}
                placeholder={t("driversLicenseStatePlaceholder")}
                aria-label={t("driversLicenseState")}
              />
            </div>
          ) : null}
        </BrandField>
      ) : null}

      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-muted/40 p-4">
        <p className="text-sm font-semibold text-foreground">{t("visaHistoryTitle")}</p>

        <BrandField label={t("previousVisa")}>
          <TabChoice
            name="previous-visa"
            value={value.previousVisa}
            columns={2}
            onChange={(next) => set("previousVisa", next)}
            ariaLabel={t("previousVisa")}
            options={[
              { value: "no", label: tCommon("no") },
              { value: "yes", label: tCommon("yes") },
            ]}
          />
          {value.previousVisa === "yes" ? (
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <BrandInput
                value={value.previousVisaNumber}
                onChange={(e) => set("previousVisaNumber", e.target.value)}
                placeholder={t("previousVisaNumberPlaceholder")}
                aria-label={t("previousVisaNumber")}
              />
              <DatePicker
                value={value.previousVisaExpiry}
                onChange={(next) => set("previousVisaExpiry", next)}
                placeholder={t("previousVisaExpiryPlaceholder")}
              />
            </div>
          ) : null}
        </BrandField>

        <BrandField label={t("previousRefusal")}>
          <TabChoice
            name="previous-refusal"
            value={value.previousRefusal}
            columns={2}
            onChange={(next) => set("previousRefusal", next)}
            ariaLabel={t("previousRefusal")}
            options={[
              { value: "no", label: tCommon("no") },
              { value: "yes", label: tCommon("yes") },
            ]}
          />
          {value.previousRefusal === "yes" ? (
            <Textarea
              value={value.refusalExplanation}
              onChange={(e) => set("refusalExplanation", e.target.value)}
              placeholder={t("refusalExplanationPlaceholder")}
              aria-label={t("refusalExplanation")}
              rows={3}
              className="mt-2 rounded-lg border-[#e8e8e8] text-[15px] focus-visible:ring-1 focus-visible:ring-brand-500 focus-visible:border-brand-500"
            />
          ) : null}
        </BrandField>

        <div className="grid gap-4 sm:grid-cols-2">
          <BrandField label={t("estaDenied")}>
            <TabChoice
              name="esta-denied"
              value={value.estaDenied}
              columns={2}
              onChange={(next) => set("estaDenied", next)}
              ariaLabel={t("estaDenied")}
              options={[
                { value: "no", label: tCommon("no") },
                { value: "yes", label: tCommon("yes") },
              ]}
            />
          </BrandField>
          <BrandField label={t("petitionFiled")}>
            <TabChoice
              name="petition-filed"
              value={value.petitionFiled}
              columns={2}
              onChange={(next) => set("petitionFiled", next)}
              ariaLabel={t("petitionFiled")}
              options={[
                { value: "no", label: tCommon("no") },
                { value: "yes", label: tCommon("yes") },
              ]}
            />
          </BrandField>
        </div>
      </div>

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

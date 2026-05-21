"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { BrandInput, BrandField } from "@/components/client/brand-field";
import { DatePicker } from "@/components/ui/date-picker";
import { CountryDropdown } from "@/components/ui/country-dropdown";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TabChoice } from "./tab-choice";
import type { SimplifiedTravel } from "./types";

interface StepTravelProps {
  value: SimplifiedTravel;
  onChange: (value: SimplifiedTravel) => void;
  onContinue: () => void;
}

const DIAL_CODES: Array<{ label: string; value: string }> = [
  { label: "🇨🇳 +86", value: "+86" },
  { label: "🇺🇸 +1", value: "+1" },
  { label: "🇬🇧 +44", value: "+44" },
  { label: "🇯🇵 +81", value: "+81" },
  { label: "🇰🇷 +82", value: "+82" },
  { label: "🇸🇬 +65", value: "+65" },
  { label: "🇦🇺 +61", value: "+61" },
  { label: "🇨🇦 +1", value: "+1" },
];

export function StepTravel({ value, onChange, onContinue }: StepTravelProps) {
  const t = useTranslations("simplifiedForm.travel");
  const tCommon = useTranslations("simplifiedForm.common");

  const set = <K extends keyof SimplifiedTravel>(key: K, next: SimplifiedTravel[K]) =>
    onChange({ ...value, [key]: next });
  const hasSpecificPlans = value.plansState === "yes";
  const hasInitialIdea = value.plansState === "idea";
  const isShortTransit = value.lengthUnit === "LessThan24Hours";
  const showCompanionBlock = true;

  const setPlace = (index: number, next: string) => {
    const places = [...(value.placesToVisit ?? [""])];
    places[index] = next;
    set("placesToVisit", places);
  };

  const addPlace = () => {
    set("placesToVisit", [...(value.placesToVisit ?? [""]), ""]);
  };

  const setCompanion = (
    index: number,
    key: "firstName" | "lastName" | "relationship",
    next: string
  ) => {
    const companions = [...(value.companions ?? [{ firstName: "", lastName: "", relationship: "" }])];
    companions[index] = { ...companions[index], [key]: next };
    set("companions", companions);
  };

  const addCompanion = () => {
    set("companions", [...(value.companions ?? [{ firstName: "", lastName: "", relationship: "" }]), { firstName: "", lastName: "", relationship: "" }]);
  };

  const setVisitedCountry = (index: number, next: string) => {
    const countries = [...(value.visitedCountries ?? [""])];
    countries[index] = next;
    set("visitedCountries", countries);
  };

  const addVisitedCountry = () => {
    set("visitedCountries", [...(value.visitedCountries ?? [""]), ""]);
  };

  const setVisit = (
    index: number,
    key: "arrivalDate" | "lengthValue" | "lengthUnit",
    next: string
  ) => {
    const visits = [...(value.previousVisits ?? [{ arrivalDate: "", lengthValue: "", lengthUnit: "Days" }])];
    visits[index] = { ...visits[index], [key]: next };
    set("previousVisits", visits);
  };

  const addVisit = () => {
    set("previousVisits", [...(value.previousVisits ?? [{ arrivalDate: "", lengthValue: "", lengthUnit: "Days" }]), { arrivalDate: "", lengthValue: "", lengthUnit: "Days" }]);
  };

  const setLicense = (
    index: number,
    key: "unknownNumber" | "number" | "state",
    next: boolean | string
  ) => {
    const licenses = [...(value.usDriversLicenses ?? [{ unknownNumber: false, number: "", state: "" }])];
    licenses[index] = { ...licenses[index], [key]: next } as (typeof licenses)[number];
    set("usDriversLicenses", licenses);
  };

  const addLicense = () => {
    set("usDriversLicenses", [...(value.usDriversLicenses ?? [{ unknownNumber: false, number: "", state: "" }]), { unknownNumber: false, number: "", state: "" }]);
  };

  const canContinue = true;

  return (
    <div className="flex flex-col gap-6">
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

      {hasSpecificPlans ? (
        <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-muted/40 p-4">
          <p className="text-sm font-semibold text-foreground">{t("specificPlanTitle")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <BrandField label={t("arrivalDate")} required>
              <DatePicker
                value={value.arrivalDate}
                onChange={(next) => set("arrivalDate", next)}
                placeholder={t("arrivalDatePlaceholder")}
              />
            </BrandField>
            <BrandField label={t("departureDate")} required>
              <DatePicker
                value={value.departureDate}
                onChange={(next) => set("departureDate", next)}
                placeholder={t("departureDatePlaceholder")}
              />
            </BrandField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <BrandField label={t("arrivalCity")} required>
              <BrandInput
                value={value.arrivalCity}
                onChange={(e) => set("arrivalCity", e.target.value)}
                placeholder={t("arrivalCityPlaceholder")}
              />
            </BrandField>
            <BrandField label={t("arrivalFlight")}>
              <BrandInput
                value={value.arrivalFlight}
                onChange={(e) => set("arrivalFlight", e.target.value)}
                placeholder={t("arrivalFlightPlaceholder")}
              />
            </BrandField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <BrandField label={t("departureCity")} required>
              <BrandInput
                value={value.departureCity}
                onChange={(e) => set("departureCity", e.target.value)}
                placeholder={t("departureCityPlaceholder")}
              />
            </BrandField>
            <BrandField label={t("departureFlight")}>
              <BrandInput
                value={value.departureFlight}
                onChange={(e) => set("departureFlight", e.target.value)}
                placeholder={t("departureFlightPlaceholder")}
              />
            </BrandField>
          </div>

          <div className="flex flex-col gap-2">
            <BrandField label={t("placesToVisit")} required>
              <div className="flex flex-col gap-2">
                {(value.placesToVisit ?? [""]).map((place, index) => (
                  <BrandInput
                    key={`place-${index}`}
                    value={place}
                    onChange={(e) => setPlace(index, e.target.value)}
                    placeholder={t("placeToVisitPlaceholder")}
                  />
                ))}
              </div>
            </BrandField>
            <button
              type="button"
              onClick={addPlace}
              className="inline-flex w-fit items-center gap-1 text-sm font-medium text-brand-500 hover:text-brand-500/80"
            >
              <Plus className="h-4 w-4" />
              {t("addPlace")}
            </button>
          </div>
        </div>
      ) : null}

      {hasInitialIdea ? (
        <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-muted/40 p-4">
          <p className="text-sm font-semibold text-foreground">{t("estimatedPlanTitle")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <BrandField label={t("estimatedArrivalDate")} required>
              <DatePicker
                value={value.arrivalDate}
                onChange={(next) => set("arrivalDate", next)}
                placeholder={t("arrivalDatePlaceholder")}
              />
            </BrandField>
            <BrandField label={t("lengthOfStay")} htmlFor="length" required>
              <div className="flex gap-2">
                {isShortTransit ? null : (
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
                )}
                <Select
                  value={value.lengthUnit}
                  onValueChange={(next) => set("lengthUnit", next as SimplifiedTravel["lengthUnit"])}
                >
                  <SelectTrigger
                    className="h-12 flex-1 rounded-lg border-[#e8e8e8] text-[15px] focus:ring-1 focus:ring-brand-500 focus:border-brand-500 data-[placeholder]:text-muted-foreground"
                    aria-label={t("lengthUnit")}
                  >
                    <SelectValue placeholder={t("lengthUnit")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Days">{t("days")}</SelectItem>
                    <SelectItem value="Weeks">{t("weeks")}</SelectItem>
                    <SelectItem value="Months">{t("months")}</SelectItem>
                    <SelectItem value="Years">{t("years")}</SelectItem>
                    <SelectItem value="LessThan24Hours">{t("lessThan24Hours")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </BrandField>
          </div>
        </div>
      ) : null}

      {showCompanionBlock ? (
        <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-muted/40 p-4">
          <p className="text-sm font-semibold text-foreground">{t("companionsTitle")}</p>
          <BrandField label={t("hasCompanions")} required>
            <TabChoice
              name="has-companions"
              value={value.hasCompanions}
              columns={2}
              onChange={(next) => set("hasCompanions", next)}
              ariaLabel={t("hasCompanions")}
              options={[
                { value: "yes", label: tCommon("yes") },
                { value: "no", label: tCommon("no") },
              ]}
            />
          </BrandField>

          {value.hasCompanions === "yes" ? (
            <>
              <BrandField label={t("companionGroupTravel")} required>
                <TabChoice
                  name="companion-group-travel"
                  value={value.companionGroupTravel}
                  columns={2}
                  onChange={(next) => set("companionGroupTravel", next)}
                  ariaLabel={t("companionGroupTravel")}
                  options={[
                    { value: "yes", label: tCommon("yes") },
                    { value: "no", label: tCommon("no") },
                  ]}
                />
              </BrandField>

              {value.companionGroupTravel === "yes" ? (
                <BrandField label={t("companionGroupName")} required>
                  <BrandInput
                    value={value.companionGroupName}
                    onChange={(e) => set("companionGroupName", e.target.value)}
                    placeholder={t("companionGroupNamePlaceholder")}
                  />
                </BrandField>
              ) : null}

              {value.companionGroupTravel === "no" ? (
                <div className="flex flex-col gap-3">
                  {(value.companions ?? [{ firstName: "", lastName: "", relationship: "" }]).map((companion, index) => (
                    <div
                      key={`companion-${index}`}
                      className="flex flex-col gap-3 rounded-xl border border-border/60 bg-white p-4"
                    >
                      <p className="text-sm font-medium text-muted-foreground">
                        {t("travelerN", { index: index + 1 })}
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <BrandField label={t("companionFirstName")} required>
                          <BrandInput
                            value={companion.firstName}
                            onChange={(e) => setCompanion(index, "firstName", e.target.value)}
                            placeholder={t("companionFirstNamePlaceholder")}
                          />
                        </BrandField>
                        <BrandField label={t("companionLastName")} required>
                          <BrandInput
                            value={companion.lastName}
                            onChange={(e) => setCompanion(index, "lastName", e.target.value)}
                            placeholder={t("companionLastNamePlaceholder")}
                          />
                        </BrandField>
                      </div>
                      <BrandField label={t("companionRelationship")} required>
                        <Select
                          value={companion.relationship}
                          onValueChange={(next) =>
                            setCompanion(index, "relationship", next as "child" | "parent" | "spouse" | "relative" | "friend" | "business_partner" | "other")
                          }
                        >
                          <SelectTrigger className="h-12 rounded-lg border-[#e8e8e8] text-[15px] focus:ring-1 focus:ring-brand-500 focus:border-brand-500 data-[placeholder]:text-muted-foreground">
                            <SelectValue placeholder={t("companionRelationshipPlaceholder")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="child">{t("relationshipChild")}</SelectItem>
                            <SelectItem value="parent">{t("relationshipParent")}</SelectItem>
                            <SelectItem value="spouse">{t("relationshipSpouse")}</SelectItem>
                            <SelectItem value="relative">{t("relationshipRelative")}</SelectItem>
                            <SelectItem value="friend">{t("relationshipFriend")}</SelectItem>
                            <SelectItem value="business_partner">{t("relationshipBusinessPartner")}</SelectItem>
                            <SelectItem value="other">{t("other")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </BrandField>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addCompanion}
                    className="inline-flex w-fit items-center gap-1 text-sm font-medium text-brand-500 hover:text-brand-500/80"
                  >
                    <Plus className="h-4 w-4" />
                    {t("addTraveler")}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-muted/40 p-4">
        <p className="text-sm font-semibold text-foreground">{t("internationalTravelTitle")}</p>
        <BrandField label={t("hasVisitedOtherCountriesLast5Years")} required>
          <TabChoice
            name="has-visited-other-countries"
            value={value.hasVisitedOtherCountriesLast5Years}
            columns={2}
            onChange={(next) => set("hasVisitedOtherCountriesLast5Years", next)}
            ariaLabel={t("hasVisitedOtherCountriesLast5Years")}
            options={[
              { value: "yes", label: tCommon("yes") },
              { value: "no", label: tCommon("no") },
            ]}
          />
        </BrandField>
        {value.hasVisitedOtherCountriesLast5Years === "yes" ? (
          <div className="flex flex-col gap-3">
            <BrandField label={t("visitedCountries")} required>
              <div className="flex flex-col gap-2">
                {(value.visitedCountries ?? [""]).map((country, index) => (
                  <CountryDropdown
                    key={`visited-country-${index}`}
                    defaultValue={country}
                    onChange={(selected) => setVisitedCountry(index, selected.name)}
                    placeholder={t("countryPlaceholder")}
                  />
                ))}
              </div>
            </BrandField>
            <button
              type="button"
              onClick={addVisitedCountry}
              className="inline-flex w-fit items-center gap-1 text-sm font-medium text-brand-500 hover:text-brand-500/80"
            >
              <Plus className="h-4 w-4" />
              {t("addCountry")}
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-muted/40 p-4">
        <p className="text-sm font-semibold text-foreground">{t("previousUsTravelTitle")}</p>
        <BrandField label={t("hasBeenInUs")} required>
          <TabChoice
            name="has-been-in-us"
            value={value.hasBeenInUs}
            columns={2}
            onChange={(next) => set("hasBeenInUs", next)}
            ariaLabel={t("hasBeenInUs")}
            options={[
              { value: "yes", label: tCommon("yes") },
              { value: "no", label: tCommon("no") },
            ]}
          />
        </BrandField>

        {value.hasBeenInUs === "yes" ? (
          <>
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-foreground">{t("previousVisits")}</p>
              {(value.previousVisits ?? [{ arrivalDate: "", lengthValue: "", lengthUnit: "Days" }]).map(
                (visit, index) => (
                  <div
                    key={`visit-${index}`}
                    className="flex flex-col gap-3 rounded-xl border border-border/60 bg-white p-4"
                  >
                    <p className="text-sm font-medium text-muted-foreground">{t("visitN", { index: index + 1 })}</p>
                    <BrandField label={t("previousVisitDate")} required>
                      <DatePicker
                        value={visit.arrivalDate}
                        onChange={(next) => setVisit(index, "arrivalDate", next)}
                        placeholder={t("previousVisitDatePlaceholder")}
                      />
                    </BrandField>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {visit.lengthUnit === "LessThan24Hours" ? null : (
                        <BrandField label={t("previousVisitLength")} required>
                          <BrandInput
                            type="number"
                            inputMode="numeric"
                            min={1}
                            value={visit.lengthValue}
                            onChange={(e) => setVisit(index, "lengthValue", e.target.value)}
                            placeholder={t("previousVisitLengthPlaceholder")}
                          />
                        </BrandField>
                      )}
                      <BrandField label={t("unit")} required>
                        <Select
                          value={visit.lengthUnit}
                          onValueChange={(next) => setVisit(index, "lengthUnit", next as SimplifiedTravel["previousVisitLengthUnit"])}
                        >
                          <SelectTrigger className="h-12 rounded-lg border-[#e8e8e8] text-[15px] focus:ring-1 focus:ring-brand-500 focus:border-brand-500 data-[placeholder]:text-muted-foreground">
                            <SelectValue placeholder={t("unit")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Days">{t("days")}</SelectItem>
                            <SelectItem value="Weeks">{t("weeks")}</SelectItem>
                            <SelectItem value="Months">{t("months")}</SelectItem>
                            <SelectItem value="Years">{t("years")}</SelectItem>
                            <SelectItem value="LessThan24Hours">{t("lessThan24Hours")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </BrandField>
                    </div>
                  </div>
                )
              )}
              <button
                type="button"
                onClick={addVisit}
                className="inline-flex w-fit items-center gap-1 text-sm font-medium text-brand-500 hover:text-brand-500/80"
              >
                <Plus className="h-4 w-4" />
                {t("addVisit")}
              </button>
            </div>

            <BrandField label={t("hasUsDriversLicense")} required>
              <TabChoice
                name="has-us-dl"
                value={value.hasUsDriversLicense}
                columns={2}
                onChange={(next) => set("hasUsDriversLicense", next)}
                ariaLabel={t("hasUsDriversLicense")}
                options={[
                  { value: "yes", label: tCommon("yes") },
                  { value: "no", label: tCommon("no") },
                ]}
              />
            </BrandField>

            {value.hasUsDriversLicense === "yes" ? (
              <div className="flex flex-col gap-3">
                {(value.usDriversLicenses ?? [{ unknownNumber: false, number: "", state: "" }]).map(
                  (license, index) => (
                    <div
                      key={`dl-${index}`}
                      className="flex flex-col gap-3 rounded-xl border border-border/60 bg-white p-4"
                    >
                      <p className="text-sm font-medium text-muted-foreground">
                        {t("licenseN", { index: index + 1 })}
                      </p>
                      <label className="inline-flex items-center gap-2 text-sm text-foreground">
                        <Checkbox
                          checked={license.unknownNumber}
                          onCheckedChange={(checked) => setLicense(index, "unknownNumber", checked === true)}
                        />
                        {t("unknownLicenseNumber")}
                      </label>
                      {license.unknownNumber ? null : (
                        <BrandField label={t("driversLicenseNumber")} required>
                          <BrandInput
                            value={license.number}
                            onChange={(e) => setLicense(index, "number", e.target.value)}
                            placeholder={t("driversLicenseNumberPlaceholder")}
                          />
                        </BrandField>
                      )}
                      <BrandField label={t("usState")} required>
                        <BrandInput
                          value={license.state}
                          onChange={(e) => setLicense(index, "state", e.target.value)}
                          placeholder={t("usStatePlaceholder")}
                        />
                      </BrandField>
                    </div>
                  )
                )}
                <button
                  type="button"
                  onClick={addLicense}
                  className="inline-flex w-fit items-center gap-1 text-sm font-medium text-brand-500 hover:text-brand-500/80"
                >
                  <Plus className="h-4 w-4" />
                  {t("addLicense")}
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-muted/40 p-4">
        <p className="text-sm font-semibold text-foreground">{t("previousUsVisaTitle")}</p>
        <BrandField label={t("previousVisa")} required>
          <TabChoice
            name="has-previous-visa"
            value={value.previousVisa}
            columns={2}
            onChange={(next) => set("previousVisa", next)}
            ariaLabel={t("previousVisa")}
            options={[
              { value: "yes", label: tCommon("yes") },
              { value: "no", label: tCommon("no") },
            ]}
          />
        </BrandField>

        {value.previousVisa === "yes" ? (
          <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-white p-4">
            <BrandField label={t("visaIssueCountry")} required>
              <CountryDropdown
                defaultValue={value.previousVisaIssueCountry}
                onChange={(selected) => set("previousVisaIssueCountry", selected.name)}
                placeholder={t("countryPlaceholder")}
              />
            </BrandField>
            <BrandField label={t("visaIssueDate")} required>
              <DatePicker
                value={value.previousVisaIssueDate}
                onChange={(next) => set("previousVisaIssueDate", next)}
                placeholder={t("arrivalDatePlaceholder")}
              />
            </BrandField>
            <BrandField label={t("visaValidUntil")} required>
              <DatePicker
                value={value.previousVisaValidUntil}
                onChange={(next) => set("previousVisaValidUntil", next)}
                placeholder={t("arrivalDatePlaceholder")}
              />
            </BrandField>
            <label className="inline-flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={value.previousVisaUnknownNumber}
                onCheckedChange={(checked) => set("previousVisaUnknownNumber", checked === true)}
              />
              {t("unknownVisaNumber")}
            </label>
            {value.previousVisaUnknownNumber ? null : (
              <BrandField label={t("previousVisaNumber")} required>
                <BrandInput
                  value={value.previousVisaNumber}
                  onChange={(e) => set("previousVisaNumber", e.target.value)}
                  placeholder={t("previousVisaNumberPlaceholder")}
                />
              </BrandField>
            )}
            <BrandField label={t("sameVisaType")} required>
              <TabChoice
                name="same-visa-type"
                value={value.sameVisaType}
                columns={2}
                onChange={(next) => set("sameVisaType", next)}
                ariaLabel={t("sameVisaType")}
                options={[
                  { value: "yes", label: tCommon("yes") },
                  { value: "no", label: tCommon("no") },
                ]}
              />
            </BrandField>
            <BrandField label={t("sameCountryApply")} required>
              <TabChoice
                name="same-country-apply"
                value={value.sameCountryApply}
                columns={2}
                onChange={(next) => set("sameCountryApply", next)}
                ariaLabel={t("sameCountryApply")}
                options={[
                  { value: "yes", label: tCommon("yes") },
                  { value: "no", label: tCommon("no") },
                ]}
              />
            </BrandField>
            <BrandField label={t("tenPrinted")} required>
              <TabChoice
                name="ten-printed"
                value={value.tenPrinted}
                columns={2}
                onChange={(next) => set("tenPrinted", next)}
                ariaLabel={t("tenPrinted")}
                options={[
                  { value: "yes", label: tCommon("yes") },
                  { value: "no", label: tCommon("no") },
                ]}
              />
            </BrandField>
            <BrandField label={t("visaLostStolen")} required>
              <TabChoice
                name="visa-lost-stolen"
                value={value.visaLostStolen}
                columns={2}
                onChange={(next) => set("visaLostStolen", next)}
                ariaLabel={t("visaLostStolen")}
                options={[
                  { value: "yes", label: tCommon("yes") },
                  { value: "no", label: tCommon("no") },
                ]}
              />
            </BrandField>
            {value.visaLostStolen === "yes" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <BrandField label={t("visaLostStolenYear")} required>
                  <BrandInput
                    value={value.visaLostStolenYear}
                    onChange={(e) => set("visaLostStolenYear", e.target.value)}
                    placeholder="YYYY"
                  />
                </BrandField>
                <BrandField label={t("explanation")} required>
                  <BrandInput
                    value={value.visaLostStolenExplanation}
                    onChange={(e) => set("visaLostStolenExplanation", e.target.value)}
                    placeholder={t("explanationPlaceholder")}
                  />
                </BrandField>
              </div>
            ) : null}
            <BrandField label={t("visaCancelledRevoked")} required>
              <TabChoice
                name="visa-cancelled-revoked"
                value={value.visaCancelledRevoked}
                columns={2}
                onChange={(next) => set("visaCancelledRevoked", next)}
                ariaLabel={t("visaCancelledRevoked")}
                options={[
                  { value: "yes", label: tCommon("yes") },
                  { value: "no", label: tCommon("no") },
                ]}
              />
            </BrandField>
            {value.visaCancelledRevoked === "yes" ? (
              <BrandField label={t("explanation")} required>
                <BrandInput
                  value={value.visaCancelledRevokedExplanation}
                  onChange={(e) => set("visaCancelledRevokedExplanation", e.target.value)}
                  placeholder={t("explanationPlaceholder")}
                />
              </BrandField>
            ) : null}
            <BrandField label={t("received221g")} required>
              <TabChoice
                name="received-221g"
                value={value.received221g}
                columns={2}
                onChange={(next) => set("received221g", next)}
                ariaLabel={t("received221g")}
                options={[
                  { value: "yes", label: tCommon("yes") },
                  { value: "no", label: tCommon("no") },
                ]}
              />
            </BrandField>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-muted/40 p-4">
        <p className="text-sm font-semibold text-foreground">{t("visaHistoryTitle")}</p>
        <BrandField label={t("previousRefusal")} required>
          <TabChoice
            name="previous-refusal"
            value={value.previousRefusal}
            columns={2}
            onChange={(next) => set("previousRefusal", next)}
            ariaLabel={t("previousRefusal")}
            options={[
              { value: "yes", label: tCommon("yes") },
              { value: "no", label: tCommon("no") },
            ]}
          />
        </BrandField>
        {value.previousRefusal === "yes" ? (
          <>
            <BrandField label={t("explanation")} required>
              <Textarea
                value={value.previousRefusalExplanation}
                onChange={(e) => set("previousRefusalExplanation", e.target.value)}
                placeholder={t("explanationDetailPlaceholder")}
                rows={3}
                className="rounded-lg border-[#e8e8e8] text-[15px] focus-visible:ring-1 focus-visible:ring-brand-500 focus-visible:border-brand-500"
              />
            </BrandField>
            <BrandField label={t("refusalDateKnown")}>
              <DatePicker
                value={value.previousRefusalDate}
                onChange={(next) => set("previousRefusalDate", next)}
                placeholder={t("refusalDatePlaceholder")}
              />
            </BrandField>
          </>
        ) : null}

        <BrandField label={t("estaDenied")} required>
          <TabChoice
            name="esta-denied"
            value={value.estaDenied}
            columns={2}
            onChange={(next) => set("estaDenied", next)}
            ariaLabel={t("estaDenied")}
            options={[
              { value: "yes", label: tCommon("yes") },
              { value: "no", label: tCommon("no") },
            ]}
          />
        </BrandField>
        {value.estaDenied === "yes" ? (
          <BrandField label={t("explanation")} required>
            <Textarea
              value={value.estaDeniedExplanation}
              onChange={(e) => set("estaDeniedExplanation", e.target.value)}
              placeholder={t("explanationDetailPlaceholder")}
              rows={3}
              className="rounded-lg border-[#e8e8e8] text-[15px] focus-visible:ring-1 focus-visible:ring-brand-500 focus-visible:border-brand-500"
            />
          </BrandField>
        ) : null}

        <BrandField label={t("petitionFiled")} required>
          <TabChoice
            name="petition-filed"
            value={value.petitionFiled}
            columns={2}
            onChange={(next) => set("petitionFiled", next)}
            ariaLabel={t("petitionFiled")}
            options={[
              { value: "yes", label: tCommon("yes") },
              { value: "no", label: tCommon("no") },
            ]}
          />
        </BrandField>
        {value.petitionFiled === "yes" ? (
          <BrandField label={t("explanation")} required>
            <Textarea
              value={value.petitionFiledExplanation}
              onChange={(e) => set("petitionFiledExplanation", e.target.value)}
              placeholder={t("explanationDetailPlaceholder")}
              rows={3}
              className="rounded-lg border-[#e8e8e8] text-[15px] focus-visible:ring-1 focus-visible:ring-brand-500 focus-visible:border-brand-500"
            />
          </BrandField>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-muted/40 p-4">
        <p className="text-sm font-semibold text-foreground">{t("tripPaymentTitle")}</p>
        <BrandField label={t("payer")} required>
          <Select value={value.tripPayer} onValueChange={(next) => set("tripPayer", next as SimplifiedTravel["tripPayer"])}>
            <SelectTrigger className="h-12 rounded-lg border-[#e8e8e8] text-[15px] focus:ring-1 focus:ring-brand-500 focus:border-brand-500 data-[placeholder]:text-muted-foreground">
              <SelectValue placeholder={t("payerPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Self">{t("payerSelf")}</SelectItem>
              <SelectItem value="Other Person">{t("payerOtherPerson")}</SelectItem>
              <SelectItem value="Current Employer">{t("payerCurrentEmployer")}</SelectItem>
              <SelectItem value="US Employer">{t("payerUsEmployer")}</SelectItem>
              <SelectItem value="Other Company">{t("payerOtherCompany")}</SelectItem>
            </SelectContent>
          </Select>
        </BrandField>

        {value.tripPayer === "Other Person" ? (
          <div className="flex flex-col gap-3 border-t pt-4">
            <p className="text-sm font-semibold text-foreground">{t("payerOtherPersonDetails")}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <BrandField label={t("firstName")} required>
                <BrandInput value={value.payerFirstName} onChange={(e) => set("payerFirstName", e.target.value)} placeholder={t("firstNamePlaceholder")} />
              </BrandField>
              <BrandField label={t("lastName")} required>
                <BrandInput value={value.payerLastName} onChange={(e) => set("payerLastName", e.target.value)} placeholder={t("lastNamePlaceholder")} />
              </BrandField>
            </div>
            <BrandField label={t("phone")} required>
              <InputGroup className="h-12">
                <InputGroupAddon className="h-12 rounded-l-lg border-[#e8e8e8] bg-white px-2">
                  <select
                    value={value.payerPhoneDialCode}
                    onChange={(e) => set("payerPhoneDialCode", e.target.value)}
                    className="h-8 border-0 bg-transparent pr-1 text-sm outline-none"
                    aria-label={t("dialCode")}
                  >
                    {DIAL_CODES.map((code) => (
                      <option key={`${code.value}-${code.label}`} value={code.value}>
                        {code.label}
                      </option>
                    ))}
                  </select>
                </InputGroupAddon>
                <InputGroupInput
                  value={value.payerPhone}
                  onChange={(e) => set("payerPhone", e.target.value)}
                  placeholder={t("phonePlaceholder")}
                />
              </InputGroup>
            </BrandField>
            <BrandField label={t("email")}>
              <BrandInput
                value={value.payerEmail}
                onChange={(e) => set("payerEmail", e.target.value)}
                placeholder={t("emailPlaceholder")}
                disabled={value.payerEmailUnknown}
              />
            </BrandField>
            <label className="inline-flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={value.payerEmailUnknown}
                onCheckedChange={(checked) => set("payerEmailUnknown", checked === true)}
              />
              {t("unknownPayerEmail")}
            </label>
            <BrandField label={t("yourRelationship")} required>
              <Select
                value={value.payerRelationship}
                onValueChange={(next) =>
                  set("payerRelationship", next as SimplifiedTravel["payerRelationship"])
                }
              >
                <SelectTrigger className="h-12 rounded-lg border-[#e8e8e8] text-[15px] focus:ring-1 focus:ring-brand-500 focus:border-brand-500 data-[placeholder]:text-muted-foreground">
                  <SelectValue placeholder={t("relationshipPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="child">{t("relationshipChild")}</SelectItem>
                  <SelectItem value="parent">{t("relationshipParent")}</SelectItem>
                  <SelectItem value="spouse">{t("relationshipSpouse")}</SelectItem>
                  <SelectItem value="relative">{t("relationshipRelative")}</SelectItem>
                  <SelectItem value="friend">{t("relationshipFriend")}</SelectItem>
                  <SelectItem value="business_partner">{t("relationshipBusinessPartner")}</SelectItem>
                  <SelectItem value="other">{t("other")}</SelectItem>
                </SelectContent>
              </Select>
            </BrandField>
            <BrandField label={t("payerAddressSameAsYou")} required>
              <TabChoice
                name="payer-address-same"
                value={value.payerAddressSameAsYou}
                columns={2}
                onChange={(next) => set("payerAddressSameAsYou", next)}
                ariaLabel={t("payerAddressSameAsYou")}
                options={[
                  { value: "yes", label: tCommon("yes") },
                  { value: "no", label: tCommon("no") },
                ]}
              />
            </BrandField>
          </div>
        ) : null}

        {value.tripPayer === "Other Person" && value.payerAddressSameAsYou === "no" ? (
          <div className="flex flex-col gap-3">
            <BrandField label={t("street1")} required>
              <BrandInput value={value.payerStreet1} onChange={(e) => set("payerStreet1", e.target.value)} placeholder={t("street1Placeholder")} />
            </BrandField>
            <BrandField label={t("street2")}>
              <BrandInput value={value.payerStreet2} onChange={(e) => set("payerStreet2", e.target.value)} placeholder={t("street2Placeholder")} />
            </BrandField>
            <BrandField label={t("city")} required>
              <BrandInput value={value.payerCity} onChange={(e) => set("payerCity", e.target.value)} placeholder={t("cityPlaceholder")} />
            </BrandField>
            <BrandField label={t("stateProvince")}>
              <BrandInput
                value={value.payerState}
                onChange={(e) => set("payerState", e.target.value)}
                placeholder={t("stateProvincePlaceholder")}
                disabled={value.payerNoState}
              />
            </BrandField>
            <label className="inline-flex items-center gap-2 text-sm text-foreground">
              <Checkbox checked={value.payerNoState} onCheckedChange={(checked) => set("payerNoState", checked === true)} />
              {t("noStateProvince")}
            </label>
            <BrandField label={t("postalCode")}>
              <BrandInput
                value={value.payerPostalCode}
                onChange={(e) => set("payerPostalCode", e.target.value)}
                placeholder={t("postalCodePlaceholder")}
                disabled={value.payerNoPostalCode}
              />
            </BrandField>
            <label className="inline-flex items-center gap-2 text-sm text-foreground">
              <Checkbox checked={value.payerNoPostalCode} onCheckedChange={(checked) => set("payerNoPostalCode", checked === true)} />
              {t("noPostalCode")}
            </label>
            <BrandField label={t("country")} required>
              <CountryDropdown
                defaultValue={value.payerCountry}
                onChange={(selected) => set("payerCountry", selected.name)}
                placeholder={t("countryPlaceholder")}
              />
            </BrandField>
          </div>
        ) : null}

        {value.tripPayer === "Other Company" ? (
          <div className="flex flex-col gap-3 border-t pt-4">
            <p className="text-sm font-semibold text-foreground">{t("payerOrgDetails")}</p>
            <BrandField label={t("orgName")} required>
              <BrandInput value={value.payerOrgName} onChange={(e) => set("payerOrgName", e.target.value)} placeholder={t("orgNamePlaceholder")} />
            </BrandField>
            <BrandField label={t("phone")} required>
              <InputGroup className="h-12">
                <InputGroupAddon className="h-12 rounded-l-lg border-[#e8e8e8] bg-white px-2">
                  <select
                    value={value.payerOrgPhoneDialCode}
                    onChange={(e) => set("payerOrgPhoneDialCode", e.target.value)}
                    className="h-8 border-0 bg-transparent pr-1 text-sm outline-none"
                    aria-label={t("dialCode")}
                  >
                    {DIAL_CODES.map((code) => (
                      <option key={`${code.value}-${code.label}`} value={code.value}>
                        {code.label}
                      </option>
                    ))}
                  </select>
                </InputGroupAddon>
                <InputGroupInput
                  value={value.payerOrgPhone}
                  onChange={(e) => set("payerOrgPhone", e.target.value)}
                  placeholder={t("phonePlaceholder")}
                />
              </InputGroup>
            </BrandField>
            <BrandField label={t("yourRelationship")} required>
              <BrandInput value={value.payerOrgRelationship} onChange={(e) => set("payerOrgRelationship", e.target.value)} placeholder={t("orgRelationshipPlaceholder")} />
            </BrandField>
            <BrandField label={t("street1")} required>
              <BrandInput value={value.payerStreet1} onChange={(e) => set("payerStreet1", e.target.value)} placeholder={t("street1Placeholder")} />
            </BrandField>
            <BrandField label={t("street2")}>
              <BrandInput value={value.payerStreet2} onChange={(e) => set("payerStreet2", e.target.value)} placeholder={t("street2Placeholder")} />
            </BrandField>
            <BrandField label={t("city")} required>
              <BrandInput value={value.payerCity} onChange={(e) => set("payerCity", e.target.value)} placeholder={t("cityPlaceholder")} />
            </BrandField>
            <BrandField label={t("stateProvince")}>
              <BrandInput
                value={value.payerState}
                onChange={(e) => set("payerState", e.target.value)}
                placeholder={t("stateProvincePlaceholder")}
                disabled={value.payerNoState}
              />
            </BrandField>
            <label className="inline-flex items-center gap-2 text-sm text-foreground">
              <Checkbox checked={value.payerNoState} onCheckedChange={(checked) => set("payerNoState", checked === true)} />
              {t("noStateProvince")}
            </label>
            <BrandField label={t("postalCode")}>
              <BrandInput
                value={value.payerPostalCode}
                onChange={(e) => set("payerPostalCode", e.target.value)}
                placeholder={t("postalCodePlaceholder")}
                disabled={value.payerNoPostalCode}
              />
            </BrandField>
            <label className="inline-flex items-center gap-2 text-sm text-foreground">
              <Checkbox checked={value.payerNoPostalCode} onCheckedChange={(checked) => set("payerNoPostalCode", checked === true)} />
              {t("noPostalCode")}
            </label>
            <BrandField label={t("country")} required>
              <CountryDropdown
                defaultValue={value.payerCountry}
                onChange={(selected) => set("payerCountry", selected.name)}
                placeholder={t("countryPlaceholder")}
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

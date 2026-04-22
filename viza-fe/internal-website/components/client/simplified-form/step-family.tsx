"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandInput, BrandField } from "@/components/client/brand-field";
import { cn } from "@/lib/utils";
import { TabChoice } from "./tab-choice";
import type { SimplifiedFamily } from "./types";

interface StepFamilyProps {
  value: SimplifiedFamily;
  onChange: (value: SimplifiedFamily) => void;
  onContinue: () => void;
}

const RECOMMENDED_LANGUAGES = [
  "English",
  "Chinese (Mandarin)",
  "Chinese (Cantonese)",
  "Spanish",
  "French",
  "Arabic",
  "Hindi",
  "Portuguese",
];

export function StepFamily({ value, onChange, onContinue }: StepFamilyProps) {
  const t = useTranslations("simplifiedForm.family");
  const tCommon = useTranslations("simplifiedForm.common");
  const [customLanguage, setCustomLanguage] = useState("");

  const set = <K extends keyof SimplifiedFamily>(key: K, next: SimplifiedFamily[K]) =>
    onChange({ ...value, [key]: next });

  const toggleLanguage = (lang: string) => {
    if (value.languages.includes(lang)) {
      set("languages", value.languages.filter((l) => l !== lang));
    } else {
      set("languages", [...value.languages, lang]);
    }
  };

  const addCustomLanguage = () => {
    const next = customLanguage.trim();
    if (!next || value.languages.includes(next)) return;
    set("languages", [...value.languages, next]);
    setCustomLanguage("");
  };

  const removeLanguage = (lang: string) => {
    set("languages", value.languages.filter((l) => l !== lang));
  };

  const canContinue = Boolean(
    value.languages.length > 0 &&
      (!value.fatherKnown || (value.fatherFirstName.trim() && value.fatherLastName.trim())) &&
      (!value.motherKnown || (value.motherFirstName.trim() && value.motherLastName.trim())) &&
      (value.relativesInUs !== "yes" ||
        (value.relativeFirstName.trim() && value.relativeLastName.trim() && value.relativeRelationship)) &&
      (value.hasClanTribe !== "yes" || value.clanTribeName.trim()),
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

      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-muted/40 p-4">
        <p className="text-sm font-semibold text-foreground">{t("fatherTitle")}</p>
        <TabChoice
          name="father-known"
          value={value.fatherKnown ? "yes" : "no"}
          columns={2}
          onChange={(next) => set("fatherKnown", next === "yes")}
          ariaLabel={t("fatherKnown")}
          options={[
            { value: "yes", label: t("iKnow") },
            { value: "no", label: t("iDontKnow") },
          ]}
        />
        {value.fatherKnown ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <BrandInput
              value={value.fatherFirstName}
              onChange={(e) => set("fatherFirstName", e.target.value)}
              placeholder={t("firstNamePlaceholder")}
              aria-label={t("fatherFirstName")}
            />
            <BrandInput
              value={value.fatherLastName}
              onChange={(e) => set("fatherLastName", e.target.value)}
              placeholder={t("lastNamePlaceholder")}
              aria-label={t("fatherLastName")}
            />
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-muted/40 p-4">
        <p className="text-sm font-semibold text-foreground">{t("motherTitle")}</p>
        <TabChoice
          name="mother-known"
          value={value.motherKnown ? "yes" : "no"}
          columns={2}
          onChange={(next) => set("motherKnown", next === "yes")}
          ariaLabel={t("motherKnown")}
          options={[
            { value: "yes", label: t("iKnow") },
            { value: "no", label: t("iDontKnow") },
          ]}
        />
        {value.motherKnown ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <BrandInput
              value={value.motherFirstName}
              onChange={(e) => set("motherFirstName", e.target.value)}
              placeholder={t("firstNamePlaceholder")}
              aria-label={t("motherFirstName")}
            />
            <BrandInput
              value={value.motherLastName}
              onChange={(e) => set("motherLastName", e.target.value)}
              placeholder={t("lastNamePlaceholder")}
              aria-label={t("motherLastName")}
            />
          </div>
        ) : null}
      </div>

      <BrandField label={t("relativesInUs")} hint={t("relativesInUsHint")}>
        <TabChoice
          name="relatives-in-us"
          value={value.relativesInUs}
          columns={2}
          onChange={(next) => set("relativesInUs", next)}
          ariaLabel={t("relativesInUs")}
          options={[
            { value: "no", label: tCommon("no") },
            { value: "yes", label: tCommon("yes") },
          ]}
        />
        {value.relativesInUs === "yes" ? (
          <div className="mt-2 flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <BrandInput
                value={value.relativeFirstName}
                onChange={(e) => set("relativeFirstName", e.target.value)}
                placeholder={t("relativeFirstNamePlaceholder")}
                aria-label={t("relativeFirstName")}
              />
              <BrandInput
                value={value.relativeLastName}
                onChange={(e) => set("relativeLastName", e.target.value)}
                placeholder={t("relativeLastNamePlaceholder")}
                aria-label={t("relativeLastName")}
              />
            </div>
            <BrandField label={t("relativeRelationship")}>
              <TabChoice
                name="relative-relationship"
                value={value.relativeRelationship}
                columns={4}
                onChange={(next) => set("relativeRelationship", next)}
                ariaLabel={t("relativeRelationship")}
                options={[
                  { value: "spouse", label: t("relationSpouse") },
                  { value: "fiance", label: t("relationFiance") },
                  { value: "child", label: t("relationChild") },
                  { value: "sibling", label: t("relationSibling") },
                ]}
              />
            </BrandField>
            <BrandField label={t("relativeStatus")}>
              <TabChoice
                name="relative-status"
                value={value.relativeStatus}
                columns={4}
                onChange={(next) => set("relativeStatus", next)}
                ariaLabel={t("relativeStatus")}
                options={[
                  { value: "citizen", label: t("statusCitizen") },
                  { value: "lpr", label: t("statusLpr") },
                  { value: "nonimmigrant", label: t("statusNonimmigrant") },
                  { value: "other_unknown", label: t("statusOther") },
                ]}
              />
            </BrandField>
          </div>
        ) : null}
      </BrandField>

      <BrandField label={t("hasOtherRelatives")} hint={t("hasOtherRelativesHint")}>
        <TabChoice
          name="has-other-relatives"
          value={value.hasOtherRelatives}
          columns={2}
          onChange={(next) => set("hasOtherRelatives", next)}
          ariaLabel={t("hasOtherRelatives")}
          options={[
            { value: "no", label: tCommon("no") },
            { value: "yes", label: tCommon("yes") },
          ]}
        />
      </BrandField>

      <BrandField label={t("clanTribe")} hint={t("clanTribeHint")}>
        <TabChoice
          name="has-clan-tribe"
          value={value.hasClanTribe}
          columns={2}
          onChange={(next) => set("hasClanTribe", next)}
          ariaLabel={t("clanTribe")}
          options={[
            { value: "no", label: tCommon("no") },
            { value: "yes", label: tCommon("yes") },
          ]}
        />
        {value.hasClanTribe === "yes" ? (
          <BrandInput
            value={value.clanTribeName}
            onChange={(e) => set("clanTribeName", e.target.value)}
            placeholder={t("clanTribeNamePlaceholder")}
            aria-label={t("clanTribe")}
            className="mt-2"
          />
        ) : null}
      </BrandField>

      <BrandField label={t("languages")} hint={t("languagesHint")} required>
        <div className="flex flex-wrap gap-2">
          {RECOMMENDED_LANGUAGES.map((lang) => {
            const selected = value.languages.includes(lang);
            return (
              <button
                key={lang}
                type="button"
                onClick={() => toggleLanguage(lang)}
                aria-pressed={selected}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  selected
                    ? "border-brand-500 bg-brand-500 text-primary-foreground"
                    : "border-input bg-white text-foreground hover:border-brand-200 hover:bg-brand-50",
                )}
              >
                {lang}
              </button>
            );
          })}
        </div>
        {value.languages.filter((l) => !RECOMMENDED_LANGUAGES.includes(l)).length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {value.languages
              .filter((l) => !RECOMMENDED_LANGUAGES.includes(l))
              .map((lang) => (
                <span
                  key={lang}
                  className="inline-flex items-center gap-1 rounded-full border border-brand-500 bg-brand-500 px-3 py-1.5 text-sm font-medium text-primary-foreground"
                >
                  {lang}
                  <button
                    type="button"
                    onClick={() => removeLanguage(lang)}
                    aria-label={t("removeLanguage", { lang })}
                    className="rounded-full p-0.5 hover:bg-white/20"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
          </div>
        ) : null}
        <div className="mt-2 flex gap-2">
          <BrandInput
            value={customLanguage}
            onChange={(e) => setCustomLanguage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomLanguage();
              }
            }}
            placeholder={t("addLanguagePlaceholder")}
            aria-label={t("addLanguage")}
          />
          <Button
            type="button"
            variant="outline"
            onClick={addCustomLanguage}
            disabled={!customLanguage.trim()}
            className="h-12 shrink-0 gap-1.5 rounded-lg border-[#e8e8e8] px-4"
          >
            <Plus className="h-4 w-4" />
            {t("addLanguage")}
          </Button>
        </div>
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

"use client";

import { useTranslations } from "next-intl";
import { Heart, Plane, Scale, Shield, ShieldCheck, FileWarning, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandInput, BrandField } from "@/components/client/brand-field";
import { TabChoice } from "@/components/client/simplified-form/tab-choice";
import { cn } from "@/lib/utils";
import type { BackgroundQuestionKey, SimplifiedBackground } from "./types";

type BackgroundCategory = {
  id: string;
  icon: typeof Heart;
  titleKey: string;
  subtitleKey: string;
  questions: BackgroundQuestionKey[];
};

const BACKGROUND_CATEGORIES: BackgroundCategory[] = [
  {
    id: "health",
    icon: Heart,
    titleKey: "categoryHealth",
    subtitleKey: "categoryHealthSubtitle",
    questions: ["has_communicable_disease", "has_physical_mental_disorder", "has_drug_abuse"],
  },
  {
    id: "criminal",
    icon: Shield,
    titleKey: "categoryCriminal",
    subtitleKey: "categoryCriminalSubtitle",
    questions: [
      "has_been_arrested",
      "has_violated_substance_law",
      "has_prostitution_involvement",
      "has_money_laundering",
      "has_human_trafficking",
      "has_supported_trafficking",
      "is_trafficking_relative",
    ],
  },
  {
    id: "security",
    icon: FileWarning,
    titleKey: "categorySecurity",
    subtitleKey: "categorySecuritySubtitle",
    questions: [
      "intends_espionage",
      "intends_terrorism",
      "will_support_terrorists",
      "is_terrorist_organization_member",
      "is_terrorist_relative",
    ],
  },
  {
    id: "political",
    icon: Users,
    titleKey: "categoryPolitical",
    subtitleKey: "categoryPoliticalSubtitle",
    questions: [
      "has_committed_genocide",
      "has_committed_torture",
      "has_committed_extrajudicial_killings",
      "has_used_child_soldiers",
      "violated_religious_freedom",
      "involved_population_control",
      "involved_organ_trafficking",
    ],
  },
  {
    id: "immigration",
    icon: Plane,
    titleKey: "categoryImmigration",
    subtitleKey: "categoryImmigrationSubtitle",
    questions: [
      "obtained_visa_by_fraud",
      "has_been_removed",
      "subject_to_removal_order",
      "failed_removal_hearing",
      "has_overstayed",
    ],
  },
  {
    id: "other",
    icon: Scale,
    titleKey: "categoryOther",
    subtitleKey: "categoryOtherSubtitle",
    questions: [
      "has_been_detained",
      "withheld_child_custody",
      "voted_illegally",
      "renounced_citizenship",
      "practicing_polygamy",
    ],
  },
];

interface StepBackgroundProps {
  value: SimplifiedBackground;
  onChange: (value: SimplifiedBackground) => void;
  onSubmit: () => void;
  submitting?: boolean;
}

export function StepBackground({ value, onChange, onSubmit, submitting }: StepBackgroundProps) {
  const t = useTranslations("simplifiedForm.background");
  const tCommon = useTranslations("simplifiedForm.common");

  const set = <K extends keyof SimplifiedBackground>(key: K, next: SimplifiedBackground[K]) =>
    onChange({ ...value, [key]: next });

  const setNoneApply = (next: boolean) => {
    onChange({
      ...value,
      noneApply: next,
      categories: next ? [] : value.categories,
      answers: next ? {} : value.answers,
      details: next ? {} : value.details,
    });
  };

  const toggleCategory = (category: BackgroundCategory) => {
    const selected = value.categories.includes(category.id);
    const categories = selected
      ? value.categories.filter((id) => id !== category.id)
      : [...value.categories, category.id];
    const answers = { ...value.answers };
    const details = { ...value.details };
    if (selected) {
      category.questions.forEach((question) => {
        delete answers[question];
        delete details[question];
      });
    } else {
      category.questions.forEach((question) => {
        answers[question] = answers[question] || "no";
      });
    }
    onChange({ ...value, categories, answers, details });
  };

  const setAnswer = (question: BackgroundQuestionKey, answer: "yes" | "no") => {
    const details = { ...value.details };
    if (answer === "no") delete details[question];
    onChange({
      ...value,
      answers: {
        ...value.answers,
        [question]: answer,
      },
      details,
    });
  };

  const setDetail = (question: BackgroundQuestionKey, detail: string) => {
    onChange({
      ...value,
      details: {
        ...value.details,
        [question]: detail,
      },
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">{t("subtitle")}</p>
      </header>

      <BrandField label={t("grounds")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setNoneApply(true)}
            aria-pressed={value.noneApply}
            className={cn(
              "flex flex-col items-start gap-3 rounded-xl border p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              value.noneApply
                ? "border-brand-500 bg-brand-500 text-primary-foreground"
                : "border-input bg-white text-foreground hover:border-brand-200 hover:bg-brand-50",
            )}
          >
            <span
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full",
                value.noneApply ? "bg-white/20 text-primary-foreground" : "bg-brand-50 text-brand-500",
              )}
            >
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div className="flex flex-col gap-1">
              <span className="text-[15px] font-semibold">{t("noneApply")}</span>
              <span className={cn("text-xs", value.noneApply ? "text-primary-foreground/80" : "text-muted-foreground")}>
                {t("noneApplyHint")}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setNoneApply(false)}
            aria-pressed={!value.noneApply}
            className={cn(
              "flex flex-col items-start gap-3 rounded-xl border p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              !value.noneApply
                ? "border-brand-500 bg-brand-500 text-primary-foreground"
                : "border-input bg-white text-foreground hover:border-brand-200 hover:bg-brand-50",
            )}
          >
            <span
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full",
                !value.noneApply ? "bg-white/20 text-primary-foreground" : "bg-brand-50 text-brand-500",
              )}
            >
              <FileWarning className="h-5 w-5" />
            </span>
            <div className="flex flex-col gap-1">
              <span className="text-[15px] font-semibold">{t("needAnswer")}</span>
              <span className={cn("text-xs", !value.noneApply ? "text-primary-foreground/80" : "text-muted-foreground")}>
                {t("needAnswerHint")}
              </span>
            </div>
          </button>
        </div>
      </BrandField>

      {!value.noneApply ? (
        <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-white p-5">
          <p className="text-sm font-semibold text-foreground">{t("categoryPrompt")}</p>
          <div className="flex flex-col gap-3">
            {BACKGROUND_CATEGORIES.map((category) => {
              const Icon = category.icon;
              const selected = value.categories.includes(category.id);
              return (
                <div key={category.id}>
                  <button
                    type="button"
                    onClick={() => toggleCategory(category)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-xl border p-4 text-left transition-colors",
                      selected
                        ? "border-amber-400 bg-amber-50 text-amber-700"
                        : "border-border bg-white text-foreground hover:border-brand-200 hover:bg-brand-50",
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <span className={cn("flex h-10 w-10 items-center justify-center rounded-lg", selected ? "bg-amber-100" : "bg-muted")}>
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold">{t(category.titleKey)}</span>
                        <span className="block text-xs text-muted-foreground">{t(category.subtitleKey)}</span>
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
                        selected ? "border-amber-400 bg-amber-500 text-white" : "border-border bg-white",
                      )}
                    >
                      {selected ? <ShieldCheck className="h-4 w-4" /> : null}
                    </span>
                  </button>

                  {selected ? (
                    <div className="ml-5 mt-3 flex flex-col gap-3 border-l-2 border-amber-100 pl-4">
                      {category.questions.map((question) => (
                        <div key={question} className="rounded-xl border border-border/60 bg-white p-3">
                          <p className="mb-3 text-sm text-foreground">{t(`questions.${question}`)}</p>
                          <TabChoice
                            name={`background-${question}`}
                            value={value.answers[question] || "no"}
                            columns={2}
                            onChange={(next) => setAnswer(question, next as "yes" | "no")}
                            ariaLabel={t(`questions.${question}`)}
                            options={[
                              { value: "yes", label: tCommon("yes") },
                              { value: "no", label: tCommon("no") },
                            ]}
                          />
                          {value.answers[question] === "yes" ? (
                            <textarea
                              value={value.details[question] || ""}
                              onChange={(e) => setDetail(question, e.target.value)}
                              placeholder={t("detailPlaceholder")}
                              rows={3}
                              className="mt-3 w-full resize-none rounded-lg border border-[#e8e8e8] px-3 py-2.5 text-[15px] focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            />
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-muted/40 p-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-foreground">{t("embassyTitle")}</p>
          <p className="text-xs text-muted-foreground">{t("embassySubtitle")}</p>
        </div>
        <BrandField label={t("birthCity")} required>
          <BrandInput
            value={value.birthCity}
            onChange={(e) => set("birthCity", e.target.value)}
            placeholder={t("birthCityPlaceholder")}
            required
          />
        </BrandField>
        <BrandField label={t("favoriteFood")} required>
          <BrandInput
            value={value.favoriteFood}
            onChange={(e) => set("favoriteFood", e.target.value)}
            placeholder={t("favoriteFoodPlaceholder")}
            required
          />
        </BrandField>
        <BrandField label={t("childhoodHero")} required>
          <BrandInput
            value={value.childhoodHero}
            onChange={(e) => set("childhoodHero", e.target.value)}
            placeholder={t("childhoodHeroPlaceholder")}
            required
          />
        </BrandField>
      </div>

      <Button
        type="button"
        onClick={onSubmit}
        disabled={submitting}
        className="mt-2 h-12 rounded-lg bg-brand-500 text-[15px] font-medium text-white hover:bg-brand-500/90"
      >
        {submitting ? tCommon("submitting") : t("submit")}
      </Button>
    </div>
  );
}

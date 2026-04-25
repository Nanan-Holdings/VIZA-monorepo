"use client";

import { useTranslations } from "next-intl";
import { ShieldCheck, FileWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandInput, BrandField } from "@/components/client/brand-field";
import { cn } from "@/lib/utils";
import type { SimplifiedBackground } from "./types";

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

  const canSubmit = true;

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
            onClick={() => set("noneApply", true)}
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
            onClick={() => set("noneApply", false)}
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
              <span className="text-[15px] font-semibold">{t("someApply")}</span>
              <span className={cn("text-xs", !value.noneApply ? "text-primary-foreground/80" : "text-muted-foreground")}>
                {t("someApplyHint")}
              </span>
            </div>
          </button>
        </div>
        {!value.noneApply ? (
          <p className="mt-3 text-xs text-muted-foreground">{t("addMoreInFullForm")}</p>
        ) : null}
      </BrandField>

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
        disabled={!canSubmit || submitting}
        className="mt-2 h-12 rounded-lg bg-brand-500 text-[15px] font-medium text-white hover:bg-brand-500/90"
      >
        {submitting ? tCommon("submitting") : t("submit")}
      </Button>
    </div>
  );
}

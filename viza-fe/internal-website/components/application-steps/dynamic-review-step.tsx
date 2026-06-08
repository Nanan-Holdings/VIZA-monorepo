"use client";

import { useCallback, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { type WizardStep } from "@/types/visa-form-fields";
import { evaluateShowIf } from "@/lib/form-utils";
import {
  getChineseLabel,
  getChineseOptionText,
  getEnglishLabel,
  translateLabel,
} from "@/lib/ds160-translations";
import { ValidationPanel } from "./review-step";
import { BilingualReviewPanel, type ReviewRow } from "./bilingual-review-panel";
import { isChineseLocale } from "@/lib/i18n/locale";
import { SubmissionDisclaimerDialog } from "./submission-disclaimer-dialog";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

function formatDateOfficial(value: string): string | null {
  const trimmed = value.trim();
  const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  const chineseMatch = trimmed.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  const match = isoMatch ?? chineseMatch;

  if (!match) return null;

  const [, year, month, day] = match;
  return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
}

function getRawOptionText(
  value: string,
  options?: Array<{ value: string; text: string } | string> | null,
): string | null {
  if (!options || !Array.isArray(options)) return null;

  for (const option of options) {
    if (typeof option === "string") {
      if (option.toLowerCase() === value.toLowerCase()) return option;
      continue;
    }

    if (option.value.toLowerCase() === value.toLowerCase()) {
      return option.text || option.value;
    }
  }

  return null;
}

function isRomanizationSensitive(fieldName: string, label: string): boolean {
  const combined = `${fieldName} ${label}`.toLowerCase();
  return (
    combined.includes("surname")
    || combined.includes("given")
    || combined.includes("full name")
    || combined.includes("city of birth")
    || combined.includes("place of birth")
    || combined.includes("姓名")
    || combined.includes("出生地")
  );
}

function getDynamicStepTranslationCandidates(stepName: string): string[] {
  const trimmed = stepName.trim().replace(/\s+/g, " ");
  const withoutDots = trimmed.replace(/\./g, "");
  const slashTight = withoutDots.replace(/\s*\/\s*/g, "/");
  const slashSpaced = withoutDots.replace(/\s*\/\s*/g, " / ");
  const ampersandAsAnd = withoutDots.replace(/\s*&\s*/g, " and ");
  const andAsAmpersand = withoutDots.replace(/\s+and\s+/gi, " & ");

  return Array.from(new Set([
    trimmed,
    withoutDots,
    slashTight,
    slashSpaced,
    ampersandAsAnd,
    andAsAmpersand,
  ]));
}

export interface DynamicReviewStepProps {
  applicationId: string;
  dynamicAnswers: Record<string, string>;
  dbSteps: WizardStep[];
  photoPath: string | null;
  onEdit: (stepIndex: number) => void;
  onPhotoEdit: () => void;
  onComplete: () => void;
  mode?: "submit" | "continue";
  continueLabel?: string;
}

export function DynamicReviewStep({
  applicationId,
  dynamicAnswers,
  dbSteps,
  photoPath,
  onEdit,
  onPhotoEdit,
  onComplete,
  mode = "submit",
  continueLabel,
}: DynamicReviewStepProps) {
  const t = useTranslations("applicationSteps");
  const tDyn = useTranslations("application.dynamicSteps");
  const locale = useLocale();
  const isZh = isChineseLocale(locale);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const actionLabel = continueLabel ?? t("review.continueToTeam");

  /**
   * Format a field's stored value for display.
   * Looks up option labels for select/radio fields.
   */
  const formatValue = useCallback((
    value: string,
    field?: { fieldType: string; options?: Array<{ value: string; text: string }> | null },
  ): string => {
    if (!value || value === "does_not_apply") return t("dynamicField.doesNotApply");
    if (!field?.options || !Array.isArray(field.options)) return value;

    // Find matching option text
    const option = field.options.find(
      (o) => o.value.toLowerCase() === value.toLowerCase(),
    );
    if (option) {
      return isZh ? getChineseOptionText(option.text) : option.text;
    }
    return value;
  }, [isZh, t]);

  const getOfficialValue = useCallback((
    value: string,
    field: WizardStep["fields"][number],
  ): string => {
    if (field.fieldType === "date") {
      return formatDateOfficial(value) ?? value;
    }

    if (field.fieldType === "select" || field.fieldType === "radio" || field.fieldType === "country") {
      return getRawOptionText(value, field.options as Array<{ value: string; text: string } | string> | null) ?? value;
    }

    return value;
  }, []);

  const bilingualRows = useMemo<ReviewRow[]>(() => {
    const rows: ReviewRow[] = [];

    dbSteps.forEach((step, sourceIndex) => {
      const sectionTitle = (() => {
        const translationKey = getDynamicStepTranslationCandidates(step.stepName)
          .find((key) => tDyn.has(key as never));
        const localized = translationKey ? tDyn(translationKey as never) : step.stepName;
        return translateLabel(localized, isZh ? "zh" : "en");
      })();

      for (const field of step.fields) {
        if (!evaluateShowIf(field, dynamicAnswers, step.fields)) continue;
        if (field.fieldType === "file") continue;

        const answerKeys = [field.fieldName];
        for (let i = 2; i <= 20; i++) {
          const repeatKey = `${field.fieldName}__${i}`;
          if (dynamicAnswers[repeatKey] !== undefined) {
            answerKeys.push(repeatKey);
          } else {
            break;
          }
        }

        for (const answerKey of answerKeys) {
          const value = dynamicAnswers[answerKey];
          if (!value?.trim()) continue;

          const sourceLabel = getChineseLabel(field.label, field.fieldName);
          const officialLabel = getEnglishLabel(field.label);
          const label = `${sourceLabel} / ${officialLabel}`;
          const displayLabel = answerKey === field.fieldName
            ? label
            : `${label} #${answerKey.split("__")[1]}`;
          const sourceValue = formatValue(value, {
            fieldType: field.fieldType,
            options: field.options as Array<{ value: string; text: string }> | null,
          });
          const officialValue = getOfficialValue(value, field);
          const badges: string[] = [];
          const warnings: string[] = [];

          if (field.fieldType === "date") {
            badges.push(t("translation.officialFormatBadge"));
          } else if (field.fieldType === "select" || field.fieldType === "radio" || field.fieldType === "country") {
            badges.push(t("translation.optionLabelBadge"));
          }

          if (field.fieldType === "date") {
            warnings.push(t("translation.dateFormatWarning", { format: "DD/MM/YYYY" }));
          }

          if (isRomanizationSensitive(field.fieldName, field.label)) {
            warnings.push(t("translation.passportSpellingWarning"));
          }

          rows.push({
            section: sectionTitle,
            fieldName: answerKey,
            label: displayLabel,
            sourceLabel: answerKey === field.fieldName
              ? sourceLabel
              : `${sourceLabel} #${answerKey.split("__")[1]}`,
            officialLabel: answerKey === field.fieldName
              ? officialLabel
              : `${officialLabel} #${answerKey.split("__")[1]}`,
            sourceValue,
            officialValue,
            badges,
            warnings,
            editable: true,
            editStepIndex: sourceIndex,
          });
        }
      }
    });

    return rows;
  }, [dbSteps, dynamicAnswers, formatValue, getOfficialValue, isZh, t, tDyn]);

  return (
    <div className="flex flex-col gap-4">
      <BilingualReviewPanel
        applicationId={applicationId}
        rows={bilingualRows}
        onEditSection={onEdit}
      />

      {photoPath ? (
        <section className="rounded-lg border border-border p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-heading text-sm font-semibold text-brand-500">
              上传照片 / Photo
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0 border-[#c9def6] bg-[#eef6ff] px-3 text-sm font-medium text-[#03346E] hover:bg-[#e2f0ff]"
              onClick={onPhotoEdit}
            >
              <Pencil className="mr-1 h-4 w-4" />
              修改
            </Button>
          </div>
          <div className="min-h-12 rounded-lg border border-[#d7e0ee] bg-white px-3 py-3 text-sm font-medium text-[#1f2f46]">
            {photoPath}
          </div>
        </section>
      ) : null}

      {mode === "submit" ? (
        <>
          <ValidationPanel
            applicationId={applicationId}
            onProceed={() => setDisclaimerOpen(true)}
          />
          <SubmissionDisclaimerDialog
            open={disclaimerOpen}
            onCancel={() => setDisclaimerOpen(false)}
            onConfirm={onComplete}
          />
        </>
      ) : (
        <Button onClick={onComplete} size="lg" className="self-stretch">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

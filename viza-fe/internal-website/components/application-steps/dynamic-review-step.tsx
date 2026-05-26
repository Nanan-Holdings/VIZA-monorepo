"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

const BACKEND_URL = process.env.NEXT_PUBLIC_AGENT_BACKEND_URL ?? "http://localhost:8080";

interface TranslationEntry {
  source_text: string;
  translated_text: string;
  user_edited: boolean;
}

type TranslationMap = Record<string, TranslationEntry>;

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

export interface DynamicReviewStepProps {
  applicationId: string;
  dynamicAnswers: Record<string, string>;
  dbSteps: WizardStep[];
  photoPath: string | null;
  onEdit: (stepIndex: number) => void;
  onPhotoEdit: () => void;
  onComplete: () => void;
}

export function DynamicReviewStep({
  applicationId,
  dynamicAnswers,
  dbSteps,
  onComplete,
}: DynamicReviewStepProps) {
  const t = useTranslations("applicationSteps");
  const tDyn = useTranslations("application.dynamicSteps");
  const locale = useLocale();
  const isZh = isChineseLocale(locale);
  const [translations, setTranslations] = useState<TranslationMap>({});
  const [translationLoading, setTranslationLoading] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [retryingTranslation, setRetryingTranslation] = useState(false);

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
    fieldName: string,
    value: string,
    field: WizardStep["fields"][number],
  ): string => {
    const translated = translations[fieldName] ?? translations[field.fieldName];
    if (translated?.translated_text) return translated.translated_text;

    if (field.fieldType === "date") {
      return formatDateOfficial(value) ?? value;
    }

    if (field.fieldType === "select" || field.fieldType === "radio" || field.fieldType === "country") {
      return getRawOptionText(value, field.options as Array<{ value: string; text: string } | string> | null) ?? value;
    }

    return value;
  }, [translations]);

  const fetchTranslations = useCallback(async () => {
    const res = await fetch(`${BACKEND_URL}/api/applications/${applicationId}/translations`);
    if (!res.ok) throw new Error(`Failed to fetch translations (${res.status})`);
    const data = (await res.json()) as TranslationMap;
    setTranslations(data);
  }, [applicationId]);

  const runTranslation = useCallback(async (isRetry = false) => {
    if (isRetry) {
      setRetryingTranslation(true);
    } else {
      setTranslationLoading(true);
    }

    setTranslationError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/applications/${applicationId}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`Translation failed (${res.status})`);
      await fetchTranslations();
    } catch (err) {
      setTranslationError(err instanceof Error ? err.message : t("translation.translationFailed"));
    } finally {
      setTranslationLoading(false);
      setRetryingTranslation(false);
    }
  }, [applicationId, fetchTranslations, t]);

  useEffect(() => {
    if (!isZh) return;
    void runTranslation(false);
  }, [isZh, runTranslation]);

  const bilingualRows = useMemo<ReviewRow[]>(() => {
    const rows: ReviewRow[] = [];

    for (const step of dbSteps) {
      const sectionTitle = (() => {
        const safeKey = step.stepName.replace(/\./g, "");
        const localized = tDyn.has(safeKey) ? tDyn(safeKey as never) : step.stepName;
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
          const officialValue = getOfficialValue(answerKey, value, field);
          const badges: string[] = [];
          const warnings: string[] = [];

          if (translations[answerKey]?.user_edited || translations[field.fieldName]?.user_edited) {
            badges.push(t("translation.userEdited"));
          } else if (translations[answerKey] || translations[field.fieldName]) {
            badges.push(t("translation.aiTranslated"));
          } else if (field.fieldType === "date") {
            badges.push(t("translation.officialFormatBadge"));
          } else if (field.fieldType === "select" || field.fieldType === "radio" || field.fieldType === "country") {
            badges.push(t("translation.optionLabelBadge"));
          } else {
            badges.push(t("translation.aiTranslated"));
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
          });
        }
      }
    }

    return rows;
  }, [dbSteps, dynamicAnswers, formatValue, getOfficialValue, isZh, t, tDyn, translations]);

  return (
    <div className="flex flex-col gap-4">
      <BilingualReviewPanel
        applicationId={applicationId}
        rows={bilingualRows}
        loading={translationLoading}
        error={translationError}
        retrying={retryingTranslation}
        onRetry={() => void runTranslation(true)}
        onUpdated={(fieldName, officialValue) => {
          setTranslations((prev) => ({
            ...prev,
            [fieldName]: {
              source_text: prev[fieldName]?.source_text ?? "",
              translated_text: officialValue,
              user_edited: true,
            },
          }));
        }}
      />

      {/* Validation + Submit */}
      <ValidationPanel
        applicationId={applicationId}
        onProceed={onComplete}
      />
    </div>
  );
}

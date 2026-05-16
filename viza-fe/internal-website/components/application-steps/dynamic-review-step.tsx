"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ImageIcon } from "lucide-react";
import { type VisaFormFieldRow, type WizardStep } from "@/types/visa-form-fields";
import { evaluateShowIf } from "@/lib/form-utils";
import { translateLabel, translateOptionText } from "@/lib/ds160-translations";
import { createClient } from "@/lib/supabase/client";
import { Section } from "./review-shared";
import { ValidationPanel } from "./review-step";
import { BilingualReviewPanel, type ReviewRow } from "./bilingual-review-panel";

const BACKEND_URL = process.env.NEXT_PUBLIC_AGENT_BACKEND_URL ?? "http://localhost:8080";
const HAS_CHINESE = /[\u4E00-\u9FFF\u3400-\u4DBF]/;

interface TranslationEntry {
  source_text: string;
  translated_text: string;
  user_edited: boolean;
}

type TranslationMap = Record<string, TranslationEntry>;

export interface DynamicReviewStepProps {
  applicationId: string;
  dynamicAnswers: Record<string, string>;
  dbSteps: WizardStep[];
  photoPath: string | null;
  onEdit: (stepIndex: number) => void;
  onPhotoEdit: () => void;
  onComplete: () => void;
}

function getRepeatGroup(field: VisaFormFieldRow): string | null {
  const rules = field.validationRules as { repeatable?: boolean; repeat_group?: string } | null;
  return rules?.repeatable && rules.repeat_group ? rules.repeat_group : null;
}

function instanceKey(fieldName: string, instanceIndex: number): string {
  return instanceIndex === 0 ? fieldName : `${fieldName}__${instanceIndex + 1}`;
}

function getValidationFormat(field: VisaFormFieldRow): string | null {
  const rules = field.validationRules as { format?: string } | null;
  return typeof rules?.format === "string" ? rules.format : null;
}

function getOptionText(field: VisaFormFieldRow, value: string): string | null {
  if (!field.options) return null;
  const match = field.options.find((option) => {
    const optionValue = typeof option === "string" ? option : option.value;
    return optionValue.toLowerCase() === value.toLowerCase();
  });
  if (!match) return null;
  return typeof match === "string" ? match : match.text;
}

function formatDateValue(value: string, format: string | null): string {
  if (!format) return value;
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!isoMatch) return value;

  const [, year, month, day] = isoMatch;
  return format
    .replace(/YYYY/g, year)
    .replace(/MM/g, month)
    .replace(/DD/g, day);
}

function isRomanizationSensitive(field: VisaFormFieldRow): boolean {
  const name = field.fieldName.toLowerCase();
  return [
    "surname",
    "given_names",
    "surname_at_birth",
    "full_name_native_alphabet",
    "city_of_birth",
    "place_of_birth",
    "passport_issuance_city",
  ].some((key) => name === key || name.endsWith(`_${key}`));
}

export function DynamicReviewStep({
  applicationId,
  dynamicAnswers,
  dbSteps,
  photoPath,
  onPhotoEdit,
  onComplete,
}: DynamicReviewStepProps) {
  const t = useTranslations("applicationSteps");
  const tDyn = useTranslations("application.dynamicSteps");
  const locale = useLocale();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [translations, setTranslations] = useState<TranslationMap>({});
  const [translationLoading, setTranslationLoading] = useState(true);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [translationRetrying, setTranslationRetrying] = useState(false);

  // Generate signed URL for photo preview
  useEffect(() => {
    if (!photoPath) {
      setPhotoUrl(null);
      return;
    }

    const supabase = createClient();
    supabase.storage
      .from("application-documents")
      .createSignedUrl(photoPath, 3600)
      .then(({ data }) => {
        if (data?.signedUrl) setPhotoUrl(data.signedUrl);
      });
  }, [photoPath]);

  const fetchTranslations = useCallback(async () => {
    const res = await fetch(`${BACKEND_URL}/api/applications/${applicationId}/translations`);
    if (!res.ok) throw new Error(`Failed to fetch translations (${res.status})`);
    const data = (await res.json()) as TranslationMap;
    setTranslations(data);
  }, [applicationId]);

  const runTranslation = useCallback(async () => {
    setTranslationLoading(true);
    setTranslationRetrying(true);
    setTranslationError(null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/applications/${applicationId}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`Translation failed (${res.status})`);
      await fetchTranslations();
    } catch {
      setTranslationError(t("translation.translationFailed"));
      try {
        await fetchTranslations();
      } catch {
        setTranslations({});
      }
    } finally {
      setTranslationLoading(false);
      setTranslationRetrying(false);
    }
  }, [applicationId, fetchTranslations, t]);

  useEffect(() => {
    void runTranslation();
  }, [runTranslation]);

  function formatSourceValue(
    value: string,
    field: VisaFormFieldRow,
  ): string {
    if (!value || value === "does_not_apply") return t("dynamicField.doesNotApply");

    const optionText = getOptionText(field, value);
    if (optionText) return translateOptionText(optionText, locale);

    return value;
  }

  function formatOfficialValue(
    valueKey: string,
    value: string,
    field: VisaFormFieldRow,
  ): string {
    const translated = translations[valueKey]?.translated_text;
    if (translated) return translated;

    if (!value || value === "does_not_apply") return t("dynamicField.doesNotApply");

    const optionText = getOptionText(field, value);
    if (optionText) return optionText;

    if (field.fieldType === "date") return formatDateValue(value, getValidationFormat(field));

    return value;
  }

  const reviewRows = useMemo<ReviewRow[]>(() => {
    const rows: ReviewRow[] = [];

    function addRow(section: string, field: VisaFormFieldRow, valueKey: string, value: string) {
      if (!value.trim()) return;

      const format = getValidationFormat(field);
      const translation = translations[valueKey];
      const optionText = getOptionText(field, value);
      const badges: string[] = [];
      const warnings: string[] = [];

      if (translation) {
        badges.push(translation.user_edited ? t("translation.userEdited") : t("translation.aiTranslated"));
      }
      if (field.fieldType === "date" && format) {
        badges.push(t("translation.officialFormatBadge"));
        warnings.push(t("translation.dateFormatWarning", { format }));
      }
      if (optionText) {
        badges.push(t("translation.optionLabelBadge"));
      }
      if (isRomanizationSensitive(field) && (HAS_CHINESE.test(value) || translation)) {
        warnings.push(t("translation.passportSpellingWarning"));
      }

      rows.push({
        section,
        fieldName: valueKey,
        label: translateLabel(field.label, locale),
        sourceValue: formatSourceValue(value, field),
        officialValue: formatOfficialValue(valueKey, value, field),
        badges,
        warnings,
        editable: Boolean(translation),
      });
    }

    for (const step of dbSteps) {
      const section = (() => {
        const safeKey = step.stepName.replace(/\./g, "");
        return tDyn.has(safeKey) ? tDyn(safeKey as never) : step.stepName;
      })();
      const renderedGroups = new Set<string>();

      for (const field of step.fields) {
        if (!evaluateShowIf(field, dynamicAnswers, step.fields)) continue;

        const group = getRepeatGroup(field);
        if (!group) {
          const value = dynamicAnswers[field.fieldName];
          if (value?.trim()) addRow(section, field, field.fieldName, value);
          continue;
        }

        if (renderedGroups.has(group)) continue;
        renderedGroups.add(group);

        const groupFields = step.fields.filter((groupField) => getRepeatGroup(groupField) === group);
        const instanceIndexes = new Set<number>();
        for (const groupField of groupFields) {
          for (let instance = 0; instance < 20; instance++) {
            const valueKey = instanceKey(groupField.fieldName, instance);
            if (dynamicAnswers[valueKey]?.trim()) instanceIndexes.add(instance);
          }
        }

        for (const instance of Array.from(instanceIndexes).sort((a, b) => a - b)) {
          for (const groupField of groupFields) {
            const valueKey = instanceKey(groupField.fieldName, instance);
            const value = dynamicAnswers[valueKey];
            if (!value?.trim()) continue;
            const instanceLabel = instance === 0 ? section : `${section} #${instance + 1}`;
            addRow(instanceLabel, groupField, valueKey, value);
          }
        }
      }

    }

    return rows;
  }, [dbSteps, dynamicAnswers, locale, t, tDyn, translations]);

  function handleTranslationUpdated(fieldName: string, officialValue: string) {
    setTranslations((prev) => ({
      ...prev,
      [fieldName]: {
        source_text: prev[fieldName]?.source_text ?? dynamicAnswers[fieldName] ?? "",
        translated_text: officialValue,
        user_edited: true,
      },
    }));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Photo section */}
      <Section
        title={t("photoUpload.confirmTitle")}
        onEdit={onPhotoEdit}
        editLabel={t("edit")}
      >
        <div className="flex items-center gap-4 py-2">
          <div className="w-[80px] h-[80px] rounded-lg overflow-hidden border border-[#e8e8e8] bg-gray-50 shrink-0">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt="Applicant photo"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon className="h-6 w-6 text-gray-300" />
              </div>
            )}
          </div>
          <span className="text-sm text-muted-foreground">
            {photoPath ? t("photoUpload.photoProvided") : t("photoUpload.noPhoto")}
          </span>
        </div>
      </Section>

      <BilingualReviewPanel
        applicationId={applicationId}
        rows={reviewRows}
        loading={translationLoading}
        error={translationError}
        retrying={translationRetrying}
        onRetry={() => void runTranslation()}
        onUpdated={handleTranslationUpdated}
      />

      {/* Validation + Submit */}
      <ValidationPanel
        applicationId={applicationId}
        onProceed={onComplete}
      />
    </div>
  );
}

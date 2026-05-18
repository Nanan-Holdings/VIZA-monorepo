"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ImageIcon } from "lucide-react";
import { type WizardStep } from "@/types/visa-form-fields";
import { evaluateShowIf } from "@/lib/form-utils";
import { translateLabel, translateOptionText } from "@/lib/ds160-translations";
import { createClient } from "@/lib/supabase/client";
import { SectionRow, Section } from "./review-shared";
import { ValidationPanel } from "./review-step";
import { BilingualReviewPanel, type ReviewRow } from "./bilingual-review-panel";

const BACKEND_URL = process.env.NEXT_PUBLIC_AGENT_BACKEND_URL ?? "http://localhost:8080";

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

export function DynamicReviewStep({
  applicationId,
  dynamicAnswers,
  dbSteps,
  photoPath,
  onEdit,
  onPhotoEdit,
  onComplete,
}: DynamicReviewStepProps) {
  const t = useTranslations("applicationSteps");
  const tDyn = useTranslations("application.dynamicSteps");
  const locale = useLocale();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [translations, setTranslations] = useState<TranslationMap>({});
  const [translationLoading, setTranslationLoading] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [retryingTranslation, setRetryingTranslation] = useState(false);

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

  /**
   * Format a field's stored value for display.
   * Looks up option labels for select/radio fields.
   */
  function formatValue(
    fieldName: string,
    value: string,
    field?: { fieldType: string; options?: Array<{ value: string; text: string }> | null },
  ): string {
    if (!value || value === "does_not_apply") return t("dynamicField.doesNotApply");
    if (!field?.options || !Array.isArray(field.options)) return value;

    // Find matching option text
    const option = field.options.find(
      (o) => o.value.toLowerCase() === value.toLowerCase(),
    );
    if (option) {
      const translated = translateOptionText(option.text, locale);
      return translated;
    }
    return value;
  }

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

  function getOfficialValue(
    fieldName: string,
    value: string,
    field: WizardStep["fields"][number],
  ): string {
    const translated = translations[fieldName] ?? translations[field.fieldName];
    if (translated?.translated_text) return translated.translated_text;

    if (field.fieldType === "date") {
      return formatDateOfficial(value) ?? value;
    }

    if (field.fieldType === "select" || field.fieldType === "radio" || field.fieldType === "country") {
      return getRawOptionText(value, field.options as Array<{ value: string; text: string } | string> | null) ?? value;
    }

    return value;
  }

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
    void runTranslation(false);
  }, [runTranslation]);

  const bilingualRows = useMemo<ReviewRow[]>(() => {
    const rows: ReviewRow[] = [];

    for (const step of dbSteps) {
      const sectionTitle = (() => {
        const safeKey = step.stepName.replace(/\./g, "");
        return tDyn.has(safeKey) ? tDyn(safeKey as never) : step.stepName;
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

          const label = translateLabel(field.label, locale);
          const displayLabel = answerKey === field.fieldName
            ? label
            : `${label} #${answerKey.split("__")[1]}`;
          const sourceValue = formatValue(field.fieldName, value, {
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
  }, [dbSteps, dynamicAnswers, formatValue, getOfficialValue, locale, t, tDyn, translations]);

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

      {/* Dynamic form sections */}
      {dbSteps.map((step, stepIndex) => {
        // Collect visible fields with answers
        const fieldsWithAnswers = step.fields.filter((field) => {
          // Check if field should be visible based on conditional logic
          if (!evaluateShowIf(field, dynamicAnswers, step.fields)) return false;

          // Check if there's an answer for this field (including repeat instances)
          const baseValue = dynamicAnswers[field.fieldName];
          if (baseValue && baseValue.trim()) return true;

          // Check repeat instances (fieldName__2, fieldName__3, etc.)
          const repeatKeys = Object.keys(dynamicAnswers).filter(
            (k) => k.startsWith(`${field.fieldName}__`) && dynamicAnswers[k]?.trim(),
          );
          return repeatKeys.length > 0;
        });

        // Skip empty sections
        if (fieldsWithAnswers.length === 0) return null;

        // Track which repeat groups we've already rendered
        const renderedGroups = new Set<string>();

        return (
          <Section
            key={step.stepName}
            title={(() => {
              const safeKey = step.stepName.replace(/\./g, "");
              return tDyn.has(safeKey) ? tDyn(safeKey as never) : step.stepName;
            })()}
            onEdit={() => onEdit(stepIndex)}
            editLabel={t("edit")}
          >
            {fieldsWithAnswers.map((field) => {
              const rules = field.validationRules as {
                repeat_group?: string;
              } | null;
              const group = rules?.repeat_group;

              // For repeat groups, render all instances once
              if (group) {
                if (renderedGroups.has(group)) return null;
                renderedGroups.add(group);

                // Find all instances
                const instances: number[] = [0]; // base instance
                for (let i = 2; i <= 20; i++) {
                  const key = `${field.fieldName}__${i}`;
                  if (dynamicAnswers[key] !== undefined) {
                    instances.push(i - 1);
                  } else {
                    break;
                  }
                }

                // Get all fields in this repeat group
                const groupFields = step.fields.filter((f) => {
                  const r = f.validationRules as { repeat_group?: string } | null;
                  return r?.repeat_group === group;
                });

                return instances.map((instanceIdx) => {
                  const suffix = instanceIdx === 0 ? "" : `__${instanceIdx + 1}`;
                  return (
                    <div key={`${group}-${instanceIdx}`}>
                      {instances.length > 1 && (
                        <p className="text-xs text-gray-400 mt-2 mb-1">
                          #{instanceIdx + 1}
                        </p>
                      )}
                      {groupFields.map((gf) => {
                        const valueKey = `${gf.fieldName}${suffix}`;
                        const value = dynamicAnswers[valueKey];
                        if (!value?.trim()) return null;

                        const label = translateLabel(gf.label, locale);
                        const displayValue = formatValue(gf.fieldName, value, {
                          fieldType: gf.fieldType,
                          options: gf.options as Array<{ value: string; text: string }> | null,
                        });

                        return (
                          <SectionRow
                            key={valueKey}
                            label={label}
                            value={displayValue}
                          />
                        );
                      })}
                    </div>
                  );
                });
              }

              // Non-repeating field
              const value = dynamicAnswers[field.fieldName];
              if (!value?.trim()) return null;

              const label = translateLabel(field.label, locale);
              const displayValue = formatValue(field.fieldName, value, {
                fieldType: field.fieldType,
                options: field.options as Array<{ value: string; text: string }> | null,
              });

              return (
                <SectionRow
                  key={field.fieldName}
                  label={label}
                  value={displayValue}
                />
              );
            })}
          </Section>
        );
      })}

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

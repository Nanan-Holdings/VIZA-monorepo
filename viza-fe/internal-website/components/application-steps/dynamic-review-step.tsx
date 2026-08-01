"use client";

import { useCallback, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { type WizardStep } from "@/types/visa-form-fields";
import { evaluateShowIf } from "@/lib/form-utils";
import {
  getChineseLabel,
  getEnglishLabel,
  toChineseSourceValue,
} from "@/lib/ds160-translations";
import {
  resolveLocalizedFieldLabel,
  resolveOptionDisplayLabel,
} from "@/lib/bilingual-schema-contract";
import { ValidationPanel } from "./review-step";
import { BilingualReviewPanel, type ReviewRow } from "./bilingual-review-panel";
import { isChineseLocale } from "@/lib/i18n/locale";
import { SubmissionDisclaimerDialog } from "./submission-disclaimer-dialog";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { getVnPrearrivalStaticOptions } from "@/lib/vn-prearrival/static-options";
import { getVnPrearrivalAdministrativeOptions } from "@/lib/vn-prearrival/administrative-options";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

function formatDateOfficial(value: string): string | null {
  const trimmed = value.trim();
  const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  const chineseMatch = trimmed.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  const match = isoMatch ?? chineseMatch;

  if (!match) return null;

  const [, year, month, day] = match;
  return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
}

export function getReviewSourceLabel(field: WizardStep["fields"][number]): string {
  return resolveLocalizedFieldLabel(field, "zh");
}

export function getReviewOfficialLabel(field: WizardStep["fields"][number]): string {
  return resolveLocalizedFieldLabel(field, "en");
}

export function getLocalizedOptionText(
  value: string,
  options: WizardStep["fields"][number]["options"],
  side: "zh" | "en",
): string | null {
  return resolveOptionDisplayLabel(options, value, side);
}

export function getReviewOptionText(
  dynamicAnswers: Record<string, string>,
  value: string,
  field: WizardStep["fields"][number],
  side: "zh" | "en",
): string | null {
  const schemaLabel = getLocalizedOptionText(value, field.options, side);
  if (schemaLabel) return schemaLabel;

  const configuredSource = field.validationRules?.official_source;
  const inferredSource = field.fieldName === "province_city_of_hotel"
    ? "prearrival_category:administrative_unit_level1"
    : field.fieldName === "ward_commune_of_hotel"
      ? "prearrival_category:administrative_unit_level2"
      : null;
  const officialSource = typeof configuredSource === "string"
    ? configuredSource
    : inferredSource;
  if (!officialSource?.startsWith("prearrival_category:")) {
    return null;
  }

  const configuredDependency = field.validationRules?.depends_on;
  const dependency = typeof configuredDependency === "string"
    ? configuredDependency
    : field.fieldName === "ward_commune_of_hotel"
      ? "province_city_of_hotel"
      : null;
  const parentValue = typeof dependency === "string"
    ? dynamicAnswers[dependency] ?? ""
    : "";
  const normalizedSource = officialSource.replace(/^prearrival_category:/, "");
  const officialOptions = normalizedSource === "administrative_unit_level1"
    ? getVnPrearrivalAdministrativeOptions("level1")
    : normalizedSource === "administrative_unit_level2"
      ? getVnPrearrivalAdministrativeOptions("level2", parentValue)
      : getVnPrearrivalStaticOptions(officialSource, parentValue);
  return getLocalizedOptionText(value, officialOptions, side);
}

function isTextLikeReviewField(field: WizardStep["fields"][number]): boolean {
  return field.fieldType === "text" || field.fieldType === "textarea";
}

export function getBilingualReviewValue(
  dynamicAnswers: Record<string, string>,
  answerKey: string,
  value: string,
  field: WizardStep["fields"][number],
  side: "zh" | "en",
): string {
  if (!isTextLikeReviewField(field)) return value;

  const explicit = dynamicAnswers[`${answerKey}_${side}`]?.trim();
  if (explicit) return explicit;

  if (side === "zh") return toChineseSourceValue(value);
  return value;
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

export function getLocalizedReviewSectionTitle(
  title: string,
  side: "zh" | "en",
): string {
  const normalized = title.trim().replace(/\s+/g, " ");
  const parts = normalized.split(/\s*\/\s*/).filter(Boolean);
  const containsChinese = (value: string) => /[\u3400-\u9fff]/.test(value);

  if (parts.some(containsChinese)) {
    const localizedPart = side === "zh"
      ? parts.find(containsChinese)
      : parts.find((part) => !containsChinese(part));
    if (localizedPart) return localizedPart;
  }

  return side === "zh" ? getChineseLabel(normalized) : getEnglishLabel(normalized);
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
  showAction?: boolean;
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
  showAction = true,
}: DynamicReviewStepProps) {
  const t = useTranslations("applicationSteps");
  const tDyn = useTranslations("application.dynamicSteps");
  const locale = useLocale();
  const isZh = isChineseLocale(locale);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const actionLabel = continueLabel ?? t("review.continueToTeam");
  const validationFieldLabels = useMemo(() => {
    const labels: Record<string, { zh: string; en: string }> = {};
    for (const step of dbSteps) {
      for (const field of step.fields) {
        labels[field.fieldName] = {
          zh: getReviewSourceLabel(field),
          en: getReviewOfficialLabel(field),
        };
      }
    }
    return labels;
  }, [dbSteps]);

  /**
   * Format a field's stored value for display.
   * Looks up option labels for select/radio fields.
   */
  const formatValue = useCallback((
    value: string,
    field?: WizardStep["fields"][number],
    side: "zh" | "en" = "zh",
  ): string => {
    if (!value || value === "does_not_apply") return t("dynamicField.doesNotApply");
    if (!field) return value;

    return getReviewOptionText(dynamicAnswers, value, field, side) ?? value;
  }, [dynamicAnswers, t]);

  const getOfficialValue = useCallback((
    value: string,
    field: WizardStep["fields"][number],
  ): string => {
    if (field.fieldType === "date") {
      return formatDateOfficial(value) ?? value;
    }

    if (field.fieldType === "select" || field.fieldType === "radio" || field.fieldType === "country") {
      return getReviewOptionText(dynamicAnswers, value, field, "en") ?? value;
    }

    return value;
  }, [dynamicAnswers]);

  const bilingualRows = useMemo<ReviewRow[]>(() => {
    const completedRows: ReviewRow[] = [];
    const missingRows: ReviewRow[] = [];

    dbSteps.forEach((step, sourceIndex) => {
      const sectionTitle = (() => {
        const translationKey = getDynamicStepTranslationCandidates(step.stepName)
          .find((key) => tDyn.has(key as never));
        const localized = translationKey ? tDyn(translationKey as never) : step.stepName;
        return getLocalizedReviewSectionTitle(localized, isZh ? "zh" : "en");
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
          const value = dynamicAnswers[answerKey] ?? "";
          const isMissing = !value.trim();

          const sourceLabel = getReviewSourceLabel(field);
          const officialLabel = getReviewOfficialLabel(field);
          const label = `${sourceLabel} / ${officialLabel}`;
          const displayLabel = answerKey === field.fieldName
            ? label
            : `${label} #${answerKey.split("__")[1]}`;
          const sourceValue = isMissing
            ? t("review.notProvided")
            : formatValue(
                getBilingualReviewValue(dynamicAnswers, answerKey, value, field, "zh"),
                field,
                "zh",
              );
          const officialValue = isMissing
            ? "Not provided"
            : getOfficialValue(
                getBilingualReviewValue(dynamicAnswers, answerKey, value, field, "en"),
                field,
              );
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

          const row: ReviewRow = {
            section: isMissing
              ? `${sectionTitle} · ${t("review.missingInformation")}`
              : sectionTitle,
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
            missing: isMissing,
          };

          if (isMissing) missingRows.push(row);
          else completedRows.push(row);
        }
      }
    });

    return [...completedRows, ...missingRows];
  }, [dbSteps, dynamicAnswers, formatValue, getOfficialValue, isZh, t, tDyn]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-0">
        <BilingualReviewPanel
          applicationId={applicationId}
          rows={bilingualRows}
          onEditSection={onEdit}
        />

        {photoPath ? (
          <section>
            <div className="flex min-h-8 items-center justify-between gap-3">
              <h3 className="font-heading text-sm font-semibold text-brand-500">
                {isZh ? "上传照片" : "Photo"}
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 justify-end p-0 text-brand-500 hover:bg-brand-50 hover:text-brand-600"
                onClick={onPhotoEdit}
                aria-label={isZh ? "修改上传照片" : "Edit uploaded photo"}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
            <Table className="table-fixed">
              <TableBody>
                <TableRow className="hover:bg-transparent">
                  <th
                    scope="row"
                    className="w-[56%] px-0 py-2 text-left align-top text-sm font-medium text-muted-foreground"
                  >
                    {isZh ? "已上传照片 / Uploaded photo" : "Uploaded photo"}
                  </th>
                  <TableCell className="px-0 py-2 text-right align-top text-sm font-medium text-foreground">
                    <span className="whitespace-pre-wrap break-words">{photoPath}</span>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </section>
        ) : null}
      </div>

      {showAction && mode === "submit" ? (
        <>
          <ValidationPanel
            applicationId={applicationId}
            onProceed={() => setDisclaimerOpen(true)}
            fieldLabels={validationFieldLabels}
          />
          <SubmissionDisclaimerDialog
            open={disclaimerOpen}
            onCancel={() => setDisclaimerOpen(false)}
            onConfirm={onComplete}
          />
        </>
      ) : showAction ? (
        <Button onClick={onComplete} size="lg" className="self-stretch">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

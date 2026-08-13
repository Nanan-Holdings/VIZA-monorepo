"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { BrandActionButton } from "@/components/client/brand-action-button";
import { Button } from "@/components/ui/button";
import { CheckCircle as CheckCircle2, WarningCircle as AlertCircle, Warning as AlertTriangle, Pencil } from "@phosphor-icons/react";
import type { PersonalInfoData } from "./personal-info-step";
import type { PassportData } from "./passport-step";
import type { TravelInfoData } from "./travel-info-step";
import { SubmissionDisclaimerDialog } from "./submission-disclaimer-dialog";
import { isChineseLocale } from "@/lib/i18n/locale";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

interface ReviewStepProps {
  applicationId: string;
  data?: {
    personal?: Partial<PersonalInfoData>;
    passport?: Partial<PassportData>;
    travel?: Partial<TravelInfoData>;
  };
  onEdit?: (section: "personal" | "passport" | "travel" | "documents") => void;
  onComplete: (result: { confirmed: true }) => void;
  mode?: "submit" | "continue";
  continueLabel?: string;
  showAction?: boolean;
}

interface ReviewRow {
  label: string;
  value?: string;
}

const EMPTY_VALUE = "未填写 / Not provided";

const SEX_LABELS: Record<string, string> = {
  M: "男 / Male",
  F: "女 / Female",
};

const MARITAL_STATUS_LABELS: Record<string, string> = {
  SINGLE: "未婚 / Single",
  MARRIED: "已婚 / Married",
  DIVORCED: "离异 / Divorced",
  WIDOWED: "丧偶 / Widowed",
  SEPARATED: "分居 / Separated",
  OTHER: "其他 / Other",
};

const PASSPORT_TYPE_LABELS: Record<string, string> = {
  REGULAR: "普通护照 / Regular",
  OFFICIAL: "公务护照 / Official",
  DIPLOMATIC: "外交护照 / Diplomatic",
  OTHER: "其他 / Other",
};

const PURPOSE_LABELS: Record<string, string> = {
  "B1/B2": "旅游 / 商务 / Tourism / Business (B1/B2)",
  B1: "商务 / Business (B1)",
  F1: "学生 / Student (F1)",
  J1: "交流访问 / Exchange visitor (J1)",
  OTHER: "其他 / Other",
};

function displayValue(value?: string) {
  return value?.trim() ? value : EMPTY_VALUE;
}

function displayMappedValue(value: string | undefined, map: Record<string, string>) {
  if (!value?.trim()) return EMPTY_VALUE;
  return map[value] ?? value;
}

function displayDate(value?: string) {
  if (!value?.trim()) return EMPTY_VALUE;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${year}年${Number(month)}月${Number(day)}日 / ${day}/${month}/${year}`;
}

function ReviewSummarySection({
  title,
  rows,
  onEdit,
}: {
  title: string;
  rows: ReviewRow[];
  onEdit?: () => void;
}) {
  return (
    <section>
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h3 className="font-heading text-sm font-semibold text-brand-500">{title}</h3>
        {onEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onEdit}
            className="h-8 w-8 shrink-0 justify-end p-0 text-brand-500 hover:bg-brand-50 hover:text-brand-600"
            aria-label={`修改${title} / Edit ${title}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      <Table className="table-fixed">
        <TableBody>
          {rows.map((row) => {
            const value = displayValue(row.value);
            const isEmpty = value === EMPTY_VALUE;

            return (
              <TableRow key={row.label} className="hover:bg-transparent">
                <th
                  scope="row"
                  className="w-[56%] px-0 py-2 text-left align-top text-sm font-medium text-muted-foreground"
                >
                  {row.label}
                </th>
                <TableCell
                  className={isEmpty
                    ? "px-0 py-2 text-right align-top text-sm font-medium text-red-600"
                    : "px-0 py-2 text-right align-top text-sm font-medium text-foreground"}
                >
                  <span className="whitespace-pre-wrap break-words">{value}</span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </section>
  );
}


// ---------------------------------------------------------------------------
// Validation Panel — calls AI validation endpoint before submission
// ---------------------------------------------------------------------------

interface FieldError { field: string; message: string; }
interface ValidationResult {
  valid: boolean;
  errors: FieldError[];
  warnings: FieldError[];
  blocked: boolean;
}

interface ValidationPanelProps {
  applicationId: string;
  onProceed: () => void;
  fieldLabels?: Record<string, { zh: string; en: string }>;
}

function displayValidationField(
  field: string,
  fieldLabels: ValidationPanelProps["fieldLabels"],
  side: "zh" | "en",
): string {
  const baseField = field.replace(/__\d+$/, "");
  return fieldLabels?.[field]?.[side] ?? fieldLabels?.[baseField]?.[side] ?? field;
}

export function ValidationPanel({ applicationId, onProceed, fieldLabels }: ValidationPanelProps) {
  const t = useTranslations("applicationSteps");
  const locale = useLocale();
  const side = isChineseLocale(locale) ? "zh" : "en";
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runValidation() {
    if (!applicationId) { onProceed(); return; }
    setState("loading");
    setError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_AGENT_BACKEND_URL ?? "http://localhost:8080"}/api/validate-application`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId }),
      });
      if (!res.ok) throw new Error(`Validation service returned ${res.status}`);
      const data: ValidationResult = await res.json();
      setResult(data);
      setState("done");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("review.validation.failed");
      setError(msg);
      setState("idle");
    }
  }

  const hasErrors = (result?.errors?.length ?? 0) > 0;
  const hasWarnings = (result?.warnings?.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Errors */}
      {state === "done" && hasErrors && (
        <div className="rounded-lg border border-[#e5e7eb] bg-white p-3">
          <div className="flex items-center gap-2 mb-2 text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p className="text-sm font-semibold">{t("review.validation.hasErrors")} / Application has errors</p>
          </div>
          <ul className="flex flex-col gap-1">
            {result!.errors.map((e, i) => (
              <li key={i} className="text-xs text-red-600">• <span className="font-medium">{displayValidationField(e.field, fieldLabels, side)}:</span> {e.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {state === "done" && hasWarnings && (
        <div className="rounded-lg border border-[#e5e7eb] bg-white p-3">
          <div className="flex items-center gap-2 mb-2 text-amber-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <p className="text-sm font-semibold">{t("review.validation.hasWarnings")} / Warnings</p>
          </div>
          <ul className="flex flex-col gap-1">
            {result!.warnings.map((w, i) => (
              <li key={i} className="text-xs text-amber-700">• <span className="font-medium">{displayValidationField(w.field, fieldLabels, side)}:</span> {w.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* All good */}
      {state === "done" && !hasErrors && (
        <div className="flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white p-3 text-[#166534]">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <p className="text-sm">{t("review.validation.allGood")} / Ready to submit</p>
        </div>
      )}

      {/* Validation error */}
      {error && (
        <p className="text-xs text-red-500">{t("review.validation.errorFallback", { error })}</p>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2">
        {state !== "done" && (
          <BrandActionButton
            variant="secondary"
            onClick={runValidation}
            loading={state === "loading"}
            loadingText={t("review.validation.validating")}
          >
            {t("review.validation.validateButton")} / Validate Application
          </BrandActionButton>
        )}

        <BrandActionButton
          disabled={state === "done" && hasErrors}
          onClick={onProceed}
        >
          {state === "done" && hasWarnings && !hasErrors
            ? `${t("review.validation.submitWithWarnings")} / Submit with warnings`
            : `${t("review.confirmAndSubmit")} / Confirm & Submit`}
        </BrandActionButton>
      </div>
    </div>
  );
}

export function ReviewStep({
  applicationId: _applicationId,
  data,
  onEdit,
  onComplete,
  mode = "submit",
  continueLabel,
  showAction = true,
}: ReviewStepProps) {
  const t = useTranslations("applicationSteps");
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const actionLabel = continueLabel ?? t("review.continueToTeam");
  const personalRows: ReviewRow[] = [
    { label: "姓 / Surname", value: data?.personal?.surname },
    { label: "名 / Given name(s)", value: data?.personal?.givenNames },
    { label: "中文姓名 / Full name in native alphabet", value: data?.personal?.fullNameNativeAlphabet },
    { label: "出生日期 / Date of birth", value: displayDate(data?.personal?.dateOfBirth) },
    { label: "性别 / Sex", value: displayMappedValue(data?.personal?.sex, SEX_LABELS) },
    { label: "婚姻状况 / Marital status", value: displayMappedValue(data?.personal?.maritalStatus, MARITAL_STATUS_LABELS) },
    { label: "国籍 / Nationality", value: data?.personal?.nationality },
    { label: "出生国家 / Country of birth", value: data?.personal?.countryOfBirth },
    { label: "出生省 / 州 / State or province of birth", value: data?.personal?.stateOfBirth },
    { label: "出生城市 / City of birth", value: data?.personal?.cityOfBirth },
  ];
  const passportRows: ReviewRow[] = [
    { label: "护照类型 / Passport type", value: displayMappedValue(data?.passport?.passportDocumentType, PASSPORT_TYPE_LABELS) },
    { label: "护照号码 / Passport number", value: data?.passport?.passportNumber },
    { label: "护照本号 / Passport book number", value: data?.passport?.passportBookNumber },
    { label: "签发国家 / Issuing country", value: data?.passport?.passportIssuingCountry },
    { label: "签发城市 / Issuance city", value: data?.passport?.passportIssuanceCity },
    { label: "签发日期 / Issue date", value: displayDate(data?.passport?.passportIssuanceDate) },
    { label: "到期日期 / Expiry date", value: displayDate(data?.passport?.passportExpirationDate) },
  ];
  const travelRows: ReviewRow[] = [
    { label: "访问目的 / Purpose", value: displayMappedValue(data?.travel?.purposeOfTrip, PURPOSE_LABELS) },
    { label: "到达日期 / Arrival date", value: displayDate(data?.travel?.arrivalDate) },
    { label: "离开日期 / Departure date", value: displayDate(data?.travel?.departureDate) },
    { label: "到达城市 / 口岸 / Arrival city or port", value: data?.travel?.arrivalCity },
    { label: "住宿名称 / Accommodation name", value: data?.travel?.accommodationName },
    { label: "住宿街道地址 / Street address", value: data?.travel?.usAddressStreet1 },
    { label: "住宿城市 / Accommodation city", value: data?.travel?.usAddressCity },
    { label: "州 / State", value: data?.travel?.usAddressState },
    { label: "邮编 / ZIP code", value: data?.travel?.usAddressZip },
  ];
  const splitRows = (rows: ReviewRow[]) => ({
    completed: rows.filter((row) => displayValue(row.value) !== EMPTY_VALUE),
    missing: rows.filter((row) => displayValue(row.value) === EMPTY_VALUE),
  });
  const personal = splitRows(personalRows);
  const passport = splitRows(passportRows);
  const travel = splitRows(travelRows);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-0">
        {personal.completed.length > 0 ? (
          <ReviewSummarySection
            title={t("review.personalInformation")}
            rows={personal.completed}
            onEdit={onEdit ? () => onEdit("personal") : undefined}
          />
        ) : null}
        {passport.completed.length > 0 ? (
          <ReviewSummarySection
            title={t("review.passportDetails")}
            rows={passport.completed}
            onEdit={onEdit ? () => onEdit("passport") : undefined}
          />
        ) : null}
        {travel.completed.length > 0 ? (
          <ReviewSummarySection
            title={t("review.travelInformation")}
            rows={travel.completed}
            onEdit={onEdit ? () => onEdit("travel") : undefined}
          />
        ) : null}
        {personal.missing.length > 0 ? (
          <ReviewSummarySection
            title={`${t("review.personalInformation")} · ${t("review.missingInformation")}`}
            rows={personal.missing}
            onEdit={onEdit ? () => onEdit("personal") : undefined}
          />
        ) : null}
        {passport.missing.length > 0 ? (
          <ReviewSummarySection
            title={`${t("review.passportDetails")} · ${t("review.missingInformation")}`}
            rows={passport.missing}
            onEdit={onEdit ? () => onEdit("passport") : undefined}
          />
        ) : null}
        {travel.missing.length > 0 ? (
          <ReviewSummarySection
            title={`${t("review.travelInformation")} · ${t("review.missingInformation")}`}
            rows={travel.missing}
            onEdit={onEdit ? () => onEdit("travel") : undefined}
          />
        ) : null}
      </div>

      {showAction && mode === "submit" ? (
        <>
          <ValidationPanel applicationId={_applicationId} onProceed={() => setDisclaimerOpen(true)} />
          <SubmissionDisclaimerDialog
            open={disclaimerOpen}
            onCancel={() => setDisclaimerOpen(false)}
            onConfirm={() => onComplete({ confirmed: true })}
          />
        </>
      ) : showAction ? (
        <BrandActionButton onClick={() => onComplete({ confirmed: true })}>
          {actionLabel}
        </BrandActionButton>
      ) : null}
    </div>
  );
}

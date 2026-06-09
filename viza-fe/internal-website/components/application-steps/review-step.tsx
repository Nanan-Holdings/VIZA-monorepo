"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandActionButton } from "@/components/client/brand-action-button";
import { CheckCircle2, AlertCircle, AlertTriangle, Pencil } from "lucide-react";
import type { PersonalInfoData } from "./personal-info-step";
import type { PassportData } from "./passport-step";
import type { TravelInfoData } from "./travel-info-step";
import { SubmissionDisclaimerDialog } from "./submission-disclaimer-dialog";
import { isChineseLocale } from "@/lib/i18n/locale";

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
    <section className="rounded-lg border border-[#e5e7eb] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-heading text-[15px] font-semibold text-[#03346E]">{title}</h3>
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-md border border-[#c9def6] bg-[#eef6ff] px-3 text-sm font-medium text-[#03346E] hover:bg-[#e2f0ff]"
          >
            <Pencil className="h-4 w-4" />
            修改
          </button>
        ) : null}
      </div>
      <div className="mt-3 divide-y divide-[#eef1f5]">
        {rows.map((row) => {
          const value = displayValue(row.value);
          const isEmpty = value === EMPTY_VALUE;

          return (
            <div
              key={row.label}
              className="grid gap-1 py-2.5 text-sm sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-4"
            >
              <span className="text-[#697386]">{row.label}</span>
              <span className={isEmpty ? "text-gray-400" : "font-medium text-[#24272f]"}>
                {value}
              </span>
            </div>
          );
        })}
      </div>
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
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
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
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
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
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700">
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">{t("review.title")} / Review Your Application</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ReviewSummarySection
          title={`${t("review.personalInformation")} / Personal Information`}
          rows={personalRows}
          onEdit={onEdit ? () => onEdit("personal") : undefined}
        />
        <ReviewSummarySection
          title={`${t("review.passportDetails")} / Passport Details`}
          rows={passportRows}
          onEdit={onEdit ? () => onEdit("passport") : undefined}
        />
        <ReviewSummarySection
          title={`${t("review.travelInformation")} / Travel Information`}
          rows={travelRows}
          onEdit={onEdit ? () => onEdit("travel") : undefined}
        />

        {mode === "submit" ? (
          <>
            <ValidationPanel applicationId={_applicationId} onProceed={() => setDisclaimerOpen(true)} />
            <SubmissionDisclaimerDialog
              open={disclaimerOpen}
              onCancel={() => setDisclaimerOpen(false)}
              onConfirm={() => onComplete({ confirmed: true })}
            />
          </>
        ) : (
          <BrandActionButton onClick={() => onComplete({ confirmed: true })}>
            {actionLabel}
          </BrandActionButton>
        )}
      </CardContent>
    </Card>
  );
}

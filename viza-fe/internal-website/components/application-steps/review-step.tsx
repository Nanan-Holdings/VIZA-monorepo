"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandActionButton } from "@/components/client/brand-action-button";
import { CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react";
import type { PersonalInfoData } from "./personal-info-step";
import type { PassportData } from "./passport-step";
import type { TravelInfoData } from "./travel-info-step";
import { SectionRow, Section } from "./review-shared";

interface ReviewStepProps {
  applicationId: string;
  data?: {
    personal?: Partial<PersonalInfoData>;
    passport?: Partial<PassportData>;
    travel?: Partial<TravelInfoData>;
  };
  onEdit?: (section: "personal" | "passport" | "travel" | "documents") => void;
  onComplete: (result: { confirmed: true }) => void;
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

export function ValidationPanel({ applicationId, onProceed }: { applicationId: string; onProceed: () => void }) {
  const t = useTranslations("applicationSteps");
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
              <li key={i} className="text-xs text-red-600">• <span className="font-medium">{e.field}:</span> {e.message}</li>
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
              <li key={i} className="text-xs text-amber-700">• <span className="font-medium">{w.field}:</span> {w.message}</li>
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

export function ReviewStep({ applicationId: _applicationId, data, onEdit, onComplete }: ReviewStepProps) {
  const t = useTranslations("applicationSteps");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">{t("review.title")} / Review Your Application</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {data?.personal && (
          <Section title={`${t("review.personalInformation")} / Personal Information`} onEdit={() => onEdit?.("personal")} editLabel={`${t("edit")} / Edit`}>
            <SectionRow label="姓 / Surname" value={data.personal.surname} />
            <SectionRow label="名 / Given name(s)" value={data.personal.givenNames} />
            <SectionRow label="出生日期 / Date of birth" value={data.personal.dateOfBirth} />
            <SectionRow label="性别 / Sex" value={data.personal.sex} />
            <SectionRow label="婚姻状况 / Marital status" value={data.personal.maritalStatus} />
            <SectionRow label="国籍 / Nationality" value={data.personal.nationality} />
            <SectionRow label="出生城市 / City of birth" value={data.personal.cityOfBirth} />
            <SectionRow label="出生国家 / Country of birth" value={data.personal.countryOfBirth} />
          </Section>
        )}

        {data?.passport && (
          <Section title={`${t("review.passportDetails")} / Passport Details`} onEdit={() => onEdit?.("passport")} editLabel={`${t("edit")} / Edit`}>
            <SectionRow label="护照类型 / Passport type" value={data.passport.passportDocumentType} />
            <SectionRow label={`${t("review.passportNumber")} / Passport number`} value={data.passport.passportNumber} />
            <SectionRow label={`${t("review.issuingCountry")} / Issuing country`} value={data.passport.passportIssuingCountry} />
            <SectionRow label="签发城市 / Issuance city" value={data.passport.passportIssuanceCity} />
            <SectionRow label="签发日期 / Issue date" value={data.passport.passportIssuanceDate} />
            <SectionRow label={`${t("review.expiryDate")} / Expiry date`} value={data.passport.passportExpirationDate} />
          </Section>
        )}

        {data?.travel && (
          <Section title={`${t("review.travelInformation")} / Travel Information`} onEdit={() => onEdit?.("travel")} editLabel={`${t("edit")} / Edit`}>
            <SectionRow label={`${t("review.purpose")} / Purpose`} value={data.travel.purposeOfTrip} />
            <SectionRow label={`${t("review.arrivalDate")} / Arrival date`} value={data.travel.arrivalDate} />
            <SectionRow label={`${t("review.departureDate")} / Departure date`} value={data.travel.departureDate} />
            <SectionRow label="到达城市 / Arrival city or port" value={data.travel.arrivalCity} />
            <SectionRow label={`${t("review.accommodation")} / Accommodation`} value={data.travel.accommodationName} />
            <SectionRow label="住宿地址 / Accommodation address" value={[data.travel.usAddressStreet1, data.travel.usAddressCity, data.travel.usAddressState, data.travel.usAddressZip].filter(Boolean).join(", ")} />
          </Section>
        )}

        <ValidationPanel applicationId={_applicationId} onProceed={() => onComplete({ confirmed: true })} />
      </CardContent>
    </Card>
  );
}

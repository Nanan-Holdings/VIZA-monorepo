"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pencil, CheckCircle2, AlertCircle, AlertTriangle, Loader2 } from "lucide-react";
import type { PersonalInfoData } from "./personal-info-step";
import type { PassportData } from "./passport-step";
import type { TravelInfoData } from "./travel-info-step";

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

function SectionRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}

function Section({
  title,
  children,
  onEdit,
  editLabel,
}: {
  title: string;
  children: React.ReactNode;
  onEdit?: () => void;
  editLabel?: string;
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-heading font-semibold text-sm text-brand-500">{title}</h3>
        {onEdit && (
          <Button type="button" variant="ghost" size="sm" onClick={onEdit} className="h-7 px-2 text-xs">
            <Pencil className="h-3 w-3 mr-1" /> {editLabel}
          </Button>
        )}
      </div>
      <div>{children}</div>
    </div>
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

function ValidationPanel({ applicationId, onProceed }: { applicationId: string; onProceed: () => void }) {
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
            <p className="text-sm font-semibold">{t("review.validation.hasErrors")}</p>
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
            <p className="text-sm font-semibold">{t("review.validation.hasWarnings")}</p>
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
          <p className="text-sm">{t("review.validation.allGood")}</p>
        </div>
      )}

      {/* Validation error */}
      {error && (
        <p className="text-xs text-red-500">{t("review.validation.errorFallback", { error })}</p>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2">
        {state !== "done" && (
          <Button
            type="button"
            variant="outline"
            className="border-[#03346E] text-[#03346E] hover:bg-[#03346E]/5"
            onClick={runValidation}
            disabled={state === "loading"}
          >
            {state === "loading" ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t("review.validation.validating")}</>
            ) : t("review.validation.validateButton")}
          </Button>
        )}

        <Button
          className="bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-50"
          disabled={state === "done" && hasErrors}
          onClick={onProceed}
        >
          {state === "done" && hasWarnings && !hasErrors ? t("review.validation.submitWithWarnings") : t("review.confirmAndSubmit")}
        </Button>
      </div>
    </div>
  );
}

export function ReviewStep({ applicationId: _applicationId, data, onEdit, onComplete }: ReviewStepProps) {
  const t = useTranslations("applicationSteps");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">{t("review.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {data?.personal && (
          <Section title={t("review.personalInformation")} onEdit={() => onEdit?.("personal")} editLabel={t("edit")}>
            <SectionRow label={t("review.fullName")} value={data.personal.fullName} />
            <SectionRow label={t("review.dateOfBirth")} value={data.personal.dateOfBirth} />
            <SectionRow label={t("review.placeOfBirth")} value={data.personal.placeOfBirth} />
            <SectionRow label={t("review.gender")} value={data.personal.gender} />
            <SectionRow label={t("review.nationality")} value={data.personal.nationality} />
            <SectionRow label={t("review.occupation")} value={data.personal.occupation} />
            <SectionRow label={t("review.address")} value={data.personal.address} />
          </Section>
        )}

        {data?.passport && (
          <Section title={t("review.passportDetails")} onEdit={() => onEdit?.("passport")} editLabel={t("edit")}>
            <SectionRow label={t("review.passportNumber")} value={data.passport.passportNumber} />
            <SectionRow label={t("review.issueDate")} value={data.passport.issueDate} />
            <SectionRow label={t("review.expiryDate")} value={data.passport.expiryDate} />
            <SectionRow label={t("review.issuingCountry")} value={data.passport.issuingCountry} />
            <SectionRow label={t("review.issuingAuthority")} value={data.passport.issuingAuthority} />
          </Section>
        )}

        {data?.travel && (
          <Section title={t("review.travelInformation")} onEdit={() => onEdit?.("travel")} editLabel={t("edit")}>
            <SectionRow label={t("review.arrivalDate")} value={data.travel.arrivalDate} />
            <SectionRow label={t("review.departureDate")} value={data.travel.departureDate} />
            <SectionRow label={t("review.portOfEntry")} value={data.travel.portOfEntry} />
            <SectionRow label={t("review.purpose")} value={data.travel.purpose} />
            <SectionRow label={t("review.accommodation")} value={data.travel.accommodationName} />
          </Section>
        )}

        <ValidationPanel applicationId={_applicationId} onProceed={() => onComplete({ confirmed: true })} />
      </CardContent>
    </Card>
  );
}

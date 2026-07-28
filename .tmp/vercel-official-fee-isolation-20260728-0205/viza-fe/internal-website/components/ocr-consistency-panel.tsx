"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runOcrConsistencyCheck, type ConsistencyResult } from "@/app/actions/ocr-consistency";
import { saveDynamicAnswers } from "@/app/actions/visa-application-answers";

interface OcrConsistencyPanelProps {
  applicationId: string;
  /** Map between question_field.field_name and the OCR-typed key. */
  initialResult?: ConsistencyResult | null;
  onApply?: (fieldName: string, value: string) => void;
}

const FIELD_LABELS: Record<string, string> = {
  surname: "Surname",
  given_names: "Given names",
  date_of_birth: "Date of birth",
  passport_number: "Passport number",
  passport_expiry_date: "Passport expiry",
};

export function OcrConsistencyPanel({ applicationId, initialResult = null, onApply }: OcrConsistencyPanelProps) {
  const [result, setResult] = useState<ConsistencyResult | null>(initialResult);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [applyingField, setApplyingField] = useState<string | null>(null);

  const runCheck = (): void => {
    setError(null);
    startTransition(async () => {
      const res = await runOcrConsistencyCheck(applicationId);
      if (res.error || !res.result) {
        setError(res.error ?? "OCR check failed");
        return;
      }
      setResult(res.result);
    });
  };

  const useOcrValue = (fieldName: string, value: string): void => {
    setApplyingField(fieldName);
    startTransition(async () => {
      const res = await saveDynamicAnswers(applicationId, { [fieldName]: value });
      if (!res.error) {
        onApply?.(fieldName, value);
        setResult((cur) =>
          cur
            ? {
                ...cur,
                fields: {
                  ...cur.fields,
                  [fieldName]: { ...cur.fields[fieldName], typed: value, match: true },
                },
                overallMatch: Object.values({
                  ...cur.fields,
                  [fieldName]: { ...cur.fields[fieldName], typed: value, match: true },
                }).every((f) => f.match),
              }
            : cur,
        );
      } else {
        setError(res.error);
      }
      setApplyingField(null);
    });
  };

  return (
    <div className="rounded-xl border border-input bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Passport OCR check</h2>
        <Button type="button" variant="outline" size="sm" onClick={runCheck} disabled={pending}>
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {result ? "Re-run" : "Run check"}
        </Button>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {!result ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Run after uploading a passport scan to compare typed answers against the MRZ-decoded values.
        </p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {Object.entries(result.fields).map(([fieldName, entry]) => (
            <li
              key={fieldName}
              className="flex items-center justify-between gap-3 rounded-md border border-input/60 bg-[#fafafa] px-3 py-2"
            >
              <div className="min-w-0">
                <p className="font-medium text-foreground">{FIELD_LABELS[fieldName] || fieldName}</p>
                <p className="text-xs text-muted-foreground">
                  Typed: <span className="font-mono">{entry.typed || "—"}</span>
                  {" · "}
                  OCR: <span className="font-mono">{entry.ocr || "—"}</span>
                  {" · "}
                  Source: {entry.source}
                </p>
              </div>
              {entry.match ? (
                <span className="inline-flex items-center gap-1 text-xs text-brand-500">
                  <CheckCircle2 className="h-4 w-4" /> match
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-xs text-destructive">
                    <AlertTriangle className="h-4 w-4" /> mismatch
                  </span>
                  {entry.ocr ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => useOcrValue(fieldName, entry.ocr!)}
                      disabled={applyingField === fieldName}
                    >
                      Use OCR
                    </Button>
                  ) : null}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

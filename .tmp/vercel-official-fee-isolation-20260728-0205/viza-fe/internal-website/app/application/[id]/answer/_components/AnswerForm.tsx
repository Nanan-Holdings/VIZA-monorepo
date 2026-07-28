"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { SmoothProgressBar } from "@/components/smooth-progress";
import { saveDynamicAnswers } from "@/app/actions/visa-application-answers";
import type { QuestionFieldRecord, QuestionSetRecord } from "@/app/actions/question-sets";

interface AnswerFormProps {
  applicationId: string;
  questionSet: QuestionSetRecord;
  initialAnswers: Record<string, string>;
}

const FIELDS_PER_STEP = 4;

function chunkFields(fields: QuestionFieldRecord[]): QuestionFieldRecord[][] {
  const out: QuestionFieldRecord[][] = [];
  for (let i = 0; i < fields.length; i += FIELDS_PER_STEP) {
    out.push(fields.slice(i, i + FIELDS_PER_STEP));
  }
  return out;
}

function isFieldVisible(field: QuestionFieldRecord, answers: Record<string, string>): boolean {
  if (!field.branch) return true;
  const observed = answers[field.branch.when.field];
  return observed === field.branch.when.equals;
}

export function AnswerForm({ applicationId, questionSet, initialAnswers }: AnswerFormProps) {
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const steps = useMemo(() => chunkFields(questionSet.fields), [questionSet]);
  const step = steps[stepIndex] ?? [];
  const visibleStepFields = step.filter((f) => isFieldVisible(f, answers));

  const persistField = (fieldName: string, value: string): void => {
    setSavingField(fieldName);
    setSaveError(null);
    startTransition(async () => {
      const res = await saveDynamicAnswers(applicationId, { [fieldName]: value });
      if (res.error) {
        setSaveError(res.error);
      }
      setSavingField((cur) => (cur === fieldName ? null : cur));
    });
  };

  const handleChange = (field: QuestionFieldRecord, value: string): void => {
    setAnswers((prev) => ({ ...prev, [field.field_name]: value }));
    if (errors[field.field_name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field.field_name];
        return next;
      });
    }
  };

  const handleBlur = (field: QuestionFieldRecord): void => {
    const value = (answers[field.field_name] || "").trim();
    if (value.length === 0) return;
    persistField(field.field_name, value);
  };

  const validateStep = (): boolean => {
    const next: Record<string, string> = {};
    for (const f of visibleStepFields) {
      if (!f.required) continue;
      const v = (answers[f.field_name] || "").trim();
      if (v.length === 0) {
        next[f.field_name] = "This field is required.";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goNext = (): void => {
    if (!validateStep()) return;
    if (stepIndex < steps.length - 1) {
      setStepIndex(stepIndex + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const goBack = (): void => {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <Card className="border-input shadow-sm">
      <CardContent className="space-y-6 p-6">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Step {stepIndex + 1} of {steps.length}
          </span>
          <span aria-live="polite">
            {savingField ? `Saving ${savingField}…` : pending ? "Saving…" : "All changes saved"}
          </span>
        </div>
        <SmoothProgressBar
          displayedProgress={((stepIndex + 1) / steps.length) * 100}
          showValue={false}
          trackClassName="bg-brand-50"
          size="xs"
        />

        <div className="space-y-5">
          {visibleStepFields.map((field) => {
            const value = answers[field.field_name] || "";
            const fieldError = errors[field.field_name];
            const inputId = `qf-${field.field_name}`;
            const widget = field.widget_type;

            return (
              <div key={field.field_name} className="space-y-1.5">
                <Label htmlFor={inputId} className="text-sm font-medium text-foreground">
                  {field.label}
                  {field.required ? <span className="ml-1 text-destructive">*</span> : null}
                </Label>
                {widget === "select" || widget === "radio" ? (
                  <select
                    id={inputId}
                    value={value}
                    onChange={(e) => handleChange(field, e.target.value)}
                    onBlur={() => handleBlur(field)}
                    className="block w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-foreground shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="">— Select —</option>
                    {(field.options || []).map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.text}
                      </option>
                    ))}
                  </select>
                ) : widget === "textarea" ? (
                  <textarea
                    id={inputId}
                    value={value}
                    onChange={(e) => handleChange(field, e.target.value)}
                    onBlur={() => handleBlur(field)}
                    rows={3}
                    className="block w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-foreground shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                ) : (
                  <Input
                    id={inputId}
                    type={
                      widget === "email"
                        ? "email"
                        : widget === "tel"
                          ? "tel"
                          : widget === "date"
                            ? "date"
                            : widget === "number"
                              ? "number"
                              : "text"
                    }
                    value={value}
                    onChange={(e) => handleChange(field, e.target.value)}
                    onBlur={() => handleBlur(field)}
                  />
                )}
                {fieldError ? (
                  <p className="text-xs text-destructive" role="alert">
                    {fieldError}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        {saveError ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            Save failed: {saveError}. Your most recent answer is still in this form — reconnect and blur the field to retry.
          </p>
        ) : null}

        <div className="flex items-center justify-between border-t border-input pt-4">
          <Button type="button" variant="outline" onClick={goBack} disabled={stepIndex === 0}>
            Back
          </Button>
          <Button
            type="button"
            onClick={goNext}
            disabled={stepIndex === steps.length - 1}
            className="bg-brand-500 hover:bg-brand-400"
          >
            {stepIndex === steps.length - 1 ? "Done" : "Next"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

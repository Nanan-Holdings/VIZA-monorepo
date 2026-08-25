"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { DynamicStepForm } from "@/components/dynamic-step-form";
import { Alert, AlertDescription, AlertIcon, AlertTitle } from "@/components/ui/alert";
import { ApplicationFormField } from "@/components/ui/application-form-field";
import { ApplicationFormPanel } from "@/components/ui/application-form-panel";
import {
  ApplicationFormSelectContent,
  ApplicationFormSelectItem,
  ApplicationFormSelectTrigger,
} from "@/components/ui/application-form-select";
import { PageBackButton } from "@/components/ui/page-back-button";
import { Select, SelectValue } from "@/components/ui/select";
import type { WizardStep } from "@/types/visa-form-fields";

import {
  buildSchemaQaPreviewAnswers,
  getSchemaQaMissingRequiredFields,
  MOCK_RESIDENTIAL_ADDRESS,
} from "./fixtures";

const NEW_TOURIST_SCHEMAS = new Set([
  "AE_TOURIST_VISA",
  "CA_TRV",
  "IN_E_VISA",
  "SA_E_VISA",
  "TR_E_VISA",
]);

export function SchemaQaClient({
  visaType,
  visaTypes,
  steps,
}: {
  visaType: string;
  visaTypes: string[];
  steps: WizardStep[];
}) {
  const router = useRouter();
  const answers = useMemo(() => buildSchemaQaPreviewAnswers(steps, visaType), [steps, visaType]);
  const missing = useMemo(() => getSchemaQaMissingRequiredFields(steps, answers), [answers, steps]);
  const fieldCount = steps.reduce((total, step) => total + step.fields.length, 0);

  return (
    <main className="min-h-screen bg-[#fafafa] px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <PageBackButton fallbackHref="/edge-cases" label="Back to edge cases" />
        <header className="mt-8">
          <p className="text-sm font-medium text-brand-500">Non-persistent schema QA</p>
          <h1 className="mt-2 text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
            Edward mock application preview
          </h1>
          <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">
            Every visible question is filled in browser memory from deterministic fictional data. Nothing on this page is saved, queued, uploaded, or sent to an official portal.
          </p>
        </header>

        <Alert variant="info" className="mt-6">
          <AlertIcon variant="info" />
          <AlertTitle>Mock residential address</AlertTitle>
          <AlertDescription>{MOCK_RESIDENTIAL_ADDRESS}</AlertDescription>
        </Alert>

        <ApplicationFormPanel className="mt-6 p-5 sm:p-6">
          <ApplicationFormField label="Visa schema">
            <Select
              value={visaType}
              onValueChange={(nextVisaType) => router.push(`/schema-qa?visaType=${encodeURIComponent(nextVisaType)}`)}
            >
              <ApplicationFormSelectTrigger className="h-12" filled>
                <SelectValue />
              </ApplicationFormSelectTrigger>
              <ApplicationFormSelectContent>
                {visaTypes.map((candidate) => (
                  <ApplicationFormSelectItem key={candidate} value={candidate}>
                    {NEW_TOURIST_SCHEMAS.has(candidate) ? `★ ${candidate}` : candidate}
                  </ApplicationFormSelectItem>
                ))}
              </ApplicationFormSelectContent>
            </Select>
          </ApplicationFormField>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              ["Steps", steps.length],
              ["Schema fields", fieldCount],
              ["Visible required missing", missing.length],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-gray-50 px-4 py-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-lg font-medium text-foreground">{value}</p>
              </div>
            ))}
          </div>
        </ApplicationFormPanel>

        <div className="mt-6 flex flex-col gap-5">
          {steps.map((step) => (
            <ApplicationFormPanel key={step.stepNumber} className="p-4 sm:p-6 md:p-8">
              <h2 className="mb-5 text-2xl font-medium text-foreground">{step.stepName}</h2>
              <DynamicStepForm
                step={step}
                prefill={answers}
                onComplete={() => undefined}
                onDraftChange={() => undefined}
                saving={false}
                showContinueButton={false}
                visaType={visaType}
              />
            </ApplicationFormPanel>
          ))}
        </div>
      </div>
    </main>
  );
}

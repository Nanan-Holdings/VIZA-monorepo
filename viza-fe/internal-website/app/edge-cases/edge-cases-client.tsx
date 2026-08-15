"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  Database,
  Info,
  LockKey,
  MagnifyingGlass,
  WarningCircle,
} from "@phosphor-icons/react";

import { ApplicationRadio } from "@/components/ui/application-checkbox";
import { ApplicationConditionalFieldsPanel } from "@/components/ui/application-conditional-fields-panel";
import { ApplicationFormDatePicker } from "@/components/ui/application-form-date-picker";
import { ApplicationFormField } from "@/components/ui/application-form-field";
import {
  ApplicationFormControlDisplay,
  ApplicationFormInputGroup,
} from "@/components/ui/application-form-input";
import { ApplicationFormPanel } from "@/components/ui/application-form-panel";
import {
  ApplicationFormSelectContent,
  ApplicationFormSelectItem,
  ApplicationFormSelectTrigger,
} from "@/components/ui/application-form-select";
import { ApplicationYesNoControl } from "@/components/ui/application-yes-no-control";
import { DocumentUploadField } from "@/components/ui/document-upload-field";
import { InputGroupInput } from "@/components/ui/input-group";
import { PageBackButton } from "@/components/ui/page-back-button";
import { Select, SelectValue } from "@/components/ui/select";
import { SupportingDocumentCard } from "@/components/ui/supporting-document-card";
import { cn } from "@/lib/utils";

import type {
  ApplicationSchemaEdgeCase,
  ApplicationSchemaEdgeCaseCatalog,
} from "./catalog";

const VISA_TYPE_LABELS: Record<string, string> = {
  AU_VISITOR_600: "Australia · Visitor 600",
  DS160: "United States · DS-160",
  EG_E_VISA: "Egypt · e-Visa",
  EU_SCHENGEN_C_SHORT_STAY: "Schengen · Short stay",
  ID_B1_EVOA: "Indonesia · B1 e-VOA",
  ID_C1_TOURIST: "Indonesia · C1 Tourist",
  JP_TOURIST: "Japan · Tourist",
  KR_C39_SHORT_TERM_VISIT: "South Korea · C-3-9",
  MY_MDAC_ARRIVAL_CARD: "Malaysia · MDAC",
  MY_TOURIST_E_VISA: "Malaysia · Tourist e-Visa",
  PH_ETRAVEL_ARRIVAL_CARD: "Philippines · eTravel arrival",
  PH_ETRAVEL_DEPARTURE_CARD: "Philippines · eTravel departure",
  PH_TEMPORARY_VISITOR_VISA: "Philippines · Visitor visa",
  SG_ARRIVAL_CARD: "Singapore · Arrival Card",
  SG_VISITOR_VISA: "Singapore · Visitor visa",
  TH_TDAC_ARRIVAL_CARD: "Thailand · TDAC",
  TH_TOURIST_E_VISA: "Thailand · Tourist e-Visa",
  TW_ENTRY_PERMIT: "Taiwan · Entry Permit",
  UK_STANDARD_VISITOR: "United Kingdom · Standard Visitor",
  VN_E_VISA: "Vietnam · e-Visa",
  VN_PREARRIVAL_DECLARATION: "Vietnam · Pre-arrival declaration",
};

const EDGE_CASE_PRESENTATION: Record<string, {
  title: string;
  problem: string;
  decision: string;
  recommendation: string;
}> = {
  binary_non_boolean_radio: {
    title: "Semantic two-choice radio",
    problem: "Two choices such as Male/Female or Single/Multiple are being treated like a Yes/No segmented control.",
    decision: "Should the compact segmented treatment apply to every two-choice enum, or only true boolean questions?",
    recommendation: "Add schema intent for boolean versus semantic enum; use a vertical radio group when labels are long or conceptually unequal.",
  },
  cross_step_conditional: {
    title: "Cross-step conditional field",
    problem: "The controlling answer lives on an earlier step, so a dependent field cannot sit directly beneath its controller.",
    decision: "How much originating-answer context should the later step repeat?",
    recommendation: "Keep the field in the outer step card and add a compact read-only context line naming the earlier answer.",
  },
  file_field_requires_document_contract: {
    title: "File field in answer schema",
    problem: "A scraped file input cannot be stored safely as an ordinary string answer.",
    decision: "Which document type, lifecycle, validation, and reusable-profile mapping does this upload use?",
    recommendation: "Map it to application_documents and render the canonical SupportingDocumentCard upload lifecycle.",
  },
  inline_group_too_large: {
    title: "Oversized inline group",
    problem: "The scraped schema asks three or four fields to share one row, while the canonical responsive pattern supports a pair.",
    decision: "Should this become a dedicated responsive cluster or be split into semantic pairs?",
    recommendation: "Default to two columns plus a full-width remainder; approve a denser component only when field relationships require it.",
  },
  multiple_conditional_roots: {
    title: "Compound conditional roots",
    problem: "One field depends on two independent controllers, so neither controller can own the conditional panel alone.",
    decision: "Should compound conditions use a shared context panel, an outer-card field, or a derived toggle?",
    recommendation: "Keep the field in the outer card for now; a future compound-condition panel should display both active prerequisites.",
  },
  sensitive_answer_field: {
    title: "Sensitive credential field",
    problem: "A password or authenticator secret appears in the ordinary application-answer schema.",
    decision: "Does VIZA create and retain this credential, or should the user complete it in a secure handoff?",
    recommendation: "Use an encrypted application-scoped vault component with explicit retention and reveal controls; never autosave it as a normal answer.",
  },
};

function humanizeCode(code: string): string {
  return code
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function visaTypeLabel(visaType: string): string {
  return VISA_TYPE_LABELS[visaType] ?? visaType;
}

function severityClasses(severity: ApplicationSchemaEdgeCase["severity"]): string {
  if (severity === "error") return "border-red-200 bg-red-50 text-red-800";
  if (severity === "warning") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-sky-200 bg-sky-50 text-sky-900";
}

function EdgeCasePreview({ code }: { code: string }) {
  const [semanticChoice, setSemanticChoice] = useState("female");
  const [verticalChoice, setVerticalChoice] = useState("female");
  const [compoundDate, setCompoundDate] = useState("");

  if (code === "binary_non_boolean_radio") {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-dashed p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Current automatic match</p>
          <ApplicationFormField label="Sex" required>
            <ApplicationYesNoControl
              name="edge-semantic-segmented"
              value={semanticChoice}
              options={[{ value: "male", text: "Male" }, { value: "female", text: "Female" }]}
              onValueChange={setSemanticChoice}
            />
          </ApplicationFormField>
        </div>
        <div className="rounded-lg border border-dashed p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Candidate enum treatment</p>
          <ApplicationFormField label="Sex" required>
            <div className="flex flex-col gap-2">
              <ApplicationRadio
                name="edge-semantic-vertical"
                value="male"
                checked={verticalChoice === "male"}
                label="Male"
                onCheckedChange={() => setVerticalChoice("male")}
              />
              <ApplicationRadio
                name="edge-semantic-vertical"
                value="female"
                checked={verticalChoice === "female"}
                label="Female"
                onCheckedChange={() => setVerticalChoice("female")}
              />
            </div>
          </ApplicationFormField>
        </div>
      </div>
    );
  }

  if (code === "cross_step_conditional") {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
          <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
          Earlier answer: Purpose of visit — Tourism
        </div>
        <ApplicationFormField label="Main reason for the tourist visit" required>
          <ApplicationFormInputGroup className="h-12">
            <InputGroupInput placeholder="Enter the reason" />
          </ApplicationFormInputGroup>
        </ApplicationFormField>
      </div>
    );
  }

  if (code === "file_field_requires_document_contract") {
    return (
      <SupportingDocumentCard
        title="Passport data page"
        description="Document lifecycle replaces a string-valued file answer."
        required
        headerLayout="stacked"
      >
        <DocumentUploadField
          status="missing"
          statusLabel="Missing"
          dropLabel="Drop file or browse"
          acceptHint="PDF, JPG or PNG · max 10 MB"
          removeLabel="Remove passport file"
          inputAriaLabel="Upload passport data page"
          onFileSelected={() => undefined}
        />
      </SupportingDocumentCard>
    );
  }

  if (code === "inline_group_too_large") {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {["Departure from origin", "Intended arrival", "Intended departure"].map((label, index) => (
          <ApplicationFormField key={label} label={label} required className={index === 2 ? "sm:col-span-2" : undefined}>
            <ApplicationFormDatePicker value="" onChange={() => undefined} displayLocale="en" />
          </ApplicationFormField>
        ))}
      </div>
    );
  }

  if (code === "multiple_conditional_roots") {
    return (
      <div className="flex flex-col gap-2">
        <div className="grid gap-2 sm:grid-cols-2">
          <ApplicationFormControlDisplay className="min-h-12 rounded-lg border bg-gray-50">
            Nationality: China
          </ApplicationFormControlDisplay>
          <ApplicationFormControlDisplay className="min-h-12 rounded-lg border bg-gray-50">
            Journey purpose: Transit
          </ApplicationFormControlDisplay>
        </div>
        <ApplicationConditionalFieldsPanel className="-mt-1">
          <p className="text-xs font-medium text-muted-foreground">Shown only when both prerequisites are active</p>
          <ApplicationFormField label="Return date" required className="py-1.5">
            <ApplicationFormDatePicker value={compoundDate} onChange={setCompoundDate} displayLocale="en" forceWhiteBackground />
          </ApplicationFormField>
        </ApplicationConditionalFieldsPanel>
      </div>
    );
  }

  if (code === "sensitive_answer_field") {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="mb-4 flex items-start gap-3 text-amber-950">
          <LockKey className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium">Encrypted vault boundary</p>
            <p className="mt-1 text-xs leading-5 text-amber-900/75">Never include this value in ordinary draft answers, AI context, analytics, or review exports.</p>
          </div>
        </div>
        <ApplicationFormField label="Official portal password" required>
          <ApplicationFormInputGroup className="h-12 bg-white">
            <InputGroupInput type="password" value="vault-secret" readOnly aria-label="Official portal password preview" />
          </ApplicationFormInputGroup>
        </ApplicationFormField>
      </div>
    );
  }

  return (
    <div className="flex min-h-28 items-center justify-center rounded-lg border border-dashed px-6 text-center text-sm text-muted-foreground">
      This newly detected pattern needs a reviewed component proposal.
    </div>
  );
}

function groupByVisaType(edgeCases: ApplicationSchemaEdgeCase[]) {
  const groups = new Map<string, ApplicationSchemaEdgeCase[]>();
  for (const edgeCase of edgeCases) {
    groups.set(edgeCase.visaType, [...(groups.get(edgeCase.visaType) ?? []), edgeCase]);
  }
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
}

export function EdgeCasesClient({ catalog }: { catalog: ApplicationSchemaEdgeCaseCatalog }) {
  const patternCodes = useMemo(
    () => [...new Set(catalog.edgeCases.map((edgeCase) => edgeCase.code))].sort(),
    [catalog.edgeCases],
  );
  const [patternFilter, setPatternFilter] = useState("all");
  const [visaTypeFilter, setVisaTypeFilter] = useState("all");
  const [query, setQuery] = useState("");

  const filteredEdgeCases = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return catalog.edgeCases.filter((edgeCase) => {
      if (patternFilter !== "all" && edgeCase.code !== patternFilter) return false;
      if (visaTypeFilter !== "all" && edgeCase.visaType !== visaTypeFilter) return false;
      if (!normalizedQuery) return true;
      return [
        edgeCase.visaType,
        visaTypeLabel(edgeCase.visaType),
        edgeCase.code,
        edgeCase.message,
        edgeCase.guidance,
        ...edgeCase.fields.flatMap((field) => [field.fieldName, field.label, field.stepName]),
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [catalog.edgeCases, patternFilter, query, visaTypeFilter]);

  const visiblePatternCodes = patternCodes.filter((code) =>
    filteredEdgeCases.some((edgeCase) => edgeCase.code === code),
  );

  return (
    <main className="min-h-screen bg-[#fafafa] px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="max-w-4xl">
          <PageBackButton fallbackHref="/ui-components" label="Back to component gallery" />
          <p className="mt-8 text-sm font-medium text-brand-500">VIZA schema design laboratory</p>
          <h1 className="mt-2 text-3xl font-medium tracking-tight text-foreground sm:text-4xl">Application form edge cases</h1>
          <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">
            Live inventory from the master visa schema. Every design-edge-case issue is shown below with a representative component, the current safe fallback, and all affected fields.
          </p>
        </header>

        <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Schema audit summary">
          {[
            ["Visa schemas", catalog.visaTypes.length],
            ["Schema fields", catalog.fieldCount.toLocaleString()],
            ["Edge-case instances", catalog.edgeCaseCount],
            ["Affected schemas", catalog.affectedVisaTypeCount],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border bg-white p-5">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-2 text-2xl font-medium text-foreground">{value}</p>
            </div>
          ))}
        </section>

        <ApplicationFormPanel className="mt-6 grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_260px_260px]">
          <ApplicationFormField label="Search country, field, step, or guidance">
            <ApplicationFormInputGroup className="h-12">
              <MagnifyingGlass className="ml-3 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <InputGroupInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search all 237 current instances" />
            </ApplicationFormInputGroup>
          </ApplicationFormField>
          <ApplicationFormField label="Edge-case pattern">
            <Select value={patternFilter} onValueChange={setPatternFilter}>
              <ApplicationFormSelectTrigger className="h-12" filled={patternFilter !== "all"}>
                <SelectValue />
              </ApplicationFormSelectTrigger>
              <ApplicationFormSelectContent>
                <ApplicationFormSelectItem value="all">All patterns</ApplicationFormSelectItem>
                {patternCodes.map((code) => (
                  <ApplicationFormSelectItem key={code} value={code}>
                    {EDGE_CASE_PRESENTATION[code]?.title ?? humanizeCode(code)}
                  </ApplicationFormSelectItem>
                ))}
              </ApplicationFormSelectContent>
            </Select>
          </ApplicationFormField>
          <ApplicationFormField label="Visa schema">
            <Select value={visaTypeFilter} onValueChange={setVisaTypeFilter}>
              <ApplicationFormSelectTrigger className="h-12" filled={visaTypeFilter !== "all"}>
                <SelectValue />
              </ApplicationFormSelectTrigger>
              <ApplicationFormSelectContent>
                <ApplicationFormSelectItem value="all">All visa schemas</ApplicationFormSelectItem>
                {catalog.visaTypes.map((visaType) => (
                  <ApplicationFormSelectItem key={visaType.visaType} value={visaType.visaType}>
                    {visaTypeLabel(visaType.visaType)}
                  </ApplicationFormSelectItem>
                ))}
              </ApplicationFormSelectContent>
            </Select>
          </ApplicationFormField>
        </ApplicationFormPanel>

        <div className="mt-4 flex items-center justify-between gap-4 text-sm text-muted-foreground">
          <span>{filteredEdgeCases.length} matching instances across {visiblePatternCodes.length} patterns</span>
          {(query || patternFilter !== "all" || visaTypeFilter !== "all") && (
            <button
              type="button"
              className="font-medium text-brand-500 hover:text-brand-700"
              onClick={() => {
                setQuery("");
                setPatternFilter("all");
                setVisaTypeFilter("all");
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="mt-8 flex flex-col gap-8">
          {visiblePatternCodes.map((code, patternIndex) => {
            const presentation = EDGE_CASE_PRESENTATION[code] ?? {
              title: humanizeCode(code),
              problem: "The schema audit detected a design shape without a canonical reviewed component.",
              decision: "Define ownership, responsive behavior, validation, and persistence before launch.",
              recommendation: "Keep the safe compiler fallback and review this pattern before adding a specialized component.",
            };
            const edgeCases = filteredEdgeCases.filter((edgeCase) => edgeCase.code === code);
            const visaGroups = groupByVisaType(edgeCases);
            const components = [...new Set(edgeCases.flatMap((edgeCase) => [
              ...(edgeCase.component ? [edgeCase.component] : []),
              ...edgeCase.fields.map((field) => field.component),
            ]))].sort();

            return (
              <section key={code} id={code} className="scroll-mt-6 rounded-xl border bg-white p-5 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">Pattern {patternIndex + 1}</span>
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">{edgeCases.length} instances</span>
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">{visaGroups.length} schemas</span>
                    </div>
                    <h2 className="mt-3 text-xl font-medium text-foreground">{presentation.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{presentation.problem}</p>
                  </div>
                  <code className="rounded-md bg-gray-100 px-2.5 py-1.5 text-xs text-gray-700">{code}</code>
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-amber-950">
                      <WarningCircle className="h-4 w-4" aria-hidden="true" />
                      Design decision
                    </div>
                    <p className="mt-2 text-sm leading-6 text-amber-900/80">{presentation.decision}</p>
                  </div>
                  <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-sky-950">
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      Current recommendation
                    </div>
                    <p className="mt-2 text-sm leading-6 text-sky-900/80">{presentation.recommendation}</p>
                  </div>
                </div>

                <div className="mt-5 rounded-xl border bg-[#fafafa] p-4 sm:p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-sm font-medium text-foreground">Component study</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {components.map((component) => (
                        <code key={component} className="rounded bg-white px-2 py-1 text-[11px] text-gray-600 ring-1 ring-gray-200">{component}</code>
                      ))}
                    </div>
                  </div>
                  <EdgeCasePreview code={code} />
                </div>

                <div className="mt-5">
                  <h3 className="text-sm font-medium text-foreground">Affected schema inventory</h3>
                  <div className="mt-3 flex flex-col gap-2">
                    {visaGroups.map(([visaType, visaEdgeCases]) => (
                      <details key={visaType} className="group rounded-lg border bg-white" open={visaGroups.length === 1}>
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-sm font-medium text-foreground">
                          <span>{visaTypeLabel(visaType)}</span>
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{visaEdgeCases.length}</span>
                        </summary>
                        <div className="border-t px-4 py-2">
                          {visaEdgeCases.map((edgeCase) => (
                            <article key={edgeCase.id} className="border-b py-4 last:border-b-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={cn("rounded-md border px-2 py-0.5 text-[11px] font-medium", severityClasses(edgeCase.severity))}>{edgeCase.severity}</span>
                                {edgeCase.component ? <code className="text-[11px] text-gray-500">{edgeCase.component}</code> : null}
                              </div>
                              <p className="mt-2 text-sm leading-6 text-gray-700">{edgeCase.message}</p>
                              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                                {edgeCase.fields.map((field) => (
                                  <div key={`${edgeCase.id}:${field.fieldName}`} className="rounded-md bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-600">
                                    <div className="font-medium text-gray-800">{field.label}</div>
                                    <code>{field.fieldName}</code>
                                    <div>Step {field.stepNumber} · {field.stepName} · {field.fieldType}</div>
                                  </div>
                                ))}
                              </div>
                              <p className="mt-3 text-xs leading-5 text-muted-foreground">{edgeCase.guidance}</p>
                            </article>
                          ))}
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              </section>
            );
          })}

          {visiblePatternCodes.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-white px-6 py-16 text-center">
              <MagnifyingGlass className="mx-auto h-8 w-8 text-gray-400" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-foreground">No edge cases match these filters</p>
              <p className="mt-1 text-sm text-muted-foreground">Try another field name, country, or pattern.</p>
            </div>
          ) : null}
        </div>

        <details className="mt-8 rounded-xl border bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5">
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Database className="h-4 w-4 text-brand-500" aria-hidden="true" />
              Coverage of all {catalog.visaTypes.length} live visa schemas
            </span>
            <span className="text-xs text-muted-foreground">Including schemas with zero design edge cases</span>
          </summary>
          <div className="grid gap-2 border-t p-5 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.visaTypes.map((visaType) => (
              <div key={visaType.visaType} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800">{visaTypeLabel(visaType.visaType)}</p>
                  <p className="text-xs text-gray-500">{visaType.fieldCount} fields</p>
                </div>
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  visaType.edgeCaseCount > 0 ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800",
                )}>
                  {visaType.edgeCaseCount}
                </span>
              </div>
            ))}
          </div>
        </details>
      </div>
    </main>
  );
}

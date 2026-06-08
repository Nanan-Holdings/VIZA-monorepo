"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Check, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";
import { DocumentCenterClient } from "@/app/client/documents/document-center-client";
import {
  loadDocumentCenterData,
  type DocumentCenterData,
} from "@/app/client/documents/actions";
import { getVisaFormSteps } from "@/app/actions/visa-form-fields";
import { type WizardStep } from "@/types/visa-form-fields";
import { evaluateShowIf } from "@/lib/form-utils";
import { getUserVisaPackage, type UserVisaPackage } from "@/app/actions/user-package";
import {
  PersonalInfoStep,
  PassportStep,
  TravelInfoStep,
  ReviewStep,
  DynamicReviewStep,
  TeamStep,
  type PersonalInfoData,
  type PassportData,
  type TravelInfoData,
  type DocumentType,
} from "@/components/application-steps";
import { DynamicStepForm } from "@/components/dynamic-step-form";
import { PassportOcrUpload } from "@/components/client/passport-ocr-upload";
import {
  saveDynamicAnswers,
  ensureDraftApplication,
  loadDynamicAnswers,
} from "@/app/actions/visa-application-answers";
import { persistDS160AnswerSet } from "@/app/actions/ds160-normalize";
import { getFormVisaType, getVisaPackageTitle } from "@/lib/visa-destinations";
import type {
  SubmissionResult,
  SubmissionResultStatus,
} from "@/lib/submission-result";
import {
  buildUniversalProfileAnswerPatch,
  mergeUniversalProfileIntoAnswers,
  splitUniversalFullName,
  type UniversalProfileSnapshot,
} from "@/lib/universal-profile-prefill";
import { SubmissionStatusStep } from "../_components/result-cards/SubmissionStatusStep";
import {
  getTeamApplicationContext,
  markTeamCompanionReviewed,
} from "@/app/actions/application-group";
import {
  buildApplicationFormHref,
  setRecentApplicationFormHref,
} from "@/lib/client/recent-application-form";

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

type StepStatus = "complete" | "in_progress" | "locked";

interface StepDef {
  id: number;
  name: string;
  description: string;
  sourceName?: string;
}

type StepClickHandler = (stepId: number) => void | Promise<void>;

interface VisibleDynamicStep {
  step: WizardStep;
  sourceIndex: number;
}

type StepSectionKey =
  | "personal"
  | "travel"
  | "travelCompanions"
  | "previousTravel"
  | "addressAndPhone"
  | "passport"
  | "usContact"
  | "family"
  | "workEducationTraining"
  | "securityAndBackground"
  | "documents"
  | "photo"
  | "review"
  | "team"
  | "confirmation";

interface StepSectionDef {
  key: StepSectionKey;
  title: string;
  steps: StepDef[];
}

const STEP_SECTION_ORDER: StepSectionKey[] = [
  "personal",
  "travel",
  "travelCompanions",
  "previousTravel",
  "addressAndPhone",
  "passport",
  "usContact",
  "family",
  "workEducationTraining",
  "securityAndBackground",
  "documents",
  "photo",
  "review",
  "team",
  "confirmation",
];

const STEP_KEYS = ["personalInfo", "passport", "travelDetails", "documents", "review", "team", "status"] as const;

/** Map a visa package's visa_type to the submission_queue status that
 *  routes the worker to the right autofill pipeline. Defaults to
 *  "pending" (legacy Indonesian e-visa path). */
function queueStatusForPackage(visaType: string | null | undefined): string {
  const normalized = (visaType ?? "").trim().toUpperCase().replace(/[\s/-]+/g, "_");
  switch (normalized) {
    case "DS160":
    case "DS_160":
    case "B1_B2":
    case "B_1_B_2":
    case "US_B1_B2":
    case "US_DS160":
      return "ds160_prefill_pending";
    case "EU_SCHENGEN_C_SHORT_STAY":
      return "fv_prefill_pending";
    case "UK_STANDARD_VISITOR":
      return "uk_prefill_pending";
    case "VN_E_VISA":
      return "vn_prefill_pending";
    case "AU_VISITOR_600":
      return "au_prefill_pending";
    default:
      return "pending";
  }
}

function getVisibleDynamicSteps(steps: WizardStep[], answers: Record<string, string>): VisibleDynamicStep[] {
  return steps
    .map((step, sourceIndex) => ({ step, sourceIndex }))
    .filter(({ step }) => step.fields.some((field) => evaluateShowIf(field, answers, step.fields)));
}

function getNextVisibleStepId(steps: StepDef[], currentStepId: number): number | null {
  const currentIndex = steps.findIndex((step) => step.id === currentStepId);
  if (currentIndex === -1) {
    return steps[0]?.id ?? null;
  }

  return steps[currentIndex + 1]?.id ?? null;
}

function getVisibleStepIndex(steps: StepDef[], currentStepId: number): number {
  return steps.findIndex((step) => step.id === currentStepId);
}

function normalizeStepName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
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

function getStepSectionKey(step: StepDef): StepSectionKey {
  const sourceName = normalizeStepName(step.sourceName ?? step.name);

  if (sourceName.startsWith("personal information")) return "personal";
  if (sourceName.startsWith("personal details")) return "personal";
  if (sourceName.startsWith("travel information")) return "travel";
  if (sourceName.startsWith("trip details")) return "travel";
  if (sourceName.startsWith("accommodation in schengen")) return "travel";
  if (sourceName.startsWith("travel companions")) return "travelCompanions";
  if (sourceName.startsWith("travel history")) return "previousTravel";
  if (sourceName.startsWith("previous u s travel") || sourceName.startsWith("previous us travel")) return "previousTravel";
  if (sourceName.startsWith("address and phone")) return "addressAndPhone";
  if (sourceName.startsWith("contact details residence") || sourceName.startsWith("contact details and residence")) return "addressAndPhone";
  if (sourceName.includes("passport information")) return "passport";
  if (sourceName.startsWith("travel document identity") || sourceName.startsWith("travel document and identity")) return "passport";
  if (sourceName.includes("us contact information") || sourceName.includes("us point of contact")) return "usContact";
  if (sourceName.startsWith("family information")) return "family";
  if (sourceName.startsWith("eu eea ch family member")) return "family";
  if (sourceName.includes("work education training") || sourceName.includes("work and education")) return "workEducationTraining";
  if (sourceName.startsWith("occupation")) return "workEducationTraining";
  if (sourceName.startsWith("financial support")) return "travel";
  if (sourceName.startsWith("security and background")) return "securityAndBackground";
  if (sourceName.startsWith("supporting documents") || sourceName.startsWith("upload documents")) return "documents";
  if (sourceName.startsWith("upload photo")) return "photo";
  if (sourceName.startsWith("review")) return "review";
  if (sourceName.startsWith("team")) return "team";
  if (sourceName.startsWith("confirmation")) return "confirmation";

  return "review";
}

function buildStepSections(steps: StepDef[], titles: Record<StepSectionKey, string>): StepSectionDef[] {
  const sectionMap = new Map<StepSectionKey, StepDef[]>();

  for (const step of steps) {
    const key = getStepSectionKey(step);
    if (!sectionMap.has(key)) {
      sectionMap.set(key, []);
    }
    sectionMap.get(key)!.push(step);
  }

  return STEP_SECTION_ORDER
    .filter((key) => (sectionMap.get(key)?.length ?? 0) > 0)
    .map((key) => ({
      key,
      title: titles[key],
      steps: sectionMap.get(key) ?? [],
    }));
}

// ---------------------------------------------------------------------------
// Vertical step sidebar
// ---------------------------------------------------------------------------

function VerticalStepSidebar({
  steps,
  currentStep,
  completedUpTo,
  onStepClick,
}: {
  steps: StepDef[];
  currentStep: number;
  completedUpTo: number;
  onStepClick: StepClickHandler;
}) {
  const currentStepIndex = steps.findIndex((step) => step.id === currentStep);
  const activeStepIndex = currentStepIndex >= 0 ? currentStepIndex : 0;

  return (
    <aside className="w-[360px] shrink-0 pl-4 pr-4 pt-9 hidden lg:flex lg:flex-col z-10 overflow-y-auto">
      <div className="relative">
      <div
        className="absolute top-4 bottom-0 border-l-2 border-dashed border-gray-200"
        style={{ left: "calc(16px + 24px + 12px + 16px - 16px)" }}
      />
      <div className="relative flex flex-col gap-3">
        {steps.map((step, i) => {
          const status: StepStatus =
            i < completedUpTo ? "complete" : i === activeStepIndex ? "in_progress" : "locked";
          const isSelected = i === activeStepIndex;

          return (
            <button
              type="button"
              key={step.id}
              onClick={() => {
                void onStepClick(step.id);
              }}
              className={cn(
                "rounded-xl border border-[#efefef] bg-white px-5 py-4 flex gap-4 items-center transition-all duration-200 text-left cursor-pointer hover:shadow-sm",
                isSelected
                  ? "ring-[1.5px] ring-[#03346E] border-[#03346E] shadow-[0_2px_12px_rgba(3,52,110,0.08)]"
                  : "hover:border-gray-300",
              )}
            >
              {/* Circle */}
              <div
                className={cn(
                  "shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all duration-200",
                  status === "complete" && "bg-[#03346E] border-[#03346E] text-white",
                  status === "in_progress" && "bg-[#03346E] border-[#03346E] text-white shadow-[0_0_0_4px_rgba(3,52,110,0.12)]",
                  status === "locked" && "bg-white border-gray-200 text-gray-500"
                )}
              >
                {status === "complete" ? (
                  <Check className="h-4 w-4" strokeWidth={3} />
                ) : (
                  i + 1
                )}
              </div>
              {/* Text */}
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "text-[15px]",
                    status === "in_progress" && "font-semibold text-[#03346E]",
                    status === "complete" && "font-medium text-[#03346E]",
                    status === "locked" && "font-medium text-gray-500"
                  )}
                >
                  {step.name}
                </p>
                <p className={cn(
                  "text-[13px] mt-0.5 leading-relaxed",
                  status === "in_progress" ? "text-[#03346E]/60" : "text-gray-400"
                )}>{step.description}</p>
              </div>
            </button>
          );
        })}
      </div>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Mobile horizontal step bar
// ---------------------------------------------------------------------------

function MobileStepBar({
  steps,
  currentStep,
  completedUpTo,
  onStepClick,
}: {
  steps: StepDef[];
  currentStep: number;
  completedUpTo: number;
  onStepClick: StepClickHandler;
}) {
  const t = useTranslations("application");
  const currentStepIndex = steps.findIndex((step) => step.id === currentStep);
  const activeStepIndex = currentStepIndex >= 0 ? currentStepIndex : 0;

  return (
    <div className="lg:hidden mb-6 bg-white rounded-lg border border-gray-100 shadow-sm p-4">
      <div className="flex items-center gap-1">
        {steps.map((step, i) => {
          const status: StepStatus =
            i < completedUpTo ? "complete" : i === activeStepIndex ? "in_progress" : "locked";
          return (
            <div key={step.id} className="flex items-center gap-1 flex-1 min-w-0">
              <button
                type="button"
                onClick={() => {
                  void onStepClick(step.id);
                }}
                className={cn(
                  "shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold border-2 cursor-pointer",
                  status === "complete" && "bg-[#03346E] border-[#03346E] text-white",
                  status === "in_progress" && "bg-white border-[#03346E] text-[#03346E]",
                  status === "locked" && "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                )}
              >
                {status === "complete" ? (
                  <Check className="h-3 w-3" strokeWidth={3} />
                ) : (
                  i + 1
                )}
              </button>
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 flex-1 rounded-full",
                    i < completedUpTo ? "bg-[#03346E]" : "bg-gray-200"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-gray-500 mt-3 font-medium">
        {t("stepOf", { current: activeStepIndex + 1, total: steps.length, name: steps[activeStepIndex]?.name })}
      </p>
    </div>
  );
}

function GroupedStepSidebar({
  sections,
  steps,
  currentStep,
  completedUpTo,
  onStepClick,
}: {
  sections: StepSectionDef[];
  steps: StepDef[];
  currentStep: number;
  completedUpTo: number;
  onStepClick: StepClickHandler;
}) {
  const currentStepIndexById = useMemo(() => new Map(steps.map((step, index) => [step.id, index])), [steps]);
  const [expandedSections, setExpandedSections] = useState<Partial<Record<StepSectionKey, boolean>>>({});
  const getStatus = useCallback((stepId: number, index: number): StepStatus => {
    return index < completedUpTo ? "complete" : stepId === currentStep ? "in_progress" : "locked";
  }, [completedUpTo, currentStep]);

  useEffect(() => {
    setExpandedSections((prev) => {
      const next = { ...prev };
      for (const section of sections) {
        if (next[section.key] === undefined) {
          next[section.key] = section.steps.some((step) => step.id === currentStep);
        }
      }
      return next;
    });
  }, [sections, currentStep]);

  const toggleSection = useCallback((key: StepSectionKey) => {
    setExpandedSections((prev) => ({
      ...prev,
      [key]: !(prev[key] ?? false),
    }));
  }, []);

  return (
    <aside className="w-[380px] shrink-0 pl-4 pr-4 pt-9 hidden lg:flex lg:flex-col z-10 overflow-y-auto">
      <div className="space-y-3">
        {sections.map((section) => {
          if (section.steps.length === 1) {
            const step = section.steps[0];
            const stepIndex = currentStepIndexById.get(step.id) ?? 0;
            const status = getStatus(step.id, stepIndex);
            const isSelected = step.id === currentStep;

            return (
              <button
                type="button"
                key={section.key}
                onClick={() => {
                  void onStepClick(step.id);
                }}
                className={cn(
                  "rounded-xl border border-[#efefef] bg-white px-5 py-4 flex gap-4 items-center transition-all duration-200 text-left cursor-pointer hover:shadow-sm w-full",
                  isSelected
                    ? "ring-[1.5px] ring-[#03346E] border-[#03346E] shadow-[0_2px_12px_rgba(3,52,110,0.08)]"
                    : "hover:border-gray-300",
                )}
              >
                <div
                  className={cn(
                    "shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all duration-200",
                    status === "complete" && "bg-[#03346E] border-[#03346E] text-white",
                    status === "in_progress" && "bg-[#03346E] border-[#03346E] text-white shadow-[0_0_0_4px_rgba(3,52,110,0.12)]",
                    status === "locked" && "bg-white border-gray-200 text-gray-500"
                  )}
                >
                  {status === "complete" ? <Check className="h-4 w-4" strokeWidth={3} /> : stepIndex + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "text-[15px]",
                      status === "in_progress" && "font-semibold text-[#03346E]",
                      status === "complete" && "font-medium text-[#03346E]",
                      status === "locked" && "font-medium text-gray-500"
                    )}
                  >
                    {step.name}
                  </p>
                </div>
              </button>
            );
          }

          const activeInSection = section.steps.some((step) => step.id === currentStep);
          const isExpanded = expandedSections[section.key] ?? activeInSection;
          const firstIndex = currentStepIndexById.get(section.steps[0].id) ?? 0;
          const completedCount = section.steps.filter((step) => {
            const i = currentStepIndexById.get(step.id) ?? 0;
            return i < completedUpTo;
          }).length;
          const sectionComplete = completedCount === section.steps.length;

          return (
            <section
              key={section.key}
              className={cn(
                "rounded-xl border bg-white overflow-hidden transition-all duration-200",
                activeInSection
                  ? "ring-[1.5px] ring-[#03346E] border-[#03346E] shadow-[0_2px_12px_rgba(3,52,110,0.08)]"
                  : "border-[#efefef] hover:border-gray-300 hover:shadow-sm"
              )}
            >
              <button
                type="button"
                onClick={() => toggleSection(section.key)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left cursor-pointer"
              >
                {/* Circle badge — matches single-step card */}
                <div
                  className={cn(
                    "shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all duration-200",
                    sectionComplete && "bg-[#03346E] border-[#03346E] text-white",
                    activeInSection && !sectionComplete && "bg-[#03346E] border-[#03346E] text-white shadow-[0_0_0_4px_rgba(3,52,110,0.12)]",
                    !sectionComplete && !activeInSection && "bg-white border-gray-200 text-gray-500"
                  )}
                >
                  {sectionComplete ? (
                    <Check className="h-4 w-4" strokeWidth={3} />
                  ) : (
                    firstIndex + 1
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "text-[15px] leading-tight truncate",
                      activeInSection && "font-semibold text-[#03346E]",
                      sectionComplete && !activeInSection && "font-medium text-[#03346E]",
                      !activeInSection && !sectionComplete && "font-medium text-gray-500"
                    )}
                  >
                    {section.title}
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200",
                    isExpanded && "rotate-180 text-[#03346E]"
                  )}
                />
              </button>

              {isExpanded && (
                <div className="relative px-5 pb-3 pt-1">
                  {/* Vertical dashed connector — centered under the header circle (left-5 + 16px) */}
                  <div
                    aria-hidden
                    className="absolute left-[35px] top-3 bottom-4 w-0 border-l-2 border-dashed border-gray-200"
                  />
                  <div className="relative space-y-0.5">
                    {section.steps.map((step) => {
                      const stepIndex = currentStepIndexById.get(step.id) ?? 0;
                      const status = getStatus(step.id, stepIndex);
                      const isSelected = step.id === currentStep;

                      return (
                        <button
                          type="button"
                          key={step.id}
                          onClick={() => {
                            void onStepClick(step.id);
                          }}
                          className={cn(
                            "relative w-full flex items-center gap-4 rounded-lg py-2 pr-2 text-left transition-colors cursor-pointer",
                            isSelected ? "bg-[#f5f9ff]" : "hover:bg-gray-50"
                          )}
                        >
                          {/* Numbered marker — circle for in-progress/locked, bare check icon for complete */}
                          <span
                            className={cn(
                              "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center text-sm font-semibold tabular-nums transition-all",
                              status === "complete" && "text-[#03346E]",
                              status === "in_progress" && "rounded-full border-2 border-[#03346E] bg-white text-[#03346E] shadow-[0_0_0_3px_rgba(3,52,110,0.14)]",
                              status === "locked" && "rounded-full border-2 border-gray-200 bg-white text-gray-400"
                            )}
                          >
                            {status === "complete" ? (
                              <Check className="h-5 w-5" strokeWidth={3} />
                            ) : (
                              stepIndex + 1
                            )}
                          </span>
                          <p
                            className={cn(
                              "text-[14px] leading-snug min-w-0 flex-1 truncate",
                              status === "in_progress" && "font-semibold text-[#03346E]",
                              status === "complete" && "font-medium text-[#03346E]",
                              status === "locked" && "font-medium text-gray-600"
                            )}
                          >
                            {step.name}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </aside>
  );
}

function GroupedMobileStepBar({
  sections,
  steps,
  currentStep,
  completedUpTo,
  onStepClick,
}: {
  sections: StepSectionDef[];
  steps: StepDef[];
  currentStep: number;
  completedUpTo: number;
  onStepClick: StepClickHandler;
}) {
  const currentStepIndexById = useMemo(() => new Map(steps.map((step, index) => [step.id, index])), [steps]);
  const currentStepIndex = currentStepIndexById.get(currentStep);
  const currentSection = sections.find((section) => section.steps.some((step) => step.id === currentStep));
  const [expandedSections, setExpandedSections] = useState<Partial<Record<StepSectionKey, boolean>>>({});
  const getStatus = useCallback((stepId: number, index: number): StepStatus => {
    return index < completedUpTo ? "complete" : stepId === currentStep ? "in_progress" : "locked";
  }, [completedUpTo, currentStep]);

  useEffect(() => {
    setExpandedSections((prev) => {
      const next = { ...prev };
      for (const section of sections) {
        if (next[section.key] === undefined) {
          next[section.key] = section.steps.some((step) => step.id === currentStep);
        }
      }
      return next;
    });
  }, [sections, currentStep]);

  const toggleSection = useCallback((key: StepSectionKey) => {
    setExpandedSections((prev) => ({
      ...prev,
      [key]: !(prev[key] ?? false),
    }));
  }, []);

  return (
    <div className="lg:hidden mb-6 space-y-3">
      <div className="rounded-xl border border-[#efefef] bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.15em] text-gray-400 font-semibold">
              {currentSection?.title ?? "Progress overview"}
            </p>
            <p className="mt-1 text-[15px] font-semibold leading-tight text-[#03346E] truncate">
              {currentStepIndex !== undefined
                ? steps[currentStepIndex]?.name
                : "Choose a step below"}
            </p>
          </div>
          <span className="shrink-0 inline-flex items-center rounded-full bg-[#03346E]/10 px-2.5 py-1 text-[12px] font-semibold tabular-nums text-[#03346E]">
            {currentStepIndex !== undefined ? `${currentStepIndex + 1} / ${steps.length}` : `— / ${steps.length}`}
          </span>
        </div>
        <div className="mt-3 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#03346E] transition-all duration-300"
            style={{ width: `${Math.min(100, (completedUpTo / Math.max(steps.length, 1)) * 100)}%` }}
          />
        </div>
      </div>

      <div className="space-y-3">
        {sections.map((section) => {
          if (section.steps.length === 1) {
            const step = section.steps[0];
            const stepIndex = currentStepIndexById.get(step.id) ?? 0;
            const status = getStatus(step.id, stepIndex);

            return (
              <button
                key={section.key}
                type="button"
                onClick={() => {
                  void onStepClick(step.id);
                }}
                className={cn(
                  "w-full rounded-xl border bg-white px-4 py-3.5 flex gap-3 items-center transition-all duration-200 text-left cursor-pointer",
                  status === "in_progress"
                    ? "ring-[1.5px] ring-[#03346E] border-[#03346E] shadow-[0_2px_12px_rgba(3,52,110,0.08)]"
                    : "border-[#efefef] active:bg-gray-50"
                )}
              >
                <div
                  className={cn(
                    "shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all duration-200",
                    status === "complete" && "bg-[#03346E] border-[#03346E] text-white",
                    status === "in_progress" && "bg-[#03346E] border-[#03346E] text-white shadow-[0_0_0_4px_rgba(3,52,110,0.12)]",
                    status === "locked" && "bg-white border-gray-200 text-gray-500"
                  )}
                >
                  {status === "complete" ? <Check className="h-4 w-4" strokeWidth={3} /> : stepIndex + 1}
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-[15px] leading-tight truncate",
                      status === "in_progress" && "font-semibold text-[#03346E]",
                      status === "complete" && "font-medium text-[#03346E]",
                      status === "locked" && "font-medium text-gray-500"
                    )}
                  >
                    {step.name}
                  </p>
                </div>
              </button>
            );
          }

          const activeInSection = section.steps.some((step) => step.id === currentStep);
          const isExpanded = expandedSections[section.key] ?? activeInSection;
          const firstIndex = currentStepIndexById.get(section.steps[0].id) ?? 0;
          const completedCount = section.steps.filter((step) => {
            const i = currentStepIndexById.get(step.id) ?? 0;
            return i < completedUpTo;
          }).length;
          const sectionComplete = completedCount === section.steps.length;

          return (
            <section
              key={section.key}
              className={cn(
                "rounded-xl border bg-white overflow-hidden transition-all duration-200",
                activeInSection
                  ? "ring-[1.5px] ring-[#03346E] border-[#03346E] shadow-[0_2px_12px_rgba(3,52,110,0.08)]"
                  : "border-[#efefef] active:bg-gray-50"
              )}
            >
              <button
                type="button"
                onClick={() => toggleSection(section.key)}
                className="w-full cursor-pointer px-4 py-3.5 flex items-center gap-3 text-left"
              >
                <div
                  className={cn(
                    "shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all duration-200",
                    sectionComplete && "bg-[#03346E] border-[#03346E] text-white",
                    activeInSection && !sectionComplete && "bg-[#03346E] border-[#03346E] text-white shadow-[0_0_0_4px_rgba(3,52,110,0.12)]",
                    !sectionComplete && !activeInSection && "bg-white border-gray-200 text-gray-500"
                  )}
                >
                  {sectionComplete ? (
                    <Check className="h-4 w-4" strokeWidth={3} />
                  ) : (
                    firstIndex + 1
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-[15px] leading-tight truncate",
                      activeInSection && "font-semibold text-[#03346E]",
                      sectionComplete && !activeInSection && "font-medium text-[#03346E]",
                      !activeInSection && !sectionComplete && "font-medium text-gray-500"
                    )}
                  >
                    {section.title}
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200",
                    isExpanded && "rotate-180 text-[#03346E]"
                  )}
                />
              </button>

              {isExpanded && (
                <div className="relative px-4 pb-3 pt-1">
                  {/* Dashed connector — centered under the 8×8 header circle (left-4 + 16px) */}
                  <div
                    aria-hidden
                    className="absolute left-[31px] top-3 bottom-4 w-0 border-l-2 border-dashed border-gray-200"
                  />
                  <div className="relative space-y-0.5">
                    {section.steps.map((step) => {
                      const stepIndex = currentStepIndexById.get(step.id) ?? 0;
                      const status = getStatus(step.id, stepIndex);
                      const isSelected = step.id === currentStep;

                      return (
                        <button
                          key={step.id}
                          type="button"
                          onClick={() => {
                            void onStepClick(step.id);
                          }}
                          className={cn(
                            "relative w-full flex items-center gap-4 rounded-lg py-2 pr-2 text-left transition-colors",
                            isSelected ? "bg-[#f5f9ff]" : "active:bg-gray-50"
                          )}
                        >
                          {/* Numbered marker — bare check for complete, circle otherwise */}
                          <span
                            className={cn(
                              "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center text-sm font-semibold tabular-nums transition-all",
                              status === "complete" && "text-[#03346E]",
                              status === "in_progress" && "rounded-full border-2 border-[#03346E] bg-white text-[#03346E] shadow-[0_0_0_3px_rgba(3,52,110,0.14)]",
                              status === "locked" && "rounded-full border-2 border-gray-200 bg-white text-gray-400"
                            )}
                          >
                            {status === "complete" ? (
                              <Check className="h-5 w-5" strokeWidth={3} />
                            ) : (
                              stepIndex + 1
                            )}
                          </span>
                          <p
                            className={cn(
                              "text-[14px] leading-snug min-w-0 flex-1 truncate",
                              status === "in_progress" && "font-semibold text-[#03346E]",
                              status === "complete" && "font-medium text-[#03346E]",
                              status === "locked" && "font-medium text-gray-600"
                            )}
                          >
                            {step.name}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}



// ---------------------------------------------------------------------------
// Application data types
// ---------------------------------------------------------------------------

interface ApplicationState {
  applicationId: string | null;
  personal: Partial<PersonalInfoData>;
  passport: Partial<PassportData>;
  travel: Partial<TravelInfoData>;
  documents: Partial<Record<DocumentType, string>>;
  photo: string | null;
  confirmationNumber?: string;
  submittedAt?: string;
  submissionResult: SubmissionResult | null;
  submissionResultStatus: SubmissionResultStatus | null;
}

type LoadedApplicantProfile = UniversalProfileSnapshot & {
  id?: string | null;
  place_of_birth?: string | null;
  gender?: string | null;
};

type LoadedApplication = {
  id?: string | null;
  country?: string | null;
  visa_type?: string | null;
  status?: string | null;
  confirmation_number?: string | null;
  submitted_at?: string | null;
  submission_result?: unknown | null;
  submission_result_status?: string | null;
  arrival_date?: string | null;
  departure_date?: string | null;
  port_of_entry?: string | null;
  purpose?: string | null;
  accommodation_name?: string | null;
  accommodation_address?: string | null;
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ApplicationPage() {
  const router = useRouter();
  const t = useTranslations("application");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const jumpToReview = searchParams.get("step") === "review";
  const jumpToTeam = searchParams.get("step") === "team";
  const explicitApplicationId = searchParams.get("applicationId")?.trim() || null;
  const returnToParam = searchParams.get("returnTo")?.trim() || null;
  const isCompanionFlow = Boolean(explicitApplicationId && returnToParam);
  const teamNotice = searchParams.get("teamNotice");
  const explicitCountry = searchParams.get("country")?.trim().toLowerCase() || null;
  const explicitVisaType =
    searchParams.get("visaType")?.trim() || searchParams.get("visa_type")?.trim() || null;
  const preferExplicitPackage = Boolean(explicitCountry || explicitVisaType);
  const showTeamStep = !isCompanionFlow;

  const STEPS: StepDef[] = STEP_KEYS
    .filter((key) => showTeamStep || key !== "team")
    .map((key, id) => ({
    id,
    name: t(`steps.${key}.name`),
    description: t(`steps.${key}.description`),
    sourceName: key,
  }));

  // DB-driven steps (loaded from visa_form_fields table)
  // Falls back to hardcoded STEPS if DB returns empty
  const [dbSteps, setDbSteps] = useState<WizardStep[]>([]);
  const [visaPackage, setVisaPackage] = useState<UserVisaPackage | null>(null);
  const [packageLoaded, setPackageLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getUserVisaPackage()
      .then((pkg) => {
        if (cancelled) return null;
        if (pkg) setVisaPackage(pkg);
        const visaType = explicitVisaType ?? pkg?.visa_type ?? "tourist_b211a";
        return getVisaFormSteps(visaType);
      })
      .then((steps) => {
        if (cancelled) return;
        if (steps && steps.length > 0) setDbSteps(steps);
      })
      .catch(() => {
        // Silent fallback to hardcoded steps
      })
      .finally(() => {
        if (!cancelled) setPackageLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [explicitVisaType]);

  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedUpTo, setCompletedUpTo] = useState(0);
  const [appState, setAppState] = useState<ApplicationState>({
    applicationId: null,
    personal: {},
    passport: {},
    travel: {},
    documents: {},
    photo: null,
    submissionResult: null,
    submissionResultStatus: null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Dynamic form answers keyed by field_name
  const [dynamicAnswers, setDynamicAnswers] = useState<Record<string, string>>({});
  const [documentCenterData, setDocumentCenterData] = useState<DocumentCenterData | null>(null);
  const [documentCenterError, setDocumentCenterError] = useState<string | null>(null);
  const [localPassportBioPageName, setLocalPassportBioPageName] = useState<string | null>(null);
  const initialStepResolvedRef = useRef(false);
  const dynamicDraftRef = useRef<Record<number, Record<string, string>>>({});
  const navigationSaveInFlightRef = useRef(false);

  const handleDynamicDraftChange = useCallback((stepId: number, data: Record<string, string>) => {
    dynamicDraftRef.current[stepId] = data;
  }, []);

  const resolvedCountry = explicitCountry ?? visaPackage?.country ?? "indonesia";
  const resolvedVisaType = explicitVisaType ?? visaPackage?.visa_type ?? "tourist_b211a";

  useEffect(() => {
    const href = buildApplicationFormHref(
      "/client/application/long-form",
      searchParams.toString(),
      {
        country: resolvedCountry,
        visaType: getFormVisaType(resolvedVisaType),
      },
    );
    if (href) setRecentApplicationFormHref(href);
  }, [
    resolvedCountry,
    resolvedVisaType,
    searchParams,
  ]);

  // Use DB-driven steps when available, otherwise fall back to hardcoded
  const useDynamic = dbSteps.length > 0;
  const tDyn = useTranslations("application.dynamicSteps");
  const tApp = useTranslations("application");
  const isZhInterface = locale.toLowerCase().startsWith("zh");
  // Indices for the extra steps appended after DB-driven form steps
  const documentStepIndex = dbSteps.length;
  const reviewStepIndex = dbSteps.length + 1;
  const teamStepIndex = dbSteps.length + 2;
  const statusStepIndex = dbSteps.length + (showTeamStep ? 3 : 2);
  const fallbackReviewStepIndex = 4;
  const fallbackTeamStepIndex = 5;
  const fallbackStatusStepIndex = showTeamStep ? 6 : 5;

  const visibleDynamicSteps = useMemo(
    () => (useDynamic ? getVisibleDynamicSteps(dbSteps, dynamicAnswers) : []),
    [dbSteps, dynamicAnswers, useDynamic],
  );
  const firstFormStepId = useDynamic ? (visibleDynamicSteps[0]?.sourceIndex ?? 0) : 0;

  const passportBioPageDocument = useMemo(
    () =>
      documentCenterData?.documents.find((document) =>
        document.documentType === "passport_copy" ||
        document.requirementKey === "passport_copy"
      ) ?? null,
    [documentCenterData],
  );
  const hasUniversalPassportPrefill = Boolean(
    appState.passport.passportNumber ||
    dynamicAnswers.passport_number ||
    dynamicAnswers.passportNumber ||
    dynamicAnswers.travel_document_number,
  );
  const passportOcrInitialFileName =
    localPassportBioPageName ??
    passportBioPageDocument?.filename ??
    (hasUniversalPassportPrefill
      ? (isZhInterface ? "已从通用资料读取护照信息" : "Loaded from universal profile")
      : null);
  const passportOcrInitialUploaded = Boolean(
    localPassportBioPageName ||
    passportBioPageDocument ||
    hasUniversalPassportPrefill,
  );

  // Steps in DB source order — used only to build the grouped sections.
  // The displayed/navigated list (`effectiveSteps` below) is reordered to
  // match the grouped section order so the sidebar numbers stay sequential
  // (1, 2, 3, 4…) instead of jumping (e.g. 1, 2, 5, 3, 4).
  const sourceOrderedSteps = useMemo<StepDef[]>(
    () =>
      useDynamic
        ? [
        ...visibleDynamicSteps.map(({ step, sourceIndex }) => ({
          id: sourceIndex,
          sourceName: step.stepName,
          name: (() => {
            const translationKey = getDynamicStepTranslationCandidates(step.stepName)
              .find((key) => tDyn.has(key as never));
            return translationKey ? tDyn(translationKey as never) : step.stepName;
          })(),
          description: tApp("dynamicStepDescription", { count: step.fields.length }),
        })),
        {
          id: documentStepIndex,
          sourceName: "Supporting Documents",
          name: tDyn.has("Supporting Documents") ? tDyn("Supporting Documents" as never) : isZhInterface ? "材料" : "Documents",
          description: tApp.has("documentsStepDescription") ? tApp("documentsStepDescription" as never) : "Upload required and optional supporting documents",
        },
        {
          id: reviewStepIndex,
          sourceName: "Review",
          name: tDyn.has("Review") ? tDyn("Review" as never) : "Review Application",
          description: tApp.has("reviewStepDescription") ? tApp("reviewStepDescription" as never) : "Review and confirm your details",
        },
        ...(showTeamStep
          ? [
              {
                id: teamStepIndex,
                sourceName: "Team",
                name: tApp.has("steps.team.name") ? tApp("steps.team.name" as never) : "Team",
                description: tApp.has("teamStepDescription") ? tApp("teamStepDescription" as never) : "Add or review companions",
              },
            ]
          : []),
        {
          id: statusStepIndex,
          sourceName: "Confirmation",
          name: tDyn.has("Confirmation") ? tDyn("Confirmation" as never) : "Confirmation",
          description: tApp.has("statusStepDescription") ? tApp("statusStepDescription" as never) : "Application submitted",
        },
      ]
        : [...STEPS],
    [
      documentStepIndex,
      reviewStepIndex,
      showTeamStep,
      statusStepIndex,
      STEPS,
      teamStepIndex,
      isZhInterface,
      tApp,
      tDyn,
      useDynamic,
      visibleDynamicSteps,
    ],
  );

  const dynamicSectionTitles = {
    personal: tApp.has("dynamicSections.personal") ? tApp("dynamicSections.personal" as never) : "Personal",
    travel: tApp.has("dynamicSections.travel") ? tApp("dynamicSections.travel" as never) : "Travel",
    travelCompanions: tApp.has("dynamicSections.travelCompanions") ? tApp("dynamicSections.travelCompanions" as never) : "Travel Companions",
    previousTravel: tApp.has("dynamicSections.previousTravel") ? tApp("dynamicSections.previousTravel" as never) : "Previous U.S. Travel",
    addressAndPhone: tApp.has("dynamicSections.addressAndPhone") ? tApp("dynamicSections.addressAndPhone" as never) : "Address and Phone",
    passport: tApp.has("dynamicSections.passport") ? tApp("dynamicSections.passport" as never) : "Passport",
    usContact: tApp.has("dynamicSections.usContact") ? tApp("dynamicSections.usContact" as never) : "U.S. Contact",
    family: tApp.has("dynamicSections.family") ? tApp("dynamicSections.family" as never) : "Family",
    workEducationTraining: tApp.has("dynamicSections.workEducationTraining") ? tApp("dynamicSections.workEducationTraining" as never) : "Work / Education / Training",
    securityAndBackground: tApp.has("dynamicSections.securityAndBackground") ? tApp("dynamicSections.securityAndBackground" as never) : "Security and Background",
    documents: tApp.has("dynamicSections.documents") ? tApp("dynamicSections.documents" as never) : isZhInterface ? "材料" : "Documents",
    photo: tApp.has("dynamicSections.photo") ? tApp("dynamicSections.photo" as never) : "Upload Photo",
    review: tApp.has("dynamicSections.review") ? tApp("dynamicSections.review" as never) : "Review",
    team: tApp.has("dynamicSections.team") ? tApp("dynamicSections.team" as never) : "Team",
    confirmation: tApp.has("dynamicSections.confirmation") ? tApp("dynamicSections.confirmation" as never) : "Confirmation",
  } satisfies Record<StepSectionKey, string>;

  const groupedSections = useMemo(
    () => (useDynamic ? buildStepSections(sourceOrderedSteps, dynamicSectionTitles) : []),
    [dynamicSectionTitles, sourceOrderedSteps, useDynamic],
  );

  // Final list of steps in display order: flattened from grouped sections so
  // the sidebar index matches navigation order. Falls back to source order
  // for the hardcoded (non-DB) flow.
  const effectiveSteps: StepDef[] = useDynamic
    ? groupedSections.flatMap((section) => section.steps)
    : sourceOrderedSteps;

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    let profile: LoadedApplicantProfile | null = null;
    let application: LoadedApplication | null = null;

    if (explicitApplicationId) {
      const context = await getTeamApplicationContext(explicitApplicationId);
      if (!context.ok || !context.application || !context.profile) {
        setError(context.reason ?? t("errors.noApplicationFound"));
        setLoading(false);
        return;
      }
      profile = context.profile as LoadedApplicantProfile;
      application = context.application as LoadedApplication;
    } else {
      const { data: ownerProfile } = await supabase
        .from("applicant_profiles")
        .select("*")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      profile = (ownerProfile as LoadedApplicantProfile | null) ?? null;

      const { data: applicationRows } = await supabase
        .from("applications")
        .select("*")
        .eq("applicant_id", profile?.id ?? "")
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

      const applications = (applicationRows ?? []) as LoadedApplication[];
      application =
        applications.find(
          (row) =>
            String(row.country).toLowerCase() === resolvedCountry.toLowerCase() &&
            getFormVisaType(String(row.visa_type)).toLowerCase() === getFormVisaType(resolvedVisaType).toLowerCase(),
        ) ??
        (preferExplicitPackage ? null : applications[0] ?? null);
    }

    if (profile) {
      // Load DS-160 answers from visa_application_answers first (the source of truth)
      let ds160Answers: Record<string, string> = {};
      if (application?.id) {
        const { answers } = await loadDynamicAnswers(application.id);
        ds160Answers = answers;
      }
      const universalAnswers = mergeUniversalProfileIntoAnswers({}, profile as UniversalProfileSnapshot);
      const mergedDynamicAnswers = { ...universalAnswers, ...ds160Answers };

      // Hydrate hardcoded steps from DS-160 answers first, falling back to profile/application
      const a = ds160Answers;
      setAppState((prev) => ({
        ...prev,
        applicationId: application?.id ?? null,
        personal: {
          surname: a.surname || profile.full_name?.split(" ").slice(-1)[0] || "",
          givenNames: a.given_names || profile.full_name?.split(" ").slice(0, -1).join(" ") || "",
          fullNameNativeAlphabet: a.full_name_native_alphabet || "",
          sex: a.sex || profile.gender || "",
          maritalStatus: a.marital_status || "",
          dateOfBirth: a.date_of_birth || profile.date_of_birth || "",
          cityOfBirth: a.city_of_birth || profile.place_of_birth || "",
          stateOfBirth: a.state_of_birth || "",
          countryOfBirth: a.country_of_birth || "",
          nationality: a.nationality_country || profile.nationality || "",
        },
        passport: {
          passportDocumentType: a.passport_document_type || "",
          passportNumber: a.passport_number || profile.passport_number || "",
          passportBookNumber: a.passport_book_number || "",
          passportIssuingCountry: a.passport_issuing_country || profile.passport_issuing_country || "",
          passportIssuanceCity: a.passport_issuance_city || "",
          passportIssuanceDate: a.passport_issuance_date || profile.passport_issue_date || "",
          passportExpirationDate: a.passport_expiration_date || profile.passport_expiry_date || "",
        },
        travel: {
          purposeOfTrip: a.purpose_of_trip || application?.purpose || "",
          arrivalDate: application?.arrival_date || "",
          departureDate: application?.departure_date || "",
          arrivalCity: a.arrival_city || application?.port_of_entry || "",
          accommodationName: a.planned_location || application?.accommodation_name || "",
          usAddressStreet1: a.us_address_street1 || application?.accommodation_address || "",
          usAddressCity: a.us_address_city || "",
          usAddressState: a.us_address_state || "",
          usAddressZip: a.us_address_zip || "",
        },
        confirmationNumber: application?.confirmation_number ?? undefined,
        submittedAt: application?.submitted_at ?? undefined,
        submissionResult: (application?.submission_result as SubmissionResult | null) ?? null,
        submissionResultStatus:
          (application?.submission_result_status as SubmissionResultStatus | null) ?? null,
      }));

      const hasPersonal = !!(a.surname || profile.full_name) && !!(a.nationality_country || profile.nationality);
      const hasPassport = !!(a.passport_number || profile.passport_number);
      const hasTravel = !!(application?.arrival_date && application?.departure_date);
      const hasDocuments = application?.status === "submitted" || application?.status === "approved";
      const isSubmitted = application?.status === "submitted" || application?.status === "approved";

      const completed = hasPersonal ? (hasPassport ? (hasTravel ? (hasDocuments ? (isSubmitted ? 6 : 4) : 3) : 2) : 1) : 0;
      setCompletedUpTo(completed);
      if (!initialStepResolvedRef.current) {
        setCurrentStep(0);
        initialStepResolvedRef.current = true;
      }

      // Set dynamic answers for the dynamic form steps
      if (Object.keys(mergedDynamicAnswers).length > 0) {
        setDynamicAnswers(mergedDynamicAnswers);
        if (ds160Answers["photo_path"]) {
          setAppState((prev) => ({ ...prev, photo: ds160Answers["photo_path"] }));
        }
      }
    }

    setLoading(false);
  }, [explicitApplicationId, preferExplicitPackage, resolvedCountry, resolvedVisaType, t]);

  useEffect(() => {
    if (!packageLoaded) return;
    void loadData();
  }, [loadData, packageLoaded]);

  // Honor ?step=review from the simplified-form redirect: once steps + any
  // prefilled answers have loaded, jump directly to the Review step.
  const [reviewJumpHandled, setReviewJumpHandled] = useState(false);
  useEffect(() => {
    if ((!jumpToReview && !jumpToTeam) || reviewJumpHandled || loading) return;
    const targetId = jumpToTeam && showTeamStep
      ? (useDynamic
          ? (effectiveSteps.find((s) => s.sourceName === "Team")?.id ?? teamStepIndex)
          : fallbackTeamStepIndex)
      : useDynamic
        ? (effectiveSteps.find((s) => s.sourceName === "Review")?.id ?? reviewStepIndex)
        : fallbackReviewStepIndex;
    setCurrentStep(targetId);
    setCompletedUpTo((c) => Math.max(c, targetId));
    setReviewJumpHandled(true);
  }, [
    effectiveSteps,
    jumpToReview,
    jumpToTeam,
    loading,
    reviewJumpHandled,
    reviewStepIndex,
    showTeamStep,
    fallbackReviewStepIndex,
    fallbackTeamStepIndex,
    teamStepIndex,
    useDynamic,
  ]);

  useEffect(() => {
    if (!useDynamic || effectiveSteps.length === 0) return;
    if (effectiveSteps.some((step) => step.id === currentStep)) return;

    const fallbackStep = [...effectiveSteps].reverse().find((step) => step.id < currentStep) ?? effectiveSteps[0];
    if (fallbackStep && fallbackStep.id !== currentStep) {
      setCurrentStep(fallbackStep.id);
      const fallbackIndex = effectiveSteps.findIndex((step) => step.id === fallbackStep.id);
      if (fallbackIndex >= 0) {
        setCompletedUpTo((current) => Math.min(current, fallbackIndex));
      }
    }
  }, [currentStep, effectiveSteps, useDynamic]);

  // US-040: Supabase Realtime — re-fetch data on profile or application UPDATE
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("application-page-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "applicant_profiles" },
        () => { void loadData(); }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "applications" },
        () => { void loadData(); }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadData]);

  const ensureWritableApplicationId = useCallback(async () => {
    let applicationId = appState.applicationId;

    // Non-team flows should always save to the current user's draft for the
    // active package. Local state can be stale after package/country switches.
    if (!explicitApplicationId) {
      const result = await ensureDraftApplication(resolvedCountry, resolvedVisaType, {
        preferExplicit: preferExplicitPackage,
      });
      if (result.error || !result.applicationId) {
        throw new Error(result.error ?? t("errors.noApplicationFound"));
      }
      applicationId = result.applicationId;
      setAppState((prev) => ({ ...prev, applicationId }));
    } else if (!applicationId) {
      throw new Error(t("errors.noApplicationFound"));
    }

    if (!applicationId) {
      throw new Error(t("errors.noApplicationFound"));
    }

    return applicationId;
  }, [
    appState.applicationId,
    explicitApplicationId,
    preferExplicitPackage,
    resolvedCountry,
    resolvedVisaType,
    t,
  ]);

  const saveDynamicDraftForStep = useCallback(async (stepIndex: number) => {
    const data = dynamicDraftRef.current[stepIndex];
    if (!data) return;

    const hasNonEmptyValue = Object.values(data).some((value) => value.trim() !== "");
    const hasChangedValue = Object.entries(data).some(
      ([fieldName, value]) => (dynamicAnswers[fieldName] ?? "") !== value,
    );
    if (!hasNonEmptyValue && !hasChangedValue) return;

    const applicationId = await ensureWritableApplicationId();
    const saveResult = await saveDynamicAnswers(applicationId, data);
    if (saveResult.error) throw new Error(saveResult.error);

    setDynamicAnswers((prev) => ({ ...prev, ...data }));
  }, [dynamicAnswers, ensureWritableApplicationId]);

  const saveAllDynamicDrafts = useCallback(async () => {
    const mergedDraft = Object.values(dynamicDraftRef.current).reduce<Record<string, string>>(
      (acc, stepDraft) => ({ ...acc, ...stepDraft }),
      {},
    );
    const draftEntries = Object.entries(mergedDraft);
    if (draftEntries.length === 0) return;

    const hasChangedValue = draftEntries.some(
      ([fieldName, value]) => (dynamicAnswers[fieldName] ?? "") !== value,
    );
    if (!hasChangedValue) return;

    const applicationId = await ensureWritableApplicationId();
    const saveResult = await saveDynamicAnswers(applicationId, mergedDraft);
    if (saveResult.error) throw new Error(saveResult.error);

    setDynamicAnswers((prev) => ({ ...prev, ...mergedDraft }));
  }, [dynamicAnswers, ensureWritableApplicationId]);

  const handleStepNavigation = useCallback(async (targetStepId: number) => {
    if (targetStepId === currentStep || navigationSaveInFlightRef.current) return;

    const shouldAutosaveCurrentStep =
      useDynamic &&
      currentStep < documentStepIndex &&
      Boolean(dbSteps[currentStep]);

    if (!shouldAutosaveCurrentStep) {
      setCurrentStep(targetStepId);
      return;
    }

    navigationSaveInFlightRef.current = true;
    setSaving(true);
    setError(null);

    try {
      await saveDynamicDraftForStep(currentStep);
      setCurrentStep(targetStepId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.failedToSave"));
    } finally {
      navigationSaveInFlightRef.current = false;
      setSaving(false);
    }
  }, [currentStep, dbSteps, documentStepIndex, saveDynamicDraftForStep, t, useDynamic]);

  const handlePersonalComplete = async (data: PersonalInfoData) => {
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t("errors.notAuthenticated"));

      await supabase.from("applicant_profiles").upsert(
        {
          auth_user_id: user.id,
          full_name: `${data.givenNames} ${data.surname}`.trim(),
          date_of_birth: data.dateOfBirth || null,
          place_of_birth: data.cityOfBirth || null,
          gender: data.sex || null,
          nationality: data.nationality,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "auth_user_id" }
      );

      setAppState((prev) => ({ ...prev, personal: data }));
      setCompletedUpTo((c) => Math.max(c, 1));
      setCurrentStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.failedToSave"));
    } finally {
      setSaving(false);
    }
  };

  const handlePassportComplete = async (data: PassportData) => {
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t("errors.notAuthenticated"));

      await supabase.from("applicant_profiles").upsert(
        {
          auth_user_id: user.id,
          passport_number: data.passportNumber,
          passport_issue_date: data.passportIssuanceDate || null,
          passport_expiry_date: data.passportExpirationDate || null,
          passport_issuing_country: data.passportIssuingCountry,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "auth_user_id" }
      );

      setAppState((prev) => ({ ...prev, passport: data }));
      setCompletedUpTo((c) => Math.max(c, 2));
      setCurrentStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.failedToSave"));
    } finally {
      setSaving(false);
    }
  };

  const handleTravelComplete = async (data: TravelInfoData) => {
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t("errors.notAuthenticated"));

      const { data: profile } = await supabase
        .from("applicant_profiles")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();

      if (!profile) throw new Error(t("errors.profileNotFound"));

      let applicationId = appState.applicationId;
      if (!applicationId) {
        const { data: newApp, error: appError } = await supabase
          .from("applications")
          .insert({
            applicant_id: profile.id,
            status: "draft",
            country: resolvedCountry,
            visa_type: resolvedVisaType,
            arrival_date: data.arrivalDate || null,
            departure_date: data.departureDate || null,
            port_of_entry: data.arrivalCity || null,
            purpose: data.purposeOfTrip || null,
            accommodation_name: data.accommodationName || null,
            accommodation_address: data.usAddressStreet1 || null,
          })
          .select("id")
          .single();
        if (appError) throw appError;
        applicationId = newApp.id;
      } else {
        await supabase.from("applications").update({
          arrival_date: data.arrivalDate || null,
          departure_date: data.departureDate || null,
          port_of_entry: data.arrivalCity || null,
          purpose: data.purposeOfTrip || null,
          accommodation_name: data.accommodationName || null,
          accommodation_address: data.usAddressStreet1 || null,
        }).eq("id", applicationId);
      }

      setAppState((prev) => ({ ...prev, travel: data, applicationId }));
      setCompletedUpTo((c) => Math.max(c, 3));
      setCurrentStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.failedToSave"));
    } finally {
      setSaving(false);
    }
  };

  const handleDynamicStepComplete = async (stepIndex: number, data: Record<string, string>) => {
    setSaving(true);
    setError(null);
    try {
      let applicationId = appState.applicationId;

      // Non-team flows should always save to the current user's draft for the
      // active package. Local state can be stale after package/country switches,
      // which makes saveDynamicAnswers return "Unauthorized" and blocks moving
      // to the next tab.
      if (!explicitApplicationId) {
        const result = await ensureDraftApplication(resolvedCountry, resolvedVisaType, {
          preferExplicit: preferExplicitPackage,
        });
        if (result.error) throw new Error(result.error);
        applicationId = result.applicationId!;
        setAppState((prev) => ({ ...prev, applicationId }));
      } else if (!applicationId) {
        throw new Error(t("errors.noApplicationFound"));
      }

      // Save answers via server action (bypasses RLS)
      const saveResult = await saveDynamicAnswers(applicationId, data);
      if (saveResult.error) throw new Error(saveResult.error);

      // Update local state
      setDynamicAnswers((prev) => ({ ...prev, ...data }));
      const currentStepPosition = getVisibleStepIndex(effectiveSteps, stepIndex);
      const nextStepId = getNextVisibleStepId(effectiveSteps, stepIndex);
      setCompletedUpTo((c) => Math.max(c, currentStepPosition + 1));
      setCurrentStep(nextStepId ?? stepIndex);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.failedToSave"));
    } finally {
      setSaving(false);
    }
  };

  const handleDynamicDocumentsContinue = () => {
    const documentStepPosition = getVisibleStepIndex(effectiveSteps, documentStepIndex);
    setCompletedUpTo((c) => Math.max(c, documentStepPosition + 1));
    setCurrentStep(reviewStepIndex);
  };

  const handleFallbackDocumentsContinue = () => {
    setCompletedUpTo((c) => Math.max(c, 4));
    setCurrentStep(4);
  };

  const returnToTeam = useCallback(() => {
    const target = new URL(returnToParam ?? "/client/application/long-form", window.location.origin);
    target.searchParams.set("step", "team");
    target.searchParams.set("teamNotice", "companion_added");
    router.push(target.toString().replace(window.location.origin, ""));
  }, [returnToParam, router]);

  const handleReviewContinueToTeam = useCallback(() => {
    if (!showTeamStep) return;
    const targetReviewStepIndex = useDynamic ? reviewStepIndex : fallbackReviewStepIndex;
    const targetTeamStepIndex = useDynamic ? teamStepIndex : fallbackTeamStepIndex;
    const reviewStepPosition = getVisibleStepIndex(effectiveSteps, targetReviewStepIndex);
    setCompletedUpTo((c) => Math.max(c, reviewStepPosition + 1));
    setCurrentStep(targetTeamStepIndex);
  }, [
    effectiveSteps,
    fallbackReviewStepIndex,
    fallbackTeamStepIndex,
    reviewStepIndex,
    showTeamStep,
    teamStepIndex,
    useDynamic,
  ]);

  const handleCompanionReviewComplete = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      if (!appState.applicationId) throw new Error(t("errors.noApplicationFound"));

      const normalizeResult = await persistDS160AnswerSet(
        appState.applicationId,
        appState.personal,
        appState.passport,
        appState.travel,
      );
      if (normalizeResult.error) throw new Error(normalizeResult.error);

      const reviewedResult = await markTeamCompanionReviewed(appState.applicationId);
      if (!reviewedResult.ok) throw new Error(reviewedResult.reason ?? t("errors.failedToSave"));

      returnToTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.failedToSave"));
    } finally {
      setSaving(false);
    }
  }, [appState.applicationId, appState.passport, appState.personal, appState.travel, returnToTeam, t]);

  // ── Dynamic-mode review complete handler ────────────────────────────
  const handleDynamicReviewComplete = async () => {
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      let applicationId = appState.applicationId;
      if (!explicitApplicationId) {
        const result = await ensureDraftApplication(resolvedCountry, resolvedVisaType, {
          preferExplicit: preferExplicitPackage,
        });
        if (result.error) throw new Error(result.error);
        applicationId = result.applicationId!;
        setAppState((prev) => ({ ...prev, applicationId }));
      }
      if (!applicationId) throw new Error(t("errors.noApplicationFound"));

      await saveAllDynamicDrafts();

      // Persist the complete DS-160 answer set from hardcoded steps
      const normalizeResult = await persistDS160AnswerSet(
        applicationId,
        appState.personal,
        appState.passport,
        appState.travel,
      );
      if (normalizeResult.error) throw new Error(normalizeResult.error);

      const isJpTourist = resolvedVisaType === "JP_TOURIST";

      if (!isJpTourist) {
        // Standard automated-submission countries enqueue a job for the
        // submission-service worker to drive the per-country portal.
        const { error: queueError } = await supabase.from("submission_queue").insert({
          application_id: applicationId,
          status: queueStatusForPackage(resolvedVisaType),
          attempts: 0,
          created_at: new Date().toISOString(),
        });
        if (queueError) throw new Error(queueError.message);
      }

      const submittedAt = new Date().toISOString();
      const { error: submitError } = await supabase.from("applications").update({
        status: "submitted",
        submitted_at: submittedAt,
        ...(!isJpTourist
          ? {
              submission_result_status: "waiting",
              submission_result_updated_at: submittedAt,
            }
          : {}),
      }).eq("id", applicationId);
      if (submitError) throw new Error(submitError.message);

      if (isJpTourist) {
        // JP_TOURIST has no automation pipeline. Synthesize the terminal
        // result client-side so the StatusStep can render JpResultCard with
        // the MOFA Form A download CTA.
        setAppState((prev) => ({
          ...prev,
          submittedAt: new Date().toISOString(),
          submissionResultStatus: "form_ready_for_agency",
          submissionResult: {
            country: "JP",
            status: "form_ready_for_agency",
            applicationId,
            formAPdfUrl: `/api/applications/${applicationId}/jp-form-a-pdf`,
          },
        }));
      } else {
        setAppState((prev) => ({
          ...prev,
          submittedAt,
          submissionResultStatus: "waiting",
        }));
      }
      const completionPosition = getVisibleStepIndex(effectiveSteps, showTeamStep ? teamStepIndex : reviewStepIndex);
      setCompletedUpTo((c) => Math.max(c, completionPosition + 1));
      setCurrentStep(statusStepIndex);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.failedToSubmit"));
    } finally {
      setSaving(false);
    }
  };

  const handleReviewComplete = async () => {
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      let applicationId = appState.applicationId;
      if (!explicitApplicationId) {
        const result = await ensureDraftApplication(resolvedCountry, resolvedVisaType, {
          preferExplicit: preferExplicitPackage,
        });
        if (result.error) throw new Error(result.error);
        applicationId = result.applicationId!;
        setAppState((prev) => ({ ...prev, applicationId }));
      }
      if (!applicationId) throw new Error(t("errors.noApplicationFound"));

      await saveAllDynamicDrafts();

      // Persist the complete DS-160 answer set from hardcoded steps
      const normalizeResult = await persistDS160AnswerSet(
        applicationId,
        appState.personal,
        appState.passport,
        appState.travel,
      );
      if (normalizeResult.error) throw new Error(normalizeResult.error);

      const { error: queueError } = await supabase.from("submission_queue").insert({
        application_id: applicationId,
        status: queueStatusForPackage(resolvedVisaType),
        attempts: 0,
        created_at: new Date().toISOString(),
      });
      if (queueError) throw new Error(queueError.message);

      const submittedAt = new Date().toISOString();
      const { error: submitError } = await supabase.from("applications").update({
        status: "submitted",
        submitted_at: submittedAt,
        submission_result_status: "waiting",
        submission_result_updated_at: submittedAt,
      }).eq("id", applicationId);
      if (submitError) throw new Error(submitError.message);

      setAppState((prev) => ({
        ...prev,
        submittedAt,
        submissionResultStatus: "waiting",
      }));
      setCompletedUpTo((c) => Math.max(c, fallbackStatusStepIndex));
      setCurrentStep(fallbackStatusStepIndex);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.failedToSubmit"));
    } finally {
      setSaving(false);
    }
  };

  const activeCountry = resolvedCountry;
  const activeVisaType = resolvedVisaType;
  const teamReturnToParams = new URLSearchParams({
    step: "team",
    country: activeCountry,
    visaType: activeVisaType,
  });
  if (appState.applicationId) {
    teamReturnToParams.set("applicationId", appState.applicationId);
  }
  const teamReturnTo = `/client/application/long-form?${teamReturnToParams.toString()}`;
  const initialTeamNotice = teamNotice === "companion_added"
    ? { tone: "success" as const, message: t("team.addedSuccess") }
    : null;

  const ensurePassportOcrApplication = useCallback(async () => {
    if (appState.applicationId) return appState.applicationId;
    const result = await ensureDraftApplication(activeCountry, activeVisaType, {
      preferExplicit: preferExplicitPackage,
    });
    if (result.error || !result.applicationId) {
      setError(result.error ?? t("errors.noApplicationFound"));
      return null;
    }
    setAppState((prev) => ({ ...prev, applicationId: result.applicationId ?? prev.applicationId }));
    return result.applicationId;
  }, [activeCountry, activeVisaType, appState.applicationId, preferExplicitPackage, t]);

  useEffect(() => {
    if (loading || !packageLoaded || appState.applicationId) return;
    void ensurePassportOcrApplication();
  }, [appState.applicationId, ensurePassportOcrApplication, loading, packageLoaded]);

  useEffect(() => {
    const applicationId = appState.applicationId;
    if (loading || !packageLoaded || !applicationId) return;

    let cancelled = false;
    setDocumentCenterData((current) =>
      current?.selectedApplication?.id === applicationId ? current : null
    );
    setDocumentCenterError(null);

    loadDocumentCenterData({
      applicationId,
      country: resolvedCountry,
      visaType: resolvedVisaType,
    })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setDocumentCenterData(result.data);
          setDocumentCenterError(null);
        } else {
          setDocumentCenterData(null);
          setDocumentCenterError(result.error);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setDocumentCenterData(null);
          setDocumentCenterError(err instanceof Error ? err.message : t("errors.failedToSave"));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [appState.applicationId, loading, packageLoaded, resolvedCountry, resolvedVisaType, t]);

  const handlePassportOcrFieldsApplied = useCallback((fields: UniversalProfileSnapshot) => {
    const answerPatch = buildUniversalProfileAnswerPatch(fields);
    const { givenNames, surname } = splitUniversalFullName(fields.full_name);

    setDynamicAnswers((prev) => ({ ...prev, ...answerPatch }));
    setAppState((prev) => ({
      ...prev,
      personal: {
        ...prev.personal,
        givenNames: givenNames || prev.personal.givenNames,
        surname: surname || prev.personal.surname,
        dateOfBirth: fields.date_of_birth ?? prev.personal.dateOfBirth,
        sex: fields.gender ?? prev.personal.sex,
        nationality: fields.nationality ?? prev.personal.nationality,
      },
      passport: {
        ...prev.passport,
        passportNumber: fields.passport_number ?? prev.passport.passportNumber,
        passportIssuingCountry: fields.passport_issuing_country ?? prev.passport.passportIssuingCountry,
        passportIssuanceDate: fields.passport_issue_date ?? prev.passport.passportIssuanceDate,
        passportExpirationDate: fields.passport_expiry_date ?? prev.passport.passportExpirationDate,
      },
    }));
  }, []);

  if (loading || !packageLoaded) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#03346E]" />
      </div>
    );
  }

  const hasResolvedPackage = Boolean(explicitCountry || explicitVisaType || visaPackage);
  const pageTitle = hasResolvedPackage
    ? getVisaPackageTitle(resolvedCountry, resolvedVisaType, locale)
    : t("title");
  const isDocumentsStep = currentStep === (useDynamic ? documentStepIndex : 3);

  return (
    <div className="flex min-h-screen pt-3 lg:h-[calc(100dvh-8rem)] lg:min-h-0 lg:overflow-hidden lg:overscroll-none">
      {/* Left sidebar - desktop only */}
      {useDynamic ? (
        <GroupedStepSidebar
          sections={groupedSections}
          steps={effectiveSteps}
          currentStep={currentStep}
          completedUpTo={completedUpTo}
          onStepClick={handleStepNavigation}
        />
      ) : (
        <VerticalStepSidebar steps={effectiveSteps} currentStep={currentStep} completedUpTo={completedUpTo} onStepClick={handleStepNavigation} />
      )}

      {/* Main content area */}
      <main className="min-w-0 flex-1 bg-[#fcfcfc] p-4 sm:p-6 md:p-8 lg:-mt-5 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain">
        <div
          className={cn(
            "mx-auto max-w-xl sm:max-w-2xl",
            isDocumentsStep ? "md:max-w-5xl" : "md:max-w-3xl"
          )}
        >
          {/* Mobile step indicator */}
          {useDynamic ? (
            <GroupedMobileStepBar
              sections={groupedSections}
              steps={effectiveSteps}
              currentStep={currentStep}
              completedUpTo={completedUpTo}
              onStepClick={handleStepNavigation}
            />
          ) : (
            <MobileStepBar steps={effectiveSteps} currentStep={currentStep} completedUpTo={completedUpTo} onStepClick={handleStepNavigation} />
          )}

          {/* Page header */}
          <div className="mb-8 sm:mb-12">
            <h1 className="font-heading font-medium leading-[1.15] text-[28px] tracking-[-1px] text-[#3d3d3d] sm:text-[34px] sm:tracking-[-1.2px] lg:text-[40px] lg:tracking-[-1.6px]">
              {pageTitle}
            </h1>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm mb-6">
              {error}
            </div>
          )}

          {saving && (
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
              <Loader2 className="h-4 w-4 animate-spin text-[#03346E]" /> {t("saving")}
            </div>
          )}

          {/* Step cards */}
          <div className="flex flex-col gap-6 sm:gap-8 md:gap-10">
            {effectiveSteps.map((step) => {
              const isActive = step.id === currentStep;

              // Only render the active step — hide all others
              if (!isActive) return null;

              return (
                <div key={step.id} className="flex flex-col gap-4">
                  {/* Section heading - outside the panel */}
                  <h2 className="font-heading text-[20px] sm:text-[24px] md:text-[28px] font-medium text-[#3d3d3d] tracking-[-0.5px] sm:tracking-[-0.7px]">
                    {step.name}
                  </h2>
                  {/* Panel card */}
                  <div className="w-full rounded-xl border border-[#efefef] bg-white p-4 sm:p-6 md:p-8">
                    {step.id === firstFormStepId && (
                      <PassportOcrUpload
                        applicationId={appState.applicationId}
                        className="mb-6"
                        initialFileName={passportOcrInitialFileName}
                        initialUploaded={passportOcrInitialUploaded}
                        onFieldsApplied={handlePassportOcrFieldsApplied}
                        onUploaded={setLocalPassportBioPageName}
                      />
                    )}
                    {useDynamic ? (
                      /* Dynamic DB-driven form + photo/review/status steps */
                      <>
                        {/* DB-driven form steps */}
                        {step.id < documentStepIndex && dbSteps[step.id] && (
                          <DynamicStepForm
                            key={step.id}
                            step={dbSteps[step.id]}
                            prefill={dynamicAnswers}
                            onComplete={(data) => handleDynamicStepComplete(step.id, data)}
                            onDraftChange={(data) => handleDynamicDraftChange(step.id, data)}
                            saving={saving}
                          />
                        )}

                        {/* Supporting documents step */}
                        {step.id === documentStepIndex && (
                          appState.applicationId ? (
                            <DocumentCenterClient
                              initialData={documentCenterData}
                              initialError={documentCenterError}
                              applicationId={appState.applicationId}
                              country={activeCountry}
                              visaType={activeVisaType}
                              embedded
                              onContinue={handleDynamicDocumentsContinue}
                              continueLabel={t("dynamicButtons.continue")}
                            />
                          ) : (
                            <div className="flex min-h-[240px] items-center justify-center">
                              <Loader2 className="h-8 w-8 animate-spin text-[#03346E]" />
                            </div>
                          )
                        )}

                        {/* Dynamic review step */}
                        {step.id === reviewStepIndex && appState.applicationId && (
                          <DynamicReviewStep
                            applicationId={appState.applicationId}
                            dynamicAnswers={dynamicAnswers}
                            dbSteps={dbSteps}
                            photoPath={appState.photo}
                            onEdit={(stepIdx) => setCurrentStep(stepIdx)}
                            onPhotoEdit={() => setCurrentStep(documentStepIndex)}
                            onComplete={isCompanionFlow ? handleCompanionReviewComplete : handleReviewContinueToTeam}
                            mode="continue"
                            continueLabel={
                              isCompanionFlow
                                ? t("team.confirmCompanion")
                                : t("team.continueToTeam")
                            }
                          />
                        )}

                        {/* Team management and final submit step */}
                        {step.id === teamStepIndex && showTeamStep && (
                          <TeamStep
                            applicationId={appState.applicationId}
                            country={activeCountry}
                            visaType={activeVisaType}
                            returnTo={teamReturnTo}
                            submitLabel={t("team.finalSubmit")}
                            submitting={saving}
                            onSubmit={handleDynamicReviewComplete}
                            initialNotice={initialTeamNotice ?? undefined}
                          />
                        )}

                        {/* Status/confirmation step */}
                        {step.id === statusStepIndex && appState.submittedAt && (
                          <SubmissionStatusStep
                            applicationId={appState.applicationId}
                            status={appState.submissionResultStatus}
                            result={appState.submissionResult}
                          />
                        )}
                      </>
                    ) : (
                      /* Hardcoded B211A steps */
                      <>
                        {step.id === 0 && (
                          <PersonalInfoStep
                            country={activeCountry}
                            visaType={activeVisaType}
                            prefill={appState.personal}
                            onComplete={handlePersonalComplete}
                          />
                        )}
                        {step.id === 1 && (
                          <PassportStep
                            country={activeCountry}
                            visaType={activeVisaType}
                            prefill={appState.passport}
                            onComplete={handlePassportComplete}
                          />
                        )}
                        {step.id === 2 && (
                          <TravelInfoStep
                            country={activeCountry}
                            visaType={activeVisaType}
                            prefill={appState.travel}
                            onComplete={handleTravelComplete}
                          />
                        )}
                        {step.id === 3 && (
                          appState.applicationId ? (
                            <DocumentCenterClient
                              initialData={documentCenterData}
                              initialError={documentCenterError}
                              applicationId={appState.applicationId}
                              country={activeCountry}
                              visaType={activeVisaType}
                              embedded
                              onContinue={handleFallbackDocumentsContinue}
                              continueLabel={t("dynamicButtons.continue")}
                            />
                          ) : (
                            <div className="flex min-h-[240px] items-center justify-center">
                              <Loader2 className="h-8 w-8 animate-spin text-[#03346E]" />
                            </div>
                          )
                        )}
                        {step.id === 4 && (
                          <ReviewStep
                            applicationId={appState.applicationId ?? ""}
                            data={appState}
                            onEdit={(section) => {
                              const sectionMap: Record<string, number> = {
                                personal: 0, passport: 1, travel: 2, documents: 3,
                              };
                              setCurrentStep(sectionMap[section] ?? 0);
                            }}
                            onComplete={isCompanionFlow ? handleCompanionReviewComplete : handleReviewContinueToTeam}
                            mode="continue"
                            continueLabel={
                              isCompanionFlow
                                ? t("team.confirmCompanion")
                                : t("team.continueToTeam")
                            }
                          />
                        )}
                        {step.id === fallbackTeamStepIndex && showTeamStep && (
                          <TeamStep
                            applicationId={appState.applicationId}
                            country={activeCountry}
                            visaType={activeVisaType}
                            returnTo={teamReturnTo}
                            submitLabel={t("team.finalSubmit")}
                            submitting={saving}
                            onSubmit={handleReviewComplete}
                            initialNotice={initialTeamNotice ?? undefined}
                          />
                        )}
                        {step.id === fallbackStatusStepIndex && appState.submittedAt && (
                          <SubmissionStatusStep
                            applicationId={appState.applicationId}
                            status={appState.submissionResultStatus}
                            result={appState.submissionResult}
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}



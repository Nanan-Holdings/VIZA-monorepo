"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Loader2, Check, ChevronDown, PlayCircle, ShieldCheck } from "lucide-react";
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
import { SmoothProgressBar } from "@/components/smooth-progress";
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
import {
  computeAllTabCompletion,
  getContiguousCompletedCount,
  type MissingApplicationField,
} from "@/lib/application-tab-completion";
import {
  buildApplicationStepSections,
  getDynamicStepTranslationCandidates,
  type ApplicationStepSection,
  type ApplicationStepSectionKey,
} from "@/lib/application-step-sections";
import {
  isDs160VisaType,
  isFranceVisasVisaType,
  isSgArrivalCardApplication,
  isVietnamEVisaApplication,
  queueProviderForApplication,
  queueStatusForApplication,
  submissionQueueRequiresServerEnqueue,
  type SubmissionMode,
} from "@/lib/submission-queue";

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

const DS160_LIVE_ASSISTED_ENABLED =
  process.env.NEXT_PUBLIC_DS160_LIVE_ASSISTED_ENABLED === "true" &&
  process.env.NEXT_PUBLIC_DS160_SUBMISSION_MODE === "live_assisted";

const FRANCE_LIVE_ASSISTED_ENABLED =
  process.env.NEXT_PUBLIC_FRANCE_LIVE_SUBMISSION_ENABLED === "true" &&
  process.env.NEXT_PUBLIC_FRANCE_SUBMISSION_MODE === "live_assisted";

const VN_LIVE_ASSISTED_ENABLED =
  process.env.NEXT_PUBLIC_VN_LIVE_SUBMISSION_ENABLED === "true" &&
  process.env.NEXT_PUBLIC_VN_SUBMISSION_MODE === "live_assisted";

const SGAC_LIVE_ASSISTED_ENABLED =
  process.env.NEXT_PUBLIC_SGAC_LIVE_SUBMISSION_ENABLED !== "false";

type LiveAssistedTarget = "ds160" | "france" | "vietnam" | "sgac" | null;

interface VisibleDynamicStep {
  step: WizardStep;
  sourceIndex: number;
}

const SGAC_DYNAMIC_STEP_NAME_ZH: Record<string, string> = {
  "Traveller Information": "旅客信息",
  "Passport Details": "护照信息",
  "Trip to Singapore": "新加坡行程",
  "Contact and Stay in Singapore": "在新加坡联系方式与住宿",
  "Electronic Health Declaration": "电子健康申报",
  "Official Submission Checklist": "官方提交确认",
};

type StepSectionKey = ApplicationStepSectionKey;
type StepSectionDef = ApplicationStepSection<StepDef>;

function collectDraftAnswers(drafts: Record<number, Record<string, string>>): Record<string, string> {
  return Object.values(drafts).reduce<Record<string, string>>(
    (acc, stepDraft) => ({ ...acc, ...stepDraft }),
    {},
  );
}

const STEP_KEYS = ["personalInfo", "passport", "travelDetails", "documents", "review", "team", "status"] as const;

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

function localizeDynamicStepName(
  stepName: string,
  options: {
    isZhInterface: boolean;
    visaType?: string | null;
    translate: ReturnType<typeof useTranslations>;
  },
): string {
  if (options.isZhInterface && options.visaType === "SG_ARRIVAL_CARD") {
    return SGAC_DYNAMIC_STEP_NAME_ZH[stepName] ?? stepName;
  }

  const translationKey = getDynamicStepTranslationCandidates(stepName)
    .find((key) => options.translate.has(key as never));
  return translationKey ? options.translate(translationKey as never) : stepName;
}

// ---------------------------------------------------------------------------
// Vertical step sidebar
// ---------------------------------------------------------------------------

function VerticalStepSidebar({
  steps,
  currentStep,
  completedStepIds,
  onStepClick,
}: {
  steps: StepDef[];
  currentStep: number;
  completedStepIds: ReadonlySet<number>;
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
            completedStepIds.has(step.id) ? "complete" : i === activeStepIndex ? "in_progress" : "locked";
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
  completedStepIds,
  onStepClick,
}: {
  steps: StepDef[];
  currentStep: number;
  completedStepIds: ReadonlySet<number>;
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
            completedStepIds.has(step.id) ? "complete" : i === activeStepIndex ? "in_progress" : "locked";
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
                    completedStepIds.has(step.id) ? "bg-[#03346E]" : "bg-gray-200"
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
  completedStepIds,
  onStepClick,
}: {
  sections: StepSectionDef[];
  steps: StepDef[];
  currentStep: number;
  completedStepIds: ReadonlySet<number>;
  onStepClick: StepClickHandler;
}) {
  const currentStepIndexById = useMemo(() => new Map(steps.map((step, index) => [step.id, index])), [steps]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const getStatus = useCallback((stepId: number): StepStatus => {
    return completedStepIds.has(stepId) ? "complete" : stepId === currentStep ? "in_progress" : "locked";
  }, [completedStepIds, currentStep]);

  useEffect(() => {
    setExpandedSections((prev) => {
      const next = { ...prev };
      for (const section of sections) {
        if (next[section.id] === undefined) {
          next[section.id] = section.steps.some((step) => step.id === currentStep);
        }
      }
      return next;
    });
  }, [sections, currentStep]);

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !(prev[sectionId] ?? false),
    }));
  }, []);

  return (
    <aside className="w-[380px] shrink-0 pl-4 pr-4 pt-9 hidden lg:flex lg:flex-col z-10 overflow-y-auto">
      <div className="space-y-3">
        {sections.map((section) => {
          if (section.steps.length === 1) {
            const step = section.steps[0];
            const stepIndex = currentStepIndexById.get(step.id) ?? 0;
            const status = getStatus(step.id);
            const isSelected = step.id === currentStep;

            return (
              <button
                type="button"
                key={section.id}
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
          const isExpanded = expandedSections[section.id] ?? activeInSection;
          const firstIndex = currentStepIndexById.get(section.steps[0].id) ?? 0;
          const completedCount = section.steps.filter((step) => {
            return completedStepIds.has(step.id);
          }).length;
          const sectionComplete = completedCount === section.steps.length;

          return (
            <section
              key={section.id}
              className={cn(
                "rounded-xl border bg-white overflow-hidden transition-all duration-200",
                activeInSection
                  ? "ring-[1.5px] ring-[#03346E] border-[#03346E] shadow-[0_2px_12px_rgba(3,52,110,0.08)]"
                  : "border-[#efefef] hover:border-gray-300 hover:shadow-sm"
              )}
            >
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
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
                      const status = getStatus(step.id);
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
  completedStepIds,
  onStepClick,
}: {
  sections: StepSectionDef[];
  steps: StepDef[];
  currentStep: number;
  completedStepIds: ReadonlySet<number>;
  onStepClick: StepClickHandler;
}) {
  const currentStepIndexById = useMemo(() => new Map(steps.map((step, index) => [step.id, index])), [steps]);
  const currentStepIndex = currentStepIndexById.get(currentStep);
  const currentSection = sections.find((section) => section.steps.some((step) => step.id === currentStep));
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const getStatus = useCallback((stepId: number): StepStatus => {
    return completedStepIds.has(stepId) ? "complete" : stepId === currentStep ? "in_progress" : "locked";
  }, [completedStepIds, currentStep]);
  const completedStepCount = steps.filter((step) => completedStepIds.has(step.id)).length;
  const progressPercent = Math.min(100, (completedStepCount / Math.max(steps.length, 1)) * 100);

  useEffect(() => {
    setExpandedSections((prev) => {
      const next = { ...prev };
      for (const section of sections) {
        if (next[section.id] === undefined) {
          next[section.id] = section.steps.some((step) => step.id === currentStep);
        }
      }
      return next;
    });
  }, [sections, currentStep]);

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !(prev[sectionId] ?? false),
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
        <SmoothProgressBar
          displayedProgress={progressPercent}
          showValue={false}
          className="mt-3"
          trackClassName="bg-gray-100"
          barClassName="bg-[#03346E]"
          size="xs"
        />
      </div>

      <div className="space-y-3">
        {sections.map((section) => {
          if (section.steps.length === 1) {
            const step = section.steps[0];
            const stepIndex = currentStepIndexById.get(step.id) ?? 0;
            const status = getStatus(step.id);

            return (
              <button
                key={section.id}
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
          const isExpanded = expandedSections[section.id] ?? activeInSection;
          const firstIndex = currentStepIndexById.get(section.steps[0].id) ?? 0;
          const completedCount = section.steps.filter((step) => {
            return completedStepIds.has(step.id);
          }).length;
          const sectionComplete = completedCount === section.steps.length;

          return (
            <section
              key={section.id}
              className={cn(
                "rounded-xl border bg-white overflow-hidden transition-all duration-200",
                activeInSection
                  ? "ring-[1.5px] ring-[#03346E] border-[#03346E] shadow-[0_2px_12px_rgba(3,52,110,0.08)]"
                  : "border-[#efefef] active:bg-gray-50"
              )}
            >
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
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
                      const status = getStatus(step.id);
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

function FinalConfirmationPanel({
  isZh,
  liveAssistedTarget,
  liveAssistedEnabled,
  missingFields,
  requirementsLoading,
  submittingMode,
  onEdit,
  onSubmit,
}: {
  isZh: boolean;
  liveAssistedTarget: LiveAssistedTarget;
  liveAssistedEnabled: boolean;
  missingFields: MissingApplicationField[];
  requirementsLoading: boolean;
  submittingMode: SubmissionMode | null;
  onEdit: StepClickHandler;
  onSubmit: (mode: SubmissionMode) => void | Promise<void>;
}) {
  const [showLiveConsent, setShowLiveConsent] = useState(false);
  const [liveConsentChecked, setLiveConsentChecked] = useState(false);
  const groupedMissing = useMemo(() => {
    const groups = new Map<number, { stepName: string; fields: MissingApplicationField[] }>();
    for (const item of missingFields) {
      const existing = groups.get(item.stepId);
      if (existing) {
        existing.fields.push(item);
      } else {
        groups.set(item.stepId, { stepName: item.stepName, fields: [item] });
      }
    }
    return Array.from(groups.entries()).map(([stepId, group]) => ({ stepId, ...group }));
  }, [missingFields]);

  const hasMissing = missingFields.length > 0;
  const isSubmitting = submittingMode !== null;
  const baseDisabled = isSubmitting || hasMissing || requirementsLoading;
  const hasLiveAssistedTarget = liveAssistedTarget !== null;
  const isFrance = liveAssistedTarget === "france";
  const isVietnam = liveAssistedTarget === "vietnam";
  const isSgac = liveAssistedTarget === "sgac";
  const liveDisabled = baseDisabled || !liveAssistedEnabled || !hasLiveAssistedTarget;
  const liveDisabledReason = !hasLiveAssistedTarget
    ? (isZh ? "当前表单暂不支持 live assisted 官网辅助填写。" : "This form does not support live assisted official-site fill yet.")
    : !liveAssistedEnabled
      ? isFrance
        ? (isZh
            ? "本地 France live assisted 环境未启用。请确认 FRANCE_LIVE_SUBMISSION_ENABLED 和 FRANCE_SUBMISSION_MODE。"
            : "France live assisted is not enabled locally. Check FRANCE_LIVE_SUBMISSION_ENABLED and FRANCE_SUBMISSION_MODE.")
        : isVietnam
          ? (isZh
              ? "本地 Vietnam live assisted 环境未启用。请确认 VN_LIVE_SUBMISSION_ENABLED 和 VN_SUBMISSION_MODE。"
              : "Vietnam live assisted is not enabled locally. Check VN_LIVE_SUBMISSION_ENABLED and VN_SUBMISSION_MODE.")
          : isSgac
            ? (isZh
                ? "本地 SG Arrival Card live handoff 已关闭。请确认 SGAC_LIVE_SUBMISSION_ENABLED。"
                : "SG Arrival Card live handoff is disabled locally. Check SGAC_LIVE_SUBMISSION_ENABLED.")
        : (isZh
            ? "本地 DS-160 live assisted 环境未启用。请确认前端和 submission service 的 DS160 配置。"
            : "DS-160 live assisted is not enabled locally. Check the frontend and submission service DS160 settings.")
      : null;

  const dryRunLabel = hasLiveAssistedTarget
    ? (isZh ? "Dry-run 测试提交" : "Dry-run test submission")
    : (isZh ? "确认并提交申请" : "Confirm and submit application");
  const liveLabel = isFrance
    ? (isZh ? "Live assisted 官网辅助填写" : "Live assisted France-Visas fill")
    : isVietnam
      ? (isZh ? "Live assisted 越南官网辅助填写" : "Live assisted Vietnam e-Visa fill")
      : isSgac
        ? (isZh ? "继续 SG Arrival Card 官方提交" : "Continue SG Arrival Card submission")
      : (isZh ? "Live assisted 官网辅助填写" : "Live assisted CEAC fill");
  const liveSafetyCopy = isFrance
    ? (isZh
        ? "真实辅助填写会打开 France-Visas 官方流程；如需注册账号，VIZA 会使用专属邮箱 alias，并经你授权用 2captcha 处理注册页图片验证码。登录风控、官网页面核对、最终确认、支付和预约仍需人工处理。VIZA 不会自动最终提交、付款或预约。"
        : "Live assisted mode opens the France-Visas official flow. If account registration is needed, VIZA uses a dedicated email alias and, with your authorization, 2captcha for the registration image CAPTCHA. Login risk checks, official-page review, final validation, payment, and appointment booking remain manual. VIZA will not silently submit, pay, or book.")
    : isVietnam
      ? (isZh
          ? "真实辅助填写会打开越南 e-Visa 官方网站；NOTE 提示、验证码、付款和最终提交都必须由本人处理。VIZA 不会绕过验证码，也不会自动付款或点击最终提交。"
          : "Live assisted mode opens the official Vietnam e-Visa website. NOTE prompts, CAPTCHA, payment, and final submit remain manual. VIZA will not bypass CAPTCHA, pay, or click the final submit.")
      : isSgac
        ? (isZh
            ? "提交后会创建 SG Arrival Card 官方提交任务；页面会显示正在提交，后端成功提交后会展示 submitted=true、确认/参考号和 ICA 响应摘要。"
            : "Submitting creates an SG Arrival Card official-submission task. This page shows the submission in progress and, when the backend succeeds, displays submitted=true, the confirmation/reference number, and the ICA response summary.")
      : (isZh
          ? "真实辅助填写会打开 CEAC 官网流程；验证码、官网页面核对，以及最终 Sign/Submit 必须由本人完成。VIZA 不会自动点击最终提交。"
          : "Live assisted mode opens the CEAC flow. CAPTCHA, official-page review, and the final Sign/Submit step must be completed by you. VIZA will not click the final official submit button.");
  const liveConsentTitle = isFrance
    ? (isZh ? "确认启动 France-Visas 官网辅助填写" : "Confirm live assisted France-Visas fill")
    : isVietnam
      ? (isZh ? "确认启动越南 e-Visa 官网辅助填写" : "Confirm live assisted Vietnam e-Visa fill")
      : isSgac
        ? (isZh ? "确认继续 SG Arrival Card 官方提交" : "Confirm SG Arrival Card official submission")
      : (isZh ? "确认启动真实官网辅助填写" : "Confirm live assisted CEAC fill");
  const liveConsentDescription = isFrance
    ? (isZh
        ? "这会创建 live_assisted 队列任务并打开 France-Visas 官方网站，使用 VIZA 已保存答案辅助填写。若需要注册账号，VIZA 会用专属邮箱 alias 接收验证邮件，并用 2captcha 处理注册页图片验证码。登录风控、官网最终核对、支付、预约和任何线下递签/采集生物信息步骤都需要你本人处理。"
        : "This creates a live_assisted queue job and opens the official France-Visas website using your saved VIZA answers. If account registration is needed, VIZA uses a dedicated email alias for verification mail and 2captcha for the registration image CAPTCHA. Login risk checks, official final review, payment, appointment booking, and any in-person filing or biometrics remain manual.")
    : isVietnam
      ? (isZh
          ? "这会创建 live_assisted 队列任务并打开越南 e-Visa 官方网站，使用 VIZA 已保存答案辅助填写。NOTE 提示、验证码、付款和最终提交都需要你本人处理。"
          : "This creates a live_assisted queue job and opens the official Vietnam e-Visa website using your saved VIZA answers. NOTE prompts, CAPTCHA, payment, and final submit remain manual.")
      : isSgac
        ? (isZh
            ? "这会创建 SG Arrival Card live_assisted 队列任务，并用已保存的 SG_ARRIVAL_CARD 答案提交到 ICA SGAC。结果会返回 submitted、确认/参考号、官方响应摘要和错误详情。"
            : "This creates an SG Arrival Card live_assisted queue job and submits the saved SG_ARRIVAL_CARD answers to ICA SGAC. The result returns submitted status, confirmation/reference number, portal response summary, and error details.")
      : (isZh
          ? "这会创建 live_assisted 队列任务并打开 CEAC 官网填写流程。流程会在验证码、人工检查点或最终 Sign/Submit 前等待你本人操作。"
          : "This creates a live_assisted queue job and starts the CEAC fill flow. It will wait for you at CAPTCHA, manual checkpoints, or before the final Sign/Submit step.");
  const liveConsentCheckbox = isFrance
    ? (isZh
        ? "我确认这是本人授权的 France-Visas 官网辅助填写，并授权 VIZA 在注册账号时使用邮箱 alias 和 2captcha 处理注册页图片验证码；我知道 VIZA 不会自动最终验证、付款或预约。"
        : "I confirm this is my authorized France-Visas live assisted fill, and I authorize VIZA to use an email alias and 2captcha for the registration image CAPTCHA during account registration; I understand VIZA will not automatically validate, pay, or book an appointment.")
    : isVietnam
      ? (isZh
          ? "我确认这是本人授权的越南 e-Visa 官网辅助填写，并知道 VIZA 不会绕过验证码、自动付款或最终提交。"
          : "I confirm this is my authorized Vietnam e-Visa live assisted fill, and I understand VIZA will not bypass CAPTCHA, pay, or finally submit.")
      : isSgac
        ? (isZh
            ? "我确认这是本人授权的 SG Arrival Card 官方提交任务，并授权 VIZA 使用我保存的 SG_ARRIVAL_CARD 答案提交到 ICA SGAC。"
            : "I confirm this is my authorized SG Arrival Card official-submission task, and I authorize VIZA to submit my saved SG_ARRIVAL_CARD answers to ICA SGAC.")
      : (isZh
          ? "我确认这是本人授权的真实官网辅助填写，并知道最终官网提交仍需本人手动确认。"
          : "I confirm this is my authorized live assisted fill, and I understand the final official submission still requires my manual confirmation.");
  const liveStartLabel = isFrance
    ? (isZh ? "启动 France-Visas 辅助填写" : "Start live assisted fill")
    : isVietnam
      ? (isZh ? "启动越南 e-Visa 辅助填写" : "Start Vietnam e-Visa fill")
      : isSgac
        ? (isZh ? "继续 SGAC 官方提交" : "Continue SGAC submission")
      : (isZh ? "启动真实辅助填写" : "Start live assisted fill");

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#d7e6fb] bg-[#f2f7ff] p-5">
        <div className="flex gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#03346E]" />
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-[#0b2545]">
              {isZh ? "最终确认" : "Final confirmation"}
            </h3>
            <p className="text-sm leading-relaxed text-[#3d5878]">
              {hasMissing
                ? isZh
                  ? "提交前还需要补齐以下信息。请先编辑对应 tab，保存后再回到这里提交。"
                  : "Some information is still required. Edit the listed tabs, save, then return here to submit."
                : requirementsLoading
                  ? isZh
                    ? "正在检查支持材料和当前表单状态。完成后才可以提交。"
                    : "Checking supporting documents and current form status. You can submit once this finishes."
                : isZh
                  ? hasLiveAssistedTarget
                    ? "所有当前条件下必填的信息已经就绪。点击下方按钮后才会创建后台提交任务。当前表单可选择测试提交或真实官网辅助填写。"
                    : "所有当前条件下必填的信息已经就绪。点击下方按钮后才会创建后台提交任务。"
                  : hasLiveAssistedTarget
                    ? "All currently required information is ready. The background submission job is created only after you click below. This form can be started as a dry-run or live assisted official-site fill."
                    : "All currently required information is ready. The background submission job is created only after you click below."}
            </p>
          </div>
        </div>
      </div>

      {hasMissing && (
        <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-5">
          <h3 className="text-sm font-semibold text-red-800">
            {isZh ? "缺失信息清单" : "Missing information"}
          </h3>
          <div className="space-y-3">
            {groupedMissing.map((group) => (
              <div key={group.stepId} className="rounded-lg border border-red-100 bg-white p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-red-900">{group.stepName}</p>
                  <button
                    type="button"
                    className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-800 hover:bg-red-50"
                    onClick={() => {
                      void onEdit(group.stepId);
                    }}
                  >
                    {isZh ? "去编辑" : "Edit"}
                  </button>
                </div>
                <ul className="space-y-1 text-sm text-red-700">
                  {group.fields.map((item) => (
                    <li key={`${item.stepId}-${item.fieldName}`}>
                      {item.label}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={cn("grid gap-3", hasLiveAssistedTarget ? "lg:grid-cols-2" : "grid-cols-1")}>
        <button
          type="button"
          disabled={baseDisabled}
          onClick={() => {
            void onSubmit("dry_run");
          }}
          className={cn(
            "flex min-h-12 w-full items-center justify-center rounded-full border px-5 text-base font-semibold transition-colors",
            baseDisabled
              ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-500"
              : hasLiveAssistedTarget
                ? "border-brand-200 bg-white text-brand-500 shadow-sm hover:bg-brand-50"
                : "border-brand-500 bg-brand-500 text-white shadow-sm hover:bg-brand-600",
          )}
        >
          {requirementsLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isZh ? "正在检查" : "Checking"}
            </>
          ) : submittingMode === "dry_run" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isZh ? "正在提交" : "Submitting"}
            </>
          ) : (
            <>
              {hasLiveAssistedTarget && <PlayCircle className="mr-2 h-4 w-4" />}
              {dryRunLabel}
            </>
          )}
        </button>

        {hasLiveAssistedTarget && (
          <button
            type="button"
            disabled={liveDisabled}
            onClick={() => {
              setLiveConsentChecked(false);
              setShowLiveConsent(true);
            }}
            className={cn(
              "flex min-h-12 w-full items-center justify-center rounded-full px-5 text-base font-semibold transition-colors",
              liveDisabled
                ? "cursor-not-allowed bg-gray-200 text-gray-500"
                : "bg-brand-500 text-white shadow-sm hover:bg-brand-600",
            )}
            title={liveDisabledReason ?? undefined}
          >
            {submittingMode === "live_assisted" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isZh ? "正在启动" : "Starting"}
              </>
            ) : (
              <>
                <ShieldCheck className="mr-2 h-4 w-4" />
                {liveLabel}
              </>
            )}
          </button>
        )}
      </div>

      {hasLiveAssistedTarget && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
          {liveDisabledReason ?? liveSafetyCopy}
        </div>
      )}

      {showLiveConsent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-xl rounded-xl border border-input bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-brand-500" />
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-foreground">
                  {liveConsentTitle}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {liveConsentDescription}
                </p>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-input bg-muted/30 p-3 text-sm text-foreground">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-input"
                    checked={liveConsentChecked}
                    onChange={(event) => setLiveConsentChecked(event.target.checked)}
                  />
                  <span>
                    {liveConsentCheckbox}
                  </span>
                </label>
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="min-h-11 rounded-full border border-input px-5 text-sm font-semibold text-foreground hover:bg-muted"
                onClick={() => setShowLiveConsent(false)}
              >
                {isZh ? "取消" : "Cancel"}
              </button>
              <button
                type="button"
                disabled={!liveConsentChecked || isSubmitting}
                className={cn(
                  "min-h-11 rounded-full px-5 text-sm font-semibold transition-colors",
                  !liveConsentChecked || isSubmitting
                    ? "cursor-not-allowed bg-gray-200 text-gray-500"
                    : "bg-brand-500 text-white hover:bg-brand-600",
                )}
                onClick={() => {
                  setShowLiveConsent(false);
                  void onSubmit("live_assisted");
                }}
              >
                {submittingMode === "live_assisted"
                  ? (isZh ? "正在启动" : "Starting")
                  : liveStartLabel}
              </button>
            </div>
          </div>
        </div>
      )}
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

interface SubmissionQueueJobInput {
  applicationId: string;
  country: string;
  visaType: string;
  mode: SubmissionMode;
  createdAt: string;
}

function isMissingSubmissionModeColumnError(error: { message?: string; code?: string }): boolean {
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST204" ||
    message.includes("submission_queue.mode") ||
    message.includes("submission_queue.provider") ||
    message.includes("column submission_queue.mode does not exist") ||
    message.includes("column submission_queue.provider does not exist") ||
    message.includes("could not find the 'mode' column") ||
    message.includes("could not find the 'provider' column")
  );
}

async function insertSubmissionQueueJob(
  supabase: ReturnType<typeof createClient>,
  input: SubmissionQueueJobInput,
): Promise<void> {
  if (submissionQueueRequiresServerEnqueue(input.country, input.visaType, input.mode)) {
    const response = await fetch(`/api/applications/${input.applicationId}/retry-submission`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: input.mode,
        country: input.country,
        visaType: input.visaType,
      }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
      throw new Error(
        typeof payload?.error === "string"
          ? payload.error
          : `Submission queue creation failed with ${response.status}`,
      );
    }
    return;
  }

  const status = queueStatusForApplication(input.country, input.visaType, input.mode);
  const provider = queueProviderForApplication(input.country, input.visaType, input.mode);

  const enrichedPayload = {
    application_id: input.applicationId,
    status,
    mode: input.mode,
    provider,
    attempts: 0,
    created_at: input.createdAt,
  };

  const { error } = await supabase.from("submission_queue").insert(enrichedPayload);
  if (!error) return;

  const canUseLegacyPayload =
    isMissingSubmissionModeColumnError(error) &&
    (input.mode === "dry_run" ||
      status === "ds160_live_assisted_pending" ||
      status === "vn_live_assisted_pending");
  if (!canUseLegacyPayload) {
    throw new Error(error.message);
  }

  const { error: legacyError } = await supabase.from("submission_queue").insert({
    application_id: input.applicationId,
    status,
    attempts: 0,
    created_at: input.createdAt,
  });
  if (legacyError) throw new Error(legacyError.message);
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
  const jumpToConfirmation = ["confirmation", "confirm", "status"].includes(searchParams.get("step") ?? "");
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
        const country = explicitCountry ?? pkg?.country ?? null;
        return getVisaFormSteps(visaType, { country });
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
  }, [explicitCountry, explicitVisaType]);

  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [_completedUpTo, setCompletedUpTo] = useState(0);
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
  const [submittingMode, setSubmittingMode] = useState<SubmissionMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitMissingFields, setSubmitMissingFields] = useState<MissingApplicationField[]>([]);
  // Dynamic form answers keyed by field_name
  const [dynamicAnswers, setDynamicAnswers] = useState<Record<string, string>>({});
  const [draftVersion, setDraftVersion] = useState(0);
  const [documentCenterData, setDocumentCenterData] = useState<DocumentCenterData | null>(null);
  const [documentCenterError, setDocumentCenterError] = useState<string | null>(null);
  const [documentCenterLoaded, setDocumentCenterLoaded] = useState(false);
  const [localPassportBioPageName, setLocalPassportBioPageName] = useState<string | null>(null);
  const initialStepResolvedRef = useRef(false);
  const dynamicDraftRef = useRef<Record<number, Record<string, string>>>({});
  const navigationSaveInFlightRef = useRef(false);

  const handleDynamicDraftChange = useCallback((stepId: number, data: Record<string, string>) => {
    dynamicDraftRef.current[stepId] = data;
    setDraftVersion((version) => version + 1);
    setSubmitMissingFields([]);
  }, []);

  const resolvedCountry = explicitCountry ?? visaPackage?.country ?? "indonesia";
  const resolvedVisaType = explicitVisaType ?? visaPackage?.visa_type ?? "tourist_b211a";
  const isDs160Application = isDs160VisaType(resolvedVisaType);
  const normalizedCountryForLive = resolvedCountry.trim().toLowerCase();
  const isFranceSchengenApplication =
    isFranceVisasVisaType(resolvedVisaType) &&
    ["france", "fr", "法国"].includes(normalizedCountryForLive);
  const isVietnamEVisa = isVietnamEVisaApplication(resolvedCountry, resolvedVisaType);
  const isSgArrivalCard = isSgArrivalCardApplication(resolvedCountry, resolvedVisaType);
  const liveAssistedTarget: LiveAssistedTarget = isDs160Application
    ? "ds160"
    : isFranceSchengenApplication
      ? "france"
      : isVietnamEVisa
        ? "vietnam"
        : isSgArrivalCard
          ? "sgac"
        : null;
  const liveAssistedEnabled = liveAssistedTarget === "ds160"
    ? DS160_LIVE_ASSISTED_ENABLED
    : liveAssistedTarget === "france"
      ? FRANCE_LIVE_ASSISTED_ENABLED
      : liveAssistedTarget === "vietnam"
        ? VN_LIVE_ASSISTED_ENABLED
        : liveAssistedTarget === "sgac"
          ? SGAC_LIVE_ASSISTED_ENABLED
          : false;

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

  const pendingDynamicDrafts = useMemo(
    () => {
      void draftVersion;
      return collectDraftAnswers(dynamicDraftRef.current);
    },
    [draftVersion],
  );
  const dynamicAnswerSnapshot = useMemo(
    () => ({ ...dynamicAnswers, ...pendingDynamicDrafts }),
    [dynamicAnswers, pendingDynamicDrafts],
  );

  const visibleDynamicSteps = useMemo(
    () => (useDynamic ? getVisibleDynamicSteps(dbSteps, dynamicAnswerSnapshot) : []),
    [dbSteps, dynamicAnswerSnapshot, useDynamic],
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
          name: localizeDynamicStepName(step.stepName, {
            isZhInterface,
            visaType: resolvedVisaType,
            translate: tDyn,
          }),
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
      resolvedVisaType,
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
    () => (useDynamic ? buildApplicationStepSections(sourceOrderedSteps, dynamicSectionTitles) : []),
    [dynamicSectionTitles, sourceOrderedSteps, useDynamic],
  );

  // Final list of steps in display order: flattened from grouped sections so
  // the sidebar index matches navigation order. Falls back to source order
  // for the hardcoded (non-DB) flow.
  const effectiveSteps: StepDef[] = useDynamic
    ? groupedSections.flatMap((section) => section.steps)
    : sourceOrderedSteps;

  const tabCompletion = useMemo(
    () => computeAllTabCompletion({
      dbSteps,
      effectiveSteps,
      answers: dynamicAnswerSnapshot,
      documentCenterData,
      documentsLoaded: documentCenterLoaded,
      submittedAt: appState.submittedAt,
      submissionResultStatus: appState.submissionResultStatus,
      country: resolvedCountry,
      visaType: resolvedVisaType,
      documentStepId: documentStepIndex,
      reviewStepId: reviewStepIndex,
      teamStepId: teamStepIndex,
      confirmationStepId: statusStepIndex,
      showTeamStep,
    }),
    [
      appState.submissionResultStatus,
      appState.submittedAt,
      dbSteps,
      documentCenterData,
      documentCenterLoaded,
      documentStepIndex,
      dynamicAnswerSnapshot,
      effectiveSteps,
      resolvedCountry,
      resolvedVisaType,
      reviewStepIndex,
      showTeamStep,
      statusStepIndex,
      teamStepIndex,
    ],
  );
  const completedStepIds = useMemo(
    () => new Set(tabCompletion.completedStepIds),
    [tabCompletion.completedStepIds],
  );
  const visibleMissingFields = submitMissingFields.length > 0
    ? submitMissingFields
    : tabCompletion.missingFields;

  useEffect(() => {
    if (loading || effectiveSteps.length === 0) return;
    setCompletedUpTo(getContiguousCompletedCount(effectiveSteps, completedStepIds));
  }, [completedStepIds, effectiveSteps, loading]);

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
      const mergedDynamicAnswers = { ...ds160Answers };
      const profileFallback = application?.id ? null : profile;

      // Hydrate hardcoded steps from DS-160 answers first, falling back to profile/application
      const a = ds160Answers;
      setAppState((prev) => ({
        ...prev,
        applicationId: application?.id ?? null,
        personal: {
          surname: a.surname || profileFallback?.full_name?.split(" ").slice(-1)[0] || "",
          givenNames: a.given_names || profileFallback?.full_name?.split(" ").slice(0, -1).join(" ") || "",
          fullNameNativeAlphabet: a.full_name_native_alphabet || "",
          sex: a.sex || profileFallback?.gender || "",
          maritalStatus: a.marital_status || "",
          dateOfBirth: a.date_of_birth || profileFallback?.date_of_birth || "",
          cityOfBirth: a.city_of_birth || profileFallback?.place_of_birth || "",
          stateOfBirth: a.state_of_birth || "",
          countryOfBirth: a.country_of_birth || "",
          nationality: a.nationality_country || profileFallback?.nationality || "",
        },
        passport: {
          passportDocumentType: a.passport_document_type || "",
          passportNumber: a.passport_number || profileFallback?.passport_number || "",
          passportBookNumber: a.passport_book_number || "",
          passportIssuingCountry: a.passport_issuing_country || profileFallback?.passport_issuing_country || "",
          passportIssuanceCity: a.passport_issuance_city || "",
          passportIssuanceDate: a.passport_issuance_date || profileFallback?.passport_issue_date || "",
          passportExpirationDate: a.passport_expiration_date || profileFallback?.passport_expiry_date || "",
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

  // Honor deep links from redirects: once steps + any prefilled answers have
  // loaded, jump directly to the requested Review/Team/Confirmation step.
  const [reviewJumpHandled, setReviewJumpHandled] = useState(false);
  useEffect(() => {
    if ((!jumpToReview && !jumpToTeam && !jumpToConfirmation) || reviewJumpHandled || loading) return;
    const targetId = jumpToConfirmation
      ? (useDynamic
          ? (effectiveSteps.find((s) => s.sourceName === "Confirmation")?.id ?? statusStepIndex)
          : fallbackStatusStepIndex)
      : jumpToTeam && showTeamStep
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
    fallbackStatusStepIndex,
    fallbackTeamStepIndex,
    jumpToConfirmation,
    teamStepIndex,
    statusStepIndex,
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

  // US-040: Supabase Realtime — re-fetch application data on application UPDATE.
  // Universal Profile is a creation-time autofill source only, so profile
  // updates must not silently re-merge into an existing application.
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("application-page-realtime")
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
    const mergedDraft = collectDraftAnswers(dynamicDraftRef.current);
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
    setSubmitMissingFields([]);
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
      let applicationId = appState.applicationId;
      if (!applicationId) {
        const result = await ensureDraftApplication(resolvedCountry, resolvedVisaType, {
          preferExplicit: true,
        });
        if (result.error || !result.applicationId) {
          throw new Error(result.error ?? t("errors.noApplicationFound"));
        }
        applicationId = result.applicationId;
      }

      const answerPatch: Record<string, string> = {
        surname: data.surname,
        last_name: data.surname,
        family_name: data.surname,
        given_names: data.givenNames,
        givenNames: data.givenNames,
        given_name: data.givenNames,
        first_name: data.givenNames,
        full_name: `${data.givenNames} ${data.surname}`.trim(),
        fullName: `${data.givenNames} ${data.surname}`.trim(),
        date_of_birth: data.dateOfBirth,
        dob: data.dateOfBirth,
        birth_date: data.dateOfBirth,
        place_of_birth: data.cityOfBirth,
        city_of_birth: data.cityOfBirth,
        birth_city: data.cityOfBirth,
        gender: data.sex,
        sex: data.sex,
        nationality: data.nationality,
        nationality_country: data.nationality,
      };
      const saveResult = await saveDynamicAnswers(applicationId, answerPatch);
      if (saveResult.error) throw new Error(saveResult.error);

      setAppState((prev) => ({ ...prev, applicationId, personal: data }));
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
      let applicationId = appState.applicationId;
      if (!applicationId) {
        const result = await ensureDraftApplication(resolvedCountry, resolvedVisaType, {
          preferExplicit: true,
        });
        if (result.error || !result.applicationId) {
          throw new Error(result.error ?? t("errors.noApplicationFound"));
        }
        applicationId = result.applicationId;
      }

      const saveResult = await saveDynamicAnswers(applicationId, {
        passport_number: data.passportNumber,
        passportNumber: data.passportNumber,
        travel_document_number: data.passportNumber,
        passport_issue_date: data.passportIssuanceDate,
        passport_issuance_date: data.passportIssuanceDate,
        date_of_issue: data.passportIssuanceDate,
        passport_expiry_date: data.passportExpirationDate,
        passport_expiration_date: data.passportExpirationDate,
        valid_until: data.passportExpirationDate,
        passport_issuing_country: data.passportIssuingCountry,
        passport_issuance_country: data.passportIssuingCountry,
        passport_country_of_issue: data.passportIssuingCountry,
      });
      if (saveResult.error) throw new Error(saveResult.error);

      setAppState((prev) => ({ ...prev, applicationId, passport: data }));
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

      let applicationId = appState.applicationId;
      if (!applicationId) {
        const result = await ensureDraftApplication(resolvedCountry, resolvedVisaType, {
          preferExplicit: true,
        });
        if (result.error || !result.applicationId) {
          throw new Error(result.error ?? t("errors.noApplicationFound"));
        }
        applicationId = result.applicationId;
      }

      const { error: appError } = await supabase.from("applications").update({
        arrival_date: data.arrivalDate || null,
        departure_date: data.departureDate || null,
        port_of_entry: data.arrivalCity || null,
        purpose: data.purposeOfTrip || null,
        accommodation_name: data.accommodationName || null,
        accommodation_address: data.usAddressStreet1 || null,
      }).eq("id", applicationId);
      if (appError) throw appError;

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
      setSubmitMissingFields([]);
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
    setSubmitMissingFields([]);
    const documentStepPosition = getVisibleStepIndex(effectiveSteps, documentStepIndex);
    setCompletedUpTo((c) => Math.max(c, documentStepPosition + 1));
    setCurrentStep(reviewStepIndex);
  };

  const handleFallbackDocumentsContinue = () => {
    setSubmitMissingFields([]);
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

  const buildCurrentAnswerSnapshot = useCallback(
    () => ({ ...dynamicAnswers, ...collectDraftAnswers(dynamicDraftRef.current) }),
    [dynamicAnswers],
  );

  const getCurrentSubmitMissingFields = useCallback(
    (answers: Record<string, string>) => computeAllTabCompletion({
      dbSteps,
      effectiveSteps,
      answers,
      documentCenterData,
      documentsLoaded: documentCenterLoaded,
      submittedAt: appState.submittedAt,
      submissionResultStatus: appState.submissionResultStatus,
      country: resolvedCountry,
      visaType: resolvedVisaType,
      documentStepId: documentStepIndex,
      reviewStepId: reviewStepIndex,
      teamStepId: teamStepIndex,
      confirmationStepId: statusStepIndex,
      showTeamStep,
    }).missingFields,
    [
      appState.submissionResultStatus,
      appState.submittedAt,
      dbSteps,
      documentCenterData,
      documentCenterLoaded,
      documentStepIndex,
      effectiveSteps,
      resolvedCountry,
      resolvedVisaType,
      reviewStepIndex,
      showTeamStep,
      statusStepIndex,
      teamStepIndex,
    ],
  );

  const handleTeamConfirm = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSubmitMissingFields([]);
    try {
      await saveAllDynamicDrafts();
      const targetTeamStepIndex = useDynamic ? teamStepIndex : fallbackTeamStepIndex;
      const targetStatusStepIndex = useDynamic ? statusStepIndex : fallbackStatusStepIndex;
      const teamStepPosition = getVisibleStepIndex(effectiveSteps, targetTeamStepIndex);
      setCompletedUpTo((c) => Math.max(c, teamStepPosition + 1));
      setCurrentStep(targetStatusStepIndex);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.failedToSave"));
    } finally {
      setSaving(false);
    }
  }, [
    effectiveSteps,
    fallbackStatusStepIndex,
    fallbackTeamStepIndex,
    saveAllDynamicDrafts,
    statusStepIndex,
    t,
    teamStepIndex,
    useDynamic,
  ]);

  // ── Dynamic-mode review complete handler ────────────────────────────
  const handleDynamicReviewComplete = async (mode: SubmissionMode = "dry_run") => {
    setSaving(true);
    setSubmittingMode(mode);
    setError(null);
    try {
      if (mode === "live_assisted" && !liveAssistedTarget) {
        throw new Error(isZhInterface ? "当前表单暂不支持 live assisted 官网辅助填写。" : "This form does not support live assisted official-site fill yet.");
      }
      if (mode === "live_assisted" && !liveAssistedEnabled) {
        throw new Error(isZhInterface ? "本地 live assisted 环境未启用。" : "Live assisted mode is not enabled locally.");
      }
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
      const missing = getCurrentSubmitMissingFields(buildCurrentAnswerSnapshot());
      setSubmitMissingFields(missing);
      if (missing.length > 0) {
        setCurrentStep(statusStepIndex);
        setError(isZhInterface
          ? "请先补齐最终确认页列出的缺失信息。"
          : "Please complete the missing information listed on the final confirmation step.");
        return;
      }

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
        await insertSubmissionQueueJob(supabase, {
          applicationId,
          country: resolvedCountry,
          visaType: resolvedVisaType,
          mode,
          createdAt: new Date().toISOString(),
        });
      }

      const submittedAt = new Date().toISOString();
      const { error: submitError } = await supabase.from("applications").update({
        status: "submitted",
        submitted_at: submittedAt,
        ...(!isJpTourist
          ? {
              submission_result_status: "waiting",
              submission_result: null,
              confirmation_number: null,
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
          submissionResult: null,
          confirmationNumber: undefined,
        }));
      }
      setSubmitMissingFields([]);
      const completionPosition = getVisibleStepIndex(effectiveSteps, showTeamStep ? teamStepIndex : reviewStepIndex);
      setCompletedUpTo((c) => Math.max(c, completionPosition + 1));
      setCurrentStep(statusStepIndex);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.failedToSubmit"));
    } finally {
      setSaving(false);
      setSubmittingMode(null);
    }
  };

  const handleReviewComplete = async (mode: SubmissionMode = "dry_run") => {
    setSaving(true);
    setSubmittingMode(mode);
    setError(null);
    try {
      if (mode === "live_assisted" && !liveAssistedTarget) {
        throw new Error(isZhInterface ? "当前表单暂不支持 live assisted 官网辅助填写。" : "This form does not support live assisted official-site fill yet.");
      }
      if (mode === "live_assisted" && !liveAssistedEnabled) {
        throw new Error(isZhInterface ? "本地 live assisted 环境未启用。" : "Live assisted mode is not enabled locally.");
      }
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
      const missing = useDynamic
        ? getCurrentSubmitMissingFields(buildCurrentAnswerSnapshot())
        : [];
      setSubmitMissingFields(missing);
      if (missing.length > 0) {
        setCurrentStep(fallbackStatusStepIndex);
        setError(isZhInterface
          ? "请先补齐最终确认页列出的缺失信息。"
          : "Please complete the missing information listed on the final confirmation step.");
        return;
      }

      // Persist the complete DS-160 answer set from hardcoded steps
      const normalizeResult = await persistDS160AnswerSet(
        applicationId,
        appState.personal,
        appState.passport,
        appState.travel,
      );
      if (normalizeResult.error) throw new Error(normalizeResult.error);

      await insertSubmissionQueueJob(supabase, {
        applicationId,
        country: resolvedCountry,
        visaType: resolvedVisaType,
        mode,
        createdAt: new Date().toISOString(),
      });

      const submittedAt = new Date().toISOString();
      const { error: submitError } = await supabase.from("applications").update({
        status: "submitted",
        submitted_at: submittedAt,
        submission_result_status: "waiting",
        submission_result: null,
        confirmation_number: null,
        submission_result_updated_at: submittedAt,
      }).eq("id", applicationId);
      if (submitError) throw new Error(submitError.message);

      setAppState((prev) => ({
        ...prev,
        submittedAt,
        submissionResultStatus: "waiting",
        submissionResult: null,
        confirmationNumber: undefined,
      }));
      setSubmitMissingFields([]);
      setCompletedUpTo((c) => Math.max(c, fallbackStatusStepIndex));
      setCurrentStep(fallbackStatusStepIndex);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.failedToSubmit"));
    } finally {
      setSaving(false);
      setSubmittingMode(null);
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
    setDocumentCenterLoaded(false);

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
        setDocumentCenterLoaded(true);
      })
      .catch((err) => {
        if (!cancelled) {
          setDocumentCenterData(null);
          setDocumentCenterError(err instanceof Error ? err.message : t("errors.failedToSave"));
          setDocumentCenterLoaded(true);
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
          completedStepIds={completedStepIds}
          onStepClick={handleStepNavigation}
        />
      ) : (
        <VerticalStepSidebar steps={effectiveSteps} currentStep={currentStep} completedStepIds={completedStepIds} onStepClick={handleStepNavigation} />
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
              completedStepIds={completedStepIds}
              onStepClick={handleStepNavigation}
            />
          ) : (
            <MobileStepBar steps={effectiveSteps} currentStep={currentStep} completedStepIds={completedStepIds} onStepClick={handleStepNavigation} />
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
                            country={activeCountry}
                            visaType={activeVisaType}
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
                              onDataChange={setDocumentCenterData}
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
                            submitLabel={t.has("team.confirmTeam" as never) ? t("team.confirmTeam" as never) : isZhInterface ? "确认团队信息" : "Confirm team"}
                            submitting={saving}
                            onSubmit={handleTeamConfirm}
                            initialNotice={initialTeamNotice ?? undefined}
                          />
                        )}

                        {/* Status/confirmation step */}
                        {step.id === statusStepIndex && (
                          appState.submittedAt ? (
                            <SubmissionStatusStep
                              applicationId={appState.applicationId}
                              country={activeCountry}
                              visaType={activeVisaType}
                              status={appState.submissionResultStatus}
                              result={appState.submissionResult}
                            />
                          ) : (
                            <FinalConfirmationPanel
                              isZh={isZhInterface}
                              liveAssistedTarget={liveAssistedTarget}
                              liveAssistedEnabled={liveAssistedEnabled}
                              missingFields={visibleMissingFields}
                              requirementsLoading={!documentCenterLoaded && Boolean(appState.applicationId)}
                              submittingMode={saving ? submittingMode ?? "dry_run" : null}
                              onEdit={handleStepNavigation}
                              onSubmit={handleDynamicReviewComplete}
                            />
                          )
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
                              onDataChange={setDocumentCenterData}
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
                            submitLabel={t.has("team.confirmTeam" as never) ? t("team.confirmTeam" as never) : isZhInterface ? "确认团队信息" : "Confirm team"}
                            submitting={saving}
                            onSubmit={handleTeamConfirm}
                            initialNotice={initialTeamNotice ?? undefined}
                          />
                        )}
                        {step.id === fallbackStatusStepIndex && (
                          appState.submittedAt ? (
                            <SubmissionStatusStep
                              applicationId={appState.applicationId}
                              country={activeCountry}
                              visaType={activeVisaType}
                              status={appState.submissionResultStatus}
                              result={appState.submissionResult}
                            />
                          ) : (
                            <FinalConfirmationPanel
                              isZh={isZhInterface}
                              liveAssistedTarget={liveAssistedTarget}
                              liveAssistedEnabled={liveAssistedEnabled}
                              missingFields={visibleMissingFields}
                              requirementsLoading={!documentCenterLoaded && Boolean(appState.applicationId)}
                              submittingMode={saving ? submittingMode ?? "dry_run" : null}
                              onEdit={handleStepNavigation}
                              onSubmit={handleReviewComplete}
                            />
                          )
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



"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, CreditCard, Loader2, Check, ChevronDown, ShieldCheck } from "lucide-react";
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
  loadApplicationFormContext,
  loadDynamicAnswers,
} from "@/app/actions/visa-application-answers";
import { persistDS160AnswerSet } from "@/app/actions/ds160-normalize";
import { getFormVisaType, getVisaPackageTitle } from "@/lib/visa-destinations";
import type {
  SubmissionResult,
  SubmissionResultStatus,
} from "@/lib/submission-result";
import {
  buildMalaysiaMdacUniversalProfileAnswerPatch,
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
import {
  computeAllTabCompletion,
  getContiguousCompletedCount,
  type MissingApplicationField,
} from "@/lib/application-tab-completion";
import { shouldShowSubmissionStatusStep } from "@/lib/application-submission-display";
import {
  buildApplicationStepSections,
  getDynamicStepTranslationCandidates,
  type ApplicationStepSection,
  type ApplicationStepSectionKey,
} from "@/lib/application-step-sections";
import {
  isDs160VisaType,
  isDigitalArrivalCardApplication,
  isIndonesiaEVisaApplication,
  isMalaysiaMdacApplication,
  isFranceVisasVisaType,
  isPhilippinesEtravelApplication,
  isSgArrivalCardApplication,
  isThailandTdacApplication,
  isVietnamEVisaApplication,
  isVietnamPrearrivalApplication,
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

// Vietnam Pre-Arrival is a free declaration with its own runner, so it must
// not inherit the e-Visa payment-gated live configuration.
const VN_PREARRIVAL_LIVE_ASSISTED_ENABLED =
  process.env.NEXT_PUBLIC_VN_PREARRIVAL_LIVE_SUBMISSION_ENABLED !== "false";

const SGAC_LIVE_ASSISTED_ENABLED =
  process.env.NEXT_PUBLIC_SGAC_LIVE_SUBMISSION_ENABLED !== "false";

const MDAC_LIVE_ASSISTED_ENABLED =
  process.env.NEXT_PUBLIC_MDAC_LIVE_SUBMISSION_ENABLED !== "false";

const TDAC_LIVE_ASSISTED_ENABLED =
  process.env.NEXT_PUBLIC_TDAC_LIVE_SUBMISSION_ENABLED !== "false";

const PH_ETRAVEL_LIVE_ASSISTED_ENABLED =
  process.env.NEXT_PUBLIC_PH_ETRAVEL_LIVE_SUBMISSION_ENABLED !== "false";

const INDONESIA_LIVE_ASSISTED_ENABLED =
  process.env.NEXT_PUBLIC_INDONESIA_LIVE_SUBMISSION_ENABLED !== "false";

type LiveAssistedTarget =
  | "ds160"
  | "france"
  | "vietnam"
  | "vn_prearrival"
  | "sgac"
  | "mdac"
  | "tdac"
  | "phetravel"
  | "indonesia"
  | null;

interface VietnamOneTimePaymentCard {
  pan: string;
  expiry: string;
  cvv: string;
  holderName: string;
}

interface VisibleDynamicStep {
  step: WizardStep;
  sourceIndex: number;
}

const SGAC_DYNAMIC_STEP_NAME_ZH: Record<string, string> = {
  "Traveller Information": "旅客信息",
  "Trip Information": "行程信息",
  "Passport Details": "护照信息",
  "Trip to Singapore": "新加坡行程",
  "Contact and Stay in Singapore": "在新加坡联系方式与住宿",
  "Electronic Health Declaration": "电子健康申报",
  "Official Submission Checklist": "官方提交确认",
};

const ARRIVAL_CARD_DYNAMIC_STEP_NAME_ZH: Record<string, string> = {
  ...SGAC_DYNAMIC_STEP_NAME_ZH,
  "Trip Information": "行程信息",
  "Arrival and Departure Information": "抵达和离境信息",
  "Accommodation Information": "住宿信息",
  "Stay in Malaysia": "在马来西亚停留",
  "Stay in Thailand": "在泰国停留",
  "Health Declaration": "健康申报",
  "eTravel Scope": "eTravel 范围",
  "Customs Declaration": "海关申报",
  "Declaration": "声明确认",
};

const INDONESIA_DYNAMIC_STEP_NAME_ZH: Record<string, string> = {
  "Upload passport and photo": "上传护照和照片",
  "Application form": "申请表",
  "Review and submit": "审核并提交",
  Traveller: "旅客信息",
  "Traveller Information": "旅客信息",
  Passport: "护照",
  "Passport Details": "护照",
  Contact: "联系方式",
  "Contact Information": "联系方式",
  Trip: "行程",
  "Trip Information": "行程",
  Declarations: "声明确认",
  Declaration: "声明确认",
};

const VN_PREARRIVAL_DYNAMIC_STEP_NAME_ZH: Record<string, string> = {
  "Passenger Information": "旅客信息",
  "Trip Information": "行程信息",
  Review: "审核申请",
  Confirmation: "确认",
};

const KOREA_DYNAMIC_STEP_NAME_ZH: Record<string, string> = {
  "Official e-Form Route": "官方 e-Form 路线",
  "Personal Details": "个人信息",
  Passport: "护照",
  "Contact Details": "联系方式",
  "Marital & Family": "婚姻与家庭",
  "Education & Employment": "教育与就业",
  "Visit Information": "访问信息",
  "Travel History & Family": "旅行历史与家属",
  "Invitation Company": "邀请公司",
  "Expenses & Assistance": "费用与协助",
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
  if (options.visaType === "VN_PREARRIVAL_DECLARATION") {
    return VN_PREARRIVAL_DYNAMIC_STEP_NAME_ZH[stepName] ?? stepName;
  }

  if (
    options.isZhInterface &&
    (options.visaType === "SG_ARRIVAL_CARD" ||
      options.visaType === "MY_MDAC_ARRIVAL_CARD" ||
      options.visaType === "TH_TDAC_ARRIVAL_CARD" ||
      options.visaType === "PH_ETRAVEL_ARRIVAL_CARD")
  ) {
    return ARRIVAL_CARD_DYNAMIC_STEP_NAME_ZH[stepName] ?? stepName;
  }

  if (
    options.isZhInterface &&
    (options.visaType === "ID_C1_TOURIST" || options.visaType === "ID_B1_EVOA")
  ) {
    return INDONESIA_DYNAMIC_STEP_NAME_ZH[stepName] ?? stepName;
  }

  if (options.isZhInterface && options.visaType === "KR_C39_SHORT_TERM_VISIT") {
    return KOREA_DYNAMIC_STEP_NAME_ZH[stepName] ?? stepName;
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
  currentStep,
  completedStepIds,
  onStepClick,
}: {
  sections: StepSectionDef[];
  currentStep: number;
  completedStepIds: ReadonlySet<number>;
  onStepClick: StepClickHandler;
}) {
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
        {sections.map((section, sectionIndex) => {
          if (section.steps.length === 1) {
            const step = section.steps[0];
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
                  {status === "complete" ? <Check className="h-4 w-4" strokeWidth={3} /> : sectionIndex + 1}
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
                    sectionIndex + 1
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
                          {/* Child marker: substeps do not consume the main step numbers. */}
                          <span
                            className={cn(
                              "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center transition-all",
                              status === "complete" && "text-[#03346E]",
                              status === "in_progress" && "rounded-full border-2 border-[#03346E] bg-white text-[#03346E] shadow-[0_0_0_3px_rgba(3,52,110,0.14)]",
                              status === "locked" && "rounded-full border-2 border-gray-200 bg-white text-gray-400"
                            )}
                          >
                            {status === "complete" ? (
                              <Check className="h-5 w-5" strokeWidth={3} />
                            ) : status === "in_progress" ? (
                              <span className="h-2.5 w-2.5 rounded-full bg-[#03346E]" />
                            ) : (
                              <span className="h-2 w-2 rounded-full bg-gray-300" />
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
        {sections.map((section, sectionIndex) => {
          if (section.steps.length === 1) {
            const step = section.steps[0];
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
                  {status === "complete" ? <Check className="h-4 w-4" strokeWidth={3} /> : sectionIndex + 1}
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
                    sectionIndex + 1
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
                          {/* Child marker: substeps do not consume the main step numbers. */}
                          <span
                            className={cn(
                              "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center transition-all",
                              status === "complete" && "text-[#03346E]",
                              status === "in_progress" && "rounded-full border-2 border-[#03346E] bg-white text-[#03346E] shadow-[0_0_0_3px_rgba(3,52,110,0.14)]",
                              status === "locked" && "rounded-full border-2 border-gray-200 bg-white text-gray-400"
                            )}
                          >
                            {status === "complete" ? (
                              <Check className="h-5 w-5" strokeWidth={3} />
                            ) : status === "in_progress" ? (
                              <span className="h-2.5 w-2.5 rounded-full bg-[#03346E]" />
                            ) : (
                              <span className="h-2 w-2 rounded-full bg-gray-300" />
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
  onSubmit: (mode: SubmissionMode, vietnamPaymentCard?: VietnamOneTimePaymentCard) => void | Promise<void>;
}) {
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardHolderName, setCardHolderName] = useState("");
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
  const isVietnamPrearrival = liveAssistedTarget === "vn_prearrival";
  const isSgac = liveAssistedTarget === "sgac";
  const isMdac = liveAssistedTarget === "mdac";
  const isTdac = liveAssistedTarget === "tdac";
  const isPhEtravel = liveAssistedTarget === "phetravel";
  const isIndonesia = liveAssistedTarget === "indonesia";
  const requiresOneTimeOfficialPaymentCard = isVietnam || isIndonesia;
  const oneTimeOfficialPaymentCardReady =
    !requiresOneTimeOfficialPaymentCard ||
    (
      cardNumber.replace(/\D/g, "").length >= 12 &&
      cardExpiry.trim().length >= 4 &&
      cardCvv.replace(/\D/g, "").length >= 3
    );
  const liveDisabled = baseDisabled || !liveAssistedEnabled || !hasLiveAssistedTarget || !oneTimeOfficialPaymentCardReady;
  const liveDisabledReason = !hasLiveAssistedTarget
    ? (isZh ? "当前表单暂不支持 live assisted 官网辅助填写。" : "This form does not support live assisted official-site fill yet.")
    : requiresOneTimeOfficialPaymentCard && !oneTimeOfficialPaymentCardReady
      ? (isZh
          ? "请先填写本次官方付款使用的银行卡号、有效期和 CVV。"
          : "Enter the one-time official payment card number, expiry, and CVV before submitting.")
    : !liveAssistedEnabled
      ? isFrance
        ? (isZh
            ? "本地 France live assisted 环境未启用。请确认 FRANCE_LIVE_SUBMISSION_ENABLED 和 FRANCE_SUBMISSION_MODE。"
            : "France live assisted is not enabled locally. Check FRANCE_LIVE_SUBMISSION_ENABLED and FRANCE_SUBMISSION_MODE.")
        : isVietnam
          ? (isZh
              ? "本地 Vietnam live assisted 环境未启用。请确认 VN_LIVE_SUBMISSION_ENABLED 和 VN_SUBMISSION_MODE。"
              : "Vietnam live assisted is not enabled locally. Check VN_LIVE_SUBMISSION_ENABLED and VN_SUBMISSION_MODE.")
          : isVietnamPrearrival
            ? (isZh
                ? "本地越南入境前申报自动提交已关闭。请确认 VN_PREARRIVAL_LIVE_SUBMISSION_ENABLED。"
                : "Vietnam Pre-Arrival live submission is disabled locally. Check VN_PREARRIVAL_LIVE_SUBMISSION_ENABLED.")
          : isSgac
            ? (isZh
                ? "本地 SG Arrival Card live handoff 已关闭。请确认 SGAC_LIVE_SUBMISSION_ENABLED。"
                : "SG Arrival Card live handoff is disabled locally. Check SGAC_LIVE_SUBMISSION_ENABLED.")
            : isMdac
              ? (isZh
                  ? "本地 Malaysia MDAC live handoff 已关闭。请确认 MDAC_LIVE_SUBMISSION_ENABLED。"
                  : "Malaysia MDAC live handoff is disabled locally. Check MDAC_LIVE_SUBMISSION_ENABLED.")
              : isTdac
                ? (isZh
                    ? "本地 Thailand TDAC live handoff 已关闭。请确认 TDAC_LIVE_SUBMISSION_ENABLED。"
                    : "Thailand TDAC live handoff is disabled locally. Check TDAC_LIVE_SUBMISSION_ENABLED.")
                : isPhEtravel
                  ? (isZh
                      ? "本地 Philippines eTravel live handoff 已关闭。请确认 PH_ETRAVEL_LIVE_SUBMISSION_ENABLED。"
                      : "Philippines eTravel live handoff is disabled locally. Check PH_ETRAVEL_LIVE_SUBMISSION_ENABLED.")
                  : isIndonesia
                    ? (isZh
                        ? "本地 Indonesia live handoff 已关闭。请确认 INDONESIA_LIVE_SUBMISSION_ENABLED。"
                        : "Indonesia live handoff is disabled locally. Check INDONESIA_LIVE_SUBMISSION_ENABLED.")
        : (isZh
            ? "本地 DS-160 live assisted 环境未启用。请确认前端和 submission service 的 DS160 配置。"
            : "DS-160 live assisted is not enabled locally. Check the frontend and submission service DS160 settings.")
      : null;

  const submitMode: SubmissionMode = hasLiveAssistedTarget ? "live_assisted" : "dry_run";
  const submitDisabled = hasLiveAssistedTarget ? liveDisabled : baseDisabled;
  const officialPaymentCard: VietnamOneTimePaymentCard | undefined = requiresOneTimeOfficialPaymentCard
    ? {
        pan: cardNumber,
        expiry: cardExpiry,
        cvv: cardCvv,
        holderName: cardHolderName,
      }
    : undefined;
  const submitCopy = isZh
    ? hasLiveAssistedTarget
      ? "点击“提交”后，VIZA 会创建真实官网提交任务，自动填写官方表单，并在本页显示进度和官方编号。"
      : "点击“提交”后，VIZA 会创建后台提交任务，并在本页显示进度和结果。"
    : hasLiveAssistedTarget
      ? "Click Submit to create a real official-site submission job. VIZA fills the official form and shows progress and official evidence here."
      : "Click Submit to create the background submission job and show progress here.";
  const liveSafetyCopy = isFrance
    ? (isZh
        ? "France-Visas 提交会使用 VIZA 保存的答案、官方账号和必要的注册验证码处理来创建/更新官网申请；付款、预约或官网风控如果出现，会作为后续状态展示。"
        : "France-Visas submission uses saved VIZA answers, the official account, and registration CAPTCHA handling when needed to create/update the official application. Payment, appointment, or portal risk checks are surfaced as follow-up status.")
    : isVietnam
      ? (isZh
          ? "越南 e-Visa 会打开官网并使用已保存答案填写；验证码、付款或官网风控会作为后续状态展示。"
          : "Vietnam e-Visa opens the official portal and uses saved answers to fill it. CAPTCHA, payment, or portal risk checks are surfaced as follow-up status.")
      : isVietnamPrearrival
        ? (isZh
            ? "提交后会创建越南入境前申报官方提交任务，使用已保存答案填写官网表单，并在本页显示进度、确认编号、PDF 和二维码。"
            : "Submitting creates a Vietnam Pre-Arrival official-submission task using your saved answers. Progress, the confirmation number, PDF, and QR code appear here.")
      : isSgac
        ? (isZh
            ? "提交后会创建 SG Arrival Card 官方提交任务；页面会显示正在提交，后端成功提交后会展示 submitted=true、确认/参考号和 ICA 响应摘要。"
            : "Submitting creates an SG Arrival Card official-submission task. This page shows the submission in progress and, when the backend succeeds, displays submitted=true, the confirmation/reference number, and the ICA response summary.")
        : isMdac
          ? (isZh
              ? "提交后会创建 Malaysia MDAC 官方提交任务；页面会显示正在提交，后端成功提交后会展示 submitted=true、官方参考号和确认文件。"
              : "Submitting creates a Malaysia MDAC official-submission task. This page shows progress and, when the backend succeeds, displays submitted=true, the official reference, and confirmation evidence.")
          : isTdac
            ? (isZh
                ? "提交后会创建 Thailand TDAC 官方提交任务；页面会显示正在提交，后端成功提交后会展示 submitted=true、官方参考号和确认文件。"
                : "Submitting creates a Thailand TDAC official-submission task. This page shows progress and, when the backend succeeds, displays submitted=true, the official reference, and confirmation evidence.")
            : isPhEtravel
              ? (isZh
                  ? "提交后会创建 Philippines eTravel 官方提交任务；页面会显示正在提交，后端成功提交后会展示 submitted=true、官方 QR / 参考号和确认证据。"
                  : "Submitting creates a Philippines eTravel official-submission task. This page shows progress and, when the backend succeeds, displays submitted=true, the official QR/reference, and confirmation evidence.")
              : isIndonesia
                ? (isZh
                    ? "提交后会创建 Indonesia e-Visa 官方提交任务；VIZA 会使用托管账号填写官网表单，并把流程推进到官方付款页。"
                    : "Submitting creates an Indonesia e-Visa official-submission task. VIZA uses the managed account to fill the official portal and advance to the official payment page.")
              : (isZh
                  ? "提交会打开 CEAC 官网并使用已保存答案填写；验证码、风控或最终签名提交会作为后续状态展示。"
                  : "Submission opens CEAC and uses saved answers to fill it. CAPTCHA, risk checks, or final signature submission are surfaced as follow-up status.");

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
                : submitCopy}
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

      {requiresOneTimeOfficialPaymentCard && (
        <div className="space-y-3 rounded-xl border border-[#d7e6fb] bg-white p-5">
          <div className="flex items-start gap-3">
            <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-[#03346E]" />
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-[#0b2545]">
                {isZh ? "本次官方付款银行卡" : "One-time official payment card"}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-[#3d5878]">
                {isZh
                  ? `${isIndonesia ? "印度尼西亚 e-Visa" : "越南 e-Visa"} 提交会在官网付款页继续处理官方费用。请在提交前填写本次使用的银行卡；未填写则不能提交。卡号和 CVV 只会发送到本机 submission-service 的短时内存会话，不会保存到数据库、env、日志或个人资料。`
                  : `${isIndonesia ? "Indonesia e-Visa" : "Vietnam e-Visa"} submission continues through the official payment page. Enter the one-time card before submitting. Card number and CVV are sent only to the local submission-service memory session and are not stored.`}
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs text-gray-600">{isZh ? "银行卡号" : "Card number"}</span>
              <input
                value={cardNumber}
                onChange={(event) => setCardNumber(event.target.value)}
                autoComplete="cc-number"
                inputMode="numeric"
                className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#03346E]"
                placeholder={isZh ? "请输入银行卡号" : "Enter card number"}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-gray-600">{isZh ? "有效期" : "Expiry"}</span>
              <input
                value={cardExpiry}
                onChange={(event) => setCardExpiry(event.target.value)}
                autoComplete="cc-exp"
                inputMode="numeric"
                className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#03346E]"
                placeholder="MM/YY"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-gray-600">CVV</span>
              <input
                value={cardCvv}
                onChange={(event) => setCardCvv(event.target.value)}
                autoComplete="cc-csc"
                inputMode="numeric"
                className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#03346E]"
                placeholder="CVV"
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs text-gray-600">{isZh ? "持卡人姓名（可选）" : "Cardholder name (optional)"}</span>
              <input
                value={cardHolderName}
                onChange={(event) => setCardHolderName(event.target.value)}
                autoComplete="cc-name"
                className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#03346E]"
                placeholder={isZh ? "不填则使用 VIZA" : "Defaults to VIZA"}
              />
            </label>
          </div>
          {!oneTimeOfficialPaymentCardReady && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {isZh
                ? "请填写银行卡号、有效期和 CVV 后再提交。"
                : "Enter the card number, expiry, and CVV before submitting."}
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        disabled={submitDisabled}
        onClick={() => {
          void Promise.resolve(onSubmit(submitMode, officialPaymentCard)).finally(() => {
            if (requiresOneTimeOfficialPaymentCard) setCardCvv("");
          });
        }}
        className={cn(
          "flex min-h-12 w-full items-center justify-center rounded-full px-5 text-base font-semibold transition-colors",
          submitDisabled
            ? "cursor-not-allowed bg-gray-200 text-gray-500"
            : "bg-brand-500 text-white shadow-sm hover:bg-brand-600",
        )}
        title={liveDisabledReason ?? undefined}
      >
        {requirementsLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {isZh ? "正在检查" : "Checking"}
          </>
        ) : submittingMode === submitMode ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {isZh ? "正在提交" : "Submitting"}
          </>
        ) : (
          <>
            <ShieldCheck className="mr-2 h-4 w-4" />
            {isZh ? "提交" : "Submit"}
          </>
        )}
      </button>

      {hasLiveAssistedTarget && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
          {liveDisabledReason ?? liveSafetyCopy}
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

type SubmissionQueueJobResult = {
  scheduled: boolean;
  scheduledFor: string | null;
  jobId: string | null;
  queueStatus: string | null;
  provider: string | null;
  submissionResultStatus: SubmissionResultStatus;
  submissionResult: SubmissionResult | null;
};

type ApplicationSubmissionState = {
  submittedAt: string | undefined;
  submissionResultStatus: SubmissionResultStatus | null;
  submissionResult: SubmissionResult | null;
  confirmationNumber: string | undefined;
};

const TERMINAL_SUBMISSION_RESULT_STATUSES = [
  "completed",
  "submitted",
  "submitted_mock",
  "form_ready_for_agency",
] as const;

function applicationStatusForQueuedSubmission(queueJob: SubmissionQueueJobResult): "processing" | "submitted" {
  return TERMINAL_SUBMISSION_RESULT_STATUSES.includes(
    queueJob.submissionResultStatus as (typeof TERMINAL_SUBMISSION_RESULT_STATUSES)[number],
  )
    ? "submitted"
    : "processing";
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

async function markApplicationSubmissionQueued(
  supabase: ReturnType<typeof createClient>,
  input: {
    applicationId: string;
    submittedAt: string;
    queueJob: SubmissionQueueJobResult;
  },
): Promise<ApplicationSubmissionState> {
  const selectColumns = "submitted_at, submission_result_status, submission_result, confirmation_number";
  const { data: updatedApplication, error: updateError } = await supabase
    .from("applications")
    .update({
      status: applicationStatusForQueuedSubmission(input.queueJob),
      submitted_at: input.submittedAt,
      submission_result_status: input.queueJob.submissionResultStatus,
      submission_result: input.queueJob.submissionResult,
      confirmation_number: null,
      submission_result_updated_at: input.submittedAt,
    })
    .eq("id", input.applicationId)
    .or(
      [
        "submission_result_status.is.null",
        `submission_result_status.not.in.(${TERMINAL_SUBMISSION_RESULT_STATUSES.join(",")})`,
      ].join(","),
    )
    .select(selectColumns)
    .maybeSingle();
  if (updateError) throw new Error(updateError.message);

  const application = updatedApplication ?? (await supabase
    .from("applications")
    .select(selectColumns)
    .eq("id", input.applicationId)
    .maybeSingle()).data;

  return {
    submittedAt: application?.submitted_at ?? input.submittedAt,
    submissionResultStatus:
      (application?.submission_result_status as SubmissionResultStatus | null | undefined) ??
      input.queueJob.submissionResultStatus,
    submissionResult:
      (application?.submission_result as SubmissionResult | null | undefined) ??
      input.queueJob.submissionResult,
    confirmationNumber:
      typeof application?.confirmation_number === "string" && application.confirmation_number.trim()
        ? application.confirmation_number
        : undefined,
  };
}

async function insertSubmissionQueueJob(
  supabase: ReturnType<typeof createClient>,
  input: SubmissionQueueJobInput,
): Promise<SubmissionQueueJobResult> {
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
    const payload = (await response.json().catch(() => null)) as {
      scheduled?: boolean;
      scheduledFor?: string | null;
      jobId?: unknown;
      queueStatus?: unknown;
      provider?: unknown;
      result?: SubmissionResult | null;
    } | null;
    return {
      scheduled: Boolean(payload?.scheduled),
      scheduledFor: payload?.scheduledFor ?? null,
      jobId: typeof payload?.jobId === "string" ? payload.jobId : null,
      queueStatus: typeof payload?.queueStatus === "string" ? payload.queueStatus : null,
      provider: typeof payload?.provider === "string" ? payload.provider : null,
      submissionResultStatus: payload?.scheduled ? "scheduled" : "waiting",
      submissionResult: payload?.scheduled ? payload.result ?? null : null,
    };
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
  if (!error) {
    return {
      scheduled: false,
      scheduledFor: null,
      jobId: null,
      queueStatus: status,
      provider,
      submissionResultStatus: "waiting",
      submissionResult: null,
    };
  }

  const canUseLegacyPayload =
    isMissingSubmissionModeColumnError(error) &&
    (input.mode === "dry_run" ||
      status === "ds160_live_assisted_pending" ||
      status === "vn_live_assisted_pending" ||
      status === "sgac_live_assisted_pending" ||
      status === "mdac_live_assisted_pending" ||
      status === "tdac_live_assisted_pending");
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
  return {
    scheduled: false,
    scheduledFor: null,
    jobId: null,
    queueStatus: status,
    provider,
    submissionResultStatus: "waiting",
    submissionResult: null,
  };
}

async function insertOfficialFeeSubmissionQueueJobWithCard(
  applicationId: string,
  card: VietnamOneTimePaymentCard | undefined,
): Promise<SubmissionQueueJobResult> {
  if (!card?.pan.trim() || !card.expiry.trim() || !card.cvv.trim()) {
    throw new Error("请输入本次付款使用的银行卡号、有效期和 CVV。VIZA 不会保存这些信息。");
  }

  const response = await fetch(`/api/applications/${applicationId}/official-fee/pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      card: {
        pan: card.pan,
        expiry: card.expiry,
        cvv: card.cvv,
        holderName: card.holderName,
      },
    }),
  });
  const payload = (await response.json().catch(() => null)) as {
    error?: unknown;
    queueId?: unknown;
    queueStatus?: unknown;
    provider?: unknown;
  } | null;
  if (!response.ok) {
    throw new Error(
      typeof payload?.error === "string"
        ? payload.error
        : `Official-fee queue creation failed with ${response.status}`,
    );
  }

  return {
    scheduled: false,
    scheduledFor: null,
    jobId: typeof payload?.queueId === "string" ? payload.queueId : null,
    queueStatus: typeof payload?.queueStatus === "string" ? payload.queueStatus : "vn_live_assisted_pending",
    provider: typeof payload?.provider === "string" ? payload.provider : "vietnam_evisa_live",
    submissionResultStatus: "waiting",
    submissionResult: null,
  };
}

type LoadedApplicantProfile = UniversalProfileSnapshot & {
  id?: string | null;
  place_of_birth?: string | null;
  gender?: string | null;
};

const SGAC_NATIONALITY_PROFILE_ALIASES: Record<string, string> = {
  chn: "CHINESE",
  china: "CHINESE",
  chinese: "CHINESE",
  "people's republic of china": "CHINESE",
  "people’s republic of china": "CHINESE",
  prc: "CHINESE",
  中国: "CHINESE",
  中国籍: "CHINESE",
};

function normalizeComparableValue(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function getFieldOptionValueMatch(field: WizardStep["fields"][number], rawValue: string): string | null {
  const normalized = normalizeComparableValue(rawValue);
  if (!normalized || !field.options) return null;

  const aliasValue =
    field.fieldName === "nationality"
      ? SGAC_NATIONALITY_PROFILE_ALIASES[normalized]
      : null;
  const candidates = new Set([normalized]);
  if (aliasValue) candidates.add(normalizeComparableValue(aliasValue));

  for (const option of field.options) {
    if (typeof option === "string") {
      if (candidates.has(normalizeComparableValue(option))) return option;
      continue;
    }
    const optionValue = option.value;
    const optionComparables = [
      option.value,
      option.text,
      option.label_en,
      option.label_zh,
      option.official_label,
    ].filter((candidate): candidate is string => Boolean(candidate?.trim()));
    if (optionComparables.some((candidate) => candidates.has(normalizeComparableValue(candidate)))) {
      return optionValue;
    }
  }

  return null;
}

function normalizeAnswersToFieldOptions(answers: Record<string, string>, steps: WizardStep[]) {
  if (steps.length === 0) return answers;
  const next = { ...answers };
  for (const step of steps) {
    for (const field of step.fields) {
      const value = next[field.fieldName];
      if (!value?.trim()) continue;
      const matchedValue = getFieldOptionValueMatch(field, value);
      if (matchedValue) next[field.fieldName] = matchedValue;
    }
  }
  return next;
}

function applyCountrySpecificUniversalProfileAnswers(input: {
  answers: Record<string, string>;
  existingAnswers: Record<string, string>;
  profile: UniversalProfileSnapshot;
  country: string | null | undefined;
  visaType: string | null | undefined;
}) {
  if (!isMalaysiaMdacApplication(input.country, input.visaType)) return input.answers;
  if (input.existingAnswers.place_of_birth?.trim()) return input.answers;
  const profilePatch = buildMalaysiaMdacUniversalProfileAnswerPatch(input.profile);
  const stringPatch = Object.fromEntries(
    Object.entries(profilePatch).filter((entry): entry is [string, string] =>
      typeof entry[1] === "string",
    ),
  );
  return {
    ...input.answers,
    ...stringPatch,
  };
}

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
  const draftVersionTimerRef = useRef<number | null>(null);
  const navigationSaveInFlightRef = useRef(false);
  const mainScrollRef = useRef<HTMLElement | null>(null);
  const activeStepPanelRef = useRef<HTMLDivElement | null>(null);
  const scrollClampFrameRef = useRef<number | null>(null);

  const clampMainScrollToActivePanel = useCallback(() => {
    const main = mainScrollRef.current;
    const panel = activeStepPanelRef.current;
    if (!main || !panel || main.scrollTop <= 0) return;

    const mainRect = main.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const allowedBottomGap = 8;
    const excessiveBlank = mainRect.bottom - allowedBottomGap - panelRect.bottom;

    if (excessiveBlank > 0) {
      main.scrollTop = Math.max(0, main.scrollTop - excessiveBlank);
    }
  }, []);

  const handleMainScroll = useCallback(() => {
    if (scrollClampFrameRef.current !== null) return;
    scrollClampFrameRef.current = window.requestAnimationFrame(() => {
      scrollClampFrameRef.current = null;
      clampMainScrollToActivePanel();
    });
  }, [clampMainScrollToActivePanel]);

  useEffect(() => {
    return () => {
      if (scrollClampFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollClampFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyOverflow = document.body.style.overflow;

    const syncPageScrollLock = () => {
      if (mediaQuery.matches) {
        document.documentElement.style.overflow = "hidden";
        document.body.style.overflow = "hidden";
        window.scrollTo({ top: 0 });
      } else {
        document.documentElement.style.overflow = originalHtmlOverflow;
        document.body.style.overflow = originalBodyOverflow;
      }
    };

    const keepWindowAtTop = () => {
      if (mediaQuery.matches && window.scrollY !== 0) {
        window.scrollTo({ top: 0 });
      }
    };

    syncPageScrollLock();
    mediaQuery.addEventListener("change", syncPageScrollLock);
    window.addEventListener("resize", syncPageScrollLock);
    window.addEventListener("scroll", keepWindowAtTop, { passive: true });

    return () => {
      mediaQuery.removeEventListener("change", syncPageScrollLock);
      window.removeEventListener("resize", syncPageScrollLock);
      window.removeEventListener("scroll", keepWindowAtTop);
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overflow = originalBodyOverflow;
    };
  }, []);

  useEffect(() => {
    const main = mainScrollRef.current;
    const panel = activeStepPanelRef.current;
    if (!main || !panel) return;

    const observer = new ResizeObserver(handleMainScroll);
    observer.observe(main);
    observer.observe(panel);
    window.addEventListener("resize", handleMainScroll);
    handleMainScroll();

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleMainScroll);
    };
  }, [currentStep, draftVersion, handleMainScroll]);

  const handleDynamicDraftChange = useCallback((stepId: number, data: Record<string, string>) => {
    dynamicDraftRef.current[stepId] = data;
    // Let a large official select close before recalculating outer step visibility.
    if (draftVersionTimerRef.current !== null) window.clearTimeout(draftVersionTimerRef.current);
    draftVersionTimerRef.current = window.setTimeout(() => {
      draftVersionTimerRef.current = null;
      setDraftVersion((version) => version + 1);
    }, 120);
    setSubmitMissingFields([]);
  }, []);

  useEffect(() => () => {
    if (draftVersionTimerRef.current !== null) window.clearTimeout(draftVersionTimerRef.current);
  }, []);

  const resolvedCountry = explicitCountry ?? visaPackage?.country ?? "indonesia";
  const resolvedVisaType = explicitVisaType ?? visaPackage?.visa_type ?? "tourist_b211a";
  const isArrivalCardApplication = isDigitalArrivalCardApplication(resolvedCountry, resolvedVisaType);
  const showDocumentStep = !isArrivalCardApplication;
  const showTeamStep = !isCompanionFlow && !isArrivalCardApplication;
  const STEPS: StepDef[] = STEP_KEYS
    .filter((key) => showTeamStep || key !== "team")
    .map((key, id) => ({
      id,
      name: t(`steps.${key}.name`),
      description: t(`steps.${key}.description`),
      sourceName: key,
    }));
  const isDs160Application = isDs160VisaType(resolvedVisaType);
  const normalizedCountryForLive = resolvedCountry.trim().toLowerCase();
  const isFranceSchengenApplication =
    isFranceVisasVisaType(resolvedVisaType) &&
    ["france", "fr", "法国"].includes(normalizedCountryForLive);
  const isVietnamEVisa = isVietnamEVisaApplication(resolvedCountry, resolvedVisaType);
  const isVietnamPrearrival = isVietnamPrearrivalApplication(resolvedCountry, resolvedVisaType);
  const isSgArrivalCard = isSgArrivalCardApplication(resolvedCountry, resolvedVisaType);
  const isMalaysiaMdac = isMalaysiaMdacApplication(resolvedCountry, resolvedVisaType);
  const isThailandTdac = isThailandTdacApplication(resolvedCountry, resolvedVisaType);
  const isPhilippinesEtravel = isPhilippinesEtravelApplication(resolvedCountry, resolvedVisaType);
  const isIndonesiaEVisa = isIndonesiaEVisaApplication(resolvedCountry, resolvedVisaType);
  const liveAssistedTarget: LiveAssistedTarget = isDs160Application
    ? "ds160"
    : isFranceSchengenApplication
      ? "france"
      : isVietnamEVisa
        ? "vietnam"
        : isVietnamPrearrival
          ? "vn_prearrival"
        : isSgArrivalCard
          ? "sgac"
          : isMalaysiaMdac
            ? "mdac"
            : isThailandTdac
              ? "tdac"
              : isPhilippinesEtravel
                ? "phetravel"
                : isIndonesiaEVisa
                  ? "indonesia"
                  : null;
  const liveAssistedEnabled = liveAssistedTarget === "ds160"
    ? DS160_LIVE_ASSISTED_ENABLED
    : liveAssistedTarget === "france"
      ? FRANCE_LIVE_ASSISTED_ENABLED
      : liveAssistedTarget === "vietnam"
        ? VN_LIVE_ASSISTED_ENABLED
        : liveAssistedTarget === "vn_prearrival"
          ? VN_PREARRIVAL_LIVE_ASSISTED_ENABLED
        : liveAssistedTarget === "sgac"
          ? SGAC_LIVE_ASSISTED_ENABLED
          : liveAssistedTarget === "mdac"
            ? MDAC_LIVE_ASSISTED_ENABLED
            : liveAssistedTarget === "tdac"
              ? TDAC_LIVE_ASSISTED_ENABLED
              : liveAssistedTarget === "phetravel"
                ? PH_ETRAVEL_LIVE_ASSISTED_ENABLED
                : liveAssistedTarget === "indonesia"
                  ? INDONESIA_LIVE_ASSISTED_ENABLED
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
  const reviewStepIndex = dbSteps.length + (showDocumentStep ? 1 : 0);
  const teamStepIndex = reviewStepIndex + 1;
  const statusStepIndex = reviewStepIndex + (showTeamStep ? 2 : 1);
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
        ...(showDocumentStep
          ? [
              {
                id: documentStepIndex,
                sourceName: "Supporting Documents",
                name: tDyn.has("Supporting Documents") ? tDyn("Supporting Documents" as never) : isZhInterface ? "材料" : "Documents",
                description: tApp.has("documentsStepDescription") ? tApp("documentsStepDescription" as never) : "Upload required and optional supporting documents",
              },
            ]
          : []),
        {
          id: reviewStepIndex,
          sourceName: "Review",
          name: resolvedVisaType === "VN_PREARRIVAL_DECLARATION"
            ? VN_PREARRIVAL_DYNAMIC_STEP_NAME_ZH.Review
            : tDyn.has("Review") ? tDyn("Review" as never) : isZhInterface ? "审核申请" : "Review Application",
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
          name: resolvedVisaType === "VN_PREARRIVAL_DECLARATION"
            ? VN_PREARRIVAL_DYNAMIC_STEP_NAME_ZH.Confirmation
            : tDyn.has("Confirmation") ? tDyn("Confirmation" as never) : isZhInterface ? "确认" : "Confirmation",
          description: tApp.has("statusStepDescription") ? tApp("statusStepDescription" as never) : "Application submitted",
        },
      ]
        : [...STEPS],
    [
      documentStepIndex,
      reviewStepIndex,
      showDocumentStep,
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
    stay: tApp.has("dynamicSections.stay") ? tApp("dynamicSections.stay" as never) : isZhInterface ? "停留信息" : "Stay",
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
    () => {
      if (!useDynamic) return [];
      const sections = buildApplicationStepSections(sourceOrderedSteps, dynamicSectionTitles);
      if (!isIndonesiaEVisa) return sections;

      return sections.map((section, index) =>
        index === 0 && section.key === "review"
          ? { ...section, title: isZhInterface ? "申请" : "Apply" }
          : section,
      );
    },
    [dynamicSectionTitles, isIndonesiaEVisa, isZhInterface, sourceOrderedSteps, useDynamic],
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
      showDocumentStep,
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
      showDocumentStep,
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
  const showSubmissionStatusStep = shouldShowSubmissionStatusStep({
    submittedAt: appState.submittedAt,
    submissionResultStatus: appState.submissionResultStatus,
    submissionResult: appState.submissionResult,
  });

  useEffect(() => {
    if (loading || effectiveSteps.length === 0) return;
    setCompletedUpTo(getContiguousCompletedCount(effectiveSteps, completedStepIds));
  }, [completedStepIds, effectiveSteps, loading]);

  const loadData = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let profile: LoadedApplicantProfile | null = null;
      let application: LoadedApplication | null = null;

      if (explicitApplicationId) {
        const context = await getTeamApplicationContext(explicitApplicationId);
        if (!context.ok || !context.application || !context.profile) {
          setError(context.reason ?? t("errors.noApplicationFound"));
          return;
        }
        profile = context.profile as LoadedApplicantProfile;
        application = context.application as LoadedApplication;
      } else {
        const context = await loadApplicationFormContext(resolvedCountry, resolvedVisaType, {
          preferExplicit: preferExplicitPackage,
        });
        if (context.error) {
          setError(context.error);
          return;
        }
        profile = (context.profile as LoadedApplicantProfile | null) ?? null;
        application = (context.application as LoadedApplication | null) ?? null;
      }

      if (profile) {
        // Load DS-160 answers from visa_application_answers first (the source of truth)
        let ds160Answers: Record<string, string> = {};
        if (application?.id) {
          const { answers } = await loadDynamicAnswers(application.id);
          ds160Answers = answers;
        }
        const universalDynamicAnswers = applyCountrySpecificUniversalProfileAnswers({
          answers: mergeUniversalProfileIntoAnswers(ds160Answers, profile),
          existingAnswers: ds160Answers,
          profile,
          country: resolvedCountry,
          visaType: resolvedVisaType,
        });
        const mergedDynamicAnswers = normalizeAnswersToFieldOptions(universalDynamicAnswers, dbSteps);
        const profileFallback = profile;

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
          const shouldOpenConfirmation = shouldShowSubmissionStatusStep({
            submittedAt: application?.submitted_at ?? null,
            submissionResultStatus:
              (application?.submission_result_status as SubmissionResultStatus | null) ?? null,
            submissionResult: (application?.submission_result as SubmissionResult | null) ?? null,
          });
          setCurrentStep(shouldOpenConfirmation ? statusStepIndex : 0);
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
    } catch (err) {
      console.error("Failed to load application data", err);
      setError(err instanceof Error ? err.message : t("errors.noApplicationFound"));
    } finally {
      setLoading(false);
    }
  }, [dbSteps, explicitApplicationId, preferExplicitPackage, resolvedCountry, resolvedVisaType, statusStepIndex, t]);

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
  // Universal Profile is a non-overwriting autofill source: saved answers win,
  // and still-empty fields can be hydrated from the current profile.
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
      showDocumentStep,
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
      showDocumentStep,
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

  const authorizeVietnamOfficialFeeIfNeeded = useCallback(
    async (applicationId: string, mode: SubmissionMode) => {
      if (mode !== "live_assisted" || !isVietnamEVisa) return;
      const response = await fetch(`/api/applications/${applicationId}/official-fee/authorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted: true }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : isZhInterface
              ? "官方费用授权失败，请稍后重试。"
              : "Official fee authorization failed. Please try again.",
        );
      }
    },
    [isVietnamEVisa, isZhInterface],
  );

  // ── Dynamic-mode review complete handler ────────────────────────────
  const handleDynamicReviewComplete = async (
    mode: SubmissionMode = "dry_run",
    vietnamPaymentCard?: VietnamOneTimePaymentCard,
  ) => {
    setSaving(true);
    setSubmittingMode(mode);
    setError(null);
    const shouldShowArrivalSubmissionImmediately =
      mode === "live_assisted" &&
      (isDigitalArrivalCardApplication(resolvedCountry, resolvedVisaType) ||
        isIndonesiaEVisaApplication(resolvedCountry, resolvedVisaType));
    const previousSubmissionState = {
      submittedAt: appState.submittedAt,
      submissionResultStatus: appState.submissionResultStatus,
      submissionResult: appState.submissionResult,
    };
    if (shouldShowArrivalSubmissionImmediately) {
      const submittedAt = new Date().toISOString();
      setAppState((prev) => ({
        ...prev,
        submittedAt: prev.submittedAt ?? submittedAt,
        submissionResultStatus: prev.submissionResultStatus ?? "waiting",
        submissionResult: prev.submissionResult ?? null,
      }));
      setCurrentStep(statusStepIndex);
    }
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
      const isKrC39 = resolvedVisaType === "KR_C39_SHORT_TERM_VISIT";

      if (!isJpTourist && !isKrC39) {
        const queueJob = mode === "live_assisted" && (isVietnamEVisa || isIndonesiaEVisa)
          ? await insertOfficialFeeSubmissionQueueJobWithCard(applicationId, vietnamPaymentCard)
          : await (async () => {
              await authorizeVietnamOfficialFeeIfNeeded(applicationId, mode);
              // Standard automated-submission countries enqueue a job for the
              // submission-service worker to drive the per-country portal.
              return insertSubmissionQueueJob(supabase, {
                applicationId,
                country: resolvedCountry,
                visaType: resolvedVisaType,
                mode,
                createdAt: new Date().toISOString(),
              });
            })();
        const submittedAt = new Date().toISOString();
        const submissionState = await markApplicationSubmissionQueued(supabase, {
          applicationId,
          submittedAt,
          queueJob,
        });

        setAppState((prev) => ({
          ...prev,
          submittedAt: submissionState.submittedAt,
          submissionResultStatus: submissionState.submissionResultStatus,
          submissionResult: submissionState.submissionResult,
          confirmationNumber: submissionState.confirmationNumber,
        }));
      }

      if (isJpTourist) {
        const submittedAt = new Date().toISOString();
        const { error: submitError } = await supabase.from("applications").update({
          status: "submitted",
          submitted_at: submittedAt,
        }).eq("id", applicationId);
        if (submitError) throw new Error(submitError.message);
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
      }
      if (isKrC39) {
        const submittedAt = new Date().toISOString();
        const krResult: SubmissionResult = {
          country: "KR",
          status: "form_ready_for_kvac",
          applicationId,
          annex17PdfUrl: null,
          officialEformPortalUrl: "https://www.visa.go.kr/openPage.do?MENU_ID=10204",
          officialEformStatus: "not_started",
        };
        const { error: submitError } = await supabase.from("applications").update({
          status: "submitted",
          submitted_at: submittedAt,
          submission_result_status: "form_ready_for_kvac",
          submission_result: krResult,
          submission_result_updated_at: submittedAt,
        }).eq("id", applicationId);
        if (submitError) throw new Error(submitError.message);
        setAppState((prev) => ({
          ...prev,
          submittedAt,
          submissionResultStatus: "form_ready_for_kvac",
          submissionResult: krResult,
        }));
      }
      setSubmitMissingFields([]);
      const completionPosition = getVisibleStepIndex(effectiveSteps, showTeamStep ? teamStepIndex : reviewStepIndex);
      setCompletedUpTo((c) => Math.max(c, completionPosition + 1));
      setCurrentStep(statusStepIndex);
    } catch (err) {
      if (shouldShowArrivalSubmissionImmediately) {
        setAppState((prev) => ({
          ...prev,
          ...previousSubmissionState,
        }));
      }
      setError(err instanceof Error ? err.message : t("errors.failedToSubmit"));
    } finally {
      setSaving(false);
      setSubmittingMode(null);
    }
  };

  const handleReviewComplete = async (
    mode: SubmissionMode = "dry_run",
    vietnamPaymentCard?: VietnamOneTimePaymentCard,
  ) => {
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

      const queueJob = mode === "live_assisted" && (isVietnamEVisa || isIndonesiaEVisa)
        ? await insertOfficialFeeSubmissionQueueJobWithCard(applicationId, vietnamPaymentCard)
        : await (async () => {
            await authorizeVietnamOfficialFeeIfNeeded(applicationId, mode);
            return insertSubmissionQueueJob(supabase, {
              applicationId,
              country: resolvedCountry,
              visaType: resolvedVisaType,
              mode,
              createdAt: new Date().toISOString(),
            });
          })();

      const submittedAt = new Date().toISOString();
      const submissionState = await markApplicationSubmissionQueued(supabase, {
        applicationId,
        submittedAt,
        queueJob,
      });

      setAppState((prev) => ({
        ...prev,
        submittedAt: submissionState.submittedAt,
        submissionResultStatus: submissionState.submissionResultStatus,
        submissionResult: submissionState.submissionResult,
        confirmationNumber: submissionState.confirmationNumber,
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
          currentStep={currentStep}
          completedStepIds={completedStepIds}
          onStepClick={handleStepNavigation}
        />
      ) : (
        <VerticalStepSidebar steps={effectiveSteps} currentStep={currentStep} completedStepIds={completedStepIds} onStepClick={handleStepNavigation} />
      )}

      {/* Main content area */}
      <main
        ref={mainScrollRef}
        onScroll={handleMainScroll}
        onWheelCapture={handleMainScroll}
        onTouchMoveCapture={handleMainScroll}
        className="min-w-0 flex-1 bg-[#fcfcfc] p-4 sm:p-6 md:p-8 lg:-mt-5 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain"
      >
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
                <div
                  key={step.id}
                  ref={activeStepPanelRef}
                  className="flex flex-col gap-4"
                >
                  {/* Section heading - outside the panel */}
                  <h2 className="font-heading text-[20px] sm:text-[24px] md:text-[28px] font-medium text-[#3d3d3d] tracking-[-0.5px] sm:tracking-[-0.7px]">
                    {step.name}
                  </h2>
                  {/* Panel card */}
                  <div className="w-full rounded-xl border border-[#efefef] bg-white p-4 sm:p-6 md:p-8">
                    {step.id === firstFormStepId && activeVisaType !== "VN_PREARRIVAL_DECLARATION" && (
                      <PassportOcrUpload
                        applicationId={appState.applicationId}
                        className="mb-6"
                        initialFileName={passportOcrInitialFileName}
                        initialUploaded={passportOcrInitialUploaded}
                        country={activeCountry}
                        visaType={activeVisaType}
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
                        {showDocumentStep && step.id === documentStepIndex && (
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
                            onPhotoEdit={() => setCurrentStep(showDocumentStep ? documentStepIndex : firstFormStepId)}
                            onComplete={
                              isCompanionFlow
                                ? handleCompanionReviewComplete
                                : showTeamStep
                                  ? handleReviewContinueToTeam
                                  : handleTeamConfirm
                            }
                            mode="continue"
                            continueLabel={
                              isCompanionFlow
                                ? t("team.confirmCompanion")
                                : showTeamStep
                                  ? t("team.continueToTeam")
                                  : t("dynamicButtons.continue")
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
                          showSubmissionStatusStep ? (
                            <SubmissionStatusStep
                              applicationId={appState.applicationId}
                              country={activeCountry}
                              visaType={activeVisaType}
                              status={appState.submissionResultStatus}
                              result={appState.submissionResult}
                              onResubmit={handleDynamicReviewComplete}
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
                          showSubmissionStatusStep ? (
                            <SubmissionStatusStep
                              applicationId={appState.applicationId}
                              country={activeCountry}
                              visaType={activeVisaType}
                              status={appState.submissionResultStatus}
                              result={appState.submissionResult}
                              onResubmit={handleReviewComplete}
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



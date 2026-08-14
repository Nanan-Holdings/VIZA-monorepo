"use client";

import { useEffect, useLayoutEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CreditCard, CircleNotch as Loader2, Check, CaretDown as ChevronDown, ShieldCheck } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { Alert, AlertDescription, AlertIcon, AlertTitle } from "@/components/ui/alert";
import { ApplicationFormInputGroup } from "@/components/ui/application-form-input";
import { ApplicationFormPanel } from "@/components/ui/application-form-panel";
import { InputGroupInput } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";
import { countries } from "country-data-list";
import { DocumentCenterClient } from "@/app/client/documents/document-center-client";
import { ClientErrorAlert } from "@/components/client/client-error-alert";
import {
  loadDocumentCenterData,
  type DocumentCenterData,
} from "@/app/client/documents/actions";
import { getVisaFormSteps } from "@/app/actions/visa-form-fields";
import { type VisaFormFieldRow, type WizardStep } from "@/types/visa-form-fields";
import { evaluateShowIf } from "@/lib/form-utils";
import { resolveVisaFormSchemaVisaType } from "@/lib/visa-form-schema-aliases";
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
import {
  DynamicStepForm,
  ensureVnPrearrivalOtherFlightFlow,
} from "@/components/dynamic-step-form";
import { SmoothProgressBar } from "@/components/smooth-progress";
import { PassportOcrUpload } from "@/components/client/passport-ocr-upload";
import {
  FormFillingAssistant,
  type FormAssistantFillNotice,
  type FormAssistantFillNoticeItem,
  type FormAssistantValidationIssue as FormAssistantDisplayValidationIssue,
} from "@/components/client/form-assistant";
import { BrandActionButton } from "@/components/client/brand-action-button";
import {
  saveDynamicAnswers,
  ensureDraftApplication,
  loadApplicationFormContext,
  loadDynamicAnswers,
} from "@/app/actions/visa-application-answers";
import { persistDS160AnswerSet } from "@/app/actions/ds160-normalize";
import {
  getCanonicalVisaDestinationCountry,
  getFormVisaType,
  getVisaPackageTitle,
} from "@/lib/visa-destinations";
import type {
  SubmissionResult,
  SubmissionResultStatus,
} from "@/lib/submission-result";
import type {
  FormAssistantState,
  FormAssistantTurnResponse,
  FormAssistantValidationResponse,
  FormAssistantTranscriptionResponse,
  FormAssistantUndoResponse,
} from "@/types/form-assistant";
type FormAssistantRequestError = Error & {
  code?: string;
};
import { shouldBootstrapFormAssistantDraft } from "@/lib/form-assistant/bootstrap";
import { canUseFormAssistant } from "@/lib/form-assistant/constants";
import {
  buildFormAssistantFieldReviewIssues,
  getBaseAnswerFieldName,
  normalizeFormAssistantValidationResponse,
} from "@/lib/form-assistant/review-issues";
import {
  buildMalaysiaMdacUniversalProfileAnswerPatch,
  buildUniversalProfileAnswerPatch,
  mergeUniversalProfileIntoAnswers,
  splitUniversalFullName,
  type UniversalProfileSnapshot,
} from "@/lib/universal-profile-prefill";
import { SubmissionStatusStep } from "../_components/result-cards/SubmissionStatusStep";
import { UniversalProfileSyncCard } from "@/components/application-steps/universal-profile-sync-card";
import {
  getTeamApplicationContext,
  markTeamCompanionReviewed,
} from "@/app/actions/application-group";
import {
  buildApplicationLongFormHref,
  buildApplicationFormHref,
  setRecentApplicationFormHref,
} from "@/lib/client/recent-application-form";
import { setActiveApplicationSelection } from "@/lib/client/active-application-selection";
import {
  computeAllTabCompletion,
  getContiguousCompletedCount,
  type MissingApplicationField,
} from "@/lib/application-tab-completion";
import {
  shouldShowReviewAlongsideSubmissionStatus,
  shouldShowSubmissionStatusStep,
} from "@/lib/application-submission-display";
import { isIgnorableRuntimeAbortError } from "@/lib/runtime-abort-errors";
import {
  attemptStaleServerActionReload,
  isStaleServerActionError,
} from "@/lib/server-action-recovery";
import {
  buildApplicationStepSections,
  getDynamicStepTranslationCandidates,
  type ApplicationStepSection,
  type ApplicationStepSectionKey,
} from "@/lib/application-step-sections";
import {
  buildTaiwanEntryPermitSections,
  getTaiwanEntryPermitInlineDocumentStepId,
  isTaiwanEntryPermitQualificationStepSource,
  shouldShowStandaloneDocumentStep,
} from "@/lib/taiwan-entry-permit-layout";
import {
  isDs160VisaType,
  isDigitalArrivalCardApplication,
  isIndonesiaEVisaApplication,
  isMalaysiaMdacApplication,
  isFranceVisasVisaType,
  isPhilippinesEtravelApplication,
  isSgArrivalCardApplication,
  isThailandTdacApplication,
  isUkStandardVisitorApplication,
  isVietnamEVisaApplication,
  isVietnamPrearrivalApplication,
  queueProviderForApplication,
  queueStatusForApplication,
  submissionQueueRequiresServerEnqueue,
  type SubmissionMode,
} from "@/lib/submission-queue";
import {
  getTaiwanEntryPermitExtraRequirements,
  getTaiwanEntryPermitRequiredDocumentKeys,
  getTaiwanEntryPermitVisibleDocumentKeys,
} from "@/lib/taiwan-entry-permit-document-requirements";

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

type StepStatus = "complete" | "in_progress" | "locked";

function formAssistantFieldLabel(field: VisaFormFieldRow, isZh: boolean): string {
  if (isZh) {
    const label = field.validationRules?.label_zh;
    if (typeof label === "string" && label.trim()) return label.trim();
  }
  return field.label;
}

function formAssistantDisplayValue(
  field: VisaFormFieldRow,
  value: string,
  locale: string,
  isZh: boolean,
): string {
  if (field.fieldType === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [, month, day] = value.split("-");
    if (isZh) return `${Number(month)}月${Number(day)}日`;
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${value}T00:00:00Z`));
  }
  const option = field.options?.find((candidate) =>
    (typeof candidate === "string" ? candidate : candidate.value) === value,
  );
  if (option && typeof option !== "string") {
    if (isZh && option.label_zh?.trim()) return option.label_zh.trim();
    return option.label_en?.trim() || option.text?.trim() || option.value;
  }
  return value;
}

function prepareFormAssistantState(state: FormAssistantState): FormAssistantState {
  const persistedMessages = state.messages.at(-1)?.role === "assistant"
    ? state.messages.slice(0, -1)
    : state.messages;
  return {
    ...state,
    messages: [
      ...persistedMessages,
      {
        id: `assistant-current-${state.sessionId}-${crypto.randomUUID()}`,
        role: "assistant",
        content: state.assistantMessage,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

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

const UK_LIVE_ASSISTED_ENABLED =
  process.env.NEXT_PUBLIC_UK_LIVE_SUBMISSION_ENABLED !== "false";

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
  | "uk"
  | "indonesia"
  | null;

interface VietnamOneTimePaymentCard {
  pan: string;
  expiry: string;
  cvv: string;
  holderName: string;
}

type SubmitCheckState = "idle" | "checking" | "invalid";

const OFFICIAL_PAYMENT_CARD_FIELD_NAMES = {
  pan: "official_payment_card_number",
  expiry: "official_payment_card_expiry",
  cvv: "official_payment_card_cvv",
} as const;

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
  "eTravel Scope": "电子旅行申报范围",
  "Customs Declaration": "海关申报",
  "Declaration": "声明确认",
};

const PH_ETRAVEL_DYNAMIC_STEP_NAME_ZH: Record<string, string> = {
  "Travel Registration": "行程登记",
  "Traveller Information": "旅客信息",
  "Travel Details - Philippine Arrival": "菲律宾入境行程",
  "Philippine Departure Details": "菲律宾出境行程",
  "Philippine Traveller Declarations": "菲律宾旅客申报",
  "Customs and Currency Declaration": "海关与货币申报",
  "Destination in the Philippines": "在菲律宾的目的地",
  "Health Declaration": "健康申报",
  "Other Travel Details": "其他行程信息",
  "Customs Declaration": "海关申报",
  "Declaration Signature": "申报签名",
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
  "Official e-Form Route": "官方电子表单路线",
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

const STEP_KEYS = ["personalInfo", "passport", "travelDetails", "documents", "team", "review"] as const;

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
    (options.visaType === "PH_ETRAVEL_ARRIVAL_CARD" || options.visaType === "PH_ETRAVEL_DEPARTURE_CARD")
  ) {
    return PH_ETRAVEL_DYNAMIC_STEP_NAME_ZH[stepName] ?? ARRIVAL_CARD_DYNAMIC_STEP_NAME_ZH[stepName] ?? stepName;
  }

  if (
    options.isZhInterface &&
    (options.visaType === "SG_ARRIVAL_CARD" ||
      options.visaType === "MY_MDAC_ARRIVAL_CARD" ||
      options.visaType === "TH_TDAC_ARRIVAL_CARD")
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
    <aside className="w-[360px] shrink-0 px-4 pt-4 hidden xl:flex xl:flex-col z-10 overflow-y-auto">
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
                "application-form-panel border bg-white px-5 py-4 flex gap-4 items-center transition-all duration-200 text-left cursor-pointer",
                isSelected
                  ? "application-form-sidebar-panel-selected ring-[1.5px] ring-[#03346E] border-[#03346E] shadow-[0_2px_12px_rgba(3,52,110,0.08)]"
                  : "hover:bg-gray-50",
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
                  <Check className="size-4" weight="bold" />
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
                    status === "complete" && "font-medium text-gray-500",
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
    <div className="xl:hidden mb-6 bg-white rounded-lg border border-gray-100 shadow-sm p-4">
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
                  <Check className="size-3" weight="bold" />
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
    <aside className="w-[380px] shrink-0 px-4 pt-4 hidden xl:flex xl:flex-col z-10 overflow-y-auto">
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
                  "application-form-panel border bg-white px-5 py-4 flex gap-4 items-center transition-all duration-200 text-left cursor-pointer w-full",
                  isSelected
                    ? "application-form-sidebar-panel-selected ring-[1.5px] ring-[#03346E] border-[#03346E] shadow-[0_2px_12px_rgba(3,52,110,0.08)]"
                    : "hover:bg-gray-50",
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
                  {status === "complete" ? <Check className="size-4" weight="bold" /> : sectionIndex + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "text-[15px]",
                      status === "in_progress" && "font-semibold text-[#03346E]",
                      status === "complete" && "font-medium text-gray-500",
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
                "application-form-panel border bg-white overflow-hidden transition-all duration-200",
                activeInSection
                  ? "application-form-sidebar-panel-selected ring-[1.5px] ring-[#03346E] border-[#03346E] shadow-[0_2px_12px_rgba(3,52,110,0.08)]"
                  : "hover:bg-gray-50"
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
                    <Check className="size-4" weight="bold" />
                  ) : (
                    sectionIndex + 1
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "text-[15px] leading-tight truncate",
                      activeInSection && "font-semibold text-[#03346E]",
                      sectionComplete && !activeInSection && "font-medium text-gray-500",
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
                              <Check className="size-5" weight="bold" />
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
                              status === "complete" && "font-medium text-gray-600",
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
    <div className="xl:hidden mb-6 space-y-3">
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
                  {status === "complete" ? <Check className="size-4" weight="bold" /> : sectionIndex + 1}
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-[15px] leading-tight truncate",
                      status === "in_progress" && "font-semibold text-[#03346E]",
                      status === "complete" && "font-medium text-gray-500",
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
                    <Check className="size-4" weight="bold" />
                  ) : (
                    sectionIndex + 1
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-[15px] leading-tight truncate",
                      activeInSection && "font-semibold text-[#03346E]",
                      sectionComplete && !activeInSection && "font-medium text-gray-500",
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
                              <Check className="size-5" weight="bold" />
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
                              status === "complete" && "font-medium text-gray-600",
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
  forceDryRun,
  missingFields,
  requirementsLoading,
  submittingMode,
  submitCheckState,
  onSubmit,
}: {
  isZh: boolean;
  liveAssistedTarget: LiveAssistedTarget;
  liveAssistedEnabled: boolean;
  forceDryRun: boolean;
  missingFields: MissingApplicationField[];
  requirementsLoading: boolean;
  submittingMode: SubmissionMode | null;
  submitCheckState: SubmitCheckState;
  onSubmit: (mode: SubmissionMode, vietnamPaymentCard?: VietnamOneTimePaymentCard) => void | Promise<void>;
}) {
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardHolderName, setCardHolderName] = useState("");
  const hasMissing = missingFields.length > 0;
  const isSubmitting = submittingMode !== null;
  const isChecking = submitCheckState === "checking";
  const validationActive = submitCheckState === "invalid";
  const hasLiveAssistedTarget = liveAssistedTarget !== null && !forceDryRun;
  const isFrance = liveAssistedTarget === "france";
  const isVietnam = liveAssistedTarget === "vietnam";
  const isVietnamPrearrival = liveAssistedTarget === "vn_prearrival";
  const isSgac = liveAssistedTarget === "sgac";
  const isMdac = liveAssistedTarget === "mdac";
  const isTdac = liveAssistedTarget === "tdac";
  const isPhEtravel = liveAssistedTarget === "phetravel";
  const isIndonesia = liveAssistedTarget === "indonesia";
  // Indonesia opens its official payment gateway only after the application is
  // created. A card must not block an initial submission or a pre-payment retry.
  const requiresOneTimeOfficialPaymentCard = isVietnam;
  const oneTimeOfficialPaymentCardReady =
    !requiresOneTimeOfficialPaymentCard ||
    (
      cardNumber.replace(/\D/g, "").length >= 12 &&
      cardExpiry.trim().length >= 4 &&
      cardCvv.replace(/\D/g, "").length >= 3
    );
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
  // Missing answers are checked after the click so the final action never
  // becomes an unexplained dead end. Only an in-flight check/submission locks
  // the control against duplicate requests.
  const submitDisabled = isSubmitting || isChecking;
  const officialPaymentCard: VietnamOneTimePaymentCard | undefined = requiresOneTimeOfficialPaymentCard
    ? {
        pan: cardNumber,
        expiry: cardExpiry,
        cvv: cardCvv,
        holderName: cardHolderName,
      }
    : undefined;
  const submitCopy = forceDryRun
    ? isZh
      ? "这是隔离的云端演练，只验证 VIZA 与 Fly 提交链路，不会打开或填写官方 CEAC 网站。"
      : "This isolated cloud dry run verifies the VIZA-to-Fly submission path without opening or filling the official CEAC website."
    : isZh
      ? hasLiveAssistedTarget
        ? "点击“提交”后，VIZA 会创建真实官网提交任务，自动填写官方表单，并在本页显示进度和官方编号。"
        : "点击“提交”后，VIZA 会创建后台提交任务，并在本页显示进度和结果。"
      : hasLiveAssistedTarget
        ? "Click Submit to create a real official-site submission job. VIZA fills the official form and shows progress and official evidence here."
        : "Click Submit to create the background submission job and show progress here.";

  return (
    <div className="space-y-6">
      <Alert variant={hasMissing ? "warning" : "info"}>
        <AlertIcon variant={hasMissing ? "warning" : "info"} />
        <AlertTitle>{isZh ? "最终确认" : "Final confirmation"}</AlertTitle>
        <AlertDescription>
          <p>
            {isChecking
              ? isZh
                ? "正在检查整份申请中的所有必填项。"
                : "Checking every required field in this application."
              : hasMissing
              ? isZh
                ? "提交前还需要补齐信息。请使用上方缺失信息分区的编辑图标返回对应步骤，保存后再回到这里提交。"
                : "Some information is still required. Use the edit icons in the missing-information sections above, save your changes, then return here to submit."
              : requirementsLoading
                ? isZh
                  ? "正在检查支持材料和当前表单状态。完成后才可以提交。"
                  : "Checking supporting documents and current form status. You can submit once this finishes."
              : submitCopy}
          </p>
        </AlertDescription>
      </Alert>

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
                  ? `${isIndonesia ? "印度尼西亚 e-Visa" : "越南 e-Visa"} 提交会在官网付款页继续处理官方费用。请在提交前填写本次使用的银行卡；未填写则不能提交。卡号和 CVV 只会发送到 VIZA submission-service 的短时内存会话，不会保存到数据库、env、日志或个人资料。`
                  : `${isIndonesia ? "Indonesia e-Visa" : "Vietnam e-Visa"} submission continues through the official payment page. Enter the one-time card before submitting. Card number and CVV are sent only to a short-lived VIZA submission-service memory session and are not stored.`}
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label
              className="space-y-1 sm:col-span-2"
              data-application-field-name={OFFICIAL_PAYMENT_CARD_FIELD_NAMES.pan}
            >
              <span className="text-xs text-gray-600">{isZh ? "银行卡号" : "Card number"}</span>
              <ApplicationFormInputGroup
                className={cn(
                  "h-12 bg-white",
                  validationActive && cardNumber.replace(/\D/g, "").length < 12 && "!border-red-500 !shadow-[0_0_0_1px_rgb(239_68_68)]",
                )}
                aria-invalid={validationActive && cardNumber.replace(/\D/g, "").length < 12 || undefined}
              >
                <InputGroupInput
                  value={cardNumber}
                  onChange={(event) => setCardNumber(event.target.value)}
                  autoComplete="cc-number"
                  inputMode="numeric"
                  className="h-12 text-sm"
                  placeholder={isZh ? "请输入银行卡号" : "Enter card number"}
                />
              </ApplicationFormInputGroup>
            </label>
            <label
              className="space-y-1"
              data-application-field-name={OFFICIAL_PAYMENT_CARD_FIELD_NAMES.expiry}
            >
              <span className="text-xs text-gray-600">{isZh ? "有效期" : "Expiry"}</span>
              <ApplicationFormInputGroup
                className={cn(
                  "h-12 bg-white",
                  validationActive && cardExpiry.trim().length < 4 && "!border-red-500 !shadow-[0_0_0_1px_rgb(239_68_68)]",
                )}
                aria-invalid={validationActive && cardExpiry.trim().length < 4 || undefined}
              >
                <InputGroupInput
                  value={cardExpiry}
                  onChange={(event) => setCardExpiry(event.target.value)}
                  autoComplete="cc-exp"
                  inputMode="numeric"
                  className="h-12 text-sm"
                  placeholder="MM/YY"
                />
              </ApplicationFormInputGroup>
            </label>
            <label
              className="space-y-1"
              data-application-field-name={OFFICIAL_PAYMENT_CARD_FIELD_NAMES.cvv}
            >
              <span className="text-xs text-gray-600">CVV</span>
              <ApplicationFormInputGroup
                className={cn(
                  "h-12 bg-white",
                  validationActive && cardCvv.replace(/\D/g, "").length < 3 && "!border-red-500 !shadow-[0_0_0_1px_rgb(239_68_68)]",
                )}
                aria-invalid={validationActive && cardCvv.replace(/\D/g, "").length < 3 || undefined}
              >
                <InputGroupInput
                  value={cardCvv}
                  onChange={(event) => setCardCvv(event.target.value)}
                  autoComplete="cc-csc"
                  inputMode="numeric"
                  className="h-12 text-sm"
                  placeholder="CVV"
                />
              </ApplicationFormInputGroup>
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs text-gray-600">{isZh ? "持卡人姓名（可选）" : "Cardholder name (optional)"}</span>
              <ApplicationFormInputGroup className="h-12 bg-white">
                <InputGroupInput
                  value={cardHolderName}
                  onChange={(event) => setCardHolderName(event.target.value)}
                  autoComplete="cc-name"
                  className="h-12 text-sm"
                  placeholder={isZh ? "不填则使用 VIZA" : "Defaults to VIZA"}
                />
              </ApplicationFormInputGroup>
            </label>
          </div>
          {!oneTimeOfficialPaymentCardReady && (
            <Alert variant="warning">
              <AlertIcon variant="warning" />
              <AlertTitle>{isZh ? "银行卡信息未填写完整" : "Card details incomplete"}</AlertTitle>
              <AlertDescription>
                <p>
                  {isZh
                    ? "请填写银行卡号、有效期和 CVV 后再提交。"
                    : "Enter the card number, expiry, and CVV before submitting."}
                </p>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <button
        type="button"
        disabled={submitDisabled}
        onClick={() => {
          void Promise.resolve(onSubmit(submitMode, officialPaymentCard))
            .catch(() => undefined)
            .finally(() => {
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
        {isChecking ? (
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

      {hasLiveAssistedTarget && liveDisabledReason ? (
        <Alert variant="warning">
          <AlertIcon variant="warning" />
          <AlertTitle>{isZh ? "暂时无法提交" : "Cannot submit yet"}</AlertTitle>
          <AlertDescription>
            <p>{liveDisabledReason}</p>
          </AlertDescription>
        </Alert>
      ) : null}
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
        // DS-160 retries must start a fresh CEAC application even when this
        // VIZA application already has an older successful submission. This
        // helper is also used by the result card's onResubmit path.
        intent: isDs160VisaType(input.visaType) ? "new_application" : "retry",
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
      submissionResult: payload?.result ?? null,
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
    await requestCloudSubmissionWorkerWake(null);
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
      status === "uk_live_assisted_pending" ||
      status === "vn_live_assisted_pending" ||
      status === "vn_cloud_live_pending" ||
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
  await requestCloudSubmissionWorkerWake(null);
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

async function requestCloudSubmissionWorkerWake(jobId: string | null): Promise<void> {
  try {
    const response = await fetch("/api/submission-worker/wake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
      cache: "no-store",
    });
    if (!response.ok) {
      console.warn(`[submission-queue] Cloud worker wake returned ${response.status}; scheduled fallback will retry.`);
    }
  } catch (error) {
    console.warn("[submission-queue] Cloud worker wake failed; scheduled fallback will retry.", error);
  }
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
    queueStatus: typeof payload?.queueStatus === "string" ? payload.queueStatus : "vn_cloud_live_pending",
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

const COUNTRY_ALPHA3_TO_ALPHA2 = new Map(
  (countries.all as Array<{ alpha2: string; alpha3: string; status: string }>)
    .filter((country) => country.status !== "deleted")
    .map((country) => [country.alpha3.toLowerCase(), country.alpha2.toUpperCase()]),
);

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
  const alpha2 = COUNTRY_ALPHA3_TO_ALPHA2.get(normalized);
  if (alpha2) candidates.add(normalizeComparableValue(alpha2));

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

function recoverOrFormatServerActionError(
  error: unknown,
  fallbackMessage: string,
  stalePageMessage: string,
): string | null {
  if (attemptStaleServerActionReload(error)) return null;
  if (isStaleServerActionError(error)) return stalePageMessage;
  return error instanceof Error ? error.message : fallbackMessage;
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
  const requestedVisaType =
    searchParams.get("visaType")?.trim() || searchParams.get("visa_type")?.trim() || null;
  const explicitVisaType = requestedVisaType
    ? resolveVisaFormSchemaVisaType(requestedVisaType, explicitCountry)
    : null;
  const preferExplicitPackage = Boolean(explicitCountry || explicitVisaType);
  const isExplicitStatusView = Boolean(explicitApplicationId && jumpToConfirmation);

  // DB-driven steps (loaded from visa_form_fields table)
  // Falls back to hardcoded STEPS if DB returns empty
  const [dbSteps, setDbSteps] = useState<WizardStep[]>([]);
  const [visaPackage, setVisaPackage] = useState<UserVisaPackage | null>(null);
  const [packageLoaded, setPackageLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const packagePromise: Promise<UserVisaPackage | null> =
      explicitVisaType || isExplicitStatusView
        ? Promise.resolve(null)
        : getUserVisaPackage().catch((error) => {
            attemptStaleServerActionReload(error);
            return null;
          });
    if (!explicitVisaType && !isExplicitStatusView) {
      void packagePromise.then((pkg) => {
        if (!cancelled && pkg) setVisaPackage(pkg);
      });
    }

    // A persisted submission/payment status view does not need the complete
    // form schema. Loading that schema can be slow (or temporarily unavailable)
    // for older packages such as Indonesia C1, and must not prevent the user
    // from seeing a terminal result or starting an explicit payment retry.
    if (isExplicitStatusView) {
      setDbSteps([]);
      setPackageLoaded(true);
      return () => {
        cancelled = true;
      };
    }

    const stepsPromise = explicitVisaType
      ? getVisaFormSteps(explicitVisaType, { country: explicitCountry })
      : packagePromise.then((pkg) => getVisaFormSteps(
          pkg?.visa_type ?? "ID_C1_TOURIST",
          { country: pkg?.country ?? null },
        ));

    void stepsPromise
      .then((steps) => {
        if (!cancelled && steps.length > 0) {
          setDbSteps(ensureVnPrearrivalOtherFlightFlow(steps));
        }
      })
      .catch((error) => {
        attemptStaleServerActionReload(error);
        // Silent fallback to hardcoded steps
      })
      .finally(() => {
        if (!cancelled) setPackageLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [explicitCountry, explicitVisaType, isExplicitStatusView]);

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
  const [autosaving, setAutosaving] = useState(false);
  const [autosaveFailed, setAutosaveFailed] = useState(false);
  const [submittingMode, setSubmittingMode] = useState<SubmissionMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitMissingFields, setSubmitMissingFields] = useState<MissingApplicationField[]>([]);
  const [submitCheckState, setSubmitCheckState] = useState<SubmitCheckState>("idle");
  const [forceDryRun, setForceDryRun] = useState(false);
  // Dynamic form answers keyed by field_name
  const [dynamicAnswers, setDynamicAnswers] = useState<Record<string, string>>({});
  const [externalAnswerRevision, setExternalAnswerRevision] = useState(0);
  const [formAssistantState, setFormAssistantState] = useState<FormAssistantState | null>(null);
  const [formAssistantBusy, setFormAssistantBusy] = useState(false);
  const [formAssistantReloadKey, setFormAssistantReloadKey] = useState(0);
  const [formAssistantValidation, setFormAssistantValidation] = useState<FormAssistantValidationResponse | null>(null);
  const [formAssistantValidationDirty, setFormAssistantValidationDirty] = useState(false);
  const [formAssistantUnavailable, setFormAssistantUnavailable] = useState(false);
  const [aiFilledFieldNames, setAiFilledFieldNames] = useState<string[]>([]);
  const [formAssistantFillNotice, setFormAssistantFillNotice] = useState<FormAssistantFillNotice | null>(null);
  const [draftVersion, setDraftVersion] = useState(0);
  const [documentCenterData, setDocumentCenterData] = useState<DocumentCenterData | null>(null);
  const [documentCenterError, setDocumentCenterError] = useState<string | null>(null);
  const [documentCenterLoaded, setDocumentCenterLoaded] = useState(false);
  const [localPassportBioPageName, setLocalPassportBioPageName] = useState<string | null>(null);
  const [contentAlignment, setContentAlignment] = useState(0);
  const initialStepResolvedRef = useRef(false);
  const loadDataRequestRef = useRef(0);
  const formAssistantDraftBootstrapRef = useRef<{
    key: string;
    promise: ReturnType<typeof ensureDraftApplication>;
  } | null>(null);
  const dynamicDraftRef = useRef<Record<number, Record<string, string>>>({});
  const externalDraftProtectionRef = useRef<{ fieldNames: Set<string>; expiresAt: number } | null>(null);
  const draftVersionTimerRef = useRef<number | null>(null);
  const autosaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const autosaveRequestRef = useRef(0);
  const navigationSaveInFlightRef = useRef(false);
  const hasLiveSaveActivityRef = useRef(false);
  const applicationContentRef = useRef<HTMLElement | null>(null);
  const formAssistantRef = useRef<HTMLDivElement | null>(null);
  const stepPanelRefs = useRef(new Map<number, HTMLDivElement>());

  const markLiveSaveActivity = useCallback(() => {
    hasLiveSaveActivityRef.current = true;
    window.dispatchEvent(new CustomEvent("viza:live-save-status", {
      detail: { status: "saving" },
    }));
  }, []);

  useEffect(() => {
    const hasActiveSave = saving || autosaving || autosaveFailed;
    if (!hasLiveSaveActivityRef.current) return;

    window.dispatchEvent(new CustomEvent("viza:live-save-status", {
      detail: {
        status: hasActiveSave ? "saving" : "saved",
      },
    }));
  }, [autosaveFailed, autosaving, saving]);

  useEffect(() => {
    const resetLiveSaveStatus = () => {
      hasLiveSaveActivityRef.current = false;
      window.dispatchEvent(new CustomEvent("viza:live-save-status", {
        detail: { status: "idle" },
      }));
    };

    resetLiveSaveStatus();
    return resetLiveSaveStatus;
  }, [explicitApplicationId, explicitCountry, explicitVisaType]);

  const setStepPanelRef = useCallback((stepId: number, node: HTMLDivElement | null) => {
    if (node) {
      stepPanelRefs.current.set(stepId, node);
    } else {
      stepPanelRefs.current.delete(stepId);
    }
  }, []);

  const scrollToStepPanel = useCallback((stepId: number, behavior: ScrollBehavior = "smooth") => {
    setCurrentStep(stepId);

    // The target may have just become visible because a conditional step was
    // added. Waiting one frame lets React commit it before we scroll.
    window.requestAnimationFrame(() => {
      const target = stepPanelRefs.current.get(stepId);
      if (!target) return;

      const firstPanel = Array.from(stepPanelRefs.current.values())
        .sort((left, right) => left.offsetTop - right.offsetTop)[0];
      if (target === firstPanel) {
        if (window.matchMedia("(min-width: 1024px)").matches && applicationContentRef.current) {
          applicationContentRef.current.scrollTo({ top: 0, behavior });
        } else {
          window.scrollTo({ top: 0, behavior });
        }
        return;
      }

      target.scrollIntoView({ behavior, block: "start" });
    });
  }, []);

  useLayoutEffect(() => {
    const syncNavAlignment = () => {
      const homeAnchor = Array.from(document.querySelectorAll<HTMLElement>("[data-nav-anchor='Home']"))
        .find((element) => element.getBoundingClientRect().width > 0);
      const content = applicationContentRef.current;
      if (!homeAnchor || !content) return;

      const homeLeft = homeAnchor.getBoundingClientRect().left;
      setContentAlignment(Math.max(0, homeLeft - content.getBoundingClientRect().left));
    };

    syncNavAlignment();
    const alignmentFrame = window.requestAnimationFrame(syncNavAlignment);
    const alignmentTimer = window.setTimeout(syncNavAlignment, 100);
    const alignmentObserver = new MutationObserver(syncNavAlignment);
    alignmentObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-nav-anchor"],
    });
    window.addEventListener("resize", syncNavAlignment);
    return () => {
      window.cancelAnimationFrame(alignmentFrame);
      window.clearTimeout(alignmentTimer);
      alignmentObserver.disconnect();
      window.removeEventListener("resize", syncNavAlignment);
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

  const handleDynamicDraftChange = useCallback((stepId: number, data: Record<string, string>) => {
    const protection = externalDraftProtectionRef.current;
    let nextData = data;
    if (protection && protection.expiresAt >= Date.now()) {
      nextData = { ...data };
      for (const fieldName of protection.fieldNames) delete nextData[fieldName];
    } else if (protection) {
      externalDraftProtectionRef.current = null;
    }
    dynamicDraftRef.current[stepId] = nextData;
    const manuallyChangedAiFields = new Set(
      Object.entries(nextData)
        .filter(([fieldName, value]) =>
          aiFilledFieldNames.includes(fieldName) && (dynamicAnswers[fieldName] ?? "") !== value,
        )
        .map(([fieldName]) => fieldName),
    );
    if (manuallyChangedAiFields.size > 0) {
      setAiFilledFieldNames((current) => current.filter((fieldName) => !manuallyChangedAiFields.has(fieldName)));
    }
    const hasChangedValue = Object.entries(nextData).some(
      ([fieldName, value]) => (dynamicAnswers[fieldName] ?? "") !== value,
    );
    if (hasChangedValue) {
      if (formAssistantValidation) setFormAssistantValidationDirty(true);
      setAutosaveFailed(false);
      setAutosaving(true);
    }
    // Let a large official select close before recalculating outer step visibility.
    if (draftVersionTimerRef.current !== null) window.clearTimeout(draftVersionTimerRef.current);
    draftVersionTimerRef.current = window.setTimeout(() => {
      draftVersionTimerRef.current = null;
      setDraftVersion((version) => version + 1);
    }, 120);
    setSubmitMissingFields([]);
  }, [aiFilledFieldNames, dynamicAnswers, formAssistantValidation]);

  useEffect(() => () => {
    if (draftVersionTimerRef.current !== null) window.clearTimeout(draftVersionTimerRef.current);
  }, []);

  const resolvedCountry = explicitCountry ?? visaPackage?.country ?? "indonesia";
  const resolvedVisaType = explicitVisaType ?? visaPackage?.visa_type ?? "ID_C1_TOURIST";
  const isTaiwanEntryPermit = resolvedVisaType === "TW_ENTRY_PERMIT";
  const isArrivalCardApplication = isDigitalArrivalCardApplication(resolvedCountry, resolvedVisaType);
  const isPhilippinesEtravel = isPhilippinesEtravelApplication(resolvedCountry, resolvedVisaType);
  const showDocumentStep = !isArrivalCardApplication || isPhilippinesEtravel;
  const showStandaloneDocumentStep = shouldShowStandaloneDocumentStep(showDocumentStep, resolvedVisaType);
  // Companion questions required by an official visa schema remain regular
  // dynamic form steps. The standalone VIZA Team workflow is deferred.
  const showTeamStep = false;
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
  const formAssistantSchemaFieldCount = dbSteps.reduce((count, step) => count + step.fields.length, 0);
  const formAssistantEligible = canUseFormAssistant({
    applicationId: appState.applicationId,
    visaType: resolvedVisaType,
    schemaFieldCount: formAssistantSchemaFieldCount,
  });
  const showFormFillingAssistant = formAssistantEligible && !formAssistantUnavailable;

  useEffect(() => {
    const applicationId = appState.applicationId;
    if (!formAssistantEligible || !applicationId) {
      setFormAssistantState(null);
      setAiFilledFieldNames([]);
      setFormAssistantFillNotice(null);
      setFormAssistantUnavailable(false);
      return;
    }
    const controller = new AbortController();
    setFormAssistantUnavailable(false);
    setFormAssistantBusy(true);
    fetch(`/api/applications/${applicationId}/form-assistant?locale=${encodeURIComponent(locale)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Form assistant returned ${response.status}`);
        return response.json() as Promise<FormAssistantState>;
      })
      .then((state) => {
        if (controller.signal.aborted) return;
        setFormAssistantState(prepareFormAssistantState(state));
        setAiFilledFieldNames(state.aiFilledFieldNames);
      })
      .catch((assistantError) => {
        if (!controller.signal.aborted) {
          console.warn("Unable to load form assistant", assistantError);
          setFormAssistantUnavailable(true);
          setFormAssistantState(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setFormAssistantBusy(false);
      });
    return () => controller.abort();
  }, [appState.applicationId, formAssistantEligible, formAssistantReloadKey, locale]);

  // A concurrent Server Action refresh can remount the client subtree after a
  // successful assistant request and leave the card in its empty 0 / 0 shell.
  // Recover that state automatically instead of asking the applicant to reload.
  useEffect(() => {
    if (
      !formAssistantEligible ||
      !appState.applicationId ||
      formAssistantBusy ||
      formAssistantUnavailable ||
      formAssistantState
    ) return;
    const retryTimer = window.setTimeout(() => {
      setFormAssistantReloadKey((key) => key + 1);
    }, 1_500);
    return () => window.clearTimeout(retryTimer);
  }, [
    appState.applicationId,
    formAssistantBusy,
    formAssistantEligible,
    formAssistantState,
    formAssistantUnavailable,
  ]);
  const isMalaysiaMdac = isMalaysiaMdacApplication(resolvedCountry, resolvedVisaType);
  const isThailandTdac = isThailandTdacApplication(resolvedCountry, resolvedVisaType);
  const isUkStandardVisitor = isUkStandardVisitorApplication(resolvedCountry, resolvedVisaType);
  const isIndonesiaEVisa = isIndonesiaEVisaApplication(resolvedCountry, resolvedVisaType);
  const preserveIndonesiaReview =
    isIndonesiaEVisa || isIndonesiaEVisaApplication(explicitCountry, requestedVisaType);
  const liveAssistedTarget: LiveAssistedTarget = isDs160Application
    ? "ds160"
    : isFranceSchengenApplication
      ? "france"
      : isUkStandardVisitor
        ? "uk"
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
      : liveAssistedTarget === "uk"
        ? UK_LIVE_ASSISTED_ENABLED
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
  const teamStepIndex = dbSteps.length + (showStandaloneDocumentStep ? 1 : 0);
  const reviewStepIndex = teamStepIndex + (showTeamStep ? 1 : 0);
  const statusStepIndex = reviewStepIndex;
  const fallbackTeamStepIndex = 4;
  const fallbackReviewStepIndex = showTeamStep ? 5 : 4;
  const fallbackStatusStepIndex = fallbackReviewStepIndex;

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
    null;
  const passportOcrInitialUploaded = Boolean(
    localPassportBioPageName ||
    passportBioPageDocument,
  );
  const showPassportOcrUpload = !hasUniversalPassportPrefill || passportOcrInitialUploaded;

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
        ...(showStandaloneDocumentStep
          ? [
              {
                id: documentStepIndex,
                sourceName: "Supporting Documents",
                name: isPhilippinesEtravel && isZhInterface
                  ? "附加材料"
                  : tDyn.has("Supporting Documents") ? tDyn("Supporting Documents" as never) : isZhInterface ? "材料" : "Documents",
                description: tApp.has("documentsStepDescription") ? tApp("documentsStepDescription" as never) : "Upload required and optional supporting documents",
              },
            ]
          : []),
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
          id: reviewStepIndex,
          sourceName: "Review",
          name: resolvedVisaType === "VN_PREARRIVAL_DECLARATION"
            ? VN_PREARRIVAL_DYNAMIC_STEP_NAME_ZH.Review
            : isPhilippinesEtravel && isZhInterface
              ? "核对信息"
            : tDyn.has("Review") ? tDyn("Review" as never) : isZhInterface ? "审核申请" : "Review Application",
          description: tApp.has("reviewStepDescription") ? tApp("reviewStepDescription" as never) : "Review, confirm, and submit your details",
        },
      ]
        : [...STEPS],
    [
      documentStepIndex,
      reviewStepIndex,
      showStandaloneDocumentStep,
      showTeamStep,
      STEPS,
      teamStepIndex,
      resolvedVisaType,
      isPhilippinesEtravel,
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
      if (isTaiwanEntryPermit) return buildTaiwanEntryPermitSections(sourceOrderedSteps);
      const sections = buildApplicationStepSections(sourceOrderedSteps, dynamicSectionTitles);
      if (isPhilippinesEtravel) {
        return sections.map((section) =>
          section.steps.some((step) =>
            step.sourceName === "Customs Declaration" || step.sourceName === "Declaration Signature",
          )
            ? { ...section, title: isZhInterface ? "海关申报与签名" : "Customs Declaration and Signature" }
            : section,
        );
      }
      if (!isIndonesiaEVisa) return sections;

      return sections.map((section, index) =>
        index === 0 && section.key === "review"
          ? { ...section, title: isZhInterface ? "申请" : "Apply" }
          : section,
      );
    },
    [dynamicSectionTitles, isIndonesiaEVisa, isPhilippinesEtravel, isTaiwanEntryPermit, isZhInterface, sourceOrderedSteps, useDynamic],
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
      showDocumentStep: showStandaloneDocumentStep,
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
      showStandaloneDocumentStep,
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
  const confirmationMissingFields = forceDryRun
    ? visibleMissingFields.filter((item) => item.stepId !== documentStepIndex)
    : visibleMissingFields;
  const formAssistantFieldReviewIssues = useMemo(
    () => buildFormAssistantFieldReviewIssues(
      formAssistantValidation,
      visibleDynamicSteps.map(({ step }) => step),
    ),
    [formAssistantValidation, visibleDynamicSteps],
  );
  const formAssistantFieldReviewIssueMap = useMemo(
    () => new Map(formAssistantFieldReviewIssues.map((issue) => [issue.fieldName, issue])),
    [formAssistantFieldReviewIssues],
  );
  const formAssistantFieldLocations = useMemo(() => {
    const locations = new Map<string, { field: VisaFormFieldRow; step: WizardStep; stepIndex: number }>();
    dbSteps.forEach((step, stepIndex) => {
      step.fields.forEach((field) => locations.set(field.fieldName, { field, step, stepIndex }));
    });
    return locations;
  }, [dbSteps]);
  const formAssistantDisplayValidation = useMemo(() => {
    if (!formAssistantValidation) return null;
    const expand = (
      issues: FormAssistantValidationResponse["errors"],
      severity: "error" | "warning",
    ): FormAssistantDisplayValidationIssue[] => issues.flatMap((issue) => {
      const fieldNames = issue.fieldNames ?? [];
      return fieldNames.length > 0
        ? fieldNames.map((fieldName) => ({
            id: `${issue.code}:${fieldName}`,
            fieldName,
            message: issue.message,
            severity,
          }))
        : [{ id: issue.code, message: issue.message, severity }];
    });
    return {
      errors: expand(formAssistantValidation.errors, "error"),
      warnings: expand(formAssistantValidation.warnings, "warning"),
      warningsAcknowledged: formAssistantValidation.canReview,
      dirty: formAssistantValidationDirty,
    };
  }, [formAssistantValidation, formAssistantValidationDirty]);
  const formFieldsComplete = useMemo(
    () => tabCompletion.missingFields.every((item) => item.stepId >= documentStepIndex),
    [documentStepIndex, tabCompletion.missingFields],
  );
  const lastVisibleFormStepId = visibleDynamicSteps.at(-1)?.sourceIndex ?? null;
  const invalidFieldNamesByStep = useMemo(() => {
    const fieldsByStep = new Map<number, Set<string>>();
    if (submitCheckState !== "invalid") return fieldsByStep;

    for (const item of confirmationMissingFields) {
      const fieldNames = fieldsByStep.get(item.stepId) ?? new Set<string>();
      fieldNames.add(item.fieldName);
      fieldsByStep.set(item.stepId, fieldNames);
    }
    return fieldsByStep;
  }, [confirmationMissingFields, submitCheckState]);
  const showSubmissionStatusStep = shouldShowSubmissionStatusStep({
    submittedAt: appState.submittedAt,
    submissionResultStatus: appState.submissionResultStatus,
    submissionResult: appState.submissionResult,
  });
  // A submission/status card must never replace the saved application review.
  // This applies uniformly to pending, payment, handoff, success, retry, and
  // failure states across every long-form country workflow.
  const showReviewAlongsideSubmissionStatus = shouldShowReviewAlongsideSubmissionStatus();

  useEffect(() => {
    if (loading || effectiveSteps.length === 0) return;
    setCompletedUpTo(getContiguousCompletedCount(effectiveSteps, completedStepIds));
  }, [completedStepIds, effectiveSteps, loading]);

  useEffect(() => {
    loadDataRequestRef.current += 1;
    setLoading(true);
    setError(null);
    setCurrentStep(0);
    setCompletedUpTo(0);
    setDynamicAnswers({});
    setSubmitCheckState("idle");
    setSubmitMissingFields([]);
    setFormAssistantValidation(null);
    setFormAssistantValidationDirty(false);
    initialStepResolvedRef.current = false;
    setAppState((prev) => ({
      ...prev,
      applicationId: null,
      confirmationNumber: undefined,
      submittedAt: undefined,
      submissionResult: null,
      submissionResultStatus: null,
    }));
  }, [explicitApplicationId, resolvedCountry, resolvedVisaType]);

  const loadData = useCallback(async () => {
    const requestId = ++loadDataRequestRef.current;
    const isLatestRequest = () => loadDataRequestRef.current === requestId;

    try {
      let profile: LoadedApplicantProfile | null = null;
      let application: LoadedApplication | null = null;

      if (explicitApplicationId) {
        const context = await getTeamApplicationContext(explicitApplicationId);
        if (!context.ok || !context.application || !context.profile) {
          if (isLatestRequest()) {
            setError(context.reason ?? t("errors.noApplicationFound"));
          }
          return;
        }
        profile = context.profile as LoadedApplicantProfile;
        application = context.application as LoadedApplication;
      } else {
        const context = await loadApplicationFormContext(resolvedCountry, resolvedVisaType, {
          preferExplicit: preferExplicitPackage,
        });
        if (context.error) {
          if (isLatestRequest()) setError(context.error);
          return;
        }
        profile = (context.profile as LoadedApplicantProfile | null) ?? null;
        application = (context.application as LoadedApplication | null) ?? null;
      }

      if (shouldBootstrapFormAssistantDraft({
        applicationId: application?.id,
        country: resolvedCountry,
        visaType: resolvedVisaType,
        hasFormSchema: dbSteps.some((step) => step.fields.length > 0),
      })) {
        const bootstrapKey = `${resolvedCountry}:${resolvedVisaType}`;
        if (formAssistantDraftBootstrapRef.current?.key !== bootstrapKey) {
          formAssistantDraftBootstrapRef.current = {
            key: bootstrapKey,
            promise: ensureDraftApplication(resolvedCountry, resolvedVisaType, {
              preferExplicit: preferExplicitPackage,
            }),
          };
        }
        const draftResult = await formAssistantDraftBootstrapRef.current.promise;
        if (draftResult.error || !draftResult.applicationId) {
          formAssistantDraftBootstrapRef.current = null;
          throw new Error(draftResult.error ?? t("errors.noApplicationFound"));
        }
        application = {
          ...(application ?? {}),
          id: draftResult.applicationId,
          country: resolvedCountry,
          visa_type: resolvedVisaType,
          status: "draft",
        };
      }

      if (application?.id && preferExplicitPackage) {
        const applicationCountry = getCanonicalVisaDestinationCountry(application.country ?? "");
        const routeCountry = getCanonicalVisaDestinationCountry(resolvedCountry);
        const applicationVisaType = getFormVisaType(application.visa_type ?? "").toLowerCase();
        const routeVisaType = getFormVisaType(resolvedVisaType).toLowerCase();
        if (applicationCountry !== routeCountry || applicationVisaType !== routeVisaType) {
          if (isLatestRequest()) {
            setError(
              isZhInterface
                ? "当前申请与页面国家不一致。为避免提交到错误的官网，系统已停止本次操作，请从“我的申请”重新打开正确申请。"
                : "This application does not match the country shown on the page. Submission was stopped to prevent filing with the wrong official portal. Reopen the correct application from My Applications.",
            );
          }
          return;
        }
      }

      if (!isLatestRequest()) return;
      setForceDryRun(application?.purpose === "VIZA_PLACEHOLDER_DRY_RUN");

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

        if (!isLatestRequest()) return;

        // Hydrate hardcoded steps from DS-160 answers first, falling back to profile/application
        const a = ds160Answers;
        setAppState((prev) => ({
          ...prev,
          applicationId: application?.id ?? prev.applicationId,
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
          submittedAt: application?.submitted_at ?? prev.submittedAt,
          submissionResult:
            (application?.submission_result as SubmissionResult | null) ?? prev.submissionResult,
          submissionResultStatus:
            (application?.submission_result_status as SubmissionResultStatus | null) ??
            prev.submissionResultStatus,
        }));

        if (!initialStepResolvedRef.current) {
          const shouldOpenConfirmation = shouldShowSubmissionStatusStep({
            submittedAt: application?.submitted_at ?? null,
            submissionResultStatus:
              (application?.submission_result_status as SubmissionResultStatus | null) ?? null,
            submissionResult: (application?.submission_result as SubmissionResult | null) ?? null,
          });
          scrollToStepPanel(shouldOpenConfirmation ? statusStepIndex : 0, "auto");
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
      const message = recoverOrFormatServerActionError(
        err,
        t("errors.noApplicationFound"),
        t("errors.stalePage"),
      );
      if (message && isLatestRequest()) setError(message);
    } finally {
      if (isLatestRequest()) setLoading(false);
    }
  }, [dbSteps, explicitApplicationId, isZhInterface, preferExplicitPackage, resolvedCountry, resolvedVisaType, scrollToStepPanel, statusStepIndex, t]);

  useEffect(() => {
    if (!packageLoaded || isExplicitStatusView) return;
    void loadData();
  }, [isExplicitStatusView, loadData, packageLoaded]);

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
    scrollToStepPanel(targetId, "auto");
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
    scrollToStepPanel,
    useDynamic,
  ]);

  useEffect(() => {
    if (!useDynamic || effectiveSteps.length === 0) return;
    if (effectiveSteps.some((step) => step.id === currentStep)) return;

    const fallbackStep = [...effectiveSteps].reverse().find((step) => step.id < currentStep) ?? effectiveSteps[0];
    if (fallbackStep && fallbackStep.id !== currentStep) {
      scrollToStepPanel(fallbackStep.id, "auto");
      const fallbackIndex = effectiveSteps.findIndex((step) => step.id === fallbackStep.id);
      if (fallbackIndex >= 0) {
        setCompletedUpTo((current) => Math.min(current, fallbackIndex));
      }
    }
  }, [currentStep, effectiveSteps, scrollToStepPanel, useDynamic]);

  // Merge only submission fields from Realtime updates. Re-fetching the whole
  // application on every runner stage update remounts the large form tree and
  // makes the submission progress UI appear to restart.
  useEffect(() => {
    const applicationId = appState.applicationId;
    if (!applicationId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`application-page-realtime:${applicationId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "applications",
          filter: `id=eq.${applicationId}`,
        },
        (payload) => {
          const updated = payload.new as LoadedApplication;
          if (updated.id && updated.id !== applicationId) return;

          setAppState((previous) => {
            const nextApplicationId = updated.id ?? previous.applicationId;
            const nextConfirmationNumber =
              updated.confirmation_number ?? previous.confirmationNumber;
            const nextSubmittedAt = updated.submitted_at ?? previous.submittedAt;
            const nextSubmissionResultStatus =
              (updated.submission_result_status as SubmissionResultStatus | null | undefined) ??
              previous.submissionResultStatus;
            const submissionMetadataChanged =
              nextConfirmationNumber !== previous.confirmationNumber ||
              nextSubmittedAt !== previous.submittedAt ||
              nextSubmissionResultStatus !== previous.submissionResultStatus;
            const incomingSubmissionResult = updated.submission_result as
              | SubmissionResult
              | null
              | undefined;
            const nextSubmissionResult =
              incomingSubmissionResult &&
              (previous.submissionResult === null || submissionMetadataChanged)
                ? incomingSubmissionResult
                : previous.submissionResult;

            if (
              nextApplicationId === previous.applicationId &&
              nextConfirmationNumber === previous.confirmationNumber &&
              nextSubmittedAt === previous.submittedAt &&
              nextSubmissionResultStatus === previous.submissionResultStatus &&
              nextSubmissionResult === previous.submissionResult
            ) {
              return previous;
            }

            return {
              ...previous,
              applicationId: nextApplicationId,
              confirmationNumber: nextConfirmationNumber,
              submittedAt: nextSubmittedAt,
              submissionResult: nextSubmissionResult,
              submissionResultStatus: nextSubmissionResultStatus,
            };
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [appState.applicationId]);

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

    const changedData = Object.fromEntries(
      Object.entries(data).filter(
        ([fieldName, value]) => (dynamicAnswers[fieldName] ?? "") !== value,
      ),
    );
    if (Object.keys(changedData).length === 0) return;

    const applicationId = await ensureWritableApplicationId();
    const saveResult = await saveDynamicAnswers(applicationId, changedData);
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

    const changedDraft = Object.fromEntries(
      draftEntries.filter(
        ([fieldName, value]) => (dynamicAnswers[fieldName] ?? "") !== value,
      ),
    );
    if (Object.keys(changedDraft).length === 0) return;

    const applicationId = await ensureWritableApplicationId();
    const saveResult = await saveDynamicAnswers(applicationId, changedDraft);
    if (saveResult.error) throw new Error(saveResult.error);

    setDynamicAnswers((prev) => ({ ...prev, ...mergedDraft }));
    setSubmitMissingFields([]);
  }, [dynamicAnswers, ensureWritableApplicationId]);

  const handleFormAssistantSend = useCallback(async (text: string) => {
    const applicationId = appState.applicationId;
    if (!applicationId) throw new Error(t("errors.noApplicationFound"));
    const optimisticMessageId = `user-pending-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    setFormAssistantBusy(true);
    setFormAssistantValidation(null);
    setFormAssistantValidationDirty(false);
    setFormAssistantState((current) => current ? {
      ...current,
      messages: [
        ...current.messages,
        { id: optimisticMessageId, role: "user", content: text, createdAt: now },
      ],
    } : current);
    try {
      await saveAllDynamicDrafts();
      const response = await fetch(`/api/applications/${applicationId}/form-assistant/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          locale,
          inputMode: "text",
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const payload = await response.json() as FormAssistantTurnResponse & {
        error?: string;
        code?: string;
      };
      if (!response.ok) {
        const requestError = new Error(payload.error ?? "Form assistant request failed") as FormAssistantRequestError;
        requestError.code = payload.code;
        throw requestError;
      }

      if (payload.appliedPatches.length > 0) {
        const fields = dbSteps.flatMap((step) => step.fields);
        const patch = Object.fromEntries(payload.appliedPatches.map((item) => [item.fieldName, item.value]));
        for (const item of payload.appliedPatches) {
          // Assistant values are persisted in the schema's official value.
          // Remove stale bilingual draft aliases so a prior manual `_zh` or
          // `_en` value cannot visually override the correction on reload.
          delete patch[`${item.fieldName}_zh`];
          delete patch[`${item.fieldName}_en`];
          const stepIndex = dbSteps.findIndex((step) =>
            step.fields.some((field) => field.fieldName === item.fieldName),
          );
          if (stepIndex >= 0) {
            // The assistant route already persisted this patch with
            // `source=form_assistant`. Do not leave a duplicate local draft:
            // the autosave path labels drafts as `user_form`, which would
            // otherwise erase provenance and make a later chat correction look
            // like a conflict with manual input.
            const existingDraft = dynamicDraftRef.current[stepIndex];
            if (existingDraft && Object.prototype.hasOwnProperty.call(existingDraft, item.fieldName)) {
              const {
                [item.fieldName]: _assistantPatchedField,
                [`${item.fieldName}_zh`]: _assistantPatchedFieldZh,
                [`${item.fieldName}_en`]: _assistantPatchedFieldEn,
                ...remainingDraft
              } = existingDraft;
              dynamicDraftRef.current[stepIndex] = remainingDraft;
            }
          }
        }
        externalDraftProtectionRef.current = {
          fieldNames: new Set(payload.appliedPatches.flatMap((item) => [
            item.fieldName,
            `${item.fieldName}_zh`,
            `${item.fieldName}_en`,
          ])),
          expiresAt: Date.now() + 5_000,
        };
        setDynamicAnswers((current) => {
          const next = { ...current };
          for (const item of payload.appliedPatches) {
            delete next[`${item.fieldName}_zh`];
            delete next[`${item.fieldName}_en`];
          }
          return { ...next, ...patch };
        });
        setExternalAnswerRevision((current) => current + 1);
        setAiFilledFieldNames((current) => Array.from(new Set([
          ...current,
          ...payload.appliedPatches.map((item) => item.fieldName),
        ])));
        const noticeItems = payload.appliedPatches.flatMap<FormAssistantFillNoticeItem>((item) => {
          const field = fields.find((candidate) => candidate.fieldName === item.fieldName);
          if (!field) return [];
          return [{
            fieldName: item.fieldName,
            label: formAssistantFieldLabel(field, isZhInterface),
            value: item.value,
            displayValue: formAssistantDisplayValue(field, item.value, locale, isZhInterface),
          }];
        });
        if (noticeItems.length > 0) {
          setFormAssistantFillNotice({ id: crypto.randomUUID(), items: noticeItems });
        }
      }
      setFormAssistantState((current) => current ? {
        ...current,
        ...payload,
        messages: [
          ...current.messages,
          { id: `assistant-${crypto.randomUUID()}`, role: "assistant", content: payload.assistantMessage, createdAt: now },
        ],
        aiFilledFieldNames: Array.from(new Set([
          ...current.aiFilledFieldNames,
          ...payload.appliedPatches.map((item) => item.fieldName),
        ])),
      } : current);
    } catch (sendError) {
      setFormAssistantState((current) => current ? {
        ...current,
        messages: current.messages.filter((message) => message.id !== optimisticMessageId),
      } : current);
      throw sendError;
    } finally {
      setFormAssistantBusy(false);
    }
  }, [appState.applicationId, dbSteps, isZhInterface, locale, saveAllDynamicDrafts, t]);

  const handleFormAssistantUndoFill = useCallback(async (items: FormAssistantFillNoticeItem[]) => {
    const applicationId = appState.applicationId;
    if (!applicationId || items.length === 0) throw new Error("No assistant patch to undo");
    const response = await fetch(`/api/applications/${applicationId}/form-assistant/undo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patches: items.map((item) => ({ fieldName: item.fieldName, value: item.value })),
      }),
    });
    const payload = await response.json() as FormAssistantUndoResponse & { error?: string };
    if (!response.ok || payload.skippedConflicts.length > 0) {
      throw new Error(payload.error ?? "The assistant patch could not be undone");
    }

    const restored = new Map(payload.restored.map((item) => [item.fieldName, item]));
    for (const item of payload.restored) {
      const stepIndex = dbSteps.findIndex((step) =>
        step.fields.some((field) => field.fieldName === item.fieldName),
      );
      if (stepIndex < 0) continue;
      const nextDraft = { ...(dynamicDraftRef.current[stepIndex] ?? {}) };
      if (item.restoredValue === null) delete nextDraft[item.fieldName];
      else nextDraft[item.fieldName] = item.restoredValue;
      dynamicDraftRef.current[stepIndex] = nextDraft;
    }
    setDynamicAnswers((current) => {
      const next = { ...current };
      for (const item of payload.restored) {
        if (item.restoredValue === null) delete next[item.fieldName];
        else next[item.fieldName] = item.restoredValue;
      }
      return next;
    });
    setAiFilledFieldNames((current) => current.filter((fieldName) => {
      const item = restored.get(fieldName);
      return !item || item.restoredSource === "form_assistant";
    }));
    setFormAssistantValidation(null);
    setFormAssistantValidationDirty(false);
    setFormAssistantFillNotice(null);

    const stateResponse = await fetch(
      `/api/applications/${applicationId}/form-assistant?locale=${encodeURIComponent(locale)}`,
      { cache: "no-store" },
    );
    if (stateResponse.ok) {
      const state = await stateResponse.json() as FormAssistantState;
      setFormAssistantState(prepareFormAssistantState(state));
      setAiFilledFieldNames(state.aiFilledFieldNames);
    }
  }, [appState.applicationId, dbSteps, locale]);

  const handleDismissFormAssistantFillNotice = useCallback((noticeId: string) => {
    setFormAssistantFillNotice((current) => current?.id === noticeId ? null : current);
  }, []);

  const handleFormAssistantTranscribe = useCallback(async (file: File): Promise<FormAssistantTranscriptionResponse> => {
    const applicationId = appState.applicationId;
    if (!applicationId) throw new Error(t("errors.noApplicationFound"));
    const formData = new FormData();
    formData.append("audio", file);
    formData.append("language", locale);
    const response = await fetch(`/api/applications/${applicationId}/form-assistant/transcribe`, {
      method: "POST",
      body: formData,
    });
    const payload = await response.json() as FormAssistantTranscriptionResponse & { error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Transcription failed");
    return payload;
  }, [appState.applicationId, locale, t]);

  const navigateFormAssistantToReview = useCallback(() => {
    const targetStepId = useDynamic
      ? (effectiveSteps.find((step) => step.sourceName === "Review")?.id ?? reviewStepIndex)
      : fallbackReviewStepIndex;
    const next = new URLSearchParams(searchParams.toString());
    next.set("step", "review");
    scrollToStepPanel(targetStepId);
    setCompletedUpTo((current) => Math.max(current, getVisibleStepIndex(effectiveSteps, targetStepId) + 1));
    router.replace(`?${next.toString()}`, { scroll: false });
  }, [effectiveSteps, fallbackReviewStepIndex, reviewStepIndex, router, scrollToStepPanel, searchParams, useDynamic]);

  const scrollToFormAssistant = useCallback(() => {
    formAssistantRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.requestAnimationFrame(() => {
      const assistant = formAssistantRef.current;
      const conversation = assistant?.querySelector<HTMLElement>("[role='log']");
      if (conversation) {
        conversation.scrollTo({ top: conversation.scrollHeight, behavior: "smooth" });
      }
      assistant
        ?.querySelector<HTMLElement>("[data-testid='form-assistant-review-action'] button")
        ?.focus({ preventScroll: true });
    });
  }, []);

  const scrollToApplicationField = useCallback((fieldName: string) => {
    const baseFieldName = getBaseAnswerFieldName(fieldName);
    const location = formAssistantFieldLocations.get(baseFieldName);
    if (!location) return;

    setCurrentStep(location.stepIndex);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const panel = stepPanelRefs.current.get(location.stepIndex);
        const target = Array.from(
          panel?.querySelectorAll<HTMLElement>("[data-application-field-name]") ?? [],
        ).find((element) =>
          element.dataset.applicationFieldName === fieldName ||
          element.dataset.applicationFieldName === baseFieldName,
        );
        if (!target) {
          scrollToStepPanel(location.stepIndex);
          return;
        }
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        target.querySelector<HTMLElement>(
          'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), button:not([data-copilot-trigger]):not([disabled]), [role="combobox"]',
        )?.focus({ preventScroll: true });
      });
    });
  }, [formAssistantFieldLocations, scrollToStepPanel]);

  const handleNavigateReviewIssue = useCallback((targetFieldName: string | null) => {
    if (targetFieldName) {
      scrollToApplicationField(targetFieldName);
      return;
    }
    scrollToFormAssistant();
  }, [scrollToApplicationField, scrollToFormAssistant]);

  const renderFormAssistantIssueField = useCallback((issue: FormAssistantDisplayValidationIssue) => {
    if (!issue.fieldName) return null;
    const location = formAssistantFieldLocations.get(getBaseAnswerFieldName(issue.fieldName));
    if (!location) return null;
    const issueStep: WizardStep = {
      ...location.step,
      fields: [location.field],
    };
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3" data-testid={`assistant-issue-editor-${issue.fieldName}`}>
        <DynamicStepForm
          key={`${formAssistantValidation?.validationId ?? "validation"}:${issue.fieldName}`}
          step={issueStep}
          prefill={dynamicAnswerSnapshot}
          onComplete={(data) => handleDynamicDraftChange(location.stepIndex, data)}
          onDraftChange={(data) => handleDynamicDraftChange(location.stepIndex, data)}
          onUserChange={markLiveSaveActivity}
          saving={saving}
          showContinueButton={false}
          country={resolvedCountry}
          visaType={resolvedVisaType}
          invalidFieldNames={issue.severity === "error" ? new Set([issue.fieldName]) : undefined}
          aiFilledFieldNames={new Set(aiFilledFieldNames)}
        />
      </div>
    );
  }, [
    aiFilledFieldNames,
    dynamicAnswerSnapshot,
    formAssistantFieldLocations,
    formAssistantValidation?.validationId,
    handleDynamicDraftChange,
    markLiveSaveActivity,
    resolvedCountry,
    resolvedVisaType,
    saving,
  ]);

  const handleFormAssistantValidate = useCallback(async (): Promise<FormAssistantValidationResponse> => {
    const applicationId = appState.applicationId;
    if (!applicationId) throw new Error(t("errors.noApplicationFound"));
    setFormAssistantBusy(true);
    try {
      await saveAllDynamicDrafts();
      const response = await fetch(`/api/applications/${applicationId}/form-assistant/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      const rawPayload = await response.json() as unknown;
      const responseError = rawPayload && typeof rawPayload === "object" && "error" in rawPayload &&
        typeof (rawPayload as { error?: unknown }).error === "string"
        ? (rawPayload as { error: string }).error
        : null;
      if (!response.ok) throw new Error(responseError ?? "Validation failed");
      const payload = normalizeFormAssistantValidationResponse(rawPayload);
      if (!payload) throw new Error("Invalid validation response");
      setFormAssistantValidation(payload);
      setFormAssistantValidationDirty(false);
      return payload;
    } finally {
      setFormAssistantBusy(false);
    }
  }, [appState.applicationId, locale, saveAllDynamicDrafts, t]);

  const handleFormAssistantAcknowledgeWarnings = useCallback(async () => {
    const applicationId = appState.applicationId;
    if (!applicationId || !formAssistantValidation) return;
    setFormAssistantBusy(true);
    try {
      const response = await fetch(`/api/applications/${applicationId}/form-assistant/acknowledge-warnings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          validationId: formAssistantValidation.validationId,
          warningCodes: formAssistantValidation.warnings.map((warning) => warning.code),
        }),
      });
      const payload = await response.json() as { canReview?: boolean; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Warning acknowledgement failed");
      setFormAssistantValidation((current) => current ? { ...current, canReview: true } : current);
    } finally {
      setFormAssistantBusy(false);
    }
  }, [appState.applicationId, formAssistantValidation]);

  const handleFormAssistantGoToReview = useCallback(() => {
    if (!formAssistantValidation?.canReview || formAssistantValidationDirty) return;
    navigateFormAssistantToReview();
  }, [formAssistantValidation?.canReview, formAssistantValidationDirty, navigateFormAssistantToReview]);

  useEffect(() => {
    if (!useDynamic || loading || draftVersion === 0) return;

    if (saving) {
      setAutosaving(false);
      return;
    }

    const pendingDraft = collectDraftAnswers(dynamicDraftRef.current);
    const hasChangedValue = Object.entries(pendingDraft).some(
      ([fieldName, value]) => (dynamicAnswers[fieldName] ?? "") !== value,
    );

    if (!hasChangedValue) {
      setAutosaveFailed(false);
      setAutosaving(false);
      return;
    }

    const requestId = ++autosaveRequestRef.current;
    setAutosaving(true);

    const timer = window.setTimeout(() => {
      const changedDraft = Object.fromEntries(
        Object.entries(pendingDraft).filter(
          ([fieldName, value]) => (dynamicAnswers[fieldName] ?? "") !== value,
        ),
      );
      if (Object.keys(changedDraft).length === 0) {
        setAutosaveFailed(false);
        setAutosaving(false);
        return;
      }
      const runAutosave = autosaveQueueRef.current.then(async () => {
        const applicationId = await ensureWritableApplicationId();
        const saveResult = await saveDynamicAnswers(applicationId, changedDraft);
        if (saveResult.error) throw new Error(saveResult.error);
      });

      autosaveQueueRef.current = runAutosave.then(
        () => undefined,
        () => undefined,
      );

      void runAutosave.then(
        () => {
          if (requestId !== autosaveRequestRef.current) return;
          setDynamicAnswers((previous) => ({ ...previous, ...changedDraft }));
          setAutosaveFailed(false);
          setAutosaving(false);
        },
        (err: unknown) => {
          if (requestId !== autosaveRequestRef.current) return;
          const message = recoverOrFormatServerActionError(
            err,
            t("errors.failedToSave"),
            t("errors.stalePage"),
          );
          if (message) setError(message);
          setAutosaveFailed(true);
          setAutosaving(false);
        },
      );
    }, 800);

    return () => window.clearTimeout(timer);
  }, [draftVersion, dynamicAnswers, ensureWritableApplicationId, loading, saving, t, useDynamic]);

  useEffect(() => () => {
    autosaveRequestRef.current += 1;
  }, []);

  const handleStepNavigation = useCallback(async (targetStepId: number) => {
    if (navigationSaveInFlightRef.current) return;

    // Jump immediately, then persist the section the user just left. The save
    // is important, but it should never make sidebar navigation feel blocked.
    scrollToStepPanel(targetStepId);
    if (targetStepId === currentStep) return;

    const shouldAutosaveCurrentStep =
      useDynamic &&
      currentStep < documentStepIndex &&
      Boolean(dbSteps[currentStep]);

    if (!shouldAutosaveCurrentStep) {
      return;
    }

    navigationSaveInFlightRef.current = true;
    setSaving(true);
    setError(null);

    try {
      await saveDynamicDraftForStep(currentStep);
      // Saving can reveal or hide conditional fields above the destination.
      // Re-anchor after that layout change so the requested panel stays put.
      scrollToStepPanel(targetStepId);
    } catch (err) {
      const message = recoverOrFormatServerActionError(
        err,
        t("errors.failedToSave"),
        t("errors.stalePage"),
      );
      if (message) setError(message);
    } finally {
      navigationSaveInFlightRef.current = false;
      setSaving(false);
    }
  }, [currentStep, dbSteps, documentStepIndex, saveDynamicDraftForStep, scrollToStepPanel, t, useDynamic]);

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
      scrollToStepPanel(1);
    } catch (err) {
      const message = recoverOrFormatServerActionError(
        err,
        t("errors.failedToSave"),
        t("errors.stalePage"),
      );
      if (message) setError(message);
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
      scrollToStepPanel(2);
    } catch (err) {
      const message = recoverOrFormatServerActionError(
        err,
        t("errors.failedToSave"),
        t("errors.stalePage"),
      );
      if (message) setError(message);
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
      scrollToStepPanel(3);
    } catch (err) {
      const message = recoverOrFormatServerActionError(
        err,
        t("errors.failedToSave"),
        t("errors.stalePage"),
      );
      if (message) setError(message);
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
      scrollToStepPanel(nextStepId ?? stepIndex);
    } catch (err) {
      const message = recoverOrFormatServerActionError(
        err,
        t("errors.failedToSave"),
        t("errors.stalePage"),
      );
      if (message) setError(message);
    } finally {
      setSaving(false);
    }
  };

  const returnToTeam = useCallback(() => {
    const target = new URL(returnToParam ?? "/client/application/long-form", window.location.origin);
    target.searchParams.set("step", "team");
    target.searchParams.set("teamNotice", "companion_added");
    router.push(target.toString().replace(window.location.origin, ""));
  }, [returnToParam, router]);

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
      const message = recoverOrFormatServerActionError(
        err,
        t("errors.failedToSave"),
        t("errors.stalePage"),
      );
      if (message) setError(message);
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
      scrollToStepPanel(targetStatusStepIndex);
    } catch (err) {
      const message = recoverOrFormatServerActionError(
        err,
        t("errors.failedToSave"),
        t("errors.stalePage"),
      );
      if (message) setError(message);
    } finally {
      setSaving(false);
    }
  }, [
    effectiveSteps,
    fallbackStatusStepIndex,
    fallbackTeamStepIndex,
    saveAllDynamicDrafts,
    scrollToStepPanel,
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
      scrollToStepPanel(statusStepIndex);
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
      const missing = getCurrentSubmitMissingFields(buildCurrentAnswerSnapshot()).filter(
        (item) => !forceDryRun || item.stepId !== documentStepIndex,
      );
      setSubmitMissingFields(missing);
      if (missing.length > 0) {
        scrollToStepPanel(statusStepIndex);
        throw new Error(isZhInterface
          ? "请先补齐审核申请页末尾列出的缺失信息。"
          : "Please complete the missing information listed at the end of Review Application.");
      }

      const isJpTourist = resolvedVisaType === "JP_TOURIST";
      const isKrC39 = resolvedVisaType === "KR_C39_SHORT_TERM_VISIT";

      if (!isJpTourist && !isKrC39) {
        const queueJob = mode === "live_assisted" && isVietnamEVisa
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
          submissionResultStatus:
            submissionState.submissionResultStatus === "waiting" &&
            isUkStandardVisitor &&
            prev.submissionResult
              ? (prev.submissionResultStatus ?? "action_required")
              : submissionState.submissionResultStatus,
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
      const completionPosition = getVisibleStepIndex(effectiveSteps, reviewStepIndex);
      setCompletedUpTo((c) => Math.max(c, completionPosition + 1));
      scrollToStepPanel(statusStepIndex);
    } catch (err) {
      if (shouldShowArrivalSubmissionImmediately && isIgnorableRuntimeAbortError(err)) {
        // Supabase/Next can abort the client request after the queue write has
        // already committed. Keep the optimistic submission state and let the
        // status endpoint reconcile the durable queue instead of showing the
        // raw AbortSignal implementation message.
        setError(null);
        scrollToStepPanel(statusStepIndex);
        return;
      }
      if (shouldShowArrivalSubmissionImmediately) {
        setAppState((prev) => ({
          ...prev,
          ...previousSubmissionState,
        }));
      }
      const submissionError = err instanceof Error ? err : new Error(t("errors.failedToSubmit"));
      const message = recoverOrFormatServerActionError(
        submissionError,
        t("errors.failedToSubmit"),
        t("errors.stalePage"),
      );
      if (!message) return;
      setError(message);
      throw submissionError;
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
        scrollToStepPanel(fallbackStatusStepIndex);
        throw new Error(isZhInterface
          ? "请先补齐审核申请页末尾列出的缺失信息。"
          : "Please complete the missing information listed at the end of Review Application.");
      }

      // Persist the complete DS-160 answer set from hardcoded steps
      const normalizeResult = await persistDS160AnswerSet(
        applicationId,
        appState.personal,
        appState.passport,
        appState.travel,
      );
      if (normalizeResult.error) throw new Error(normalizeResult.error);

      const queueJob = mode === "live_assisted" && isVietnamEVisa
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
      const completionPosition = getVisibleStepIndex(effectiveSteps, fallbackReviewStepIndex);
      setCompletedUpTo((c) => Math.max(c, completionPosition + 1));
      scrollToStepPanel(fallbackStatusStepIndex);
    } catch (err) {
      const submissionError = err instanceof Error ? err : new Error(t("errors.failedToSubmit"));
      const message = recoverOrFormatServerActionError(
        submissionError,
        t("errors.failedToSubmit"),
        t("errors.stalePage"),
      );
      if (!message) return;
      setError(message);
      throw submissionError;
    } finally {
      setSaving(false);
      setSubmittingMode(null);
    }
  };

  const focusFirstMissingField = (missingFields: MissingApplicationField[]) => {
    const firstMissing = missingFields[0];
    if (!firstMissing) return;

    setCurrentStep(firstMissing.stepId);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const target = Array.from(
          document.querySelectorAll<HTMLElement>("[data-application-field-name]"),
        ).find((element) => element.dataset.applicationFieldName === firstMissing.fieldName);

        if (!target) {
          scrollToStepPanel(firstMissing.stepId);
          return;
        }

        target.scrollIntoView({ behavior: "smooth", block: "center" });
        const focusTarget = target.querySelector<HTMLElement>(
          'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), button:not([data-copilot-trigger]):not([disabled]), [role="combobox"]',
        );
        focusTarget?.focus({ preventScroll: true });
      });
    });
  };

  const checkAndSubmit = async (
    submit: (mode: SubmissionMode, vietnamPaymentCard?: VietnamOneTimePaymentCard) => void | Promise<void>,
    mode: SubmissionMode,
    vietnamPaymentCard?: VietnamOneTimePaymentCard,
  ) => {
    if (saving || submitCheckState === "checking") return;

    setSubmitCheckState("checking");
    setError(null);

    // Give React one paint to expose the page-wide checking state before the
    // synchronous schema walk. No validation state is written to storage, so
    // a refresh naturally returns the page to its normal state.
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

    if (showDocumentStep && appState.applicationId && !documentCenterLoaded) {
      setSubmitCheckState("idle");
      return;
    }

    const missing = useDynamic
      ? getCurrentSubmitMissingFields(buildCurrentAnswerSnapshot()).filter(
          (item) => !forceDryRun || item.stepId !== documentStepIndex,
        )
      : [];

    if (mode === "live_assisted" && liveAssistedTarget === "vietnam") {
      if (!vietnamPaymentCard || vietnamPaymentCard.pan.replace(/\D/g, "").length < 12) {
        missing.push({
          stepId: reviewStepIndex,
          stepName: isZhInterface ? "最终确认" : "Final confirmation",
          fieldName: OFFICIAL_PAYMENT_CARD_FIELD_NAMES.pan,
          label: isZhInterface ? "银行卡号" : "Card number",
          reason: "required",
        });
      }
      if (!vietnamPaymentCard || vietnamPaymentCard.expiry.trim().length < 4) {
        missing.push({
          stepId: reviewStepIndex,
          stepName: isZhInterface ? "最终确认" : "Final confirmation",
          fieldName: OFFICIAL_PAYMENT_CARD_FIELD_NAMES.expiry,
          label: isZhInterface ? "有效期" : "Expiry",
          reason: "required",
        });
      }
      if (!vietnamPaymentCard || vietnamPaymentCard.cvv.replace(/\D/g, "").length < 3) {
        missing.push({
          stepId: reviewStepIndex,
          stepName: isZhInterface ? "最终确认" : "Final confirmation",
          fieldName: OFFICIAL_PAYMENT_CARD_FIELD_NAMES.cvv,
          label: "CVV",
          reason: "required",
        });
      }
    }

    setSubmitMissingFields(missing.filter((item) => !item.fieldName.startsWith("official_payment_card_")));
    if (missing.length > 0) {
      setSubmitCheckState("invalid");
      focusFirstMissingField(missing);
      return;
    }

    setSubmitCheckState("idle");
    await submit(mode, vietnamPaymentCard);
  };

  const activeCountry = resolvedCountry;
  const activeVisaType = resolvedVisaType;
  useEffect(() => {
    if (isExplicitStatusView || !appState.applicationId) return;
    setActiveApplicationSelection({
      applicationId: appState.applicationId,
      packageId: null,
      country: activeCountry,
      visaType: activeVisaType,
      href: buildApplicationLongFormHref({
        applicationId: appState.applicationId,
        country: activeCountry,
        visaType: activeVisaType,
      }),
    });
  }, [activeCountry, activeVisaType, appState.applicationId, isExplicitStatusView]);
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
          const message = recoverOrFormatServerActionError(
            err,
            t("errors.failedToSave"),
            t("errors.stalePage"),
          );
          if (message) setDocumentCenterError(message);
          setDocumentCenterLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [appState.applicationId, loading, packageLoaded, resolvedCountry, resolvedVisaType, t]);

  const handlePassportOcrFieldsApplied = useCallback((
    fields: UniversalProfileSnapshot,
    appliedFieldNames?: string[],
  ) => {
    const answerPatch = buildUniversalProfileAnswerPatch(fields);
    const appliedFieldNameSet = appliedFieldNames ? new Set(appliedFieldNames) : null;
    const safeAnswerPatch = Object.fromEntries(
      Object.entries(answerPatch).filter(([fieldName, value]) => {
        if (!value || (appliedFieldNameSet && !appliedFieldNameSet.has(fieldName))) return false;
        // A locally edited value can exist before its autosave reaches the
        // server. Preserve it just like a persisted manual answer.
        return !(dynamicAnswers[fieldName] ?? "").trim();
      }),
    );
    const { givenNames, surname } = splitUniversalFullName(fields.full_name);

    autosaveRequestRef.current += 1;
    externalDraftProtectionRef.current = {
      fieldNames: new Set(Object.keys(safeAnswerPatch)),
      expiresAt: Date.now() + 5_000,
    };
    for (const [stepIndexText, draft] of Object.entries(dynamicDraftRef.current)) {
      const nextDraft = { ...draft };
      let changed = false;
      for (const fieldName of Object.keys(safeAnswerPatch)) {
        if (!Object.prototype.hasOwnProperty.call(nextDraft, fieldName)) continue;
        delete nextDraft[fieldName];
        changed = true;
      }
      if (changed) dynamicDraftRef.current[Number(stepIndexText)] = nextDraft;
    }
    setDynamicAnswers((prev) => ({ ...prev, ...safeAnswerPatch }));
    if (Object.keys(safeAnswerPatch).length > 0) {
      // Remount the current DB-driven step so its local controlled values are
      // rebuilt from the confirmed OCR patch instead of emitting an older
      // blank draft after confirmation.
      setExternalAnswerRevision((current) => current + 1);
    }
    setAppState((prev) => ({
      ...prev,
      personal: {
        ...prev.personal,
        givenNames: prev.personal.givenNames || givenNames,
        surname: prev.personal.surname || surname,
        dateOfBirth: prev.personal.dateOfBirth || fields.date_of_birth || undefined,
        sex: prev.personal.sex || fields.gender || undefined,
        nationality: prev.personal.nationality || fields.nationality || undefined,
      },
      passport: {
        ...prev.passport,
        passportNumber: prev.passport.passportNumber || fields.passport_number || undefined,
        passportIssuingCountry: prev.passport.passportIssuingCountry || fields.passport_issuing_country || undefined,
        passportIssuanceDate: prev.passport.passportIssuanceDate || fields.passport_issue_date || undefined,
        passportExpirationDate: prev.passport.passportExpirationDate || fields.passport_expiry_date || undefined,
      },
    }));
  }, [dynamicAnswers]);

  // When the first form step has a dedicated passport-upload field (e.g. the UK
  // "Passport Upload" step), the passport OCR card above the form is the real
  // uploader. Hide that field from the form body and satisfy its required
  // validation from the upload state instead.
  const passportUploadHandledFields = useMemo(
    () =>
      useDynamic && dbSteps[firstFormStepId]?.fields?.some((f) => f.fieldName === "passport_upload")
        ? ["passport_upload"]
        : [],
    [useDynamic, dbSteps, firstFormStepId],
  );
  const hasPassportUploadField = passportUploadHandledFields.length > 0;

  const handlePassportBioUploaded = useCallback(
    (fileName: string) => {
      setLocalPassportBioPageName(fileName);
      if (!hasPassportUploadField) return;
      setDynamicAnswers((prev) =>
        prev.passport_upload === fileName ? prev : { ...prev, passport_upload: fileName },
      );
    },
    [hasPassportUploadField],
  );

  useEffect(() => {
    if (!hasPassportUploadField || !passportOcrInitialUploaded) return;
    const name = passportOcrInitialFileName ?? "uploaded";
    setDynamicAnswers((prev) =>
      prev.passport_upload ? prev : { ...prev, passport_upload: name },
    );
  }, [hasPassportUploadField, passportOcrInitialUploaded, passportOcrInitialFileName]);

  useEffect(() => {
    if (isExplicitStatusView || loading || !packageLoaded || effectiveSteps.length === 0) return;

    const main = applicationContentRef.current;
    let frame: number | null = null;

    const syncCurrentStepToScroll = () => {
      frame = null;
      const isDesktopScroll = window.matchMedia("(min-width: 1024px)").matches && Boolean(main);
      const anchorTop = isDesktopScroll && main
        ? main.getBoundingClientRect().top + 24
        : 112;
      const panels = effectiveSteps
        .map((step) => ({ id: step.id, node: stepPanelRefs.current.get(step.id) }))
        .filter((panel): panel is { id: number; node: HTMLDivElement } => Boolean(panel.node));

      if (panels.length === 0) return;

      const remainingScroll = isDesktopScroll && main
        ? main.scrollHeight - main.scrollTop - main.clientHeight
        : document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      let visibleStepId = panels[0].id;

      if (remainingScroll <= 24) {
        visibleStepId = panels[panels.length - 1].id;
      } else {
        for (const panel of panels) {
          if (panel.node.getBoundingClientRect().top <= anchorTop) {
            visibleStepId = panel.id;
          } else {
            break;
          }
        }
      }

      setCurrentStep((previous) => previous === visibleStepId ? previous : visibleStepId);
    };

    const scheduleSync = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(syncCurrentStepToScroll);
    };

    main?.addEventListener("scroll", scheduleSync, { passive: true });
    window.addEventListener("scroll", scheduleSync, { passive: true });
    window.addEventListener("resize", scheduleSync);
    scheduleSync();

    return () => {
      main?.removeEventListener("scroll", scheduleSync);
      window.removeEventListener("scroll", scheduleSync);
      window.removeEventListener("resize", scheduleSync);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [effectiveSteps, isExplicitStatusView, loading, packageLoaded]);

  if (isExplicitStatusView) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <SubmissionStatusStep
          applicationId={explicitApplicationId}
          country={activeCountry}
          visaType={activeVisaType}
          status={null}
          result={null}
        />
      </main>
    );
  }

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
  const taiwanEntryPermitRequiredDocumentKeys = isTaiwanEntryPermit
    ? getTaiwanEntryPermitRequiredDocumentKeys(dynamicAnswerSnapshot)
    : undefined;
  const taiwanEntryPermitVisibleDocumentKeys = isTaiwanEntryPermit
    ? getTaiwanEntryPermitVisibleDocumentKeys(dynamicAnswerSnapshot)
    : undefined;
  const taiwanEntryPermitExtraRequirements = isTaiwanEntryPermit
    ? getTaiwanEntryPermitExtraRequirements(dynamicAnswerSnapshot)
    : undefined;

  return (
    <div
      className="flex min-h-screen flex-col pt-3 lg:h-[calc(100dvh-8rem)] lg:min-h-0 lg:overflow-hidden lg:overscroll-none xl:-mt-5 xl:h-[calc(100dvh-108px)] xl:pt-0"
      data-submit-check-state={submitCheckState}
    >
      <div className="flex min-h-0 flex-1 lg:overflow-hidden lg:overscroll-none">
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
          ref={applicationContentRef}
          className="min-w-0 flex-1 pt-0 pb-6 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain xl:pt-4"
        >
        <div
          className="w-full max-w-xl sm:max-w-2xl md:max-w-3xl"
          style={{ marginLeft: `${contentAlignment}px` }}
        >
          <header className="mb-4 w-full sm:mb-5">
            <h1 className="font-heading text-[28px] font-medium leading-[1.15] tracking-[-1px] text-[#3d3d3d] sm:text-[34px] sm:tracking-[-1.2px]">
              {pageTitle}
            </h1>
          </header>

          {showFormFillingAssistant ? (
            <div ref={formAssistantRef} className="scroll-mt-4">
              <FormFillingAssistant
                key={appState.applicationId}
                applicationId={appState.applicationId!}
                locale={locale}
                isZh={isZhInterface}
                progress={formAssistantState?.progress ?? { completed: 0, total: 0 }}
                messages={formAssistantState?.messages ?? []}
                missingFields={(formAssistantState?.missingFields ?? []).map((field) => ({
                  fieldName: field.fieldName,
                  label: field.label,
                  required: true,
                  section: field.stepName,
                }))}
                fillNotice={formAssistantFillNotice}
                loading={formAssistantBusy}
                validationResult={formAssistantDisplayValidation}
                showReviewAction={formFieldsComplete}
                onSend={handleFormAssistantSend}
                onTranscribe={handleFormAssistantTranscribe}
                onValidate={handleFormAssistantValidate}
                onAcknowledgeWarnings={handleFormAssistantAcknowledgeWarnings}
                onUndoFill={handleFormAssistantUndoFill}
                onDismissFillNotice={handleDismissFormAssistantFillNotice}
                onGoToReview={handleFormAssistantGoToReview}
                renderIssueField={renderFormAssistantIssueField}
                onJumpToIssue={scrollToApplicationField}
                className="mb-5"
              />
            </div>
          ) : null}

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
          {error &&
            !(
              showSubmissionStatusStep &&
              (currentStep === statusStepIndex || currentStep === fallbackStatusStepIndex)
            ) && (
            <ClientErrorAlert className="mb-6" message={error} />
          )}

          {saving && (
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
              <Loader2 className="h-4 w-4 animate-spin text-[#03346E]" /> {t("saving")}
            </div>
          )}

          {/* Step cards */}
          <div className="flex flex-col gap-5 sm:gap-6">
            {effectiveSteps.map((step) => {
              return (
                <div
                  key={step.id}
                  id={`application-step-${step.id}`}
                  ref={(node) => setStepPanelRef(step.id, node)}
                  className="flex scroll-mt-28 flex-col gap-2 lg:scroll-mt-4"
                >
                  {/* Panel card */}
                  <ApplicationFormPanel className="w-full p-4 sm:p-6 md:p-8">
                    <h2 className="mb-5 font-heading text-[20px] font-medium tracking-[-0.5px] text-[#3d3d3d] sm:text-[24px] sm:tracking-[-0.7px] md:text-[28px]">
                      {step.name}
                    </h2>
                    {showPassportOcrUpload && step.id === firstFormStepId && activeVisaType !== "VN_PREARRIVAL_DECLARATION" && (
                      <PassportOcrUpload
                        applicationId={appState.applicationId}
                        className="mb-6"
                        initialFileName={passportOcrInitialFileName}
                        initialUploaded={passportOcrInitialUploaded}
                        country={activeCountry}
                        visaType={activeVisaType}
                        onFieldsApplied={handlePassportOcrFieldsApplied}
                        onUploaded={handlePassportBioUploaded}
                      />
                    )}
                    {useDynamic ? (
                      /* Dynamic DB-driven form + photo/review/status steps */
                      <>
                        {/* DB-driven form steps */}
                        {step.id < documentStepIndex && dbSteps[step.id] && (
                          <>
                            {isTaiwanEntryPermit && isTaiwanEntryPermitQualificationStepSource(step.sourceName) && appState.applicationId ? (
                              <DocumentCenterClient
                                initialData={documentCenterData}
                                initialError={documentCenterError}
                                applicationId={appState.applicationId}
                                country={activeCountry}
                                visaType={activeVisaType}
                                embedded
                                onlyRequirementKeys={["photo"]}
                                onDataChange={setDocumentCenterData}
                              />
                            ) : null}
                            <DynamicStepForm
                              key={`${step.id}:${externalAnswerRevision}`}
                              step={{
                                ...dbSteps[step.id],
                                fields: isTaiwanEntryPermit
                                  ? dbSteps[step.id].fields.filter((field) => field.fieldName !== "household_revoked")
                                  : dbSteps[step.id].fields,
                              }}
                              prefill={dynamicAnswers}
                              onComplete={(data) => handleDynamicStepComplete(step.id, data)}
                              onDraftChange={(data) => handleDynamicDraftChange(step.id, data)}
                              onUserChange={markLiveSaveActivity}
                              saving={saving}
                              showContinueButton={false}
                              country={activeCountry}
                              visaType={activeVisaType}
                              externallyHandledFieldNames={passportUploadHandledFields}
                              invalidFieldNames={invalidFieldNamesByStep.get(step.id)}
                              aiFilledFieldNames={new Set(aiFilledFieldNames)}
                              reviewIssues={formAssistantFieldReviewIssueMap}
                              onNavigateReviewIssue={handleNavigateReviewIssue}
                            />
                            {isTaiwanEntryPermit && isTaiwanEntryPermitQualificationStepSource(step.sourceName) && appState.applicationId ? (
                              <div className="mt-8 border-t border-[#e8e8e8] pt-7">
                                <h3 className="mb-4 font-heading text-[20px] font-medium text-[#3d3d3d]">应检附文件</h3>
                                <DocumentCenterClient
                                  initialData={documentCenterData}
                                  initialError={documentCenterError}
                                  applicationId={appState.applicationId}
                                  country={activeCountry}
                                  visaType={activeVisaType}
                                  embedded
                                  onlyRequirementKeys={taiwanEntryPermitVisibleDocumentKeys}
                                  excludeRequirementKeys={["photo"]}
                                  extraRequirements={taiwanEntryPermitExtraRequirements}
                                  hideOptionalDocuments
                                  forceRequiredRequirementKeys={taiwanEntryPermitRequiredDocumentKeys}
                                  presentation="taiwan-inline"
                                  onDataChange={setDocumentCenterData}
                                />
                              </div>
                            ) : null}
                          </>
                        )}
                        {showFormFillingAssistant &&
                        formFieldsComplete &&
                        step.id === lastVisibleFormStepId ? (
                          <BrandActionButton
                            type="button"
                            variant="secondary"
                            className="mt-5"
                            onClick={scrollToFormAssistant}
                          >
                            {tApp("formAssistant.reviewRepair.reviewWithAssistant")}
                          </BrandActionButton>
                        ) : null}

                        {/* Supporting documents step */}
                        {showStandaloneDocumentStep && step.id === documentStepIndex && (
                          appState.applicationId ? (
                            <DocumentCenterClient
                              initialData={documentCenterData}
                              initialError={documentCenterError}
                              applicationId={appState.applicationId}
                              country={activeCountry}
                              visaType={activeVisaType}
                              embedded
                              onDataChange={setDocumentCenterData}
                            />
                          ) : (
                            <div className="flex min-h-[240px] items-center justify-center">
                              <Loader2 className="h-8 w-8 animate-spin text-[#03346E]" />
                            </div>
                          )
                        )}

                        {/* Dynamic review step */}
                        {step.id === reviewStepIndex && appState.applicationId && (
                          showSubmissionStatusStep ? (
                            <div
                              className="flex flex-col gap-6"
                              data-testid={preserveIndonesiaReview ? "indonesia-review-status-stack" : undefined}
                            >
                              {showReviewAlongsideSubmissionStatus ? (
                                <DynamicReviewStep
                                  applicationId={appState.applicationId}
                                  dynamicAnswers={dynamicAnswerSnapshot}
                                  dbSteps={dbSteps}
                                  photoPath={appState.photo}
                                  onEdit={(stepIdx) => scrollToStepPanel(stepIdx)}
                                  onPhotoEdit={() => scrollToStepPanel(showDocumentStep ? documentStepIndex : firstFormStepId)}
                                  onComplete={() => undefined}
                                  mode="continue"
                                  showAction={false}
                                  reviewIssues={formAssistantFieldReviewIssueMap}
                                />
                              ) : null}
                              <SubmissionStatusStep
                                applicationId={appState.applicationId}
                                country={activeCountry}
                                visaType={activeVisaType}
                                status={appState.submissionResultStatus}
                                result={appState.submissionResult}
                                onResubmit={handleDynamicReviewComplete}
                              />
                            </div>
                          ) : (
                            <div className="flex flex-col gap-6">
                              <DynamicReviewStep
                                applicationId={appState.applicationId}
                                dynamicAnswers={dynamicAnswerSnapshot}
                                dbSteps={dbSteps}
                                photoPath={appState.photo}
                                onEdit={(stepIdx) => scrollToStepPanel(stepIdx)}
                                onPhotoEdit={() => scrollToStepPanel(showDocumentStep ? documentStepIndex : firstFormStepId)}
                                onComplete={isCompanionFlow ? handleCompanionReviewComplete : () => undefined}
                                mode="continue"
                                continueLabel={isCompanionFlow ? t("team.confirmCompanion") : undefined}
                                showAction={isCompanionFlow}
                                reviewIssues={formAssistantFieldReviewIssueMap}
                              />
                              {!isCompanionFlow ? (
                                <UniversalProfileSyncCard applicationId={appState.applicationId} />
                              ) : null}
                              {!isCompanionFlow ? (
                                <FinalConfirmationPanel
                                  isZh={isZhInterface}
                                  liveAssistedTarget={liveAssistedTarget}
                                  liveAssistedEnabled={liveAssistedEnabled}
                                  forceDryRun={forceDryRun}
                                  missingFields={confirmationMissingFields}
                                  requirementsLoading={!documentCenterLoaded && Boolean(appState.applicationId)}
                                  submittingMode={saving ? submittingMode ?? "dry_run" : null}
                                  submitCheckState={submitCheckState}
                                  onSubmit={(mode, paymentCard) => checkAndSubmit(handleDynamicReviewComplete, mode, paymentCard)}
                                />
                              ) : null}
                            </div>
                          )
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

                      </>
                    ) : (
                      /* Hardcoded Indonesia C1 steps */
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
                            />
                          ) : (
                            <div className="flex min-h-[240px] items-center justify-center">
                              <Loader2 className="h-8 w-8 animate-spin text-[#03346E]" />
                            </div>
                          )
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
                        {step.id === fallbackReviewStepIndex && (
                          showSubmissionStatusStep ? (
                            <div
                              className="flex flex-col gap-6"
                              data-testid={preserveIndonesiaReview ? "indonesia-review-status-stack" : undefined}
                            >
                              {showReviewAlongsideSubmissionStatus ? (
                                <ReviewStep
                                  applicationId={appState.applicationId ?? ""}
                                  data={appState}
                                  onEdit={(section) => {
                                    const sectionMap: Record<string, number> = {
                                      personal: 0, passport: 1, travel: 2, documents: 3,
                                    };
                                    scrollToStepPanel(sectionMap[section] ?? 0);
                                  }}
                                  onComplete={() => undefined}
                                  mode="continue"
                                  showAction={false}
                                />
                              ) : null}
                              <SubmissionStatusStep
                                applicationId={appState.applicationId}
                                country={activeCountry}
                                visaType={activeVisaType}
                                status={appState.submissionResultStatus}
                                result={appState.submissionResult}
                                onResubmit={handleReviewComplete}
                              />
                            </div>
                          ) : (
                            <div className="flex flex-col gap-6">
                              <ReviewStep
                                applicationId={appState.applicationId ?? ""}
                                data={appState}
                                onEdit={(section) => {
                                  const sectionMap: Record<string, number> = {
                                    personal: 0, passport: 1, travel: 2, documents: 3,
                                  };
                                  scrollToStepPanel(sectionMap[section] ?? 0);
                                }}
                                onComplete={isCompanionFlow ? handleCompanionReviewComplete : () => undefined}
                                mode="continue"
                                continueLabel={isCompanionFlow ? t("team.confirmCompanion") : undefined}
                                showAction={isCompanionFlow}
                              />
                              {!isCompanionFlow && appState.applicationId ? (
                                <UniversalProfileSyncCard applicationId={appState.applicationId} />
                              ) : null}
                              {!isCompanionFlow ? (
                                <FinalConfirmationPanel
                                  isZh={isZhInterface}
                                  liveAssistedTarget={liveAssistedTarget}
                                  liveAssistedEnabled={liveAssistedEnabled}
                                  forceDryRun={forceDryRun}
                                  missingFields={confirmationMissingFields}
                                  requirementsLoading={!documentCenterLoaded && Boolean(appState.applicationId)}
                                  submittingMode={saving ? submittingMode ?? "dry_run" : null}
                                  submitCheckState={submitCheckState}
                                  onSubmit={(mode, paymentCard) => checkAndSubmit(handleReviewComplete, mode, paymentCard)}
                                />
                              ) : null}
                            </div>
                          )
                        )}
                      </>
                    )}
                  </ApplicationFormPanel>
                </div>
              );
            })}
          </div>
        </div>
        </main>
      </div>
    </div>
  );
}

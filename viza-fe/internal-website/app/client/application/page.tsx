"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, FileText, Loader2, Check, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";
import { getVisaFormSteps } from "@/app/actions/visa-form-fields";
import { type WizardStep } from "@/types/visa-form-fields";
import { evaluateShowIf } from "@/lib/form-utils";
import { getUserVisaPackage, type UserVisaPackage } from "@/app/actions/user-package";
import {
  PersonalInfoStep,
  PassportStep,
  TravelInfoStep,
  DocumentUploadStep,
  ReviewStep,
  StatusStep,
  PhotoUploadStep,
  DynamicReviewStep,
  type PersonalInfoData,
  type PassportData,
  type TravelInfoData,
  type DocumentType,
} from "@/components/application-steps";
import { DynamicStepForm } from "@/components/dynamic-step-form";
import {
  saveDynamicAnswers,
  ensureDraftApplication,
  loadDynamicAnswers,
} from "@/app/actions/visa-application-answers";
import { persistDS160AnswerSet } from "@/app/actions/ds160-normalize";
import { getFormVisaType, getVisaPackageTitleZh } from "@/lib/visa-destinations";
import { getChineseLabel, translateLabel } from "@/lib/ds160-translations";
import { getApplicationLifecycleSummaries } from "@/app/actions/application-lifecycle";

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
  | "photo"
  | "review"
  | "confirmation";

interface StepSectionDef {
  key: StepSectionKey;
  title: string;
  steps: StepDef[];
}

interface ApplicantProfilePrefill {
  full_name?: string | null;
  date_of_birth?: string | null;
  place_of_birth?: string | null;
  gender?: string | null;
  nationality?: string | null;
  occupation?: string | null;
  address?: string | null;
  passport_number?: string | null;
  passport_issue_date?: string | null;
  passport_expiry_date?: string | null;
  passport_issuing_country?: string | null;
  email?: string | null;
  phone?: string | null;
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
  "photo",
  "review",
  "confirmation",
];

const STEP_KEYS = ["personalInfo", "passport", "travelDetails", "documents", "review", "status"] as const;

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

function localizeTitle(label: string, locale: string): string {
  return locale.startsWith("zh") ? getChineseLabel(label) : translateLabel(label, locale);
}

function getStepSectionKey(step: StepDef): StepSectionKey {
  const sourceName = normalizeStepName(step.sourceName ?? step.name);

  if (sourceName.startsWith("personal information")) return "personal";
  if (sourceName.startsWith("travel information")) return "travel";
  if (sourceName.startsWith("travel companions")) return "travelCompanions";
  if (sourceName.startsWith("previous u s travel") || sourceName.startsWith("previous us travel")) return "previousTravel";
  if (sourceName.startsWith("address and phone")) return "addressAndPhone";
  if (sourceName.includes("passport information")) return "passport";
  if (sourceName.includes("us contact information") || sourceName.includes("us point of contact")) return "usContact";
  if (sourceName.startsWith("family information")) return "family";
  if (sourceName.includes("work education training") || sourceName.includes("work and education")) return "workEducationTraining";
  if (sourceName.startsWith("security and background")) return "securityAndBackground";
  if (sourceName.startsWith("upload photo")) return "photo";
  if (sourceName.startsWith("review")) return "review";
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

function applyPrefillValue(
  answers: Record<string, string>,
  fieldNames: string[],
  value?: string | null,
) {
  const trimmed = value?.trim();
  if (!trimmed) return;

  for (const fieldName of fieldNames) {
    if (!answers[fieldName]) answers[fieldName] = trimmed;
  }
}

function buildUniversalDynamicAnswers(profile: ApplicantProfilePrefill): Record<string, string> {
  const answers: Record<string, string> = {};
  const nameParts = profile.full_name?.trim().split(/\s+/).filter(Boolean) ?? [];

  applyPrefillValue(answers, ["full_name", "fullName", "full_name_native_alphabet"], profile.full_name);
  if (nameParts.length > 1) {
    applyPrefillValue(answers, ["given_names", "givenNames", "first_name", "given_name"], nameParts.slice(0, -1).join(" "));
    applyPrefillValue(answers, ["surname", "last_name", "family_name"], nameParts[nameParts.length - 1]);
  }
  applyPrefillValue(answers, ["date_of_birth", "dob", "birth_date"], profile.date_of_birth);
  applyPrefillValue(answers, ["place_of_birth", "city_of_birth", "birth_city"], profile.place_of_birth);
  applyPrefillValue(answers, ["gender", "sex"], profile.gender);
  applyPrefillValue(answers, ["nationality", "nationality_country", "country_of_nationality", "current_nationality"], profile.nationality);
  applyPrefillValue(answers, ["occupation", "current_occupation", "primary_occupation"], profile.occupation);
  applyPrefillValue(answers, ["address", "home_address_line1", "home_address", "residential_address"], profile.address);
  applyPrefillValue(answers, ["passport_number", "passportNumber"], profile.passport_number);
  applyPrefillValue(answers, ["passport_issue_date", "passport_issuance_date", "passportIssuanceDate"], profile.passport_issue_date);
  applyPrefillValue(answers, ["passport_expiry_date", "passport_expiration_date", "passportExpirationDate"], profile.passport_expiry_date);
  applyPrefillValue(answers, ["passport_issuing_country", "passport_issuance_country", "issuing_country"], profile.passport_issuing_country);
  applyPrefillValue(answers, ["email", "email_address"], profile.email);
  applyPrefillValue(answers, ["phone", "phone_number", "primary_phone_number", "mobile_phone"], profile.phone);

  return answers;
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
  onStepClick: (stepId: number) => void;
}) {
  const currentStepIndex = steps.findIndex((step) => step.id === currentStep);
  const activeStepIndex = currentStepIndex >= 0 ? currentStepIndex : 0;

  return (
    <aside className="w-[260px] shrink-0 pt-9 hidden lg:flex lg:flex-col z-10 overflow-y-auto">
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
              onClick={() => onStepClick(step.id)}
              className={cn(
                "rounded-xl border border-[#efefef] bg-white px-4 py-3.5 flex gap-3 items-center transition-all duration-200 text-left cursor-pointer hover:shadow-sm",
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
  onStepClick: (stepId: number) => void;
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
                onClick={() => onStepClick(step.id)}
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
  onStepClick: (stepId: number) => void;
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
    <aside className="w-[260px] shrink-0 pt-9 hidden lg:flex lg:flex-col z-10 overflow-y-auto">
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
                onClick={() => onStepClick(step.id)}
                className={cn(
                  "rounded-xl border border-[#efefef] bg-white px-4 py-3.5 flex gap-3 items-center transition-all duration-200 text-left cursor-pointer hover:shadow-sm w-full",
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
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left cursor-pointer"
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
                          onClick={() => onStepClick(step.id)}
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
  onStepClick: (stepId: number) => void;
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
                onClick={() => onStepClick(step.id)}
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
                          onClick={() => onStepClick(step.id)}
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
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ApplicationPage() {
  const searchParams = useSearchParams();
  const jumpToReview = searchParams.get("step") === "review";
  const requestedCountry = searchParams.get("country")?.trim() || null;
  const requestedVisaType =
    searchParams.get("visaType")?.trim() ||
    searchParams.get("visa_type")?.trim() ||
    null;
  const requestedView = searchParams.get("view");
  const requestedApplicationId = searchParams.get("applicationId")?.trim() || null;

  if (requestedView === "detail") {
    return (
      <ApplicationStatusRedirect
        applicationId={requestedApplicationId}
        country={requestedCountry}
        visaType={requestedVisaType}
      />
    );
  }

  if (!requestedCountry && !requestedVisaType && !jumpToReview) return <RecentApplicationRedirect />;

  return <ApplicationFormPage />;
}

function buildFormHref(country: string, visaType: string): string {
  return `/client/application?country=${encodeURIComponent(country)}&visaType=${encodeURIComponent(visaType)}`;
}

function isStartedSummary(summary: {
  applicationId: string | null;
  status: string;
  formAnswerCount: number;
  latestSubmission: unknown;
  submittedAt: string | null;
  confirmationNumber: string | null;
  receiptUrl: string | null;
}) {
  return Boolean(summary.applicationId) && (
    summary.status !== "not_started" ||
    summary.formAnswerCount > 0 ||
    Boolean(summary.latestSubmission) ||
    Boolean(summary.submittedAt) ||
    Boolean(summary.confirmationNumber) ||
    Boolean(summary.receiptUrl)
  );
}

function ApplicationStatusRedirect({
  applicationId,
  country,
  visaType,
}: {
  applicationId: string | null;
  country: string | null;
  visaType: string | null;
}) {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams({ view: "detail" });
    if (applicationId) params.set("applicationId", applicationId);
    if (country) params.set("country", country);
    if (visaType) params.set("visaType", visaType);
    router.replace(`/client/documents?${params.toString()}`);
  }, [applicationId, country, router, visaType]);

  return (
    <div className="flex min-h-[52vh] flex-col items-center justify-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-[#03346E]" />
    </div>
  );
}

function RecentApplicationRedirect() {
  const router = useRouter();
  const t = useTranslations("application");
  const [isLoadingLatest, setIsLoadingLatest] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function redirectToLatestStartedForm() {
      const result = await getApplicationLifecycleSummaries();
      if (!isMounted) return;

      const latestStartedApplication = result.summaries.find(isStartedSummary);
      const targetApplication = latestStartedApplication ?? result.summaries[0];
      if (targetApplication) {
        router.replace(buildFormHref(targetApplication.country, targetApplication.visaType));
        return;
      }

      setIsLoadingLatest(false);
    }

    void redirectToLatestStartedForm();
    return () => {
      isMounted = false;
    };
  }, [router]);

  if (isLoadingLatest) {
    return (
      <div className="flex min-h-[52vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#03346E]" />
        <p className="text-[14px] font-medium text-[#66758a]">{t("findingRecentApplication")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[52vh] w-full max-w-[620px] flex-col items-center justify-center text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#eef3fa] text-[#03346E]">
        <FileText className="h-6 w-6" />
      </div>
      <h1 className="mt-4 font-heading text-[26px] font-medium text-[#26364a]">
        {t("noRecentStartedTitle")}
      </h1>
      <p className="mt-2 max-w-md text-[14px] leading-6 text-[#66758a]">
        {t("noRecentStartedBody")}
      </p>
      <Link
        href="/client/home"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#03346E] px-5 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#052b58]"
      >
        {t("chooseDestination")}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function ApplicationFormPage() {
  const t = useTranslations("application");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const jumpToReview = searchParams.get("step") === "review";
  const requestedCountry = searchParams.get("country")?.trim() || null;
  const requestedVisaType =
    searchParams.get("visaType")?.trim() ||
    searchParams.get("visa_type")?.trim() ||
    null;
  const requestedVisaPackage = useMemo<UserVisaPackage | null>(() => {
    if (!requestedCountry || !requestedVisaType) return null;

    return {
      id: `chat:${requestedCountry}:${requestedVisaType}`,
      country: requestedCountry,
      visa_type: requestedVisaType,
      name: getVisaPackageTitleZh(requestedCountry, requestedVisaType),
      description: null,
    };
  }, [requestedCountry, requestedVisaType]);

  const hardcodedSteps: StepDef[] = useMemo(
    () =>
      STEP_KEYS.map((key, id) => ({
        id,
        name: t(`steps.${key}.name`),
        description: t(`steps.${key}.description`),
        sourceName: key,
      })),
    [t],
  );

  // DB-driven steps (loaded from visa_form_fields table)
  // Falls back to hardcoded STEPS if DB returns empty
  const [dbSteps, setDbSteps] = useState<WizardStep[]>([]);
  const [visaPackage, setVisaPackage] = useState<UserVisaPackage | null>(null);
  const [packageLoaded, setPackageLoaded] = useState(false);

  useEffect(() => {
    setPackageLoaded(false);
    setDbSteps([]);

    if (requestedVisaPackage) {
      setVisaPackage(requestedVisaPackage);
      getVisaFormSteps(getFormVisaType(requestedVisaPackage.visa_type))
        .then((steps) => {
          if (steps.length > 0) setDbSteps(steps);
        })
        .catch(() => {
          // Silent fallback to hardcoded steps
        })
        .finally(() => {
          setPackageLoaded(true);
        });
      return;
    }

    getUserVisaPackage().then((pkg) => {
      if (pkg) setVisaPackage(pkg);
      const visaType = getFormVisaType(pkg?.visa_type ?? "B211A");
      return getVisaFormSteps(visaType);
    }).then((steps) => {
      if (steps.length > 0) setDbSteps(steps);
    }).catch(() => {
      // Silent fallback to hardcoded steps
    }).finally(() => {
      setPackageLoaded(true);
    });
  }, [requestedVisaPackage]);

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
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [translationStatus, setTranslationStatus] = useState<"ok" | "failed" | "pending" | null>(null);
  // Dynamic form answers keyed by field_name
  const [dynamicAnswers, setDynamicAnswers] = useState<Record<string, string>>({});

  // Use DB-driven steps when available, otherwise fall back to hardcoded
  const useDynamic = dbSteps.length > 0;
  const tDyn = useTranslations("application.dynamicSteps");
  const tApp = useTranslations("application");
  // Indices for the extra steps appended after DB-driven form steps
  const photoStepIndex = dbSteps.length;
  const reviewStepIndex = dbSteps.length + 1;
  const statusStepIndex = dbSteps.length + 2;

  const visibleDynamicSteps = useMemo(
    () => (useDynamic ? getVisibleDynamicSteps(dbSteps, dynamicAnswers) : []),
    [dbSteps, dynamicAnswers, useDynamic],
  );

  // Steps in DB source order — used only to build the grouped sections.
  // The displayed/navigated list (`effectiveSteps` below) is reordered to
  // match the grouped section order so the sidebar numbers stay sequential
  // (1, 2, 3, 4…) instead of jumping (e.g. 1, 2, 5, 3, 4).
  const sourceOrderedSteps: StepDef[] = useMemo(() => {
    if (!useDynamic) return hardcodedSteps;

    return [
        ...visibleDynamicSteps.map(({ step, sourceIndex }) => ({
          id: sourceIndex,
          sourceName: step.stepName,
          name: (() => {
            const safeKey = step.stepName.replace(/\./g, "");
            const translatedStepName = localizeTitle(step.stepName, locale);
            if (translatedStepName !== step.stepName) return translatedStepName;
            const localizedStepName = tDyn.has(safeKey) ? tDyn(safeKey as never) : step.stepName;
            return localizeTitle(localizedStepName, locale);
          })(),
          description: tApp("dynamicStepDescription", { count: step.fields.length }),
        })),
        {
          id: photoStepIndex,
          sourceName: "Upload Photo",
          name: localizeTitle("Upload Photo", locale),
          description: tApp.has("photoStepDescription") ? tApp("photoStepDescription" as never) : "Upload your passport-style photo",
        },
        {
          id: reviewStepIndex,
          sourceName: "Review",
          name: localizeTitle("Review Application", locale),
          description: tApp.has("reviewStepDescription") ? tApp("reviewStepDescription" as never) : "Review and confirm your details",
        },
        {
          id: statusStepIndex,
          sourceName: "Confirmation",
          name: localizeTitle("Confirmation", locale),
          description: tApp.has("statusStepDescription") ? tApp("statusStepDescription" as never) : "Application submitted",
        },
      ];
  }, [
    hardcodedSteps,
    locale,
    photoStepIndex,
    reviewStepIndex,
    statusStepIndex,
    tApp,
    tDyn,
    useDynamic,
    visibleDynamicSteps,
  ]);

  const dynamicSectionTitles = useMemo(
    () =>
      ({
        personal: localizeTitle("Personal", locale),
        travel: localizeTitle("Travel", locale),
        travelCompanions: localizeTitle("Travel Companions", locale),
        previousTravel: localizeTitle("Previous U.S. Travel", locale),
        addressAndPhone: localizeTitle("Address and Phone", locale),
        passport: localizeTitle("Passport", locale),
        usContact: localizeTitle("U.S. Contact", locale),
        family: localizeTitle("Family", locale),
        workEducationTraining: localizeTitle("Work / Education / Training", locale),
        securityAndBackground: localizeTitle("Security and Background", locale),
        photo: localizeTitle("Upload Photo", locale),
        review: localizeTitle("Review", locale),
        confirmation: localizeTitle("Confirmation", locale),
      }) satisfies Record<StepSectionKey, string>,
    [locale],
  );

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

    const { data: profile } = await supabase
      .from("applicant_profiles")
      .select("*")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    let applicationQuery = supabase
      .from("applications")
      .select("*")
      .eq("applicant_id", profile?.id ?? "");

    if (requestedVisaPackage) {
      applicationQuery = applicationQuery
        .eq("country", requestedVisaPackage.country)
        .eq("visa_type", requestedVisaPackage.visa_type);
    }

    const { data: application } = await applicationQuery
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (profile) {
      // Load DS-160 answers from visa_application_answers first (the source of truth)
      let ds160Answers: Record<string, string> = {};
      if (application?.id) {
        const { answers } = await loadDynamicAnswers(application.id);
        ds160Answers = answers;
      }
      const universalDynamicAnswers = buildUniversalDynamicAnswers(profile as ApplicantProfilePrefill);

      // Hydrate hardcoded steps from DS-160 answers first, falling back to profile/application
      const a = { ...universalDynamicAnswers, ...ds160Answers };
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
      }));

      const hasPersonal = !!(a.surname || profile.full_name) && !!(a.nationality_country || profile.nationality);
      const hasPassport = !!(a.passport_number || profile.passport_number);
      const hasTravel = !!(application?.arrival_date && application?.departure_date);
      const hasDocuments = application?.status === "submitted" || application?.status === "approved";
      const isSubmitted = application?.status === "submitted" || application?.status === "approved";

      const completed = hasPersonal ? (hasPassport ? (hasTravel ? (hasDocuments ? (isSubmitted ? 6 : 4) : 3) : 2) : 1) : 0;
      setCompletedUpTo(completed);
      setCurrentStep(Math.min(completed, 5));

      // Set dynamic answers for the dynamic form steps
      if (Object.keys(a).length > 0) {
        setDynamicAnswers(a);
        if (a["photo_path"]) {
          setAppState((prev) => ({ ...prev, photo: a["photo_path"] }));
        }
      }
    }

    setLoading(false);
  }, [requestedVisaPackage]);

  useEffect(() => { loadData(); }, [loadData]);

  // Honor ?step=review from the simplified-form redirect: once steps + any
  // prefilled answers have loaded, jump directly to the Review step.
  const [reviewJumpHandled, setReviewJumpHandled] = useState(false);
  useEffect(() => {
    if (!jumpToReview || reviewJumpHandled || loading) return;
    const targetId = useDynamic
      ? (effectiveSteps.find((s) => s.sourceName === "Review")?.id ?? reviewStepIndex)
      : 4; // STEP_KEYS index of "review"
    setCurrentStep(targetId);
    setCompletedUpTo((c) => Math.max(c, targetId));
    setReviewJumpHandled(true);
  }, [jumpToReview, reviewJumpHandled, loading, useDynamic, effectiveSteps, reviewStepIndex]);

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
            country: visaPackage?.country ?? "indonesia",
            visa_type: visaPackage?.visa_type ?? "B211A",
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
      // Ensure we have a draft application (server-side, bypasses RLS)
      let applicationId = appState.applicationId;
      if (!applicationId) {
        const result = await ensureDraftApplication(
          visaPackage?.country ?? "indonesia",
          visaPackage?.visa_type ?? "B211A",
          { preferExplicit: Boolean(requestedVisaPackage) }
        );
        if (result.error) throw new Error(result.error);
        applicationId = result.applicationId!;
        setAppState((prev) => ({ ...prev, applicationId }));
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

  const handleDocumentsComplete = (uploadedPaths: Record<DocumentType, string>) => {
    setAppState((prev) => ({ ...prev, documents: uploadedPaths }));
    setCompletedUpTo((c) => Math.max(c, 4));
    setCurrentStep(4);
  };

  const ensurePhotoApplicationId = useCallback(async () => {
    if (appState.applicationId) return appState.applicationId;

    const result = await ensureDraftApplication(
      visaPackage?.country ?? "indonesia",
      visaPackage?.visa_type ?? "B211A",
      { preferExplicit: Boolean(requestedVisaPackage) },
    );
    if (result.error || !result.applicationId) {
      throw new Error(result.error ?? t("errors.noApplicationFound"));
    }

    setAppState((prev) => ({ ...prev, applicationId: result.applicationId! }));
    return result.applicationId;
  }, [appState.applicationId, requestedVisaPackage, t, visaPackage?.country, visaPackage?.visa_type]);

  // ── Dynamic-mode photo handlers ─────────────────────────────────────
  const handlePhotoComplete = async (storagePath: string, uploadedApplicationId?: string) => {
    setSaving(true);
    setError(null);
    try {
      let applicationId = uploadedApplicationId ?? appState.applicationId;
      if (!applicationId) {
        const result = await ensureDraftApplication(
          visaPackage?.country ?? "indonesia",
          visaPackage?.visa_type ?? "B211A",
          { preferExplicit: Boolean(requestedVisaPackage) },
        );
        if (result.error) throw new Error(result.error);
        applicationId = result.applicationId!;
        setAppState((prev) => ({ ...prev, applicationId }));
      }

      // Persist photo path as a dynamic answer
      const saveResult = await saveDynamicAnswers(applicationId, {
        photo_path: storagePath,
      });
      if (saveResult.error) throw new Error(saveResult.error);

      setDynamicAnswers((prev) => ({ ...prev, photo_path: storagePath }));
      setAppState((prev) => ({ ...prev, photo: storagePath }));
      const photoStepPosition = getVisibleStepIndex(effectiveSteps, photoStepIndex);
      setCompletedUpTo((c) => Math.max(c, photoStepPosition + 1));
      setCurrentStep(reviewStepIndex);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.failedToSave"));
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoSkip = () => {
    const photoStepPosition = getVisibleStepIndex(effectiveSteps, photoStepIndex);
    setCompletedUpTo((c) => Math.max(c, photoStepPosition + 1));
    setCurrentStep(reviewStepIndex);
  };

  // ── Dynamic-mode review complete handler ────────────────────────────
  const handleDynamicReviewComplete = async () => {
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      if (!appState.applicationId) throw new Error(t("errors.noApplicationFound"));

      // Persist the complete DS-160 answer set from hardcoded steps
      const normalizeResult = await persistDS160AnswerSet(
        appState.applicationId,
        appState.personal,
        appState.passport,
        appState.travel,
      );
      if (normalizeResult.error) throw new Error(normalizeResult.error);

      await supabase.from("submission_queue").insert({
        application_id: appState.applicationId,
        status: "pending",
        attempts: 0,
        created_at: new Date().toISOString(),
      });

      await supabase.from("applications").update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
      }).eq("id", appState.applicationId);

      // Trigger translation (non-blocking)
      let txStatus: "ok" | "failed" = "ok";
      try {
        const backendUrl = process.env.NEXT_PUBLIC_AGENT_BACKEND_URL ?? "http://localhost:8080";
        const txRes = await fetch(
          `${backendUrl}/api/applications/${appState.applicationId}/translate`,
          { method: "POST", headers: { "Content-Type": "application/json" } },
        );
        if (!txRes.ok) txStatus = "failed";
      } catch {
        txStatus = "failed";
      }
      setTranslationStatus(txStatus);

      setAppState((prev) => ({
        ...prev,
        submittedAt: new Date().toISOString(),
        confirmationNumber: `VIZA-${Date.now().toString(36).toUpperCase()}`,
      }));
      const reviewStepPosition = getVisibleStepIndex(effectiveSteps, reviewStepIndex);
      setCompletedUpTo((c) => Math.max(c, reviewStepPosition + 1));
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
      if (!appState.applicationId) throw new Error(t("errors.noApplicationFound"));

      // Persist the complete DS-160 answer set from hardcoded steps
      const normalizeResult = await persistDS160AnswerSet(
        appState.applicationId,
        appState.personal,
        appState.passport,
        appState.travel,
      );
      if (normalizeResult.error) throw new Error(normalizeResult.error);

      await supabase.from("submission_queue").insert({
        application_id: appState.applicationId,
        status: "pending",
        attempts: 0,
        created_at: new Date().toISOString(),
      });

      await supabase.from("applications").update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
      }).eq("id", appState.applicationId);

      // Trigger translation (non-blocking — don't prevent submission on failure)
      let txStatus: "ok" | "failed" = "ok";
      try {
        const backendUrl = process.env.NEXT_PUBLIC_AGENT_BACKEND_URL ?? "http://localhost:8080";
        const txRes = await fetch(
          `${backendUrl}/api/applications/${appState.applicationId}/translate`,
          { method: "POST", headers: { "Content-Type": "application/json" } }
        );
        if (!txRes.ok) txStatus = "failed";
      } catch {
        txStatus = "failed";
      }
      setTranslationStatus(txStatus);

      setAppState((prev) => ({
        ...prev,
        submittedAt: new Date().toISOString(),
        confirmationNumber: `VIZA-${Date.now().toString(36).toUpperCase()}`,
      }));
      setCompletedUpTo((c) => Math.max(c, 5));
      setCurrentStep(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.failedToSubmit"));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !packageLoaded) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#03346E]" />
      </div>
    );
  }

  const pageTitle = visaPackage
    ? getVisaPackageTitleZh(visaPackage.country, visaPackage.visa_type)
    : t("title");

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1090px] gap-4 pt-3">
      {/* Left sidebar - desktop only */}
      {useDynamic ? (
        <GroupedStepSidebar
          sections={groupedSections}
          steps={effectiveSteps}
          currentStep={currentStep}
          completedUpTo={completedUpTo}
          onStepClick={setCurrentStep}
        />
      ) : (
        <VerticalStepSidebar steps={effectiveSteps} currentStep={currentStep} completedUpTo={completedUpTo} onStepClick={setCurrentStep} />
      )}

      {/* Main content area */}
      <main className="min-w-0 flex-1 bg-[#fcfcfc] p-0 lg:-mt-5">
        <div className="w-full min-w-0">
          {/* Mobile step indicator */}
          {useDynamic ? (
            <GroupedMobileStepBar
              sections={groupedSections}
              steps={effectiveSteps}
              currentStep={currentStep}
              completedUpTo={completedUpTo}
              onStepClick={setCurrentStep}
            />
          ) : (
            <MobileStepBar steps={effectiveSteps} currentStep={currentStep} completedUpTo={completedUpTo} onStepClick={setCurrentStep} />
          )}

          {/* Page header */}
          <div className="mb-5 sm:mb-6">
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
          <div className="flex flex-col gap-5 sm:gap-6">
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
                  <div className="w-full rounded-xl border border-[#efefef] bg-white p-4 sm:p-5 md:p-6">
                    {useDynamic ? (
                      /* Dynamic DB-driven form + photo/review/status steps */
                      <>
                        {/* DB-driven form steps */}
                        {step.id < photoStepIndex && dbSteps[step.id] && (
                          <DynamicStepForm
                            key={step.id}
                            step={dbSteps[step.id]}
                            prefill={dynamicAnswers}
                            onComplete={(data) => handleDynamicStepComplete(step.id, data)}
                            saving={saving}
                            country={visaPackage?.country}
                            visaType={getFormVisaType(visaPackage?.visa_type ?? "B211A")}
                          />
                        )}

                        {/* Photo upload step */}
                        {step.id === photoStepIndex && (
                          <PhotoUploadStep
                            applicationId={appState.applicationId}
                            country={visaPackage?.country}
                            visaType={visaPackage?.visa_type}
                            ensureApplicationId={ensurePhotoApplicationId}
                            existingPhotoUrl={appState.photo ? undefined : undefined}
                            onComplete={handlePhotoComplete}
                            onSkip={handlePhotoSkip}
                          />
                        )}

                        {/* Dynamic review step */}
                        {step.id === reviewStepIndex && appState.applicationId && (
                          <DynamicReviewStep
                            applicationId={appState.applicationId}
                            dynamicAnswers={dynamicAnswers}
                            dbSteps={dbSteps}
                            photoPath={appState.photo}
                            onEdit={(stepIdx) => setCurrentStep(stepIdx)}
                            onPhotoEdit={() => setCurrentStep(photoStepIndex)}
                            onComplete={handleDynamicReviewComplete}
                          />
                        )}

                        {/* Status/confirmation step */}
                        {step.id === statusStepIndex && appState.confirmationNumber && appState.submittedAt && (
                          <StatusStep
                            applicationId={appState.applicationId ?? undefined}
                            confirmationNumber={appState.confirmationNumber}
                            submittedAt={appState.submittedAt}
                            estimatedProcessingDays={5}
                            translationStatus={translationStatus ?? undefined}
                            originalData={{
                              personal: appState.personal,
                              passport: appState.passport,
                              travel: appState.travel,
                            }}
                          />
                        )}
                      </>
                    ) : (
                      /* Hardcoded B211A steps */
                      <>
                        {step.id === 0 && (
                          <PersonalInfoStep
                            prefill={appState.personal}
                            onComplete={handlePersonalComplete}
                          />
                        )}
                        {step.id === 1 && (
                          <PassportStep
                            prefill={appState.passport}
                            onComplete={handlePassportComplete}
                          />
                        )}
                        {step.id === 2 && (
                          <TravelInfoStep
                            prefill={appState.travel}
                            onComplete={handleTravelComplete}
                          />
                        )}
                        {step.id === 3 && appState.applicationId && (
                          <DocumentUploadStep
                            applicationId={appState.applicationId}
                            onComplete={handleDocumentsComplete}
                          />
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
                            onComplete={handleReviewComplete}
                          />
                        )}
                        {step.id === 5 && appState.confirmationNumber && appState.submittedAt && (
                          <StatusStep
                            applicationId={appState.applicationId ?? undefined}
                            confirmationNumber={appState.confirmationNumber}
                            submittedAt={appState.submittedAt}
                            estimatedProcessingDays={5}
                            translationStatus={translationStatus ?? undefined}
                            originalData={{
                              personal: appState.personal,
                              passport: appState.passport,
                              travel: appState.travel,
                            }}
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



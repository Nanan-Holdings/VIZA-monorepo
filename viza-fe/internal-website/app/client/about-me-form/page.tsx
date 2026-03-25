"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { QuizProgress } from "@/components/client/about-me/quiz-progress";
import { OptionButton } from "@/components/client/about-me/option-button";
import { SliderInput } from "@/components/client/about-me/slider-input";
import { TextInput } from "@/components/client/about-me/text-input";
import { MultiSelectOption } from "@/components/client/about-me/multi-select-option";
import { MeasurementInput } from "@/components/client/about-me/measurement-input";
import {
  ABOUT_ME_SECTIONS,
  ABOUT_ME_QUESTIONS,
  type AboutMeFormData,
} from "@/lib/forms/about-me-questions";
import { syncAboutMeToNormalizedTables } from "@/app/actions/about-me-sync";
import {
  validateNumericRange,
} from "@/lib/forms/about-me-field-mapper";
import {
  markQuestionnaireCompleted,
  skipFormRequest,
} from "@/app/actions/form-requests";

export default function AboutMeFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get requestId and returnTo from URL params (for form request tracking)
  const requestId = searchParams.get("requestId");
  const returnTo = searchParams.get("returnTo");
  const defaultFormData: AboutMeFormData = {
    profile: {},
    habits: {},
    diet: {},
    documents: {},
    hormones: {},
    recovery: {},
    conditions: {},
  };

  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [formData, setFormData] = useState<AboutMeFormData>(defaultFormData);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Get the redirect destination (with skipFormCheck param to prevent loop)
  const getRedirectUrl = () => {
    const destination = returnTo ? decodeURIComponent(returnTo) : "/client/about";
    const separator = destination.includes("?") ? "&" : "?";
    return `${destination}${separator}skipFormCheck=true`;
  };

  // Get the user's sex from form data (maps "Male"/"Female" to "M"/"F")
  const getUserSex = (): "M" | "F" | null => {
    const sexAnswer = formData.profile?.sex;
    if (sexAnswer === "Male") return "M";
    if (sexAnswer === "Female") return "F";
    return null;
  };

  // Filter sections based on user's sex (e.g., skip hormones section for males)
  const getFilteredSections = () => {
    const userSex = getUserSex();
    return ABOUT_ME_SECTIONS.filter((section) => {
      // If section has no gender filter, show it to everyone
      if (!section.genderFilter) return true;
      // If user hasn't answered sex yet, show all sections (they'll be filtered later)
      if (!userSex) return true;
      // Only show section if user's sex matches the filter
      return section.genderFilter === userSex;
    });
  };

  const filteredSections = getFilteredSections();
  const currentSection = filteredSections[currentSectionIndex];
  const currentQuestions = currentSection ? (ABOUT_ME_QUESTIONS[currentSection.id] || []) : [];
  const currentQuestion = currentQuestions[currentQuestionIndex];

  // Load existing form data on mount
  useEffect(() => {
    setIsLoading(false);
  }, []);

  // Add navigation warning when there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Handle skipping questions based on conditional logic
  useEffect(() => {
    if (!currentQuestion || !formData) return;

    // Check if question should be shown based on conditional logic
    const shouldShowQuestion = (): boolean => {
      if (!currentQuestion.conditional) return true;

      const { questionId, value } = currentQuestion.conditional;
      const sectionData = formData[currentSection.id as keyof AboutMeFormData] as Record<string, unknown>;
      const answerValue = sectionData?.[questionId];

      if (Array.isArray(value)) {
        return Array.isArray(answerValue) && value.some((v) => answerValue.includes(v));
      }

      return answerValue === value;
    };

    if (!shouldShowQuestion()) {
      const nextQuestionIndex = currentQuestionIndex + 1;
      if (nextQuestionIndex < currentQuestions.length) {
        setCurrentQuestionIndex(nextQuestionIndex);
      } else {
        const nextSectionIndex = currentSectionIndex + 1;
        if (nextSectionIndex < filteredSections.length) {
          setCurrentSectionIndex(nextSectionIndex);
          setCurrentQuestionIndex(0);
        } else {
          router.push("/client/about");
        }
      }
    }
  }, [currentQuestionIndex, currentSectionIndex, formData, currentQuestion, currentQuestions.length, router, currentSection?.id, filteredSections.length]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[#666]">Loading...</p>
      </div>
    );
  }

  if (!currentQuestion || !formData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[#666]">Invalid form state</p>
      </div>
    );
  }

  const getSectionData = (sectionId: string): Record<string, unknown> => {
    if (!formData) return {};
    return (formData[sectionId as keyof AboutMeFormData] as Record<string, unknown>) || {};
  };

  const updateSectionData = (sectionId: string, questionId: string, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      [sectionId]: {
        ...getSectionData(sectionId),
        [questionId]: value,
      },
    }));
    setHasUnsavedChanges(true);
    setValidationErrors([]); // Clear errors when user makes changes
    setError(null);
  };

  const handleNext = async () => {
    // Validate current section data
    setIsSaving(true);
    setValidationErrors([]);
    setError(null);
    
    try {
      const sectionData = getSectionData(currentSection.id);
      const errors: string[] = [];

      // Validate numeric ranges for current section
      for (const [questionKey, value] of Object.entries(sectionData)) {
        // Skip empty/undefined values
        if (value === undefined || value === null || value === "") {
          continue;
        }

        // Validate numeric ranges
        const rangeValidation = validateNumericRange(questionKey, value);
        if (!rangeValidation.isValid && rangeValidation.error) {
          errors.push(rangeValidation.error);
        }
      }

      // If there are validation errors, block navigation and show errors
      if (errors.length > 0) {
        const uniqueErrors = Array.from(new Set(errors));
        setValidationErrors(uniqueErrors);
        setIsSaving(false);
        return;
      }

      // Clear unsaved changes flag after successful validation
      setHasUnsavedChanges(false);
      setError(null);

      // Move to next question
      const nextQuestionIndex = currentQuestionIndex + 1;
      if (nextQuestionIndex < currentQuestions.length) {
        setCurrentQuestionIndex(nextQuestionIndex);
      } else {
        // Move to next section (using filtered sections based on user's sex)
        const nextSectionIndex = currentSectionIndex + 1;
        const sectionsToUse = getFilteredSections();
        if (nextSectionIndex < sectionsToUse.length) {
          setCurrentSectionIndex(nextSectionIndex);
          setCurrentQuestionIndex(0);
        } else {
          // Form complete - save all data to normalized tables before redirecting
          console.log("[Form] Submitting form data:", JSON.stringify(formData, null, 2));
          const syncResult = await syncAboutMeToNormalizedTables(formData);
          console.log("[Form] Sync result:", syncResult);

          if (!syncResult.success) {
            setError(`Failed to save data: ${syncResult.error}`);
            setIsSaving(false);
            return;
          }

          // Always mark the questionnaire as completed so the timeline card
          // reflects "done" regardless of how the user accessed the form.
          const completeResult = await markQuestionnaireCompleted(requestId ?? undefined);
          if (!completeResult.success) {
            console.error("[Form] Failed to mark questionnaire as completed:", completeResult.error);
            // Continue anyway - the data was saved
          }

          router.push(getRedirectUrl());
        }
      }
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : String(err)}`);
      setValidationErrors([`Unexpected error: ${err instanceof Error ? err.message : String(err)}`]);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    // If we're at the first question of the first section, go back in browser history
    if (currentSectionIndex === 0 && currentQuestionIndex === 0) {
      window.history.back();
      return;
    }
    
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    } else if (currentSectionIndex > 0) {
      const prevSectionIndex = currentSectionIndex - 1;
      setCurrentSectionIndex(prevSectionIndex);
      const sectionsToUse = getFilteredSections();
      const prevSectionQuestions = ABOUT_ME_QUESTIONS[sectionsToUse[prevSectionIndex].id] || [];
      setCurrentQuestionIndex(Math.max(0, prevSectionQuestions.length - 1));
    }
  };

  // Check if current question has a valid answer
  const hasValidAnswer = () => {
    const sectionData = getSectionData(currentSection.id);
    const currentValue = sectionData[currentQuestion.id];

    if (currentQuestion.type === "multi-select") {
      // Multi-select allows empty array as valid (represents "None")
      return true;
    }

    if (currentQuestion.type === "slider" || currentQuestion.type === "number") {
      // Sliders require a value to be set
      return currentValue !== undefined && currentValue !== null;
    }

    // For other types, check if value is non-empty
    return currentValue !== undefined && currentValue !== null && currentValue !== "";
  };

  const handleEnterKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter") return;
    if (isSaving || !hasValidAnswer()) return;
    event.preventDefault();
    void handleNext();
  };

  // Handle skipping the form (only available if triggered by a form request)
  const handleSkip = async () => {
    if (!requestId || isSkipping) return;

    setIsSkipping(true);
    setError(null);

    try {
      const result = await skipFormRequest(requestId);
      if (!result.success) {
        setError(`Failed to skip: ${result.error}`);
        setIsSkipping(false);
        return;
      }

      router.push(getRedirectUrl());
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : String(err)}`);
      setIsSkipping(false);
    }
  };

  const renderQuestionInput = () => {
    const sectionData = getSectionData(currentSection.id);
    const currentValue = sectionData[currentQuestion.id];

    switch (currentQuestion.type) {
      case "select": {
        // Check if this is a question that should show an input field on specific selection
        const shouldShowExpandedInput = 
          currentQuestion.id === "current_documents" && currentValue === "Yes (please specify)" ||
          currentQuestion.id === "hormone_therapy" && currentValue === "Yes (please specify document and dose)" ||
          currentQuestion.id === "thyroid_document" && currentValue === "Yes (please specify document and dose)" ||
          currentQuestion.id === "diet_type" && typeof currentValue === "string" && currentValue.includes("Other");
        
        return (
          <div className="space-y-3">
            {currentQuestion.options?.map((option) => (
              <OptionButton
                key={option}
                label={option}
                selected={currentValue === option}
                onClick={() => updateSectionData(currentSection.id, currentQuestion.id, option)}
              />
            ))}
            
            {/* Show expanded input field when specific option is selected */}
            {shouldShowExpandedInput && (
              <div className="mt-4 animate-in slide-in-from-top-2 duration-300">
                <TextInput
                  value={(() => {
                    const detailsKey = currentQuestion.id === "current_documents" 
                      ? "document_details" 
                      : currentQuestion.id === "hormone_therapy"
                      ? "hormone_therapy_details"
                      : currentQuestion.id === "thyroid_document"
                      ? "thyroid_document_details"
                      : "diet_details";
                    const sectionData = getSectionData(currentSection.id);
                    return typeof sectionData[detailsKey] === "string" ? sectionData[detailsKey] : "";
                  })()}
                  onChange={(value) => {
                    const detailsKey = currentQuestion.id === "current_documents" 
                      ? "document_details" 
                      : currentQuestion.id === "hormone_therapy"
                      ? "hormone_therapy_details"
                      : currentQuestion.id === "thyroid_document"
                      ? "thyroid_document_details"
                      : "diet_details";
                    updateSectionData(currentSection.id, detailsKey, value);
                  }}
                  placeholder={currentQuestion.id === "current_documents" 
                    ? "List your documents..." 
                    : currentQuestion.id === "diet_type"
                    ? "Describe your diet..."
                    : "Specify document and dose..."}
                />
              </div>
            )}
          </div>
        );
      }

      case "multi-select": {
        const multiSelectValue = (Array.isArray(currentValue) ? currentValue : []) as string[];
        const showMultiSelectDetails = currentQuestion.id === "conditions" && 
                                       multiSelectValue.some(v => v.includes("Other"));
        
        return (
          <div className="space-y-3">
            {currentQuestion.options?.map((option) => (
              <MultiSelectOption
                key={option}
                label={option}
                selected={multiSelectValue.includes(option)}
                onClick={() => {
                  const newValue = multiSelectValue.includes(option)
                    ? multiSelectValue.filter((v) => v !== option)
                    : [...multiSelectValue, option];
                  updateSectionData(currentSection.id, currentQuestion.id, newValue);
                }}
              />
            ))}
            
            {/* Show expanded input when "Other" is selected */}
            {showMultiSelectDetails && (
              <div className="mt-4 animate-in slide-in-from-top-2 duration-300">
                <TextInput
                  value={(() => {
                    const sectionData = getSectionData(currentSection.id);
                    return typeof sectionData.conditions_details === "string" 
                      ? sectionData.conditions_details 
                      : "";
                  })()}
                  onChange={(value) => updateSectionData(currentSection.id, "conditions_details", value)}
                  placeholder="Please specify other conditions..."
                />
              </div>
            )}
          </div>
        );
      }

      case "slider":
        return (
          <SliderInput
            value={typeof currentValue === "number" ? currentValue : 5}
            onChange={(value) => updateSectionData(currentSection.id, currentQuestion.id, value)}
            min={1}
            max={10}
          />
        );

      case "number":
        return (
          <SliderInput
            value={typeof currentValue === "number" ? currentValue : 1}
            onChange={(value) => updateSectionData(currentSection.id, currentQuestion.id, value)}
            min={1}
            max={35}
          />
        );

      case "text":
        // Use MeasurementInput for profile section questions
        if (currentSection.id === "profile") {
          const unitConfigMap: Record<string, { defaultUnit: string; options: string[]; unitField: string }> = {
            height: { defaultUnit: "cm", options: ["cm", "in"], unitField: "height_unit" },
            weight: { defaultUnit: "kg", options: ["kg", "lb"], unitField: "weight_unit" },
            waist_circumference: {
              defaultUnit: "cm",
              options: ["cm", "in"],
              unitField: "waist_circumference_unit",
            },
          };
          const unitConfig = unitConfigMap[currentQuestion.id];
          const fallbackUnit = unitConfig?.defaultUnit || "";
          const savedUnit = typeof sectionData[unitConfig?.unitField || ""] === "string"
            ? String(sectionData[unitConfig?.unitField || ""])
            : undefined;
          const unit = savedUnit && unitConfig?.options.includes(savedUnit) ? savedUnit : fallbackUnit;
          const inputValue =
            typeof currentValue === "string"
              ? currentValue
              : typeof currentValue === "number"
                ? currentValue.toString()
                : "";
          
          return (
            <MeasurementInput
              value={inputValue}
              onChange={(value) => updateSectionData(currentSection.id, currentQuestion.id, value)}
              unit={unit}
              unitOptions={unitConfig?.options || []}
              onUnitChange={(nextUnit) => {
                if (!unitConfig) return;
                updateSectionData(currentSection.id, unitConfig.unitField, nextUnit);
              }}
              question={currentQuestion.question}
              subtitle={currentQuestion.subtitle}
            />
          );
        }
        
        // Fall back to TextInput for other sections
        return (
          <TextInput
            value={typeof currentValue === "string" ? currentValue : ""}
            onChange={(value) => updateSectionData(currentSection.id, currentQuestion.id, value)}
            placeholder={`Answer about your ${currentQuestion.id.replace(/_/g, " ")}`}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-white font-sofia-pro" onKeyDown={handleEnterKey}>
      {/* Header with back button and progress */}
      <div className="relative mb-8 w-full pt-8 md:mb-10 md:pt-10">
        <div className="px-4 md:px-10">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Go back"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-60 focus:outline-none md:h-[56px] md:w-[56px]"
            style={{ backgroundColor: '#0000000A' }}
          >
            <svg width="19" height="19" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9.33463 17.5003L1.16797 9.33366M1.16797 9.33366L9.33463 1.16699M1.16797 9.33366H17.5013" stroke="black" strokeWidth="2.33333" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        
        <div className="mt-6 px-4 md:absolute md:left-1/2 md:top-10 md:mt-0 md:w-[761px] md:-translate-x-1/2 md:px-0">
          <QuizProgress
            sections={filteredSections}
            currentSectionIndex={currentSectionIndex}
            activeProgress={currentQuestions.length > 0 ? (currentQuestionIndex + 1) / currentQuestions.length : 0}
          />
        </div>
      </div>

      {/* Content area - centered with variable max-width based on section */}
      <div className={`mx-auto px-4 pb-28 md:px-10 ${currentSection.id === "profile" ? "md:max-w-[526px]" : "md:max-w-[761px]"}`}>
        {/* Question block */}
        <div className="mt-0 space-y-7 md:mt-3">
          {/* Only show question header if not using MeasurementInput */}
          {!(currentSection.id === "profile" && currentQuestion.type === "text") && (
            <div className="space-y-2">
              <h1 className="text-[20px] font-medium leading-[1.3] tracking-[-0.6px] text-black md:text-[28px] md:tracking-[-1.12px]">
                {currentQuestion.question}
              </h1>
              {currentQuestion.subtitle && (
                <p className="text-[14px] text-[#989898] leading-[1.5] tracking-[-0.24px] md:text-[16px]">
                  {currentQuestion.subtitle}
                </p>
              )}
            </div>
          )}

          <div className="mt-4 space-y-3 md:space-y-3.5">{renderQuestionInput()}</div>
        </div>

        {/* Error message - consolidated to avoid duplication */}
        {(validationErrors.length > 0 || error) && (
          <div className="mt-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md space-y-2">
            {validationErrors.length > 0 ? (
              validationErrors.map((err, idx) => (
                <p key={idx} className="text-sm">{err}</p>
              ))
            ) : (
              <p className="text-sm">{error}</p>
            )}
          </div>
        )}
      </div>

      {/* Spacer to avoid overlap with fixed CTA */}
      <div className="h-28" />

      {/* Next/Submit CTA and Skip button */}
      <div className="fixed bottom-4 left-0 right-0 flex flex-col items-center gap-3 px-4 sm:bottom-6 sm:px-6">
        <button
          onClick={handleNext}
          disabled={isSaving || isSkipping || !hasValidAnswer()}
          className="inline-flex h-[48px] w-full max-w-[420px] items-center justify-center rounded-full border border-black bg-black px-6 text-[14px] font-medium leading-[1.6] text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50 md:h-[52px] md:text-[16px]"
        >
          {isSaving ? "Saving..." : currentSectionIndex === filteredSections.length - 1 && currentQuestionIndex === currentQuestions.length - 1 ? "Submit" : "Next"}
          <span className="ml-3 hidden items-center gap-2 text-[14px] text-white/80 md:inline-flex">
            <kbd className="rounded border border-white/40 px-2 py-0.5 text-[12px] font-medium">⏎</kbd>
          </span>
        </button>

        {/* Skip button - only shown if this is from a form request */}
        {requestId && (
          <button
            onClick={handleSkip}
            disabled={isSaving || isSkipping}
            className="text-[14px] text-[#989898] hover:text-[#666] transition-colors disabled:opacity-50"
          >
            {isSkipping ? "Skipping..." : "Skip for now"}
          </button>
        )}
      </div>
    </div>
  );
}

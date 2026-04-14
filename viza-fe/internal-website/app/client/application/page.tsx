"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { getVisaFormSteps } from "@/app/actions/visa-form-fields";
import { type WizardStep } from "@/types/visa-form-fields";
import { getUserVisaPackage, type UserVisaPackage } from "@/app/actions/user-package";
import {
  PersonalInfoStep,
  PassportStep,
  TravelInfoStep,
  DocumentUploadStep,
  ReviewStep,
  StatusStep,
  type PersonalInfoData,
  type PassportData,
  type TravelInfoData,
  type DocumentType,
} from "@/components/application-steps";
import { DynamicStepForm } from "@/components/dynamic-step-form";

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

type StepStatus = "complete" | "in_progress" | "locked";

interface StepDef {
  id: number;
  name: string;
  description: string;
}

const STEP_KEYS = ["personalInfo", "passport", "travelDetails", "documents", "review", "status"] as const;

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
  return (
    <aside className="w-[360px] shrink-0 pl-4 pr-0 pt-9 hidden lg:block z-10 sticky top-0 self-start" style={{ marginTop: "-400px" }}>
      <div className="relative">
      <div
        className="absolute top-4 bottom-0 border-l-2 border-dashed border-gray-200"
        style={{ left: "calc(16px + 24px + 12px + 16px - 16px)" }}
      />
      <div className="relative flex flex-col gap-3">
        {steps.map((step, i) => {
          const status: StepStatus =
            i < completedUpTo ? "complete" : i === currentStep ? "in_progress" : "locked";

          return (
            <button
              type="button"
              key={step.id}
              onClick={() => onStepClick(step.id)}
              className={cn(
                "rounded-xl border bg-white px-5 py-4 flex gap-4 items-center transition-all duration-200 text-left cursor-pointer hover:shadow-sm",
                status === "in_progress"
                  ? "border-[#03346E] border-[1.5px] shadow-[0_2px_12px_rgba(3,52,110,0.08)]"
                  : "border-[#efefef] hover:border-gray-300",
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
                  <CheckCircle2 className="h-4 w-4" />
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
  return (
    <div className="lg:hidden mb-6 bg-white rounded-lg border border-gray-100 shadow-sm p-4">
      <div className="flex items-center gap-1">
        {steps.map((step, i) => {
          const status: StepStatus =
            i < completedUpTo ? "complete" : i === currentStep ? "in_progress" : "locked";
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
                  <CheckCircle2 className="h-3 w-3" />
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
        {t("stepOf", { current: currentStep + 1, total: steps.length, name: steps[currentStep]?.name })}
      </p>
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
  confirmationNumber?: string;
  submittedAt?: string;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ApplicationPage() {
  const t = useTranslations("application");

  const STEPS: StepDef[] = STEP_KEYS.map((key, id) => ({
    id,
    name: t(`steps.${key}.name`),
    description: t(`steps.${key}.description`),
  }));

  // DB-driven steps (loaded from visa_form_fields table)
  // Falls back to hardcoded STEPS if DB returns empty
  const [dbSteps, setDbSteps] = useState<WizardStep[]>([]);
  const [visaPackage, setVisaPackage] = useState<UserVisaPackage | null>(null);

  useEffect(() => {
    getUserVisaPackage().then((pkg) => {
      if (pkg) setVisaPackage(pkg);
      const visaType = pkg?.visa_type ?? "B211A";
      return getVisaFormSteps(visaType);
    }).then((steps) => {
      if (steps.length > 0) setDbSteps(steps);
    }).catch(() => {
      // Silent fallback to hardcoded steps
    });
  }, []);

  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedUpTo, setCompletedUpTo] = useState(0);
  const [appState, setAppState] = useState<ApplicationState>({
    applicationId: null,
    personal: {},
    passport: {},
    travel: {},
    documents: {},
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Dynamic form answers keyed by field_name
  const [dynamicAnswers, setDynamicAnswers] = useState<Record<string, string>>({});

  // Use DB-driven steps when available, otherwise fall back to hardcoded
  const useDynamic = dbSteps.length > 0;
  const tDyn = useTranslations("application.dynamicSteps");
  const tApp = useTranslations("application");
  const effectiveSteps: StepDef[] = useDynamic
    ? dbSteps.map((s, i) => ({
        id: i,
        name: tDyn.has(s.stepName) ? tDyn(s.stepName as never) : s.stepName,
        description: tApp("dynamicStepDescription", { count: s.fields.length }),
      }))
    : STEPS;

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: profile } = await supabase
      .from("applicant_profiles")
      .select("*")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    const { data: application } = await supabase
      .from("applications")
      .select("*")
      .eq("applicant_id", profile?.id ?? "")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (profile) {
      setAppState((prev) => ({
        ...prev,
        applicationId: application?.id ?? null,
        personal: {
          fullName: profile.full_name ?? "",
          dateOfBirth: profile.date_of_birth ?? "",
          placeOfBirth: profile.place_of_birth ?? "",
          gender: profile.gender ?? "",
          nationality: profile.nationality ?? "",
          occupation: profile.occupation ?? "",
          address: profile.address ?? "",
        },
        passport: {
          passportNumber: profile.passport_number ?? "",
          issueDate: profile.passport_issue_date ?? "",
          expiryDate: profile.passport_expiry_date ?? "",
          issuingCountry: profile.passport_issuing_country ?? "",
          issuingAuthority: profile.passport_issuing_authority ?? "",
        },
        travel: {
          arrivalDate: application?.arrival_date ?? "",
          departureDate: application?.departure_date ?? "",
          portOfEntry: application?.port_of_entry ?? "",
          purpose: application?.purpose ?? "",
          accommodationName: application?.accommodation_name ?? "",
          accommodationAddress: application?.accommodation_address ?? "",
        },
        confirmationNumber: application?.confirmation_number ?? undefined,
        submittedAt: application?.submitted_at ?? undefined,
      }));

      const hasPersonal = !!(profile.full_name && profile.nationality);
      const hasPassport = !!(profile.passport_number && profile.passport_expiry_date);
      const hasTravel = !!(application?.arrival_date && application?.departure_date);
      const hasDocuments = application?.status === "submitted" || application?.status === "approved";
      const isSubmitted = application?.status === "submitted" || application?.status === "approved";

      const completed = hasPersonal ? (hasPassport ? (hasTravel ? (hasDocuments ? (isSubmitted ? 6 : 4) : 3) : 2) : 1) : 0;
      setCompletedUpTo(completed);
      setCurrentStep(Math.min(completed, 5));
    }

    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

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
          full_name: data.fullName,
          date_of_birth: data.dateOfBirth || null,
          place_of_birth: data.placeOfBirth || null,
          gender: data.gender || null,
          nationality: data.nationality,
          occupation: data.occupation || null,
          address: data.address || null,
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
          passport_issue_date: data.issueDate || null,
          passport_expiry_date: data.expiryDate || null,
          passport_issuing_country: data.issuingCountry,
          passport_issuing_authority: data.issuingAuthority || null,
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
            visa_type: visaPackage?.visa_type ?? "tourist_b211a",
            arrival_date: data.arrivalDate || null,
            departure_date: data.departureDate || null,
            port_of_entry: data.portOfEntry || null,
            purpose: data.purpose || null,
            accommodation_name: data.accommodationName || null,
            accommodation_address: data.accommodationAddress || null,
          })
          .select("id")
          .single();
        if (appError) throw appError;
        applicationId = newApp.id;
      } else {
        await supabase.from("applications").update({
          arrival_date: data.arrivalDate || null,
          departure_date: data.departureDate || null,
          port_of_entry: data.portOfEntry || null,
          purpose: data.purpose || null,
          accommodation_name: data.accommodationName || null,
          accommodation_address: data.accommodationAddress || null,
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
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t("errors.notAuthenticated"));

      // Ensure we have a profile
      const { data: profile } = await supabase
        .from("applicant_profiles")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!profile) throw new Error(t("errors.profileNotFound"));

      // Create application if it doesn't exist yet (on first step completion)
      let applicationId = appState.applicationId;
      if (!applicationId) {
        const { data: newApp, error: appError } = await supabase
          .from("applications")
          .insert({
            applicant_id: profile.id,
            status: "draft",
            country: visaPackage?.country ?? "united_states",
            visa_type: visaPackage?.visa_type ?? "DS160",
          })
          .select("id")
          .single();
        if (appError) throw appError;
        applicationId = newApp.id;
        setAppState((prev) => ({ ...prev, applicationId }));
      }

      // Save answers to visa_application_answers
      const upserts = Object.entries(data)
        .filter(([, v]) => v.trim() !== "")
        .map(([fieldName, value]) => ({
          application_id: applicationId!,
          field_name: fieldName,
          value_text: value,
          updated_at: new Date().toISOString(),
        }));

      if (upserts.length > 0) {
        const { error: upsertError } = await supabase
          .from("visa_application_answers")
          .upsert(upserts, { onConflict: "application_id,field_name" });
        if (upsertError) throw upsertError;
      }

      // Update local state
      setDynamicAnswers((prev) => ({ ...prev, ...data }));
      setCompletedUpTo((c) => Math.max(c, stepIndex + 1));
      setCurrentStep(stepIndex + 1);
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

  const handleReviewComplete = async () => {
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      if (!appState.applicationId) throw new Error(t("errors.noApplicationFound"));

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

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#03346E]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen lg:min-h-0 lg:h-[calc(100vh-8rem)] lg:overflow-y-auto pt-3" style={{ marginLeft: "-20px" }}>
      {/* Left sidebar - desktop only */}
      <VerticalStepSidebar steps={effectiveSteps} currentStep={currentStep} completedUpTo={completedUpTo} onStepClick={setCurrentStep} />

      {/* Main content area */}
      <main className="flex-1 bg-[#fcfcfc] p-4 sm:p-6 lg:p-8" style={{ marginTop: "-20px", marginLeft: "-60px" }}>
        <div className="max-w-3xl mx-auto">
          {/* Mobile step indicator */}
          <MobileStepBar steps={effectiveSteps} currentStep={currentStep} completedUpTo={completedUpTo} onStepClick={setCurrentStep} />

          {/* Page header */}
          <div className="mb-8 sm:mb-12">
            <h1 className="font-heading font-medium leading-[1.15] text-[28px] tracking-[-1px] text-[#3d3d3d] sm:text-[34px] sm:tracking-[-1.2px] lg:text-[40px] lg:tracking-[-1.6px]">
              {visaPackage?.name ?? t("title")}
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
                  <div className="w-full rounded-xl border border-[#efefef] bg-white p-4 sm:p-6">
                    {useDynamic ? (
                      /* Dynamic DB-driven form */
                      <DynamicStepForm
                        key={step.id}
                        step={dbSteps[step.id]}
                        prefill={dynamicAnswers}
                        onComplete={(data) => handleDynamicStepComplete(step.id, data)}
                        saving={saving}
                      />
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
                            confirmationNumber={appState.confirmationNumber}
                            submittedAt={appState.submittedAt}
                            estimatedProcessingDays={5}
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



"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getUserVisaPackage } from "@/app/actions/user-package";
import { getOnboardingCopy, type OnboardingCopy } from "./copy";

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

const STEPS = [
  { id: "personal" },
  { id: "passport" },
  { id: "travel" },
  { id: "contact" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

interface OnboardingData {
  personal: {
    fullName: string;
    dateOfBirth: string;
    nationality: string;
  };
  passport: {
    passportNumber: string;
    issueDate: string;
    expiryDate: string;
    issuingCountry: string;
  };
  travel: {
    arrivalDate: string;
    departureDate: string;
    purpose: string;
  };
  contact: {
    email: string;
    phone: string;
    wechat: string;
  };
}

const defaultData: OnboardingData = {
  personal: { fullName: "", dateOfBirth: "", nationality: "" },
  passport: { passportNumber: "", issueDate: "", expiryDate: "", issuingCountry: "" },
  travel: { arrivalDate: "", departureDate: "", purpose: "" },
  contact: { email: "", phone: "", wechat: "" },
};

// ---------------------------------------------------------------------------
// Progress bar for the passport and contact onboarding flow.
// ---------------------------------------------------------------------------

function OnboardingProgress({ currentStepIndex, copy }: { currentStepIndex: number; copy: OnboardingCopy }) {
  const overallPercent = Math.round(((currentStepIndex) / STEPS.length) * 100);

  return (
    <div className="flex-1 flex items-center justify-start">
      {/* Mobile: single progress bar */}
      <div className="w-full md:hidden">
        <div className="relative w-full h-[8px] rounded-full bg-[#EFEFEF] overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${overallPercent}%`,
              background: "linear-gradient(90deg, #7A9DCE 0%, #03346E 100%)",
            }}
          />
        </div>
      </div>

      {/* Desktop: per-section bars with labels */}
      <div className="hidden md:flex items-center gap-4 w-full">
        {STEPS.map((step, index) => {
          const isComplete = index < currentStepIndex;
          const isActive = index === currentStepIndex;
          const fillPercent = isComplete ? 100 : isActive ? 50 : 0;

          return (
            <div key={step.id} className="flex flex-col items-center gap-2 h-[35px] flex-1">
              <div className="relative w-full h-[8px] rounded-full bg-[#EFEFEF] overflow-hidden">
                {(isActive || isComplete) && (
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${fillPercent}%`,
                      background: "linear-gradient(90deg, #7A9DCE 0%, #03346E 100%)",
                    }}
                  />
                )}
              </div>
              <span
                className={`text-[12px] leading-[1.6] font-medium transition-colors whitespace-nowrap text-center ${
                  isActive ? "text-brand-500" : isComplete ? "text-brand-400" : "text-[#DCDCDC]"
                }`}
              >
                {copy.steps[step.id]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field component
// ---------------------------------------------------------------------------

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[6px]">
      <label className="text-[13px] font-medium text-[#666] tracking-[-0.2px]">{label}</label>
      {children}
    </div>
  );
}

const inputClass =
  "h-[48px] w-full rounded-[8px] border border-[#efefef] bg-white px-[12px] font-sans text-[15px] tracking-[-0.21px] text-[#3d3d3d] placeholder:text-[#3d3d3d]/40 outline-none focus:border-brand-500 transition-colors disabled:opacity-50";

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function OnboardingPage() {
  const router = useRouter();
  const locale = useLocale();
  const copy = getOnboardingCopy(locale);
  const [isChecking, setIsChecking] = useState(true);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [data, setData] = useState<OnboardingData>(defaultData);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if onboarding already done — redirect to home if so
  useEffect(() => {
    async function check() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/client/login"); return; }

      const { data: profile } = await supabase
        .from("applicant_profiles")
        .select("onboarding_done")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (profile?.onboarding_done) {
        router.replace("/client/home");
        return;
      }

      setIsChecking(false);
    }
    check();
  }, [router]);

  const currentStep = STEPS[currentStepIndex];

  const update = <K extends StepId>(step: K, field: keyof OnboardingData[K], value: string) => {
    setData((prev) => ({
      ...prev,
      [step]: { ...prev[step], [field]: value },
    }));
    setError(null);
  };

  const isStepValid = (): boolean => {
    const d = data[currentStep.id];
    return Object.values(d).some((v) => v.trim() !== "");
  };

  const handleBack = () => {
    if (currentStepIndex === 0) { window.history.back(); return; }
    setCurrentStepIndex((i) => i - 1);
    setError(null);
  };

  const handleNext = async () => {
    if (!isStepValid()) { setError(copy.errors.stepRequired); return; }
    setError(null);

    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex((i) => i + 1);
      return;
    }

    // Last step — save to Supabase
    setIsSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(copy.errors.saveFailed);

      // Upsert applicant_profiles
      const { error: profileError } = await supabase
        .from("applicant_profiles")
        .upsert(
          {
            auth_user_id: user.id,
            full_name: data.personal.fullName || null,
            date_of_birth: data.personal.dateOfBirth || null,
            nationality: data.personal.nationality || null,
            passport_number: data.passport.passportNumber || null,
            passport_issue_date: data.passport.issueDate || null,
            passport_expiry_date: data.passport.expiryDate || null,
            passport_issuing_country: data.passport.issuingCountry || null,
            email: data.contact.email || null,
            phone: data.contact.phone || null,
            wechat: data.contact.wechat || null,
            onboarding_done: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "auth_user_id" }
        );

      if (profileError) throw profileError;

      const assignedPackage = await getUserVisaPackage();
      const applicantId = (await supabase
        .from("applicant_profiles")
        .select("id")
        .eq("auth_user_id", user.id)
        .single()
        .then((r) => r.data?.id)) as string;

      // Insert a package-aware draft application row with travel data
      await supabase.from("applications").insert({
        applicant_id: applicantId,
        arrival_date: data.travel.arrivalDate || null,
        departure_date: data.travel.departureDate || null,
        purpose: data.travel.purpose || null,
        status: "draft",
        country: assignedPackage?.country ?? "indonesia",
        visa_type: assignedPackage?.visa_type ?? "ID_C1_TOURIST",
        visa_package_id: assignedPackage?.id ?? null,
      });

      router.replace("/client/home");
    } catch {
      setError(copy.errors.saveFailed);
      setIsSaving(false);
    }
  };

  const handleEnterKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter") return;
    if (isSaving || !isStepValid()) return;
    event.preventDefault();
    void handleNext();
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  const isLastStep = currentStepIndex === STEPS.length - 1;

  return (
    <div className="min-h-screen bg-white font-sans" onKeyDown={handleEnterKey}>
      {/* Header */}
      <div className="relative mb-8 w-full pt-8 md:mb-10 md:pt-10">
        <div className="px-4 md:px-10">
          <button
            type="button"
            onClick={handleBack}
            aria-label={copy.actions.back}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-60 focus:outline-none md:h-[56px] md:w-[56px]"
            style={{ backgroundColor: "#0000000A" }}
          >
            <svg width="19" height="19" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9.33463 17.5003L1.16797 9.33366M1.16797 9.33366L9.33463 1.16699M1.16797 9.33366H17.5013" stroke="black" strokeWidth="2.33333" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <div className="mt-6 px-4 md:absolute md:left-1/2 md:top-10 md:mt-0 md:w-[761px] md:-translate-x-1/2 md:px-0">
          <OnboardingProgress currentStepIndex={currentStepIndex} copy={copy} />
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto px-4 pb-28 md:px-10 md:max-w-[526px]">
        <div className="mt-0 space-y-7 md:mt-3">
          <div className="space-y-2">
            <h1 className="text-[20px] font-medium leading-[1.3] tracking-[-0.6px] text-black md:text-[28px] md:tracking-[-1.12px]">
              {copy.titles[currentStep.id]}
            </h1>
            <p className="text-[14px] text-[#989898] leading-[1.5] tracking-[-0.24px] md:text-[16px]">
              {copy.subtitles[currentStep.id]}
            </p>
          </div>

          <div className="space-y-4">
            {currentStep.id === "personal" && (
              <>
                <Field label={copy.fields.fullName}>
                  <input
                    type="text"
                    className={inputClass}
                    placeholder={copy.fields.fullNamePlaceholder}
                    value={data.personal.fullName}
                    onChange={(e) => update("personal", "fullName", e.target.value)}
                  />
                </Field>
                <Field label={copy.fields.dateOfBirth}>
                  <input
                    type="date"
                    className={inputClass}
                    value={data.personal.dateOfBirth}
                    onChange={(e) => update("personal", "dateOfBirth", e.target.value)}
                  />
                </Field>
                <Field label={copy.fields.nationality}>
                  <input
                    type="text"
                    className={inputClass}
                    placeholder={copy.fields.nationalityPlaceholder}
                    value={data.personal.nationality}
                    onChange={(e) => update("personal", "nationality", e.target.value)}
                  />
                </Field>
              </>
            )}

            {currentStep.id === "passport" && (
              <>
                <Field label={copy.fields.passportNumber}>
                  <input
                    type="text"
                    className={inputClass}
                    placeholder={copy.fields.passportNumberPlaceholder}
                    value={data.passport.passportNumber}
                    onChange={(e) => update("passport", "passportNumber", e.target.value)}
                  />
                </Field>
                <Field label={copy.fields.issueDate}>
                  <input
                    type="date"
                    className={inputClass}
                    value={data.passport.issueDate}
                    onChange={(e) => update("passport", "issueDate", e.target.value)}
                  />
                </Field>
                <Field label={copy.fields.expiryDate}>
                  <input
                    type="date"
                    className={inputClass}
                    value={data.passport.expiryDate}
                    onChange={(e) => update("passport", "expiryDate", e.target.value)}
                  />
                </Field>
                <Field label={copy.fields.issuingCountry}>
                  <input
                    type="text"
                    className={inputClass}
                    placeholder={copy.fields.issuingCountryPlaceholder}
                    value={data.passport.issuingCountry}
                    onChange={(e) => update("passport", "issuingCountry", e.target.value)}
                  />
                </Field>
              </>
            )}

            {currentStep.id === "travel" && (
              <>
                <Field label={copy.fields.arrivalDate}>
                  <input
                    type="date"
                    className={inputClass}
                    value={data.travel.arrivalDate}
                    onChange={(e) => update("travel", "arrivalDate", e.target.value)}
                  />
                </Field>
                <Field label={copy.fields.departureDate}>
                  <input
                    type="date"
                    className={inputClass}
                    value={data.travel.departureDate}
                    onChange={(e) => update("travel", "departureDate", e.target.value)}
                  />
                </Field>
                <Field label={copy.fields.purpose}>
                  <select
                    className={inputClass}
                    value={data.travel.purpose}
                    onChange={(e) => update("travel", "purpose", e.target.value)}
                  >
                    <option value="">{copy.fields.purposePlaceholder}</option>
                    <option value="tourism">{copy.purposes.tourism}</option>
                    <option value="business">{copy.purposes.business}</option>
                    <option value="social_cultural">{copy.purposes.socialCultural}</option>
                    <option value="family_visit">{copy.purposes.familyVisit}</option>
                  </select>
                </Field>
              </>
            )}

            {currentStep.id === "contact" && (
              <>
                <Field label={copy.fields.email}>
                  <input
                    type="email"
                    className={inputClass}
                    placeholder={copy.fields.emailPlaceholder}
                    value={data.contact.email}
                    onChange={(e) => update("contact", "email", e.target.value)}
                  />
                </Field>
                <Field label={copy.fields.phone}>
                  <input
                    type="tel"
                    className={inputClass}
                    placeholder={copy.fields.phonePlaceholder}
                    value={data.contact.phone}
                    onChange={(e) => update("contact", "phone", e.target.value)}
                  />
                </Field>
                <Field label={copy.fields.wechat}>
                  <input
                    type="text"
                    className={inputClass}
                    placeholder={copy.fields.wechatPlaceholder}
                    value={data.contact.wechat}
                    onChange={(e) => update("contact", "wechat", e.target.value)}
                  />
                </Field>
              </>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-[#e5e7eb] bg-white px-4 py-3 text-sm text-[#71717a]">
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>
      </div>

      <div className="h-28" />

      {/* CTA */}
      <div className="fixed bottom-4 left-0 right-0 flex flex-col items-center gap-3 px-4 sm:bottom-6 sm:px-6">
        <button
          onClick={handleNext}
          disabled={isSaving || !isStepValid()}
          className="inline-flex h-[48px] w-full max-w-[420px] items-center justify-center rounded-full border border-black bg-black px-6 text-[14px] font-medium leading-[1.6] text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50 md:h-[52px] md:text-[16px]"
        >
          {isSaving ? (
            <span className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" />{copy.actions.saving}</span>
          ) : isLastStep ? (
            copy.actions.submit
          ) : (
            <>
              {copy.actions.next}
              <span className="ml-3 hidden items-center gap-2 text-[14px] text-white/80 md:inline-flex">
                <kbd className="rounded border border-white/40 px-2 py-0.5 text-[12px] font-medium">⏎</kbd>
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

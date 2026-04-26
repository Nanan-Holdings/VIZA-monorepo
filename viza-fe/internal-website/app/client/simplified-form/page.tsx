"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  ensureDraftApplication,
  loadSimplifiedFormState,
  saveDynamicAnswers,
  saveSimplifiedFormState,
} from "@/app/actions/visa-application-answers";
import { getUserVisaPackage } from "@/app/actions/user-package";
import { ProgressRail } from "@/components/client/simplified-form/progress-rail";
import { StepIdentity } from "@/components/client/simplified-form/step-identity";
import { StepContact } from "@/components/client/simplified-form/step-contact";
import { StepPassport } from "@/components/client/simplified-form/step-passport";
import { StepTravel } from "@/components/client/simplified-form/step-travel";
import { StepUsStay } from "@/components/client/simplified-form/step-us-stay";
import { StepUsContact } from "@/components/client/simplified-form/step-us-contact";
import { StepFamily } from "@/components/client/simplified-form/step-family";
import { StepBackground } from "@/components/client/simplified-form/step-background";
import { StepWorkEducation } from "@/components/client/simplified-form/step-work-education";
import { useSimplifiedFormContext } from "@/lib/context/simplified-form-context";
import {
  buildAnswerPayload,
  emptySimplifiedForm,
  type SimplifiedFormData,
} from "@/components/client/simplified-form/types";

export default function SimplifiedFormPage() {
  const router = useRouter();
  const t = useTranslations("simplifiedForm");
  const shouldReduceMotion = useReducedMotion();
  const { setFormData } = useSimplifiedFormContext();

  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<SimplifiedFormData>(emptySimplifiedForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);

  const shouldIncludeUsStayStep = useMemo(() => {
    if (form.travel.plansState === "unsure") return false;
    if (form.travel.plansState === "idea" && form.travel.lengthUnit === "LessThan24Hours") return false;
    return true;
  }, [form.travel.plansState, form.travel.lengthUnit]);

  const stepOrder = useMemo(() => {
    const base = ["0", "1", "2", "3"] as const;
    const middle = ["6", "usContact"] as const;
    const tail = ["4", "5"] as const;
    if (shouldIncludeUsStayStep) {
      return [...base, "usStay", ...middle, ...tail] as const;
    }
    return [...base, ...middle, ...tail] as const;
  }, [shouldIncludeUsStayStep]);

  const totalSteps = stepOrder.length;
  const currentStepKey = stepOrder[stepIndex] ?? stepOrder[0];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      const userEmail = user?.email ?? "";
      // Pre-create the draft application so steps that need an applicationId
      // (e.g. passport scan upload path) can run before the user submits.
      try {
        const pkg = await getUserVisaPackage();
        if (cancelled) return;
        const { applicationId: draftId } = await ensureDraftApplication(
          pkg?.country ?? "US",
          pkg?.visa_type ?? "B1/B2",
        );
        if (cancelled || !draftId) {
          if (userEmail) {
            setForm((prev) => ({ ...prev, contact: { ...prev.contact, email: prev.contact.email || userEmail } }));
          }
          setLoading(false);
          return;
        }
        setApplicationId(draftId);

        // Restore any prior wizard state for this draft so the user resumes
        // exactly where they left off.
        const { state } = await loadSimplifiedFormState(draftId);
        if (cancelled) return;
        if (state?.form && typeof state.form === "object") {
          const restored = state.form as SimplifiedFormData;
          setForm({
            ...emptySimplifiedForm(),
            ...restored,
            contact: {
              ...emptySimplifiedForm().contact,
              ...(restored.contact ?? {}),
              email: restored.contact?.email || userEmail,
            },
          });
          if (typeof state.stepIndex === "number" && state.stepIndex >= 0) {
            setStepIndex(state.stepIndex);
          }
        } else if (userEmail) {
          setForm((prev) => ({
            ...prev,
            contact: { ...prev.contact, email: prev.contact.email || userEmail },
          }));
        }
      } catch {
        if (userEmail) {
          setForm((prev) => ({ ...prev, contact: { ...prev.contact, email: prev.contact.email || userEmail } }));
        }
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced auto-save of the wizard state. Skips while loading/submitting
  // and before the draft application is ready.
  useEffect(() => {
    if (loading || submitting || !applicationId) return;
    const handle = window.setTimeout(() => {
      saveSimplifiedFormState(applicationId, { form, stepIndex }).catch(() => {
        // Auto-save is best-effort — surface nothing to the user.
      });
    }, 600);
    return () => window.clearTimeout(handle);
  }, [applicationId, form, stepIndex, loading, submitting]);

  const stepLabel = useMemo(
    () =>
      t("progress", {
        current: stepIndex + 1,
        total: totalSteps,
        name: t(`steps.${currentStepKey}` as never),
      }),
    [currentStepKey, stepIndex, t, totalSteps],
  );

  useEffect(() => {
    if (stepIndex > totalSteps - 1) {
      setStepIndex(totalSteps - 1);
    }
  }, [stepIndex, totalSteps]);

  const goBack = useCallback(() => {
    if (stepIndex > 0) {
      setStepIndex((i) => i - 1);
    } else {
      router.push("/client/home");
    }
  }, [stepIndex, router]);

  const goNext = useCallback(() => {
    setStepIndex((i) => Math.min(totalSteps - 1, i + 1));
  }, [totalSteps]);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      let appId = applicationId;
      if (!appId) {
        const pkg = await getUserVisaPackage();
        const { applicationId: ensuredId, error: ensureErr } = await ensureDraftApplication(
          pkg?.country ?? "US",
          pkg?.visa_type ?? "B1/B2",
        );
        if (ensureErr || !ensuredId) {
          throw new Error(ensureErr ?? "Could not create application");
        }
        appId = ensuredId;
        setApplicationId(appId);
      }
      const payload = buildAnswerPayload(form);
      const { error: saveErr } = await saveDynamicAnswers(appId, payload);
      if (saveErr) throw new Error(saveErr);
      // Store form data in context and redirect to review page
      setFormData(form);
      router.push("/client/simplified-form/review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
      setSubmitting(false);
    }
  }, [applicationId, form, router, setFormData]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-brand-500" />
        <p className="text-lg text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  const motionProps = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
        transition: { duration: 0.2, ease: "easeOut" as const },
      };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 pb-12">
      <ProgressRail
        step={stepIndex + 1}
        total={totalSteps}
        label={stepLabel}
        onBack={goBack}
        backLabel={t("common.back")}
      />

      <div className="rounded-xl border bg-white p-5 shadow-sm sm:p-8">
        <AnimatePresence mode="wait">
          <motion.div key={stepIndex} {...motionProps}>
            {currentStepKey === "0" ? (
              <StepIdentity
                value={form.identity}
                onChange={(next) => setForm((f) => ({ ...f, identity: next }))}
                onContinue={goNext}
                applicationId={applicationId}
                onPassportExtracted={(passportPatch) =>
                  setForm((f) => ({ ...f, passport: { ...f.passport, ...passportPatch } }))
                }
              />
            ) : null}
            {currentStepKey === "1" ? (
              <StepContact
                value={form.contact}
                onChange={(next) => setForm((f) => ({ ...f, contact: next }))}
                onContinue={goNext}
              />
            ) : null}
            {currentStepKey === "2" ? (
              <StepPassport
                value={form.passport}
                onChange={(next) => setForm((f) => ({ ...f, passport: next }))}
                onContinue={goNext}
              />
            ) : null}
            {currentStepKey === "3" ? (
              <StepTravel
                value={form.travel}
                onChange={(next) => setForm((f) => ({ ...f, travel: next }))}
                onContinue={goNext}
              />
            ) : null}
            {currentStepKey === "usStay" ? (
              <StepUsStay
                value={form.travel}
                onChange={(next) => setForm((f) => ({ ...f, travel: next }))}
                onContinue={goNext}
              />
            ) : null}
            {currentStepKey === "usContact" ? (
              <StepUsContact
                value={form.usContact}
                onChange={(next) => setForm((f) => ({ ...f, usContact: next }))}
                onContinue={goNext}
              />
            ) : null}
            {currentStepKey === "4" ? (
              <StepFamily
                value={form.family}
                onChange={(next) => setForm((f) => ({ ...f, family: next }))}
                onContinue={goNext}
                maritalStatus={form.identity.maritalStatus}
                onChangeMaritalStatus={() => setStepIndex(0)}
              />
            ) : null}
            {currentStepKey === "5" ? (
              <StepBackground
                value={form.background}
                onChange={(next) => setForm((f) => ({ ...f, background: next }))}
                onSubmit={handleSubmit}
                submitting={submitting}
              />
            ) : null}
            {currentStepKey === "6" ? (
              <StepWorkEducation
                value={form.work}
                onChange={(next) => setForm((f) => ({ ...f, work: next }))}
                onContinue={goNext}
              />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>

      {error ? (
        <p role="alert" className="text-center text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

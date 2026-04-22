"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ensureDraftApplication, saveDynamicAnswers } from "@/app/actions/visa-application-answers";
import { getUserVisaPackage } from "@/app/actions/user-package";
import { ProgressRail } from "@/components/client/simplified-form/progress-rail";
import { StepIdentity } from "@/components/client/simplified-form/step-identity";
import { StepContact } from "@/components/client/simplified-form/step-contact";
import { StepPassport } from "@/components/client/simplified-form/step-passport";
import { StepTravel } from "@/components/client/simplified-form/step-travel";
import { StepFamily } from "@/components/client/simplified-form/step-family";
import { StepBackground } from "@/components/client/simplified-form/step-background";
import {
  buildAnswerPayload,
  emptySimplifiedForm,
  type SimplifiedFormData,
} from "@/components/client/simplified-form/types";

const TOTAL_STEPS = 6;

export default function SimplifiedFormPage() {
  const router = useRouter();
  const t = useTranslations("simplifiedForm");
  const shouldReduceMotion = useReducedMotion();

  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<SimplifiedFormData>(emptySimplifiedForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (user?.email) {
        setForm((prev) => ({ ...prev, contact: { ...prev.contact, email: prev.contact.email || user.email! } }));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stepLabel = useMemo(
    () =>
      t("progress", {
        current: stepIndex + 1,
        total: TOTAL_STEPS,
        name: t(`steps.${stepIndex}` as never),
      }),
    [stepIndex, t],
  );

  const goBack = useCallback(() => {
    if (stepIndex > 0) {
      setStepIndex((i) => i - 1);
    } else {
      router.push("/client/home");
    }
  }, [stepIndex, router]);

  const goNext = useCallback(() => {
    setStepIndex((i) => Math.min(TOTAL_STEPS - 1, i + 1));
  }, []);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      const pkg = await getUserVisaPackage();
      const { applicationId, error: ensureErr } = await ensureDraftApplication(
        pkg?.country ?? "US",
        pkg?.visa_type ?? "B1/B2",
      );
      if (ensureErr || !applicationId) {
        throw new Error(ensureErr ?? "Could not create application");
      }
      const payload = buildAnswerPayload(form);
      const { error: saveErr } = await saveDynamicAnswers(applicationId, payload);
      if (saveErr) throw new Error(saveErr);
      router.push("/client/application?step=review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
      setSubmitting(false);
    }
  }, [form, router]);

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
        total={TOTAL_STEPS}
        label={stepLabel}
        onBack={goBack}
        backLabel={t("common.back")}
      />

      <div className="rounded-xl border bg-white p-5 shadow-sm sm:p-8">
        <AnimatePresence mode="wait">
          <motion.div key={stepIndex} {...motionProps}>
            {stepIndex === 0 ? (
              <StepIdentity
                value={form.identity}
                onChange={(next) => setForm((f) => ({ ...f, identity: next }))}
                onContinue={goNext}
              />
            ) : null}
            {stepIndex === 1 ? (
              <StepContact
                value={form.contact}
                onChange={(next) => setForm((f) => ({ ...f, contact: next }))}
                onContinue={goNext}
              />
            ) : null}
            {stepIndex === 2 ? (
              <StepPassport
                value={form.passport}
                onChange={(next) => setForm((f) => ({ ...f, passport: next }))}
                onContinue={goNext}
              />
            ) : null}
            {stepIndex === 3 ? (
              <StepTravel
                value={form.travel}
                onChange={(next) => setForm((f) => ({ ...f, travel: next }))}
                onContinue={goNext}
              />
            ) : null}
            {stepIndex === 4 ? (
              <StepFamily
                value={form.family}
                onChange={(next) => setForm((f) => ({ ...f, family: next }))}
                onContinue={goNext}
              />
            ) : null}
            {stepIndex === 5 ? (
              <StepBackground
                value={form.background}
                onChange={(next) => setForm((f) => ({ ...f, background: next }))}
                onSubmit={handleSubmit}
                submitting={submitting}
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

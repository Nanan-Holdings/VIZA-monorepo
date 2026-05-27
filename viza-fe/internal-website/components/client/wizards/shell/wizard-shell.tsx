"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { DocumentCenterClient } from "@/app/client/documents/document-center-client";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  ensureDraftApplication,
  loadSimplifiedFormState,
  saveDynamicAnswers,
  saveSimplifiedFormState,
} from "@/app/actions/visa-application-answers";
import { getUserVisaPackage } from "@/app/actions/user-package";
import { ProgressRail } from "@/components/client/simplified-form/progress-rail";
import { WizardReview } from "./wizard-review";
import type { WizardConfig } from "./types";

interface WizardShellProps<TForm> {
  config: WizardConfig<TForm>;
}

const REVIEW_STEP_KEY = "__review";
const DOCUMENT_STEP_KEY = "__documents";

export function WizardShell<TForm>({ config }: WizardShellProps<TForm>) {
  const router = useRouter();
  const tShared = useTranslations("simplifiedForm.shared");
  const tCountry = useTranslations(config.i18nNamespace);
  const shouldReduceMotion = useReducedMotion();

  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<TForm>(() => config.emptyForm());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);

  const visibleSteps = useMemo(
    () => config.steps.filter((s) => !s.showIf || s.showIf(form)),
    [config, form],
  );
  const documentIndex = visibleSteps.length;
  const reviewIndex = visibleSteps.length + 1;
  const totalSteps = visibleSteps.length + 2; // +1 for documents, +1 for review
  const onDocuments = stepIndex === documentIndex;
  const onReview = stepIndex === reviewIndex;
  const currentStep = onDocuments || onReview ? null : visibleSteps[Math.min(stepIndex, visibleSteps.length - 1)];

  // Initial load: get user, draft application, restore prior state.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled) return;
        const userEmail = user?.email ?? "";
        const pkg = await getUserVisaPackage();
        if (cancelled) return;

        const { applicationId: draftId } = await ensureDraftApplication(
          pkg?.country ?? config.defaultCountry,
          pkg?.visa_type ?? config.defaultVisaType,
        );
        if (cancelled || !draftId) {
          if (userEmail && config.seedAuthEmail) {
            setForm((prev) => config.seedAuthEmail!(prev, userEmail));
          }
          setLoading(false);
          return;
        }
        setApplicationId(draftId);

        const { state } = await loadSimplifiedFormState(draftId);
        if (cancelled) return;
        if (state?.form && typeof state.form === "object") {
          const restored = state.form as TForm;
          const merged = config.seedAuthEmail
            ? config.seedAuthEmail(restored, userEmail)
            : restored;
          setForm(merged);
          if (typeof state.stepIndex === "number" && state.stepIndex >= 0) {
            setStepIndex(state.stepIndex);
          }
        } else if (userEmail && config.seedAuthEmail) {
          setForm((prev) => config.seedAuthEmail!(prev, userEmail));
        }
      } catch {
        /* non-fatal — wizard still renders empty */
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [config]);

  // Debounced auto-save.
  useEffect(() => {
    if (loading || submitting || !applicationId) return;
    const handle = window.setTimeout(() => {
      saveSimplifiedFormState(applicationId, { form, stepIndex }).catch(() => {});
    }, 600);
    return () => window.clearTimeout(handle);
  }, [applicationId, form, stepIndex, loading, submitting]);

  // Clamp stepIndex if conditional steps drop out beneath us.
  useEffect(() => {
    if (stepIndex > totalSteps - 1) setStepIndex(totalSteps - 1);
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

  const goToStep = useCallback((index: number) => {
    setStepIndex(Math.max(0, Math.min(totalSteps - 1, index)));
  }, [totalSteps]);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      let appId = applicationId;
      if (!appId) {
        const pkg = await getUserVisaPackage();
        const { applicationId: ensuredId, error: ensureErr } = await ensureDraftApplication(
          pkg?.country ?? config.defaultCountry,
          pkg?.visa_type ?? config.defaultVisaType,
        );
        if (ensureErr || !ensuredId) {
          throw new Error(ensureErr ?? "Could not create application");
        }
        appId = ensuredId;
        setApplicationId(appId);
      }
      const payload = config.buildAnswerPayload(form);
      const { error: saveErr } = await saveDynamicAnswers(appId, payload);
      if (saveErr) throw new Error(saveErr);
      router.push(config.onSubmitRedirect ?? "/client/application/long-form");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
      setSubmitting(false);
    }
  }, [applicationId, config, form, router]);

  const stepLabel = useMemo(() => {
    const titleKey = onDocuments
      ? ""
      : onReview
      ? "review.label"
      : currentStep
        ? currentStep.titleKey
        : visibleSteps[0]?.titleKey ?? "";
    const name = onDocuments
      ? "材料 / Documents"
      : tCountry.has(titleKey as never)
      ? tCountry(titleKey as never)
      : tShared.has(titleKey as never)
        ? tShared(titleKey as never)
        : "";
    return tShared("progress", { current: stepIndex + 1, total: totalSteps, name });
  }, [currentStep, onDocuments, onReview, stepIndex, tCountry, tShared, totalSteps, visibleSteps]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-brand-500" />
        <p className="text-lg text-muted-foreground">{tShared("loading")}</p>
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

  const setFormFn = (updater: (prev: TForm) => TForm) => setForm(updater);

  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col gap-6 pb-12",
        onDocuments ? "max-w-6xl" : "max-w-2xl"
      )}
    >
      <ProgressRail
        step={stepIndex + 1}
        total={totalSteps}
        label={stepLabel}
        onBack={goBack}
        backLabel={tShared("back")}
      />

      <div
        className={cn(
          !onDocuments && "rounded-xl border bg-white p-5 shadow-sm sm:p-8"
        )}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={onDocuments ? DOCUMENT_STEP_KEY : onReview ? REVIEW_STEP_KEY : currentStep?.key ?? "_"}
            {...motionProps}
          >
            {onDocuments ? (
              applicationId ? (
                <DocumentCenterClient
                  initialData={null}
                  initialError={null}
                  applicationId={applicationId}
                  embedded
                  onContinue={goNext}
                  continueLabel="继续"
                />
              ) : (
                <div className="flex min-h-[240px] items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
                </div>
              )
            ) : onReview ? (
              <WizardReview
                config={config}
                form={form}
                onEditStep={(stepKey) => {
                  const i = visibleSteps.findIndex((s) => s.key === stepKey);
                  if (i >= 0) setStepIndex(i);
                }}
                onSubmit={handleSubmit}
                submitting={submitting}
              />
            ) : currentStep ? (
              currentStep.render({
                form,
                setForm: setFormFn,
                applicationId,
                onContinue: goNext,
                onBack: goBack,
                onSubmit: handleSubmit,
                submitting,
                goToStep,
              })
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>

      {error ? (
        <p role="alert" className="text-center text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <p className="text-center text-xs text-muted-foreground">
        {tShared("openLongFormLead")}{" "}
        <Link className="underline" href="/client/application/long-form">
          {tShared("openLongFormLink")}
        </Link>
      </p>
    </div>
  );
}

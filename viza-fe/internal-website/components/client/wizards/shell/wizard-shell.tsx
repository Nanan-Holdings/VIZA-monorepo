"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { DocumentCenterClient } from "@/app/client/documents/document-center-client";
import {
  loadDocumentCenterData,
  type DocumentCenterData,
} from "@/app/client/documents/actions";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  ensureDraftApplication,
  loadSimplifiedFormState,
  saveDynamicAnswers,
  saveSimplifiedFormState,
} from "@/app/actions/visa-application-answers";
import { getUserVisaPackage } from "@/app/actions/user-package";
import { setRecentApplicationFormHref } from "@/lib/client/recent-application-form";
import { getFormVisaType } from "@/lib/visa-destinations";
import { ProgressRail } from "@/components/client/simplified-form/progress-rail";
import { PassportOcrUpload } from "@/components/client/passport-ocr-upload";
import {
  mergeUniversalProfileIntoWizardForm,
  UNIVERSAL_PROFILE_SELECT,
  type UniversalProfileSnapshot,
} from "@/lib/universal-profile-prefill";
import { WizardReview } from "./wizard-review";
import type { WizardConfig } from "./types";

interface WizardShellProps<TForm> {
  config: WizardConfig<TForm>;
  requestedCountry?: string | null;
  requestedVisaType?: string | null;
}

const REVIEW_STEP_KEY = "__review";
const DOCUMENT_STEP_KEY = "__documents";

const ZH_WIZARD_KEY_LABELS: Record<string, string> = {
  identity: "身份",
  personal: "个人信息",
  contact: "联系方式",
  passport: "护照",
  document: "证件",
  travel: "旅行",
  trip: "行程",
  tripDates: "行程日期",
  tripDestination: "目的地",
  accommodation: "住宿",
  occupation: "职业",
  work: "工作与教育",
  usStay: "美国住宿",
  usContact: "美国联系人",
  family: "家庭",
  familyEu: "欧盟亲属",
  background: "背景",
  purpose: "目的",
  funding: "资金",
  declaration: "声明",
  sponsor: "担保人",
  host: "联系人",
  travelHistory: "旅行历史",
  stream: "签证类别",
  applicationContext: "申请背景",
  visit: "访问",
  companions: "同行人",
  health: "健康",
  character: "品格",
};

function fallbackWizardLabel(key: string, locale: string): string {
  const parts = key.split(".");
  const last = parts.at(-1) ?? key;
  const semanticKey = ["label", "title", "subtitle"].includes(last)
    ? parts.at(-2) ?? last
    : last;

  if (locale.toLowerCase().startsWith("zh")) {
    return ZH_WIZARD_KEY_LABELS[semanticKey] ?? semanticKey;
  }

  return semanticKey
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

export function WizardShell<TForm>({
  config,
  requestedCountry = null,
  requestedVisaType = null,
}: WizardShellProps<TForm>) {
  const router = useRouter();
  const locale = useLocale();
  const tShared = useTranslations("simplifiedForm.shared");
  const tCountry = useTranslations(config.i18nNamespace);
  const shouldReduceMotion = useReducedMotion();

  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<TForm>(() => config.emptyForm());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [applicationCountry, setApplicationCountry] = useState(config.defaultCountry);
  const [applicationVisaType, setApplicationVisaType] = useState(config.defaultVisaType);
  const [documentCenterData, setDocumentCenterData] = useState<DocumentCenterData | null>(null);
  const [documentCenterError, setDocumentCenterError] = useState<string | null>(null);

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
        const { data: profile } = user
          ? await supabase
              .from("applicant_profiles")
              .select(UNIVERSAL_PROFILE_SELECT)
              .eq("auth_user_id", user.id)
              .maybeSingle()
          : { data: null };
        const pkg = await getUserVisaPackage();
        if (cancelled) return;
        const country = requestedCountry ?? pkg?.country ?? config.defaultCountry;
        const visaType = getFormVisaType(requestedVisaType ?? pkg?.visa_type ?? config.defaultVisaType);
        setApplicationCountry(country);
        setApplicationVisaType(visaType);

        const { applicationId: draftId } = await ensureDraftApplication(
          country,
          visaType,
        );
        if (cancelled || !draftId) {
          if (userEmail && config.seedAuthEmail) {
            setForm((prev) =>
              mergeUniversalProfileIntoWizardForm(
                config.seedAuthEmail!(prev, userEmail),
                profile as UniversalProfileSnapshot | null,
              ),
            );
          } else if (profile) {
            setForm((prev) => mergeUniversalProfileIntoWizardForm(prev, profile as UniversalProfileSnapshot));
          }
          setLoading(false);
          return;
        }
        setApplicationId(draftId);

        const { state } = await loadSimplifiedFormState(draftId);
        if (cancelled) return;
        if (state?.form && typeof state.form === "object") {
          const restored = state.form as TForm;
          const withEmail = config.seedAuthEmail
            ? config.seedAuthEmail(restored, userEmail)
            : restored;
          const merged = mergeUniversalProfileIntoWizardForm(
            withEmail,
            profile as UniversalProfileSnapshot | null,
          );
          setForm(merged);
        } else if (userEmail && config.seedAuthEmail) {
          setForm((prev) =>
            mergeUniversalProfileIntoWizardForm(
              config.seedAuthEmail!(prev, userEmail),
              profile as UniversalProfileSnapshot | null,
            ),
          );
        } else if (profile) {
          setForm((prev) => mergeUniversalProfileIntoWizardForm(prev, profile as UniversalProfileSnapshot));
        }
      } catch {
        /* non-fatal — wizard still renders empty */
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [config, requestedCountry, requestedVisaType]);

  useEffect(() => {
    if (loading) return;

    const params = new URLSearchParams();
    params.set("country", applicationCountry);
    params.set("visaType", applicationVisaType);
    setRecentApplicationFormHref(`/client/application/long-form?${params.toString()}`);
  }, [applicationCountry, applicationVisaType, loading]);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return;
      channel = supabase
        .channel("simplified-form-universal-profile")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "applicant_profiles",
            filter: `auth_user_id=eq.${user.id}`,
          },
          (payload) => {
            setForm((prev) =>
              mergeUniversalProfileIntoWizardForm(prev, payload.new as UniversalProfileSnapshot),
            );
          },
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  // Debounced auto-save.
  useEffect(() => {
    if (loading || submitting || !applicationId) return;
    const handle = window.setTimeout(() => {
      saveSimplifiedFormState(applicationId, { form, stepIndex }).catch(() => {});
    }, 600);
    return () => window.clearTimeout(handle);
  }, [applicationId, form, stepIndex, loading, submitting]);

  useEffect(() => {
    if (loading || !applicationId) return;

    let cancelled = false;
    setDocumentCenterData((current) =>
      current?.selectedApplication?.id === applicationId ? current : null
    );
    setDocumentCenterError(null);

    loadDocumentCenterData({
      applicationId,
      country: applicationCountry,
      visaType: applicationVisaType,
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
      })
      .catch((err) => {
        if (!cancelled) {
          setDocumentCenterData(null);
          setDocumentCenterError(err instanceof Error ? err.message : tShared("documentsLoadError"));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applicationCountry, applicationId, applicationVisaType, loading, tShared]);

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

  const longFormHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("country", applicationCountry);
    params.set("visaType", applicationVisaType);
    return `/client/application/long-form?${params.toString()}`;
  }, [applicationCountry, applicationVisaType]);

  const buildApplicationRedirect = useCallback(
    (href: string) => {
      const target = new URL(href, window.location.origin);
      if (!target.searchParams.get("country")) {
        target.searchParams.set("country", applicationCountry);
      }
      if (!target.searchParams.get("visaType")) {
        target.searchParams.set("visaType", applicationVisaType);
      }
      return target.toString().replace(window.location.origin, "");
    },
    [applicationCountry, applicationVisaType],
  );

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      let appId = applicationId;
      if (!appId) {
        const { applicationId: ensuredId, error: ensureErr } = await ensureDraftApplication(
          applicationCountry,
          applicationVisaType,
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
      router.push(buildApplicationRedirect(config.onSubmitRedirect ?? "/client/application/long-form"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
      setSubmitting(false);
    }
  }, [
    applicationCountry,
    applicationId,
    applicationVisaType,
    buildApplicationRedirect,
    config,
    form,
    router,
  ]);

  const stepLabel = useMemo(() => {
    const titleKey = onDocuments
      ? ""
      : onReview
      ? "review.label"
      : currentStep
        ? currentStep.titleKey
        : visibleSteps[0]?.titleKey ?? "";
    const name = onDocuments
      ? tShared("documents")
      : tCountry.has(titleKey as never)
      ? tCountry(titleKey as never)
      : tShared.has(titleKey as never)
        ? tShared(titleKey as never)
        : fallbackWizardLabel(titleKey, locale);
    return tShared("progress", { current: stepIndex + 1, total: totalSteps, name });
  }, [currentStep, locale, onDocuments, onReview, stepIndex, tCountry, tShared, totalSteps, visibleSteps]);

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
        {!onDocuments && !onReview ? (
          <PassportOcrUpload
            applicationId={applicationId}
            className="mb-6"
            onFieldsApplied={(fields) => {
              setForm((prev) => mergeUniversalProfileIntoWizardForm(prev, fields, { force: true }));
            }}
          />
        ) : null}

        <AnimatePresence mode="wait">
          <motion.div
            key={onDocuments ? DOCUMENT_STEP_KEY : onReview ? REVIEW_STEP_KEY : currentStep?.key ?? "_"}
            {...motionProps}
          >
            {onDocuments ? (
              applicationId ? (
                <DocumentCenterClient
                  initialData={documentCenterData}
                  initialError={documentCenterError}
                  applicationId={applicationId}
                  country={applicationCountry}
                  visaType={applicationVisaType}
                  embedded
                  onContinue={goNext}
                  continueLabel={tShared("continue")}
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
        <Link className="underline" href={longFormHref}>
          {tShared("openLongFormLink")}
        </Link>
      </p>
    </div>
  );
}

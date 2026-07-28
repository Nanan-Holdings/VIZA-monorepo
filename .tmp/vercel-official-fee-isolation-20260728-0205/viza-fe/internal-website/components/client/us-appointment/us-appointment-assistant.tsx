"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Eye,
  EyeOff,
  Loader2,
  PauseCircle,
  Play,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { BrandActionButton } from "@/components/client/brand-action-button";
import { BrandField, BrandInput } from "@/components/client/brand-field";
import { getTeamApplicationContext } from "@/app/actions/application-group";
import {
  approveAppointmentFinalConfirmation,
  bookSelectedAppointmentSlot,
  cancelAppointmentJob,
  checkAppointmentSlots,
  checkAppointmentStatus,
  completeAppointmentManualAction,
  createAppointmentJob,
  getAppointmentStatus,
  recordAppointmentConsent,
  revealAppointmentAccount,
  resumeAppointmentJob,
  runAppointmentJob,
  selectAppointmentSlot,
  USAppointmentApiError,
} from "@/lib/us-appointment/client";
import { cn } from "@/lib/utils";
import type {
  AppointmentManualActionType,
  RevealedAppointmentAccount,
  AppointmentSlot,
  AppointmentStatusSnapshot,
  JsonObject,
  USAppointmentStatus,
} from "@/types/us-appointment";

type BusyAction =
  | "load"
  | "review"
  | "create"
  | "run"
  | "manual"
  | "slot"
  | "approve"
  | "book"
  | "account"
  | "checkSlots"
  | "checkStatus"
  | "cancel";

type AppointmentStage = "review" | "account" | "slots" | "confirm" | "result";

interface AppointmentReviewData {
  fullName: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  passportNumber: string | null;
  passportExpiryDate: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
}

const TERMINAL_STATUSES = new Set<USAppointmentStatus>([
  "appointment_confirmation_captured",
  "appointment_status_checked",
  "appointment_failed",
  "appointment_cancelled",
  "appointment_blocked_by_site_policy",
]);

const SLOT_CHECK_STATUSES = new Set<USAppointmentStatus>([
  "appointment_calendar_opened",
  "appointment_slots_observed",
  "appointment_slot_selection_required",
  "appointment_no_slots_available",
]);

const STATUS_TONE: Record<
  string,
  { icon: typeof Clock3; className: string }
> = {
  idle: {
    icon: Clock3,
    className: "border-slate-200 bg-slate-50 text-slate-700",
  },
  progress: {
    icon: Loader2,
    className: "border-brand-200 bg-brand-50 text-brand-600",
  },
  action: {
    icon: PauseCircle,
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  success: {
    icon: CheckCircle2,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  danger: {
    icon: XCircle,
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
};

function getStatusTone(status: USAppointmentStatus | null) {
  if (!status) return STATUS_TONE.idle;
  if (
    status.includes("required") ||
    status === "appointment_no_slots_available" ||
    status === "appointment_manual_required"
  ) {
    return STATUS_TONE.action;
  }
  if (
    status === "appointment_confirmation_captured" ||
    status === "appointment_status_checked" ||
    status === "appointment_booked"
  ) {
    return STATUS_TONE.success;
  }
  if (
    status === "appointment_failed" ||
    status === "appointment_cancelled" ||
    status === "appointment_blocked_by_site_policy"
  ) {
    return STATUS_TONE.danger;
  }
  return STATUS_TONE.progress;
}

function formatDate(value: string | null, locale: string) {
  if (!value) return null;
  return new Intl.DateTimeFormat(locale.startsWith("zh") ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function selectedSlot(slots: AppointmentSlot[]) {
  return slots.find((slot) => ["selected", "user_selected"].includes(slot.status)) ?? null;
}

function getAppointmentStage(snapshot: AppointmentStatusSnapshot | null): AppointmentStage {
  if (!snapshot?.job) return "review";
  if (snapshot.confirmation) return "result";
  if (TERMINAL_STATUSES.has(snapshot.job.status)) return "review";
  const hasSelectedSlot = snapshot.slots.some((slot) =>
    ["selected", "user_selected"].includes(slot.status),
  );
  if (
    hasSelectedSlot ||
    snapshot.pendingManualAction?.actionType === "final_confirmation" ||
    [
      "appointment_slot_selected",
      "appointment_final_confirmation_required",
      "appointment_final_confirmation_approved",
      "appointment_booked",
    ].includes(snapshot.job.status)
  ) {
    return "confirm";
  }
  if (
    snapshot.slots.length > 0 ||
    [
      "appointment_calendar_opened",
      "appointment_slots_observed",
      "appointment_slot_selection_required",
      "appointment_no_slots_available",
    ].includes(snapshot.job.status)
  ) {
    return "slots";
  }
  return "account";
}

function buildManualInput(
  actionType: AppointmentManualActionType,
  manualInput: string,
): JsonObject {
  const trimmed = manualInput.trim();
  if (actionType === "account_email_verification") {
    return { verificationCode: trimmed };
  }
  if (actionType === "payment") {
    return { reviewedOfficialPaymentCheckpoint: true };
  }
  if (actionType === "captcha" || actionType === "login") {
    return { completedByUser: true };
  }
  if (actionType === "site_policy_review") {
    return { reviewedByUser: true };
  }
  return { note: trimmed || "completed" };
}

function StatusBadge({
  status,
  label,
}: {
  status: USAppointmentStatus | null;
  label: string;
}) {
  const tone = getStatusTone(status);
  const Icon = tone.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        tone.className,
      )}
    >
      <Icon
        className={cn("h-3.5 w-3.5", Icon === Loader2 && "animate-spin")}
      />
      {label}
    </span>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-foreground">
        {value}
      </p>
    </div>
  );
}

export function USAppointmentAssistant({
  applicationId,
  workerReady,
}: {
  applicationId: string;
  workerReady: boolean;
}) {
  const t = useTranslations("usAppointment");
  const locale = useLocale();
  const [snapshot, setSnapshot] = useState<AppointmentStatusSnapshot | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction | null>("load");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [consentRecorded, setConsentRecorded] = useState(false);
  const [ds160Code, setDs160Code] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [revealedAccount, setRevealedAccount] =
    useState<RevealedAppointmentAccount | null>(null);
  const [accountVisible, setAccountVisible] = useState(false);
  const [reviewData, setReviewData] = useState<AppointmentReviewData | null>(null);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);

  const job = snapshot?.job ?? null;
  const pendingManualAction = snapshot?.pendingManualAction ?? null;
  const slots = useMemo(() => snapshot?.slots ?? [], [snapshot?.slots]);
  const selectedAppointmentSlot = useMemo(() => selectedSlot(slots), [slots]);
  const finalApproved = useMemo(
    () =>
      snapshot?.manualActions.some(
        (action) =>
          action.actionType === "final_confirmation" &&
          action.status === "completed",
      ) ?? false,
    [snapshot?.manualActions],
  );

  const loadStatus = useCallback(async () => {
    setBusyAction("load");
    setErrorMessage(null);
    try {
      const next = await getAppointmentStatus(applicationId);
      setSnapshot(next);
      if (next.job) {
        setDs160Code((current) => current || next.job?.ds160ConfirmationCode || "");
        setConsentRecorded(true);
        setConsentAccepted(true);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof USAppointmentApiError
          ? error.code === "supabase_auth_not_configured"
            ? t("errors.supabaseAuthNotConfigured")
            : error.code === "appointment_schema_not_configured"
              ? t("errors.appointmentSchemaNotConfigured")
            : t("errors.withCode", { code: error.code })
          : t("errors.generic"),
      );
    } finally {
      setBusyAction(null);
    }
  }, [applicationId, t]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    let active = true;
    void getTeamApplicationContext(applicationId).then((context) => {
      if (!active || !context.ok || !context.profile) return;
      const profile = context.profile;
      const composedName = [profile.given_names_en, profile.surname_en]
        .filter(Boolean)
        .join(" ") || null;
      setReviewData({
        fullName: profile.full_name_en ?? composedName ?? profile.full_name ?? null,
        dateOfBirth: profile.date_of_birth ?? null,
        nationality: profile.nationality ?? null,
        passportNumber: profile.passport_number ?? null,
        passportExpiryDate: profile.passport_expiry_date ?? null,
        phone: profile.phone ?? null,
        email: profile.email ?? null,
        address: profile.address_en ?? profile.address ?? null,
      });
    });
    return () => {
      active = false;
    };
  }, [applicationId]);

  useEffect(() => {
    if (!job || TERMINAL_STATUSES.has(job.status)) return undefined;
    const timer = window.setInterval(() => {
      void getAppointmentStatus(applicationId)
        .then(setSnapshot)
        .catch(() => undefined);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [applicationId, job]);

  const runWithBusy = useCallback(
    async (
      action: BusyAction,
      task: () => Promise<AppointmentStatusSnapshot | null>,
    ) => {
      setBusyAction(action);
      setErrorMessage(null);
      try {
        const next = await task();
        if (next) setSnapshot(next);
      } catch (error) {
        setErrorMessage(
          error instanceof USAppointmentApiError
            ? error.code === "supabase_auth_not_configured"
              ? t("errors.supabaseAuthNotConfigured")
              : error.code === "appointment_schema_not_configured"
                ? t("errors.appointmentSchemaNotConfigured")
              : t("errors.withCode", { code: error.code })
            : t("errors.generic"),
        );
      } finally {
        setBusyAction(null);
      }
    },
    [t],
  );

  const recordConsent = useCallback(async () => {
    if (!consentAccepted) {
      setErrorMessage(t("setup.consentRequiredError"));
      return false;
    }
    await recordAppointmentConsent(applicationId, {
      idempotencyKey: `us-appointment-consent:${applicationId}:2026-07-review-v1`,
      consentSnapshot: {
        version: "2026-07-us-appointment-review-v1",
        mode: "assisted_live",
        assistedLiveCountry: "CN",
        finalConfirmationRequired: true,
        supportedCheckpointHandling: true,
        unsupportedGatesRequireManualReview: true,
        acceptedAt: new Date().toISOString(),
      },
    });
    setConsentRecorded(true);
    return true;
  }, [applicationId, consentAccepted, t]);

  const handleCreateJob = () => {
    void runWithBusy("create", async () => {
      const consentOk = consentRecorded || (await recordConsent());
      if (!consentOk) return null;
      const restartFromTerminal = Boolean(job && TERMINAL_STATUSES.has(job.status));
      const createdJob = await createAppointmentJob(applicationId, {
        mode: "assisted_live",
        ds160ConfirmationCode: ds160Code.trim() || undefined,
        applyingCountryCode: "CN",
        applyingPostCity: job?.applyingPostCity || "Beijing",
        schedulingProvider: "usvisascheduling",
        idempotencyKey: restartFromTerminal
          ? `us-appointment:${applicationId}:assisted-live:${Date.now()}`
          : undefined,
        userPreferencesJson: {
          appointmentType: "interview",
          assistedLiveCountry: "CN",
          provider: "usvisascheduling",
          slotSelectionSource: "backend_available_timings",
          usesVizaAliasEmail: true,
          finalConfirmationRequired: true,
        },
      });
      const next = await runAppointmentJob(createdJob.id);
      setReviewConfirmed(true);
      return next;
    });
  };

  const handleConfirmReview = () => {
    if (!job || TERMINAL_STATUSES.has(job.status)) {
      handleCreateJob();
      return;
    }
    void runWithBusy("review", async () => {
      const consentOk = await recordConsent();
      if (!consentOk) return null;
      setReviewConfirmed(true);
      return getAppointmentStatus(applicationId);
    });
  };

  const handleRevealAccount = () => {
    void runWithBusy("account", async () => {
      const account = await revealAppointmentAccount(applicationId);
      setRevealedAccount(account);
      setAccountVisible(true);
      return getAppointmentStatus(applicationId);
    });
  };

  const handleRun = (resume: boolean) => {
    if (!job) return;
    void runWithBusy("run", () =>
      resume ? resumeAppointmentJob(job.id) : runAppointmentJob(job.id),
    );
  };

  const handleCompleteManualAction = () => {
    if (!pendingManualAction) return;
    if (
      pendingManualAction.actionType === "account_email_verification" &&
      !manualInput.trim()
    ) {
      setErrorMessage(t("manual.emailCodeRequired"));
      return;
    }
    void runWithBusy("manual", () =>
      completeAppointmentManualAction(
        pendingManualAction.id,
        buildManualInput(pendingManualAction.actionType, manualInput),
      ),
    );
    setManualInput("");
  };

  const handleSelectSlot = (slotId: string) => {
    if (!job) return;
    void runWithBusy("slot", () => selectAppointmentSlot(job.id, slotId));
  };

  const canRun =
    Boolean(job) &&
    !pendingManualAction &&
    job?.status !== "appointment_final_confirmation_required" &&
    !TERMINAL_STATUSES.has(job?.status ?? "appointment_not_started");
  const canCheckSlots =
    Boolean(job) && SLOT_CHECK_STATUSES.has(job?.status ?? "appointment_not_started");
  const canCheckStatus = Boolean(job && snapshot?.confirmation);
  const canBook = Boolean(job && selectedAppointmentSlot && finalApproved && !snapshot?.confirmation);
  const applicationFormHref =
    `/client/application/long-form?country=united_states&visaType=B1_B2&applicationId=${encodeURIComponent(applicationId)}`;
  const statusLabel = job
    ? t(`statusLabels.${job.status}`)
    : t("statusLabels.appointment_not_started");
  const isBusy = Boolean(busyAction);
  const persistedStage = getAppointmentStage(snapshot);
  const stage = snapshot?.confirmation
    ? persistedStage
    : reviewConfirmed
      ? persistedStage
      : "review";
  const stepKeys = ["review", "account", "slots", "confirm", "result"] as const;
  const currentStep = stepKeys.indexOf(stage);
  const reviewRows = [
    { label: t("review.fullName"), value: reviewData?.fullName },
    { label: t("review.dateOfBirth"), value: reviewData?.dateOfBirth },
    { label: t("review.nationality"), value: reviewData?.nationality },
    { label: t("review.passportNumber"), value: reviewData?.passportNumber },
    { label: t("review.passportExpiry"), value: reviewData?.passportExpiryDate },
    { label: t("review.phone"), value: reviewData?.phone },
    { label: t("review.email"), value: reviewData?.email },
    { label: t("review.address"), value: reviewData?.address },
    {
      label: t("review.ds160"),
      value: job?.ds160ConfirmationCode || ds160Code.trim() || null,
    },
    {
      label: t("review.post"),
      value: job?.applyingPostCity || t("posts.beijing"),
    },
  ];

  return (
    <main className="mx-auto w-full max-w-[860px] space-y-6 py-8">
      <div className="flex items-start gap-3">
        <Button asChild variant="outline" size="icon" aria-label={t("review.back")}>
          <Link href={applicationFormHref}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="font-heading text-3xl font-medium text-foreground">
                {t("page.title")}
              </h1>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {t("stateMachine.subtitle")}
              </p>
            </div>
            <StatusBadge status={job?.status ?? null} label={statusLabel} />
          </div>
        </div>
      </div>

      <ol className="grid grid-cols-5 gap-2" aria-label={t("stateMachine.ariaLabel")}>
        {stepKeys.map((key, index) => (
          <li
            key={key}
            className={cn(
              "border-t-2 pt-2 text-center text-[11px] sm:text-sm",
              index <= currentStep
                ? "border-brand-600 text-brand-800"
                : "border-border text-muted-foreground",
            )}
          >
            <span className="mr-1 font-medium">{index + 1}.</span>
            {t(`stateMachine.steps.${key}`)}
          </li>
        ))}
      </ol>

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t("errorTitle")}</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {!workerReady ? (
        <Alert>
          <CircleAlert className="h-4 w-4" />
          <AlertTitle>{t("cloud.unavailable")}</AlertTitle>
          <AlertDescription>{t("stateMachine.workerUnavailable")}</AlertDescription>
        </Alert>
      ) : null}

      {busyAction === "load" && !snapshot ? (
        <Card className="rounded-[8px]">
          <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          </CardContent>
        </Card>
      ) : null}

      {stage === "review" && !(busyAction === "load" && !snapshot) ? (
        <Card className="rounded-[8px]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-brand-600" />
              {t("review.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm leading-6 text-muted-foreground">{t("review.body")}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {reviewRows.map((row) => (
                <Detail key={row.label} label={row.label} value={row.value || t("review.missing")} />
              ))}
            </div>
            <BrandField
              label={t("setup.ds160Code")}
              htmlFor="ds160-code"
              hint={t("setup.ds160CodeHint")}
            >
              <BrandInput
                id="ds160-code"
                value={ds160Code}
                onChange={(event) => setDs160Code(event.target.value)}
                placeholder={t("setup.ds160CodePlaceholder")}
              />
            </BrandField>
            <label className="flex items-start gap-3 rounded-[8px] border bg-muted/30 p-4">
              <Checkbox
                checked={consentAccepted}
                onCheckedChange={(checked) => setConsentAccepted(checked === true)}
                className="mt-1 h-5 w-5"
              />
              <span className="text-sm leading-6 text-foreground">{t("review.confirmation")}</span>
            </label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button asChild variant="outline">
                <Link href={applicationFormHref}>{t("review.edit")}</Link>
              </Button>
              <BrandActionButton
                onClick={handleConfirmReview}
                loading={busyAction === "create" || busyAction === "review"}
                loadingText={t("setup.creating")}
                disabled={isBusy || !consentAccepted || !ds160Code.trim()}
              >
                {t("review.confirmAndContinue")}
              </BrandActionButton>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {stage === "account" ? (
        <Card className="rounded-[8px]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isBusy ? <Loader2 className="h-5 w-5 animate-spin text-brand-600" /> : <Play className="h-5 w-5 text-brand-600" />}
              {t("stateMachine.accountTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm leading-6 text-muted-foreground">
              {pendingManualAction
                ? t(`manual.instructions.${pendingManualAction.actionType}`)
                : t("stateMachine.accountBody")}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Detail label={t("panel.provider")} value={job?.schedulingProvider ?? t("panel.providerUnknown")} />
              <Detail label={t("account.status")} value={statusLabel} />
            </div>

            {pendingManualAction && !["slot_selection", "final_confirmation"].includes(pendingManualAction.actionType) ? (
              <div className="space-y-4 rounded-[8px] border border-amber-200 bg-amber-50 p-4">
                {pendingManualAction.actionType === "account_email_verification" ? (
                  <BrandField label={t("manual.emailCode")} htmlFor="email-code">
                    <BrandInput
                      id="email-code"
                      value={manualInput}
                      onChange={(event) => setManualInput(event.target.value)}
                      placeholder={t("manual.emailCodePlaceholder")}
                    />
                  </BrandField>
                ) : (
                  <p className="text-sm leading-6 text-amber-950">
                    {t(`manual.actions.${pendingManualAction.actionType}`)}
                  </p>
                )}
                <BrandActionButton
                  onClick={handleCompleteManualAction}
                  loading={busyAction === "manual"}
                  loadingText={t("manual.completing")}
                  disabled={isBusy}
                >
                  {t("manual.complete")}
                </BrandActionButton>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setReviewConfirmed(false)} disabled={isBusy}>
                <ShieldCheck className="h-4 w-4" />
                {t("stateMachine.reviewAgain")}
              </Button>
              {job && !TERMINAL_STATUSES.has(job.status) ? (
                <BrandActionButton
                  onClick={() => handleRun(job.status !== "appointment_consent_received")}
                  loading={busyAction === "run"}
                  loadingText={t("panel.running")}
                  disabled={!canRun || isBusy}
                >
                  {job.status === "appointment_consent_received" ? t("panel.run") : t("panel.resume")}
                </BrandActionButton>
              ) : (
                <BrandActionButton
                  onClick={handleCreateJob}
                  loading={busyAction === "create"}
                  loadingText={t("setup.creating")}
                  disabled={isBusy}
                >
                  {t("stateMachine.startAgain")}
                </BrandActionButton>
              )}
              <Button type="button" variant="outline" onClick={handleRevealAccount} disabled={isBusy}>
                {busyAction === "account" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                {t("account.reveal")}
              </Button>
              {job ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="outline" disabled={isBusy}>
                      <XCircle className="h-4 w-4" />
                      {t("panel.cancel")}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("cancel.title")}</AlertDialogTitle>
                      <AlertDialogDescription>{t("cancel.description")}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("cancel.keep")}</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => void runWithBusy("cancel", () => cancelAppointmentJob(job.id))}
                      >
                        {t("cancel.confirm")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
            </div>

            {revealedAccount ? (
              <div className="space-y-3 border-t pt-4">
                <Button type="button" variant="ghost" onClick={() => setAccountVisible((value) => !value)}>
                  {accountVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {accountVisible ? t("account.hide") : t("account.show")}
                </Button>
                {accountVisible ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Detail label={t("account.email")} value={revealedAccount.accountEmail} />
                    <Detail label={t("account.password")} value={revealedAccount.accountPassword} />
                    {revealedAccount.securityQuestions.map((item, index) => (
                      <Detail
                        key={item.label}
                        label={t("account.securityAnswer", { index: index + 1 })}
                        value={item.answer}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {stage === "slots" ? (
        <Card className="rounded-[8px]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-brand-600" />
              {t("slots.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {slots.length === 0 ? (
              <Alert>
                <CalendarCheck className="h-4 w-4" />
                <AlertTitle>{t("slots.noSlots")}</AlertTitle>
                <AlertDescription>{t("stateMachine.noSlotsBody")}</AlertDescription>
              </Alert>
            ) : (
              slots.map((slot) => {
                const date = formatDate(slot.appointmentDate, locale) ?? t("slots.datePending");
                const selected = ["selected", "user_selected"].includes(slot.status);
                return (
                  <div
                    key={slot.id}
                    className={cn(
                      "flex flex-col gap-3 rounded-[8px] border p-4 sm:flex-row sm:items-center sm:justify-between",
                      selected ? "border-brand-300 bg-brand-50" : "bg-background",
                    )}
                  >
                    <div>
                      <p className="font-medium">{t("slots.slotLine", { date, time: slot.appointmentTime ?? t("slots.timePending") })}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{slot.appointmentLocation ?? t("slots.locationPending")}</p>
                    </div>
                    <Button type="button" variant={selected ? "secondary" : "outline"} onClick={() => handleSelectSlot(slot.id)} disabled={selected || isBusy}>
                      {selected ? t("slots.selected") : t("slots.choose")}
                    </Button>
                  </div>
                );
              })
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => job && void runWithBusy("checkSlots", () => checkAppointmentSlots(job.id))}
              disabled={!canCheckSlots || isBusy}
            >
              {busyAction === "checkSlots" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {t("panel.checkSlots")}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {stage === "confirm" ? (
        <Card className="rounded-[8px] border-brand-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-brand-600" />
              {t("final.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {selectedAppointmentSlot ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Detail label={t("results.date")} value={formatDate(selectedAppointmentSlot.appointmentDate, locale) ?? "-"} />
                <Detail label={t("results.time")} value={selectedAppointmentSlot.appointmentTime ?? "-"} />
                <Detail label={t("results.location")} value={selectedAppointmentSlot.appointmentLocation ?? "-"} />
                <Detail label={t("panel.provider")} value={job?.schedulingProvider ?? "USVisaScheduling"} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("final.requirement")}</p>
            )}
            <Alert className="border-amber-200 bg-amber-50">
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>{t("cloud.stopTitle")}</AlertTitle>
              <AlertDescription>{t("cloud.stopBody")}</AlertDescription>
            </Alert>
            <div className="flex flex-wrap gap-2">
              <BrandActionButton
                onClick={() => job && void runWithBusy("approve", () => approveAppointmentFinalConfirmation(job.id))}
                loading={busyAction === "approve"}
                loadingText={t("final.approving")}
                disabled={!job || pendingManualAction?.actionType !== "final_confirmation" || isBusy}
              >
                {t("final.approve")}
              </BrandActionButton>
              {finalApproved ? (
                <BrandActionButton
                  onClick={() => job && void runWithBusy("book", () => bookSelectedAppointmentSlot(job.id))}
                  loading={busyAction === "book"}
                  disabled={!canBook || isBusy}
                >
                  {t("final.book")}
                </BrandActionButton>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {stage === "result" && snapshot?.confirmation ? (
        <Card className="rounded-[8px] border-emerald-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-800">
              <CheckCircle2 className="h-5 w-5" />
              {t("results.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Detail label={t("results.confirmationNumber")} value={snapshot.confirmation.confirmationNumber ?? "-"} />
              <Detail label={t("results.date")} value={formatDate(snapshot.confirmation.appointmentDate, locale) ?? "-"} />
              <Detail label={t("results.time")} value={snapshot.confirmation.appointmentTime ?? "-"} />
              <Detail label={t("results.location")} value={snapshot.confirmation.appointmentLocation ?? "-"} />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => job && void runWithBusy("checkStatus", () => checkAppointmentStatus(job.id))}
              disabled={!canCheckStatus || isBusy}
            >
              {t("panel.checkStatus")}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}

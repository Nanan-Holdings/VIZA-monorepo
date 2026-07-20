"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarCheck,
  CheckCircle2,
  CircleAlert,
  Cloud,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { BrandActionButton } from "@/components/client/brand-action-button";
import { BrandField, BrandInput } from "@/components/client/brand-field";
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
  | "consent"
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

function formatDateTime(value: string | null, locale: string) {
  if (!value) return null;
  return new Intl.DateTimeFormat(locale.startsWith("zh") ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function selectedSlot(slots: AppointmentSlot[]) {
  return slots.find((slot) => ["selected", "user_selected"].includes(slot.status)) ?? null;
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
      idempotencyKey: `us-appointment-consent:${applicationId}:2026-06-v1`,
      consentSnapshot: {
        version: "2026-06-us-appointment-v1",
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

  const handleRecordConsent = () => {
    void runWithBusy("consent", async () => {
      await recordConsent();
      return getAppointmentStatus(applicationId);
    });
  };

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
      return runAppointmentJob(createdJob.id);
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
  const accountReady = Boolean(snapshot?.account);
  const officialPortalReady = Boolean(
    job &&
      (SLOT_CHECK_STATUSES.has(job.status) ||
        slots.length > 0 ||
        selectedAppointmentSlot ||
        finalApproved ||
        snapshot?.confirmation),
  );
  const showCreate = !job || TERMINAL_STATUSES.has(job.status);
  const hasActiveJob = Boolean(job && !TERMINAL_STATUSES.has(job.status));
  const showProgress =
    Boolean(job) &&
    !TERMINAL_STATUSES.has(job?.status ?? "appointment_not_started") &&
    ![
      "appointment_slot_selection_required",
      "appointment_final_confirmation_required",
      "appointment_no_slots_available",
      "appointment_manual_required",
    ].includes(job?.status ?? "");
  const statusLabel = job
    ? t(`statusLabels.${job.status}`)
    : t("statusLabels.appointment_not_started");
  const isBusy = Boolean(busyAction);

  return (
    <div className="mx-auto w-full max-w-[1180px] pb-14">
      <section className="pt-5 sm:pt-8">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {t("page.eyebrow")}
        </p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-heading text-[32px] font-medium leading-tight text-foreground sm:text-[42px]">
              {t("page.title")}
            </h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-6 text-muted-foreground">
              {t("page.subtitle")}
            </p>
          </div>
          <StatusBadge status={job?.status ?? null} label={statusLabel} />
        </div>
      </section>

      <Alert className="mt-6 border-brand-100 bg-brand-50 text-brand-900">
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>{t("dryRunNoticeTitle")}</AlertTitle>
        <AlertDescription>{t("dryRunNotice")}</AlertDescription>
      </Alert>

      {errorMessage && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t("errorTitle")}</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <Card className="mt-6 rounded-[8px] border-input">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-[20px]">
            <span className="flex items-center gap-2">
              <Cloud className="h-5 w-5 text-brand-500" />
              {t("cloud.title")}
            </span>
            <Badge variant={workerReady ? "default" : "outline"}>
              {workerReady ? t("cloud.ready") : t("cloud.unavailable")}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: t("cloud.worker"),
                complete: workerReady,
              },
              {
                label: t("cloud.alias"),
                complete: accountReady,
              },
              {
                label: t("cloud.portal"),
                complete: officialPortalReady,
              },
              {
                label: t("cloud.preSubmit"),
                complete: Boolean(selectedAppointmentSlot && finalApproved),
              },
            ].map((step) => (
              <li
                key={step.label}
                className="flex min-h-20 items-start gap-3 rounded-[8px] border border-slate-200 bg-white p-3"
              >
                {step.complete ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                ) : (
                  <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {step.label}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {step.complete ? t("cloud.complete") : t("cloud.pending")}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <Alert className="border-amber-200 bg-amber-50 text-amber-900">
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>{t("cloud.stopTitle")}</AlertTitle>
            <AlertDescription>{t("cloud.stopBody")}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {busyAction === "load" && !snapshot ? (
        <div className="mt-8 flex min-h-[360px] flex-col items-center justify-center gap-4 rounded-[8px] border bg-white">
          <Loader2 className="h-10 w-10 animate-spin text-brand-500" />
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="space-y-5">
            <Card className="rounded-[8px]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[20px]">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  {t("completed.title")}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <Detail label={t("completed.applicationId")} value={applicationId} />
                <Detail
                  label={t("completed.ds160Code")}
                  value={job?.ds160ConfirmationCode || ds160Code || t("completed.pendingCode")}
                />
              </CardContent>
            </Card>

            <Card className="rounded-[8px]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[20px]">
                  <ShieldCheck className="h-5 w-5 text-brand-500" />
                  {t("account.title")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Detail
                    label={t("account.email")}
                    value={
                      revealedAccount?.accountEmail ??
                      (typeof snapshot?.account?.accountEmail === "string"
                        ? snapshot.account.accountEmail
                        : t("account.notCreated"))
                    }
                  />
                  <Detail
                    label={t("account.status")}
                    value={
                      revealedAccount?.accountStatus ??
                      (typeof snapshot?.account?.accountStatus === "string"
                        ? snapshot.account.accountStatus
                        : t("account.notCreated"))
                    }
                  />
                </div>

                <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                  <ShieldCheck className="h-4 w-4" />
                  <AlertTitle>{t("account.revealTitle")}</AlertTitle>
                  <AlertDescription>{t("account.revealBody")}</AlertDescription>
                </Alert>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRevealAccount}
                    disabled={isBusy}
                  >
                    {busyAction === "account" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                    {t("account.reveal")}
                  </Button>
                  {revealedAccount && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setAccountVisible((current) => !current)}
                    >
                      {accountVisible ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                      {accountVisible ? t("account.hide") : t("account.show")}
                    </Button>
                  )}
                </div>

                {revealedAccount && accountVisible && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Detail label={t("account.email")} value={revealedAccount.accountEmail} />
                    <Detail label={t("account.password")} value={revealedAccount.accountPassword} />
                    {revealedAccount.securityQuestions.map((item, index) => (
                      <Detail
                        key={`${item.label}-${index}`}
                        label={t("account.securityAnswer", { index: index + 1 })}
                        value={item.answer}
                      />
                    ))}
                    <Detail
                      label={t("account.prefillDs160")}
                      value={revealedAccount.prefill.ds160ConfirmationCode ?? t("account.missing")}
                    />
                    <Detail
                      label={t("account.prefillPost")}
                      value={revealedAccount.prefill.applyingPostCity ?? t("account.missing")}
                    />
                  </div>
                )}

                <div className="rounded-[8px] border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-foreground">
                    {t("account.autofillTitle")}
                  </p>
                  <ul className="mt-2 space-y-1 text-sm leading-6 text-muted-foreground">
                    <li>{t("account.autofillDs160")}</li>
                    <li>{t("account.autofillProfile")}</li>
                    <li>{t("account.autofillSlots")}</li>
                    <li>{t("account.autofillEvidence")}</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[8px]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[20px]">
                  <CalendarCheck className="h-5 w-5 text-brand-500" />
                  {t("setup.title")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <BrandField
                  label={t("setup.ds160Code")}
                  htmlFor="ds160-code"
                  hint={t("setup.ds160CodeHint")}
                >
                  <BrandInput
                    id="ds160-code"
                    value={ds160Code}
                    onChange={(event) => setDs160Code(event.target.value)}
                    disabled={hasActiveJob}
                    placeholder={t("setup.ds160CodePlaceholder")}
                  />
                </BrandField>

                <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                  <ShieldCheck className="h-4 w-4" />
                  <AlertTitle>{t("setup.aliasNoticeTitle")}</AlertTitle>
                  <AlertDescription>{t("setup.aliasNotice")}</AlertDescription>
                </Alert>

                {showCreate && (
                  <BrandActionButton
                    onClick={handleCreateJob}
                    loading={busyAction === "create"}
                    loadingText={t("setup.creating")}
                    disabled={isBusy || !consentAccepted}
                    className="w-full sm:w-auto"
                  >
                    {t("setup.createJob")}
                  </BrandActionButton>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[8px]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[20px]">
                  <ShieldCheck className="h-5 w-5 text-brand-500" />
                  {t("consent.title")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm leading-6 text-muted-foreground">
                  <p>{t("consent.body1")}</p>
                  <p>{t("consent.body2")}</p>
                </div>
                <label className="flex items-start gap-3 rounded-[8px] border border-slate-200 bg-white p-4">
                  <Checkbox
                    checked={consentAccepted}
                    disabled={hasActiveJob}
                    onCheckedChange={(checked) => setConsentAccepted(checked === true)}
                    className="mt-1 h-5 w-5"
                  />
                  <span className="text-sm leading-6 text-foreground">
                    {t("consent.checkbox")}
                  </span>
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRecordConsent}
                    disabled={isBusy || !consentAccepted || Boolean(job)}
                  >
                    {busyAction === "consent" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-4 w-4" />
                    )}
                    {consentRecorded ? t("consent.recorded") : t("setup.recordConsent")}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {t("consent.security")}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-5">
            <Card className="rounded-[8px]">
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <CardTitle className="flex items-center gap-2 text-[20px]">
                    <Play className="h-5 w-5 text-brand-500" />
                    {t("panel.title")}
                  </CardTitle>
                  <StatusBadge status={job?.status ?? null} label={statusLabel} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {!job ? (
                  <div className="space-y-4 rounded-[8px] border border-dashed border-slate-300 bg-white p-5">
                    <div className="space-y-2 text-sm leading-6 text-muted-foreground">
                      <p>{t("panel.noJob")}</p>
                      <ol className="ml-4 list-decimal space-y-1">
                        <li>{t("panel.startStepPreferences")}</li>
                        <li>{t("panel.startStepConsent")}</li>
                        <li>{t("panel.startStepRun")}</li>
                      </ol>
                    </div>
                    <BrandActionButton
                      onClick={handleCreateJob}
                      loading={busyAction === "create"}
                      loadingText={t("setup.creating")}
                      disabled={isBusy || !consentAccepted}
                      className="w-full"
                    >
                      <Play className="h-4 w-4" />
                      {t("setup.createJob")}
                    </BrandActionButton>
                    {!consentAccepted && (
                      <p className="text-xs text-muted-foreground">
                        {t("panel.consentHint")}
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Detail label={t("panel.provider")} value={job.schedulingProvider ?? t("panel.providerUnknown")} />
                      <Detail label={t("panel.mode")} value={t(`modes.${job.mode}`)} />
                    </div>

                    {pendingManualAction && (
                      <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                        <CircleAlert className="h-4 w-4" />
                        <AlertTitle>{t("manual.title")}</AlertTitle>
                        <AlertDescription>
                          {t(`manual.instructions.${pendingManualAction.actionType}`)}
                        </AlertDescription>
                      </Alert>
                    )}

                    {showProgress && (
                      <Alert className="border-brand-200 bg-brand-50 text-brand-900">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <AlertTitle>{t("panel.progressTitle")}</AlertTitle>
                        <AlertDescription>{t("panel.progressBody")}</AlertDescription>
                      </Alert>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <BrandActionButton
                        onClick={() => handleRun(job.status === "appointment_consent_received" ? false : true)}
                        loading={busyAction === "run"}
                        loadingText={t("panel.running")}
                        disabled={!canRun || isBusy}
                      >
                        <Play className="h-4 w-4" />
                        {job.status === "appointment_consent_received" ? t("panel.run") : t("panel.resume")}
                      </BrandActionButton>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (!job) return;
                          void runWithBusy("checkSlots", () => checkAppointmentSlots(job.id));
                        }}
                        disabled={!canCheckSlots || isBusy}
                      >
                        {busyAction === "checkSlots" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                        {t("panel.checkSlots")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (!job) return;
                          void runWithBusy("checkStatus", () => checkAppointmentStatus(job.id));
                        }}
                        disabled={!canCheckStatus || isBusy}
                      >
                        {busyAction === "checkStatus" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CalendarCheck className="h-4 w-4" />
                        )}
                        {t("panel.checkStatus")}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="destructive"
                            disabled={!job || Boolean(snapshot?.confirmation) || isBusy}
                          >
                            <XCircle className="h-4 w-4" />
                            {t("panel.cancel")}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t("cancel.title")}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("cancel.description")}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("cancel.keep")}</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => {
                                if (!job) return;
                                void runWithBusy("cancel", () => cancelAppointmentJob(job.id));
                              }}
                            >
                              {t("cancel.confirm")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {pendingManualAction &&
              !["slot_selection", "final_confirmation"].includes(
                pendingManualAction.actionType,
              ) && (
                <Card className="rounded-[8px]">
                  <CardHeader>
                    <CardTitle className="text-[20px]">{t("manual.checkpointTitle")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {pendingManualAction.actionType === "account_email_verification" && (
                      <BrandField label={t("manual.emailCode")} htmlFor="email-code">
                        <BrandInput
                          id="email-code"
                          value={manualInput}
                          onChange={(event) => setManualInput(event.target.value)}
                          placeholder={t("manual.emailCodePlaceholder")}
                        />
                      </BrandField>
                    )}
                    {pendingManualAction.actionType !== "account_email_verification" && (
                      <p className="text-sm leading-6 text-muted-foreground">
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
                  </CardContent>
                </Card>
              )}

            <Card className="rounded-[8px]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[20px]">
                  <CalendarCheck className="h-5 w-5 text-brand-500" />
                  {t("slots.title")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {slots.length === 0 ? (
                  <div className="rounded-[8px] border border-dashed border-slate-300 bg-white p-5 text-sm text-muted-foreground">
                    {job?.status === "appointment_no_slots_available"
                      ? t("slots.noSlots")
                      : t("slots.empty")}
                  </div>
                ) : (
                  slots.map((slot) => {
                    const date = formatDate(slot.appointmentDate, locale) ?? t("slots.datePending");
                    const selected = ["selected", "user_selected"].includes(slot.status);
                    return (
                      <div
                        key={slot.id}
                        className={cn(
                          "flex flex-col gap-3 rounded-[8px] border bg-white p-4 sm:flex-row sm:items-center sm:justify-between",
                          selected ? "border-brand-300 ring-1 ring-brand-200" : "border-slate-200",
                        )}
                      >
                        <div>
                          <p className="font-semibold text-foreground">
                            {t("slots.slotLine", {
                              date,
                              time: slot.appointmentTime ?? t("slots.timePending"),
                            })}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {slot.appointmentLocation ?? t("slots.locationPending")}
                          </p>
                          {slot.observedAt && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {t("slots.observedAt", {
                                value: formatDateTime(slot.observedAt, locale) ?? "-",
                              })}
                            </p>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant={selected ? "secondary" : "outline"}
                          onClick={() => handleSelectSlot(slot.id)}
                          disabled={selected || isBusy || !job}
                        >
                          {busyAction === "slot" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CalendarCheck className="h-4 w-4" />
                          )}
                          {selected ? t("slots.selected") : t("slots.choose")}
                        </Button>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[8px]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[20px]">
                  <ShieldCheck className="h-5 w-5 text-brand-500" />
                  {t("final.title")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-6 text-muted-foreground">
                  {selectedAppointmentSlot
                    ? t("final.selected", {
                        date: formatDate(selectedAppointmentSlot.appointmentDate, locale) ?? "-",
                        time: selectedAppointmentSlot.appointmentTime ?? "-",
                      })
                    : t("final.requirement")}
                </p>
                <div className="flex flex-wrap gap-2">
                  <BrandActionButton
                    onClick={() => {
                      if (!job) return;
                      void runWithBusy("approve", () => approveAppointmentFinalConfirmation(job.id));
                    }}
                    loading={busyAction === "approve"}
                    loadingText={t("final.approving")}
                    disabled={
                      !job ||
                      pendingManualAction?.actionType !== "final_confirmation" ||
                      isBusy
                    }
                  >
                    {t("final.approve")}
                  </BrandActionButton>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (!job) return;
                      void runWithBusy("book", () => bookSelectedAppointmentSlot(job.id));
                    }}
                    disabled={!canBook || isBusy}
                  >
                    {busyAction === "book" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    {t("final.book")}
                  </Button>
                  {finalApproved && !snapshot?.confirmation && (
                    <Badge variant="secondary">{t("final.approvedBadge")}</Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[8px]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[20px]">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  {t("results.title")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {snapshot?.confirmation ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Detail
                      label={t("results.confirmationNumber")}
                      value={snapshot.confirmation.confirmationNumber ?? "-"}
                    />
                    <Detail
                      label={t("results.date")}
                      value={formatDate(snapshot.confirmation.appointmentDate, locale) ?? "-"}
                    />
                    <Detail
                      label={t("results.time")}
                      value={snapshot.confirmation.appointmentTime ?? "-"}
                    />
                    <Detail
                      label={t("results.location")}
                      value={snapshot.confirmation.appointmentLocation ?? "-"}
                    />
                  </div>
                ) : (
                  <div className="rounded-[8px] border border-dashed border-slate-300 bg-white p-5 text-sm text-muted-foreground">
                    {t("results.none")}
                  </div>
                )}
                {snapshot?.latestStatusCheck && (
                  <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>{t("results.statusCheck")}</AlertTitle>
                    <AlertDescription>
                      {t("results.statusCheckBody", {
                        value:
                          formatDateTime(snapshot.latestStatusCheck.checkedAt, locale) ??
                          "-",
                      })}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

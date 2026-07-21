"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  CreditCard,
  Loader2,
  Mail,
  MapPin,
  PauseCircle,
  Play,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { getTeamApplicationContext } from "@/app/actions/application-group";
import { BrandActionButton } from "@/components/client/brand-action-button";
import { BrandField, BrandInput } from "@/components/client/brand-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FRANCE_TLS_CHINA_CENTER_OPTIONS } from "@/lib/france-appointment/centers";
import {
  approveFranceAppointmentFinalConfirmation,
  bookSelectedFranceAppointmentSlot,
  cancelFranceAppointmentJob,
  checkFranceAppointmentSlots,
  createFranceAppointmentJob,
  FranceAppointmentApiError,
  getFranceAppointmentStatus,
  recordFranceAppointmentConsent,
  recordFrancePaymentSession,
  runFranceAppointmentJob,
  selectFranceAppointmentSlot,
} from "@/lib/france-appointment/client";
import { cn } from "@/lib/utils";
import type {
  FranceAppointmentSlot,
  FranceAppointmentStatus,
  FranceAppointmentStatusSnapshot,
} from "@/types/france-appointment";

type BusyAction =
  | "load"
  | "review"
  | "create"
  | "run"
  | "checkSlots"
  | "slot"
  | "payment"
  | "approve"
  | "book"
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

const TERMINAL_STATUSES = new Set<FranceAppointmentStatus>([
  "appointment_confirmation_captured",
  "appointment_status_checked",
  "appointment_failed",
  "appointment_cancelled",
  "appointment_blocked_by_site_policy",
]);

const STATUS_TONE = {
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

function getStatusTone(status: FranceAppointmentStatus | null) {
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
  if (TERMINAL_STATUSES.has(status)) return STATUS_TONE.danger;
  return STATUS_TONE.progress;
}

function StatusBadge({
  status,
  label,
}: {
  status: FranceAppointmentStatus | null;
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
      <Icon className={cn("h-3.5 w-3.5", Icon === Loader2 && "animate-spin")} />
      {label}
    </span>
  );
}

function formatDate(value: string | null, locale: string) {
  if (!value) return null;
  return new Intl.DateTimeFormat(locale.startsWith("zh") ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function selectedSlot(slots: FranceAppointmentSlot[]) {
  return slots.find((slot) => ["selected", "user_selected"].includes(slot.status)) ?? null;
}

function getAppointmentStage(
  snapshot: FranceAppointmentStatusSnapshot | null,
): AppointmentStage {
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function FranceAppointmentAssistant({
  applicationId,
  workerReady,
}: {
  applicationId: string;
  workerReady: boolean;
}) {
  const t = useTranslations("franceAppointment");
  const locale = useLocale();
  const [snapshot, setSnapshot] =
    useState<FranceAppointmentStatusSnapshot | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction | null>("load");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [consentRecorded, setConsentRecorded] = useState(false);
  const [centerCode, setCenterCode] = useState("shanghai");
  const [paymentBrand, setPaymentBrand] = useState("");
  const [paymentLast4, setPaymentLast4] = useState("");
  const [paymentExpMonth, setPaymentExpMonth] = useState("");
  const [paymentExpYear, setPaymentExpYear] = useState("");
  const [reviewData, setReviewData] = useState<AppointmentReviewData | null>(null);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);

  const job = snapshot?.job ?? null;
  const slots = useMemo(() => snapshot?.slots ?? [], [snapshot?.slots]);
  const selectedAppointmentSlot = useMemo(() => selectedSlot(slots), [slots]);
  const finalApproved = useMemo(
    () =>
      (snapshot?.manualActions ?? []).some(
        (action) =>
          action.actionType === "final_confirmation" && action.status === "completed",
      ),
    [snapshot?.manualActions],
  );
  const paymentAuthorized =
    job?.userPreferencesJson.paymentSessionStatus === "authorized";
  const applicationFormHref =
    `/client/application/long-form?country=france&visaType=EU_SCHENGEN_C_SHORT_STAY&applicationId=${encodeURIComponent(applicationId)}`;

  const handleError = useCallback(
    (error: unknown) => {
      if (error instanceof FranceAppointmentApiError) {
        setErrorMessage(
          error.code === "supabase_auth_not_configured"
            ? t("errors.supabaseAuthNotConfigured")
            : error.code === "appointment_schema_not_configured"
              ? t("errors.appointmentSchemaNotConfigured")
              : t("errors.withCode", { code: error.code }),
        );
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : t("errors.generic"));
    },
    [t],
  );

  const loadStatus = useCallback(async () => {
    setBusyAction("load");
    setErrorMessage(null);
    try {
      const next = await getFranceAppointmentStatus(applicationId);
      setSnapshot(next);
      if (next.job) {
        setConsentAccepted(true);
        setConsentRecorded(true);
      }
      const preferredCenter =
        typeof next.job?.userPreferencesJson.centerCode === "string"
          ? next.job.userPreferencesJson.centerCode
          : null;
      if (preferredCenter) setCenterCode(preferredCenter);
    } catch (error) {
      handleError(error);
    } finally {
      setBusyAction(null);
    }
  }, [applicationId, handleError]);

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
      void getFranceAppointmentStatus(applicationId).then(setSnapshot).catch(() => undefined);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [applicationId, job]);

  const runAction = async (
    action: BusyAction,
    callback: () => Promise<FranceAppointmentStatusSnapshot | void>,
  ) => {
    setBusyAction(action);
    setErrorMessage(null);
    try {
      const next = await callback();
      if (next) setSnapshot(next);
    } catch (error) {
      handleError(error);
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreateJob = () =>
    runAction("create", async () => {
      if (!consentAccepted) {
        setErrorMessage(t("setup.consentRequiredError"));
        return;
      }
      if (!consentRecorded) {
        await recordFranceAppointmentConsent(applicationId, {
          idempotencyKey: `france-appointment-consent:${applicationId}:2026-07-v1`,
          consentSnapshot: {
            version: "2026-07-france-tls-appointment-v1",
            schedulingProvider: "tlscontact_cn_fr",
            countryCode: "FR",
            applyingCountryCode: "CN",
            acceptedAt: new Date().toISOString(),
          },
        });
        setConsentRecorded(true);
      }
      const created = await createFranceAppointmentJob(applicationId, {
        mode: "assisted_live",
        centerCode,
        idempotencyKey: `france-tls:${applicationId}:${centerCode}:assisted-live`,
        userPreferencesJson: {
          centerCode,
          schedulingProvider: "tlscontact_cn_fr",
        },
      });
      const next = await runFranceAppointmentJob(created.id);
      setReviewConfirmed(true);
      return next;
    });

  const handleConfirmReview = () => {
    if (!job || TERMINAL_STATUSES.has(job.status)) {
      handleCreateJob();
      return;
    }
    void runAction("review", async () => {
      await recordFranceAppointmentConsent(applicationId, {
        idempotencyKey: `france-appointment-consent:${applicationId}:2026-07-review-v1`,
        consentSnapshot: {
          version: "2026-07-france-tls-review-v1",
          schedulingProvider: "tlscontact_cn_fr",
          countryCode: "FR",
          applyingCountryCode: "CN",
          acceptedAt: new Date().toISOString(),
        },
      });
      setConsentRecorded(true);
      setReviewConfirmed(true);
      return getFranceAppointmentStatus(applicationId);
    });
  };

  const handlePayment = () =>
    runAction("payment", async () => {
      if (!job) return;
      const last4 = paymentLast4.trim();
      const expMonth = paymentExpMonth.trim().padStart(2, "0");
      const expYear = paymentExpYear.trim();
      if (!/^\d{4}$/.test(last4) || !/^\d{1,2}$/.test(expMonth) || !/^\d{4}$/.test(expYear)) {
        setErrorMessage(t("payment.validation"));
        return;
      }
      return recordFrancePaymentSession(job.id, {
        sessionId: `france-tls-payment:${job.id}:${Date.now()}`,
        redacted: {
          last4,
          expMonth,
          expYear,
          brand: paymentBrand.trim() || undefined,
          holderNamePresent: true,
        },
      });
    });

  const persistedStage = getAppointmentStage(snapshot);
  const stage = snapshot?.confirmation
    ? persistedStage
    : reviewConfirmed
      ? persistedStage
      : "review";
  const stepKeys = ["review", "account", "slots", "confirm", "result"] as const;
  const currentStep = stepKeys.indexOf(stage);
  const statusLabel = job
    ? t(`statusLabels.${job.status}`)
    : t("statusLabels.appointment_not_started");
  const isBusy = Boolean(busyAction);
  const canCheckSlots = Boolean(job) && !TERMINAL_STATUSES.has(job?.status ?? "appointment_not_started");
  const canBook = Boolean(
    job &&
      selectedAppointmentSlot &&
      finalApproved &&
      (job.mode === "assisted_live" || paymentAuthorized) &&
      !snapshot?.confirmation,
  );
  const reviewRows = [
    { label: t("review.fullName"), value: reviewData?.fullName },
    { label: t("review.dateOfBirth"), value: reviewData?.dateOfBirth },
    { label: t("review.nationality"), value: reviewData?.nationality },
    { label: t("review.passportNumber"), value: reviewData?.passportNumber },
    { label: t("review.passportExpiry"), value: reviewData?.passportExpiryDate },
    { label: t("review.phone"), value: reviewData?.phone },
    { label: t("review.email"), value: reviewData?.email },
    { label: t("review.address"), value: reviewData?.address },
    { label: t("review.center"), value: t(`centers.${centerCode}`) },
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
          <AlertCircle className="h-4 w-4" />
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
            <BrandField label={t("setup.center")} htmlFor="france-tls-center">
              <select
                id="france-tls-center"
                value={centerCode}
                onChange={(event) => setCenterCode(event.target.value)}
                className="h-12 w-full rounded-lg border border-[#e8e8e8] bg-white px-3 text-[15px] shadow-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              >
                {FRANCE_TLS_CHINA_CENTER_OPTIONS.map((center) => (
                  <option key={center.code} value={center.code}>
                    {t(`centers.${center.i18nKey}`)}
                  </option>
                ))}
              </select>
            </BrandField>
            <Alert className="border-slate-200 bg-slate-50">
              <MapPin className="h-4 w-4" />
              <AlertDescription>{t("setup.referenceHint")}</AlertDescription>
            </Alert>
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
                type="button"
                onClick={handleConfirmReview}
                loading={busyAction === "create" || busyAction === "review"}
                loadingText={t("setup.creating")}
                disabled={isBusy || !consentAccepted}
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
              {isBusy ? (
                <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
              ) : (
                <Mail className="h-5 w-5 text-brand-600" />
              )}
              {t("stateMachine.accountTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {snapshot?.pendingManualAction ? (
              <Alert className="border-amber-200 bg-amber-50">
                <PauseCircle className="h-4 w-4 text-amber-700" />
                <AlertTitle>{t("checkpoint.title")}</AlertTitle>
                <AlertDescription>
                  {snapshot.pendingManualAction.instruction ?? t("checkpoint.body")}
                </AlertDescription>
              </Alert>
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                {t("stateMachine.accountBody")}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Detail label={t("account.alias")} value={snapshot?.account?.accountEmail ?? t("account.pending")} />
              <Detail label={t("account.verification")} value={snapshot?.account?.emailVerified ? t("account.verified") : t("account.notVerified")} />
              <Detail label={t("panel.provider")} value={job?.schedulingProvider ?? t("panel.providerUnknown")} />
              <Detail label={t("account.status")} value={statusLabel} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setReviewConfirmed(false)} disabled={isBusy}>
                <ShieldCheck className="h-4 w-4" />
                {t("stateMachine.reviewAgain")}
              </Button>
              <BrandActionButton
                type="button"
                onClick={() => job && void runAction("run", () => runFranceAppointmentJob(job.id))}
                loading={busyAction === "run"}
                disabled={!job || isBusy || TERMINAL_STATUSES.has(job?.status ?? "appointment_not_started")}
              >
                <Play className="h-4 w-4" />
                {t("panel.run")}
              </BrandActionButton>
              <Button
                type="button"
                variant="outline"
                onClick={() => job && void runAction("cancel", () => cancelFranceAppointmentJob(job.id))}
                disabled={!job || isBusy || TERMINAL_STATUSES.has(job?.status ?? "appointment_not_started")}
              >
                <XCircle className="h-4 w-4" />
                {t("panel.cancel")}
              </Button>
            </div>
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
                const chosen = selectedAppointmentSlot?.id === slot.id;
                return (
                  <div
                    key={slot.id}
                    className={cn(
                      "flex flex-col gap-3 rounded-[8px] border p-4 sm:flex-row sm:items-center sm:justify-between",
                      chosen ? "border-brand-300 bg-brand-50" : "bg-background",
                    )}
                  >
                    <div>
                      <p className="font-medium">
                        {t("slots.slotLine", { date, time: slot.appointmentTime ?? t("slots.timePending") })}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {slot.appointmentLocation ?? t("slots.locationPending")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant={chosen ? "secondary" : "outline"}
                      onClick={() => job && void runAction("slot", () => selectFranceAppointmentSlot(job.id, slot.id))}
                      disabled={!job || chosen || isBusy}
                    >
                      {chosen ? t("slots.selected") : t("slots.choose")}
                    </Button>
                  </div>
                );
              })
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => job && void runAction("checkSlots", () => checkFranceAppointmentSlots(job.id))}
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
                <Detail label={t("review.center")} value={t(`centers.${centerCode}`)} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("final.requirement")}</p>
            )}

            {!paymentAuthorized ? (
              <div className="space-y-4 rounded-[8px] border bg-muted/20 p-4">
                <div className="flex items-center gap-2 font-medium">
                  <CreditCard className="h-4 w-4 text-brand-600" />
                  {t("payment.title")}
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{t("payment.body")}</p>
                <div className="grid gap-3 sm:grid-cols-4">
                  <BrandField label={t("payment.brand")} htmlFor="france-payment-brand">
                    <BrandInput id="france-payment-brand" value={paymentBrand} onChange={(event) => setPaymentBrand(event.target.value)} placeholder={t("payment.brandPlaceholder")} />
                  </BrandField>
                  <BrandField label={t("payment.last4")} htmlFor="france-payment-last4">
                    <BrandInput id="france-payment-last4" value={paymentLast4} onChange={(event) => setPaymentLast4(event.target.value)} inputMode="numeric" maxLength={4} placeholder="1234" />
                  </BrandField>
                  <BrandField label={t("payment.expMonth")} htmlFor="france-payment-month">
                    <BrandInput id="france-payment-month" value={paymentExpMonth} onChange={(event) => setPaymentExpMonth(event.target.value)} inputMode="numeric" maxLength={2} placeholder="06" />
                  </BrandField>
                  <BrandField label={t("payment.expYear")} htmlFor="france-payment-year">
                    <BrandInput id="france-payment-year" value={paymentExpYear} onChange={(event) => setPaymentExpYear(event.target.value)} inputMode="numeric" maxLength={4} placeholder="2028" />
                  </BrandField>
                </div>
                <Button type="button" variant="outline" onClick={handlePayment} disabled={!job || isBusy}>
                  {busyAction === "payment" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                  {t("payment.record")}
                </Button>
              </div>
            ) : null}

            <Alert className="border-amber-200 bg-amber-50">
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>{t("cloud.stopTitle")}</AlertTitle>
              <AlertDescription>{t("cloud.stopBody")}</AlertDescription>
            </Alert>
            <div className="flex flex-wrap gap-2">
              <BrandActionButton
                type="button"
                variant="secondary"
                onClick={() => job && void runAction("approve", () => approveFranceAppointmentFinalConfirmation(job.id))}
                loading={busyAction === "approve"}
                disabled={!job || !selectedAppointmentSlot || isBusy || finalApproved}
              >
                {finalApproved ? t("final.approvedBadge") : t("final.approve")}
              </BrandActionButton>
              {finalApproved ? (
                <BrandActionButton
                  type="button"
                  onClick={() => job && void runAction("book", () => bookSelectedFranceAppointmentSlot(job.id))}
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
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Detail label={t("results.confirmationNumber")} value={snapshot.confirmation.confirmationNumber ?? "-"} />
            <Detail label={t("results.location")} value={snapshot.confirmation.appointmentLocation ?? "-"} />
            <Detail label={t("results.date")} value={formatDate(snapshot.confirmation.appointmentDate, locale) ?? "-"} />
            <Detail label={t("results.time")} value={snapshot.confirmation.appointmentTime ?? "-"} />
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}

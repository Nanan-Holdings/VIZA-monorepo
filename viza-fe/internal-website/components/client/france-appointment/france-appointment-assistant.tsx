"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { BrandField, BrandInput } from "@/components/client/brand-field";
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
  | "consent"
  | "create"
  | "run"
  | "checkSlots"
  | "slot"
  | "payment"
  | "approve"
  | "book"
  | "cancel";

const TERMINAL_STATUSES = new Set<FranceAppointmentStatus>([
  "appointment_confirmation_captured",
  "appointment_status_checked",
  "appointment_failed",
  "appointment_cancelled",
  "appointment_blocked_by_site_policy",
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
  if (TERMINAL_STATUSES.has(status)) {
    return STATUS_TONE.danger;
  }
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

function selectedSlot(slots: FranceAppointmentSlot[]) {
  return slots.find((slot) => ["selected", "user_selected"].includes(slot.status)) ?? null;
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

export function FranceAppointmentAssistant({
  applicationId,
}: {
  applicationId: string;
}) {
  const t = useTranslations("franceAppointment");
  const locale = useLocale();
  const [snapshot, setSnapshot] =
    useState<FranceAppointmentStatusSnapshot | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction | null>("load");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [centerCode, setCenterCode] = useState("shanghai");
  const [paymentBrand, setPaymentBrand] = useState("");
  const [paymentLast4, setPaymentLast4] = useState("");
  const [paymentExpMonth, setPaymentExpMonth] = useState("");
  const [paymentExpYear, setPaymentExpYear] = useState("");

  const job = snapshot?.job ?? null;
  const slots = useMemo(() => snapshot?.slots ?? [], [snapshot?.slots]);
  const selectedAppointmentSlot = useMemo(() => selectedSlot(slots), [slots]);
  const finalApproved = useMemo(
    () =>
      (snapshot?.manualActions ?? []).some(
        (action) =>
          action.actionType === "final_confirmation" &&
          action.status === "completed",
      ),
    [snapshot?.manualActions],
  );
  const paymentAuthorized =
    job?.userPreferencesJson.paymentSessionStatus === "authorized";

  const statusLabel = job
    ? t(`statusLabels.${job.status}`)
    : t("statusLabels.appointment_not_started");

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
      setErrorMessage(
        error instanceof Error ? error.message : t("errors.generic"),
      );
    },
    [t],
  );

  const loadStatus = useCallback(async () => {
    setBusyAction("load");
    setErrorMessage(null);
    try {
      const next = await getFranceAppointmentStatus(applicationId);
      setSnapshot(next);
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

  const handleConsent = () =>
    runAction("consent", async () => {
      if (!consentAccepted) {
        setErrorMessage(t("setup.consentRequiredError"));
        return;
      }
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
      await loadStatus();
    });

  const handleCreateJob = () =>
    runAction("create", async () => {
      await createFranceAppointmentJob(applicationId, {
        mode: "assisted_live",
        centerCode,
        idempotencyKey: `france-tls:${applicationId}:${centerCode}:assisted-live`,
        userPreferencesJson: {
          centerCode,
          schedulingProvider: "tlscontact_cn_fr",
        },
      });
      await loadStatus();
    });

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

  const canCheckSlots =
    Boolean(job) && !TERMINAL_STATUSES.has(job?.status ?? "appointment_not_started");
  const canBook = Boolean(
    job
    && selectedAppointmentSlot
    && finalApproved
    && (job.mode === "assisted_live" || paymentAuthorized),
  );

  if (busyAction === "load" && !snapshot) {
    return (
      <div className="mx-auto flex min-h-[320px] max-w-5xl items-center justify-center px-6">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("loading")}
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-brand-600">
              {t("page.eyebrow")}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">
              {t("page.title")}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              {t("page.subtitle")}
            </p>
          </div>
          <StatusBadge status={job?.status ?? null} label={statusLabel} />
        </div>
        <Alert className="border-brand-100 bg-brand-50">
          <ShieldCheck className="h-4 w-4 text-brand-600" />
          <AlertTitle>{t("dryRunNoticeTitle")}</AlertTitle>
          <AlertDescription>{t("dryRunNotice")}</AlertDescription>
        </Alert>
      </section>

      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t("errorTitle")}</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <div className="mx-auto w-full space-y-5">
          <Card className="rounded-[8px] border-input">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-brand-500" />
                {t("consent.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-6 text-muted-foreground">
                {t("consent.body1")}
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                {t("consent.body2")}
              </p>
              <label className="flex items-start gap-3 rounded-[8px] border border-slate-200 bg-white p-3 text-sm">
                <Checkbox
                  checked={consentAccepted}
                  onCheckedChange={(value) => setConsentAccepted(value === true)}
                  className="mt-1"
                />
                <span>{t("consent.checkbox")}</span>
              </label>
              <Button
                type="button"
                variant="outline"
                onClick={handleConsent}
                disabled={busyAction === "consent" || !consentAccepted}
                className="w-full"
              >
                {busyAction === "consent" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="mr-2 h-4 w-4" />
                )}
                {t("setup.recordConsent")}
              </Button>
            </CardContent>
          </Card>

          {snapshot?.pendingManualAction && (
            <Alert className="border-amber-200 bg-amber-50">
              <PauseCircle className="h-4 w-4 text-amber-700" />
              <AlertTitle>{t("checkpoint.title")}</AlertTitle>
              <AlertDescription>
                {snapshot.pendingManualAction.instruction ?? t("checkpoint.body")}
              </AlertDescription>
            </Alert>
          )}

          <Card className="rounded-[8px] border-input">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4 text-brand-500" />
                {t("setup.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <BrandField label={t("setup.center")} htmlFor="france-tls-center">
                <select
                  id="france-tls-center"
                  value={centerCode}
                  onChange={(event) => setCenterCode(event.target.value)}
                  className="h-12 rounded-lg border border-[#e8e8e8] bg-white px-3 text-[15px] shadow-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  disabled={Boolean(job)}
                >
                  {FRANCE_TLS_CHINA_CENTER_OPTIONS.map((center) => (
                    <option key={center.code} value={center.code}>
                      {t(`centers.${center.i18nKey}`)}
                    </option>
                  ))}
                </select>
              </BrandField>
              <Alert className="border-slate-200 bg-slate-50">
                <AlertDescription>{t("setup.referenceHint")}</AlertDescription>
              </Alert>
              <Button
                type="button"
                onClick={handleCreateJob}
                disabled={Boolean(job) || busyAction === "create"}
                className="w-full"
              >
                {busyAction === "create" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                {job ? t("setup.jobCreated") : t("setup.createJob")}
              </Button>
            </CardContent>
          </Card>
          <Card className="rounded-[8px] border-input">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-4 w-4 text-brand-500" />
                {t("account.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Detail
                  label={t("account.alias")}
                  value={snapshot?.account?.accountEmail ?? t("account.pending")}
                />
                <Detail
                  label={t("account.status")}
                  value={snapshot?.account?.accountStatus ?? t("account.pending")}
                />
                <Detail
                  label={t("account.verification")}
                  value={snapshot?.account?.emailVerified ? t("account.verified") : t("account.notVerified")}
                />
              </div>
              <Alert className="border-slate-200 bg-slate-50">
                <AlertDescription>{t("account.body")}</AlertDescription>
              </Alert>
            </CardContent>
          </Card>
          <Card className="rounded-[8px] border-input">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <RefreshCw className="h-4 w-4 text-brand-500" />
                {t("panel.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Detail
                  label={t("panel.provider")}
                  value={job?.schedulingProvider ?? t("panel.providerUnknown")}
                />
                <Detail
                  label={t("panel.mode")}
                  value={job ? t(`modes.${job.mode}`) : t("modes.assisted_live")}
                />
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                {job ? t("panel.progressBody") : t("panel.noJob")}
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    job &&
                    runAction("run", () => runFranceAppointmentJob(job.id))
                  }
                  disabled={!job || busyAction === "run" || TERMINAL_STATUSES.has(job?.status ?? "appointment_not_started")}
                >
                  {busyAction === "run" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  {t("panel.run")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    job &&
                    runAction("checkSlots", () => checkFranceAppointmentSlots(job.id))
                  }
                  disabled={!canCheckSlots || busyAction === "checkSlots"}
                >
                  {busyAction === "checkSlots" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  {t("panel.checkSlots")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    job && runAction("cancel", () => cancelFranceAppointmentJob(job.id))
                  }
                  disabled={!job || busyAction === "cancel" || TERMINAL_STATUSES.has(job?.status ?? "appointment_not_started")}
                >
                  {busyAction === "cancel" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="mr-2 h-4 w-4" />
                  )}
                  {t("panel.cancel")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[8px] border-input">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarCheck className="h-4 w-4 text-brand-500" />
                {t("slots.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {slots.length === 0 ? (
                <p className="text-sm leading-6 text-muted-foreground">
                  {job?.status === "appointment_no_slots_available"
                    ? t("slots.noSlots")
                    : t("slots.empty")}
                </p>
              ) : (
                slots.map((slot) => {
                  const date = formatDate(slot.appointmentDate, locale) ?? t("slots.datePending");
                  const time = slot.appointmentTime ?? t("slots.timePending");
                  const chosen = selectedAppointmentSlot?.id === slot.id;
                  return (
                    <div
                      key={slot.id}
                      className={cn(
                        "flex flex-col gap-3 rounded-[8px] border p-3 sm:flex-row sm:items-center sm:justify-between",
                        chosen
                          ? "border-brand-300 bg-brand-50"
                          : "border-slate-200 bg-white",
                      )}
                    >
                      <div>
                        <div className="font-medium text-foreground">
                          {t("slots.slotLine", { date, time })}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {slot.appointmentLocation ?? t("slots.locationPending")}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {slot.observedAt
                            ? t("slots.observedAt", {
                                value: formatDateTime(slot.observedAt, locale) ?? "-",
                              })
                            : t("slots.observedPending")}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant={chosen ? "default" : "outline"}
                        onClick={() =>
                          job &&
                          runAction("slot", () =>
                            selectFranceAppointmentSlot(job.id, slot.id),
                          )
                        }
                        disabled={!job || busyAction === "slot" || chosen}
                      >
                        {chosen ? t("slots.selected") : t("slots.choose")}
                      </Button>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[8px] border-input">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-4 w-4 text-brand-500" />
                {t("payment.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-6 text-muted-foreground">
                {t("payment.body")}
              </p>
              <div className="grid gap-3 sm:grid-cols-4">
                <BrandField label={t("payment.brand")} htmlFor="france-payment-brand" className="sm:col-span-1">
                  <BrandInput
                    id="france-payment-brand"
                    value={paymentBrand}
                    onChange={(event) => setPaymentBrand(event.target.value)}
                    placeholder={t("payment.brandPlaceholder")}
                  />
                </BrandField>
                <BrandField label={t("payment.last4")} htmlFor="france-payment-last4" className="sm:col-span-1">
                  <BrandInput
                    id="france-payment-last4"
                    value={paymentLast4}
                    onChange={(event) => setPaymentLast4(event.target.value)}
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="1234"
                  />
                </BrandField>
                <BrandField label={t("payment.expMonth")} htmlFor="france-payment-month" className="sm:col-span-1">
                  <BrandInput
                    id="france-payment-month"
                    value={paymentExpMonth}
                    onChange={(event) => setPaymentExpMonth(event.target.value)}
                    inputMode="numeric"
                    maxLength={2}
                    placeholder="06"
                  />
                </BrandField>
                <BrandField label={t("payment.expYear")} htmlFor="france-payment-year" className="sm:col-span-1">
                  <BrandInput
                    id="france-payment-year"
                    value={paymentExpYear}
                    onChange={(event) => setPaymentExpYear(event.target.value)}
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="2028"
                  />
                </BrandField>
              </div>
              <Button
                type="button"
                variant={paymentAuthorized ? "outline" : "default"}
                onClick={handlePayment}
                disabled={!job || busyAction === "payment" || paymentAuthorized}
                className="w-full"
              >
                {busyAction === "payment" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : paymentAuthorized ? (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                ) : (
                  <CreditCard className="mr-2 h-4 w-4" />
                )}
                {paymentAuthorized ? t("payment.authorized") : t("payment.record")}
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-[8px] border-input">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-brand-500" />
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
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant={finalApproved ? "outline" : "default"}
                  onClick={() =>
                    job &&
                    runAction("approve", () =>
                      approveFranceAppointmentFinalConfirmation(job.id),
                    )
                  }
                  disabled={!job || !selectedAppointmentSlot || busyAction === "approve" || finalApproved}
                >
                  {busyAction === "approve" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="mr-2 h-4 w-4" />
                  )}
                  {finalApproved ? t("final.approvedBadge") : t("final.approve")}
                </Button>
                <Button
                  type="button"
                  onClick={() =>
                    job &&
                    runAction("book", () => bookSelectedFranceAppointmentSlot(job.id))
                  }
                  disabled={!canBook || busyAction === "book"}
                >
                  {busyAction === "book" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CalendarCheck className="mr-2 h-4 w-4" />
                  )}
                  {t("final.book")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[8px] border-input">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-4 w-4 text-brand-500" />
                {t("results.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {snapshot?.confirmation ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Detail
                      label={t("results.confirmationNumber")}
                      value={snapshot.confirmation.confirmationNumber ?? "-"}
                    />
                    <Detail
                      label={t("results.location")}
                      value={snapshot.confirmation.appointmentLocation ?? "-"}
                    />
                    <Detail
                      label={t("results.date")}
                      value={formatDate(snapshot.confirmation.appointmentDate, locale) ?? "-"}
                    />
                    <Detail
                      label={t("results.time")}
                      value={snapshot.confirmation.appointmentTime ?? "-"}
                    />
                  </div>
                  <Badge variant="default">{t("results.captured")}</Badge>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{t("results.none")}</p>
              )}
            </CardContent>
          </Card>
      </div>
    </main>
  );
}

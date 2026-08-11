"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileCheck2,
  History,
  Loader2,
  MessageSquareText,
  Printer,
  RefreshCw,
  RotateCcw,
  Settings2,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { BrandActionButton } from "@/components/client/brand-action-button";
import { BrandField, BrandInput } from "@/components/client/brand-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface Center {
  code: string;
  nameEn: string;
  nameZh: string;
  officialUrl: string;
  bookingUrl: string | null;
  bookingSearchUrl: string | null;
  addressZh: string;
  provinces: string[];
  consularPostZh: string;
  consularPostEn: string;
  serviceMode: string;
  liveBookingMode: string;
  acceptsWalkIn: boolean | null;
  appointmentRuleZh: string;
  appointmentRuleEn: string;
  importantNoticesZh: string[];
  importantNoticesEn: string[];
}

interface ReviewData {
  applicantName?: string | null;
  passportNumber?: string | null;
  phoneMasked?: string | null;
  currentResidenceProvince?: string | null;
  hukouProvince?: string | null;
  hasResidenceProof?: boolean | null;
  missingFields?: string[];
  routingBasis?: "current_residence" | "hukou" | "ambiguous";
  recommendationReason?: string | null;
}

interface NoSlotsEvidence {
  verified: boolean;
  evidenceUrl?: string | null;
  lastCheckedAt?: string | null;
}

interface Snapshot {
  routing: {
    basis: string;
    recommended: Center;
    alternatives: Center[];
    allCenters?: Center[];
  };
  review?: ReviewData | null;
  reviewConfirmed?: boolean;
  reviewConfirmedAt?: string | null;
  noSlots?: NoSlotsEvidence | null;
  job: { id: string; status: string; mode?: string | null; updated_at?: string | null } | null;
  manualAction: {
    action_type: string;
    instruction: string | null;
    expires_at: string | null;
    metadata_redacted_json?: Record<string, unknown> | null;
  } | null;
  changeIntent: "reschedule" | null;
  rebookingAfterCancellation?: boolean;
  cancellationRefreshRequired?: boolean;
  slots: Array<{
    id: string;
    appointment_date: string | null;
    appointment_time: string | null;
    appointment_location: string | null;
    status: string;
  }>;
  confirmation: {
    confirmation_number: string | null;
    appointment_date: string | null;
    appointment_time: string | null;
    appointment_location: string | null;
    confirmation_pdf_url?: string | null;
    confirmation_screenshot_url?: string | null;
    raw_confirmation_redacted_json?: { mode?: string } | null;
  } | null;
  appointmentHistory: Array<{
    id: string;
    confirmation_number: string | null;
    appointment_date: string | null;
    appointment_time: string | null;
    appointment_location: string | null;
    raw_confirmation_redacted_json?: { mode?: string } | null;
  }>;
}

type AppointmentStage = "review" | "account" | "slots" | "confirm" | "result";

class AppointmentRequestError extends Error {
  constructor(
    message: string,
    readonly evidenceUrl: string | null = null,
    readonly code: string | null = null,
  ) {
    super(message);
    this.name = "AppointmentRequestError";
  }
}

async function requestSnapshot(
  applicationId: string,
  action?: string,
  slotId?: string,
  smsCode?: string,
  selectedCenterCode?: string,
): Promise<Snapshot> {
  const response = await fetch(`/api/applications/${applicationId}/korea-appointment`, {
    method: action ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: action
      ? JSON.stringify({
          action,
          slotId,
          smsCode,
          routingInput: selectedCenterCode ? { selectedCenterCode } : undefined,
        })
      : undefined,
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as
    | Snapshot
    | { error?: string; evidenceUrl?: string; code?: string }
    | null;
  if (!response.ok) {
    const errorBody = body as { error?: string; evidenceUrl?: string; code?: string } | null;
    throw new AppointmentRequestError(
      errorBody?.error ?? `Request failed: ${response.status}`,
      errorBody?.evidenceUrl ?? null,
      errorBody?.code ?? null,
    );
  }
  return body as Snapshot;
}

function isOfficialConfirmation(snapshot: Snapshot | null) {
  const confirmation = snapshot?.confirmation;
  return Boolean(confirmation)
    && confirmation?.raw_confirmation_redacted_json?.mode !== "dry_run"
    && !String(confirmation?.confirmation_number ?? "").startsWith("KR-DRYRUN-");
}

export function getKoreaAppointmentStage(
  snapshot: Snapshot | null,
  transientNoSlots = false,
): AppointmentStage {
  if (!snapshot) return "review";
  if (isOfficialConfirmation(snapshot) || snapshot.job?.status === "appointment_cancelled") return "result";
  const action = snapshot.manualAction?.action_type;
  const selectedSlot = snapshot.slots.some((slot) => ["user_selected", "selected"].includes(slot.status));
  if (action === "final_booking_approval_required" || snapshot.job?.status === "final_booking_approved" || selectedSlot) {
    return "confirm";
  }
  const observedSlots = snapshot.slots.some((slot) => ["observed", "user_selected", "selected"].includes(slot.status));
  if (observedSlots || snapshot.noSlots?.verified || transientNoSlots || snapshot.job?.status === "appointment_no_slots_available") {
    return "slots";
  }
  if (snapshot.reviewConfirmed || (snapshot.job && snapshot.job.status !== "not_started")) return "account";
  return "review";
}

function stageNumber(stage: AppointmentStage) {
  return (["review", "account", "slots", "confirm", "result"] as AppointmentStage[]).indexOf(stage) + 1;
}

function StageCard({
  stage,
  title,
  icon,
  error,
  children,
}: {
  stage: AppointmentStage;
  title: string;
  icon: React.ReactNode;
  error: string | null;
  children: React.ReactNode;
}) {
  return (
    <Card
      data-current-stage={stage}
      className="min-h-[360px] rounded-[12px] border-slate-200 shadow-sm motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-200 motion-reduce:animate-none"
    >
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 font-heading text-xl font-medium">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {children}
      </CardContent>
    </Card>
  );
}

function ReviewValue({ label, value, missing }: { label: string; value: string | null | undefined; missing: string }) {
  return (
    <div className="min-w-0 rounded-[8px] border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-1 truncate text-sm font-semibold", value ? "text-foreground" : "text-amber-700")}>
        {value || missing}
      </p>
    </div>
  );
}

export function KoreaAppointmentAssistant({ applicationId }: { applicationId: string }) {
  const t = useTranslations("koreaAppointment");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [selectedCenterCode, setSelectedCenterCode] = useState<string | null>(null);
  const [smsCode, setSmsCode] = useState("");
  const [busy, setBusy] = useState<string | null>("load");
  const [error, setError] = useState<string | null>(null);
  const [transientNoSlots, setTransientNoSlots] = useState<NoSlotsEvidence | null>(null);
  const [centerSheetOpen, setCenterSheetOpen] = useState(false);
  const [managementOpen, setManagementOpen] = useState(false);
  const [authorizationChecked, setAuthorizationChecked] = useState(false);

  const recommendedCenter = snapshot?.routing.recommended;
  const activeCenterCode = selectedCenterCode ?? recommendedCenter?.code;
  const allCenters = snapshot?.routing.allCenters
    ?? (recommendedCenter ? [recommendedCenter, ...(snapshot?.routing.alternatives ?? [])] : []);
  const center = allCenters.find((item) => item.code === activeCenterCode) ?? recommendedCenter;
  const noSlots = snapshot?.noSlots?.verified ? snapshot.noSlots : transientNoSlots;
  const stage = getKoreaAppointmentStage(snapshot, Boolean(noSlots));
  const currentStep = stageNumber(stage);
  const observedSlots = useMemo(
    () => snapshot?.slots.filter((slot) => ["observed", "user_selected", "selected"].includes(slot.status)) ?? [],
    [snapshot?.slots],
  );
  const selectedSlot = observedSlots.find((slot) => ["user_selected", "selected"].includes(slot.status)) ?? null;
  const manualAction = snapshot?.manualAction;
  const manualActionType = manualAction?.action_type;
  const workerUnavailable = manualAction?.metadata_redacted_json?.workerUnavailable === true;
  const waitingForFinalApproval = manualActionType === "final_booking_approval_required";
  const finalApproved = snapshot?.job?.status === "final_booking_approved";
  const cancelled = snapshot?.job?.status === "appointment_cancelled";
  const changeIntent = manualAction?.metadata_redacted_json?.intent === "reschedule" || snapshot?.changeIntent === "reschedule"
    ? "reschedule"
    : "cancel";
  const savedAppointment = isOfficialConfirmation(snapshot) ? snapshot?.confirmation ?? null : null;
  const isSmsCenter = center?.liveBookingMode === "sms_sync_supported";
  const review = snapshot?.review;
  const reviewReady = Boolean(review?.applicantName && review?.phoneMasked && center);
  const reviewBasis = review?.routingBasis === "current_residence"
    ? t("review.basisResidence", { province: review.currentResidenceProvince || t("common.notProvided") })
    : review?.routingBasis === "hukou"
      ? t("review.basisHukou", { province: review.hukouProvince || t("common.notProvided") })
      : t("review.basisSelected");
  const applicationFormHref = `/client/application/long-form?country=south_korea&visaType=KR_C39_SHORT_TERM_VISIT&applicationId=${encodeURIComponent(applicationId)}`;

  const run = useCallback(async (
    action?: string,
    slotId?: string,
    code?: string,
    centerCode?: string,
  ) => {
    setBusy(action ?? "load");
    setError(null);
    if (action !== "refresh-status") setTransientNoSlots(null);
    try {
      const nextSnapshot = await requestSnapshot(
        applicationId,
        action,
        slotId,
        code,
        centerCode ?? activeCenterCode,
      );
      setSnapshot(nextSnapshot);
      if (["submit-sms-code", "start-new-booking"].includes(action ?? "")) setSmsCode("");
      if (action === "return-to-slot-selection") setAuthorizationChecked(false);
    } catch (cause) {
      const requestError = cause instanceof AppointmentRequestError ? cause : null;
      if (requestError?.code === "no_slots_available") {
        setTransientNoSlots({ verified: true, evidenceUrl: requestError.evidenceUrl, lastCheckedAt: new Date().toISOString() });
      } else {
        setError(t("errors.operationFailed"));
      }
      try {
        const selectedCode = centerCode ?? activeCenterCode;
        setSnapshot(await requestSnapshot(
          applicationId,
          selectedCode ? "refresh-status" : undefined,
          undefined,
          undefined,
          selectedCode,
        ));
      } catch {
        // Keep the safe, localized error from the requested transition.
      }
    } finally {
      setBusy(null);
    }
  }, [activeCenterCode, applicationId, t]);

  useEffect(() => {
    let active = true;
    setBusy("load");
    void requestSnapshot(applicationId)
      .then((nextSnapshot) => {
        if (!active) return;
        setSnapshot(nextSnapshot);
        setSelectedCenterCode(nextSnapshot.routing.recommended.code);
      })
      .catch(() => {
        if (active) setError(t("errors.loadFailed"));
      })
      .finally(() => {
        if (active) setBusy(null);
      });
    return () => {
      active = false;
    };
  }, [applicationId, t]);

  useEffect(() => {
    if ([
      "official_reschedule_required",
      "official_cancel_required",
      "official_cancel_confirmation_required",
      "official_cancel_manual_checkpoint",
    ].includes(manualActionType ?? "")) {
      setManagementOpen(true);
    }
  }, [manualActionType]);

  const chooseCenter = async (nextCenterCode: string) => {
    setSelectedCenterCode(nextCenterCode);
    setCenterSheetOpen(false);
    await run("refresh-status", undefined, undefined, nextCenterCode);
  };

  const centerName = center ? (t("locale") === "zh" ? center.nameZh : center.nameEn) : t("common.notProvided");
  const centerRule = center ? (t("locale") === "zh" ? center.appointmentRuleZh : center.appointmentRuleEn) : "";
  const phoneMasked = review?.phoneMasked
    ?? (typeof manualAction?.metadata_redacted_json?.phoneMasked === "string"
      ? manualAction.metadata_redacted_json.phoneMasked
      : null);
  const stepKeys = ["review", "account", "slots", "confirm", "result"] as const;

  const managementContent = (() => {
    if (manualActionType === "official_cancel_confirmation_required" || manualActionType === "official_cancel_manual_checkpoint") {
      const ready = manualActionType === "official_cancel_confirmation_required";
      return (
        <div className="space-y-5">
          <Alert className="border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-700" />
            <AlertTitle>{changeIntent === "reschedule" ? t("management.confirmReschedule") : t("management.confirmCancel")}</AlertTitle>
            <AlertDescription>{ready ? t("management.cancelWarning") : t("management.sessionExpired")}</AlertDescription>
          </Alert>
          {ready ? (
            <BrandActionButton
              variant="destructive"
              className="w-full"
              loading={busy === "confirm-cancel-official"}
              loadingText={t("management.cancelling")}
              onClick={() => void run("confirm-cancel-official")}
            >
              <XCircle />
              {changeIntent === "reschedule" ? t("management.cancelAndReschedule") : t("management.cancel")}
            </BrandActionButton>
          ) : (
            <BrandActionButton
              className="w-full"
              loading={busy === "start-cancel-query"}
              loadingText={t("management.querying")}
              onClick={() => void run("start-cancel-query")}
            >
              <RefreshCw />
              {t("management.retryQuery")}
            </BrandActionButton>
          )}
          <Button variant="outline" className="w-full" onClick={() => void run("return-to-appointment-details")} disabled={Boolean(busy)}>
            {t("management.back")}
          </Button>
        </div>
      );
    }
    if (["official_reschedule_required", "official_cancel_required"].includes(manualActionType ?? "")) {
      const isReschedule = manualActionType === "official_reschedule_required";
      return (
        <div className="space-y-5">
          <p className="text-sm leading-6 text-muted-foreground">
            {workerUnavailable ? t("management.workerUnavailable") : isReschedule ? t("management.rescheduleBody") : t("management.cancelBody")}
          </p>
          <BrandActionButton
            className="w-full"
            loading={busy === (isReschedule ? "request-reschedule" : "request-cancel")}
            loadingText={t("management.querying")}
            onClick={() => void run(isReschedule ? "request-reschedule" : "request-cancel")}
          >
            <RefreshCw />
            {t("management.continue")}
          </BrandActionButton>
          <Button variant="outline" className="w-full" onClick={() => void run("restart-without-booking-record")} disabled={Boolean(busy)}>
            {t("management.invalidRecord")}
          </Button>
        </div>
      );
    }
    return (
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <BrandActionButton
            variant="secondary"
            loading={busy === "request-reschedule"}
            onClick={() => void run("request-reschedule")}
          >
            <RotateCcw />
            {t("management.reschedule")}
          </BrandActionButton>
          <BrandActionButton
            variant="destructive"
            loading={busy === "request-cancel"}
            onClick={() => void run("request-cancel")}
          >
            <XCircle />
            {t("management.cancel")}
          </BrandActionButton>
        </div>
        {snapshot?.appointmentHistory.length ? (
          <Collapsible>
            <CollapsibleTrigger className="flex min-h-11 w-full items-center justify-between rounded-[8px] border px-4 text-sm font-medium">
              <span className="flex items-center gap-2"><History className="h-4 w-4" />{t("management.history")}</span>
              <ChevronDown className="h-4 w-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3">
              {snapshot.appointmentHistory.map((record) => (
                <div key={record.id} className="rounded-[8px] border bg-muted/30 p-3 text-sm">
                  <p className="font-medium">{record.appointment_date} {record.appointment_time}</p>
                  <p className="mt-1 text-muted-foreground">{record.appointment_location}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{record.confirmation_number}</p>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </div>
    );
  })();

  return (
    <main className="mx-auto w-full max-w-[760px] space-y-5 py-6 sm:py-8">
      <header className="flex items-start gap-3">
        <Button asChild variant="outline" size="icon" className="mt-0.5 shrink-0" aria-label={t("page.backToForm")}>
          <Link href={applicationFormHref}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-medium text-foreground sm:text-3xl">{t("page.title")}</h1>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("page.subtitle")}</p>
        </div>
      </header>

      <nav aria-label={t("progress.ariaLabel")} className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-brand-700">{t("progress.current", { current: currentStep, total: 5 })}</span>
          <span className="text-muted-foreground">{t(`steps.${stage}`)}</span>
        </div>
        <ol className="grid grid-cols-5 gap-1.5">
          {stepKeys.map((key, index) => (
            <li key={key} aria-current={key === stage ? "step" : undefined}>
              <span className={cn(
                "block h-1.5 rounded-full transition-colors duration-200 motion-reduce:transition-none",
                index < currentStep ? "bg-brand-500" : "bg-slate-200",
              )} />
              <span className="sr-only">{t(`steps.${key}`)}</span>
            </li>
          ))}
        </ol>
      </nav>

      {busy === "load" && !snapshot ? (
        <StageCard stage="review" title={t("loading.title")} icon={<Loader2 className="h-5 w-5 animate-spin text-brand-600" />} error={error}>
          <div className="flex min-h-52 items-center justify-center text-sm text-muted-foreground" role="status">
            {t("loading.body")}
          </div>
        </StageCard>
      ) : null}

      {snapshot && stage === "review" ? (
        <StageCard stage="review" title={t("review.title")} icon={<UserRound className="h-5 w-5 text-brand-600" />} error={error}>
          <p className="text-sm leading-6 text-muted-foreground">{t("review.body")}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <ReviewValue label={t("review.name")} value={review?.applicantName} missing={t("common.notProvided")} />
            <ReviewValue label={t("review.passport")} value={review?.passportNumber} missing={t("common.notProvided")} />
            <ReviewValue label={t("review.phone")} value={review?.phoneMasked} missing={t("common.notProvided")} />
          </div>
          <div className="rounded-[10px] border border-brand-100 bg-brand-50/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-brand-700">{t("review.recommended")}</p>
                <p className="mt-1 font-medium text-foreground">{centerName}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {review?.recommendationReason || reviewBasis}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setCenterSheetOpen(true)}>
                <Settings2 className="mr-2 h-4 w-4" />{t("review.changeCenter")}
              </Button>
            </div>
          </div>
          <Collapsible>
            <CollapsibleTrigger className="flex min-h-11 w-full items-center justify-between rounded-[8px] border px-4 text-left text-sm font-medium">
              {t("review.details")}
              <ChevronDown className="h-4 w-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3 text-sm text-muted-foreground">
              <p>{center?.addressZh}</p>
              <p>{centerRule}</p>
              {snapshot.routing.basis === "ambiguous" ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{t("review.ambiguous")}</AlertDescription>
                </Alert>
              ) : null}
            </CollapsibleContent>
          </Collapsible>
          {!reviewReady ? (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-700" />
              <AlertTitle>{t("review.missingTitle")}</AlertTitle>
              <AlertDescription>{t("review.missingBody")}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button asChild variant="outline"><Link href={applicationFormHref}>{t("review.edit")}</Link></Button>
            <BrandActionButton
              className="w-full sm:w-auto"
              loading={busy === "confirm-review"}
              loadingText={t("review.confirming")}
              disabled={!reviewReady || Boolean(busy)}
              onClick={() => void run("confirm-review")}
            >
              <Check />{t("review.confirm")}
            </BrandActionButton>
          </div>
        </StageCard>
      ) : null}

      {snapshot && stage === "account" ? (
        <StageCard stage="account" title={t("account.title")} icon={<MessageSquareText className="h-5 w-5 text-brand-600" />} error={error}>
          {workerUnavailable ? (
            <>
              <Alert className="border-amber-200 bg-amber-50">
                <AlertCircle className="h-4 w-4 text-amber-700" />
                <AlertTitle>{t("account.workerTitle")}</AlertTitle>
                <AlertDescription>{t("account.workerBody")}</AlertDescription>
              </Alert>
              <BrandActionButton
                className="w-full sm:w-auto"
                loading={busy === "request-live-booking"}
                loadingText={t("account.checking")}
                onClick={() => void run("request-live-booking")}
              >
                <RefreshCw />{t("account.retry")}
              </BrandActionButton>
              <Button variant="outline" onClick={() => void run("return-to-center-selection")} disabled={Boolean(busy)}>
                {t("account.backToCenter")}
              </Button>
            </>
          ) : ["official_center_manual_checkpoint", "official_guidance_required", "official_account_login_required"].includes(manualActionType ?? "") ? (
            <>
              <p className="text-sm leading-6 text-muted-foreground">{t("account.manualBody")}</p>
              <div className="rounded-[8px] border bg-muted/30 p-4 text-sm">
                <p className="font-medium">{centerName}</p>
                <p className="mt-2 leading-6 text-muted-foreground">{centerRule}</p>
              </div>
              <BrandActionButton asChild className="w-full sm:w-auto">
                <a href={center?.bookingUrl ?? center?.officialUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink />{t("account.openOfficial")}
                </a>
              </BrandActionButton>
              <Button variant="outline" onClick={() => void run("return-to-center-selection")} disabled={Boolean(busy)}>
                {t("account.backToCenter")}
              </Button>
            </>
          ) : manualActionType === "sms_verification_required" ? (
            <>
              <p className="text-sm leading-6 text-muted-foreground">{t("account.smsBody", { phone: phoneMasked || t("common.maskedPhone") })}</p>
              {manualAction?.expires_at ? (
                <p className="text-xs text-muted-foreground">{t("account.expires", { time: new Date(manualAction.expires_at).toLocaleTimeString() })}</p>
              ) : null}
              <BrandField label={t("account.codeLabel")} htmlFor="korea-sms-code">
                <BrandInput
                  id="korea-sms-code"
                  value={smsCode}
                  onChange={(event) => setSmsCode(event.target.value.replace(/\D/g, "").slice(0, 8))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder={t("account.codePlaceholder")}
                />
              </BrandField>
              <BrandActionButton
                className="w-full sm:w-auto"
                loading={busy === "submit-sms-code"}
                loadingText={t("account.verifying")}
                disabled={Boolean(busy) || !/^\d{4,8}$/.test(smsCode)}
                onClick={() => void run("submit-sms-code", undefined, smsCode)}
              >
                <CalendarCheck />{t("account.verify")}
              </BrandActionButton>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void run("return-to-center-selection")} disabled={Boolean(busy)}>{t("account.backToCenter")}</Button>
                <Button variant="ghost" onClick={() => void run("request-live-booking")} disabled={Boolean(busy)}>{t("account.resend")}</Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm leading-6 text-muted-foreground">
                {snapshot.rebookingAfterCancellation || snapshot.job?.status === "sms_restart_required"
                  ? t("account.restartBody")
                  : t("account.body")}
              </p>
              <div className="rounded-[8px] border bg-muted/30 p-4 text-sm">
                <p className="font-medium">{centerName}</p>
                <p className="mt-1 text-muted-foreground">{centerRule}</p>
              </div>
              <BrandActionButton
                className="w-full sm:w-auto"
                loading={busy === "request-live-booking"}
                loadingText={t("account.checking")}
                disabled={Boolean(busy)}
                onClick={() => void run("request-live-booking")}
              >
                {isSmsCenter ? <MessageSquareText /> : <ExternalLink />}
                {isSmsCenter ? t("account.start") : t("account.viewMethod")}
              </BrandActionButton>
              {busy === "request-live-booking" ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
                  <Loader2 className="h-4 w-4 animate-spin text-brand-600" />{t("account.scanProgress")}
                </div>
              ) : null}
              <Button variant="outline" onClick={() => void run("return-to-center-selection")} disabled={Boolean(busy)}>{t("account.backToCenter")}</Button>
            </>
          )}
        </StageCard>
      ) : null}

      {snapshot && stage === "slots" ? (
        <StageCard stage="slots" title={t("slots.title")} icon={<CalendarCheck className="h-5 w-5 text-brand-600" />} error={error}>
          {noSlots ? (
            <div className="flex min-h-64 flex-col items-center justify-center text-center">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-600"><CalendarCheck className="h-6 w-6" /></div>
              <h2 className="mt-4 font-heading text-lg font-medium">{t("slots.emptyTitle")}</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{t("slots.emptyBody")}</p>
              {noSlots.lastCheckedAt ? <p className="mt-2 text-xs text-muted-foreground">{t("slots.checkedAt", { time: new Date(noSlots.lastCheckedAt).toLocaleString() })}</p> : null}
              <BrandActionButton
                className="mt-5 w-full sm:w-auto"
                loading={busy === "request-live-booking"}
                loadingText={t("slots.checking")}
                onClick={() => void run("request-live-booking")}
              >
                <RefreshCw />{t("slots.retry")}
              </BrandActionButton>
              <Button variant="ghost" className="mt-2" onClick={() => void run("return-to-center-selection")} disabled={Boolean(busy)}>{t("slots.changeCenter")}</Button>
              {noSlots.evidenceUrl ? (
                <Button asChild variant="link" className="mt-1">
                  <a href={noSlots.evidenceUrl} target="_blank" rel="noopener noreferrer">{t("slots.viewEvidence")}</a>
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              <p className="text-sm leading-6 text-muted-foreground">{t("slots.body")}</p>
              <div className="space-y-3">
                {observedSlots.map((slot) => (
                  <div key={slot.id} className="flex flex-col gap-3 rounded-[10px] border p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">{slot.appointment_date} {slot.appointment_time}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{slot.appointment_location}</p>
                    </div>
                    <BrandActionButton
                      size="sm"
                      variant="secondary"
                      loading={busy === "select-slot"}
                      disabled={Boolean(busy)}
                      onClick={() => void run("select-slot", slot.id)}
                    >
                      <CheckCircle2 />{t("slots.choose")}
                    </BrandActionButton>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void run("return-to-sms-verification")} disabled={Boolean(busy)}>{t("slots.back")}</Button>
                <Button variant="ghost" onClick={() => void run("request-live-booking")} disabled={Boolean(busy)}><RefreshCw className="mr-2 h-4 w-4" />{t("slots.refresh")}</Button>
              </div>
            </>
          )}
        </StageCard>
      ) : null}

      {snapshot && stage === "confirm" ? (
        <StageCard stage="confirm" title={t("confirm.title")} icon={<ShieldCheck className="h-5 w-5 text-brand-600" />} error={error}>
          <div className="rounded-[10px] border border-brand-100 bg-brand-50/60 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-brand-700">{t("confirm.selected")}</p>
            <p className="mt-2 text-lg font-semibold">{selectedSlot?.appointment_date} {selectedSlot?.appointment_time}</p>
            <p className="mt-1 text-sm text-muted-foreground">{selectedSlot?.appointment_location}</p>
            <p className="mt-3 border-t border-brand-100 pt-3 text-sm text-muted-foreground">{review?.applicantName || t("common.notProvided")}</p>
          </div>
          {!finalApproved ? (
            <label className="flex cursor-pointer items-start gap-3 rounded-[10px] border p-4">
              <Checkbox checked={authorizationChecked} onCheckedChange={(checked) => setAuthorizationChecked(checked === true)} className="mt-0.5 h-5 w-5" />
              <span className="text-sm leading-6">{t("confirm.authorization")}</span>
            </label>
          ) : (
            <Alert className="border-emerald-200 bg-emerald-50">
              <CheckCircle2 className="h-4 w-4 text-emerald-700" />
              <AlertTitle>{t("confirm.approvedTitle")}</AlertTitle>
              <AlertDescription>{t("confirm.approvedBody")}</AlertDescription>
            </Alert>
          )}
          {waitingForFinalApproval ? (
            <BrandActionButton
              className="w-full sm:w-auto"
              loading={busy === "approve-final-booking"}
              loadingText={t("confirm.approving")}
              disabled={!authorizationChecked || Boolean(busy)}
              onClick={() => void run("approve-final-booking")}
            >
              <ShieldCheck />{t("confirm.approve")}
            </BrandActionButton>
          ) : null}
          {finalApproved ? (
            <BrandActionButton
              className="w-full sm:w-auto"
              loading={busy === "complete-final-booking"}
              loadingText={t("confirm.submitting")}
              disabled={Boolean(busy)}
              onClick={() => void run("complete-final-booking")}
            >
              <CheckCircle2 />{t("confirm.submit")}
            </BrandActionButton>
          ) : null}
          {!finalApproved ? (
            <Button variant="outline" onClick={() => void run("return-to-slot-selection")} disabled={Boolean(busy)}>{t("confirm.back")}</Button>
          ) : null}
        </StageCard>
      ) : null}

      {snapshot && stage === "result" ? (
        <StageCard
          stage="result"
          title={cancelled ? t("result.cancelledTitle") : t("result.title")}
          icon={cancelled ? <XCircle className="h-5 w-5 text-slate-600" /> : <CheckCircle2 className="h-5 w-5 text-emerald-700" />}
          error={error}
        >
          {cancelled ? (
            <div className="flex min-h-64 flex-col items-center justify-center text-center">
              <p className="max-w-md text-sm leading-6 text-muted-foreground">{t("result.cancelledBody")}</p>
              <BrandActionButton
                className="mt-5"
                loading={busy === "start-new-booking"}
                loadingText={t("result.restarting")}
                onClick={() => void run("start-new-booking")}
              >
                <RotateCcw />{t("result.bookAgain")}
              </BrandActionButton>
            </div>
          ) : savedAppointment ? (
            <>
              <div className="rounded-[12px] border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
                <div className="flex items-center gap-2 text-sm font-medium"><FileCheck2 className="h-4 w-4" />{t("result.officialConfirmation")}</div>
                <p className="mt-3 font-heading text-2xl font-medium">{savedAppointment.appointment_date} {savedAppointment.appointment_time}</p>
                <p className="mt-1 text-sm">{savedAppointment.appointment_location}</p>
                <p className="mt-4 border-t border-emerald-200 pt-4 text-sm">{t("result.number", { number: savedAppointment.confirmation_number ?? "-" })}</p>
              </div>
              {savedAppointment.confirmation_pdf_url ? (
                <BrandActionButton asChild className="w-full sm:w-auto">
                  <a href={savedAppointment.confirmation_pdf_url} target="_blank" rel="noopener noreferrer"><Printer />{t("result.print")}</a>
                </BrandActionButton>
              ) : (
                <BrandActionButton
                  className="w-full sm:w-auto"
                  loading={busy === "print-appointment-confirmation"}
                  loadingText={t("result.preparingPrint")}
                  onClick={() => void run("print-appointment-confirmation")}
                >
                  <Printer />{t("result.print")}
                </BrandActionButton>
              )}
              <Button variant="outline" onClick={() => setManagementOpen(true)}><Settings2 className="mr-2 h-4 w-4" />{t("result.manage")}</Button>
            </>
          ) : null}
        </StageCard>
      ) : null}

      <Sheet open={centerSheetOpen} onOpenChange={setCenterSheetOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{t("centerSheet.title")}</SheetTitle>
            <SheetDescription>{t("centerSheet.description")}</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            {allCenters.map((item) => {
              const selected = item.code === activeCenterCode;
              return (
                <button
                  key={item.code}
                  type="button"
                  className={cn(
                    "w-full rounded-[10px] border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
                    selected ? "border-brand-400 bg-brand-50" : "border-slate-200 hover:bg-slate-50",
                  )}
                  onClick={() => void chooseCenter(item.code)}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span>
                      <span className="block font-medium">{t("locale") === "zh" ? item.nameZh : item.nameEn}</span>
                      <span className="mt-1 block text-sm leading-6 text-muted-foreground">{item.provinces.join(t("common.listSeparator"))}</span>
                    </span>
                    {selected ? <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-600" /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={managementOpen} onOpenChange={setManagementOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{t("management.title")}</SheetTitle>
            <SheetDescription>{t("management.description")}</SheetDescription>
          </SheetHeader>
          <div className="mt-6">{managementContent}</div>
        </SheetContent>
      </Sheet>
    </main>
  );
}

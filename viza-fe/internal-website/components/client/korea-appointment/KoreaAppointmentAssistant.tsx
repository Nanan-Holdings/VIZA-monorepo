"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
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
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BrandActionButton } from "@/components/client/brand-action-button";
import { BrandField, BrandInput } from "@/components/client/brand-field";
import { ProgressRail } from "@/components/client/simplified-form/progress-rail";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
  description,
  icon,
  error,
  children,
}: {
  stage: AppointmentStage;
  title: string;
  description?: string;
  icon: React.ReactNode;
  error: string | null;
  children: React.ReactNode;
}) {
  return (
    <section
      data-current-stage={stage}
      aria-labelledby={`korea-appointment-${stage}-title`}
      className="min-h-[440px] overflow-hidden rounded-xl border bg-white shadow-sm"
    >
      <div className="border-b bg-brand-50/40 px-5 py-5 sm:px-8 sm:py-6">
        <div className="flex items-start gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-brand-600 shadow-sm ring-1 ring-brand-100">
            {icon}
          </div>
          <div className="min-w-0 pt-0.5">
            <h1 id={`korea-appointment-${stage}-title`} className="font-heading text-xl font-semibold text-foreground sm:text-2xl">
              {title}
            </h1>
            {description ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p> : null}
          </div>
        </div>
      </div>
      <div className="flex min-h-[330px] flex-col gap-6 p-5 sm:p-8">
        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {children}
      </div>
    </section>
  );
}

function SummaryRows({
  rows,
  missing,
}: {
  rows: Array<{ label: string; value: string | null | undefined }>;
  missing: string;
}) {
  return (
    <dl className="divide-y rounded-lg border px-4 sm:px-5">
      {rows.map((row) => (
        <div key={row.label} className="grid gap-1 py-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] sm:items-center sm:gap-6">
          <dt className="text-sm font-medium text-muted-foreground">{row.label}</dt>
          <dd className={cn("min-w-0 break-words text-sm font-semibold sm:text-right", row.value ? "text-foreground" : "text-amber-700")}>
            {row.value || missing}
          </dd>
        </div>
      ))}
    </dl>
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
  const [pendingSlotId, setPendingSlotId] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();

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
  const pendingSlot = observedSlots.find((slot) => slot.id === pendingSlotId) ?? null;
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
      if (action === "select-slot") setPendingSlotId(null);
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
  const motionProps = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -6 },
        transition: { duration: 0.2, ease: "easeOut" as const },
      };

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

  const goBackFromProgress = () => {
    if (stage === "review") {
      window.location.assign(applicationFormHref);
      return;
    }
    if (stage === "account") {
      void run("return-to-center-selection");
      return;
    }
    if (stage === "slots") {
      void run("return-to-sms-verification");
      return;
    }
    if (stage === "confirm" && !finalApproved) {
      void run("return-to-slot-selection");
      return;
    }
    setManagementOpen(true);
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 pb-12 pt-2 sm:pt-4">
      <ProgressRail
        step={currentStep}
        total={5}
        label={t("progress.label", { current: currentStep, total: 5, name: t(`steps.${stage}`) })}
        onBack={goBackFromProgress}
        backLabel={stage === "review" ? t("page.backToForm") : t("progress.back")}
      />

      <AnimatePresence mode="wait">
        <motion.div key={busy === "load" && !snapshot ? "loading" : stage} {...motionProps}>

      {busy === "load" && !snapshot ? (
        <StageCard stage="review" title={t("loading.title")} description={t("loading.body")} icon={<Loader2 className="h-5 w-5 animate-spin" />} error={error}>
          <div className="flex min-h-52 items-center justify-center text-sm text-muted-foreground" role="status">
            <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
          </div>
        </StageCard>
      ) : null}

      {snapshot && stage === "review" ? (
        <StageCard stage="review" title={t("review.title")} description={t("review.body")} icon={<UserRound className="h-5 w-5" />} error={error}>
          <SummaryRows
            missing={t("common.notProvided")}
            rows={[
              { label: t("review.name"), value: review?.applicantName },
              { label: t("review.passport"), value: review?.passportNumber },
              { label: t("review.phone"), value: review?.phoneMasked },
            ]}
          />
          <div className="rounded-lg border border-brand-100 bg-brand-50/50 p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{t("review.recommended")}</p>
                <p className="mt-2 font-heading text-lg font-semibold text-foreground">{centerName}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {review?.recommendationReason || reviewBasis}
                </p>
              </div>
              <Button variant="outline" size="sm" className="shrink-0" onClick={() => setCenterSheetOpen(true)}>
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
          <div className="mt-auto flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Button asChild variant="ghost"><Link href={applicationFormHref}>{t("review.edit")}</Link></Button>
            <BrandActionButton
              className="w-full sm:min-w-48 sm:w-auto"
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
        <StageCard stage="account" title={t("account.title")} description={t("account.focus")} icon={<MessageSquareText className="h-5 w-5" />} error={error}>
          {workerUnavailable ? (
            <>
              <Alert className="border-amber-200 bg-amber-50">
                <AlertCircle className="h-4 w-4 text-amber-700" />
                <AlertTitle>{t("account.workerTitle")}</AlertTitle>
                <AlertDescription>{t("account.workerBody")}</AlertDescription>
              </Alert>
              <div className="mt-auto border-t pt-5">
                <BrandActionButton
                  className="w-full"
                  loading={busy === "request-live-booking"}
                  loadingText={t("account.checking")}
                  onClick={() => void run("request-live-booking")}
                >
                  <RefreshCw />{t("account.retry")}
                </BrandActionButton>
              </div>
            </>
          ) : ["official_center_manual_checkpoint", "official_guidance_required", "official_account_login_required"].includes(manualActionType ?? "") ? (
            <>
              <p className="text-sm leading-6 text-muted-foreground">{t("account.manualBody")}</p>
              <div className="rounded-[8px] border bg-muted/30 p-4 text-sm">
                <p className="font-medium">{centerName}</p>
                <p className="mt-2 leading-6 text-muted-foreground">{centerRule}</p>
              </div>
              <div className="mt-auto border-t pt-5">
                <BrandActionButton asChild className="w-full">
                  <a href={center?.bookingUrl ?? center?.officialUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink />{t("account.openOfficial")}
                  </a>
                </BrandActionButton>
              </div>
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
              <div className="mt-auto space-y-2 border-t pt-5">
                <BrandActionButton
                  className="w-full"
                  loading={busy === "submit-sms-code"}
                  loadingText={t("account.verifying")}
                  disabled={Boolean(busy) || !/^\d{4,8}$/.test(smsCode)}
                  onClick={() => void run("submit-sms-code", undefined, smsCode)}
                >
                  <CalendarCheck />{t("account.verify")}
                </BrandActionButton>
                <Button className="w-full" variant="ghost" onClick={() => void run("request-live-booking")} disabled={Boolean(busy)}>{t("account.resend")}</Button>
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
              <div className="mt-auto border-t pt-5">
                <BrandActionButton
                  className="w-full"
                  loading={busy === "request-live-booking"}
                  loadingText={t("account.checking")}
                  disabled={Boolean(busy)}
                  onClick={() => void run("request-live-booking")}
                >
                  {isSmsCenter ? <MessageSquareText /> : <ExternalLink />}
                  {isSmsCenter ? t("account.start") : t("account.viewMethod")}
                </BrandActionButton>
              </div>
              {busy === "request-live-booking" ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
                  <Loader2 className="h-4 w-4 animate-spin text-brand-600" />{t("account.scanProgress")}
                </div>
              ) : null}
            </>
          )}
        </StageCard>
      ) : null}

      {snapshot && stage === "slots" ? (
        <StageCard stage="slots" title={t("slots.title")} description={t("slots.body")} icon={<CalendarCheck className="h-5 w-5" />} error={error}>
          {noSlots ? (
            <div className="flex min-h-64 flex-col items-center justify-center text-center">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-600"><CalendarCheck className="h-6 w-6" /></div>
              <h2 className="mt-4 font-heading text-lg font-medium">{t("slots.emptyTitle")}</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{t("slots.emptyBody")}</p>
              {noSlots.lastCheckedAt ? <p className="mt-2 text-xs text-muted-foreground">{t("slots.checkedAt", { time: new Date(noSlots.lastCheckedAt).toLocaleString() })}</p> : null}
              <BrandActionButton
                className="mt-5 w-full"
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
              <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
                <span>{centerName}</span>
                {snapshot.job?.updated_at ? <span>{t("slots.checkedAt", { time: new Date(snapshot.job.updated_at).toLocaleString() })}</span> : null}
              </div>
              <div className="space-y-3" role="radiogroup" aria-label={t("slots.title")}>
                {observedSlots.map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    role="radio"
                    aria-checked={slot.id === pendingSlotId}
                    className={cn(
                      "flex min-h-20 w-full items-center gap-4 rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
                      slot.id === pendingSlotId ? "border-brand-500 bg-brand-50" : "border-input hover:border-brand-200 hover:bg-brand-50/30",
                    )}
                    onClick={() => setPendingSlotId(slot.id)}
                  >
                    <span className={cn(
                      "grid h-5 w-5 shrink-0 place-items-center rounded-full border",
                      slot.id === pendingSlotId ? "border-brand-500 bg-brand-500 text-white" : "border-input bg-white",
                    )}>
                      {slot.id === pendingSlotId ? <Check className="h-3 w-3" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-heading text-lg font-semibold">{slot.appointment_date} · {slot.appointment_time}</span>
                      <span className="mt-1 block text-sm text-muted-foreground">{slot.appointment_location}</span>
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-auto space-y-2 border-t pt-5">
                <BrandActionButton
                  className="w-full"
                  loading={busy === "select-slot"}
                  loadingText={t("slots.continuing")}
                  disabled={Boolean(busy) || !pendingSlot}
                  onClick={() => pendingSlot ? void run("select-slot", pendingSlot.id) : undefined}
                >
                  {t("slots.continue")}
                </BrandActionButton>
                <Button className="w-full" variant="ghost" onClick={() => void run("request-live-booking")} disabled={Boolean(busy)}><RefreshCw className="mr-2 h-4 w-4" />{t("slots.refresh")}</Button>
              </div>
            </>
          )}
        </StageCard>
      ) : null}

      {snapshot && stage === "confirm" ? (
        <StageCard stage="confirm" title={t("confirm.title")} description={t("confirm.body")} icon={<ShieldCheck className="h-5 w-5" />} error={error}>
          <SummaryRows
            missing={t("common.notProvided")}
            rows={[
              { label: t("confirm.date"), value: selectedSlot?.appointment_date },
              { label: t("confirm.time"), value: selectedSlot?.appointment_time },
              { label: t("confirm.location"), value: selectedSlot?.appointment_location },
              { label: t("confirm.applicant"), value: review?.applicantName },
            ]}
          />
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
            <div className="mt-auto border-t pt-5">
              <BrandActionButton
                className="w-full"
                loading={busy === "approve-final-booking"}
                loadingText={t("confirm.approving")}
                disabled={!authorizationChecked || Boolean(busy)}
                onClick={() => void run("approve-final-booking")}
              >
                <ShieldCheck />{t("confirm.approve")}
              </BrandActionButton>
            </div>
          ) : null}
          {finalApproved ? (
            <div className="mt-auto border-t pt-5">
              <BrandActionButton
                className="w-full"
                loading={busy === "complete-final-booking"}
                loadingText={t("confirm.submitting")}
                disabled={Boolean(busy)}
                onClick={() => void run("complete-final-booking")}
              >
                <CheckCircle2 />{t("confirm.submit")}
              </BrandActionButton>
            </div>
          ) : null}
        </StageCard>
      ) : null}

      {snapshot && stage === "result" ? (
        <StageCard
          stage="result"
          title={cancelled ? t("result.cancelledTitle") : t("result.title")}
          description={cancelled ? t("result.cancelledBody") : t("result.body")}
          icon={cancelled ? <XCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5 text-emerald-700" />}
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
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950 sm:p-6">
                <div className="flex items-center gap-2 text-sm font-medium"><FileCheck2 className="h-4 w-4" />{t("result.officialConfirmation")}</div>
                <p className="mt-3 font-heading text-2xl font-medium">{savedAppointment.appointment_date} {savedAppointment.appointment_time}</p>
                <p className="mt-1 text-sm">{savedAppointment.appointment_location}</p>
                <p className="mt-4 border-t border-emerald-200 pt-4 text-sm">{t("result.number", { number: savedAppointment.confirmation_number ?? "-" })}</p>
              </div>
              <div className="mt-auto space-y-2 border-t pt-5">
                {savedAppointment.confirmation_pdf_url ? (
                  <BrandActionButton asChild className="w-full">
                    <a href={savedAppointment.confirmation_pdf_url} target="_blank" rel="noopener noreferrer"><Printer />{t("result.print")}</a>
                  </BrandActionButton>
                ) : (
                  <BrandActionButton
                    className="w-full"
                    loading={busy === "print-appointment-confirmation"}
                    loadingText={t("result.preparingPrint")}
                    onClick={() => void run("print-appointment-confirmation")}
                  >
                    <Printer />{t("result.print")}
                  </BrandActionButton>
                )}
                <Button className="w-full" variant="ghost" onClick={() => setManagementOpen(true)}><Settings2 className="mr-2 h-4 w-4" />{t("result.manage")}</Button>
              </div>
            </>
          ) : null}
        </StageCard>
      ) : null}

        </motion.div>
      </AnimatePresence>

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

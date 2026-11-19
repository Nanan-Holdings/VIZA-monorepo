"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { OfficialCancelButton, supportsOfficialCancel } from "./OfficialCancelButton";
import { useLocale } from "next-intl";
import { motion } from "motion/react";
import { CircleNotch as Loader2, CheckCircle as CheckCircle2, Clock as Clock3, Eye, EyeSlash as EyeOff, ArrowSquareOut as ExternalLink, XCircle } from "@phosphor-icons/react";
import { SmoothProgressBar } from "@/components/smooth-progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClientErrorAlert } from "@/components/client/client-error-alert";
import { useSmoothProgress } from "@/hooks/use-smooth-progress";
import { isChineseLocale } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";
import type { SubmissionResultStatus } from "@/lib/submission-result";
import { ds160ProgressForStage, type Ds160ProgressPhase } from "@/lib/ds160-progress";
import { isDs160VisaType } from "@/lib/submission-queue";

export type SubmissionVisualStatus =
  | "scheduled"
  | "queued"
  | "running"
  | "needs_user_action"
  | "completed"
  | "failed"
  | "stalled"
  | SubmissionResultStatus;

export type SubmissionVisualStage =
  | "scheduled"
  | "preparing"
  | "mapping_answers"
  | "filling_form"
  | "submitting_form"
  | "confirming_result"
  | "payment_handoff"
  | "completed"
  | "failed";

interface Phase {
  id: "preparing" | "filling" | "confirming";
  labelEn: string;
  labelZh: string;
}

type FvOfficialAccount = {
  email: string | null;
  password: string | null;
  portalUrl: string;
  updatedAt: string | null;
};

const PHASES: Phase[] = [
  {
    id: "preparing",
    labelEn: "Validating English answers",
    labelZh: "正在校验英文版答案",
  },
  {
    id: "filling",
    labelEn: "Filling the official form",
    labelZh: "正在填写官网表单",
  },
  {
    id: "confirming",
    labelEn: "Waiting for checkpoint or result",
    labelZh: "正在等待检查点或结果",
  },
];

const PHASE_PROGRESS = [34, 67, 99] as const;

function phaseIndexForProgress(progress: number): number {
  if (progress <= PHASE_PROGRESS[0]) return 0;
  if (progress <= PHASE_PROGRESS[1]) return 1;
  return 2;
}

const DS160_PHASE_INDEX: Record<Ds160ProgressPhase, number> = {
  preparing: 0,
  filling: 1,
  confirming: 2,
};

/** Seconds per 1% of slow creep between two DS-160 checkpoints. */
const CHECKPOINT_CREEP_SECONDS_PER_PERCENT = 25;

/**
 * Progress that starts at a reported checkpoint and rises 1% every
 * CHECKPOINT_CREEP_SECONDS_PER_PERCENT seconds, never past `ceiling`, so the
 * bar keeps moving steadily while the worker fills a page.
 */
function useCheckpointCreep(base: number | null, ceiling: number | null): number | null {
  const [elapsed, setElapsed] = useState<{ base: number | null; seconds: number }>({
    base: null,
    seconds: 0,
  });

  useEffect(() => {
    if (base === null) return;
    const since = Date.now();
    const timer = window.setInterval(() => {
      setElapsed({ base, seconds: Math.floor((Date.now() - since) / 1000) });
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [base]);

  if (base === null || ceiling === null) return null;
  const seconds = elapsed.base === base ? elapsed.seconds : 0;
  const creep = Math.floor(seconds / CHECKPOINT_CREEP_SECONDS_PER_PERCENT);
  return Math.max(base, Math.min(ceiling, base + creep));
}

function normalizeStatus(status: SubmissionVisualStatus | null | undefined): string {
  return (status ?? "").trim().toLowerCase();
}

function isCompletionStatus(status: SubmissionVisualStatus | null | undefined): boolean {
  return [
    "completed",
    "submitted",
    "qr_ready",
    "approved",
    "submitted_mock",
    "form_ready_for_agency",
  ].includes(normalizeStatus(status));
}

function isFailedStatus(status: SubmissionVisualStatus | null | undefined): boolean {
  return ["failed", "rejected"].includes(normalizeStatus(status));
}

function isWaitingForUserStatus(status: SubmissionVisualStatus | null | undefined): boolean {
  return ["needs_user_action", "needs_attention", "action_required", "blocked"].includes(normalizeStatus(status));
}

function isScheduledStatus(status: SubmissionVisualStatus | null | undefined): boolean {
  return normalizeStatus(status) === "scheduled";
}

function phaseIndexForStage(stage: SubmissionVisualStage | null | undefined): number | null {
  switch (stage) {
    case "scheduled":
      return 0;
    case "preparing":
    case "mapping_answers":
      return 0;
    case "filling_form":
    case "submitting_form":
      return 1;
    case "confirming_result":
    case "payment_handoff":
    case "completed":
    case "failed":
      return 2;
    default:
      return null;
  }
}

function chineseStageMessage(stage: string): string {
  const normalized = stage.trim().toLowerCase();
  const exactMessages: Record<string, string> = {
    payment_authorized: "接下来需要支付官方费用。VIZA 顾问会通过邮件把官方付款链接发给你，你在官方网站付款即可。",
    official_fee_payment_processing: "接下来需要支付官方费用。VIZA 顾问会通过邮件把官方付款链接发给你，你在官方网站付款即可。",
    official_fee_payment_required: "接下来需要支付官方费用。VIZA 顾问会通过邮件把官方付款链接发给你，你在官方网站付款即可。",
    payment_page_visible: "接下来需要支付官方费用。VIZA 顾问会通过邮件把官方付款链接发给你，你在官方网站付款即可。",
    bank_authentication_waiting: "接下来需要支付官方费用。VIZA 顾问会通过邮件把官方付款链接发给你，你在官方网站付款即可。",
    registration_code_captured: "已取得官网登记编号，正在确认最终结果。",
    preparing_managed_alias: "正在准备本次申请使用的专属邮箱。",
    managed_account_required: "正在准备官网托管账号。",
    captcha_required: "正在等待完成官网验证码。",
    otp_required: "正在等待完成一次性验证码验证。",
    email_verification_pending: "正在等待完成官网邮箱验证。",
    payment_processing: "接下来需要支付官方费用。VIZA 顾问会通过邮件把官方付款链接发给你，你在官方网站付款即可。",
    payment_confirming: "接下来需要支付官方费用。VIZA 顾问会通过邮件把官方付款链接发给你，你在官方网站付款即可。",
    confirmation_pending: "正在等待官网返回最终确认。",
    completed: "官网流程已完成。",
  };
  const exact = exactMessages[normalized];
  if (exact) return exact;
  if (/payment|fee|bank|3ds/.test(normalized)) return "接下来需要支付官方费用。VIZA 顾问会通过邮件把官方付款链接发给你，你在官方网站付款即可。";
  if (/captcha|turnstile|waf/.test(normalized)) return "正在处理官网安全验证。";
  if (/otp|email|alias|account/.test(normalized)) return "正在处理官网账号或验证码。";
  if (/fill|form|answer|mapping/.test(normalized)) return "正在填写并校验官网表单。";
  if (/submit|confirm|result|reference|registration/.test(normalized)) {
    return "正在提交并确认官网结果。";
  }
  if (/queue|pending|prepar|start|launch|authorized/.test(normalized)) {
    return "云端任务正在准备并等待继续。";
  }
  return "云端任务正在处理，页面会自动更新。";
}

export function localizeProgressMessage(
  message: string | null | undefined,
  isZh: boolean,
): string | null {
  if (!message) return null;
  if (/payment|virtual card|bank authentication|3ds|付款|支付|银行卡/i.test(message)) {
    return isZh
      ? "接下来需要支付官方费用。VIZA 顾问会通过邮件把官方付款链接发给你，你在官方网站付款即可。"
      : "The official fee is next. Your VIZA consultant will email you the official payment link; you pay on the official site.";
  }
  if (
    /official portal could not read required fields from the passport image|official_passport_scan_invalid_data|step_1_passport_scan_invalid_data/i.test(
      message,
    )
  ) {
    return isZh
      ? "印尼官网无法读取护照图片里的必要字段。请重新上传更清晰、光线充足、横向放置的护照资料页，然后重试。"
      : "Indonesia official portal could not read required fields from the passport image. Upload a clearer, well-lit, landscape passport bio page image and retry.";
  }
  if (isZh) {
    const currentStage = message.match(/^\s*Current stage:\s*([a-z0-9._-]+)\.?\s*$/i);
    if (currentStage?.[1]) return chineseStageMessage(currentStage[1].replace(/\.+$/, ""));

    const normalized = message.trim().replace(/\s+/g, " ").toLowerCase();
    const standardMessages: Record<string, string> = {
      "submission job is queued and waiting for the runner.": "提交任务已排队，正在等待云端执行。",
      "preparing and mapping application answers for the official portal.": "正在整理并校验官网所需的英文答案。",
      "the runner is filling the official portal form.": "正在填写官网表单。",
      "the runner is advancing through the safe submit/review checkpoint.": "正在通过官网提交前的安全检查。",
      "still confirming the submission result.": "正在确认官网提交结果。",
      "the official portal needs a human action before viza can continue.": "官网需要完成必要操作后才能继续。",
      "submission completed.": "官网提交已完成。",
      "submission failed.": "官网提交未完成。",
      "automated submission has started.": "自动提交任务已启动。",
    };
    const standard = standardMessages[normalized];
    if (standard) return standard;

    if (/^[a-z][a-z0-9._-]+$/i.test(message.trim())) {
      return chineseStageMessage(message.trim());
    }

    if (/\p{Script=Han}/u.test(message)) return message;
    return chineseStageMessage(normalized);
  }
  return message;
}

function isPacedRuntimeMessage(message: string | null | undefined): boolean {
  if (!message) return false;
  return /^(?:\s*Current stage:)|Fly 云端已到达官方付款阶段|Fly 云端正在填写|Fly cloud.*official payment stage|The Fly cloud run is filling|submission job is queued|preparing and mapping|the runner is filling|the runner is advancing|still confirming the submission result|submission completed|automated submission has started|自动提交任务已启动|银行卡已安全送入云端|正在准备官网填写任务/i.test(
    message.trim(),
  );
}

/**
 * WaitingCard — renders while applications.submission_result_status is
 * `waiting` or `processing`. Phase progresses on a soft timer; the realtime
 * subscription on `applications` will cut the user over to a result card
 * the moment the runner writes the terminal payload.
 */
function WaitingCardBody({
  status,
  stage,
  serverProgress,
  message,
  error,
  applicationId,
  persistenceKey,
  progressCycleKey,
  resetProgressOnMount,
  country,
  visaType,
  queueStage,
  onVisualComplete,
}: {
  status: SubmissionVisualStatus | null;
  stage?: SubmissionVisualStage | null;
  serverProgress?: number | null;
  message?: string | null;
  error?: string | null;
  applicationId?: string | null;
  persistenceKey?: string | null;
  progressCycleKey?: string | null;
  resetProgressOnMount?: boolean;
  country?: string | null;
  visaType?: string | null;
  /** The queue row's `current_stage`, e.g. `ceac_page:passport` for DS-160. */
  queueStage?: string | null;
  onVisualComplete?: () => void;
}) {
  const locale = useLocale();
  const isZh = isChineseLocale(locale);
  const [officialAccount, setOfficialAccount] = useState<FvOfficialAccount | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [cancelingScheduled, setCancelingScheduled] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const completeStatus = isCompletionStatus(status);
  const failedStatus = isFailedStatus(status);
  const waitingForUser = isWaitingForUserStatus(status);
  const scheduledStatus = isScheduledStatus(status) || stage === "scheduled";
  const normalizedStatus = normalizeStatus(status);
  const isFrance =
    country?.toUpperCase() === "FR" ||
    country?.toLowerCase() === "france" ||
    visaType === "EU_SCHENGEN_C_SHORT_STAY";
  const reportedPhaseIdx =
    phaseIndexForStage(stage) ??
    (completeStatus || failedStatus || waitingForUser
      ? PHASES.length - 1
      : normalizeStatus(status) === "processing"
        ? 1
        : 0);
  const reportedPhaseProgress = PHASE_PROGRESS[reportedPhaseIdx] ?? PHASE_PROGRESS[0];
  // DS-160 runs report the CEAC page they reached: show that checkpoint, and
  // creep slowly toward (never past) the next one while the page is filled.
  const isDs160Run = isDs160VisaType(visaType);
  const ds160Checkpoint =
    isDs160Run && normalizedStatus === "running" ? ds160ProgressForStage(queueStage) : null;
  const ds160CreepProgress = useCheckpointCreep(
    ds160Checkpoint?.progress ?? null,
    ds160Checkpoint?.ceiling ?? null,
  );
  const showDs160RunNotes =
    isDs160Run && (normalizedStatus === "running" || normalizedStatus === "queued");
  const visualServerProgress =
    completeStatus
      ? 100
      : ds160Checkpoint && ds160CreepProgress !== null
        ? ds160CreepProgress
        : typeof serverProgress === "number"
          ? Math.max(serverProgress, reportedPhaseProgress)
          : reportedPhaseProgress;
  const {
    displayedProgress,
    isVisuallyComplete,
  } = useSmoothProgress({
    serverProgress: visualServerProgress,
    persistenceKey: persistenceKey?.trim() || undefined,
    progressCycleKey,
    resetPersistedProgressOnMount: resetProgressOnMount,
    status: completeStatus
      ? "completed"
      : failedStatus
        ? "failed"
        : waitingForUser
          ? "needs_user_action"
          : "running",
    intervalMs: 800,
    initialProgress: 0,
    syncToServerProgress: false,
    onVisualComplete,
  });
  const activePhaseIdx = ds160Checkpoint
    ? DS160_PHASE_INDEX[ds160Checkpoint.phase]
    : phaseIndexForProgress(displayedProgress);
  const activePhase = PHASES[activePhaseIdx] ?? PHASES[0];

  useEffect(() => {
    if (!applicationId || !isFrance || officialAccount) return;
    let cancelled = false;
    let timer: number | undefined;
    let inFlight = false;
    let controller: AbortController | null = null;

    const schedule = (delayMs: number) => {
      if (cancelled) return;
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = undefined;
        void loadAccount();
      }, delayMs);
    };

    const loadAccount = async () => {
      if (cancelled || inFlight) return;
      if (document.visibilityState !== "visible") {
        schedule(30_000);
        return;
      }

      inFlight = true;
      const requestController = new AbortController();
      controller = requestController;
      const deadline = window.setTimeout(() => requestController.abort(), 5_000);
      try {
        const response = await fetch(`/api/applications/${applicationId}/france-visas-account`, {
          cache: "no-store",
          signal: requestController.signal,
        });
        const payload = (await response.json().catch(() => null)) as {
          account?: FvOfficialAccount | null;
        } | null;
        if (!cancelled && response.ok) {
          setOfficialAccount(payload?.account ?? null);
        }
      } catch {
        if (!cancelled) {
          setOfficialAccount(null);
        }
      } finally {
        window.clearTimeout(deadline);
        if (controller === requestController) controller = null;
        inFlight = false;
        schedule(10_000);
      }
    };

    const pollWhenVisible = () => {
      if (document.visibilityState === "visible") schedule(0);
    };

    void loadAccount();
    document.addEventListener("visibilitychange", pollWhenVisible);
    return () => {
      cancelled = true;
      controller?.abort();
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", pollWhenVisible);
    };
  }, [applicationId, isFrance, officialAccount]);

  const progressMessage = (() => {
    if (ds160Checkpoint) {
      const label = isZh ? ds160Checkpoint.labelZh : ds160Checkpoint.labelEn;
      if (ds160Checkpoint.phase !== "filling") return isZh ? `${label}。` : `${label}.`;
      return isZh
        ? `正在填写：${label}（第 ${ds160Checkpoint.step}/${ds160Checkpoint.totalSteps} 步）`
        : `Filling: ${label} (step ${ds160Checkpoint.step} of ${ds160Checkpoint.totalSteps})`;
    }
    const localizedError = localizeProgressMessage(error, isZh);
    const localizedMessage = localizeProgressMessage(message, isZh);
    if (failedStatus && localizedError) return localizedError;
    if (normalizeStatus(status) === "stalled") {
      return isZh
        ? "仍在等待检查点或结果，但后台任务最近没有更新。请稍后重试或联系支持。"
        : "Still waiting for a checkpoint or result, but the background worker has not updated recently.";
    }
    if (waitingForUser) {
      return isZh
        ? "流程已暂停，等待您或工作人员完成官网上的必要操作。"
        : "The flow is paused while a required official-portal action is completed.";
    }
    const reportedPhaseMatchesVisual = reportedPhaseIdx === activePhaseIdx;
    if (
      localizedMessage &&
      (!isPacedRuntimeMessage(message) ||
        (reportedPhaseMatchesVisual && (!completeStatus || isVisuallyComplete)))
    ) {
      return localizedMessage;
    }
    if (activePhase.id === "preparing") {
      return isZh
        ? "正在整理并校验官网所需的英文答案。"
        : "Preparing and validating the English answers required by the official portal.";
    }
    if (activePhase.id === "filling") {
      return isZh
        ? "正在填写官网表单。"
        : "Filling the official portal form.";
    }
    return isZh
      ? "正在等待官网检查点或最终结果。"
      : "Waiting for an official-portal checkpoint or the final result.";
  })();

  async function cancelScheduledSubmission() {
    if (!applicationId || cancelingScheduled) return;
    setCancelingScheduled(true);
    setCancelError(null);
    try {
      const response = await fetch(`/api/applications/${applicationId}/cancel-submission`, {
        method: "POST",
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
      if (!response.ok) {
        throw new Error(typeof body?.error === "string" ? body.error : `Cancel failed with ${response.status}`);
      }
      window.location.reload();
    } catch (error) {
      setCancelError(error instanceof Error ? error.message : String(error));
      setCancelingScheduled(false);
    }
  }

  if (scheduledStatus) {
    return (
      <Card className="rounded-xl border-input">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-foreground">
            <Clock3 className="h-5 w-5 text-brand-500" />
            {isZh ? "已排队，等待自动提交" : "Scheduled for automatic submission"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {message ??
              (isZh
                ? "ICA 只接受抵达前 3 天内（含抵达当天）的 SG Arrival Card。系统会在窗口开启后自动提交。"
                : "ICA only accepts SG Arrival Card submissions within three days including the day of arrival. VIZA will submit automatically when that window opens.")}
          </p>
          <SmoothProgressBar
            displayedProgress={0}
            label={isZh ? "等待 ICA 可提交时间" : "Waiting for ICA submission window"}
            ariaLabel={isZh ? "排队进度" : "Scheduled submission progress"}
            size="md"
            transitionMs={760}
            trackClassName="bg-muted"
            valueClassName="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700"
          />
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="w-full border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
              disabled={!applicationId || cancelingScheduled}
              onClick={() => {
                void cancelScheduledSubmission();
              }}
            >
              {cancelingScheduled ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              {isZh ? "取消提交" : "Cancel submission"}
            </Button>
            {cancelError ? <ClientErrorAlert message={cancelError} /> : null}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl border-input">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
          {isZh ? "正在提交您的申请" : "Submitting your application"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {isZh
            ? "VIZA 正在使用英文版答案处理官网填写流程。遇到验证码、人工检查点或结果准备好后，本页面会自动更新。"
            : "VIZA is using your English answers for the official fill flow. This page will update when a CAPTCHA, manual checkpoint, or result is ready."}
        </p>

        <div aria-live="polite" className="space-y-3">
          <SmoothProgressBar
            displayedProgress={displayedProgress}
            label={isZh ? activePhase.labelZh : activePhase.labelEn}
            ariaLabel={isZh ? "提交进度" : "Submission progress"}
            size="md"
            transitionMs={760}
            trackClassName="bg-muted"
            valueClassName="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700"
          />
          <p className="text-xs text-muted-foreground">
            {progressMessage}
          </p>
        </div>

        {showDs160RunNotes ? (
          <div className="space-y-1.5 rounded-lg border border-input bg-muted/30 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            <p className="flex items-start gap-2">
              <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
              <span>
                {ds160Checkpoint
                  ? isZh
                    ? `预计还需约 ${ds160Checkpoint.minutesLeft} 分钟（整个流程通常需要 30–40 分钟）。`
                    : `About ${ds160Checkpoint.minutesLeft} min left (the whole run usually takes 30–40 minutes).`
                  : isZh
                    ? "整个流程通常需要 30–40 分钟。"
                    : "The whole run usually takes 30–40 minutes."}
              </span>
            </p>
            <p className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
              <span>
                {isZh
                  ? "您可以关闭或离开本页面，提交在 VIZA 云端运行，不会被打断。之后回到此页面即可查看最新进度和结果。"
                  : "You can close or leave this page. The submission runs on VIZA's servers and won't be interrupted; come back here any time to see the latest progress and result."}
              </span>
            </p>
          </div>
        ) : null}

        <ol className="grid gap-2 sm:grid-cols-3" aria-label={isZh ? "提交阶段" : "Submission phases"}>
          {PHASES.map((phase, i) => {
            const done = i < activePhaseIdx || (completeStatus && isVisuallyComplete);
            const active = !done && i === activePhaseIdx;
            return (
              <motion.li
                key={phase.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.05 }}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2",
                  done && "border-brand-200 bg-brand-50",
                  active && "border-brand-500 bg-white",
                  !done && !active && "border-input bg-muted/30",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                    done && "border-brand-500 bg-brand-500 text-white",
                    active && "border-brand-500 text-brand-500",
                    !done && !active && "border-input text-muted-foreground",
                  )}
                >
                  {done ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : active ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <span className="text-xs font-medium">{i + 1}</span>
                  )}
                </span>
                <span
                  className={cn(
                    "text-xs",
                    active ? "text-foreground font-medium" : "text-muted-foreground",
                  )}
                >
                  {isZh ? phase.labelZh : phase.labelEn}
                </span>
              </motion.li>
            );
          })}
        </ol>

        {applicationId &&
        supportsOfficialCancel(visaType) &&
        (normalizedStatus === "queued" || normalizedStatus === "running") ? (
          <OfficialCancelButton applicationId={applicationId} isZh={isZh} />
        ) : null}

        {officialAccount?.email && (
          <div className="rounded-lg border border-brand-200 bg-brand-50/60 p-4">
            <div className="text-sm font-semibold text-foreground">
              {isZh ? "France-Visas 官方账号" : "France-Visas official account"}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-brand-100 bg-white px-3 py-2">
                <div className="text-xs text-muted-foreground">{isZh ? "账号" : "Email"}</div>
                <div className="mt-0.5 break-all font-mono text-sm text-foreground">
                  {officialAccount.email}
                </div>
              </div>
              <div className="rounded-md border border-brand-100 bg-white px-3 py-2">
                <div className="text-xs text-muted-foreground">{isZh ? "密码" : "Password"}</div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="break-all font-mono text-sm text-foreground">
                    {showPassword ? officialAccount.password : "••••••••••••"}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
            <Button asChild variant="outline" className="mt-3 bg-white">
              <a href={officialAccount.portalUrl} target="_blank" rel="noopener noreferrer">
                {isZh ? "打开 France-Visas 官网" : "Open France-Visas"}
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** URL hash that asks the page to bring the submission progress into view. */
export const SUBMISSION_PROGRESS_HASH = "submission-progress";

/**
 * WaitingCard with a scroll anchor: when the page is opened with
 * `#submission-progress` (for example right after a resubmit), the progress
 * card scrolls into view instead of leaving the applicant at the top of the
 * form.
 */
export function WaitingCard(props: ComponentProps<typeof WaitingCardBody>) {
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.location.hash !== `#${SUBMISSION_PROGRESS_HASH}`) return;
    const frame = window.requestAnimationFrame(() => {
      anchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <div ref={anchorRef} id={SUBMISSION_PROGRESS_HASH} className="scroll-mt-24">
      <WaitingCardBody {...props} />
    </div>
  );
}

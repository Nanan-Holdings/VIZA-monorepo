"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { CircleNotch as Loader2, Clock as Clock3, Eye, EyeSlash as EyeOff, ArrowSquareOut as ExternalLink, XCircle } from "@phosphor-icons/react";
import { SmoothProgressBar } from "@/components/smooth-progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClientErrorAlert } from "@/components/client/client-error-alert";
import { useSmoothProgress } from "@/hooks/use-smooth-progress";
import { isChineseLocale } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";
import type { SubmissionResultStatus } from "@/lib/submission-result";

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
}

interface SubmissionActivity {
  en: string;
  zh: string;
}

type FvOfficialAccount = {
  email: string | null;
  password: string | null;
  portalUrl: string;
  updatedAt: string | null;
};

const PHASES: Phase[] = [
  { id: "preparing" },
  { id: "filling" },
  { id: "confirming" },
];

const PHASE_PROGRESS = [34, 67, 99] as const;

const PREPARING_ACTIVITIES: SubmissionActivity[] = [
  { en: "Checking your application answers", zh: "正在核对申请答案" },
  { en: "Preparing details for the official form", zh: "正在准备官网填写信息" },
];

const FORM_FILLING_ACTIVITIES: SubmissionActivity[] = [
  { en: "Filling your full name", zh: "正在填写姓名" },
  { en: "Filling your date of birth", zh: "正在填写出生日期" },
  { en: "Filling your travel document details", zh: "正在填写旅行证件信息" },
  { en: "Filling your email address", zh: "正在填写电子邮箱" },
  { en: "Filling your trip details", zh: "正在填写行程信息" },
  { en: "Completing the official declaration", zh: "正在填写官网声明" },
];

const CONFIRMING_ACTIVITIES: SubmissionActivity[] = [
  { en: "Reviewing the official form", zh: "正在核对官网表单" },
  { en: "Checking the official portal", zh: "正在检查官网状态" },
  { en: "Confirming your application result", zh: "正在确认申请结果" },
];

function phaseIndexForProgress(progress: number): number {
  if (progress <= PHASE_PROGRESS[0]) return 0;
  if (progress <= PHASE_PROGRESS[1]) return 1;
  return 2;
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
    payment_authorized: "官方付款已授权，正在等待云端任务继续。",
    official_fee_payment_processing: "正在处理官网费用付款。",
    official_fee_payment_required: "正在等待官网费用付款授权。",
    payment_page_visible: "已到达官网付款页面，正在准备付款。",
    bank_authentication_waiting: "正在等待银行验证结果。",
    registration_code_captured: "已取得官网登记编号，正在确认最终结果。",
    preparing_managed_alias: "正在准备本次申请使用的专属邮箱。",
    managed_account_required: "正在准备官网托管账号。",
    captcha_required: "正在等待完成官网验证码。",
    otp_required: "正在等待完成一次性验证码验证。",
    email_verification_pending: "正在等待完成官网邮箱验证。",
    payment_processing: "正在处理官网付款。",
    payment_confirming: "正在确认官网付款结果。",
    confirmation_pending: "正在等待官网返回最终确认。",
    completed: "官网流程已完成。",
  };
  const exact = exactMessages[normalized];
  if (exact) return exact;
  if (/payment|fee|bank|3ds/.test(normalized)) return "正在处理官网付款或银行验证。";
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
  if (/approve the payment in your sc mobile banking app/i.test(message)) {
    return isZh
      ? "请立即在渣打 SC Mobile Banking App 中批准本次付款。云端浏览器会保持 3DS 会话，并在授权后自动继续。"
      : message;
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

/**
 * WaitingCard — renders while applications.submission_result_status is
 * `waiting` or `processing`. Phase progresses on a soft timer; the realtime
 * subscription on `applications` will cut the user over to a result card
 * the moment the runner writes the terminal payload.
 */
export function WaitingCard({
  status,
  stage,
  serverProgress,
  message,
  applicationId,
  persistenceKey,
  progressCycleKey,
  resetProgressOnMount,
  country,
  visaType,
  embedded = false,
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
  /** Lets the application review screen provide the enclosing section heading. */
  embedded?: boolean;
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
  const visualServerProgress =
    completeStatus
      ? 100
      : typeof serverProgress === "number"
        ? Math.max(serverProgress, reportedPhaseProgress)
        : reportedPhaseProgress;
  const {
    displayedProgress,
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
  const activePhaseIdx = phaseIndexForProgress(displayedProgress);
  const activePhase = PHASES[activePhaseIdx] ?? PHASES[0];
  const activities =
    activePhase.id === "preparing"
      ? PREPARING_ACTIVITIES
      : activePhase.id === "filling"
        ? FORM_FILLING_ACTIVITIES
        : CONFIRMING_ACTIVITIES;
  const [activityIndex, setActivityIndex] = useState(0);
  useEffect(() => {
    setActivityIndex(0);
    if (completeStatus || failedStatus || waitingForUser) return;
    const interval = window.setInterval(() => {
      setActivityIndex((current) => (current + 1) % activities.length);
    }, 2_400);
    return () => window.clearInterval(interval);
  }, [activities.length, activePhase.id, completeStatus, failedStatus, waitingForUser]);
  const activity = activities[activityIndex % activities.length] ?? activities[0];

  useEffect(() => {
    if (!applicationId || !isFrance || officialAccount) return;
    let cancelled = false;
    let timer: number | undefined;
    let controller: AbortController | null = null;

    const schedule = (delayMs: number) => {
      if (cancelled) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => void loadAccount(), delayMs);
    };

    const loadAccount = async () => {
      if (cancelled) return;
      if (document.visibilityState !== "visible") {
        schedule(30_000);
        return;
      }

      controller = new AbortController();
      const deadline = window.setTimeout(() => controller?.abort(), 5_000);
      try {
        const response = await fetch(`/api/applications/${applicationId}/france-visas-account`, {
          cache: "no-store",
          signal: controller.signal,
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
        controller = null;
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
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", pollWhenVisible);
    };
  }, [applicationId, isFrance, officialAccount]);

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
      <Card className={cn("rounded-xl border-input", embedded && "border-0 bg-transparent shadow-none")}>
        {!embedded ? (
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-foreground">
              <Clock3 className="h-5 w-5 text-brand-500" />
              {isZh ? "已排队，等待自动提交" : "Scheduled for automatic submission"}
            </CardTitle>
          </CardHeader>
        ) : null}
        <CardContent className={cn("space-y-5", embedded && "p-0")}>
          {embedded ? (
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Clock3 className="h-4 w-4 text-brand-500" />
              {isZh ? "已排队，等待自动提交" : "Scheduled for automatic submission"}
            </div>
          ) : null}
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
    <Card className={cn("rounded-xl border-input", embedded && "border-0 bg-transparent shadow-none")}>
      {!embedded ? (
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
            {isZh ? "正在提交您的申请" : "Submitting your application"}
          </CardTitle>
        </CardHeader>
      ) : null}
      <CardContent className={cn("space-y-5", embedded && "p-0")}>
        <div aria-live="polite" className="space-y-2">
          <SmoothProgressBar
            displayedProgress={displayedProgress}
            label={isZh ? activity.zh : activity.en}
            ariaLabel={isZh ? "提交进度" : "Submission progress"}
            size="md"
            transitionMs={760}
            labelClassName="text-sm font-normal text-muted-foreground"
            trackClassName="bg-brand-50"
            barClassName="bg-brand-500"
            valueClassName="font-medium text-brand-600"
          />
        </div>

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

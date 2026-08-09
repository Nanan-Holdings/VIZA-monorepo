"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { motion } from "motion/react";
import { Loader2, CheckCircle2, Clock3, Eye, EyeOff, ExternalLink, XCircle } from "lucide-react";
import { SmoothProgressBar } from "@/components/smooth-progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

function normalizeStatus(status: SubmissionVisualStatus | null | undefined): string {
  return (status ?? "").trim().toLowerCase();
}

function isCompletionStatus(status: SubmissionVisualStatus | null | undefined): boolean {
  return [
    "completed",
    "submitted",
    "submitted_mock",
    "form_ready_for_agency",
  ].includes(normalizeStatus(status));
}

function isFailedStatus(status: SubmissionVisualStatus | null | undefined): boolean {
  return normalizeStatus(status) === "failed";
}

function isWaitingForUserStatus(status: SubmissionVisualStatus | null | undefined): boolean {
  return ["needs_user_action", "action_required"].includes(normalizeStatus(status));
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
  error,
  applicationId,
  country,
  visaType,
  onVisualComplete,
}: {
  status: SubmissionVisualStatus | null;
  stage?: SubmissionVisualStage | null;
  serverProgress?: number | null;
  message?: string | null;
  error?: string | null;
  applicationId?: string | null;
  country?: string | null;
  visaType?: string | null;
  onVisualComplete?: () => void;
}) {
  const locale = useLocale();
  const isZh = isChineseLocale(locale);
  const [activePhaseIdx, setActivePhaseIdx] = useState(0);
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
  const visualServerProgress =
    typeof serverProgress === "number"
      ? serverProgress
      : completeStatus
        ? 100
        : PHASE_PROGRESS[activePhaseIdx] ?? PHASE_PROGRESS[0];
  const {
    displayedProgress,
    isVisuallyComplete,
  } = useSmoothProgress({
    serverProgress: visualServerProgress,
    persistenceKey: applicationId ? `submission:${applicationId}` : undefined,
    status: completeStatus
      ? "completed"
      : failedStatus
        ? "failed"
        : waitingForUser
          ? "needs_user_action"
          : "running",
    intervalMs: 800,
    initialProgress: 0,
    onVisualComplete,
  });
  const activePhase = PHASES[activePhaseIdx] ?? PHASES[0];

  useEffect(() => {
    const stagePhaseIndex = phaseIndexForStage(stage);
    if (stagePhaseIndex !== null) {
      setActivePhaseIdx((current) => Math.max(current, stagePhaseIndex));
    } else if (scheduledStatus) {
      setActivePhaseIdx((current) => Math.max(current, 0));
    } else if (completeStatus || failedStatus || waitingForUser) {
      setActivePhaseIdx((current) => Math.max(current, PHASES.length - 1));
    } else if (status === "processing") {
      setActivePhaseIdx((current) => Math.max(current, 1));
    } else if (status === "waiting") {
      setActivePhaseIdx((current) => Math.max(current, 0));
    }
  }, [completeStatus, failedStatus, scheduledStatus, stage, status, waitingForUser]);

  // Soft auto-advance only when no backend stage/progress has arrived yet.
  useEffect(() => {
    if (stage || typeof serverProgress === "number") return;
    if (completeStatus || failedStatus || waitingForUser || scheduledStatus) return;
    if (activePhaseIdx >= PHASES.length - 1) return;
    const id = setTimeout(() => setActivePhaseIdx((i) => Math.min(i + 1, PHASES.length - 1)), 12_000);
    return () => clearTimeout(id);
  }, [activePhaseIdx, completeStatus, failedStatus, scheduledStatus, serverProgress, stage, waitingForUser]);

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

  const progressMessage = (() => {
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
    if (localizedMessage) return localizedMessage;
    if (activePhase.id === "confirming" && !isVisuallyComplete) {
      return isZh
        ? "仍在等待检查点或结果，请稍候。"
        : "Still waiting for a checkpoint or result. Please wait.";
    }
    return isZh
      ? "该进度会随后台状态自动推进；如果需要你本人操作，会切换到检查点提示。"
      : "This progress updates with the background worker. If your action is needed, this card will switch to a checkpoint prompt.";
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
            {cancelError ? <p className="text-sm text-red-700">{cancelError}</p> : null}
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

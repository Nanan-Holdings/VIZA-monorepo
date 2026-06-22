"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { motion } from "motion/react";
import { Loader2, CheckCircle2, Clock3, Eye, EyeOff, ExternalLink } from "lucide-react";
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
      setActivePhaseIdx(stagePhaseIndex);
    } else if (scheduledStatus) {
      setActivePhaseIdx(0);
    } else if (completeStatus || failedStatus || waitingForUser) {
      setActivePhaseIdx(PHASES.length - 1);
    } else if (status === "processing") {
      setActivePhaseIdx(1);
    } else if (status === "waiting") {
      setActivePhaseIdx(0);
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
    if (!applicationId || !isFrance) return;
    let cancelled = false;

    const loadAccount = async () => {
      const response = await fetch(`/api/applications/${applicationId}/france-visas-account`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as {
        account?: FvOfficialAccount | null;
      } | null;
      if (!cancelled && response.ok) {
        setOfficialAccount(payload?.account ?? null);
      }
    };

    void loadAccount();
    const timer = window.setInterval(loadAccount, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [applicationId, isFrance]);

  const progressMessage = (() => {
    if (failedStatus && error) return error;
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
    if (message) return message;
    if (activePhase.id === "confirming" && !isVisuallyComplete) {
      return isZh
        ? "仍在等待检查点或结果，请稍候。"
        : "Still waiting for a checkpoint or result. Please wait.";
    }
    return isZh
      ? "该进度会随后台状态自动推进；如果需要你本人操作，会切换到检查点提示。"
      : "This progress updates with the background worker. If your action is needed, this card will switch to a checkpoint prompt.";
  })();

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

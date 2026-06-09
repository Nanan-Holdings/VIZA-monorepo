"use client";

import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Loader2, PauseCircle, XCircle } from "lucide-react";
import {
  useSmoothProgress,
  type SmoothProgressStatus,
  type UseSmoothProgressOptions,
} from "@/hooks/use-smooth-progress";
import { cn } from "@/lib/utils";

type ProgressTone = "default" | "success" | "warning" | "error" | "waiting";
type ProgressSize = "xs" | "sm" | "md";

export interface SmoothProgressBarProps {
  displayedProgress: number;
  label?: ReactNode;
  ariaLabel?: string;
  showValue?: boolean;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
  trackClassName?: string;
  barClassName?: string;
  transitionMs?: number;
  size?: ProgressSize;
}

export interface SmoothProgressMeterProps
  extends Omit<SmoothProgressBarProps, "displayedProgress">,
    UseSmoothProgressOptions {}

export interface TaskProgressStep {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  status: "completed" | "active" | "waiting" | "failed" | "needs_user_action";
}

export interface SmoothProgressCardProps extends SmoothProgressBarProps {
  title: ReactNode;
  message?: ReactNode;
  stage?: ReactNode;
  steps?: TaskProgressStep[];
  tone?: ProgressTone;
  error?: ReactNode;
  actionRequiredMessage?: ReactNode;
  icon?: ReactNode;
}

const SIZE_CLASSES: Record<ProgressSize, string> = {
  xs: "h-1.5",
  sm: "h-2",
  md: "h-2.5",
};

const TONE_BAR_CLASSES: Record<ProgressTone, string> = {
  default: "bg-brand-500",
  success: "bg-emerald-600",
  warning: "bg-amber-500",
  error: "bg-destructive",
  waiting: "bg-amber-500",
};

function clampDisplayProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function SmoothProgressBar({
  displayedProgress,
  label,
  ariaLabel,
  showValue = true,
  className,
  labelClassName,
  valueClassName,
  trackClassName,
  barClassName,
  transitionMs = 0,
  size = "sm",
}: SmoothProgressBarProps) {
  const progress = clampDisplayProgress(displayedProgress);
  const transitionDuration = Math.max(0, Math.round(transitionMs));

  return (
    <div className={cn("space-y-2", className)}>
      {label || showValue ? (
        <div className={cn("flex items-center justify-between gap-3 text-xs font-semibold text-[#526174]", labelClassName)}>
          <span className="min-w-0 truncate">{label}</span>
          {showValue ? (
            <span className={cn("shrink-0 tabular-nums", valueClassName)}>
              {progress}%
            </span>
          ) : null}
        </div>
      ) : null}
      <div
        aria-label={ariaLabel}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={progress}
        className={cn("overflow-hidden rounded-full bg-[#eef3fa]", SIZE_CLASSES[size], trackClassName)}
        role="progressbar"
      >
        <div
          className={cn("h-full origin-left rounded-full will-change-transform", barClassName ?? TONE_BAR_CLASSES.default)}
          style={{
            transform: `scaleX(${progress / 100})`,
            transition: transitionDuration > 0 ? `transform ${transitionDuration}ms linear` : "none",
          }}
        />
      </div>
    </div>
  );
}

export function SmoothProgressMeter({
  serverProgress,
  status,
  isComplete,
  isFailed,
  isWaitingForUser,
  intervalMs,
  minInterval,
  step,
  maxBeforeComplete,
  initialProgress,
  onVisualComplete,
  transitionMs,
  ...barProps
}: SmoothProgressMeterProps) {
  const { displayedProgress } = useSmoothProgress({
    serverProgress,
    status,
    isComplete,
    isFailed,
    isWaitingForUser,
    intervalMs,
    minInterval,
    step,
    maxBeforeComplete,
    initialProgress,
    onVisualComplete,
  });

  return (
    <SmoothProgressBar
      displayedProgress={displayedProgress}
      transitionMs={transitionMs ?? 760}
      {...barProps}
    />
  );
}

function getStepIcon(status: TaskProgressStep["status"]) {
  if (status === "completed") return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (status === "active") return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
  if (status === "failed") return <XCircle className="h-3.5 w-3.5" />;
  if (status === "needs_user_action") return <PauseCircle className="h-3.5 w-3.5" />;
  return null;
}

export function SmoothProgressCard({
  title,
  message,
  stage,
  steps,
  tone = "default",
  error,
  actionRequiredMessage,
  icon,
  displayedProgress,
  barClassName,
  ...barProps
}: SmoothProgressCardProps) {
  const resolvedTone: ProgressTone = error ? "error" : actionRequiredMessage ? "waiting" : tone;
  const HeaderIcon =
    icon ??
    (error ? (
      <XCircle className="h-5 w-5 text-destructive" />
    ) : actionRequiredMessage ? (
      <AlertTriangle className="h-5 w-5 text-amber-700" />
    ) : displayedProgress >= 100 ? (
      <CheckCircle2 className="h-5 w-5 text-emerald-700" />
    ) : (
      <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
    ));

  return (
    <section className="rounded-xl border border-input bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50">
          {HeaderIcon}
        </span>
        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <h3 className="font-heading text-lg font-medium text-foreground">{title}</h3>
            {message ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{message}</p> : null}
            {error ? <p className="mt-2 text-sm font-medium text-destructive">{error}</p> : null}
            {actionRequiredMessage ? (
              <p className="mt-2 text-sm font-medium text-amber-800">{actionRequiredMessage}</p>
            ) : null}
          </div>

          <SmoothProgressBar
            displayedProgress={displayedProgress}
            label={stage}
            barClassName={barClassName ?? TONE_BAR_CLASSES[resolvedTone]}
            {...barProps}
          />

          {steps?.length ? (
            <ol className="grid gap-2 sm:grid-cols-3">
              {steps.map((step) => (
                <li key={step.id} className="flex items-start gap-2 rounded-lg border border-input bg-muted/20 px-3 py-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-white text-brand-500">
                    {getStepIcon(step.status)}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-foreground">{step.label}</span>
                    {step.description ? (
                      <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">
                        {step.description}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export type { SmoothProgressStatus };

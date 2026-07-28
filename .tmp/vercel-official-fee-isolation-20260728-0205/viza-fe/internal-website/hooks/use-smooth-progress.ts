"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type SmoothProgressStatus =
  | "queued"
  | "running"
  | "processing"
  | "needs_user_action"
  | "waiting_for_user"
  | "captcha_required"
  | "payment_required"
  | "completed"
  | "success"
  | "failed"
  | "error"
  | string;

export interface UseSmoothProgressOptions {
  serverProgress?: number;
  status?: SmoothProgressStatus | null;
  isComplete?: boolean;
  isFailed?: boolean;
  isWaitingForUser?: boolean;
  intervalMs?: number;
  minInterval?: number;
  step?: number;
  maxBeforeComplete?: number;
  initialProgress?: number;
  onVisualComplete?: () => void;
}

const COMPLETE_STATUSES = new Set(["completed", "success"]);
const FAILED_STATUSES = new Set(["failed", "error"]);
const WAITING_FOR_USER_STATUSES = new Set([
  "needs_user_action",
  "waiting_for_user",
  "captcha_required",
  "payment_required",
]);

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function useSmoothProgress({
  serverProgress = 0,
  status = "running",
  isComplete: explicitComplete,
  isFailed: explicitFailed,
  isWaitingForUser: explicitWaitingForUser,
  intervalMs,
  minInterval,
  step = 1,
  maxBeforeComplete = 99,
  initialProgress = 0,
  onVisualComplete,
}: UseSmoothProgressOptions) {
  const normalizedStatus = (status ?? "running").trim().toLowerCase();
  const [displayedProgress, setDisplayedProgress] = useState(() => clampProgress(initialProgress));
  const visualCompleteNotifiedRef = useRef(false);

  const isComplete = explicitComplete ?? COMPLETE_STATUSES.has(normalizedStatus);
  const isFailed = explicitFailed ?? FAILED_STATUSES.has(normalizedStatus);
  const isWaitingForUser =
    explicitWaitingForUser ?? WAITING_FOR_USER_STATUSES.has(normalizedStatus);
  const safeStep = Math.max(1, Math.round(step));
  const safeIntervalMs = Math.max(16, Math.round(intervalMs ?? minInterval ?? 800));
  const safeMaxBeforeComplete = Math.max(0, Math.min(99, Math.round(maxBeforeComplete)));

  const visualTarget = useMemo(() => {
    const safeServerProgress = clampProgress(serverProgress);
    if (isComplete) return 100;

    return Math.min(
      Math.max(safeServerProgress, displayedProgress),
      safeMaxBeforeComplete,
    );
  }, [displayedProgress, isComplete, safeMaxBeforeComplete, serverProgress]);

  useEffect(() => {
    if (!isComplete) {
      visualCompleteNotifiedRef.current = false;
    }
  }, [isComplete]);

  useEffect(() => {
    if (isFailed || isWaitingForUser || displayedProgress >= visualTarget) return;

    const timer = window.setInterval(() => {
      setDisplayedProgress((current) => {
        if (current >= visualTarget) return current;
        return Math.min(current + safeStep, visualTarget);
      });
    }, safeIntervalMs);

    return () => window.clearInterval(timer);
  }, [
    displayedProgress,
    isFailed,
    isWaitingForUser,
    safeIntervalMs,
    safeStep,
    visualTarget,
  ]);

  useEffect(() => {
    if (!isComplete || displayedProgress < 100 || visualCompleteNotifiedRef.current) return;
    visualCompleteNotifiedRef.current = true;
    onVisualComplete?.();
  }, [displayedProgress, isComplete, onVisualComplete]);

  return {
    displayedProgress,
    isVisuallyComplete: isComplete && displayedProgress >= 100,
    isComplete,
    isFailed,
    isWaitingForUser,
  };
}

"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

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
  persistenceKey?: string;
  progressCycleKey?: string | null;
  status?: SmoothProgressStatus | null;
  isComplete?: boolean;
  isFailed?: boolean;
  isWaitingForUser?: boolean;
  intervalMs?: number;
  minInterval?: number;
  step?: number;
  maxBeforeComplete?: number;
  initialProgress?: number;
  syncToServerProgress?: boolean;
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

const persistedProgress = new Map<string, number>();
const MAX_PERSISTED_PROGRESS_ENTRIES = 50;
const SESSION_STORAGE_PREFIX = "viza:smooth-progress:";

const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function readPersistedProgress(key: string): number {
  const memoryValue = persistedProgress.get(key) ?? 0;
  if (typeof window === "undefined") return memoryValue;
  try {
    const storedValue = Number(window.sessionStorage.getItem(`${SESSION_STORAGE_PREFIX}${key}`));
    return Math.max(memoryValue, clampProgress(storedValue));
  } catch {
    return memoryValue;
  }
}

function persistProgress(key: string, value: number): void {
  const nextValue = Math.max(persistedProgress.get(key) ?? 0, clampProgress(value));
  persistedProgress.set(key, nextValue);
  if (persistedProgress.size > MAX_PERSISTED_PROGRESS_ENTRIES) {
    const oldestKey = persistedProgress.keys().next().value;
    if (typeof oldestKey === "string") persistedProgress.delete(oldestKey);
  }
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(`${SESSION_STORAGE_PREFIX}${key}`, String(nextValue));
  } catch {
    // Some privacy modes disable sessionStorage. The in-memory high-water mark
    // still protects ordinary React remounts in that case.
  }
}

export function useSmoothProgress({
  serverProgress = 0,
  persistenceKey,
  progressCycleKey,
  status = "running",
  isComplete: explicitComplete,
  isFailed: explicitFailed,
  isWaitingForUser: explicitWaitingForUser,
  intervalMs,
  minInterval,
  step = 1,
  maxBeforeComplete = 99,
  initialProgress = 0,
  syncToServerProgress = false,
  onVisualComplete,
}: UseSmoothProgressOptions) {
  const normalizedStatus = (status ?? "running").trim().toLowerCase();
  const normalizedPersistenceKey = persistenceKey?.trim() || null;
  const normalizedProgressCycleKey = progressCycleKey?.trim() || null;
  const [displayedProgress, setDisplayedProgress] = useState(() => {
    const persisted = normalizedPersistenceKey
      ? persistedProgress.get(normalizedPersistenceKey) ?? 0
      : 0;
    return Math.max(clampProgress(initialProgress), persisted);
  });
  const displayedProgressRef = useRef(displayedProgress);
  const progressCycleKeyRef = useRef(normalizedProgressCycleKey);
  const pendingCycleResetProgressRef = useRef<number | null>(null);
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
  const canAdvance = !isFailed && !isWaitingForUser && displayedProgress < visualTarget;

  useEffect(() => {
    if (!isComplete) {
      visualCompleteNotifiedRef.current = false;
    }
  }, [isComplete]);

  useBrowserLayoutEffect(() => {
    const persisted = normalizedPersistenceKey
      ? readPersistedProgress(normalizedPersistenceKey)
      : 0;
    const authoritativeFloor = syncToServerProgress
      ? isComplete
        ? 100
        : Math.min(clampProgress(serverProgress), safeMaxBeforeComplete)
      : 0;

    const previousCycleKey = progressCycleKeyRef.current;
    const cycleChanged = Boolean(
      previousCycleKey &&
        normalizedProgressCycleKey &&
        previousCycleKey !== normalizedProgressCycleKey,
    );

    const resetProgress = Math.max(persisted, authoritativeFloor);
    if (cycleChanged) {
      pendingCycleResetProgressRef.current = resetProgress;
    }
    setDisplayedProgress((current) =>
      cycleChanged ? resetProgress : Math.max(current, persisted, authoritativeFloor),
    );
    if (normalizedProgressCycleKey) {
      progressCycleKeyRef.current = normalizedProgressCycleKey;
    }
  }, [
    isComplete,
    normalizedPersistenceKey,
    normalizedProgressCycleKey,
    safeMaxBeforeComplete,
    serverProgress,
    syncToServerProgress,
  ]);

  useEffect(() => {
    if (!normalizedPersistenceKey) return;
    const pendingResetProgress = pendingCycleResetProgressRef.current;
    if (pendingResetProgress !== null) {
      if (displayedProgress !== pendingResetProgress) return;
      pendingCycleResetProgressRef.current = null;
    }
    persistProgress(normalizedPersistenceKey, displayedProgress);
  }, [displayedProgress, normalizedPersistenceKey]);

  useBrowserLayoutEffect(() => {
    displayedProgressRef.current = displayedProgress;
  }, [displayedProgress]);

  useEffect(() => {
    if (!canAdvance) return;

    const timer = window.setInterval(() => {
      setDisplayedProgress((current) => {
        if (current >= visualTarget) {
          window.clearInterval(timer);
          return current;
        }
        const next = Math.min(current + safeStep, visualTarget);
        if (next >= visualTarget) window.clearInterval(timer);
        return next;
      });
    }, safeIntervalMs);

    return () => window.clearInterval(timer);
  }, [
    canAdvance,
    normalizedProgressCycleKey,
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

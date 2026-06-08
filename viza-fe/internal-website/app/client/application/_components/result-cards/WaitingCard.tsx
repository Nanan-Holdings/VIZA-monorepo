"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { motion } from "motion/react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isChineseLocale } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";
import type { SubmissionResultStatus } from "@/lib/submission-result";

interface Phase {
  id: "preparing" | "filling" | "confirming";
  labelEn: string;
  labelZh: string;
}

const PHASES: Phase[] = [
  {
    id: "preparing",
    labelEn: "Preparing English answers",
    labelZh: "正在整理英文版答案",
  },
  {
    id: "filling",
    labelEn: "Filling the government form",
    labelZh: "正在填写政府表单",
  },
  {
    id: "confirming",
    labelEn: "Confirming submission",
    labelZh: "正在确认提交结果",
  },
];

const PHASE_PROGRESS = [34, 67, 92] as const;

/**
 * WaitingCard — renders while applications.submission_result_status is
 * `waiting` or `processing`. Phase progresses on a soft timer; the realtime
 * subscription on `applications` will cut the user over to a result card
 * the moment the runner writes the terminal payload.
 */
export function WaitingCard({ status }: { status: SubmissionResultStatus | null }) {
  const locale = useLocale();
  const isZh = isChineseLocale(locale);
  const [activePhaseIdx, setActivePhaseIdx] = useState(0);
  const progressPercent = PHASE_PROGRESS[activePhaseIdx] ?? PHASE_PROGRESS[0];
  const activePhase = PHASES[activePhaseIdx] ?? PHASES[0];

  useEffect(() => {
    if (status === "processing") {
      setActivePhaseIdx(1);
    } else if (status === "waiting") {
      setActivePhaseIdx(0);
    }
  }, [status]);

  // Soft auto-advance so the UI doesn't feel frozen if status updates lag.
  useEffect(() => {
    if (activePhaseIdx >= PHASES.length - 1) return;
    const id = setTimeout(() => setActivePhaseIdx((i) => Math.min(i + 1, PHASES.length - 1)), 12_000);
    return () => clearTimeout(id);
  }, [activePhaseIdx]);

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
            ? "VIZA 正在代表您处理政府门户的提交流程。确认结果准备好后，本页面会自动更新。"
            : "We're working with the government portal on your behalf. This page will update automatically when your confirmation is ready."}
        </p>

        <div aria-live="polite" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">
              {isZh ? activePhase.labelZh : activePhase.labelEn}
            </p>
            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
              {progressPercent}%
            </span>
          </div>
          <div
            aria-label={isZh ? "提交进度" : "Submission progress"}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={progressPercent}
            className="h-2.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
          >
            <motion.div
              animate={{ width: `${progressPercent}%` }}
              className="h-full rounded-full bg-brand-500"
              initial={false}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {isZh
              ? "该进度会随后台状态自动推进，确认码或结果生成后会切换到结果页面。"
              : "This progress updates with the background worker. When the confirmation or result is ready, this card will switch to the result page."}
          </p>
        </div>

        <ol className="grid gap-2 sm:grid-cols-3" aria-label={isZh ? "提交阶段" : "Submission phases"}>
          {PHASES.map((phase, i) => {
            const done = i < activePhaseIdx;
            const active = i === activePhaseIdx;
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
      </CardContent>
    </Card>
  );
}

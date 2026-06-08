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
  id: "translating" | "filling" | "confirming";
  labelEn: string;
  labelZh: string;
}

const PHASES: Phase[] = [
  {
    id: "translating",
    labelEn: "Translating your answers",
    labelZh: "正在翻译您的答案",
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
      <CardContent>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {isZh
            ? "VIZA 正在代表您处理政府门户的提交流程。确认结果准备好后，本页面会自动更新。"
            : "We're working with the government portal on your behalf. This page will update automatically when your confirmation is ready."}
        </p>

        <ol className="mt-6 space-y-3" aria-live="polite">
          {PHASES.map((phase, i) => {
            const done = i < activePhaseIdx;
            const active = i === activePhaseIdx;
            return (
              <motion.li
                key={phase.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.05 }}
                className="flex items-center gap-3"
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                    done && "border-brand-500 bg-brand-500 text-white",
                    active && "border-brand-500 text-brand-500",
                    !done && !active && "border-input text-muted-foreground",
                  )}
                >
                  {done ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : active ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <span className="text-xs font-medium">{i + 1}</span>
                  )}
                </span>
                <span
                  className={cn(
                    "text-sm",
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

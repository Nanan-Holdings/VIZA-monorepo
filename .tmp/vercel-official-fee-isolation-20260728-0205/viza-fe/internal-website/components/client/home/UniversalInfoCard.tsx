"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Database, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { SmoothProgressBar } from "@/components/smooth-progress";

interface Props {
  completedCount: number;
  totalCount: number;
}

export function UniversalInfoCard({ completedCount, totalCount }: Props) {
  const t = useTranslations("home.universalInfo");
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <motion.div
      className="basis-0 grow"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.5 }}
    >
      <Link
        href="/client/universal-info"
        className="backdrop-blur-md bg-[rgba(255,255,255,0.12)] flex h-[240px] w-full flex-col justify-between rounded-[12px] p-[24px] relative transition-colors hover:bg-[rgba(255,255,255,0.18)]"
      >
        <div className="absolute border border-[rgba(255,255,255,0.2)] inset-0 pointer-events-none rounded-[12px]" />
        <div className="relative flex w-full items-start justify-between gap-4">
          <div>
            <p className="font-heading font-medium leading-[1.3] text-[20px] text-white tracking-[-0.6px]">
              {t("title")}
            </p>
            <p className="mt-1 text-[12px] leading-5 text-[rgba(255,255,255,0.58)]">
              {t("subtitle")}
            </p>
          </div>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white">
            <Database className="h-4 w-4" />
          </span>
        </div>

        <div className="relative w-full space-y-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[18px] font-medium leading-tight text-white">
                {t("saved", { completed: completedCount, total: totalCount })}
              </p>
              <p className="mt-0.5 text-[13px] text-[rgba(255,255,255,0.62)]">
                {t("fields")}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <SmoothProgressBar
              displayedProgress={percent}
              showValue={false}
              trackClassName="bg-white/20"
              barClassName="bg-white"
              size="xs"
            />
            <span className="inline-flex items-center gap-1 text-[14px] font-semibold text-white">
              {t("edit")}
              <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

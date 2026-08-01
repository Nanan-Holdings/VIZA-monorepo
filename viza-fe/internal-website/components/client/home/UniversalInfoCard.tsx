"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { SmoothProgressBar } from "@/components/smooth-progress";

interface Props {
  completedCount: number;
  totalCount: number;
}

export function UniversalInfoCard({ completedCount, totalCount }: Props) {
  const t = useTranslations("home.universalInfo");
  const percent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <motion.div
      className="basis-0 grow"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.5 }}
    >
      <Link
        href="/client/universal-info"
        className="relative flex h-[240px] w-full flex-col justify-between rounded-[12px] border border-white/20 bg-white/12 p-6 backdrop-blur-md transition-colors hover:bg-white/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
      >
        <div>
          <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-white/60">
            {t("title")}
          </p>
          <p className="mt-4 font-heading text-[22px] font-medium leading-[1.2] tracking-[-0.66px] text-white">
            {t("saved", { completed: completedCount, total: totalCount })}
          </p>
          <p className="mt-2 max-w-[260px] text-[13px] leading-5 text-white/60">
            {t("subtitle")}
          </p>
        </div>

        <div className="w-full space-y-3">
          <div className="space-y-3">
            <SmoothProgressBar
              displayedProgress={percent}
              showValue={false}
              trackClassName="bg-white/20"
              barClassName="bg-white"
              size="xs"
            />
            <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-white">
              {t("edit")}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

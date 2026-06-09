"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { SmoothProgressBar } from "@/components/smooth-progress";

interface Props {
  uploadedCount: number;
  totalRequired: number;
}

export function DocumentProgressCard({ uploadedCount, totalRequired }: Props) {
  const t = useTranslations("home");
  const pct = Math.round((uploadedCount / totalRequired) * 100);

  return (
    <motion.div
      className="basis-0 grow"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.5 }}
    >
      <div className="backdrop-blur-md bg-[rgba(255,255,255,0.12)] flex flex-col justify-between items-start p-[24px] relative rounded-[12px] w-full h-[240px]">
        <div className="absolute border border-[rgba(255,255,255,0.2)] inset-0 pointer-events-none rounded-[12px]" />
        <p className="font-heading font-medium leading-[1.3] text-[20px] text-white tracking-[-0.6px]">{t("documentsTitle")}</p>
        <div className="w-full space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="font-heading font-normal text-[48px] leading-none text-white">{uploadedCount}</span>
            <span className="text-[rgba(255,255,255,0.55)] text-[14px]">{t("ofRequired", { total: totalRequired })}</span>
          </div>
          <SmoothProgressBar
            displayedProgress={pct}
            labelClassName="text-[rgba(255,255,255,0.55)] text-[13px]"
            valueClassName="text-[rgba(255,255,255,0.55)] text-[13px]"
            trackClassName="bg-[rgba(255,255,255,0.2)]"
            barClassName="bg-white"
          />
        </div>
      </div>
    </motion.div>
  );
}

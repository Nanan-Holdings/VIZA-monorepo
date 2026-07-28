"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { PlusCircle } from "lucide-react";
import { useTranslations } from "next-intl";

export function EmptyApplicationCard() {
  const t = useTranslations("home.emptyApplication");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0, duration: 0.5 }}
    >
      <div className="backdrop-blur-md bg-[rgba(255,255,255,0.12)] flex flex-col items-center justify-center p-[32px] relative rounded-[12px] w-full h-[240px] text-center">
        <div className="absolute border border-[rgba(255,255,255,0.2)] inset-0 pointer-events-none rounded-[12px]" />
        <p className="font-heading font-medium text-[22px] text-white mb-1 tracking-[-0.66px]">
          {t("noActiveApplication")}
        </p>
        <p className="text-[rgba(255,255,255,0.65)] text-[14px] mb-5">
          {t("subtitle")}
        </p>
        <Link
          href="/client/application"
          className="flex items-center gap-2 bg-white text-brand-500 font-medium text-[14px] px-5 py-2.5 rounded-full hover:bg-[rgba(255,255,255,0.9)] transition-colors"
        >
          <PlusCircle className="h-4 w-4 shrink-0" />
          {t("cta")}
        </Link>
      </div>
    </motion.div>
  );
}

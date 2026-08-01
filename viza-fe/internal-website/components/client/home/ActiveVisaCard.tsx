"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

interface Props {
  href: string;
  status: string | null;
  visaName: string | null;
}

export function ActiveVisaCard({ href, status, visaName }: Props) {
  const t = useTranslations("home");
  const hasApplication = Boolean(visaName);

  return (
    <motion.div
      className="basis-0 grow"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0, duration: 0.5 }}
    >
      <Link
        href={href}
        className="relative flex h-[240px] w-full flex-col justify-between rounded-[12px] border border-white/20 bg-white/12 p-6 backdrop-blur-md transition-colors hover:bg-white/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
      >
        <div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-white/60">
              {t("activeVisa.label")}
            </p>
            {status ? (
              <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[12px] font-medium text-white/80">
                {t(`statusLabels.${status}`)}
              </span>
            ) : null}
          </div>
          <h2 className="mt-4 line-clamp-3 font-heading text-[22px] font-medium leading-[1.2] tracking-[-0.66px] text-white">
            {visaName ?? t("activeVisa.empty")}
          </h2>
        </div>

        <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-white">
          {hasApplication ? t("activeVisa.open") : t("activeVisa.choose")}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </Link>
    </motion.div>
  );
}

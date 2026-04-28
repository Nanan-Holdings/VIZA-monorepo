"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { JourneyNextAction } from "@/app/actions/application-journey";

interface Props {
  nextAction: JourneyNextAction | null;
  hasApplication: boolean;
}

function PhaseIconBubble({ icon }: { icon: string }) {
  return (
    <div
      className="size-[56px] rounded-[12px] bg-[rgba(255,255,255,0.18)] flex items-center justify-center text-[28px]"
      aria-hidden="true"
    >
      <span role="img">{icon}</span>
    </div>
  );
}

export function NextActionCard({ nextAction, hasApplication }: Props) {
  const t = useTranslations();

  if (!nextAction) {
    return (
      <motion.div
        className="basis-0 grow"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
      >
        <div className="backdrop-blur-md bg-[rgba(255,255,255,0.12)] flex flex-col justify-between items-start p-[24px] relative rounded-[12px] w-full h-[260px]">
          <div className="absolute border border-[rgba(255,255,255,0.2)] inset-0 pointer-events-none rounded-[12px]" />
          <p className="font-heading font-medium text-[20px] text-white tracking-[-0.6px]">
            {t("home.nextAction.title")}
          </p>
          <div>
            <PhaseIconBubble icon={hasApplication ? "✅" : "🚀"} />
            <p className="font-heading text-white text-[18px] mt-3">
              {hasApplication ? t("home.nextAction.allDone") : t("home.nextAction.getStarted")}
            </p>
            <p className="text-[rgba(255,255,255,0.65)] text-[13px] mt-1">
              {hasApplication
                ? t("home.nextAction.allDoneSub")
                : t("home.nextAction.getStartedSub")}
            </p>
          </div>
          <div className="h-12" aria-hidden="true" />
        </div>
      </motion.div>
    );
  }

  const phaseTitle = t(`${nextAction.phaseI18nKey}.title`);
  const phaseSubtitle = t(`${nextAction.phaseI18nKey}.subtitle`);
  const ctaLabel = t(nextAction.ctaLabelKey);

  return (
    <motion.div
      className="basis-0 grow"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.5 }}
    >
      <Link
        href={nextAction.ctaHref}
        className="block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-[12px]"
      >
        <div className="backdrop-blur-md bg-[rgba(255,255,255,0.12)] hover:bg-[rgba(255,255,255,0.16)] transition-colors flex flex-col justify-between items-start p-[24px] relative rounded-[12px] w-full h-[260px]">
          <div className="absolute border border-[rgba(255,255,255,0.2)] inset-0 pointer-events-none rounded-[12px]" />

          <p className="font-heading font-medium text-[20px] text-white tracking-[-0.6px]">
            {t("home.nextAction.title")}
          </p>

          <div className="flex items-start gap-3 w-full">
            <PhaseIconBubble icon="📋" />
            <div className="min-w-0 flex-1">
              <p className="font-heading text-white text-[18px] leading-tight truncate">
                {phaseTitle}
              </p>
              <p className="text-[rgba(255,255,255,0.65)] text-[13px] mt-1 line-clamp-2">
                {phaseSubtitle}
              </p>
            </div>
          </div>

          <div className="inline-flex items-center justify-center gap-2 h-12 rounded-full px-6 text-[15px] font-medium bg-white text-brand-500 group-hover:bg-white/90 transition-colors">
            {ctaLabel}
            <ArrowRight className="size-4" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { JourneyPhaseRow } from "./JourneyPhaseRow";
import type { JourneyOverview, JourneyPhaseView, JourneyVisaPackage } from "@/app/actions/application-journey";

interface Props {
  visaPackage: JourneyVisaPackage | null;
  overview: JourneyOverview;
  phases: JourneyPhaseView[];
}

export function VisaJourneyTimeline({ visaPackage, overview, phases }: Props) {
  const t = useTranslations();

  const heading = visaPackage?.name ?? t("home.visaTimeline.heading");
  const etaText = overview.expectedDecisionLabel
    ? t("home.journey.etaWithDate", {
        date: overview.expectedDecisionLabel,
        rough: t(overview.expectedDecisionRoughLabelKey),
      })
    : t("home.journey.etaRoughOnly", {
        rough: t(overview.expectedDecisionRoughLabelKey),
      });

  return (
    <motion.div
      className="w-full max-w-[1090px] mt-20 xl:mt-24 flex flex-col gap-2"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <p className="font-heading font-medium leading-[1.3] text-[28px] xl:text-[30px] text-[#3d3d3d] tracking-[-0.9px]">
        {heading}
      </p>
      <p className="font-normal leading-[1.4] text-[15px] xl:text-[16px] text-[rgba(0,0,0,0.55)] mb-4">
        {t("home.journey.subheading")} <span className="text-brand-500 font-medium">{etaText}</span>
      </p>

      <div className="flex flex-col">
        {phases.map((phase, idx) => (
          <JourneyPhaseRow key={phase.id} phase={phase} isLast={idx === phases.length - 1} />
        ))}
      </div>
    </motion.div>
  );
}

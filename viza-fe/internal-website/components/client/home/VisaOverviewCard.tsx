"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import type { JourneyOverview, JourneyVisaPackage } from "@/app/actions/application-journey";
import { SmoothProgressMeter } from "@/components/smooth-progress";

interface Props {
  visaPackage: JourneyVisaPackage | null;
  overview: JourneyOverview;
  hasApplication: boolean;
}

export function VisaOverviewCard({ visaPackage, overview, hasApplication }: Props) {
  const t = useTranslations();
  const flag = visaPackage?.flag ?? "🌐";
  const name = visaPackage?.name ?? t("home.emptyApplication.noActiveApplication");
  const description = visaPackage?.description ?? null;

  const progress = Math.max(0, Math.min(100, overview.percentComplete));

  const etaPrimary = overview.expectedDecisionLabel
    ? overview.expectedDecisionLabel
    : t(overview.expectedDecisionRoughLabelKey);
  const etaSecondary = overview.expectedDecisionLabel
    ? `(${t(overview.expectedDecisionRoughLabelKey)})`
    : null;

  const phaseTitle = hasApplication ? t(overview.currentPhaseI18nKey) : t("home.notStarted");

  return (
    <motion.div
      className="basis-0 grow"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0, duration: 0.5 }}
    >
      <div className="backdrop-blur-md bg-[rgba(255,255,255,0.12)] flex flex-col justify-between items-start p-[24px] relative rounded-[12px] w-full h-[260px]">
        <div className="absolute border border-[rgba(255,255,255,0.2)] inset-0 pointer-events-none rounded-[12px]" />

        <div className="flex items-center gap-3">
          <span className="text-4xl leading-none" role="img" aria-label="flag">
            {flag}
          </span>
          <div className="min-w-0">
            <p className="font-heading font-medium text-[18px] leading-tight text-white truncate">
              {name}
            </p>
            {description ? (
              <p className="text-[rgba(255,255,255,0.65)] text-[13px] mt-0.5 truncate">
                {description}
              </p>
            ) : null}
          </div>
        </div>

        <div className="w-full space-y-3">
          <SmoothProgressMeter
            serverProgress={progress}
            status={progress >= 100 ? "completed" : hasApplication ? "running" : "waiting_for_user"}
            intervalMs={140}
            label={
              hasApplication
                ? t("home.overview.phaseOfTotal", {
                    current: overview.currentPhaseIndex + 1,
                    total: overview.totalPhases,
                  })
                : t("home.overview.notStartedYet")
            }
            labelClassName="text-[13px] text-[rgba(255,255,255,0.65)]"
            valueClassName="text-[13px] font-medium text-white"
            trackClassName="bg-[rgba(255,255,255,0.2)]"
            barClassName="bg-white"
          />
          <p className="font-heading text-white text-[15px] leading-tight truncate">{phaseTitle}</p>
          <p className="text-[rgba(255,255,255,0.65)] text-[13px]">
            {hasApplication ? t("home.overview.etaLabel") : t("home.overview.estimatedTotal")}
            <span className="ml-1.5 text-white font-medium">{etaPrimary}</span>
            {etaSecondary ? (
              <span className="ml-1 text-[rgba(255,255,255,0.55)]">{etaSecondary}</span>
            ) : null}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

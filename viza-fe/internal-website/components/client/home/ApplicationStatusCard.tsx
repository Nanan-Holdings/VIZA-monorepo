"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";

const STATUS_BADGE_CLASSES: Record<string, string> = {
  draft: "bg-gray-100/20 text-gray-200 border border-gray-200/30",
  in_progress: "bg-brand-400/20 text-brand-200 border border-brand-200/30",
  submitted: "bg-white/20 text-white border border-white/30",
  approved: "bg-green-100/20 text-green-200 border border-green-200/30",
  rejected: "bg-red-100/20 text-red-200 border border-red-200/30",
};

interface Props {
  status: string;
  visaType: string;
  country: string;
  submittedAt?: string | null;
}

export function ApplicationStatusCard({ status, visaType, country, submittedAt }: Props) {
  const t = useTranslations("home");
  const statusLabel = t(`statusLabels.${status}`);
  const badgeClass = STATUS_BADGE_CLASSES[status] ?? STATUS_BADGE_CLASSES.draft;

  return (
    <motion.div
      className="basis-0 grow"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0, duration: 0.5 }}
    >
      <div className="backdrop-blur-md bg-[rgba(255,255,255,0.12)] flex flex-col justify-between items-start p-[24px] relative rounded-[12px] w-full h-[240px]">
        <div className="absolute border border-[rgba(255,255,255,0.2)] inset-0 pointer-events-none rounded-[12px]" />
        <div className="flex items-start justify-between w-full">
          <p className="font-heading font-medium leading-[1.3] text-[20px] text-white tracking-[-0.6px]">{t("application")}</p>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${badgeClass}`}>
            {statusLabel}
          </span>
        </div>
        <div className="w-full">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl leading-none" role="img" aria-label="Indonesia flag">🇮🇩</span>
            <div>
              <p className="text-white font-heading font-medium text-[18px] leading-tight capitalize">{country}</p>
              <p className="text-[rgba(255,255,255,0.65)] text-[13px] mt-0.5">
                {visaType === "tourist_b211a" ? t("touristVisaB211A") : visaType}
              </p>
            </div>
          </div>
          {submittedAt && (
            <p className="text-[rgba(255,255,255,0.5)] text-[12px]">
              {t("submitted", {
                date: new Date(submittedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                }),
              })}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

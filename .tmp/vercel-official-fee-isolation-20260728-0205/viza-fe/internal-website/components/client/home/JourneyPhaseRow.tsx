"use client";

import { useTranslations } from "next-intl";
import { CheckCircle2, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { JourneyPhaseView } from "@/app/actions/application-journey";

interface Props {
  phase: JourneyPhaseView;
  isLast: boolean;
}

function StatusDot({ status }: { status: JourneyPhaseView["status"] }) {
  if (status === "done") {
    return (
      <div className="size-6 rounded-full bg-brand-500 flex items-center justify-center">
        <CheckCircle2 className="size-4 text-white" />
      </div>
    );
  }
  if (status === "active") {
    return (
      <div className="size-6 rounded-full bg-white border-2 border-brand-500 flex items-center justify-center">
        <div className="size-2.5 rounded-full bg-brand-500 animate-pulse" />
      </div>
    );
  }
  if (status === "locked" || status === "blocked") {
    return (
      <div className="size-6 rounded-full bg-[#f0f0f0] flex items-center justify-center">
        <Lock className="size-3 text-[#989898]" />
      </div>
    );
  }
  return <div className="size-6 rounded-full bg-white border border-[#dcdcdc]" />;
}

export function JourneyPhaseRow({ phase, isLast }: Props) {
  const t = useTranslations();
  const isLocked = phase.status === "locked" || phase.status === "blocked";
  const isMuted = phase.status === "upcoming" || isLocked;
  const isActive = phase.status === "active";

  const titleKey = `${phase.i18nKey}.title`;
  const subtitleKey = `${phase.i18nKey}.subtitle`;
  const durationLabel = t(phase.durationLabelKey);
  const realWorldLabel = phase.realWorld
    ? t(`home.realWorld.${phase.realWorld}`)
    : null;

  return (
    <div className="relative flex items-stretch gap-4">
      <div className="flex flex-col items-center pt-5">
        <StatusDot status={phase.status} />
        {!isLast ? (
          <div
            className={cn(
              "w-px flex-1 mt-1",
              phase.status === "done" ? "bg-brand-500" : "bg-[#e8e8e8]"
            )}
          />
        ) : null}
      </div>

      <div
        className={cn(
          "flex-1 rounded-xl border border-[#efefef] p-4 xl:p-5 mb-3 transition-colors",
          isActive && "bg-brand-50 border-brand-100",
          !isActive && !isLocked && "bg-white",
          isLocked && "bg-[rgba(239,239,239,0.5)]",
          isMuted && "opacity-90"
        )}
      >
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={cn(
                "shrink-0 size-12 xl:size-14 rounded-[8px] flex items-center justify-center text-[24px] xl:text-[28px]",
                isLocked ? "bg-[#f0f0f0] opacity-60" : "bg-brand-50",
                isActive && "bg-white"
              )}
            >
              <span role="img" aria-hidden="true">
                {phase.icon}
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={cn(
                    "text-[12px] font-medium uppercase tracking-wide",
                    isActive ? "text-brand-500" : "text-[rgba(0,0,0,0.5)]"
                  )}
                >
                  {durationLabel}
                </span>
                {realWorldLabel ? (
                  <Badge
                    variant="outline"
                    className="text-[11px] font-medium border-[#dcdcdc] text-[rgba(0,0,0,0.6)]"
                  >
                    {realWorldLabel}
                  </Badge>
                ) : null}
              </div>
              <p
                className={cn(
                  "font-heading font-medium leading-tight text-[16px] xl:text-[18px] mt-1 text-[#3d3d3d]",
                  isLocked && "text-[#989898]"
                )}
              >
                {t(titleKey)}
              </p>
              <p
                className={cn(
                  "text-[13px] xl:text-[14px] mt-1 text-[rgba(0,0,0,0.55)]",
                  isLocked && "text-[#a8a8a8]"
                )}
              >
                {t(subtitleKey)}
              </p>
            </div>
          </div>

          {phase.status === "done" && phase.dateLabel ? (
            <div className="shrink-0 text-[13px] text-brand-500 font-medium">
              {t("home.phase.doneOn", { date: phase.dateLabel })}
            </div>
          ) : null}
          {phase.status === "active" && phase.dateLabel ? (
            <div className="shrink-0 text-[13px] text-brand-500 font-medium">
              {t("home.phase.startedOn", { date: phase.dateLabel })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

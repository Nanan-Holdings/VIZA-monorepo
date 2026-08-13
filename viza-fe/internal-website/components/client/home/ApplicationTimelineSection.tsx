"use client";

import Image from "next/image";
import Link from "next/link";
import { CaretRight as ChevronRight } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { ActionButton } from "@/components/ui/action-button";
import { ApplicationFormPanel } from "@/components/ui/application-form-panel";
import { getCountryHeroTheme, heroGradientCss } from "@/lib/client/country-hero-theme";
import { cn } from "@/lib/utils";
import type {
  StatusAction,
  StatusApplication,
  StatusStep,
  StatusStepKey,
} from "@/app/client/status/status-data";

const STEP_ACTIONS: Partial<Record<StatusStepKey, StatusAction["key"][]>> = {
  payment: ["pay"],
  consent: ["giveConsent"],
  form: ["startApplication", "continueForm"],
  documents: ["uploadDocuments"],
  packet: ["waitPacket"],
  handoff: ["waitExternal"],
  result: ["downloadResult", "contactSupport"],
};

/**
 * White step glyphs. They sit on a tile filled with the current application's
 * country gradient (see `country-hero-theme`), so they must stay pure white —
 * those gradients are hand-tuned for white legibility, nothing else.
 */
const STEP_IMAGE: Record<StatusStepKey, string> = {
  payment: "/images/step-icons-white/payment.png",
  consent: "/images/step-icons-white/consent.png",
  form: "/images/step-icons-white/form.png",
  documents: "/images/step-icons-white/documents.png",
  packet: "/images/step-icons-white/packet.png",
  handoff: "/images/step-icons-white/handoff.png",
  result: "/images/step-icons-white/result.png",
};

type TimelineTranslator = ReturnType<typeof useTranslations<"home.timeline">>;

function formatRelative(date: Date, locale: string, t: TimelineTranslator): string {
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return t("relative.justNow");
  if (diffMins < 60) return t("relative.minutesAgo", { count: diffMins });
  if (diffHours < 24) return t("relative.hoursAgo", { count: diffHours });
  if (diffDays < 7) return t("relative.daysAgo", { count: diffDays });
  return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

function getAction(application: StatusApplication, step: StatusStep): StatusAction | null {
  const keys = STEP_ACTIONS[step.key] ?? [];
  return application.actions.find((action) => keys.includes(action.key)) ?? null;
}

function getDescription(
  application: StatusApplication,
  step: StatusStep,
  t: TimelineTranslator,
) {
  if (step.key === "form") return t("metrics.answers", { count: application.formAnswerCount });
  if (step.key === "documents") {
    return t("metrics.documents", {
      ready: application.documents.uploaded + application.documents.validated,
      total: application.documents.total,
    });
  }
  if (step.key === "handoff" && application.officialReference) {
    return t("metrics.reference", { reference: application.officialReference });
  }
  return t(`steps.${step.key}.description`);
}

function TaskCard({
  application,
  step,
  index,
}: {
  application: StatusApplication;
  step: StatusStep;
  index: number;
}) {
  const t = useTranslations("home.timeline");
  const locale = useLocale();
  const heroTheme = getCountryHeroTheme(application.country);
  const action = step.state === "complete" ? null : getAction(application, step);
  const completedAt =
    step.state === "complete" && step.updatedAt
      ? formatRelative(new Date(step.updatedAt), locale, t)
      : null;
  const isUpcoming = step.state === "upcoming";

  const content = (
    <div
      className={cn(
        "flex min-h-[96px] w-full items-center gap-4 px-4 py-4 sm:gap-5 sm:px-5",
        isUpcoming && "bg-[#f5f5f5]",
      )}
    >
      <div
        className={cn(
          "relative size-14 shrink-0 overflow-hidden rounded-[8px] sm:size-16",
          isUpcoming && "grayscale opacity-45",
        )}
        // Inline, not a Tailwind class: the gradient is per-country data.
        style={{ backgroundImage: heroGradientCss(heroTheme) }}
      >
        <Image
          src={STEP_IMAGE[step.key]}
          alt=""
          fill
          sizes="64px"
          // contain, not cover: the glyphs carry transparent padding cover would crop.
          // drop-shadow (not box-shadow) so it follows the glyph's alpha, not its bounding box.
          className="object-contain p-2 drop-shadow-[0_2px_3px_rgba(0,0,0,0.32)]"
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-sans text-[16px] font-medium leading-[1.3] tracking-[-0.48px] text-[#171717]">
          {t(`steps.${step.key}.title`)}
        </p>
        <p className="mt-1 line-clamp-2 font-sans text-[14px] font-normal leading-[1.45] tracking-[-0.32px] text-[#737373]">
          {getDescription(application, step, t)}
        </p>
        <p className="mt-2 text-[12px] text-[#a3a3a3] sm:hidden">
          {completedAt ?? t(`states.${step.state}`)}
        </p>
      </div>

      <p className="hidden shrink-0 font-sans text-[13px] text-[#a3a3a3] sm:block">
        {completedAt ?? t(`states.${step.state}`)}
      </p>
      {action ? <ChevronRight className="h-5 w-5 shrink-0 text-[#a3a3a3]" aria-hidden="true" /> : null}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.4 }}
    >
      <ApplicationFormPanel
        data-state={step.state}
        className={cn(
          "w-full overflow-hidden rounded-xl p-0",
          isUpcoming && "border-[#e1e1e1] bg-[#f5f5f5] opacity-65",
        )}
      >
        {action ? (
          <Link
            href={action.href}
            className="block w-full bg-white transition-colors hover:bg-[#fafafa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/25"
          >
            {content}
          </Link>
        ) : (
          <div className="w-full bg-white">{content}</div>
        )}
      </ApplicationFormPanel>
    </motion.div>
  );
}

function TaskGroup({
  title,
  emptyText,
  application,
  steps,
}: {
  title: string;
  emptyText: string;
  application: StatusApplication;
  steps: StatusStep[];
}) {
  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between gap-4 sm:mb-5">
        <h2 className="font-heading text-[24px] font-medium leading-[1.3] tracking-[-0.72px] text-[#3d3d3d] sm:text-[30px] sm:tracking-[-0.9px]">
          {title}
        </h2>
        <span className="text-[14px] font-medium tabular-nums text-[#8a94a6]">{steps.length}</span>
      </div>

      {steps.length > 0 ? (
        <div className="flex w-full flex-col gap-3">
          {steps.map((step, index) => (
            <TaskCard
              key={step.key}
              application={application}
              step={step}
              index={index}
            />
          ))}
        </div>
      ) : (
        <ApplicationFormPanel className="w-full rounded-xl p-6 text-center">
          <p className="font-sans text-[14px] text-[rgba(0,0,0,0.45)]">{emptyText}</p>
        </ApplicationFormPanel>
      )}
    </section>
  );
}

export function ApplicationTimelineSection({ application }: { application: StatusApplication | null }) {
  const t = useTranslations("home.timeline");

  if (!application) {
    return (
      <div className="mx-auto w-full max-w-[1090px] pb-[80px]">
        <h2 className="mb-4 font-heading text-[24px] font-medium leading-[1.3] tracking-[-0.72px] text-[#3d3d3d] sm:mb-5 sm:text-[30px] sm:tracking-[-0.9px]">
          {t("groups.todo")}
        </h2>
        <ApplicationFormPanel className="w-full rounded-xl p-6 text-center">
          <p className="font-sans text-[14px] text-[rgba(0,0,0,0.45)]">
            {t("empty.noApplication")}
          </p>
          <ActionButton size="sm" asChild className="mt-4">
            <Link href="/client/status">{t("empty.choose")}</Link>
          </ActionButton>
        </ApplicationFormPanel>
      </div>
    );
  }

  const todoSteps = application.steps.filter((step) => step.state !== "complete");
  const completedSteps = application.steps.filter((step) => step.state === "complete");

  return (
    <div className="mx-auto w-full max-w-[1090px] space-y-12 pb-[80px]">
      <TaskGroup
        title={t("groups.todo")}
        emptyText={t("empty.incomplete")}
        application={application}
        steps={todoSteps}
      />
      {completedSteps.length > 0 ? (
        <TaskGroup
          title={t("groups.completed")}
          emptyText={t("empty.completed")}
          application={application}
          steps={completedSteps}
        />
      ) : null}
    </div>
  );
}

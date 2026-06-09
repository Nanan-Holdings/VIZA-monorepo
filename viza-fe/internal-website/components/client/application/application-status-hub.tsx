"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  CircleDot,
  Clock3,
  FileText,
  Loader2,
  Send,
  Upload,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  getApplicationLifecycleSummaries,
  type ApplicationLifecycleStatus,
  type ApplicationLifecycleSummary,
} from "@/app/actions/application-lifecycle";
import { SmoothProgressMeter } from "@/components/smooth-progress";
import { cn } from "@/lib/utils";
import { getFormVisaType } from "@/lib/visa-destinations";

type HubMode = "overview" | "detail";
type HubFilter = "all" | "not_submitted" | "processing" | "needs_attention" | "completed";

interface ApplicationStatusHubProps {
  mode?: HubMode;
  applicationId?: string | null;
  country?: string | null;
  visaType?: string | null;
  startedOnly?: boolean;
  basePath?: string;
}

const FILTERS: HubFilter[] = ["all", "not_submitted", "processing", "needs_attention", "completed"];

const FILTER_STATUS_MAP: Record<HubFilter, ApplicationLifecycleStatus[]> = {
  all: [
    "not_started",
    "not_submitted",
    "in_progress",
    "needs_documents",
    "submitting",
    "submitted",
    "needs_attention",
    "approved",
    "rejected",
  ],
  not_submitted: ["not_started", "not_submitted", "in_progress"],
  processing: ["needs_documents", "submitting", "submitted"],
  needs_attention: ["needs_documents", "needs_attention"],
  completed: ["approved", "rejected"],
};

const STATUS_TONE: Record<
  ApplicationLifecycleStatus,
  { icon: LucideIcon; badge: string; ring: string; bar: string; dot: string }
> = {
  not_started: {
    icon: CircleDot,
    badge: "border-slate-200 bg-slate-50 text-slate-600",
    ring: "bg-slate-100 text-slate-600",
    bar: "bg-slate-300",
    dot: "bg-slate-300",
  },
  not_submitted: {
    icon: FileText,
    badge: "border-gray-200 bg-gray-50 text-gray-700",
    ring: "bg-gray-100 text-gray-700",
    bar: "bg-gray-400",
    dot: "bg-gray-400",
  },
  in_progress: {
    icon: Clock3,
    badge: "border-blue-200 bg-blue-50 text-blue-700",
    ring: "bg-blue-100 text-blue-700",
    bar: "bg-blue-500",
    dot: "bg-blue-500",
  },
  needs_documents: {
    icon: Upload,
    badge: "border-amber-200 bg-amber-50 text-amber-800",
    ring: "bg-amber-100 text-amber-800",
    bar: "bg-amber-500",
    dot: "bg-amber-500",
  },
  submitting: {
    icon: Send,
    badge: "border-indigo-200 bg-indigo-50 text-indigo-700",
    ring: "bg-indigo-100 text-indigo-700",
    bar: "bg-indigo-500",
    dot: "bg-indigo-500",
  },
  submitted: {
    icon: Send,
    badge: "border-cyan-200 bg-cyan-50 text-cyan-700",
    ring: "bg-cyan-100 text-cyan-700",
    bar: "bg-cyan-500",
    dot: "bg-cyan-500",
  },
  needs_attention: {
    icon: CircleAlert,
    badge: "border-red-200 bg-red-50 text-red-700",
    ring: "bg-red-100 text-red-700",
    bar: "bg-red-500",
    dot: "bg-red-500",
  },
  approved: {
    icon: CheckCircle2,
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    ring: "bg-emerald-100 text-emerald-700",
    bar: "bg-emerald-500",
    dot: "bg-emerald-500",
  },
  rejected: {
    icon: XCircle,
    badge: "border-rose-200 bg-rose-50 text-rose-700",
    ring: "bg-rose-100 text-rose-700",
    bar: "bg-rose-500",
    dot: "bg-rose-500",
  },
};

function getDetailHref(summary: ApplicationLifecycleSummary, basePath: string): string {
  if (summary.applicationId) {
    return `${basePath}?view=detail&applicationId=${encodeURIComponent(summary.applicationId)}`;
  }

  return `${basePath}?view=detail&country=${encodeURIComponent(summary.country)}&visaType=${encodeURIComponent(summary.visaType)}`;
}

function getFormHref(summary: Pick<ApplicationLifecycleSummary, "country" | "visaType">): string {
  return `/client/application?country=${encodeURIComponent(summary.country)}&visaType=${encodeURIComponent(summary.visaType)}`;
}

function formatDate(value: string | null, locale: string): string {
  if (!value) return "—";

  return new Intl.DateTimeFormat(locale.startsWith("zh") ? "zh-CN" : "en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function getProgressStatus(status: ApplicationLifecycleStatus): "completed" | "running" {
  return status === "approved" || status === "rejected" ? "completed" : "running";
}

function matchesDetailRequest(
  summary: ApplicationLifecycleSummary,
  applicationId?: string | null,
  country?: string | null,
  visaType?: string | null,
): boolean {
  if (applicationId) return summary.applicationId === applicationId;
  if (!country || !visaType) return false;

  return (
    summary.country.toLowerCase() === country.toLowerCase() &&
    summary.visaType.toLowerCase() === getFormVisaType(visaType).toLowerCase()
  );
}

function StatusBadge({ status }: { status: ApplicationLifecycleStatus }) {
  const t = useTranslations("application.statusHub");
  const tone = STATUS_TONE[status];
  const Icon = tone.icon;

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", tone.badge)}>
      <Icon className="h-3.5 w-3.5" />
      {t(`statuses.${status}`)}
    </span>
  );
}

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-[12px] font-medium text-[#526174]">
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
          done ? "border-emerald-200 bg-emerald-50 text-emerald-600" : "border-[#dce5f0] bg-white text-[#a0abba]",
        )}
      >
        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleDot className="h-3 w-3" />}
      </span>
      <span>{label}</span>
    </div>
  );
}

function SummaryCard({
  summary,
  index,
  basePath,
}: {
  summary: ApplicationLifecycleSummary;
  index: number;
  basePath: string;
}) {
  const t = useTranslations("application.statusHub");
  const locale = useLocale();
  const isZh = locale.toLowerCase().startsWith("zh");
  const tone = STATUS_TONE[summary.status];
  const countryName = isZh ? summary.countryNameZh : summary.countryName;
  const visaTypeLabel = isZh ? summary.visaTypeLabelZh : summary.visaTypeLabel;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
    >
      <Link
        href={getDetailHref(summary, basePath)}
        className="group flex min-h-[286px] flex-col justify-between rounded-[8px] border border-[#e7edf5] bg-white p-5 text-left shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition hover:border-[#03346E]/35 hover:shadow-[0_16px_34px_rgba(3,52,110,0.11)]"
      >
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="text-[34px] leading-none" aria-hidden="true">
                {summary.countryFlag}
              </span>
              <div className="min-w-0">
                <h2 className="font-heading text-[18px] font-medium leading-tight text-[#1f2937]">
                  {countryName}
                </h2>
                <p className="mt-1 truncate text-[13px] font-medium text-[#6b7687]">
                  {visaTypeLabel}
                </p>
              </div>
            </div>
            <StatusBadge status={summary.status} />
          </div>

          <SmoothProgressMeter
            serverProgress={summary.progressPercent}
            status={getProgressStatus(summary.status)}
            intervalMs={160}
            label={t("cardProgress")}
            barClassName={tone.bar}
          />

          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <ChecklistItem done={summary.checklist.destination} label={t("checklist.destination")} />
            <ChecklistItem done={summary.checklist.form} label={t("checklist.form")} />
            <ChecklistItem done={summary.checklist.photo} label={t("checklist.photo")} />
            <ChecklistItem done={summary.checklist.documents} label={t("checklist.documents")} />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-[#edf1f6] pt-4">
          <div>
            <p className="text-[12px] font-medium text-[#8a94a3]">{t("updatedAt")}</p>
            <p className="mt-0.5 text-[13px] font-semibold text-[#3d4b5f]">
              {formatDate(summary.updatedAt ?? summary.createdAt, locale)}
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-[14px] font-semibold text-[#03346E]">
            {t(`nextActions.${summary.nextAction}`)}
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

function EmptyState({ startedOnly }: { startedOnly: boolean }) {
  const t = useTranslations("application.statusHub");

  return (
    <div className="rounded-[8px] border border-dashed border-[#cbd8ea] bg-white px-6 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#eef3fa] text-[#03346E]">
        <FileText className="h-6 w-6" />
      </div>
      <h2 className="mt-4 font-heading text-[22px] font-medium text-[#27364a]">
        {startedOnly ? t("emptyStartedTitle") : t("emptyTitle")}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-[14px] leading-6 text-[#66758a]">
        {startedOnly ? t("emptyStartedBody") : t("emptyBody")}
      </p>
      <Link
        href="/client/home"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#03346E] px-5 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#052b58]"
      >
        {t("chooseDestination")}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function LoadingState() {
  const t = useTranslations("application.statusHub");

  return (
    <div className="flex min-h-[52vh] flex-col items-center justify-center gap-3">
      <Loader2 className="h-9 w-9 animate-spin text-[#03346E]" />
      <p className="text-[14px] font-medium text-[#66758a]">{t("loading")}</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  const t = useTranslations("application.statusHub");

  return (
    <div className="rounded-[8px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
      <p className="font-semibold">{t("loadError")}</p>
      <p className="mt-1">{message}</p>
    </div>
  );
}

function Overview({
  summaries,
  startedOnly,
  basePath,
}: {
  summaries: ApplicationLifecycleSummary[];
  startedOnly: boolean;
  basePath: string;
}) {
  const t = useTranslations("application.statusHub");
  const [activeFilter, setActiveFilter] = useState<HubFilter>("all");
  const filteredSummaries = summaries.filter((summary) => FILTER_STATUS_MAP[activeFilter].includes(summary.status));

  return (
    <div className="mx-auto w-full max-w-[1120px] pb-14">
      <section className="pt-5 sm:pt-8">
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#6b7687]">
          {t("eyebrow")}
        </p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-heading text-[32px] font-medium leading-[1.1] tracking-[-1.2px] text-[#26364a] sm:text-[42px] sm:tracking-[-1.6px]">
              {t("title")}
            </h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-6 text-[#66758a]">
              {t("subtitle")}
            </p>
          </div>
          <Link
            href="/client/home"
            className="inline-flex w-fit items-center gap-2 rounded-full border border-[#dce5f0] bg-white px-4 py-2 text-[14px] font-semibold text-[#03346E] transition hover:border-[#03346E]/40"
          >
            {t("chooseDestination")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <div className="mt-7 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((filter) => {
          const active = activeFilter === filter;
          return (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-[14px] font-semibold transition",
                active
                  ? "border-[#03346E] bg-[#03346E] text-white"
                  : "border-[#dce5f0] bg-white text-[#526174] hover:border-[#03346E]/40",
              )}
            >
              {t(`filters.${filter}`)}
            </button>
          );
        })}
      </div>

      <section className="mt-6">
        {summaries.length === 0 ? (
          <EmptyState startedOnly={startedOnly} />
        ) : filteredSummaries.length === 0 ? (
          <div className="rounded-[8px] border border-dashed border-[#dce5f0] bg-white px-5 py-10 text-center">
            <p className="text-[15px] font-medium text-[#526174]">{t("noFilteredResults")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredSummaries.map((summary, index) => (
              <SummaryCard
                key={summary.applicationId ?? `${summary.country}-${summary.visaType}`}
                summary={summary}
                index={index}
                basePath={basePath}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[8px] border border-[#edf1f6] bg-white px-4 py-3">
      <p className="text-[12px] font-medium text-[#8a94a3]">{label}</p>
      <p className="mt-1 text-[15px] font-semibold text-[#26364a]">{value}</p>
    </div>
  );
}

function TimelineStep({
  title,
  description,
  done,
  active,
}: {
  title: string;
  description: string;
  done: boolean;
  active: boolean;
}) {
  return (
    <div className="relative flex gap-3">
      <div
        className={cn(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
          done
            ? "border-emerald-200 bg-emerald-50 text-emerald-600"
            : active
              ? "border-[#03346E] bg-[#eef3fa] text-[#03346E]"
              : "border-[#dce5f0] bg-white text-[#a0abba]",
        )}
      >
        {done ? <CheckCircle2 className="h-4 w-4" /> : <CircleDot className="h-3.5 w-3.5" />}
      </div>
      <div className="min-w-0 pb-5">
        <p className={cn("text-[15px] font-semibold", active ? "text-[#03346E]" : "text-[#26364a]")}>{title}</p>
        <p className="mt-1 text-[13px] leading-5 text-[#66758a]">{description}</p>
      </div>
    </div>
  );
}

function DetailView({
  summary,
  missingRequest,
  basePath,
}: {
  summary: ApplicationLifecycleSummary | null;
  missingRequest: { country?: string | null; visaType?: string | null };
  basePath: string;
}) {
  const t = useTranslations("application.statusHub");
  const locale = useLocale();

  if (!summary) {
    const canStart = Boolean(missingRequest.country && missingRequest.visaType);
    return (
      <div className="mx-auto w-full max-w-[960px] pb-14 pt-5 sm:pt-8">
        <Link
          href={basePath}
          className="inline-flex items-center gap-2 text-[14px] font-semibold text-[#03346E]"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("backToOverview")}
        </Link>
        <div className="mt-6 rounded-[8px] border border-dashed border-[#cbd8ea] bg-white px-6 py-12 text-center">
          <h1 className="font-heading text-[26px] font-medium text-[#26364a]">{t("detailMissingTitle")}</h1>
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-6 text-[#66758a]">{t("detailMissingBody")}</p>
          {canStart && (
            <Link
              href={getFormHref({
                country: missingRequest.country ?? "",
                visaType: missingRequest.visaType ?? "",
              })}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#03346E] px-5 py-2.5 text-[14px] font-semibold text-white"
            >
              {t("startApplication")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    );
  }

  const tone = STATUS_TONE[summary.status];
  const isZh = locale.toLowerCase().startsWith("zh");
  const countryName = isZh ? summary.countryNameZh : summary.countryName;
  const visaTypeLabel = isZh ? summary.visaTypeLabelZh : summary.visaTypeLabel;
  const primaryHref = getFormHref(summary);
  const resultDone = summary.status === "approved" || summary.status === "rejected";
  const submittingDone = summary.status === "submitting" || summary.status === "submitted" || resultDone;
  const timeline = [
    {
      key: "destination",
      done: true,
      active: false,
    },
    {
      key: "form",
      done: summary.checklist.form,
      active: !summary.checklist.form,
    },
    {
      key: "photo",
      done: summary.checklist.photo,
      active: summary.checklist.form && !summary.checklist.photo,
    },
    {
      key: "documents",
      done: summary.checklist.documents,
      active: summary.checklist.photo && !summary.checklist.documents,
    },
    {
      key: "submission",
      done: submittingDone,
      active: summary.checklist.documents && !submittingDone,
    },
    {
      key: "result",
      done: resultDone,
      active: submittingDone && !resultDone,
    },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-[1040px] pb-14 pt-5 sm:pt-8">
      <Link
        href={basePath}
        className="inline-flex items-center gap-2 text-[14px] font-semibold text-[#03346E]"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("backToOverview")}
      </Link>

      <section className="mt-6 rounded-[8px] border border-[#e7edf5] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-4">
            <span className="text-[42px] leading-none" aria-hidden="true">
              {summary.countryFlag}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-heading text-[30px] font-medium leading-tight tracking-[-1px] text-[#26364a]">
                  {countryName}
                </h1>
                <StatusBadge status={summary.status} />
              </div>
              <p className="mt-2 text-[15px] font-medium text-[#66758a]">
                {visaTypeLabel}
              </p>
              {summary.latestSubmission?.lastError && (
                <p className="mt-3 rounded-[8px] border border-red-100 bg-red-50 px-3 py-2 text-[13px] text-red-700">
                  {summary.latestSubmission.lastError}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={primaryHref}
              className="inline-flex items-center gap-2 rounded-full bg-[#03346E] px-5 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#052b58]"
            >
              {t(`nextActions.${summary.nextAction}`)}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={getFormHref(summary)}
              className="inline-flex items-center gap-2 rounded-full border border-[#dce5f0] bg-white px-5 py-2.5 text-[14px] font-semibold text-[#03346E] transition hover:border-[#03346E]/40"
            >
              {t("continueForm")}
            </Link>
          </div>
        </div>

        <SmoothProgressMeter
          serverProgress={summary.progressPercent}
          status={getProgressStatus(summary.status)}
          intervalMs={160}
          label={t("fullCycleProgress")}
          className="mt-6"
          barClassName={tone.bar}
        />
      </section>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <section className="rounded-[8px] border border-[#e7edf5] bg-white p-5 sm:p-6">
          <h2 className="font-heading text-[22px] font-medium text-[#26364a]">{t("timelineTitle")}</h2>
          <div className="mt-5">
            {timeline.map((step) => (
              <TimelineStep
                key={step.key}
                title={t(`timeline.${step.key}.title`)}
                description={t(`timeline.${step.key}.description`)}
                done={step.done}
                active={step.active}
              />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-[8px] border border-[#e7edf5] bg-white p-5">
            <h2 className="font-heading text-[20px] font-medium text-[#26364a]">{t("detailsTitle")}</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <DetailMetric label={t("metrics.applicationId")} value={summary.applicationId ?? "—"} />
              <DetailMetric label={t("metrics.rawStatus")} value={summary.rawApplicationStatus ?? "—"} />
              <DetailMetric label={t("metrics.createdAt")} value={formatDate(summary.createdAt, locale)} />
              <DetailMetric label={t("metrics.submittedAt")} value={formatDate(summary.submittedAt, locale)} />
              <DetailMetric label={t("metrics.confirmation")} value={summary.confirmationNumber ?? "—"} />
            </div>
          </div>

          <div className="rounded-[8px] border border-[#e7edf5] bg-white p-5">
            <h2 className="font-heading text-[20px] font-medium text-[#26364a]">{t("evidenceTitle")}</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <DetailMetric label={t("metrics.answerCount")} value={summary.formAnswerCount} />
              <DetailMetric label={t("metrics.photo")} value={summary.hasPhoto ? t("yes") : t("no")} />
              <DetailMetric label={t("metrics.docsUploaded")} value={summary.documentCounts.uploaded + summary.documentCounts.validated} />
              <DetailMetric label={t("metrics.docsRejected")} value={summary.documentCounts.rejected} />
            </div>
          </div>

          <div className="rounded-[8px] border border-[#e7edf5] bg-white p-5">
            <h2 className="font-heading text-[20px] font-medium text-[#26364a]">{t("submissionTitle")}</h2>
            <div className="mt-4 grid grid-cols-1 gap-3">
              <DetailMetric label={t("metrics.queueStatus")} value={summary.latestSubmission?.status ?? "—"} />
              <DetailMetric label={t("metrics.queueAttempts")} value={summary.latestSubmission?.attempts ?? 0} />
              <DetailMetric
                label={t("metrics.queueUpdatedAt")}
                value={formatDate(summary.latestSubmission?.updatedAt ?? summary.latestSubmission?.createdAt ?? null, locale)}
              />
            </div>
            {summary.receiptUrl && (
              <Link
                href={summary.receiptUrl}
                className="mt-4 inline-flex items-center gap-2 text-[14px] font-semibold text-[#03346E]"
              >
                {t("viewReceipt")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export function ApplicationStatusHub({
  mode = "overview",
  applicationId,
  country,
  visaType,
  startedOnly = false,
  basePath = "/client/application",
}: ApplicationStatusHubProps) {
  const [summaries, setSummaries] = useState<ApplicationLifecycleSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSummaries() {
      setIsLoading(true);
      setError(null);
      const result = await getApplicationLifecycleSummaries({ startedOnly });
      if (!isMounted) return;

      setSummaries(result.summaries);
      setError(result.error ?? null);
      setIsLoading(false);
    }

    void loadSummaries();
    return () => {
      isMounted = false;
    };
  }, [startedOnly]);

  const detailSummary = useMemo(
    () => summaries.find((summary) => matchesDetailRequest(summary, applicationId, country, visaType)) ?? null,
    [applicationId, country, summaries, visaType],
  );

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  if (mode === "detail") {
    return <DetailView summary={detailSummary} missingRequest={{ country, visaType }} basePath={basePath} />;
  }

  return <Overview summaries={summaries} startedOnly={startedOnly} basePath={basePath} />;
}

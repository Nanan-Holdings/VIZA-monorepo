import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  CircleDot,
  Clock3,
  CreditCard,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  FolderCheck,
  Landmark,
  Package,
  Receipt,
  Send,
  ShieldCheck,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getClientStatusData,
  hasClientSession,
  type ClientStatusData,
  type ClientStatusState,
  type StatusAction,
  type StatusApplication,
  type StatusEvent,
  type StatusFile,
  type StatusFileKey,
  type StatusStep,
  type StatusStepKey,
  type StatusStepState,
} from "./status-data";

type SearchParams = Promise<{
  applicationId?: string | string[];
  packageId?: string | string[];
}>;

const STEP_ICONS: Record<StatusStepKey, LucideIcon> = {
  payment: CreditCard,
  consent: ShieldCheck,
  form: FileText,
  documents: FolderCheck,
  packet: Package,
  handoff: Send,
  result: FileCheck2,
};

const STATE_TONE: Record<
  StatusStepState,
  { icon: LucideIcon; circle: string; border: string; badge: string; text: string }
> = {
  complete: {
    icon: CheckCircle2,
    circle: "border-emerald-200 bg-emerald-50 text-emerald-700",
    border: "border-emerald-100",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    text: "text-emerald-700",
  },
  current: {
    icon: Clock3,
    circle: "border-brand-200 bg-brand-50 text-brand-500",
    border: "border-brand-100",
    badge: "border-brand-200 bg-brand-50 text-brand-600",
    text: "text-brand-600",
  },
  attention: {
    icon: CircleAlert,
    circle: "border-amber-200 bg-amber-50 text-amber-800",
    border: "border-amber-200",
    badge: "border-amber-200 bg-amber-50 text-amber-800",
    text: "text-amber-800",
  },
  blocked: {
    icon: CircleAlert,
    circle: "border-rose-200 bg-rose-50 text-rose-700",
    border: "border-rose-100",
    badge: "border-rose-200 bg-rose-50 text-rose-700",
    text: "text-rose-700",
  },
  upcoming: {
    icon: CircleDot,
    circle: "border-slate-200 bg-slate-50 text-slate-500",
    border: "border-slate-100",
    badge: "border-slate-200 bg-slate-50 text-slate-600",
    text: "text-slate-600",
  },
};

const APPLICATION_TONE: Record<ClientStatusState, string> = {
  not_started: "border-slate-200 bg-slate-50 text-slate-700",
  needs_payment: "border-rose-200 bg-rose-50 text-rose-700",
  needs_consent: "border-amber-200 bg-amber-50 text-amber-800",
  in_progress: "border-brand-200 bg-brand-50 text-brand-600",
  needs_documents: "border-amber-200 bg-amber-50 text-amber-800",
  packet_pending: "border-blue-200 bg-blue-50 text-blue-700",
  external_pending: "border-cyan-200 bg-cyan-50 text-cyan-700",
  submitted: "border-indigo-200 bg-indigo-50 text-indigo-700",
  needs_attention: "border-amber-200 bg-amber-50 text-amber-800",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-rose-200 bg-rose-50 text-rose-700",
};

const FILE_ICONS: Record<StatusFileKey, LucideIcon> = {
  applicationReceipt: Receipt,
  paymentReceipt: Receipt,
  packet: Package,
  approvedResult: FileCheck2,
  rejectionLetter: FileText,
  resultFile: FileText,
};

const KNOWN_EVENT_KEYS = new Set([
  "payment_completed",
  "consent_accepted",
  "document_uploaded",
  "packet_generated",
  "external_status_updated",
  "result_received",
  "notification_sent",
]);

function getParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function getSelectionHref(application: StatusApplication): string {
  if (application.id) return `/client/status?applicationId=${encodeURIComponent(application.id)}`;
  if (application.packageId) return `/client/status?packageId=${encodeURIComponent(application.packageId)}`;
  return "/client/status";
}

function getSelectionKey(application: StatusApplication): string {
  return application.id ? `app:${application.id}` : `package:${application.packageId ?? application.key}`;
}

function formatDate(value: string | null, locale: string): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat(locale.startsWith("zh") ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string | null, locale: string): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat(locale.startsWith("zh") ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatMoney(amountCents: number | null, currency: string | null, locale: string): string {
  if (amountCents === null || !currency) return "-";
  try {
    return new Intl.NumberFormat(locale.startsWith("zh") ? "zh-CN" : "en-US", {
      style: "currency",
      currency,
    }).format(amountCents / 100);
  } catch {
    return `${currency} ${(amountCents / 100).toFixed(2)}`;
  }
}

function humanize(value: string | null): string {
  if (!value) return "-";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatStepMetric(application: StatusApplication, step: StatusStep, locale: string, t: Awaited<ReturnType<typeof getTranslations>>) {
  if (!step.metricValue) return null;
  if (step.key === "payment") return formatMoney(application.payment.amountCents, application.payment.currency, locale);
  if (step.key === "consent") return t(`metrics.${step.metricValue}`);
  if (step.key === "form") return t("metrics.answerCount", { count: Number(step.metricValue) });
  if (step.key === "documents") return step.metricValue;
  if (step.key === "packet" || step.key === "result") return t("metrics.fileReady");
  return step.metricValue;
}

function formatEvent(event: StatusEvent, t: Awaited<ReturnType<typeof getTranslations>>): string {
  const normalized = event.eventType.toLowerCase();
  if (KNOWN_EVENT_KEYS.has(normalized)) return t(`events.${normalized}`);
  return humanize(event.eventType);
}

function StatusBadge({
  state,
  t,
}: {
  state: ClientStatusState;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold", APPLICATION_TONE[state])}>
      {t(`states.${state}`)}
    </span>
  );
}

function StatPanel({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="rounded-[8px] border border-[#e7edf5] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-[#66758a]">{label}</p>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-500">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 font-heading text-[26px] font-medium leading-none text-[#26364a]">{value}</p>
    </div>
  );
}

function ApplicationCard({
  application,
  selected,
  locale,
  t,
}: {
  application: StatusApplication;
  selected: boolean;
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <Link
      href={getSelectionHref(application)}
      className={cn(
        "block rounded-[8px] border bg-white p-4 text-left shadow-sm transition hover:border-brand-200 hover:shadow-md",
        selected ? "border-brand-300 ring-1 ring-brand-200" : "border-[#e7edf5]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="text-[30px] leading-none" aria-hidden="true">
            {application.countryFlag}
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-heading text-[17px] font-medium text-[#26364a]">
              {locale.startsWith("zh") ? application.countryNameZh : application.countryName}
            </h2>
            <p className="mt-1 truncate text-[13px] font-medium text-[#66758a]">
              {locale.startsWith("zh") ? application.visaTypeLabelZh : application.visaTypeLabel}
            </p>
          </div>
        </div>
        <StatusBadge state={application.state} t={t} />
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-[12px] font-semibold text-[#526174]">
          <span>{t("progress")}</span>
          <span>{application.progressPercent}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#eef3fa]">
          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${application.progressPercent}%` }} />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-[12px] text-[#66758a]">
        <span>{t("updated")}</span>
        <span className="font-semibold text-[#3d4b5f]">{formatDate(application.updatedAt ?? application.createdAt, locale)}</span>
      </div>
    </Link>
  );
}

function ActionLink({ action, t }: { action: StatusAction; t: Awaited<ReturnType<typeof getTranslations>> }) {
  const className = cn(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 py-2 text-[14px] font-semibold transition",
    action.primary
      ? "bg-brand-500 text-white hover:bg-brand-600"
      : "border border-[#dce5f0] bg-white text-brand-500 hover:border-brand-300",
  );

  if (action.href.startsWith("http")) {
    return (
      <a href={action.href} target="_blank" rel="noreferrer" className={className}>
        {t(`actions.${action.key}`)}
        {action.primary ? <Download className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
      </a>
    );
  }

  return (
    <Link href={action.href} className={className}>
      {t(`actions.${action.key}`)}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

function StepRow({
  application,
  step,
  locale,
  t,
}: {
  application: StatusApplication;
  step: StatusStep;
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const StepIcon = STEP_ICONS[step.key];
  const StateIcon = STATE_TONE[step.state].icon;
  const metric = formatStepMetric(application, step, locale, t);

  return (
    <li className={cn("rounded-[8px] border bg-white p-4", STATE_TONE[step.state].border)}>
      <div className="flex gap-3">
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full border", STATE_TONE[step.state].circle)}>
          <StepIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="font-heading text-[18px] font-medium text-[#26364a]">{t(`steps.${step.key}.title`)}</h3>
              <p className="mt-1 text-[14px] leading-6 text-[#66758a]">{t(`steps.${step.key}.description`)}</p>
            </div>
            <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", STATE_TONE[step.state].badge)}>
              <StateIcon className="h-3.5 w-3.5" />
              {t(`stepStates.${step.state}`)}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[#66758a]">
            {metric && (
              <span>
                {t("metric")}: <span className="font-semibold text-[#3d4b5f]">{metric}</span>
              </span>
            )}
            {step.statusValue && (
              <span>
                {t("status")}: <span className="font-semibold text-[#3d4b5f]">{humanize(step.statusValue)}</span>
              </span>
            )}
            {step.updatedAt && (
              <span>
                {t("updated")}: <span className="font-semibold text-[#3d4b5f]">{formatDateTime(step.updatedAt, locale)}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-[#edf1f6] bg-white px-4 py-3">
      <p className="text-[12px] font-medium text-[#8a94a3]">{label}</p>
      <p className="mt-1 break-words text-[15px] font-semibold text-[#26364a]">{value}</p>
    </div>
  );
}

function FileRow({ file, locale, t }: { file: StatusFile; locale: string; t: Awaited<ReturnType<typeof getTranslations>> }) {
  const Icon = FILE_ICONS[file.key];

  return (
    <div className="flex flex-col gap-3 rounded-[8px] border border-[#edf1f6] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="font-heading text-[16px] font-medium text-[#26364a]">{t(`files.${file.key}`)}</p>
          <p className="mt-1 truncate text-[13px] text-[#66758a]">{formatDate(file.createdAt, locale)}</p>
        </div>
      </div>
      {file.href ? (
        <a
          href={file.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#dce5f0] px-4 py-2 text-[14px] font-semibold text-brand-500 transition hover:border-brand-300"
        >
          {t("download")}
          <Download className="h-4 w-4" />
        </a>
      ) : (
        <span className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#dce5f0] px-4 py-2 text-[14px] font-semibold text-[#66758a]">
          {t("secureFileStored")}
        </span>
      )}
    </div>
  );
}

function EmptyState({ t }: { t: Awaited<ReturnType<typeof getTranslations>> }) {
  return (
    <section className="rounded-[8px] border border-dashed border-[#cbd8ea] bg-white px-6 py-14 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-500">
        <FileText className="h-6 w-6" />
      </div>
      <h2 className="mt-4 font-heading text-[24px] font-medium text-[#26364a]">{t("empty.title")}</h2>
      <p className="mx-auto mt-2 max-w-lg text-[15px] leading-6 text-[#66758a]">{t("empty.description")}</p>
      <Link
        href="/client/home"
        className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-500 px-5 py-2 text-[14px] font-semibold text-white transition hover:bg-brand-600"
      >
        {t("empty.cta")}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  );
}

function DetailView({
  application,
  locale,
  t,
}: {
  application: StatusApplication;
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <section className="rounded-[8px] border border-[#d9e5f4] bg-[#fbfdff] p-4 shadow-sm sm:p-5 lg:p-6">
      <div className="space-y-5">
      <section className="rounded-[8px] border border-[#e7edf5] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-4">
            <span className="text-[42px] leading-none" aria-hidden="true">
              {application.countryFlag}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-heading text-[28px] font-medium leading-tight text-[#26364a] sm:text-[34px]">
                  {locale.startsWith("zh") ? application.countryNameZh : application.countryName}
                </h2>
                <StatusBadge state={application.state} t={t} />
              </div>
              <p className="mt-2 text-[15px] font-medium text-[#66758a]">
                {locale.startsWith("zh") ? application.visaTypeLabelZh : application.visaTypeLabel}
              </p>
              {application.officialReference && (
                <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#dce5f0] bg-[#fbfdff] px-3 py-1.5 text-[13px] font-semibold text-[#3d4b5f]">
                  <Landmark className="h-4 w-4 text-brand-500" />
                  {application.officialReferenceKind === "official" ? t("officialReference") : t("vizaReference")}: {application.officialReference}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {application.actions.map((action) => (
              <ActionLink key={`${action.key}-${action.href}`} action={action} t={t} />
            ))}
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between text-[12px] font-semibold text-[#526174]">
            <span>{t("progress")}</span>
            <span>{application.progressPercent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#eef3fa]">
            <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${application.progressPercent}%` }} />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <section className="space-y-3">
          <div>
            <h2 className="font-heading text-[22px] font-medium text-[#26364a]">{t("timelineTitle")}</h2>
            <p className="mt-1 text-[14px] leading-6 text-[#66758a]">{t("timelineSubtitle")}</p>
          </div>
          <ol className="space-y-3">
            {application.steps.map((step) => (
              <StepRow key={step.key} application={application} step={step} locale={locale} t={t} />
            ))}
          </ol>
        </section>

        <aside className="space-y-5">
          <section>
            <h2 className="font-heading text-[22px] font-medium text-[#26364a]">{t("nextActionsTitle")}</h2>
            <div className="mt-3 space-y-2">
              {application.actions.map((action) => (
                <ActionLink key={`side-${action.key}-${action.href}`} action={action} t={t} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-heading text-[22px] font-medium text-[#26364a]">{t("referencesTitle")}</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <DetailMetric label={t("details.applicationId")} value={application.id ?? t("notCreated")} />
              <DetailMetric label={t("details.payment")} value={application.payment.status ? humanize(application.payment.status) : t("notStarted")} />
              <DetailMetric label={t("details.agencyFee")} value={formatMoney(application.payment.amountCents, application.payment.currency, locale)} />
              <DetailMetric label={t("details.governmentFee")} value={formatMoney(application.governmentFee.amountCents, application.governmentFee.currency, locale)} />
              <DetailMetric label={t("details.formAnswers")} value={String(application.formAnswerCount)} />
              <DetailMetric
                label={t("details.documents")}
                value={`${application.documents.uploaded + application.documents.validated}/${application.documents.total}`}
              />
              <DetailMetric label={t("details.externalStatus")} value={application.externalStatus ? humanize(application.externalStatus) : t("notAssigned")} />
              <DetailMetric label={t("details.resultStatus")} value={application.resultStatus ? humanize(application.resultStatus) : t("notAssigned")} />
              <DetailMetric label={t("details.notifications")} value={String(application.notifications.total)} />
            </div>
          </section>
        </aside>
      </div>

      <section>
        <h2 className="font-heading text-[22px] font-medium text-[#26364a]">{t("filesTitle")}</h2>
        <p className="mt-1 text-[14px] leading-6 text-[#66758a]">{t("filesSubtitle")}</p>
        {application.files.length > 0 ? (
          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {application.files.map((file) => (
              <FileRow key={`${file.key}-${file.reference}`} file={file} locale={locale} t={t} />
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-[8px] border border-dashed border-[#dce5f0] bg-white p-5 text-[14px] text-[#66758a]">
            {t("filesEmpty")}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-heading text-[22px] font-medium text-[#26364a]">{t("activityTitle")}</h2>
        {application.events.length > 0 ? (
          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
            {application.events.map((event) => (
              <div key={`${event.eventType}-${event.createdAt}`} className="rounded-[8px] border border-[#edf1f6] bg-white p-4">
                <p className="font-semibold text-[#26364a]">{formatEvent(event, t)}</p>
                <p className="mt-1 text-[13px] text-[#66758a]">{formatDateTime(event.createdAt, locale)}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-[8px] border border-dashed border-[#dce5f0] bg-white p-5 text-[14px] text-[#66758a]">
            {t("activityEmpty")}
          </div>
        )}
      </section>
      </div>
    </section>
  );
}

function Dashboard({
  data,
  selectedApplication,
  locale,
  t,
}: {
  data: ClientStatusData;
  selectedApplication: StatusApplication | null;
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const fileCount = data.applications.reduce((count, application) => count + application.files.length, 0);
  const nextActionCount = data.applications.reduce((count, application) => count + application.actions.filter((action) => action.primary).length, 0);
  const averageProgress = data.applications.length > 0
    ? Math.round(data.applications.reduce((sum, application) => sum + application.progressPercent, 0) / data.applications.length)
    : 0;

  return (
    <div className="mx-auto w-full max-w-[1180px] pb-14">
      <section className="pt-5 sm:pt-8">
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#6b7687]">{t("eyebrow")}</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-heading text-[32px] font-medium leading-tight text-[#26364a] sm:text-[42px]">{t("title")}</h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-6 text-[#66758a]">{t("subtitle")}</p>
          </div>
          <Link
            href="/client/home"
            className="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-full border border-[#dce5f0] bg-white px-4 py-2 text-[14px] font-semibold text-brand-500 transition hover:border-brand-300"
          >
            {t("chooseDestination")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatPanel label={t("stats.applications")} value={String(data.applications.length)} icon={FileText} />
        <StatPanel label={t("stats.averageProgress")} value={`${averageProgress}%`} icon={CheckCircle2} />
        <StatPanel label={t("stats.nextActions")} value={String(nextActionCount)} icon={Upload} />
        <StatPanel label={t("stats.files")} value={String(fileCount)} icon={Download} />
      </div>

      {data.applications.length === 0 ? (
        <div className="mt-6">
          <EmptyState t={t} />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
          <aside className="rounded-[8px] border border-[#d9e5f4] bg-[#fbfdff] p-4 shadow-sm sm:p-5">
            <h2 className="font-heading text-[22px] font-medium text-[#26364a]">{t("applicationsTitle")}</h2>
            <div className="mt-4 space-y-3">
              {data.applications.map((application) => (
                <ApplicationCard
                  key={getSelectionKey(application)}
                  application={application}
                  selected={selectedApplication ? getSelectionKey(application) === getSelectionKey(selectedApplication) : false}
                  locale={locale}
                  t={t}
                />
              ))}
            </div>
          </aside>
          {selectedApplication && <DetailView application={selectedApplication} locale={locale} t={t} />}
        </div>
      )}
    </div>
  );
}

export default async function ClientStatusPage({ searchParams }: { searchParams?: SearchParams }) {
  const hasSession = await hasClientSession();
  if (!hasSession) redirect("/client/login");

  const params = searchParams ? await searchParams : {};
  const [t, locale, data] = await Promise.all([
    getTranslations("clientStatus"),
    getLocale(),
    getClientStatusData(),
  ]);

  const selectedApplicationId = getParam(params.applicationId);
  const selectedPackageId = getParam(params.packageId);
  const selectedApplication =
    data.applications.find((application) => application.id && application.id === selectedApplicationId) ??
    data.applications.find((application) => application.packageId && application.packageId === selectedPackageId) ??
    data.applications[0] ??
    null;

  return <Dashboard data={data} selectedApplication={selectedApplication} locale={locale} t={t} />;
}

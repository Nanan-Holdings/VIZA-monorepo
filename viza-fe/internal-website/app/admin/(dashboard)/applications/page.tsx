import Link from "next/link";
import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarClock,
  FileText,
  Filter,
  PackageCheck,
  RotateCcw,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/rbac";
import { normalizeInterfaceLocale, type InterfaceLocale } from "@/lib/i18n/locale";
import {
  type AdminApplicantOverview,
  type AdminApplicationModel,
  type ConsentState,
  type DocumentState,
  type ExternalState,
  type LifecycleState,
  type PacketState,
  type PaymentState,
  type ResultState,
  fetchAdminApplicantQueue,
  getLifecycleProgressPercent,
} from "./data";
import { EmptyState, ErrorPanel, MetricTile, StatusPill, getToneForState } from "./ui";
import {
  ADMIN_APPLICATION_COPY,
  type AdminApplicationCopy,
  formatAdminDateTime,
  localizeMissingItem,
} from "./copy";

type SearchParams = Record<string, string | string[] | undefined>;

interface PageProps {
  searchParams?: Promise<SearchParams>;
}

export const dynamic = "force-dynamic";

interface ActiveFilters {
  lifecycle: LifecycleState | "all";
  payment: PaymentState | "all";
  consent: ConsentState | "all";
  documents: DocumentState | "all";
  packet: PacketState | "all";
  external: ExternalState | "all";
  result: ResultState | "all";
  q: string; // 融合：加入模糊搜索字段
}

const LIFECYCLE_OPTIONS: LifecycleState[] = [
  "intake",
  "payment_pending",
  "consent_pending",
  "document_collection",
  "packet_generation",
  "ready_for_external_handoff",
  "external_submission",
  "result_delivery",
  "completed",
  "attention",
];
const PAYMENT_OPTIONS: PaymentState[] = ["missing", "pending", "paid", "failed", "refunded"];
const CONSENT_OPTIONS: ConsentState[] = ["missing", "missing_signature", "complete", "declined"];
const DOCUMENT_OPTIONS: DocumentState[] = ["not_started", "missing", "complete", "rejected"];
const PACKET_OPTIONS: PacketState[] = ["not_started", "generating", "ready", "failed"];
const EXTERNAL_OPTIONS: ExternalState[] = [
  "not_handed_off",
  "ready_for_handoff",
  "in_progress",
  "submitted",
  "approved",
  "rejected",
  "attention",
];
const RESULT_OPTIONS: ResultState[] = ["none", "pending", "received", "delivered", "approved", "rejected"];

function firstParam(searchParams: SearchParams, key: string): string | undefined {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function getFilterValue<T extends string>(
  searchParams: SearchParams,
  key: string,
  allowed: readonly T[],
): T | "all" {
  const value = firstParam(searchParams, key);
  return value && allowed.includes(value as T) ? (value as T) : "all";
}

function parseFilters(searchParams: SearchParams): ActiveFilters {
  return {
    lifecycle: getFilterValue(searchParams, "lifecycle", LIFECYCLE_OPTIONS),
    payment: getFilterValue(searchParams, "payment", PAYMENT_OPTIONS),
    consent: getFilterValue(searchParams, "consent", CONSENT_OPTIONS),
    documents: getFilterValue(searchParams, "documents", DOCUMENT_OPTIONS),
    packet: getFilterValue(searchParams, "packet", PACKET_OPTIONS),
    external: getFilterValue(searchParams, "external", EXTERNAL_OPTIONS),
    result: getFilterValue(searchParams, "result", RESULT_OPTIONS),
    q: firstParam(searchParams, "q")?.trim() || "", // 融合：解析搜索关键字
  };
}

function matchesApplicationFilters(row: AdminApplicationModel, filters: ActiveFilters): boolean {
  return (
    (filters.lifecycle === "all" || row.lifecycleState === filters.lifecycle) &&
    (filters.payment === "all" || row.payment.state === filters.payment) &&
    (filters.consent === "all" || row.consent.state === filters.consent) &&
    (filters.documents === "all" || row.documents.state === filters.documents) &&
    (filters.packet === "all" || row.packet.state === filters.packet) &&
    (filters.external === "all" || row.external.state === filters.external) &&
    (filters.result === "all" || row.result.state === filters.result)
  );
}

function matchesApplicantFilters(applicant: AdminApplicantOverview, filters: ActiveFilters): boolean {
  // 基础的状态筛选
  const matchesStatus = applicant.applications.some((application) => 
    matchesApplicationFilters(application, filters)
  );
  if (!matchesStatus) return false;

  // 融合：本地客户端进行文本模糊匹配 (ID、姓名、邮箱)
  if (filters.q) {
    const term = filters.q.toLowerCase();
    const nameMatch = (applicant.profile?.full_name ?? "").toLowerCase().includes(term);
    const emailMatch = (applicant.profile?.email ?? "").toLowerCase().includes(term);
    const idMatch = applicant.applicantId.toLowerCase().includes(term);
    return nameMatch || emailMatch || idMatch;
  }

  return true;
}

function averageProgress(applicants: AdminApplicantOverview[]): number {
  if (applicants.length === 0) return 0;
  return Math.round(
    applicants.reduce((sum, applicant) => sum + applicant.completionPercent, 0) / applicants.length,
  );
}

function FilterSelect<T extends string>({
  label,
  name,
  value,
  options,
  labels,
  allLabel,
}: {
  label: string;
  name: keyof ActiveFilters;
  value: T | "all";
  options: readonly T[];
  labels: Record<T, string>;
  allLabel: string;
}) {
  return (
    <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-xs font-medium text-[#6b6b6b]">
      {label}
      <select
        name={name}
        defaultValue={value}
        className="h-10 rounded-md border border-[#d7d7d7] bg-white px-3 text-sm font-medium text-[#232323] outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
      >
        <option value="all">{allLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {labels[option]}
          </option>
        ))}
      </select>
    </label>
  );
}

function QueueFilters({
  filters,
  copy,
}: {
  filters: ActiveFilters;
  copy: AdminApplicationCopy;
}) {
  return (
    <form method="get" className="rounded-lg border border-[#efefef] bg-white p-4 shadow-sm space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-[#232323]">
        <Filter className="h-4 w-4 text-brand-500" />
        {copy.list.filtersTitle}
      </div>
      
      {/* 融合：在筛选器上方单开一行放搜索框，体验更好 */}
      <div className="flex flex-col gap-1 text-xs font-medium text-[#6b6b6b]">
        <span className="mb-1">{copy.list.search}</span>
        <input
          type="search"
          name="q"
          placeholder={copy.list.searchPlaceholder}
          defaultValue={filters.q}
          className="h-10 w-full rounded-md border border-[#d7d7d7] bg-white px-3 text-sm font-medium text-[#232323] outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <FilterSelect
          label={copy.list.lifecycle}
          name="lifecycle"
          value={filters.lifecycle}
          options={LIFECYCLE_OPTIONS}
          labels={copy.status.lifecycle}
          allLabel={copy.common.all}
        />
        <FilterSelect
          label={copy.list.payment}
          name="payment"
          value={filters.payment}
          options={PAYMENT_OPTIONS}
          labels={copy.status.payment}
          allLabel={copy.common.all}
        />
        <FilterSelect
          label={copy.list.consent}
          name="consent"
          value={filters.consent}
          options={CONSENT_OPTIONS}
          labels={copy.status.consent}
          allLabel={copy.common.all}
        />
        <FilterSelect
          label={copy.list.missingDocuments}
          name="documents"
          value={filters.documents}
          options={DOCUMENT_OPTIONS}
          labels={copy.status.documents}
          allLabel={copy.common.all}
        />
        <FilterSelect
          label={copy.list.packet}
          name="packet"
          value={filters.packet}
          options={PACKET_OPTIONS}
          labels={copy.status.packet}
          allLabel={copy.common.all}
        />
        <FilterSelect
          label={copy.list.externalStatus}
          name="external"
          value={filters.external}
          options={EXTERNAL_OPTIONS}
          labels={copy.status.external}
          allLabel={copy.common.all}
        />
        <FilterSelect
          label={copy.list.result}
          name="result"
          value={filters.result}
          options={RESULT_OPTIONS}
          labels={copy.status.result}
          allLabel={copy.common.all}
        />
        <div className="flex items-end gap-2">
          <Button type="submit" className="h-10 bg-brand-500 text-white hover:bg-brand-600 flex-1">
            {copy.list.apply}
          </Button>
          <Button asChild variant="outline" className="h-10 border-[#d7d7d7]">
            <Link href="/admin/applications">
              <RotateCcw className="h-4 w-4" />
              {copy.list.reset}
            </Link>
          </Button>
        </div>
      </div>
    </form>
  );
}

function UserCard({
  applicant,
  copy,
  locale,
}: {
  applicant: AdminApplicantOverview;
  copy: AdminApplicationCopy;
  locale: InterfaceLocale;
}) {
  const profile = applicant.profile;
  const primaryPackage = applicant.packages[0] ?? null;
  const latestApplication = applicant.latestApplication;
  const visibleMissingItems = applicant.missingItems.slice(0, 3);

  return (
    <Link
      href={`/admin/applications/${applicant.applicantId}`}
      className="group block rounded-lg border border-[#efefef] bg-white p-5 shadow-sm transition hover:border-brand-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-500"
    >
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 space-y-4 xl:w-[28%]">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500">
              <UserRound className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-brand-500 group-hover:underline">
                {profile?.full_name || copy.common.unnamedApplicant}
              </h2>
              <p className="mt-1 truncate text-sm text-[#6b6b6b]">{profile?.email || copy.common.noEmail}</p>
              <p className="mt-1 text-xs text-[#9ca3af]">{applicant.applicantId.slice(0, 8)}...</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <StatusPill tone={getToneForState(applicant.lifecycleState)}>
              {copy.status.lifecycle[applicant.lifecycleState]}
            </StatusPill>
            {applicant.needsSupportCount > 0 && (
              <StatusPill tone="warning">{copy.list.needsSupport(applicant.needsSupportCount)}</StatusPill>
            )}
          </div>
        </div>

        <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.04em] text-[#7a7a7a]">
              <PackageCheck className="h-4 w-4" />
              {copy.list.package}
            </div>
            <p className="mt-2 truncate text-sm font-semibold text-[#232323]">
              {primaryPackage?.packageName || copy.common.noPackageAssigned}
            </p>
            <p className="mt-1 text-xs leading-5 text-[#6b6b6b]">
              {applicant.activePackageCount} {copy.common.active} / {applicant.packages.length} {copy.common.total}
            </p>
            <p className="mt-1 text-xs leading-5 text-[#6b6b6b]">
              {copy.common.expires}: {applicant.earliestExpiryAt ? formatAdminDateTime(applicant.earliestExpiryAt, locale, copy.common.notRecorded) : copy.common.noExpiry}
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.04em] text-[#7a7a7a]">
              <FileText className="h-4 w-4" />
              {copy.list.applications}
            </div>
            <p className="mt-2 text-sm font-semibold text-[#232323]">
              {applicant.applicationCount} {applicant.applicationCount === 1 ? copy.common.applicationSingular : copy.common.applicationPlural}
            </p>
            <p className="mt-1 text-xs leading-5 text-[#6b6b6b]">
              {applicant.countries.join(", ") || copy.common.noDestination}
            </p>
            <p className="mt-1 text-xs leading-5 text-[#6b6b6b]">
              {copy.common.latest}: {latestApplication?.countryLabel || copy.common.noApplication}
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.04em] text-[#7a7a7a]">
              <CalendarClock className="h-4 w-4" />
              {copy.common.progress}
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#edf1f6]">
              <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${applicant.completionPercent}%` }}
              />
            </div>
            <p className="mt-2 text-sm font-semibold text-[#232323]">{applicant.completionPercent}% {copy.common.complete}</p>
            <p className="mt-1 text-xs leading-5 text-[#6b6b6b]">
              {copy.common.bestApplication}: {latestApplication ? getLifecycleProgressPercent(latestApplication) : 0}%
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[#7a7a7a]">{copy.list.supportNotes}</p>
            {visibleMissingItems.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs leading-5 text-[#6b6b6b]">
                {visibleMissingItems.map((item) => (
                  <li key={item}>{localizeMissingItem(item, copy)}</li>
                ))}
                {applicant.missingItems.length > visibleMissingItems.length && (
                  <li>{copy.list.needsSupport(applicant.missingItems.length - visibleMissingItems.length)}</li>
                )}
              </ul>
            ) : (
              <p className="mt-2 text-xs font-medium text-emerald-700">{copy.common.noBlockingItems}</p>
            )}
            <p className="mt-3 text-xs text-[#9ca3af]">
              {copy.common.updated} {formatAdminDateTime(applicant.latestUpdatedAt, locale, copy.common.notRecorded)}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end text-sm font-semibold text-brand-500">
          {copy.common.viewOverview}
          <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}

export default async function AdminApplicationsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/admin/login");
  const locale = normalizeInterfaceLocale(await getLocale());
  const copy = ADMIN_APPLICATION_COPY[locale];

  const resolvedSearchParams = (await searchParams) ?? {};
  const filters = parseFilters(resolvedSearchParams);
  
  // 仍然使用 HEAD 的统一队列获取函数
  const { applicants, applications, error } = await fetchAdminApplicantQueue();
  
  // 经过“多维状态筛选”加“远端文本关键字检索”过滤后的列表
  const filteredApplicants = applicants.filter((applicant) => matchesApplicantFilters(applicant, filters));

  const metrics = [
    { label: copy.list.metrics.users, value: applicants.length, tone: "neutral" as const },
    { label: copy.list.metrics.applications, value: applications.length, tone: "brand" as const },
    {
      label: copy.list.metrics.needSupport,
      value: applicants.filter((applicant) => applicant.needsSupportCount > 0).length,
      tone: "warning" as const,
    },
    {
      label: copy.list.metrics.avgProgress,
      value: `${averageProgress(applicants)}%`,
      tone: "success" as const,
    },
  ];

  return (
    <div className="w-full space-y-6 p-6 md:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#232323]">{copy.list.title}</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[#6b6b6b]">
            {copy.list.subtitle}
          </p>
        </div>
        <p className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-500">
          {copy.list.badge}
        </p>
      </div>

      {error ? (
        <ErrorPanel title={copy.errors.applicationLoadTitle} message={error} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <MetricTile key={metric.label} label={metric.label} value={metric.value} tone={metric.tone} />
            ))}
          </div>

          <QueueFilters filters={filters} copy={copy} />

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-[#232323]">{copy.list.cardsTitle}</h2>
                <p className="mt-1 text-sm text-[#6b6b6b]">
                  {copy.list.showingUsers(filteredApplicants.length, applicants.length)}
                </p>
              </div>
            </div>

            {applicants.length === 0 ? (
              <EmptyState
                title={copy.list.noUsersTitle}
                body={copy.list.noUsersBody}
              />
            ) : filteredApplicants.length === 0 ? (
              <EmptyState
                title={copy.list.noMatchesTitle}
                body={copy.list.noMatchesBody}
              />
            ) : (
              <div className="space-y-3">
                {filteredApplicants.map((applicant) => (
                  <UserCard key={applicant.applicantId} applicant={applicant} copy={copy} locale={locale} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

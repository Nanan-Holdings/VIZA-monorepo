import Link from "next/link";
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
import {
  CONSENT_LABELS,
  DOCUMENT_LABELS,
  EXTERNAL_LABELS,
  LIFECYCLE_LABELS,
  PACKET_LABELS,
  PAYMENT_LABELS,
  RESULT_LABELS,
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
  formatDateTime,
  getLifecycleProgressPercent,
} from "./data";
import { EmptyState, ErrorPanel, MetricTile, StatusPill, getToneForState } from "./ui";

type SearchParams = Record<string, string | string[] | undefined>;

interface PageProps {
  searchParams?: Promise<SearchParams>;
}

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

const LIFECYCLE_OPTIONS = Object.keys(LIFECYCLE_LABELS) as LifecycleState[];
const PAYMENT_OPTIONS = Object.keys(PAYMENT_LABELS) as PaymentState[];
const CONSENT_OPTIONS = Object.keys(CONSENT_LABELS) as ConsentState[];
const DOCUMENT_OPTIONS = Object.keys(DOCUMENT_LABELS) as DocumentState[];
const PACKET_OPTIONS = Object.keys(PACKET_LABELS) as PacketState[];
const EXTERNAL_OPTIONS = Object.keys(EXTERNAL_LABELS) as ExternalState[];
const RESULT_OPTIONS = Object.keys(RESULT_LABELS) as ResultState[];

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
}: {
  label: string;
  name: keyof ActiveFilters;
  value: T | "all";
  options: readonly T[];
  labels: Record<T, string>;
}) {
  return (
    <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-xs font-medium text-[#6b6b6b]">
      {label}
      <select
        name={name}
        defaultValue={value}
        className="h-10 rounded-md border border-[#d7d7d7] bg-white px-3 text-sm font-medium text-[#232323] outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
      >
        <option value="all">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {labels[option]}
          </option>
        ))}
      </select>
    </label>
  );
}

function QueueFilters({ filters }: { filters: ActiveFilters }) {
  return (
    <form method="get" className="rounded-lg border border-[#efefef] bg-white p-4 shadow-sm space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-[#232323]">
        <Filter className="h-4 w-4 text-brand-500" />
        User filters
      </div>
      
      {/* 融合：在筛选器上方单开一行放搜索框，体验更好 */}
      <div className="flex flex-col gap-1 text-xs font-medium text-[#6b6b6b]">
        <span className="mb-1">Search Applicant</span>
        <input
          type="search"
          name="q"
          placeholder="Search by ID, name, or email..."
          defaultValue={filters.q}
          className="h-10 w-full rounded-md border border-[#d7d7d7] bg-white px-3 text-sm font-medium text-[#232323] outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <FilterSelect
          label="Lifecycle"
          name="lifecycle"
          value={filters.lifecycle}
          options={LIFECYCLE_OPTIONS}
          labels={LIFECYCLE_LABELS}
        />
        <FilterSelect
          label="Payment"
          name="payment"
          value={filters.payment}
          options={PAYMENT_OPTIONS}
          labels={PAYMENT_LABELS}
        />
        <FilterSelect
          label="Consent"
          name="consent"
          value={filters.consent}
          options={CONSENT_OPTIONS}
          labels={CONSENT_LABELS}
        />
        <FilterSelect
          label="Missing documents"
          name="documents"
          value={filters.documents}
          options={DOCUMENT_OPTIONS}
          labels={DOCUMENT_LABELS}
        />
        <FilterSelect
          label="Packet"
          name="packet"
          value={filters.packet}
          options={PACKET_OPTIONS}
          labels={PACKET_LABELS}
        />
        <FilterSelect
          label="External status"
          name="external"
          value={filters.external}
          options={EXTERNAL_OPTIONS}
          labels={EXTERNAL_LABELS}
        />
        <FilterSelect
          label="Result"
          name="result"
          value={filters.result}
          options={RESULT_OPTIONS}
          labels={RESULT_LABELS}
        />
        <div className="flex items-end gap-2">
          <Button type="submit" className="h-10 bg-brand-500 text-white hover:bg-brand-600 flex-1">
            Apply
          </Button>
          <Button asChild variant="outline" className="h-10 border-[#d7d7d7]">
            <Link href="/admin/applications">
              <RotateCcw className="h-4 w-4" />
              Reset
            </Link>
          </Button>
        </div>
      </div>
    </form>
  );
}

function UserCard({ applicant }: { applicant: AdminApplicantOverview }) {
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
                {profile?.full_name || "Unnamed applicant"}
              </h2>
              <p className="mt-1 truncate text-sm text-[#6b6b6b]">{profile?.email || "No email recorded"}</p>
              <p className="mt-1 text-xs text-[#9ca3af]">{applicant.applicantId.slice(0, 8)}...</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <StatusPill tone={getToneForState(applicant.lifecycleState)}>
              {LIFECYCLE_LABELS[applicant.lifecycleState]}
            </StatusPill>
            {applicant.needsSupportCount > 0 && (
              <StatusPill tone="warning">{applicant.needsSupportCount} needs support</StatusPill>
            )}
          </div>
        </div>

        <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.04em] text-[#7a7a7a]">
              <PackageCheck className="h-4 w-4" />
              Package
            </div>
            <p className="mt-2 truncate text-sm font-semibold text-[#232323]">
              {primaryPackage?.packageName || "No package assigned"}
            </p>
            <p className="mt-1 text-xs leading-5 text-[#6b6b6b]">
              {applicant.activePackageCount} active / {applicant.packages.length} total
            </p>
            <p className="mt-1 text-xs leading-5 text-[#6b6b6b]">
              Expires: {applicant.earliestExpiryAt ? formatDateTime(applicant.earliestExpiryAt) : "No expiry set"}
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.04em] text-[#7a7a7a]">
              <FileText className="h-4 w-4" />
              Applications
            </div>
            <p className="mt-2 text-sm font-semibold text-[#232323]">
              {applicant.applicationCount} application{applicant.applicationCount === 1 ? "" : "s"}
            </p>
            <p className="mt-1 text-xs leading-5 text-[#6b6b6b]">
              {applicant.countries.join(", ") || "No destination"}
            </p>
            <p className="mt-1 text-xs leading-5 text-[#6b6b6b]">
              Latest: {latestApplication?.countryLabel || "No application"}
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.04em] text-[#7a7a7a]">
              <CalendarClock className="h-4 w-4" />
              Progress
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#edf1f6]">
              <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${applicant.completionPercent}%` }}
              />
            </div>
            <p className="mt-2 text-sm font-semibold text-[#232323]">{applicant.completionPercent}% complete</p>
            <p className="mt-1 text-xs leading-5 text-[#6b6b6b]">
              Best app: {latestApplication ? getLifecycleProgressPercent(latestApplication) : 0}%
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[#7a7a7a]">Support notes</p>
            {visibleMissingItems.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs leading-5 text-[#6b6b6b]">
                {visibleMissingItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
                {applicant.missingItems.length > visibleMissingItems.length && (
                  <li>{applicant.missingItems.length - visibleMissingItems.length} more</li>
                )}
              </ul>
            ) : (
              <p className="mt-2 text-xs font-medium text-emerald-700">No blocking support items</p>
            )}
            <p className="mt-3 text-xs text-[#9ca3af]">
              Updated {formatDateTime(applicant.latestUpdatedAt)}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end text-sm font-semibold text-brand-500">
          View overview
          <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}

export default async function AdminApplicationsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/admin/login");

  const resolvedSearchParams = (await searchParams) ?? {};
  const filters = parseFilters(resolvedSearchParams);
  
  // 仍然使用 HEAD 的统一队列获取函数
  const { applicants, applications, error } = await fetchAdminApplicantQueue();
  
  // 经过“多维状态筛选”加“远端文本关键字检索”过滤后的列表
  const filteredApplicants = applicants.filter((applicant) => matchesApplicantFilters(applicant, filters));

  const metrics = [
    { label: "Users", value: applicants.length, tone: "neutral" as const },
    { label: "Applications", value: applications.length, tone: "brand" as const },
    {
      label: "Need support",
      value: applicants.filter((applicant) => applicant.needsSupportCount > 0).length,
      tone: "warning" as const,
    },
    {
      label: "Avg progress",
      value: `${averageProgress(applicants)}%`,
      tone: "success" as const,
    },
  ];

  return (
    <div className="w-full space-y-6 p-6 md:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#232323]">Application Monitoring</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[#6b6b6b]">
            One card per user with package, expiry, application count, progress, and support status.
          </p>
        </div>
        <p className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-500">
          Monitor and support only
        </p>
      </div>

      {error ? (
        <ErrorPanel message={error} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <MetricTile key={metric.label} label={metric.label} value={metric.value} tone={metric.tone} />
            ))}
          </div>

          <QueueFilters filters={filters} />

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-[#232323]">User overview cards</h2>
                <p className="mt-1 text-sm text-[#6b6b6b]">
                  Showing {filteredApplicants.length} of {applicants.length} users
                </p>
              </div>
            </div>

            {applicants.length === 0 ? (
              <EmptyState
                title="No users with applications"
                body="Users will appear here once an applicant starts a visa workflow."
              />
            ) : filteredApplicants.length === 0 ? (
              <EmptyState
                title="No matching users"
                body="Adjust the filters or search term to see more user overview cards."
              />
            ) : (
              <div className="space-y-3">
                {filteredApplicants.map((applicant) => (
                  <UserCard key={applicant.applicantId} applicant={applicant} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CircleDot,
  FileText,
  Mail,
  PackageCheck,
  UserRound,
} from "lucide-react";
import { getCurrentUser } from "@/lib/rbac";
import { SmoothProgressMeter } from "@/components/smooth-progress";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeInterfaceLocale, type InterfaceLocale } from "@/lib/i18n/locale";
import { RealtimeApplicationStatus } from "./realtime-status";
import {
  type AdminApplicantOverview,
  type AdminApplicationModel,
  fetchAdminApplicantDetail,
  getLifecycleProgressPercent,
  shortenId,
} from "../data";
import {
  EmptyState,
  ErrorPanel,
  FieldValue,
  SectionPanel,
  StatusPill,
  getToneForState,
} from "../ui";
import { SupportActions } from "../support-actions";
import {
  ADMIN_APPLICATION_COPY,
  type AdminApplicationCopy,
  buildLocalizedStatusSummary,
  formatAdminDateTime,
  localizeMissingItem,
  maskPassportForLocale,
} from "../copy";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

interface RunnerJobRow {
  id: string;
  status: string;
  attempts: number;
  enqueued_at: string;
  started_at: string | null;
  finished_at: string | null;
  last_error: string | null;
  application_id: string;
}

interface OrderRow {
  id: string;
  status: string;
  agency_fee_cents: number;
  govt_fee_cents: number;
  currency: string;
  paid_at: string | null;
  application_id: string;
}

interface InboundRow {
  id: string;
  from_addr: string;
  subject: string | null;
  received_at: string;
  processed: boolean;
}

interface ApplicantProfileWithAlias {
  inbox_alias?: string | null;
}

function firstParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function localizeStatusText(status: string, locale: InterfaceLocale): string {
  if (locale === "en") return status.replaceAll("_", " ");

  const labels: Record<string, string> = {
    active: "启用",
    linked: "已关联",
    draft: "草稿",
    pending: "待处理",
    processing: "处理中",
    submitted: "已提交",
    approved: "已批准",
    rejected: "已拒绝",
    completed: "已完成",
    failed: "失败",
    queued: "排队中",
    running: "运行中",
    paid: "已付款",
    refunded: "已退款",
  };

  return labels[status.toLowerCase()] ?? status.replaceAll("_", " ");
}

function ActionMessage({
  queued,
  error,
  copy,
}: {
  queued: boolean;
  error: boolean;
  copy: AdminApplicationCopy;
}) {
  if (!queued && !error) return null;
  return (
    <div
      className={[
        "rounded-lg border px-4 py-3 text-sm font-medium",
        queued
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-700",
      ].join(" ")}
    >
      {queued ? copy.detail.queued : copy.detail.actionError}
    </div>
  );
}

function UserSummaryHeader({
  applicant,
  copy,
}: {
  applicant: AdminApplicantOverview;
  copy: AdminApplicationCopy;
}) {
  const profile = applicant.profile;
  const latestApplication = applicant.latestApplication;
  const summary = latestApplication ? buildLocalizedStatusSummary(latestApplication, copy) : "";

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-[#efefef] bg-white p-5 shadow-sm xl:flex-row xl:items-start xl:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500">
            <UserRound className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-[#232323]">
                {profile?.full_name || copy.common.unnamedApplicant}
              </h1>
              <StatusPill tone={getToneForState(applicant.lifecycleState)}>
                {copy.status.lifecycle[applicant.lifecycleState]}
              </StatusPill>
            </div>
            <p className="mt-2 text-sm text-[#6b6b6b]">
              {applicant.packageNames.join(", ") || copy.common.noPackageAssigned} - {applicant.applicationCount}{" "}
              {applicant.applicationCount === 1 ? copy.common.applicationSingular : copy.common.applicationPlural}
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm text-[#6b6b6b]">
              <Mail className="h-4 w-4" />
              {profile?.email || copy.common.noEmail}
            </p>
          </div>
        </div>
      </div>

      {latestApplication && (
        <SupportActions
          applicationId={latestApplication.id}
          applicantEmail={profile?.email ?? null}
          summaryText={summary}
          returnTo={`/admin/applications/${applicant.applicantId}`}
        />
      )}
    </div>
  );
}

function OverviewMetrics({
  applicant,
  copy,
  locale,
}: {
  applicant: AdminApplicantOverview;
  copy: AdminApplicationCopy;
  locale: InterfaceLocale;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-lg border border-[#efefef] bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[#6b6b6b]">
          <FileText className="h-4 w-4 text-brand-500" />
          {copy.detail.metrics.applications}
        </div>
        <p className="mt-2 text-2xl font-semibold text-[#232323]">{applicant.applicationCount}</p>
        <p className="mt-1 text-xs text-[#6b6b6b]">{applicant.countries.join(", ") || copy.common.noDestination}</p>
      </div>

      <div className="rounded-lg border border-[#efefef] bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[#6b6b6b]">
          <PackageCheck className="h-4 w-4 text-brand-500" />
          {copy.detail.metrics.packages}
        </div>
        <p className="mt-2 text-2xl font-semibold text-[#232323]">{applicant.packages.length}</p>
        <p className="mt-1 text-xs text-[#6b6b6b]">{applicant.activePackageCount} {copy.common.active}</p>
      </div>

      <div className="rounded-lg border border-[#efefef] bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[#6b6b6b]">
          <CalendarClock className="h-4 w-4 text-brand-500" />
          {copy.detail.metrics.earliestExpiry}
        </div>
        <p className="mt-2 text-sm font-semibold text-[#232323]">
          {applicant.earliestExpiryAt ? formatAdminDateTime(applicant.earliestExpiryAt, locale, copy.common.notRecorded) : copy.common.noExpiry}
        </p>
        <p className="mt-1 text-xs text-[#6b6b6b]">
          {copy.detail.metrics.latestUpdate} {formatAdminDateTime(applicant.latestUpdatedAt, locale, copy.common.notRecorded)}
        </p>
      </div>

      <div className="rounded-lg border border-[#efefef] bg-white px-4 py-3 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-[#6b6b6b]">{copy.detail.metrics.overallProgress}</p>
        <SmoothProgressMeter
          serverProgress={applicant.completionPercent}
          status={applicant.completionPercent >= 100 ? "completed" : "running"}
          intervalMs={140}
          className="mt-3"
          valueClassName="text-2xl font-semibold text-[#232323]"
          trackClassName="bg-[#edf1f6]"
        />
      </div>
    </div>
  );
}

function ApplicantProfile({
  applicant,
  copy,
  locale,
}: {
  applicant: AdminApplicantOverview;
  copy: AdminApplicationCopy;
  locale: InterfaceLocale;
}) {
  const profile = applicant.profile;

  return (
    <SectionPanel title={copy.detail.userOverview} description={copy.detail.userOverviewDescription}>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <FieldValue label={copy.detail.profile.name} value={profile?.full_name || copy.common.unnamedApplicant} fallback={copy.common.notRecorded} />
        <FieldValue label={copy.detail.profile.email} value={profile?.email || copy.common.notProvided} fallback={copy.common.notRecorded} />
        <FieldValue label={copy.detail.profile.phone} value={profile?.phone || copy.common.notProvided} fallback={copy.common.notRecorded} />
        <FieldValue label={copy.detail.profile.nationality} value={profile?.nationality || copy.common.notProvided} fallback={copy.common.notRecorded} />
        <FieldValue label={copy.detail.profile.passport} value={maskPassportForLocale(profile?.passport_number ?? null, copy)} fallback={copy.common.notRecorded} />
        <FieldValue label={copy.detail.profile.passportExpiry} value={profile?.passport_expiry_date || copy.common.notProvided} fallback={copy.common.notRecorded} />
        <FieldValue label={copy.detail.profile.language} value={profile?.language_pref || copy.common.notProvided} fallback={copy.common.notRecorded} />
        <FieldValue label={copy.detail.profile.created} value={formatAdminDateTime(profile?.created_at, locale, copy.common.notRecorded)} fallback={copy.common.notRecorded} />
      </dl>
    </SectionPanel>
  );
}

function PackageOverview({
  applicant,
  copy,
  locale,
}: {
  applicant: AdminApplicantOverview;
  copy: AdminApplicationCopy;
  locale: InterfaceLocale;
}) {
  return (
    <SectionPanel title={copy.detail.packages} description={copy.detail.packagesDescription}>
      {applicant.packages.length === 0 ? (
        <EmptyState title={copy.detail.noPackagesTitle} body={copy.detail.noPackagesBody} />
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {applicant.packages.map((pkg) => (
            <div key={pkg.id} className="rounded-lg border border-[#efefef] bg-[#fafafa] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[#232323]">{pkg.packageName}</p>
                  <p className="mt-1 text-sm text-[#6b6b6b]">
                    {pkg.countryLabel} - {pkg.visaTypeLabel}
                  </p>
                </div>
                <StatusPill tone={pkg.status === "active" ? "success" : "neutral"}>{localizeStatusText(pkg.status, locale)}</StatusPill>
              </div>
              <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <FieldValue label={copy.detail.assigned} value={formatAdminDateTime(pkg.assignedAt, locale, copy.common.notRecorded)} fallback={copy.common.notRecorded} />
                <FieldValue label={copy.common.expires} value={pkg.expiresAt ? formatAdminDateTime(pkg.expiresAt, locale, copy.common.notRecorded) : copy.common.noExpiry} fallback={copy.common.notRecorded} />
                <FieldValue label={copy.detail.price} value={pkg.priceLabel} fallback={copy.common.notRecorded} />
              </dl>
            </div>
          ))}
        </div>
      )}
    </SectionPanel>
  );
}

function SupportItems({
  applicant,
  copy,
}: {
  applicant: AdminApplicantOverview;
  copy: AdminApplicationCopy;
}) {
  return (
    <SectionPanel title={copy.common.supportItems} description={copy.detail.supportItemsDescription}>
      {applicant.missingItems.length === 0 ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {copy.common.noBlockingItemsLong}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {applicant.missingItems.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm leading-6 text-[#45556c]">
              <CircleDot className="mt-1 h-4 w-4 shrink-0 text-amber-600" />
              <span>{localizeMissingItem(item, copy)}</span>
            </li>
          ))}
        </ul>
      )}
    </SectionPanel>
  );
}

function ApplicationCard({
  application,
  copy,
  locale,
}: {
  application: AdminApplicationModel;
  copy: AdminApplicationCopy;
  locale: InterfaceLocale;
}) {
  const progress = getLifecycleProgressPercent(application);

  return (
    <div className="rounded-lg border border-[#efefef] bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-[#232323]">
              {application.countryLabel} - {application.visaTypeLabel}
            </h3>
            <StatusPill tone={getToneForState(application.lifecycleState)}>
              {copy.status.lifecycle[application.lifecycleState]}
            </StatusPill>
          </div>
          <p className="mt-2 font-mono text-xs text-[#9ca3af]">{shortenId(application.id)}</p>
        </div>
        <p className="text-sm text-[#6b6b6b]">
          {copy.common.updated} {formatAdminDateTime(application.updatedAt ?? application.createdAt, locale, copy.common.notRecorded)}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#7a7a7a]">{copy.detail.applicationCard.package}</p>
          <p className="mt-1 text-sm font-medium text-[#232323]">{application.visaPackage?.name || copy.common.noPackageLinked}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#7a7a7a]">{copy.detail.applicationCard.paymentConsent}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusPill tone={getToneForState(application.payment.state)}>
              {copy.status.payment[application.payment.state]}
            </StatusPill>
            <StatusPill tone={getToneForState(application.consent.state)}>
              {copy.status.consent[application.consent.state]}
            </StatusPill>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#7a7a7a]">{copy.detail.applicationCard.documentsPacket}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusPill tone={getToneForState(application.documents.state)}>
              {copy.status.documents[application.documents.state]}
            </StatusPill>
            <StatusPill tone={getToneForState(application.packet.state)}>
              {copy.status.packet[application.packet.state]}
            </StatusPill>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#7a7a7a]">{copy.detail.applicationCard.externalResult}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusPill tone={getToneForState(application.external.state)}>
              {copy.status.external[application.external.state]}
            </StatusPill>
            <StatusPill tone={getToneForState(application.result.state)}>
              {copy.status.result[application.result.state]}
            </StatusPill>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs font-medium text-[#6b6b6b]">
          <span>{copy.common.progress}</span>
          <span>{progress}%</span>
        </div>
        <SmoothProgressMeter
          serverProgress={progress}
          status={progress >= 100 ? "completed" : "running"}
          intervalMs={140}
          className="mt-2"
          valueClassName="text-xs font-medium text-[#6b6b6b]"
          trackClassName="bg-[#edf1f6]"
        />
      </div>
    </div>
  );
}

function ApplicationsOverview({
  applicant,
  copy,
  locale,
}: {
  applicant: AdminApplicantOverview;
  copy: AdminApplicationCopy;
  locale: InterfaceLocale;
}) {
  return (
    <SectionPanel title={copy.detail.applications} description={copy.detail.applicationsDescription}>
      <div className="space-y-3">
        {applicant.applications.map((application) => (
          <ApplicationCard key={application.id} application={application} copy={copy} locale={locale} />
        ))}
      </div>
    </SectionPanel>
  );
}

function EventTimeline({
  applicant,
  copy,
  locale,
}: {
  applicant: AdminApplicantOverview;
  copy: AdminApplicationCopy;
  locale: InterfaceLocale;
}) {
  const events = applicant.applications
    .flatMap((application) =>
      application.events.map((event) => ({
        ...event,
        applicationLabel: `${application.countryLabel} - ${application.visaTypeLabel}`,
      })),
    )
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
    .slice(0, 12);

  return (
    <SectionPanel title={copy.detail.recentEvents} description={copy.detail.recentEventsDescription}>
      {events.length === 0 ? (
        <EmptyState title={copy.detail.noEventsTitle} body={copy.detail.noEventsBody} />
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <div key={event.id} className="flex gap-3">
              <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#d7d7d7] bg-white text-[#6b6b6b]">
                <CircleDot className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 border-b border-[#efefef] pb-4 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-mono text-xs font-semibold text-[#232323]">{event.event_type}</p>
                  <StatusPill tone={event.actor_type === "admin" ? "brand" : "neutral"}>{event.actor_type}</StatusPill>
                </div>
                <p className="mt-1 text-sm leading-6 text-[#45556c]">{event.message || copy.common.notRecorded}</p>
                <p className="mt-1 text-xs text-[#9ca3af]">
                  {event.applicationLabel} - {formatAdminDateTime(event.created_at, locale, copy.common.notRecorded)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionPanel>
  );
}

export default async function AdminApplicantOverviewPage({ params, searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/admin/login");
  const locale = normalizeInterfaceLocale(await getLocale());
  const copy = ADMIN_APPLICATION_COPY[locale];

  const { id } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const admin = createAdminClient();

  let { applicant, error } = await fetchAdminApplicantDetail(id);
  
  if (!applicant && !error) {
    const { data: legacyApp } = await admin
      .from("applications")
      .select("applicant_id")
      .eq("id", id)
      .maybeSingle();

    if (legacyApp?.applicant_id) {
      const retry = await fetchAdminApplicantDetail(legacyApp.applicant_id);
      applicant = retry.applicant;
      error = retry.error;
    }
  }

  const queued = firstParam(resolvedSearchParams, "queuedNotification") === "1";
  const actionError = firstParam(resolvedSearchParams, "actionError") === "1";

  if (error) {
    return (
      <div className="w-full p-6 md:p-8">
        <ErrorPanel title={copy.errors.applicationLoadTitle} message={error} />
      </div>
    );
  }

  if (!applicant) {
    return (
      <div className="w-full p-6 md:p-8">
        <EmptyState title={copy.detail.userNotFoundTitle} body={copy.detail.userNotFoundBody} />
        <Link href="/admin/applications" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-500">
          <ArrowLeft className="h-4 w-4" />
          {copy.common.backToUsers}
        </Link>
      </div>
    );
  }

  const appIds = applicant.applications.map((a) => a.id);
  
  // 安全提取并兼容未知属性的 inbox_alias
  const profileWithAlias = applicant.profile as ApplicantProfileWithAlias | null;
  const aliasEmailStr = profileWithAlias?.inbox_alias ? String(profileWithAlias.inbox_alias).toLowerCase() : null;

  const [{ data: jobs }, { data: orders }, inbound] = await Promise.all([
    appIds.length > 0
      ? admin
          .from("runner_job")
          .select("id, status, attempts, enqueued_at, started_at, finished_at, last_error, application_id")
          .in("application_id", appIds)
          .order("enqueued_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
    appIds.length > 0
      ? admin
          .from("order")
          .select("id, status, agency_fee_cents, govt_fee_cents, currency, paid_at, application_id")
          .in("application_id", appIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    aliasEmailStr
      ? admin
          .from("inbound_email")
          .select("id, from_addr, subject, received_at, processed")
          .eq("to_addr", aliasEmailStr)
          .order("received_at", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] as InboundRow[] }),
  ]);

  const jobRows = (jobs ?? []) as RunnerJobRow[];
  const orderRows = (orders ?? []) as OrderRow[];
  const inboundRows = (inbound.data ?? []) as InboundRow[];

  return (
    <div className="w-full space-y-6 p-6 md:p-8 max-w-6xl mx-auto">
      <div>
        <Link href="/admin/applications" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-500 hover:underline">
          <ArrowLeft className="h-4 w-4" />
          {copy.common.backToCards}
        </Link>
      </div>

      <UserSummaryHeader applicant={applicant} copy={copy} />
      <ActionMessage queued={queued} error={actionError} copy={copy} />
      
      {applicant.latestApplication && (
        <RealtimeApplicationStatus
          applicationId={applicant.latestApplication.id}
          initialStatus={applicant.latestApplication.lifecycleState}
        />
      )}

      <OverviewMetrics applicant={applicant} copy={copy} locale={locale} />
      <ApplicantProfile applicant={applicant} copy={copy} locale={locale} />
      <PackageOverview applicant={applicant} copy={copy} locale={locale} />
      <SupportItems applicant={applicant} copy={copy} />
      <ApplicationsOverview applicant={applicant} copy={copy} locale={locale} />
      <EventTimeline applicant={applicant} copy={copy} locale={locale} />

      {/* ———————————————————————————————————————————————————————————————— */}
      {/* 下置的技术底层日志与运维诊断面板 (System Diagnostics) */}
      {/* ———————————————————————————————————————————————————————————————— */}
      <div className="pt-6 border-t border-[#e5e7eb] space-y-6">
        <h2 className="text-lg font-bold text-[#232323] tracking-tight">{copy.detail.diagnostics.title}</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Runner 任务执行追踪队列 */}
          <section className="bg-white rounded-lg border border-[#efefef] shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-[#fafafa]">
              <h3 className="font-semibold text-sm text-[#232323]">{copy.detail.diagnostics.runnerTimeline}</h3>
            </div>
            {jobRows.length === 0 ? (
              <p className="p-6 text-sm text-[#9ca3af]">{copy.detail.diagnostics.noRunnerJobs}</p>
            ) : (
              <ul className="divide-y text-sm">
                {jobRows.map((j) => (
                  <li key={j.id} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <Link href={`/admin/jobs/${j.id}`} className="font-mono text-xs text-brand-500 hover:underline">
                        {j.id.slice(0, 8)}
                      </Link>
                      <span className="text-xs text-[#6b6b6b]">
                        {formatAdminDateTime(j.enqueued_at, locale, copy.common.notRecorded)}
                      </span>
                    </div>
                    <div className="text-xs text-[#6b6b6b] mt-1 flex flex-wrap gap-x-2">
                      <span className="font-medium text-[#232323]">{localizeStatusText(j.status, locale)}</span>
                      <span>· {copy.detail.diagnostics.attempts}: {j.attempts}</span>
                      {appIds.length > 1 && <span className="text-brand-600">· {copy.detail.diagnostics.app}: {shortenId(j.application_id)}</span>}
                    </div>
                    {j.last_error && (
                      <p className="text-[11px] font-mono text-red-600 bg-red-50 rounded mt-1.5 p-1 max-w-full overflow-x-auto">
                        {j.last_error.slice(0, 120)}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 详细交易扣费订单 */}
          <section className="bg-white rounded-lg border border-[#efefef] shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-[#fafafa]">
              <h3 className="font-semibold text-sm text-[#232323]">{copy.detail.diagnostics.paymentOrders}</h3>
            </div>
            {orderRows.length === 0 ? (
              <p className="p-6 text-sm text-[#9ca3af]">{copy.detail.diagnostics.noRecords}</p>
            ) : (
              <ul className="divide-y text-sm">
                {orderRows.map((o) => (
                  <li key={o.id} className="px-4 py-3 flex justify-between items-center">
                    <div>
                      <Link href={`/client/orders/${o.id}`} className="font-mono text-xs text-brand-500 hover:underline">
                        {o.id.slice(0, 8)}
                      </Link>
                      <span className="ml-2 text-xs font-medium bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">{localizeStatusText(o.status, locale)}</span>
                      {appIds.length > 1 && <span className="block text-[11px] text-[#6b6b6b] mt-0.5">{copy.detail.diagnostics.app}: {shortenId(o.application_id)}</span>}
                    </div>
                    <span className="font-mono text-xs text-[#232323] font-semibold">
                      {((o.agency_fee_cents + o.govt_fee_cents) / 100).toFixed(2)} {o.currency}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* 专属别名电子邮箱日志 */}
        <section className="bg-white rounded-lg border border-[#efefef] shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-[#fafafa] flex justify-between items-center">
            <h3 className="font-semibold text-sm text-[#232323]">{copy.detail.diagnostics.inboundEmail}</h3>
            {profileWithAlias?.inbox_alias ? (
              <span className="text-xs font-mono bg-brand-50 text-brand-600 px-2 py-0.5 rounded border border-brand-100">
                {copy.detail.diagnostics.alias}: {profileWithAlias.inbox_alias}
              </span>
            ) : (
              <span className="text-xs italic text-[#9ca3af]">{copy.detail.diagnostics.noAlias}</span>
            )}
          </div>
          {inboundRows.length === 0 ? (
            <p className="p-6 text-sm text-[#9ca3af]">{copy.detail.diagnostics.noMail}</p>
          ) : (
            <ul className="divide-y text-sm">
              {inboundRows.map((m) => (
                <li key={m.id} className="px-4 py-3 hover:bg-[#fafafa] transition">
                  <p className="font-medium text-[#232323] truncate">
                    {m.subject ?? copy.detail.diagnostics.noSubject}
                  </p>
                  <p className="text-xs text-[#6b6b6b] mt-1">
                    {formatAdminDateTime(m.received_at, locale, copy.common.notRecorded)} · {copy.detail.diagnostics.from}: <span className="text-[#232323]">{m.from_addr}</span>
                    {m.processed && <span className="ml-2 text-emerald-600 bg-emerald-50 px-1 rounded font-medium">{copy.detail.diagnostics.processed}</span>}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

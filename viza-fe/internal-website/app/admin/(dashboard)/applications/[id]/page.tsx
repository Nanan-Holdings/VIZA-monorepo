import Link from "next/link";
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
  buildStatusSummary,
  fetchAdminApplicantDetail,
  formatDateTime,
  getLifecycleProgressPercent,
  maskPassport,
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

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function ActionMessage({
  queued,
  error,
}: {
  queued: boolean;
  error: boolean;
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
      {queued
        ? "Status notification queued and logged to the application timeline."
        : "The support action could not be completed. Try again after checking the user overview."}
    </div>
  );
}

function UserSummaryHeader({ applicant }: { applicant: AdminApplicantOverview }) {
  const profile = applicant.profile;
  const latestApplication = applicant.latestApplication;
  const summary = latestApplication ? buildStatusSummary(latestApplication) : "";

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
                {profile?.full_name || "Unnamed applicant"}
              </h1>
              <StatusPill tone={getToneForState(applicant.lifecycleState)}>
                {LIFECYCLE_LABELS[applicant.lifecycleState]}
              </StatusPill>
            </div>
            <p className="mt-2 text-sm text-[#6b6b6b]">
              {applicant.packageNames.join(", ") || "No package assigned"} - {applicant.applicationCount} application
              {applicant.applicationCount === 1 ? "" : "s"}
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm text-[#6b6b6b]">
              <Mail className="h-4 w-4" />
              {profile?.email || "No customer email recorded"}
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

function OverviewMetrics({ applicant }: { applicant: AdminApplicantOverview }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-lg border border-[#efefef] bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[#6b6b6b]">
          <FileText className="h-4 w-4 text-brand-500" />
          Applications
        </div>
        <p className="mt-2 text-2xl font-semibold text-[#232323]">{applicant.applicationCount}</p>
        <p className="mt-1 text-xs text-[#6b6b6b]">{applicant.countries.join(", ") || "No destination"}</p>
      </div>

      <div className="rounded-lg border border-[#efefef] bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[#6b6b6b]">
          <PackageCheck className="h-4 w-4 text-brand-500" />
          Packages
        </div>
        <p className="mt-2 text-2xl font-semibold text-[#232323]">{applicant.packages.length}</p>
        <p className="mt-1 text-xs text-[#6b6b6b]">{applicant.activePackageCount} active</p>
      </div>

      <div className="rounded-lg border border-[#efefef] bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[#6b6b6b]">
          <CalendarClock className="h-4 w-4 text-brand-500" />
          Earliest expiry
        </div>
        <p className="mt-2 text-sm font-semibold text-[#232323]">
          {applicant.earliestExpiryAt ? formatDateTime(applicant.earliestExpiryAt) : "No expiry set"}
        </p>
        <p className="mt-1 text-xs text-[#6b6b6b]">Latest update {formatDateTime(applicant.latestUpdatedAt)}</p>
      </div>

      <div className="rounded-lg border border-[#efefef] bg-white px-4 py-3 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-[#6b6b6b]">Overall progress</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#edf1f6]">
          <div
            className="h-full rounded-full bg-brand-500"
            style={{ width: `${applicant.completionPercent}%` }}
          />
        </div>
        <p className="mt-2 text-2xl font-semibold text-[#232323]">{applicant.completionPercent}%</p>
      </div>
    </div>
  );
}

function ApplicantProfile({ applicant }: { applicant: AdminApplicantOverview }) {
  const profile = applicant.profile;

  return (
    <SectionPanel title="User overview" description="Support contact and identity summary. Sensitive document numbers are masked.">
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <FieldValue label="Name" value={profile?.full_name || "Unnamed applicant"} />
        <FieldValue label="Email" value={profile?.email || "Not provided"} />
        <FieldValue label="Phone" value={profile?.phone || "Not provided"} />
        <FieldValue label="Nationality" value={profile?.nationality || "Not provided"} />
        <FieldValue label="Passport" value={maskPassport(profile?.passport_number ?? null)} />
        <FieldValue label="Passport expiry" value={profile?.passport_expiry_date || "Not provided"} />
        <FieldValue label="Language" value={profile?.language_pref || "Not provided"} />
        <FieldValue label="Profile created" value={formatDateTime(profile?.created_at)} />
      </dl>
    </SectionPanel>
  );
}

function PackageOverview({ applicant }: { applicant: AdminApplicantOverview }) {
  return (
    <SectionPanel title="Packages" description="Assigned packages and expiry visibility for this user.">
      {applicant.packages.length === 0 ? (
        <EmptyState title="No packages" body="No package assignment is linked to this user yet." />
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
                <StatusPill tone={pkg.status === "active" ? "success" : "neutral"}>{pkg.status}</StatusPill>
              </div>
              <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <FieldValue label="Assigned" value={formatDateTime(pkg.assignedAt)} />
                <FieldValue label="Expires" value={pkg.expiresAt ? formatDateTime(pkg.expiresAt) : "No expiry set"} />
                <FieldValue label="Price" value={pkg.priceLabel} />
              </dl>
            </div>
          ))}
        </div>
      )}
    </SectionPanel>
  );
}

function SupportItems({ applicant }: { applicant: AdminApplicantOverview }) {
  return (
    <SectionPanel title="Support items" description="Aggregated blockers across all applications for this user.">
      {applicant.missingItems.length === 0 ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          No blocking support items detected across this user's applications.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {applicant.missingItems.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm leading-6 text-[#45556c]">
              <CircleDot className="mt-1 h-4 w-4 shrink-0 text-amber-600" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </SectionPanel>
  );
}

function ApplicationCard({ application }: { application: AdminApplicationModel }) {
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
              {LIFECYCLE_LABELS[application.lifecycleState]}
            </StatusPill>
          </div>
          <p className="mt-2 font-mono text-xs text-[#9ca3af]">{shortenId(application.id)}</p>
        </div>
        <p className="text-sm text-[#6b6b6b]">Updated {formatDateTime(application.updatedAt ?? application.createdAt)}</p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#7a7a7a]">Package</p>
          <p className="mt-1 text-sm font-medium text-[#232323]">{application.visaPackage?.name || "No package linked"}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#7a7a7a]">Payment / Consent</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusPill tone={getToneForState(application.payment.state)}>
              {PAYMENT_LABELS[application.payment.state]}
            </StatusPill>
            <StatusPill tone={getToneForState(application.consent.state)}>
              {CONSENT_LABELS[application.consent.state]}
            </StatusPill>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#7a7a7a]">Documents / Packet</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusPill tone={getToneForState(application.documents.state)}>
              {DOCUMENT_LABELS[application.documents.state]}
            </StatusPill>
            <StatusPill tone={getToneForState(application.packet.state)}>
              {PACKET_LABELS[application.packet.state]}
            </StatusPill>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#7a7a7a]">External / Result</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusPill tone={getToneForState(application.external.state)}>
              {EXTERNAL_LABELS[application.external.state]}
            </StatusPill>
            <StatusPill tone={getToneForState(application.result.state)}>
              {RESULT_LABELS[application.result.state]}
            </StatusPill>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs font-medium text-[#6b6b6b]">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#edf1f6]">
          <div className="h-full rounded-full bg-brand-500" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}

function ApplicationsOverview({ applicant }: { applicant: AdminApplicantOverview }) {
  return (
    <SectionPanel title="Applications" description="All visa applications linked to this user.">
      <div className="space-y-3">
        {applicant.applications.map((application) => (
          <ApplicationCard key={application.id} application={application} />
        ))}
      </div>
    </SectionPanel>
  );
}

function EventTimeline({ applicant }: { applicant: AdminApplicantOverview }) {
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
    <SectionPanel title="Recent events" description="Latest lifecycle and support events across this user's applications.">
      {events.length === 0 ? (
        <EmptyState title="No events yet" body="Lifecycle events will appear here as automation and support actions run." />
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <div key={event.id} className="flex gap-3">
              <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#d7d7d7] bg-white text-[#6b6b6b]">
                <CircleDot className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 border-b border-[#efefef] pb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-mono text-xs font-semibold text-[#232323]">{event.event_type}</p>
                  <StatusPill tone={event.actor_type === "admin" ? "brand" : "neutral"}>{event.actor_type}</StatusPill>
                </div>
                <p className="mt-1 text-sm leading-6 text-[#45556c]">{event.message || "No message"}</p>
                <p className="mt-1 text-xs text-[#9ca3af]">
                  {event.applicationLabel} - {formatDateTime(event.created_at)}
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

  const { id } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const { applicant, error } = await fetchAdminApplicantDetail(id);
  const queued = firstParam(resolvedSearchParams, "queuedNotification") === "1";
  const actionError = firstParam(resolvedSearchParams, "actionError") === "1";

  if (error) {
    return (
      <div className="w-full p-6 md:p-8">
        <ErrorPanel message={error} />
      </div>
    );
  }

  if (!applicant) {
    return (
      <div className="w-full p-6 md:p-8">
        <EmptyState title="User not found" body="This applicant does not exist or has no application records." />
        <Link href="/admin/applications" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-500">
          <ArrowLeft className="h-4 w-4" />
          Back to users
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 p-6 md:p-8">
      <div>
        <Link href="/admin/applications" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-500">
          <ArrowLeft className="h-4 w-4" />
          Back to user cards
        </Link>
      </div>

      <UserSummaryHeader applicant={applicant} />
      <ActionMessage queued={queued} error={actionError} />
      <OverviewMetrics applicant={applicant} />
      <ApplicantProfile applicant={applicant} />
      <PackageOverview applicant={applicant} />
      <SupportItems applicant={applicant} />
      <ApplicationsOverview applicant={applicant} />
      <EventTimeline applicant={applicant} />
    </div>
  );
}

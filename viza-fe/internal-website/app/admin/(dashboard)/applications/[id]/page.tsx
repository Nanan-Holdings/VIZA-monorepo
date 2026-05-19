import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  CircleDot,
  FileText,
  Mail,
  PackageCheck,
  Receipt,
  Send,
  ShieldCheck,
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
  type AdminApplicationModel,
  buildStatusSummary,
  fetchAdminApplicationDetail,
  formatDateTime,
  formatMoney,
  isHttpUrl,
  maskPassport,
  previewAnswer,
  shortenId,
} from "../data";
import {
  EmptyState,
  ErrorPanel,
  FieldValue,
  ResourceLink,
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

function LifecycleRail({ application }: { application: AdminApplicationModel }) {
  const steps = [
    {
      key: "payment",
      label: "Payment",
      done: application.payment.state === "paid" || application.payment.state === "refunded",
      active: application.lifecycleState === "payment_pending",
      icon: Receipt,
    },
    {
      key: "consent",
      label: "Consent",
      done: application.consent.state === "complete",
      active: application.lifecycleState === "consent_pending",
      icon: ShieldCheck,
    },
    {
      key: "documents",
      label: "Documents",
      done: application.documents.state === "complete",
      active: application.lifecycleState === "document_collection",
      icon: FileText,
    },
    {
      key: "packet",
      label: "Packet",
      done: application.packet.state === "ready",
      active: application.lifecycleState === "packet_generation",
      icon: PackageCheck,
    },
    {
      key: "external",
      label: "External",
      done:
        application.external.state === "submitted" ||
        application.external.state === "approved" ||
        application.result.state !== "none",
      active:
        application.lifecycleState === "ready_for_external_handoff" ||
        application.lifecycleState === "external_submission",
      icon: Send,
    },
    {
      key: "result",
      label: "Result",
      done: application.result.state === "approved" || application.result.state === "delivered",
      active: application.lifecycleState === "result_delivery",
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {steps.map((step) => {
        const Icon = step.icon;
        return (
          <div
            key={step.key}
            className={[
              "rounded-lg border px-4 py-3",
              step.done
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : step.active
                  ? "border-brand-200 bg-brand-50 text-brand-500"
                  : "border-[#efefef] bg-white text-[#6b6b6b]",
            ].join(" ")}
          >
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              <span className="text-sm font-semibold">{step.label}</span>
            </div>
            <p className="mt-2 text-xs font-medium">
              {step.done ? "Complete" : step.active ? "Current stage" : "Waiting"}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function MissingItems({ application }: { application: AdminApplicationModel }) {
  if (application.missingItems.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
        No blocking support items detected from payment, consent, documents, packet, external status, or result state.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {application.missingItems.map((item) => (
        <li key={item} className="flex items-start gap-2 text-sm leading-6 text-[#45556c]">
          <CircleDot className="mt-1 h-4 w-4 shrink-0 text-amber-600" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function ApplicantAndPackage({ application }: { application: AdminApplicationModel }) {
  const profile = application.profile;
  const pkg = application.visaPackage;

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <SectionPanel title="Applicant profile" description="Support contact and identity summary. Sensitive document numbers are masked.">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

      <SectionPanel title="Package and application" description="Route context and raw application identifiers.">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldValue label="Country" value={application.countryLabel} />
          <FieldValue label="Visa type" value={application.visaTypeLabel} />
          <FieldValue label="Package" value={pkg?.name || "No package linked"} />
          <FieldValue label="Package price" value={formatMoney(pkg?.price_cents ?? null, pkg?.currency)} />
          <FieldValue label="Application ID" value={application.id} mono />
          <FieldValue label="Applicant ID" value={application.applicantId} mono />
          <FieldValue label="Raw status" value={application.rawStatus} />
          <FieldValue label="Confirmation" value={application.confirmationNumber || "Not recorded"} />
          <FieldValue label="Arrival" value={application.arrivalDate || "Not recorded"} />
          <FieldValue label="Departure" value={application.departureDate || "Not recorded"} />
          <FieldValue label="Submitted" value={formatDateTime(application.submittedAt)} />
          <FieldValue label="Updated" value={formatDateTime(application.updatedAt ?? application.createdAt)} />
        </dl>
      </SectionPanel>
    </div>
  );
}

function PaymentConsentDocuments({ application }: { application: AdminApplicationModel }) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.85fr_0.85fr_1.3fr]">
      <SectionPanel title="Payment" description="Agency-fee visibility only. Raw card details are never shown.">
        <div className="space-y-4">
          <StatusPill tone={getToneForState(application.payment.state)}>
            {PAYMENT_LABELS[application.payment.state]}
          </StatusPill>
          <dl className="grid grid-cols-1 gap-4">
            <FieldValue
              label="Latest amount"
              value={
                application.payment.latest
                  ? formatMoney(application.payment.latest.amount_cents, application.payment.latest.currency)
                  : "No payment record"
              }
            />
            <FieldValue label="Paid total" value={formatMoney(application.payment.paidTotalCents, application.payment.currency)} />
            <FieldValue label="Provider" value={application.payment.latest?.provider || "Not recorded"} />
            <FieldValue label="Provider payment" value={shortenId(application.payment.latest?.provider_payment_id)} mono />
            <FieldValue label="Receipt" value={<ResourceLink href={application.payment.latest?.receipt_url} label="Open receipt" />} />
          </dl>
        </div>
      </SectionPanel>

      <SectionPanel title="Consent and signatures" description="Authorisation state before packet handoff.">
        <div className="space-y-4">
          <StatusPill tone={getToneForState(application.consent.state)}>
            {CONSENT_LABELS[application.consent.state]}
          </StatusPill>
          <dl className="grid grid-cols-1 gap-4">
            <FieldValue label="Consent type" value={application.consent.latestConsent?.consent_type || "Not recorded"} />
            <FieldValue label="Consent version" value={application.consent.latestConsent?.version || "Not recorded"} />
            <FieldValue label="Accepted" value={application.consent.latestConsent?.accepted === false ? "No" : application.consent.latestConsent ? "Yes" : "Not recorded"} />
            <FieldValue label="Accepted at" value={formatDateTime(application.consent.latestConsent?.created_at)} />
            <FieldValue label="Signer" value={application.consent.latestSignature?.signer_name || "Not recorded"} />
            <FieldValue label="Signed at" value={formatDateTime(application.consent.latestSignature?.signed_at)} />
            <FieldValue label="Signed file" value={<ResourceLink href={application.consent.latestSignature?.signed_document_path} label="Open signed file" />} />
          </dl>
        </div>
      </SectionPanel>

      <SectionPanel title="Documents" description="Required checklist status and review notes.">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <StatusPill tone={getToneForState(application.documents.state)}>
            {DOCUMENT_LABELS[application.documents.state]}
          </StatusPill>
          <span className="text-sm text-[#6b6b6b]">
            {application.documents.complete}/{application.documents.totalRequired || application.applicationDocuments.length} complete
          </span>
        </div>
        {application.applicationDocuments.length === 0 ? (
          <EmptyState title="No document rows" body="Document uploads or generated requirements have not been recorded yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-[#fafafa]">
                  <th className="px-3 py-2 text-left font-medium text-[#6b6b6b]">Type</th>
                  <th className="px-3 py-2 text-left font-medium text-[#6b6b6b]">Status</th>
                  <th className="px-3 py-2 text-left font-medium text-[#6b6b6b]">File</th>
                  <th className="px-3 py-2 text-left font-medium text-[#6b6b6b]">Review</th>
                </tr>
              </thead>
              <tbody>
                {application.applicationDocuments.map((document) => (
                  <tr key={document.id} className="border-b">
                    <td className="px-3 py-2 font-medium text-[#232323]">{document.document_type.replace(/_/g, " ")}</td>
                    <td className="px-3 py-2">
                      <StatusPill tone={getToneForState(document.status)}>{document.status}</StatusPill>
                    </td>
                    <td className="px-3 py-2">
                      <ResourceLink href={document.storage_path} label={document.filename || "Open file"} />
                    </td>
                    <td className="max-w-[260px] px-3 py-2 text-[#6b6b6b]">
                      {document.rejection_reason || document.review_notes || "No notes"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionPanel>
    </div>
  );
}

function PacketExternalResult({ application }: { application: AdminApplicationModel }) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <SectionPanel title="Packet" description="Generated application packet for external handoff.">
        <div className="space-y-4">
          <StatusPill tone={getToneForState(application.packet.state)}>{PACKET_LABELS[application.packet.state]}</StatusPill>
          <dl className="grid grid-cols-1 gap-4">
            <FieldValue label="Latest packet status" value={application.packet.latestPacket?.status || "Not recorded"} />
            <FieldValue label="Generated" value={formatDateTime(application.packet.latestPacket?.generated_at)} />
            <FieldValue label="Storage" value={<ResourceLink href={application.packet.storagePath} label="Open packet" />} />
          </dl>
        </div>
      </SectionPanel>

      <SectionPanel title="External handoff" description="Status ingested from the external submission owner.">
        <div className="space-y-4">
          <StatusPill tone={getToneForState(application.external.state)}>
            {EXTERNAL_LABELS[application.external.state]}
          </StatusPill>
          {application.external.state === "ready_for_handoff" && (
            <p className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm leading-6 text-brand-500">
              Packet is ready for automated external handoff. This monitor does not add a staff approval gate.
            </p>
          )}
          <dl className="grid grid-cols-1 gap-4">
            <FieldValue label="Raw status" value={application.external.rawStatus || "Not handed off"} />
            <FieldValue label="Reference" value={application.external.reference || "Not recorded"} mono />
            <FieldValue label="Updated" value={formatDateTime(application.external.updatedAt)} />
          </dl>
        </div>
      </SectionPanel>

      <SectionPanel title="Result delivery" description="Final result status and customer-deliverable file reference.">
        <div className="space-y-4">
          <StatusPill tone={getToneForState(application.result.state)}>{RESULT_LABELS[application.result.state]}</StatusPill>
          <dl className="grid grid-cols-1 gap-4">
            <FieldValue label="Raw result" value={application.result.rawStatus || "Not recorded"} />
            <FieldValue
              label={isHttpUrl(application.result.storagePath) ? "Result link" : "Result storage path"}
              value={<ResourceLink href={application.result.storagePath} label="Open result file" />}
            />
            <FieldValue label="Result notes" value={application.result.notes || "No notes"} />
            <FieldValue
              label="Government fee"
              value={`${formatMoney(application.governmentFeeCents, application.governmentFeeCurrency)} (${application.governmentFeeMode || "display_only"})`}
            />
          </dl>
        </div>
      </SectionPanel>
    </div>
  );
}

function AnswersSummary({ application }: { application: AdminApplicationModel }) {
  const answers = application.answers.slice(0, 16);

  return (
    <SectionPanel title="Answers summary" description="Recent form answers. Sensitive identity/contact values are masked in this support view.">
      {answers.length === 0 ? (
        <EmptyState title="No answers recorded" body="The applicant has not saved form answers for this application yet." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-[#fafafa]">
                <th className="px-3 py-2 text-left font-medium text-[#6b6b6b]">Field</th>
                <th className="px-3 py-2 text-left font-medium text-[#6b6b6b]">Preview</th>
                <th className="px-3 py-2 text-left font-medium text-[#6b6b6b]">Updated</th>
              </tr>
            </thead>
            <tbody>
              {answers.map((answer) => (
                <tr key={answer.id} className="border-b">
                  <td className="px-3 py-2 font-mono text-xs text-[#45556c]">{answer.field_name}</td>
                  <td className="max-w-[520px] truncate px-3 py-2 text-[#232323]">{previewAnswer(answer)}</td>
                  <td className="px-3 py-2 text-[#6b6b6b]">{formatDateTime(answer.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {application.answers.length > answers.length && (
            <p className="mt-3 text-xs text-[#6b6b6b]">
              Showing {answers.length} of {application.answers.length} saved answers.
            </p>
          )}
        </div>
      )}
    </SectionPanel>
  );
}

function EventTimeline({ application }: { application: AdminApplicationModel }) {
  return (
    <SectionPanel title="Events" description="Auditable lifecycle and support activity.">
      {application.events.length === 0 ? (
        <EmptyState title="No events yet" body="Lifecycle events will appear here as automation and support actions run." />
      ) : (
        <div className="space-y-4">
          {application.events.map((event) => (
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
                <p className="mt-1 text-xs text-[#9ca3af]">{formatDateTime(event.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionPanel>
  );
}

function Notifications({ application }: { application: AdminApplicationModel }) {
  return (
    <SectionPanel title="Notifications" description="Queued and sent customer communication events.">
      {application.notifications.length === 0 ? (
        <EmptyState title="No notifications" body="Notification events will appear when reminders or result messages are queued." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-[#fafafa]">
                <th className="px-3 py-2 text-left font-medium text-[#6b6b6b]">Template</th>
                <th className="px-3 py-2 text-left font-medium text-[#6b6b6b]">Channel</th>
                <th className="px-3 py-2 text-left font-medium text-[#6b6b6b]">Recipient</th>
                <th className="px-3 py-2 text-left font-medium text-[#6b6b6b]">Status</th>
                <th className="px-3 py-2 text-left font-medium text-[#6b6b6b]">Sent</th>
              </tr>
            </thead>
            <tbody>
              {application.notifications.map((notification) => (
                <tr key={notification.id} className="border-b">
                  <td className="px-3 py-2 font-mono text-xs text-[#45556c]">{notification.template_key}</td>
                  <td className="px-3 py-2">{notification.channel}</td>
                  <td className="px-3 py-2 text-[#6b6b6b]">{notification.recipient || "Not recorded"}</td>
                  <td className="px-3 py-2">
                    <StatusPill tone={getToneForState(notification.status)}>{notification.status}</StatusPill>
                  </td>
                  <td className="px-3 py-2 text-[#6b6b6b]">{formatDateTime(notification.sent_at ?? notification.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionPanel>
  );
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
        : "The support action could not be completed. Try again after checking the application record."}
    </div>
  );
}

export default async function AdminApplicationDetailPage({ params, searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/admin/login");

  const { id } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const { application, error } = await fetchAdminApplicationDetail(id);
  const queued = firstParam(resolvedSearchParams, "queuedNotification") === "1";
  const actionError = firstParam(resolvedSearchParams, "actionError") === "1";

  if (error) {
    return (
      <div className="w-full p-6 md:p-8">
        <ErrorPanel message={error} />
      </div>
    );
  }

  if (!application) {
    return (
      <div className="w-full p-6 md:p-8">
        <EmptyState title="Application not found" body="This application record does not exist or is unavailable." />
        <Link href="/admin/applications" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-500">
          <ArrowLeft className="h-4 w-4" />
          Back to applications
        </Link>
      </div>
    );
  }

  const summary = buildStatusSummary(application);
  const returnTo = `/admin/applications/${application.id}`;

  return (
    <div className="w-full space-y-6 p-6 md:p-8">
      <div>
        <Link href="/admin/applications" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-500">
          <ArrowLeft className="h-4 w-4" />
          Back to applications
        </Link>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-[#efefef] bg-white p-5 shadow-sm xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-[#232323]">
              {application.profile?.full_name || "Unnamed applicant"}
            </h1>
            <StatusPill tone={getToneForState(application.lifecycleState)}>
              {LIFECYCLE_LABELS[application.lifecycleState]}
            </StatusPill>
          </div>
          <p className="mt-2 text-sm text-[#6b6b6b]">
            {application.countryLabel} - {application.visaTypeLabel} - {shortenId(application.id)}
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm text-[#6b6b6b]">
            <Mail className="h-4 w-4" />
            {application.profile?.email || "No customer email recorded"}
          </p>
        </div>
        <SupportActions
          applicationId={application.id}
          applicantEmail={application.profile?.email ?? null}
          summaryText={summary}
          returnTo={returnTo}
        />
      </div>

      <ActionMessage queued={queued} error={actionError} />

      <SectionPanel title="Lifecycle state" description="Current processing state across customer, website automation, external handoff, and result delivery.">
        <LifecycleRail application={application} />
      </SectionPanel>

      <SectionPanel title="Missing items and support notes" description="Items that may need customer follow-up or external-team attention.">
        <MissingItems application={application} />
      </SectionPanel>

      <ApplicantAndPackage application={application} />
      <PaymentConsentDocuments application={application} />
      <PacketExternalResult application={application} />
      <AnswersSummary application={application} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <EventTimeline application={application} />
        <Notifications application={application} />
      </div>
    </div>
  );
}

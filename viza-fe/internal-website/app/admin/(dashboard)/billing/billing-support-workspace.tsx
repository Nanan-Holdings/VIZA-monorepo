"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CircleDollarSign,
  FileText,
  ReceiptText,
  RefreshCcw,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type {
  BillingStatusSummary,
  BillingSupportRecord,
  RefundEligibilityStatus,
} from "./types";

interface BillingSupportWorkspaceProps {
  records: BillingSupportRecord[];
  summary: BillingStatusSummary;
  generatedAt: string;
  errors: string[];
}

export function BillingSupportWorkspace({
  records,
  summary,
  generatedAt,
  errors,
}: BillingSupportWorkspaceProps) {
  const [selectedRecordId, setSelectedRecordId] = useState(
    records[0]?.id ?? ""
  );

  const selectedRecord = useMemo(
    () => records.find((record) => record.id === selectedRecordId) ?? records[0],
    [records, selectedRecordId]
  );

  return (
    <div className="w-full p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#232323]">
            Billing Support
          </h1>
          <p className="mt-1 text-sm text-[#6b6b6b]">
            Payments, receipts, invoice requests, and refund support queue
          </p>
        </div>
        <p className="text-xs text-[#8a8a8a]">
          Refreshed {formatDateTime(generatedAt)}
        </p>
      </div>

      {errors.length > 0 && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-medium">Some billing data could not be loaded.</p>
          <ul className="mt-2 space-y-1">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryTile
          icon={CircleDollarSign}
          label="Collected agency fees"
          value={summary.collectedCurrency}
        />
        <SummaryTile
          icon={ReceiptText}
          label="Paid payments"
          value={summary.paidCount.toString()}
        />
        <SummaryTile
          icon={FileText}
          label="Open invoices"
          value={summary.openInvoiceRequests.toString()}
        />
        <SummaryTile
          icon={RefreshCcw}
          label="Open refunds"
          value={summary.openRefundRequests.toString()}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.9fr)]">
        <div className="overflow-hidden rounded-lg border border-[#efefef] bg-white shadow-sm">
          <div className="border-b border-[#efefef] px-4 py-3">
            <h2 className="text-base font-semibold text-[#232323]">
              Billing Records
            </h2>
            <p className="text-xs text-[#8a8a8a]">
              {summary.totalRecords} support records
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-b bg-[#fafafa]">
                  <TableHeader>Customer</TableHeader>
                  <TableHeader>Application</TableHeader>
                  <TableHeader>Package</TableHeader>
                  <TableHeader>Payment</TableHeader>
                  <TableHeader>Invoice</TableHeader>
                  <TableHeader>Refund</TableHeader>
                  <TableHeader>Receipt</TableHeader>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => {
                  const isSelected = selectedRecord?.id === record.id;

                  return (
                    <tr
                      key={record.id}
                      className={`border-b transition-colors ${
                        isSelected ? "bg-brand-50/70" : "hover:bg-[#fafafa]"
                      }`}
                    >
                      <td className="px-4 py-3 align-top">
                        <button
                          type="button"
                          className="max-w-[220px] text-left"
                          onClick={() => setSelectedRecordId(record.id)}
                        >
                          <span className="block font-medium text-brand-500 hover:underline">
                            {record.applicant?.label ?? "Unlinked customer"}
                          </span>
                          <span className="block truncate text-xs text-[#8a8a8a]">
                            {record.applicant?.secondary ?? "No applicant ref"}
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {record.application ? (
                          <Link
                            href={record.application.href ?? "#"}
                            className="inline-flex items-center gap-1 font-medium text-brand-500 hover:underline"
                          >
                            {record.application.label}
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                        ) : (
                          <span className="text-[#9ca3af]">No application</span>
                        )}
                        <span className="block text-xs text-[#8a8a8a]">
                          {record.applicationStatus ?? "No status"}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className="block font-medium text-[#232323]">
                          {record.visaPackage?.label ?? "No package"}
                        </span>
                        <span className="block text-xs text-[#8a8a8a]">
                          {record.visaPackage?.secondary ??
                            record.governmentFeeMode ??
                            "No package ref"}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <StatusBadge status={record.payment?.status ?? "missing"} />
                        <span className="mt-1 block text-xs text-[#6b6b6b]">
                          {record.payment?.amountLabel ?? "No payment record"}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <StatusBadge status={record.invoiceStatus} />
                        <span className="mt-1 block text-xs text-[#8a8a8a]">
                          {record.latestInvoice?.billingEmail ?? "No request"}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <StatusBadge status={record.refundStatus} />
                        <span className="mt-1 block text-xs text-[#8a8a8a]">
                          {record.refundEligibility.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {record.payment?.receiptUrl ? (
                          <a
                            href={record.payment.receiptUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border border-brand-200 px-2.5 py-1 text-xs font-medium text-brand-500 hover:bg-brand-50"
                          >
                            Receipt
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <span className="text-xs text-[#9ca3af]">
                            Not available
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {records.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-sm text-[#9ca3af]"
                    >
                      No billing records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <SupportPanel record={selectedRecord} />
      </div>
    </div>
  );
}

function SupportPanel({ record }: { record: BillingSupportRecord | undefined }) {
  if (!record) {
    return (
      <aside className="rounded-lg border border-[#efefef] bg-white p-6 shadow-sm">
        <p className="text-sm text-[#9ca3af]">Select a billing record.</p>
      </aside>
    );
  }

  return (
    <aside className="rounded-lg border border-[#efefef] bg-white shadow-sm">
      <div className="border-b border-[#efefef] px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#232323]">
              Support Panel
            </h2>
            <p className="text-xs text-[#8a8a8a]">{record.id}</p>
          </div>
          <EligibilityBadge status={record.refundEligibility.status} />
        </div>
      </div>

      <div className="space-y-5 p-5">
        <PanelSection title="References">
          <ReferenceRow label="Customer" reference={record.applicant} />
          <ReferenceRow label="Application" reference={record.application} />
          <ReferenceRow label="Package" reference={record.visaPackage} />
          <DetailRow
            label="Government fee mode"
            value={record.governmentFeeMode ?? "Not recorded"}
          />
        </PanelSection>

        <PanelSection title="Payment">
          <DetailRow
            label="Status"
            value={record.payment?.status ?? "No payment record"}
          />
          <DetailRow
            label="Amount"
            value={record.payment?.amountLabel ?? "Not available"}
          />
          <DetailRow
            label="Fee type"
            value={record.payment?.feeType ?? "Not available"}
          />
          <DetailRow
            label="Provider"
            value={record.payment?.provider ?? "Not available"}
          />
          <DetailRow
            label="Session ref"
            value={record.payment?.providerSessionRef ?? "Not available"}
          />
          <DetailRow
            label="Payment ref"
            value={record.payment?.providerPaymentRef ?? "Not available"}
          />
          {record.payment?.metadata.map((item) => (
            <DetailRow
              key={`${item.label}-${item.value}`}
              label={item.label}
              value={item.value}
            />
          ))}
          {record.payment?.receiptUrl && (
            <a
              href={record.payment.receiptUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-500 hover:underline"
            >
              Open receipt
              <ArrowUpRight className="h-4 w-4" />
            </a>
          )}
        </PanelSection>

        <PanelSection title="Invoice Request">
          {record.invoices.length > 0 ? (
            record.invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="rounded-lg border border-[#efefef] p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-[#232323]">
                    {invoice.invoiceName ?? "Invoice request"}
                  </span>
                  <StatusBadge status={invoice.status} />
                </div>
                <DetailRow
                  label="Billing email"
                  value={invoice.billingEmail ?? "Not provided"}
                />
                <DetailRow
                  label="Tax identifier"
                  value={invoice.taxIdentifierMasked ?? "Not provided"}
                />
                <DetailRow
                  label="Notes"
                  value={invoice.notes ?? "No notes"}
                />
                <DetailRow
                  label="Requested"
                  value={formatDateTime(invoice.createdAt)}
                />
              </div>
            ))
          ) : (
            <p className="text-sm text-[#9ca3af]">No invoice request.</p>
          )}
        </PanelSection>

        <PanelSection title="Refund Eligibility">
          <div className="rounded-lg border border-[#efefef] p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-[#232323]">
                {record.refundEligibility.label}
              </span>
              <span className="text-xs text-[#8a8a8a]">
                {record.refundEligibility.ruleCode}
              </span>
            </div>
            <DetailRow
              label="Eligible amount"
              value={record.refundEligibility.eligibleAmountLabel}
            />
            <p className="mt-2 text-sm text-[#6b6b6b]">
              {record.refundEligibility.reason}
            </p>
          </div>
          {record.refunds.length > 0 && (
            <div className="space-y-3">
              {record.refunds.map((refund) => (
                <div
                  key={refund.id}
                  className="rounded-lg border border-[#efefef] p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-[#232323]">
                      {refund.amountLabel}
                    </span>
                    <StatusBadge status={refund.status} />
                  </div>
                  <DetailRow
                    label="Reason"
                    value={refund.reason ?? "Not provided"}
                  />
                  <DetailRow
                    label="Requested"
                    value={formatDateTime(refund.createdAt)}
                  />
                  {refund.policySnapshot.map((item) => (
                    <DetailRow
                      key={`${refund.id}-${item.label}`}
                      label={item.label}
                      value={item.value}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </PanelSection>

        <PanelSection title="Timeline">
          <div className="space-y-3">
            {record.timeline.map((event) => (
              <div key={event.id} className="flex gap-3">
                <div className="mt-1 h-2 w-2 rounded-full bg-brand-500" />
                <div>
                  <p className="text-sm font-medium text-[#232323]">
                    {event.label}
                  </p>
                  <p className="text-xs text-[#8a8a8a]">
                    {event.status} - {formatDateTime(event.happenedAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </PanelSection>
      </div>
    </aside>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-[#efefef] bg-white p-4 shadow-sm">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-xs font-medium uppercase text-[#8a8a8a]">{label}</p>
      <p className="mt-1 text-xl font-semibold text-[#232323]">{value}</p>
    </div>
  );
}

function PanelSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold text-[#232323]">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function TableHeader({ children }: { children: ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6b6b6b]">
      {children}
    </th>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[126px_minmax(0,1fr)] gap-3 text-sm">
      <dt className="text-[#8a8a8a]">{label}</dt>
      <dd className="break-words font-medium text-[#232323]">{value}</dd>
    </div>
  );
}

function ReferenceRow({
  label,
  reference,
}: {
  label: string;
  reference: { label: string; secondary?: string | null; href?: string } | null;
}) {
  if (!reference) {
    return <DetailRow label={label} value="Not linked" />;
  }

  return (
    <div className="grid grid-cols-[126px_minmax(0,1fr)] gap-3 text-sm">
      <dt className="text-[#8a8a8a]">{label}</dt>
      <dd>
        {reference.href ? (
          <Link
            href={reference.href}
            className="inline-flex items-center gap-1 break-words font-medium text-brand-500 hover:underline"
          >
            {reference.label}
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
          </Link>
        ) : (
          <span className="break-words font-medium text-[#232323]">
            {reference.label}
          </span>
        )}
        {reference.secondary && (
          <span className="mt-0.5 block break-words text-xs text-[#8a8a8a]">
            {reference.secondary}
          </span>
        )}
      </dd>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const className =
    STATUS_COLORS[normalized] ?? "border-gray-200 bg-gray-100 text-gray-700";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

function EligibilityBadge({ status }: { status: RefundEligibilityStatus }) {
  const labels: Record<RefundEligibilityStatus, string> = {
    eligible: "Eligible",
    manual_review: "Review",
    not_eligible: "Not eligible",
  };

  return <StatusBadge status={labels[status]} />;
}

const STATUS_COLORS: Record<string, string> = {
  paid: "border-green-200 bg-green-50 text-green-700",
  succeeded: "border-green-200 bg-green-50 text-green-700",
  complete: "border-green-200 bg-green-50 text-green-700",
  completed: "border-green-200 bg-green-50 text-green-700",
  sent: "border-green-200 bg-green-50 text-green-700",
  eligible: "border-green-200 bg-green-50 text-green-700",
  pending: "border-yellow-200 bg-yellow-50 text-yellow-700",
  requested: "border-yellow-200 bg-yellow-50 text-yellow-700",
  processing: "border-yellow-200 bg-yellow-50 text-yellow-700",
  review: "border-yellow-200 bg-yellow-50 text-yellow-700",
  manual_review: "border-yellow-200 bg-yellow-50 text-yellow-700",
  refunded: "border-blue-200 bg-blue-50 text-blue-700",
  partial_refund: "border-blue-200 bg-blue-50 text-blue-700",
  failed: "border-red-200 bg-red-50 text-red-700",
  canceled: "border-red-200 bg-red-50 text-red-700",
  cancelled: "border-red-200 bg-red-50 text-red-700",
  not_eligible: "border-gray-200 bg-gray-100 text-gray-700",
  "not eligible": "border-gray-200 bg-gray-100 text-gray-700",
  none: "border-gray-200 bg-gray-100 text-gray-700",
  missing: "border-gray-200 bg-gray-100 text-gray-700",
  not_requested: "border-gray-200 bg-gray-100 text-gray-700",
};

function formatDateTime(value: string | null) {
  if (!value) return "Not recorded";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

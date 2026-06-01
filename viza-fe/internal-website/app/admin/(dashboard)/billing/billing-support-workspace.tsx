"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import {
  ArrowUpRight,
  CircleDollarSign,
  FileText,
  ReceiptText,
  RefreshCcw,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { normalizeInterfaceLocale, type InterfaceLocale } from "@/lib/i18n/locale";
import type {
  BillingDataNotice,
  BillingStatusSummary,
  BillingSupportRecord,
  RefundEligibilityStatus,
} from "./types";

interface BillingSupportWorkspaceProps {
  records: BillingSupportRecord[];
  summary: BillingStatusSummary;
  generatedAt: string;
  notices: BillingDataNotice[];
}

const COPY = {
  en: {
    title: "Billing Support",
    subtitle: "Payments, receipts, invoice requests, and refund support queue",
    refreshed: "Refreshed",
    collected: "Collected agency fees",
    paidPayments: "Paid payments",
    openInvoices: "Open invoices",
    openRefunds: "Open refunds",
    records: "Billing Records",
    supportRecords: (count: number) => `${count} support records`,
    customer: "Customer",
    application: "Application",
    package: "Package",
    payment: "Payment",
    invoice: "Invoice",
    refund: "Refund",
    receipt: "Receipt",
    unlinkedCustomer: "Unlinked customer",
    noApplicantRef: "No applicant ref",
    noApplication: "No application",
    noStatus: "No status",
    noPackage: "No package",
    noPackageRef: "No package ref",
    noPaymentRecord: "No payment record",
    noRequest: "No request",
    notAvailable: "Not available",
    noProvisionedRecords: "Billing records will appear after the billing data store is provisioned",
    noRecords: "No billing records found",
    selectRecord: "Select a billing record.",
    supportPanel: "Support Panel",
    references: "References",
    governmentFeeMode: "Government fee mode",
    status: "Status",
    amount: "Amount",
    feeType: "Fee type",
    provider: "Provider",
    sessionRef: "Session ref",
    paymentRef: "Payment ref",
    openReceipt: "Open receipt",
    invoiceRequest: "Invoice Request",
    billingEmail: "Billing email",
    taxIdentifier: "Tax identifier",
    notes: "Notes",
    requested: "Requested",
    refundEligibility: "Refund Eligibility",
    eligibleAmount: "Eligible amount",
    reason: "Reason",
    timeline: "Timeline",
    notRecorded: "Not recorded",
    notLinked: "Not linked",
    notProvided: "Not provided",
    noNotes: "No notes",
    noInvoiceRequest: "No invoice request.",
    eligible: "Eligible",
    review: "Review",
    notEligible: "Not eligible",
    billingMissingTitle: "Billing data store is not provisioned yet.",
    billingMissingDescription:
      "The admin UI is ready, but this Supabase project does not currently expose the payment, invoice, and refund tables required for billing support.",
    queryErrorTitle: "Some billing data could not be loaded.",
    queryErrorDescription:
      "A support data query failed. The page is showing the records that could be loaded.",
  },
  zh: {
    title: "账单支持",
    subtitle: "查看付款、收据、发票申请和退款支持队列",
    refreshed: "刷新于",
    collected: "已收 VIZA 服务费",
    paidPayments: "已付款记录",
    openInvoices: "未完成发票",
    openRefunds: "未完成退款",
    records: "账单记录",
    supportRecords: (count: number) => `${count} 条支持记录`,
    customer: "客户",
    application: "申请",
    package: "套餐",
    payment: "付款",
    invoice: "发票",
    refund: "退款",
    receipt: "收据",
    unlinkedCustomer: "未关联客户",
    noApplicantRef: "暂无申请人引用",
    noApplication: "暂无申请",
    noStatus: "暂无状态",
    noPackage: "暂无套餐",
    noPackageRef: "暂无套餐引用",
    noPaymentRecord: "暂无付款记录",
    noRequest: "暂无申请",
    notAvailable: "不可用",
    noProvisionedRecords: "账单数据表配置完成后，这里会显示账单记录",
    noRecords: "暂无账单记录",
    selectRecord: "请选择一条账单记录。",
    supportPanel: "支持面板",
    references: "关联信息",
    governmentFeeMode: "官方费用模式",
    status: "状态",
    amount: "金额",
    feeType: "费用类型",
    provider: "支付渠道",
    sessionRef: "会话引用",
    paymentRef: "付款引用",
    openReceipt: "打开收据",
    invoiceRequest: "发票申请",
    billingEmail: "开票邮箱",
    taxIdentifier: "税号",
    notes: "备注",
    requested: "申请时间",
    refundEligibility: "退款资格",
    eligibleAmount: "可退金额",
    reason: "原因",
    timeline: "时间线",
    notRecorded: "未记录",
    notLinked: "未关联",
    notProvided: "未提供",
    noNotes: "暂无备注",
    noInvoiceRequest: "暂无发票申请。",
    eligible: "可退款",
    review: "需审核",
    notEligible: "不可退款",
    billingMissingTitle: "账单数据表尚未配置。",
    billingMissingDescription:
      "管理界面已准备好，但当前 Supabase 项目尚未暴露账单支持所需的付款、发票和退款表。",
    queryErrorTitle: "部分账单数据无法加载。",
    queryErrorDescription: "支持数据查询失败。页面会展示已成功加载的记录。",
  },
} as const;

type BillingCopy = (typeof COPY)["en" | "zh"];

export function BillingSupportWorkspace({
  records,
  summary,
  generatedAt,
  notices,
}: BillingSupportWorkspaceProps) {
  const locale = normalizeInterfaceLocale(useLocale());
  const copy = COPY[locale];
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
            {copy.title}
          </h1>
          <p className="mt-1 text-sm text-[#6b6b6b]">
            {copy.subtitle}
          </p>
        </div>
        <p className="text-xs text-[#8a8a8a]">
          {copy.refreshed} {formatDateTime(generatedAt, locale, copy.notRecorded)}
        </p>
      </div>

      {notices.length > 0 && (
        <div className="mb-6 space-y-3">
          {notices.map((notice) => (
            <DataNotice key={`${notice.tone}-${notice.title}`} notice={notice} copy={copy} />
          ))}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryTile
          icon={CircleDollarSign}
          label={copy.collected}
          value={summary.collectedCurrency}
        />
        <SummaryTile
          icon={ReceiptText}
          label={copy.paidPayments}
          value={summary.paidCount.toString()}
        />
        <SummaryTile
          icon={FileText}
          label={copy.openInvoices}
          value={summary.openInvoiceRequests.toString()}
        />
        <SummaryTile
          icon={RefreshCcw}
          label={copy.openRefunds}
          value={summary.openRefundRequests.toString()}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.9fr)]">
        <div className="overflow-hidden rounded-lg border border-[#efefef] bg-white shadow-sm">
          <div className="border-b border-[#efefef] px-4 py-3">
            <h2 className="text-base font-semibold text-[#232323]">
              {copy.records}
            </h2>
            <p className="text-xs text-[#8a8a8a]">
              {copy.supportRecords(summary.totalRecords)}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-b bg-[#fafafa]">
                  <TableHeader>{copy.customer}</TableHeader>
                  <TableHeader>{copy.application}</TableHeader>
                  <TableHeader>{copy.package}</TableHeader>
                  <TableHeader>{copy.payment}</TableHeader>
                  <TableHeader>{copy.invoice}</TableHeader>
                  <TableHeader>{copy.refund}</TableHeader>
                  <TableHeader>{copy.receipt}</TableHeader>
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
                            {record.applicant?.label ?? copy.unlinkedCustomer}
                          </span>
                          <span className="block truncate text-xs text-[#8a8a8a]">
                            {record.applicant?.secondary ?? copy.noApplicantRef}
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
                          <span className="text-[#9ca3af]">{copy.noApplication}</span>
                        )}
                        <span className="block text-xs text-[#8a8a8a]">
                          {record.applicationStatus ? localizeStatus(record.applicationStatus, locale) : copy.noStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className="block font-medium text-[#232323]">
                          {record.visaPackage?.label ?? copy.noPackage}
                        </span>
                        <span className="block text-xs text-[#8a8a8a]">
                          {record.visaPackage?.secondary ??
                            record.governmentFeeMode ??
                            copy.noPackageRef}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <StatusBadge status={record.payment?.status ?? "missing"} locale={locale} />
                        <span className="mt-1 block text-xs text-[#6b6b6b]">
                          {record.payment?.amountLabel ?? copy.noPaymentRecord}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <StatusBadge status={record.invoiceStatus} locale={locale} />
                        <span className="mt-1 block text-xs text-[#8a8a8a]">
                          {record.latestInvoice?.billingEmail ?? copy.noRequest}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <StatusBadge status={record.refundStatus} locale={locale} />
                        <span className="mt-1 block text-xs text-[#8a8a8a]">
                          {localizeEligibility(record.refundEligibility.status, copy)}
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
                            {copy.receipt}
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <span className="text-xs text-[#9ca3af]">
                            {copy.notAvailable}
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
                      {notices.some((notice) => notice.tone === "warning")
                        ? copy.noProvisionedRecords
                        : copy.noRecords}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <SupportPanel record={selectedRecord} copy={copy} locale={locale} />
      </div>
    </div>
  );
}

function DataNotice({
  notice,
  copy,
}: {
  notice: BillingDataNotice;
  copy: BillingCopy;
}) {
  const classes =
    notice.tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-red-200 bg-red-50 text-red-700";
  const localizedNotice = localizeNotice(notice, copy);

  return (
    <div className={`rounded-lg border p-4 text-sm ${classes}`}>
      <p className="font-medium">{localizedNotice.title}</p>
      <p className="mt-1">{localizedNotice.description}</p>
      {notice.details && notice.details.length > 0 && (
        <ul className="mt-2 space-y-1">
          {notice.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SupportPanel({
  record,
  copy,
  locale,
}: {
  record: BillingSupportRecord | undefined;
  copy: BillingCopy;
  locale: InterfaceLocale;
}) {
  if (!record) {
    return (
      <aside className="rounded-lg border border-[#efefef] bg-white p-6 shadow-sm">
        <p className="text-sm text-[#9ca3af]">{copy.selectRecord}</p>
      </aside>
    );
  }

  return (
    <aside className="rounded-lg border border-[#efefef] bg-white shadow-sm">
      <div className="border-b border-[#efefef] px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#232323]">
              {copy.supportPanel}
            </h2>
            <p className="text-xs text-[#8a8a8a]">{record.id}</p>
          </div>
          <EligibilityBadge status={record.refundEligibility.status} copy={copy} locale={locale} />
        </div>
      </div>

      <div className="space-y-5 p-5">
        <PanelSection title={copy.references}>
          <ReferenceRow label={copy.customer} reference={record.applicant} copy={copy} />
          <ReferenceRow label={copy.application} reference={record.application} copy={copy} />
          <ReferenceRow label={copy.package} reference={record.visaPackage} copy={copy} />
          <DetailRow
            label={copy.governmentFeeMode}
            value={record.governmentFeeMode ?? copy.notRecorded}
          />
        </PanelSection>

        <PanelSection title={copy.payment}>
          <DetailRow
            label={copy.status}
            value={record.payment?.status ? localizeStatus(record.payment.status, locale) : copy.noPaymentRecord}
          />
          <DetailRow
            label={copy.amount}
            value={record.payment?.amountLabel ?? copy.notAvailable}
          />
          <DetailRow
            label={copy.feeType}
            value={record.payment?.feeType ?? copy.notAvailable}
          />
          <DetailRow
            label={copy.provider}
            value={record.payment?.provider ?? copy.notAvailable}
          />
          <DetailRow
            label={copy.sessionRef}
            value={record.payment?.providerSessionRef ?? copy.notAvailable}
          />
          <DetailRow
            label={copy.paymentRef}
            value={record.payment?.providerPaymentRef ?? copy.notAvailable}
          />
          {record.payment?.metadata.map((item) => (
            <DetailRow
              key={`${item.label}-${item.value}`}
              label={localizeMetadataLabel(item.label, locale)}
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
              {copy.openReceipt}
              <ArrowUpRight className="h-4 w-4" />
            </a>
          )}
        </PanelSection>

        <PanelSection title={copy.invoiceRequest}>
          {record.invoices.length > 0 ? (
            record.invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="rounded-lg border border-[#efefef] p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-[#232323]">
                    {invoice.invoiceName ?? copy.invoiceRequest}
                  </span>
                  <StatusBadge status={invoice.status} locale={locale} />
                </div>
                <DetailRow
                  label={copy.billingEmail}
                  value={invoice.billingEmail ?? copy.notProvided}
                />
                <DetailRow
                  label={copy.taxIdentifier}
                  value={invoice.taxIdentifierMasked ?? copy.notProvided}
                />
                <DetailRow
                  label={copy.notes}
                  value={invoice.notes ?? copy.noNotes}
                />
                <DetailRow
                  label={copy.requested}
                  value={formatDateTime(invoice.createdAt, locale, copy.notRecorded)}
                />
              </div>
            ))
          ) : (
            <p className="text-sm text-[#9ca3af]">{copy.noInvoiceRequest}</p>
          )}
        </PanelSection>

        <PanelSection title={copy.refundEligibility}>
          <div className="rounded-lg border border-[#efefef] p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-[#232323]">
                {localizeEligibility(record.refundEligibility.status, copy)}
              </span>
              <span className="text-xs text-[#8a8a8a]">
                {record.refundEligibility.ruleCode}
              </span>
            </div>
            <DetailRow
              label={copy.eligibleAmount}
              value={record.refundEligibility.eligibleAmountLabel}
            />
            <p className="mt-2 text-sm text-[#6b6b6b]">
              {localizeRefundReason(record.refundEligibility.ruleCode, record.refundEligibility.reason, locale)}
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
                    <StatusBadge status={refund.status} locale={locale} />
                  </div>
                  <DetailRow
                    label={copy.reason}
                    value={refund.reason ?? copy.notProvided}
                  />
                  <DetailRow
                    label={copy.requested}
                    value={formatDateTime(refund.createdAt, locale, copy.notRecorded)}
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

        <PanelSection title={copy.timeline}>
          <div className="space-y-3">
            {record.timeline.map((event) => (
              <div key={event.id} className="flex gap-3">
                <div className="mt-1 h-2 w-2 rounded-full bg-brand-500" />
                <div>
                  <p className="text-sm font-medium text-[#232323]">
                    {localizeTimelineLabel(event.label, locale)}
                  </p>
                  <p className="text-xs text-[#8a8a8a]">
                    {localizeStatus(event.status, locale)} - {formatDateTime(event.happenedAt, locale, copy.notRecorded)}
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

import type { Metadata } from "next";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  HelpCircle,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  WalletCards,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getDestinationDisplayNameForLocale,
  getDestinationFlag,
  getFormVisaType,
  getVisaTypeDisplayNameForLocale,
} from "@/lib/visa-destinations";
import { InvoiceRequestForm } from "./invoice-request-form";
import {
  getBillingOverview,
  isPaidPaymentStatus,
  type BillingApplication,
  type BillingInvoiceRequest,
  type BillingPaymentRecord,
  type BillingRefundRecord,
  type BillingVisaPackage,
} from "./data";
import { getBillingCopy, type BillingCopy } from "./copy";

export async function generateMetadata(): Promise<Metadata> {
  const copy = getBillingCopy(await getLocale());
  return { title: copy.metadataTitle };
}

export const dynamic = "force-dynamic";

type Tone = "brand" | "emerald" | "amber" | "red" | "slate" | "blue";

interface StatusMeta {
  label: string;
  description?: string;
  tone: Tone;
  icon: LucideIcon;
}

interface PaymentGroup {
  key: string;
  application: BillingApplication | null;
  packageItem: BillingVisaPackage | null;
  payments: BillingPaymentRecord[];
}

interface GovernmentDisclosure {
  amountCents: number | null;
  currency: string;
  mode: string;
  label: string;
}

interface GovernmentDisclosureRow {
  key: string;
  application: BillingApplication | null;
  packageItem: BillingVisaPackage | null;
}

const toneClasses: Record<Tone, string> = {
  brand: "border-brand-200 bg-brand-50 text-brand-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  red: "border-red-200 bg-red-50 text-red-700",
  slate: "border-slate-200 bg-slate-50 text-slate-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
};

function formatMoney(cents: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale.startsWith("zh") ? "zh-CN" : "en-AU", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `${currency || "USD"} ${(cents / 100).toFixed(2)}`;
  }
}

function formatDate(value: string | null, locale: string, copy: BillingCopy): string {
  if (!value) return copy.dateNotRecorded;

  return new Intl.DateTimeFormat(locale.startsWith("zh") ? "zh-CN" : "en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown> | null, key: string): string | null {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function readNumber(record: Record<string, unknown> | null, key: string): number | null {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function makeMap<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

function firstByPaymentId<T extends { payment_record_id: string | null }>(items: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    if (item.payment_record_id && !map.has(item.payment_record_id)) {
      map.set(item.payment_record_id, item);
    }
  }
  return map;
}

function getPaymentStatus(status: string, copy: BillingCopy): StatusMeta {
  const normalized = status.toLowerCase();
  if (isPaidPaymentStatus(status)) {
    return {
      label: copy.statuses.paid,
      tone: "emerald",
      icon: CheckCircle2,
    };
  }
  if (["failed", "canceled", "cancelled"].includes(normalized)) {
    return {
      label: copy.statuses.paymentFailed,
      tone: "red",
      icon: XCircle,
    };
  }
  if (["refunded", "partially_refunded"].includes(normalized)) {
    return {
      label: copy.statuses.unknown(status),
      tone: "blue",
      icon: RefreshCcw,
    };
  }
  return {
    label: status ? copy.statuses.unknown(status) : copy.statuses.pending,
    tone: "amber",
    icon: Clock3,
  };
}

function getInvoiceStatus(invoice: BillingInvoiceRequest | undefined, copy: BillingCopy): StatusMeta {
  if (!invoice) {
    return {
      label: copy.statuses.invoiceNotRequested,
      description: copy.statuses.invoiceNotRequestedDescription,
      tone: "slate",
      icon: FileText,
    };
  }

  if (invoice.status === "generated") {
    return {
      label: copy.statuses.invoiceGenerated,
      description: copy.statuses.invoiceGeneratedDescription,
      tone: "emerald",
      icon: CheckCircle2,
    };
  }

  if (invoice.status === "rejected") {
    return {
      label: copy.statuses.invoiceFollowUp,
      description: copy.statuses.invoiceFollowUpDescription,
      tone: "red",
      icon: AlertCircle,
    };
  }

  return {
    label: copy.statuses.invoiceRequested,
    description: copy.statuses.invoiceRequestedDescription,
    tone: "blue",
    icon: Clock3,
  };
}

function getRefundStatus(
  payment: BillingPaymentRecord,
  application: BillingApplication | null,
  refund: BillingRefundRecord | undefined,
  copy: BillingCopy,
  locale: string,
): StatusMeta {
  if (refund) {
    if (refund.status === "refunded") {
      return {
        label: copy.statuses.refundedLabel,
        description: copy.statuses.refunded(
          formatMoney(refund.amount_cents, refund.currency, locale),
          formatDate(refund.updated_at ?? refund.created_at, locale, copy),
        ),
        tone: "emerald",
        icon: CheckCircle2,
      };
    }

    if (refund.status === "approved") {
      return {
        label: copy.statuses.refundApproved,
        description: copy.statuses.refundApprovedDescription,
        tone: "emerald",
        icon: CheckCircle2,
      };
    }

    if (refund.status === "rejected") {
      const refundReason = refund.reason?.trim();
      return {
        label: copy.statuses.refundRejected,
        description:
          refundReason && (!locale.startsWith("zh") || /[\u3400-\u9fff]/u.test(refundReason))
            ? refundReason
            : copy.statuses.refundRejectedDescription,
        tone: "red",
        icon: XCircle,
      };
    }

    return {
      label: copy.statuses.refundRequested,
      description: copy.statuses.refundRequestedDescription,
      tone: "blue",
      icon: Clock3,
    };
  }

  if (!isPaidPaymentStatus(payment.status)) {
    return {
      label: copy.statuses.refundReviewUnavailable,
      description: copy.statuses.refundReviewUnavailableDescription,
      tone: "slate",
      icon: HelpCircle,
    };
  }

  if (application?.submitted_at || application?.external_status || application?.result_status) {
    return {
      label: copy.statuses.notNormallyEligible,
      description: copy.statuses.notNormallyEligibleDescription,
      tone: "red",
      icon: ShieldCheck,
    };
  }

  if (application?.packet_status && application.packet_status !== "not_started") {
    return {
      label: copy.statuses.staffReviewRequired,
      description: copy.statuses.staffReviewRequiredDescription,
      tone: "amber",
      icon: AlertCircle,
    };
  }

  return {
    label: copy.statuses.eligibleForStaffReview,
    description: copy.statuses.eligibleForStaffReviewDescription,
    tone: "emerald",
    icon: CheckCircle2,
  };
}

function StatusPill({ meta }: { meta: StatusMeta }) {
  const Icon = meta.icon;

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold", toneClasses[meta.tone])}>
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}

function getPackageLabel(application: BillingApplication | null, packageItem: BillingVisaPackage | null, locale: string): string {
  if (packageItem?.name && (!locale.startsWith("zh") || /[\u3400-\u9fff]/u.test(packageItem.name))) return packageItem.name;

  const country = application?.country ?? packageItem?.country ?? "visa";
  const visaType = getFormVisaType(application?.visa_type ?? packageItem?.visa_type ?? "application");
  return `${getDestinationDisplayNameForLocale(country, locale)} ${getVisaTypeDisplayNameForLocale(visaType, locale)}`;
}

function getRouteLabel(application: BillingApplication | null, packageItem: BillingVisaPackage | null, locale: string): string {
  const country = application?.country ?? packageItem?.country ?? "visa";
  const visaType = getFormVisaType(application?.visa_type ?? packageItem?.visa_type ?? "application");
  return `${getDestinationDisplayNameForLocale(country, locale)} · ${getVisaTypeDisplayNameForLocale(visaType, locale)}`;
}

function getApplicationFlag(application: BillingApplication | null, packageItem: BillingVisaPackage | null): string {
  return getDestinationFlag(application?.country ?? packageItem?.country ?? "visa");
}

function getCheckoutHref(application: BillingApplication | null, packageItem: BillingVisaPackage | null): string {
  const searchParams = new URLSearchParams();
  if (application?.id) searchParams.set("applicationId", application.id);
  if (packageItem?.id) searchParams.set("packageId", packageItem.id);
  const query = searchParams.toString();
  return query ? `/client/checkout?${query}` : "/client/checkout";
}

function buildPaymentGroups(
  payments: BillingPaymentRecord[],
  applications: BillingApplication[],
  packagesById: Map<string, BillingVisaPackage>,
): PaymentGroup[] {
  const applicationsById = makeMap(applications);
  const groups = new Map<string, PaymentGroup>();

  for (const payment of payments) {
    const application = payment.application_id ? applicationsById.get(payment.application_id) ?? null : null;
    const packageItem =
      (payment.visa_package_id ? packagesById.get(payment.visa_package_id) : null) ??
      (application?.visa_package_id ? packagesById.get(application.visa_package_id) : null) ??
      null;
    const key = application?.id ?? payment.visa_package_id ?? payment.id;
    const existing = groups.get(key);

    if (existing) {
      existing.payments.push(payment);
    } else {
      groups.set(key, {
        key,
        application,
        packageItem,
        payments: [payment],
      });
    }
  }

  return Array.from(groups.values());
}

function getUnpaidApplications(
  applications: BillingApplication[],
  payments: BillingPaymentRecord[],
): BillingApplication[] {
  const paidApplicationIds = new Set(
    payments
      .filter((payment) => payment.application_id && isPaidPaymentStatus(payment.status))
      .map((payment) => payment.application_id),
  );

  return applications.filter((application) => !paidApplicationIds.has(application.id));
}

function buildGovernmentDisclosureRows(
  applications: BillingApplication[],
  paymentGroups: PaymentGroup[],
  packagesById: Map<string, BillingVisaPackage>,
): GovernmentDisclosureRow[] {
  const rows: GovernmentDisclosureRow[] = applications.map((application) => ({
    key: application.id,
    application,
    packageItem: application.visa_package_id ? packagesById.get(application.visa_package_id) ?? null : null,
  }));
  const seenKeys = new Set(rows.map((row) => row.key));

  for (const group of paymentGroups) {
    if (!group.packageItem || seenKeys.has(group.packageItem.id)) continue;

    rows.push({
      key: group.packageItem.id,
      application: null,
      packageItem: group.packageItem,
    });
    seenKeys.add(group.packageItem.id);
  }

  return rows;
}

function summarizePaidTotals(payments: BillingPaymentRecord[], locale: string, copy: BillingCopy): string {
  const totals = new Map<string, number>();
  for (const payment of payments.filter((item) => isPaidPaymentStatus(item.status))) {
    totals.set(payment.currency, (totals.get(payment.currency) ?? 0) + payment.amount_cents);
  }

  if (totals.size === 0) return copy.statuses.noPaidRecords;
  return Array.from(totals.entries())
    .map(([currency, cents]) => formatMoney(cents, currency, locale))
    .join(" / ");
}

function getGovernmentDisclosure(
  application: BillingApplication | null,
  packageItem: BillingVisaPackage | null,
  copy: BillingCopy,
  locale: string,
): GovernmentDisclosure {
  const metadata = asRecord(packageItem?.metadata);
  const governmentFee = asRecord(metadata?.government_fee);
  const amountCents = application?.government_fee_cents ?? readNumber(governmentFee, "amount_cents");
  const currency =
    application?.government_fee_currency ??
    readString(governmentFee, "currency") ??
    packageItem?.currency ??
    "USD";
  const mode = application?.government_fee_mode ?? readString(governmentFee, "mode") ?? "display_only";
  const metadataLabel = readString(governmentFee, "label");
  const label =
    metadataLabel && (!locale.startsWith("zh") || /[\u3400-\u9fff]/u.test(metadataLabel))
      ? metadataLabel
      : mode === "unknown"
        ? copy.government.officialFeeConfirmed
        : copy.government.separateFromAgency;

  return {
    amountCents,
    currency,
    mode,
    label,
  };
}

function formatGovernmentFee(disclosure: GovernmentDisclosure, locale: string, copy: BillingCopy): string {
  if (disclosure.amountCents === null) return copy.government.officialSource;
  if (disclosure.amountCents === 0) return copy.government.notCollected;
  return formatMoney(disclosure.amountCents, disclosure.currency, locale);
}

function PaymentRecordCard({
  payment,
  application,
  invoice,
  refund,
  applicantEmail,
  copy,
  locale,
}: {
  payment: BillingPaymentRecord;
  application: BillingApplication | null;
  invoice: BillingInvoiceRequest | undefined;
  refund: BillingRefundRecord | undefined;
  applicantEmail: string | null;
  copy: BillingCopy;
  locale: string;
}) {
  const paymentStatus = getPaymentStatus(payment.status, copy);
  const invoiceStatus = getInvoiceStatus(invoice, copy);
  const refundStatus = getRefundStatus(payment, application, refund, copy, locale);

  return (
    <article className="rounded-lg border bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill meta={paymentStatus} />
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
              {copy.paymentCard.agencyFeeOnly}
            </span>
          </div>
          <div>
            <p className="text-2xl font-semibold text-foreground">
              {formatMoney(payment.amount_cents, payment.currency, locale)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {copy.paymentCard.paidRecordCreated(formatDate(payment.created_at, locale, copy))}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {payment.receipt_url ? (
            <Button asChild variant="outline" className="h-11 rounded-full">
              <Link href={payment.receipt_url} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4" />
                {copy.paymentCard.downloadReceipt}
              </Link>
            </Button>
          ) : (
            <span className="inline-flex min-h-11 items-center rounded-full border border-dashed px-4 text-sm font-medium text-muted-foreground">
              {copy.paymentCard.receiptPending}
            </span>
          )}
          <Button asChild variant="outline" className="h-11 rounded-full">
            <Link href="/client/status">
              <ExternalLink className="h-4 w-4" />
              {copy.paymentCard.caseStatus}
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-blue-900">{copy.paymentCard.invoice}</p>
            <StatusPill meta={invoiceStatus} />
          </div>
          <p className="mt-2 text-sm leading-6 text-blue-900/80">{invoiceStatus.description}</p>
          {invoice ? (
            <dl className="mt-3 grid gap-2 text-sm text-blue-950 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase text-blue-900/60">{copy.paymentCard.requestedFor}</dt>
                <dd className="mt-1 font-semibold">{invoice.invoice_name ?? copy.paymentCard.billingNamePending}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-blue-900/60">{copy.paymentCard.requestedOn}</dt>
                <dd className="mt-1 font-semibold">{formatDate(invoice.created_at, locale, copy)}</dd>
              </div>
            </dl>
          ) : isPaidPaymentStatus(payment.status) ? (
            <div className="mt-4">
              <InvoiceRequestForm paymentRecordId={payment.id} defaultEmail={applicantEmail} />
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900">{copy.paymentCard.refundVisibility}</p>
            <StatusPill meta={refundStatus} />
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-700">{refundStatus.description}</p>
        </div>
      </div>
    </article>
  );
}

function EmptyPayments({ copy }: { copy: BillingCopy }) {
  return (
    <div className="rounded-lg border border-dashed bg-white px-6 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-500">
        <ReceiptText className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-xl font-semibold text-foreground">{copy.empty.title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
        {copy.empty.description}
      </p>
      <Button asChild className="mt-6 h-11 rounded-full">
        <Link href="/client/checkout">
          {copy.empty.checkout}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

function ErrorBanner({ message, copy }: { message: string; copy: BillingCopy }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
      <div className="flex gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">{copy.errors.unavailableTitle}</p>
          <p className="mt-1">{message}</p>
        </div>
      </div>
    </div>
  );
}

export default async function ClientBillingPage() {
  const locale = await getLocale();
  const copy = getBillingCopy(locale);
  const overview = await getBillingOverview(locale);
  const packagesById = makeMap(overview.packages);
  const invoicesByPaymentId = firstByPaymentId(overview.invoiceRequests);
  const refundsByPaymentId = firstByPaymentId(overview.refundRecords);
  const paidPayments = overview.payments.filter((payment) => isPaidPaymentStatus(payment.status));
  const receiptCount = paidPayments.filter((payment) => Boolean(payment.receipt_url)).length;
  const paymentGroups = buildPaymentGroups(overview.payments, overview.applications, packagesById);
  const unpaidApplications = getUnpaidApplications(overview.applications, overview.payments);
  const governmentDisclosureRows = buildGovernmentDisclosureRows(overview.applications, paymentGroups, packagesById);

  return (
    <div className="mx-auto w-full max-w-[1160px] pb-16">
      <section className="pt-5 sm:pt-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-500">{copy.page.eyebrow}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">
              {copy.page.title}
            </h1>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              {copy.page.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="h-11 rounded-full">
              <Link href="/client/status">
                <ShieldCheck className="h-4 w-4" />
                {copy.page.viewCaseStatus}
              </Link>
            </Button>
            <Button asChild className="h-11 rounded-full">
              <Link href="/client/checkout">
                <WalletCards className="h-4 w-4" />
                {copy.page.checkout}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {overview.error ? (
        <section className="mt-6">
          <ErrorBanner message={overview.error} copy={copy} />
        </section>
      ) : null}

      <section className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: copy.page.paidAgencyFees, value: summarizePaidTotals(overview.payments, locale, copy), icon: WalletCards },
          { label: copy.page.receiptLinksLabel, value: copy.page.receiptLinks(receiptCount), icon: ReceiptText },
          { label: copy.page.invoiceRequestsLabel, value: copy.page.invoiceRequests(overview.invoiceRequests.length), icon: FileText },
          { label: copy.page.refundRecordsLabel, value: copy.page.refundRecords(overview.refundRecords.length), icon: RefreshCcw },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-lg border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-500">
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 text-xl font-semibold text-foreground">{item.value}</p>
            </div>
          );
        })}
      </section>

      {unpaidApplications.length > 0 ? (
        <section className="mt-7 rounded-lg border border-amber-200 bg-amber-50 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-amber-900">
                <AlertCircle className="h-5 w-5" />
                <h2 className="text-lg font-semibold">{copy.page.agencyFeeAttention}</h2>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-900/80">
                {copy.page.agencyFeeAttentionDescription}
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {unpaidApplications.map((application) => {
              const packageItem = application.visa_package_id ? packagesById.get(application.visa_package_id) ?? null : null;
              return (
                <div key={application.id} className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{getPackageLabel(application, packageItem, locale)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{getRouteLabel(application, packageItem, locale)}</p>
                  </div>
                  <Button asChild className="h-10 rounded-full">
                    <Link href={getCheckoutHref(application, packageItem)}>
                      {copy.page.payAgencyFee}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="mt-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">{copy.page.paymentHistory}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{copy.page.paymentHistoryDescription}</p>
          </div>
        </div>

        <div className="mt-5 space-y-6">
          {paymentGroups.length === 0 ? (
            <EmptyPayments copy={copy} />
          ) : (
            paymentGroups.map((group) => (
              <section key={group.key} className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="text-3xl leading-none" aria-hidden="true">
                      {getApplicationFlag(group.application, group.packageItem)}
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-xl font-semibold text-foreground">{getPackageLabel(group.application, group.packageItem, locale)}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{getRouteLabel(group.application, group.packageItem, locale)}</p>
                    </div>
                  </div>
                  <Button asChild variant="outline" className="h-10 rounded-full">
                    <Link href="/client/status">
                      {copy.page.viewProgress}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>

                <div className="space-y-3">
                  {group.payments.map((payment) => (
                    <PaymentRecordCard
                      key={payment.id}
                      payment={payment}
                      application={group.application}
                      invoice={invoicesByPaymentId.get(payment.id)}
                      refund={refundsByPaymentId.get(payment.id)}
                      applicantEmail={overview.applicant.email}
                      copy={copy}
                      locale={locale}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </section>

      <section className="mt-10">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{copy.page.governmentDisclosure}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {copy.page.governmentDisclosureDescription}
          </p>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {governmentDisclosureRows.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-white p-5 text-sm text-muted-foreground">
              {copy.government.shownAfterSelection}
            </div>
          ) : (
            governmentDisclosureRows.map((row) => {
              const disclosure = getGovernmentDisclosure(row.application, row.packageItem, copy, locale);
              return (
                <div key={row.key} className="rounded-lg border bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{getPackageLabel(row.application, row.packageItem, locale)}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{getRouteLabel(row.application, row.packageItem, locale)}</p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                      {copy.statuses.mode(disclosure.mode)}
                    </span>
                  </div>
                  <p className="mt-4 text-lg font-semibold text-foreground">{formatGovernmentFee(disclosure, locale, copy)}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{disclosure.label}</p>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

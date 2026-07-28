import type { Metadata } from "next";
import Link from "next/link";
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
  getDestinationDisplayName,
  getDestinationFlag,
  getFormVisaType,
  getVisaTypeDisplayName,
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

export const metadata: Metadata = {
  title: "Billing | VIZA",
};

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

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `${currency || "USD"} ${(cents / 100).toFixed(2)}`;
  }
}

function formatDate(value: string | null): string {
  if (!value) return "Not recorded";

  return new Intl.DateTimeFormat("en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function normalizeStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
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

function getPaymentStatus(status: string): StatusMeta {
  const normalized = status.toLowerCase();
  if (isPaidPaymentStatus(status)) {
    return {
      label: "Paid",
      tone: "emerald",
      icon: CheckCircle2,
    };
  }
  if (["failed", "canceled", "cancelled"].includes(normalized)) {
    return {
      label: "Payment failed",
      tone: "red",
      icon: XCircle,
    };
  }
  if (["refunded", "partially_refunded"].includes(normalized)) {
    return {
      label: normalizeStatus(status),
      tone: "blue",
      icon: RefreshCcw,
    };
  }
  return {
    label: normalizeStatus(status || "pending"),
    tone: "amber",
    icon: Clock3,
  };
}

function getInvoiceStatus(invoice: BillingInvoiceRequest | undefined): StatusMeta {
  if (!invoice) {
    return {
      label: "Invoice not requested",
      description: "B2B invoices are generated after a request is reviewed.",
      tone: "slate",
      icon: FileText,
    };
  }

  if (invoice.status === "generated") {
    return {
      label: "Invoice generated",
      description: "The VIZA team has generated an invoice for this agency-fee payment.",
      tone: "emerald",
      icon: CheckCircle2,
    };
  }

  if (invoice.status === "rejected") {
    return {
      label: "Invoice request needs follow-up",
      description: "The request could not be completed as submitted. Contact support for next steps.",
      tone: "red",
      icon: AlertCircle,
    };
  }

  return {
    label: "Invoice requested",
    description: "The VIZA team will generate the invoice after billing review.",
    tone: "blue",
    icon: Clock3,
  };
}

function getRefundStatus(
  payment: BillingPaymentRecord,
  application: BillingApplication | null,
  refund: BillingRefundRecord | undefined,
): StatusMeta {
  if (refund) {
    if (refund.status === "refunded") {
      return {
        label: "Refunded",
        description: `${formatMoney(refund.amount_cents, refund.currency)} was marked refunded on ${formatDate(refund.updated_at ?? refund.created_at)}.`,
        tone: "emerald",
        icon: CheckCircle2,
      };
    }

    if (refund.status === "approved") {
      return {
        label: "Refund approved",
        description: "The refund has been approved. Provider settlement timing can still vary.",
        tone: "emerald",
        icon: CheckCircle2,
      };
    }

    if (refund.status === "rejected") {
      return {
        label: "Refund rejected",
        description: refund.reason ?? "The refund request was reviewed and not approved.",
        tone: "red",
        icon: XCircle,
      };
    }

    return {
      label: "Refund requested",
      description: "The VIZA team is reviewing this refund request.",
      tone: "blue",
      icon: Clock3,
    };
  }

  if (!isPaidPaymentStatus(payment.status)) {
    return {
      label: "Refund review unavailable",
      description: "Refund review starts after an agency-fee payment has settled.",
      tone: "slate",
      icon: HelpCircle,
    };
  }

  if (application?.submitted_at || application?.external_status || application?.result_status) {
    return {
      label: "Not normally eligible",
      description: "The application has already reached official submission or result tracking.",
      tone: "red",
      icon: ShieldCheck,
    };
  }

  if (application?.packet_status && application.packet_status !== "not_started") {
    return {
      label: "Staff review required",
      description: "Preparation has started, so support must review policy details before any refund decision.",
      tone: "amber",
      icon: AlertCircle,
    };
  }

  return {
    label: "Eligible for staff review",
    description: "This payment can be reviewed before official submission work begins. Refunds are not automatic.",
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

function getPackageLabel(application: BillingApplication | null, packageItem: BillingVisaPackage | null): string {
  if (packageItem?.name) return packageItem.name;

  const country = application?.country ?? packageItem?.country ?? "visa";
  const visaType = getFormVisaType(application?.visa_type ?? packageItem?.visa_type ?? "application");
  return `${getDestinationDisplayName(country)} ${getVisaTypeDisplayName(visaType)}`;
}

function getRouteLabel(application: BillingApplication | null, packageItem: BillingVisaPackage | null): string {
  const country = application?.country ?? packageItem?.country ?? "visa";
  const visaType = getFormVisaType(application?.visa_type ?? packageItem?.visa_type ?? "application");
  return `${getDestinationDisplayName(country)} · ${getVisaTypeDisplayName(visaType)}`;
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

function summarizePaidTotals(payments: BillingPaymentRecord[]): string {
  const totals = new Map<string, number>();
  for (const payment of payments.filter((item) => isPaidPaymentStatus(item.status))) {
    totals.set(payment.currency, (totals.get(payment.currency) ?? 0) + payment.amount_cents);
  }

  if (totals.size === 0) return "No paid records";
  return Array.from(totals.entries())
    .map(([currency, cents]) => formatMoney(cents, currency))
    .join(" / ");
}

function getGovernmentDisclosure(
  application: BillingApplication | null,
  packageItem: BillingVisaPackage | null,
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
  const label =
    readString(governmentFee, "label") ??
    (mode === "unknown" ? "Official fee is confirmed by the government portal." : "Government fee is not part of VIZA agency receipts.");

  return {
    amountCents,
    currency,
    mode,
    label,
  };
}

function formatGovernmentFee(disclosure: GovernmentDisclosure): string {
  if (disclosure.amountCents === null) return "Shown by official source";
  if (disclosure.amountCents === 0) return "Not collected by VIZA";
  return formatMoney(disclosure.amountCents, disclosure.currency);
}

function PaymentRecordCard({
  payment,
  application,
  invoice,
  refund,
  applicantEmail,
}: {
  payment: BillingPaymentRecord;
  application: BillingApplication | null;
  invoice: BillingInvoiceRequest | undefined;
  refund: BillingRefundRecord | undefined;
  applicantEmail: string | null;
}) {
  const paymentStatus = getPaymentStatus(payment.status);
  const invoiceStatus = getInvoiceStatus(invoice);
  const refundStatus = getRefundStatus(payment, application, refund);

  return (
    <article className="rounded-lg border bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill meta={paymentStatus} />
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
              Agency fee only
            </span>
          </div>
          <div>
            <p className="text-2xl font-semibold text-foreground">
              {formatMoney(payment.amount_cents, payment.currency)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Paid record created {formatDate(payment.created_at)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {payment.receipt_url ? (
            <Button asChild variant="outline" className="h-11 rounded-full">
              <Link href={payment.receipt_url} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4" />
                Download receipt
              </Link>
            </Button>
          ) : (
            <span className="inline-flex min-h-11 items-center rounded-full border border-dashed px-4 text-sm font-medium text-muted-foreground">
              Receipt pending
            </span>
          )}
          <Button asChild variant="outline" className="h-11 rounded-full">
            <Link href="/client/status">
              <ExternalLink className="h-4 w-4" />
              Case status
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-blue-900">Invoice</p>
            <StatusPill meta={invoiceStatus} />
          </div>
          <p className="mt-2 text-sm leading-6 text-blue-900/80">{invoiceStatus.description}</p>
          {invoice ? (
            <dl className="mt-3 grid gap-2 text-sm text-blue-950 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase text-blue-900/60">Requested for</dt>
                <dd className="mt-1 font-semibold">{invoice.invoice_name ?? "Billing name pending"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-blue-900/60">Requested on</dt>
                <dd className="mt-1 font-semibold">{formatDate(invoice.created_at)}</dd>
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
            <p className="text-sm font-semibold text-slate-900">Refund visibility</p>
            <StatusPill meta={refundStatus} />
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-700">{refundStatus.description}</p>
        </div>
      </div>
    </article>
  );
}

function EmptyPayments() {
  return (
    <div className="rounded-lg border border-dashed bg-white px-6 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-500">
        <ReceiptText className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-xl font-semibold text-foreground">No agency-fee payments yet</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
        Paid VIZA agency-fee records, receipt links, invoice requests, and refund status will appear here.
        Government portal fees stay separate from these receipt records.
      </p>
      <Button asChild className="mt-6 h-11 rounded-full">
        <Link href="/client/checkout">
          Go to checkout
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
      <div className="flex gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Billing data unavailable</p>
          <p className="mt-1">{message}</p>
        </div>
      </div>
    </div>
  );
}

export default async function ClientBillingPage() {
  const overview = await getBillingOverview();
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
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-500">Billing</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">
              Payments, receipts, invoices, and refund status
            </h1>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              Review VIZA agency-fee history, download hosted receipts, request B2B invoices, and see refund status.
              Government fee disclosures are shown separately because they are not VIZA agency-fee receipts.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="h-11 rounded-full">
              <Link href="/client/status">
                <ShieldCheck className="h-4 w-4" />
                View case status
              </Link>
            </Button>
            <Button asChild className="h-11 rounded-full">
              <Link href="/client/checkout">
                <WalletCards className="h-4 w-4" />
                Checkout
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {overview.error ? (
        <section className="mt-6">
          <ErrorBanner message={overview.error} />
        </section>
      ) : null}

      <section className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Paid agency fees", value: summarizePaidTotals(overview.payments), icon: WalletCards },
          { label: "Receipt links", value: `${receiptCount} available`, icon: ReceiptText },
          { label: "Invoice requests", value: `${overview.invoiceRequests.length} tracked`, icon: FileText },
          { label: "Refund records", value: `${overview.refundRecords.length} tracked`, icon: RefreshCcw },
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
                <h2 className="text-lg font-semibold">Agency fee still needs attention</h2>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-900/80">
                These applications do not have a settled VIZA agency-fee record yet. Checkout only covers VIZA agency fees;
                official government fees remain separate.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {unpaidApplications.map((application) => {
              const packageItem = application.visa_package_id ? packagesById.get(application.visa_package_id) ?? null : null;
              return (
                <div key={application.id} className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{getPackageLabel(application, packageItem)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{getRouteLabel(application, packageItem)}</p>
                  </div>
                  <Button asChild className="h-10 rounded-full">
                    <Link href={getCheckoutHref(application, packageItem)}>
                      Pay agency fee
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
            <h2 className="text-2xl font-semibold text-foreground">Payment history</h2>
            <p className="mt-1 text-sm text-muted-foreground">Agency-fee records are grouped by application or visa package.</p>
          </div>
        </div>

        <div className="mt-5 space-y-6">
          {paymentGroups.length === 0 ? (
            <EmptyPayments />
          ) : (
            paymentGroups.map((group) => (
              <section key={group.key} className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="text-3xl leading-none" aria-hidden="true">
                      {getApplicationFlag(group.application, group.packageItem)}
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-xl font-semibold text-foreground">{getPackageLabel(group.application, group.packageItem)}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{getRouteLabel(group.application, group.packageItem)}</p>
                    </div>
                  </div>
                  <Button asChild variant="outline" className="h-10 rounded-full">
                    <Link href="/client/status">
                      View progress
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
          <h2 className="text-2xl font-semibold text-foreground">Government fee disclosure</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            These amounts are displayed apart from agency-fee receipts. VIZA does not collect or process official portal fees here.
          </p>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {governmentDisclosureRows.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-white p-5 text-sm text-muted-foreground">
              Government fee information will appear after an application or visa package is selected.
            </div>
          ) : (
            governmentDisclosureRows.map((row) => {
              const disclosure = getGovernmentDisclosure(row.application, row.packageItem);
              return (
                <div key={row.key} className="rounded-lg border bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{getPackageLabel(row.application, row.packageItem)}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{getRouteLabel(row.application, row.packageItem)}</p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                      {normalizeStatus(disclosure.mode)}
                    </span>
                  </div>
                  <p className="mt-4 text-lg font-semibold text-foreground">{formatGovernmentFee(disclosure)}</p>
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

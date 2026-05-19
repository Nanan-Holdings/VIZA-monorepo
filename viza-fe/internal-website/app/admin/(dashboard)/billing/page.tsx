import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/rbac";
import { BillingSupportWorkspace } from "./billing-support-workspace";
import type {
  BillingReference,
  BillingStatusSummary,
  BillingSupportRecord,
  BillingTimelineEvent,
  InvoiceSummary,
  PaymentSummary,
  RefundEligibility,
  RefundSummary,
} from "./types";

export const dynamic = "force-dynamic";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type JsonRecord = Record<string, JsonValue>;

interface QueryError {
  message: string;
}

interface QueryResult<T> {
  data: T[] | null;
  error: QueryError | null;
}

interface BillingQueryBuilder<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): BillingQueryBuilder<T>;
  order(
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean }
  ): BillingQueryBuilder<T>;
  limit(count: number): BillingQueryBuilder<T>;
  in(column: string, values: readonly string[]): BillingQueryBuilder<T>;
}

interface BillingReadonlyClient {
  from(table: "payment_records"): BillingQueryBuilder<PaymentRecordRow>;
  from(table: "invoice_requests"): BillingQueryBuilder<InvoiceRequestRow>;
  from(table: "refund_records"): BillingQueryBuilder<RefundRecordRow>;
  from(table: "applications"): BillingQueryBuilder<ApplicationRow>;
  from(table: "applicant_profiles"): BillingQueryBuilder<ApplicantProfileRow>;
  from(table: "visa_packages"): BillingQueryBuilder<VisaPackageRow>;
}

interface PaymentRecordRow {
  id: string;
  application_id: string | null;
  applicant_id: string | null;
  visa_package_id: string | null;
  provider: string;
  provider_session_id: string | null;
  provider_payment_id: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  fee_type: string;
  receipt_url: string | null;
  metadata: JsonValue | null;
  created_at: string | null;
  updated_at: string | null;
}

interface InvoiceRequestRow {
  id: string;
  payment_record_id: string | null;
  application_id: string | null;
  applicant_id: string | null;
  invoice_name: string | null;
  tax_identifier: string | null;
  billing_email: string | null;
  status: string;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface RefundRecordRow {
  id: string;
  payment_record_id: string | null;
  application_id: string | null;
  applicant_id: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  reason: string | null;
  policy_snapshot: JsonValue | null;
  created_at: string | null;
  updated_at: string | null;
}

interface ApplicationRow {
  id: string;
  applicant_id: string;
  country: string;
  visa_type: string;
  status: string;
  submitted_at: string | null;
  visa_package_id: string | null;
  confirmation_number: string | null;
  packet_status: string | null;
  external_status: string | null;
  external_reference: string | null;
  result_status: string | null;
  government_fee_cents: number | null;
  government_fee_currency: string | null;
  government_fee_mode: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface ApplicantProfileRow {
  id: string;
  auth_user_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  nationality: string | null;
}

interface VisaPackageRow {
  id: string;
  country: string;
  visa_type: string;
  name: string;
  price_cents: number | null;
  currency: string | null;
  metadata: JsonValue | null;
}

const OPEN_REQUEST_STATUSES = new Set([
  "requested",
  "pending",
  "processing",
  "requires_review",
  "manual_review",
]);

const PAID_PAYMENT_STATUSES = new Set([
  "paid",
  "succeeded",
  "complete",
  "completed",
]);

const CLOSED_APPLICATION_STATUSES = new Set([
  "submitted",
  "processing",
  "in_review",
  "approved",
  "rejected",
  "completed",
]);

const SAFE_METADATA_LABELS: Record<string, string> = {
  checkout_mode: "Checkout mode",
  customer_email: "Customer email",
  customer_name: "Customer name",
  package_name: "Package",
  country: "Country",
  visa_type: "Visa type",
  government_fee_mode: "Government fee mode",
  government_fee_currency: "Government fee currency",
  invoice_requested_at: "Invoice requested at",
  refund_policy_version: "Refund policy version",
};

export default async function AdminBillingPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/admin/login");

  const adminClient = createAdminClient() as unknown as BillingReadonlyClient;

  const [paymentsResult, invoicesResult, refundsResult] = await Promise.all([
    adminClient
      .from("payment_records")
      .select(
        "id, application_id, applicant_id, visa_package_id, provider, provider_session_id, provider_payment_id, amount_cents, currency, status, fee_type, receipt_url, metadata, created_at, updated_at"
      )
      .order("created_at", { ascending: false })
      .limit(75),
    adminClient
      .from("invoice_requests")
      .select(
        "id, payment_record_id, application_id, applicant_id, invoice_name, tax_identifier, billing_email, status, notes, created_at, updated_at"
      )
      .order("created_at", { ascending: false })
      .limit(100),
    adminClient
      .from("refund_records")
      .select(
        "id, payment_record_id, application_id, applicant_id, amount_cents, currency, status, reason, policy_snapshot, created_at, updated_at"
      )
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const errors = collectErrors([
    ["payment_records", paymentsResult.error],
    ["invoice_requests", invoicesResult.error],
    ["refund_records", refundsResult.error],
  ]);

  const payments = paymentsResult.data ?? [];
  const invoices = invoicesResult.data ?? [];
  const refunds = refundsResult.data ?? [];

  const initialApplicationIds = uniqueStrings([
    ...payments.map((payment) => payment.application_id),
    ...invoices.map((invoice) => invoice.application_id),
    ...refunds.map((refund) => refund.application_id),
  ]);

  const initialApplicantIds = uniqueStrings([
    ...payments.map((payment) => payment.applicant_id),
    ...invoices.map((invoice) => invoice.applicant_id),
    ...refunds.map((refund) => refund.applicant_id),
  ]);

  const applicationResult =
    initialApplicationIds.length > 0
      ? await adminClient
          .from("applications")
          .select(
            "id, applicant_id, country, visa_type, status, submitted_at, visa_package_id, confirmation_number, packet_status, external_status, external_reference, result_status, government_fee_cents, government_fee_currency, government_fee_mode, created_at, updated_at"
          )
          .in("id", initialApplicationIds)
      : emptyResult<ApplicationRow>();

  errors.push(
    ...collectErrors([["applications", applicationResult.error]])
  );

  const applications = applicationResult.data ?? [];
  const applicantIds = uniqueStrings([
    ...initialApplicantIds,
    ...applications.map((application) => application.applicant_id),
  ]);

  const profileResult =
    applicantIds.length > 0
      ? await adminClient
          .from("applicant_profiles")
          .select("id, auth_user_id, full_name, email, phone, nationality")
          .in("id", applicantIds)
      : emptyResult<ApplicantProfileRow>();

  errors.push(
    ...collectErrors([["applicant_profiles", profileResult.error]])
  );

  const packageIds = uniqueStrings([
    ...payments.map((payment) => payment.visa_package_id),
    ...applications.map((application) => application.visa_package_id),
  ]);

  const packageResult =
    packageIds.length > 0
      ? await adminClient
          .from("visa_packages")
          .select("id, country, visa_type, name, price_cents, currency, metadata")
          .in("id", packageIds)
      : emptyResult<VisaPackageRow>();

  errors.push(...collectErrors([["visa_packages", packageResult.error]]));

  const records = buildBillingRecords({
    payments,
    invoices,
    refunds,
    applications: applications,
    profiles: profileResult.data ?? [],
    packages: packageResult.data ?? [],
  });

  const summary = buildSummary(records);

  return (
    <BillingSupportWorkspace
      records={records}
      summary={summary}
      generatedAt={new Date().toISOString()}
      errors={errors}
    />
  );
}

function buildBillingRecords({
  payments,
  invoices,
  refunds,
  applications,
  profiles,
  packages,
}: {
  payments: PaymentRecordRow[];
  invoices: InvoiceRequestRow[];
  refunds: RefundRecordRow[];
  applications: ApplicationRow[];
  profiles: ApplicantProfileRow[];
  packages: VisaPackageRow[];
}) {
  const applicationById = mapById(applications);
  const profileById = mapById(profiles);
  const packageById = mapById(packages);
  const includedInvoiceIds = new Set<string>();
  const includedRefundIds = new Set<string>();

  const records = payments.map((payment) => {
    const application = payment.application_id
      ? applicationById.get(payment.application_id) ?? null
      : null;
    const applicantId = payment.applicant_id ?? application?.applicant_id ?? null;
    const profile = applicantId ? profileById.get(applicantId) ?? null : null;
    const packageId = payment.visa_package_id ?? application?.visa_package_id ?? null;
    const visaPackage = packageId ? packageById.get(packageId) ?? null : null;

    const relatedInvoices = sortByCreatedDesc(
      invoices.filter((invoice) => {
        const matches =
          invoice.payment_record_id === payment.id ||
          (!invoice.payment_record_id &&
            invoice.application_id !== null &&
            invoice.application_id === payment.application_id);
        if (matches) includedInvoiceIds.add(invoice.id);
        return matches;
      })
    );

    const relatedRefunds = sortByCreatedDesc(
      refunds.filter((refund) => {
        const matches =
          refund.payment_record_id === payment.id ||
          (!refund.payment_record_id &&
            refund.application_id !== null &&
            refund.application_id === payment.application_id);
        if (matches) includedRefundIds.add(refund.id);
        return matches;
      })
    );

    return toBillingRecord({
      source: "payment",
      payment,
      invoices: relatedInvoices,
      refunds: relatedRefunds,
      application,
      profile,
      visaPackage,
    });
  });

  for (const invoice of invoices) {
    if (includedInvoiceIds.has(invoice.id)) continue;

    const application = invoice.application_id
      ? applicationById.get(invoice.application_id) ?? null
      : null;
    const applicantId = invoice.applicant_id ?? application?.applicant_id ?? null;
    const profile = applicantId ? profileById.get(applicantId) ?? null : null;
    const visaPackage = application?.visa_package_id
      ? packageById.get(application.visa_package_id) ?? null
      : null;

    records.push(
      toBillingRecord({
        source: "invoice_request",
        payment: null,
        invoices: [invoice],
        refunds: [],
        application,
        profile,
        visaPackage,
      })
    );
  }

  for (const refund of refunds) {
    if (includedRefundIds.has(refund.id)) continue;

    const application = refund.application_id
      ? applicationById.get(refund.application_id) ?? null
      : null;
    const applicantId = refund.applicant_id ?? application?.applicant_id ?? null;
    const profile = applicantId ? profileById.get(applicantId) ?? null : null;
    const visaPackage = application?.visa_package_id
      ? packageById.get(application.visa_package_id) ?? null
      : null;

    records.push(
      toBillingRecord({
        source: "refund_request",
        payment: null,
        invoices: [],
        refunds: [refund],
        application,
        profile,
        visaPackage,
      })
    );
  }

  return sortSupportRecords(records);
}

function toBillingRecord({
  source,
  payment,
  invoices,
  refunds,
  application,
  profile,
  visaPackage,
}: {
  source: BillingSupportRecord["source"];
  payment: PaymentRecordRow | null;
  invoices: InvoiceRequestRow[];
  refunds: RefundRecordRow[];
  application: ApplicationRow | null;
  profile: ApplicantProfileRow | null;
  visaPackage: VisaPackageRow | null;
}): BillingSupportRecord {
  const invoiceSummaries = invoices.map(toInvoiceSummary);
  const refundSummaries = refunds.map(toRefundSummary);
  const latestInvoice = invoiceSummaries[0] ?? null;
  const latestRefund = refundSummaries[0] ?? null;
  const paymentSummary = payment
    ? toPaymentSummary(payment, application, visaPackage)
    : null;
  const refundEligibility = computeRefundEligibility({
    payment,
    application,
    refunds,
  });

  return {
    id: payment?.id ?? latestInvoice?.id ?? latestRefund?.id ?? crypto.randomUUID(),
    source,
    payment: paymentSummary,
    invoiceStatus: latestInvoice?.status ?? "not_requested",
    refundStatus: latestRefund?.status ?? deriveRefundStatus(payment, refunds),
    latestInvoice,
    latestRefund,
    invoices: invoiceSummaries,
    refunds: refundSummaries,
    refundEligibility,
    applicant: toApplicantReference(profile),
    application: toApplicationReference(application),
    visaPackage: toPackageReference(visaPackage, application),
    governmentFeeMode: deriveGovernmentFeeMode(application, visaPackage),
    applicationStatus: application?.status ?? null,
    timeline: buildTimeline(payment, invoices, refunds),
  };
}

function toPaymentSummary(
  payment: PaymentRecordRow,
  application: ApplicationRow | null,
  visaPackage: VisaPackageRow | null
): PaymentSummary {
  return {
    id: payment.id,
    provider: payment.provider,
    providerSessionRef: shortRef(payment.provider_session_id),
    providerPaymentRef: shortRef(payment.provider_payment_id),
    amountLabel: formatCurrency(payment.amount_cents, payment.currency),
    amountCents: payment.amount_cents,
    currency: payment.currency,
    status: payment.status,
    feeType: payment.fee_type,
    receiptUrl: safeExternalUrl(payment.receipt_url),
    createdAt: payment.created_at,
    updatedAt: payment.updated_at,
    metadata: safeMetadata(payment.metadata, application, visaPackage),
  };
}

function toInvoiceSummary(invoice: InvoiceRequestRow): InvoiceSummary {
  return {
    id: invoice.id,
    invoiceName: invoice.invoice_name,
    billingEmail: invoice.billing_email,
    taxIdentifierMasked: maskIdentifier(invoice.tax_identifier),
    status: invoice.status,
    notes: invoice.notes,
    createdAt: invoice.created_at,
    updatedAt: invoice.updated_at,
  };
}

function toRefundSummary(refund: RefundRecordRow): RefundSummary {
  return {
    id: refund.id,
    amountLabel: formatCurrency(refund.amount_cents, refund.currency),
    amountCents: refund.amount_cents,
    currency: refund.currency,
    status: refund.status,
    reason: refund.reason,
    policySnapshot: safePolicySnapshot(refund.policy_snapshot),
    createdAt: refund.created_at,
    updatedAt: refund.updated_at,
  };
}

function computeRefundEligibility({
  payment,
  application,
  refunds,
}: {
  payment: PaymentRecordRow | null;
  application: ApplicationRow | null;
  refunds: RefundRecordRow[];
}): RefundEligibility {
  if (!payment) {
    return refundDecision(
      "not_eligible",
      "No payment",
      "A refund cannot be assessed until a payment record is linked.",
      0,
      "NO_PAYMENT",
      "USD"
    );
  }

  if (payment.fee_type !== "agency_fee") {
    return refundDecision(
      "not_eligible",
      "Excluded fee",
      "This record is not an agency-fee payment. Government fees are not handled from admin billing.",
      0,
      "NON_AGENCY_FEE",
      payment.currency
    );
  }

  if (!PAID_PAYMENT_STATUSES.has(payment.status.toLowerCase())) {
    return refundDecision(
      "not_eligible",
      "Payment not settled",
      "Only settled agency-fee payments can be evaluated for refund support.",
      0,
      "PAYMENT_NOT_SETTLED",
      payment.currency
    );
  }

  const refundedCents = refunds
    .filter((refund) =>
      ["succeeded", "paid", "refunded", "completed"].includes(
        refund.status.toLowerCase()
      )
    )
    .reduce((total, refund) => total + refund.amount_cents, 0);
  const remainingCents = Math.max(payment.amount_cents - refundedCents, 0);

  if (remainingCents <= 0) {
    return refundDecision(
      "not_eligible",
      "Fully refunded",
      "The paid agency fee has already been fully refunded.",
      0,
      "FULLY_REFUNDED",
      payment.currency
    );
  }

  const openRefund = refunds.find((refund) =>
    OPEN_REQUEST_STATUSES.has(refund.status.toLowerCase())
  );
  if (openRefund) {
    return refundDecision(
      "manual_review",
      "Request open",
      "A refund request is already open. Staff can review status, but no refund action is available here.",
      remainingCents,
      "OPEN_REFUND_REQUEST",
      payment.currency
    );
  }

  if (!application) {
    return refundDecision(
      "manual_review",
      "Review required",
      "The payment is not linked to an application, so eligibility needs staff review.",
      remainingCents,
      "UNLINKED_APPLICATION",
      payment.currency
    );
  }

  if (
    application.submitted_at ||
    application.external_status ||
    CLOSED_APPLICATION_STATUSES.has(application.status.toLowerCase())
  ) {
    return refundDecision(
      "manual_review",
      "Review required",
      "The application has progressed beyond draft support. Confirm policy and work already performed before any refund action.",
      remainingCents,
      "APPLICATION_IN_PROGRESS",
      payment.currency
    );
  }

  return refundDecision(
    "eligible",
    "Eligible",
    "The payment is a settled agency fee and the linked application has not been submitted.",
    remainingCents,
    "PAID_AGENCY_FEE_PRE_SUBMISSION",
    payment.currency
  );
}

function refundDecision(
  status: RefundEligibility["status"],
  label: string,
  reason: string,
  eligibleCents: number,
  ruleCode: string,
  currency: string
): RefundEligibility {
  return {
    status,
    label,
    reason,
    eligibleAmountLabel: formatCurrency(eligibleCents, currency),
    ruleCode,
  };
}

function toApplicantReference(
  profile: ApplicantProfileRow | null
): BillingReference | null {
  if (!profile) return null;

  return {
    id: profile.id,
    label: profile.full_name ?? profile.email ?? shortRef(profile.id) ?? profile.id,
    secondary: profile.email ?? profile.phone ?? shortRef(profile.id),
    href: `/admin/users/${profile.id}`,
  };
}

function toApplicationReference(
  application: ApplicationRow | null
): BillingReference | null {
  if (!application) return null;

  return {
    id: application.id,
    label: `${application.country} ${application.visa_type}`,
    secondary:
      application.confirmation_number ??
      application.external_reference ??
      shortRef(application.id),
    href: `/admin/applications/${application.id}`,
  };
}

function toPackageReference(
  visaPackage: VisaPackageRow | null,
  application: ApplicationRow | null
): BillingReference | null {
  if (visaPackage) {
    return {
      id: visaPackage.id,
      label: visaPackage.name,
      secondary: `${visaPackage.country} ${visaPackage.visa_type}`,
    };
  }

  if (!application) return null;

  return {
    id: application.visa_package_id ?? application.id,
    label: `${application.country} ${application.visa_type}`,
    secondary: "From application",
  };
}

function deriveGovernmentFeeMode(
  application: ApplicationRow | null,
  visaPackage: VisaPackageRow | null
) {
  if (application?.government_fee_mode) return application.government_fee_mode;

  const metadata = asRecord(visaPackage?.metadata ?? null);
  const governmentFee = asRecord(metadata?.government_fee ?? null);
  const mode = governmentFee?.mode ?? metadata?.government_fee_mode;

  return typeof mode === "string" ? mode : null;
}

function deriveRefundStatus(
  payment: PaymentRecordRow | null,
  refunds: RefundRecordRow[]
) {
  if (refunds.length > 0) return refunds[0].status;
  if (payment?.status.toLowerCase() === "refunded") return "refunded";
  return "none";
}

function buildTimeline(
  payment: PaymentRecordRow | null,
  invoices: InvoiceRequestRow[],
  refunds: RefundRecordRow[]
): BillingTimelineEvent[] {
  const events: BillingTimelineEvent[] = [];

  if (payment) {
    events.push({
      id: `${payment.id}-created`,
      label: "Payment record created",
      status: payment.status,
      happenedAt: payment.created_at,
    });
    events.push({
      id: `${payment.id}-updated`,
      label: "Payment status updated",
      status: payment.status,
      happenedAt: payment.updated_at,
    });
  }

  for (const invoice of invoices) {
    events.push({
      id: `${invoice.id}-invoice`,
      label: "Invoice request",
      status: invoice.status,
      happenedAt: invoice.created_at,
    });
  }

  for (const refund of refunds) {
    events.push({
      id: `${refund.id}-refund`,
      label: "Refund request",
      status: refund.status,
      happenedAt: refund.created_at,
    });
  }

  return sortTimeline(events);
}

function safeMetadata(
  metadata: JsonValue | null,
  application: ApplicationRow | null,
  visaPackage: VisaPackageRow | null
) {
  const source = asRecord(metadata);
  const items: Array<{ label: string; value: string }> = [];

  if (source) {
    for (const [key, label] of Object.entries(SAFE_METADATA_LABELS)) {
      const value = source[key];
      const displayValue = formatJsonScalar(value);
      if (displayValue) items.push({ label, value: displayValue });
    }
  }

  if (application?.government_fee_cents !== null && application?.government_fee_cents !== undefined) {
    items.push({
      label: "Government fee",
      value: formatCurrency(
        application.government_fee_cents,
        application.government_fee_currency ?? "USD"
      ),
    });
  }

  if (visaPackage?.price_cents !== null && visaPackage?.price_cents !== undefined) {
    items.push({
      label: "Package list price",
      value: formatCurrency(visaPackage.price_cents, visaPackage.currency ?? "USD"),
    });
  }

  return items;
}

function safePolicySnapshot(policySnapshot: JsonValue | null) {
  const source = asRecord(policySnapshot);
  if (!source) return [];

  return Object.entries(source)
    .filter(([key, value]) => {
      const lowerKey = key.toLowerCase();
      return (
        !lowerKey.includes("secret") &&
        !lowerKey.includes("token") &&
        !lowerKey.includes("card") &&
        formatJsonScalar(value) !== null
      );
    })
    .slice(0, 6)
    .map(([key, value]) => ({
      label: titleize(key),
      value: formatJsonScalar(value) ?? "Recorded",
    }));
}

function buildSummary(records: BillingSupportRecord[]): BillingStatusSummary {
  const paidRecords = records.filter(
    (record) =>
      record.payment &&
      PAID_PAYMENT_STATUSES.has(record.payment.status.toLowerCase())
  );
  const totalsByCurrency = new Map<string, number>();

  for (const record of paidRecords) {
    if (!record.payment) continue;

    const currency = record.payment.currency;
    totalsByCurrency.set(
      currency,
      (totalsByCurrency.get(currency) ?? 0) + record.payment.amountCents
    );
  }

  const collectedCents = [...totalsByCurrency.values()].reduce(
    (total, cents) => total + cents,
    0
  );
  const collectedCurrency =
    [...totalsByCurrency.entries()]
      .map(([currency, cents]) => formatCurrency(cents, currency))
      .join(" / ") || formatCurrency(0, "USD");

  return {
    totalRecords: records.length,
    paidCount: paidRecords.length,
    openInvoiceRequests: records.filter((record) =>
      OPEN_REQUEST_STATUSES.has(record.invoiceStatus.toLowerCase())
    ).length,
    openRefundRequests: records.filter((record) =>
      OPEN_REQUEST_STATUSES.has(record.refundStatus.toLowerCase())
    ).length,
    collectedCents,
    collectedCurrency,
  };
}

function collectErrors(entries: Array<[string, QueryError | null]>) {
  return entries.flatMap(([label, error]) =>
    error ? [`${label}: ${error.message}`] : []
  );
}

function emptyResult<T>(): QueryResult<T> {
  return { data: [], error: null };
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function mapById<T extends { id: string }>(rows: T[]) {
  return new Map(rows.map((row) => [row.id, row] as const));
}

function sortByCreatedDesc<T extends { created_at: string | null }>(rows: T[]) {
  return [...rows].sort(
    (a, b) => dateValue(b.created_at) - dateValue(a.created_at)
  );
}

function sortSupportRecords(records: BillingSupportRecord[]) {
  return [...records].sort((a, b) => {
    const aDate =
      a.payment?.createdAt ??
      a.latestInvoice?.createdAt ??
      a.latestRefund?.createdAt ??
      null;
    const bDate =
      b.payment?.createdAt ??
      b.latestInvoice?.createdAt ??
      b.latestRefund?.createdAt ??
      null;

    return dateValue(bDate) - dateValue(aDate);
  });
}

function sortTimeline(events: BillingTimelineEvent[]) {
  return [...events]
    .filter((event) => event.happenedAt)
    .sort((a, b) => dateValue(b.happenedAt) - dateValue(a.happenedAt));
}

function dateValue(value: string | null) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatCurrency(cents: number, currency: string) {
  const normalizedCurrency = currency.toUpperCase();

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: normalizedCurrency,
    }).format(cents / 100);
  } catch {
    return `${normalizedCurrency} ${(cents / 100).toFixed(2)}`;
  }
}

function maskIdentifier(value: string | null) {
  if (!value) return null;
  const cleanValue = value.trim();
  if (cleanValue.length <= 4) return "****";

  return `${cleanValue.slice(0, 2)}***${cleanValue.slice(-4)}`;
}

function shortRef(value: string | null) {
  if (!value) return null;
  const cleanValue = value.trim();
  if (/^\d{12,}$/.test(cleanValue)) return `****${cleanValue.slice(-4)}`;
  if (cleanValue.length <= 16) return cleanValue;

  return `${cleanValue.slice(0, 6)}...${cleanValue.slice(-6)}`;
}

function safeExternalUrl(value: string | null) {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") return value;
    return null;
  } catch {
    return null;
  }
}

function asRecord(value: JsonValue | null): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value;
}

function formatJsonScalar(value: JsonValue | undefined) {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return shortRef(value) ?? value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

function titleize(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

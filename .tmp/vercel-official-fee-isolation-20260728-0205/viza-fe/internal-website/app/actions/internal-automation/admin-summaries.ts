"use server";

import {
  APPLICATION_AUTOMATION_SELECT,
  getAdminAutomationContext,
  type ApplicationAutomationRow,
  type DocumentRequirementRow,
  type InvoiceRequestRow,
  type PaymentRecordRow,
  type RefundRecordRow,
  type VisaPackageRow,
} from "./db";
import {
  buildCoverageSummary,
  buildCustomerStatusSummary,
  buildLifecycleSummary,
  readApplicantNotifications,
  readApplicationAutomationBundles,
  readDataRightsRequests,
  summarizeInvoiceRequest,
  summarizeRefundRequest,
} from "./read-model";
import {
  actionErrorMessage,
  actionFail,
  actionOk,
  type AdminApplicationSummary,
  type AdminBillingSummary,
  type AdminPackageCoverageSummary,
  type AutomationActionResult,
  type CustomerStatusSummary,
} from "./types";

const PAID_PAYMENT_STATUSES = ["paid", "succeeded", "success", "complete", "completed"];
const OPEN_REQUEST_STATUSES = ["requested", "pending", "processing", "approved", "queued"];

function clampLimit(value: number | undefined, fallback: number, max: number): number {
  if (!value || !Number.isInteger(value) || value <= 0) return fallback;
  return Math.min(value, max);
}

function incrementCount(counts: Record<string, number>, status: string): void {
  counts[status] = (counts[status] ?? 0) + 1;
}

function getCurrency(records: PaymentRecordRow[], refunds: RefundRecordRow[]): string {
  return records[0]?.currency ?? refunds[0]?.currency ?? "USD";
}

export async function getAdminApplicationSummaries(input: {
  applicantId?: string;
  status?: string;
  limit?: number;
} = {}): Promise<AutomationActionResult<AdminApplicationSummary[]>> {
  try {
    const contextResult = await getAdminAutomationContext();
    if (!contextResult.ok) return contextResult;

    let query = contextResult.data.adminClient
      .from<ApplicationAutomationRow>("applications")
      .select(APPLICATION_AUTOMATION_SELECT)
      .order("updated_at", { ascending: false })
      .limit(clampLimit(input.limit, 50, 200));

    if (input.applicantId?.trim()) {
      query = query.eq("applicant_id", input.applicantId.trim());
    }
    if (input.status?.trim()) {
      query = query.eq("status", input.status.trim());
    }

    const { data: applications, error } = await query;
    if (error) {
      return actionFail("DB_ERROR", "Could not load application summaries.");
    }

    const bundlesResult = await readApplicationAutomationBundles(
      contextResult.data.adminClient,
      applications ?? [],
    );
    if (!bundlesResult.ok) return bundlesResult;

    return actionOk(
      bundlesResult.data.map((bundle) => {
        const lifecycle = buildLifecycleSummary(bundle);
        return {
          applicationId: lifecycle.applicationId,
          applicantId: lifecycle.applicantId,
          country: lifecycle.country,
          visaType: lifecycle.visaType,
          status: lifecycle.applicationStatus,
          paymentStatus: lifecycle.payment.status,
          documentStatus: lifecycle.documents.status,
          consentStatus: lifecycle.consent.status,
          packetStatus: lifecycle.packet.status,
          externalStatus: lifecycle.packet.externalStatus,
          resultStatus: lifecycle.packet.resultStatus,
          updatedAt: lifecycle.updatedAt,
        };
      }),
    );
  } catch (error) {
    console.error(
      "[getAdminApplicationSummaries]",
      actionErrorMessage(error, "Unexpected admin application summary error"),
    );
    return actionFail("UNKNOWN_ERROR", "Could not load application summaries.");
  }
}

export async function getAdminCustomerStatusSummary(input: {
  applicantId?: string;
  applicationId?: string;
  limit?: number;
}): Promise<AutomationActionResult<CustomerStatusSummary>> {
  try {
    const contextResult = await getAdminAutomationContext();
    if (!contextResult.ok) return contextResult;

    if (!input.applicantId?.trim() && !input.applicationId?.trim()) {
      return actionFail(
        "VALIDATION_ERROR",
        "applicantId or applicationId is required.",
      );
    }

    let query = contextResult.data.adminClient
      .from<ApplicationAutomationRow>("applications")
      .select(APPLICATION_AUTOMATION_SELECT)
      .order("updated_at", { ascending: false })
      .limit(clampLimit(input.limit, 25, 100));

    if (input.applicationId?.trim()) {
      query = query.eq("id", input.applicationId.trim());
    } else if (input.applicantId?.trim()) {
      query = query.eq("applicant_id", input.applicantId.trim());
    }

    const { data: applications, error } = await query;
    if (error) {
      return actionFail("DB_ERROR", "Could not load customer applications.");
    }

    const applicationRows = applications ?? [];
    const applicantId = input.applicantId?.trim() ?? applicationRows[0]?.applicant_id;
    if (!applicantId) {
      return actionFail("NOT_FOUND", "Customer applications were not found.");
    }

    const [bundlesResult, notificationsResult, dataRightsResult] = await Promise.all([
      readApplicationAutomationBundles(contextResult.data.adminClient, applicationRows),
      readApplicantNotifications(contextResult.data.adminClient, applicantId),
      readDataRightsRequests(contextResult.data.adminClient, applicantId),
    ]);

    if (!bundlesResult.ok) return bundlesResult;
    if (!notificationsResult.ok) return notificationsResult;
    if (!dataRightsResult.ok) return dataRightsResult;

    return actionOk(
      buildCustomerStatusSummary({
        applicantId,
        bundles: bundlesResult.data,
        notifications: notificationsResult.data,
        dataRightsRequests: dataRightsResult.data,
      }),
    );
  } catch (error) {
    console.error(
      "[getAdminCustomerStatusSummary]",
      actionErrorMessage(error, "Unexpected admin customer status error"),
    );
    return actionFail("UNKNOWN_ERROR", "Could not load customer status.");
  }
}

export async function getAdminBillingSummary(input: {
  limit?: number;
} = {}): Promise<AutomationActionResult<AdminBillingSummary>> {
  try {
    const contextResult = await getAdminAutomationContext();
    if (!contextResult.ok) return contextResult;

    const limit = clampLimit(input.limit, 100, 500);
    const [paymentsResult, invoicesResult, refundsResult] = await Promise.all([
      contextResult.data.adminClient
        .from<PaymentRecordRow>("payment_records")
        .select(
          "id, application_id, applicant_id, visa_package_id, provider, provider_session_id, provider_payment_id, amount_cents, currency, status, fee_type, receipt_url, metadata, created_at, updated_at",
        )
        .order("created_at", { ascending: false })
        .limit(limit),
      contextResult.data.adminClient
        .from<InvoiceRequestRow>("invoice_requests")
        .select(
          "id, payment_record_id, application_id, applicant_id, invoice_name, tax_identifier, billing_email, status, notes, created_at, updated_at",
        )
        .order("created_at", { ascending: false })
        .limit(limit),
      contextResult.data.adminClient
        .from<RefundRecordRow>("refund_records")
        .select(
          "id, payment_record_id, application_id, applicant_id, amount_cents, currency, status, reason, policy_snapshot, created_at, updated_at",
        )
        .order("created_at", { ascending: false })
        .limit(limit),
    ]);

    if (paymentsResult.error || invoicesResult.error || refundsResult.error) {
      return actionFail("DB_ERROR", "Could not load billing summary.");
    }

    const payments = paymentsResult.data ?? [];
    const invoices = invoicesResult.data ?? [];
    const refunds = refundsResult.data ?? [];
    const paymentCounts: Record<string, number> = {};
    const invoiceCounts: Record<string, number> = {};
    const refundCounts: Record<string, number> = {};

    for (const payment of payments) incrementCount(paymentCounts, payment.status);
    for (const invoice of invoices) incrementCount(invoiceCounts, invoice.status);
    for (const refund of refunds) incrementCount(refundCounts, refund.status);

    const totalPaidCents = payments
      .filter((payment) => PAID_PAYMENT_STATUSES.includes(payment.status))
      .reduce((sum, payment) => sum + payment.amount_cents, 0);

    return actionOk({
      generatedAt: new Date().toISOString(),
      paymentCounts,
      invoiceCounts,
      refundCounts,
      totalPaid: {
        amountCents: totalPaidCents,
        currency: getCurrency(payments, refunds),
      },
      openInvoiceRequests: invoices
        .filter((invoice) => OPEN_REQUEST_STATUSES.includes(invoice.status))
        .map(summarizeInvoiceRequest),
      openRefundRequests: refunds
        .filter((refund) => OPEN_REQUEST_STATUSES.includes(refund.status))
        .map(summarizeRefundRequest),
    });
  } catch (error) {
    console.error(
      "[getAdminBillingSummary]",
      actionErrorMessage(error, "Unexpected admin billing summary error"),
    );
    return actionFail("UNKNOWN_ERROR", "Could not load billing summary.");
  }
}

export async function getAdminPackageCoverageSummary(input: {
  activeOnly?: boolean;
  limit?: number;
} = {}): Promise<AutomationActionResult<AdminPackageCoverageSummary>> {
  try {
    const contextResult = await getAdminAutomationContext();
    if (!contextResult.ok) return contextResult;

    let packageQuery = contextResult.data.adminClient
      .from<VisaPackageRow>("visa_packages")
      .select(
        "id, country, visa_type, name, description, price_cents, currency, is_active, metadata, created_at, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(clampLimit(input.limit, 100, 500));

    if (input.activeOnly ?? true) {
      packageQuery = packageQuery.eq("is_active", true);
    }

    const { data: packages, error: packageError } = await packageQuery;
    if (packageError) {
      return actionFail("DB_ERROR", "Could not load package coverage.");
    }

    const packageRows = packages ?? [];
    const packageIds = packageRows.map((visaPackage) => visaPackage.id);
    const countries = [...new Set(packageRows.map((visaPackage) => visaPackage.country))];
    const visaTypes = [...new Set(packageRows.map((visaPackage) => visaPackage.visa_type))];

    const [packageRequirementsResult, genericRequirementsResult] = await Promise.all([
      packageIds.length > 0
        ? contextResult.data.adminClient
            .from<DocumentRequirementRow>("document_requirements")
            .select(
              "id, visa_package_id, country, visa_type, requirement_key, label_en, label_zh, description, required, sort_order, metadata, created_at, updated_at",
            )
            .in("visa_package_id", packageIds)
        : Promise.resolve({ data: [], error: null }),
      countries.length > 0 && visaTypes.length > 0
        ? contextResult.data.adminClient
            .from<DocumentRequirementRow>("document_requirements")
            .select(
              "id, visa_package_id, country, visa_type, requirement_key, label_en, label_zh, description, required, sort_order, metadata, created_at, updated_at",
            )
            .in("country", countries)
            .in("visa_type", visaTypes)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (packageRequirementsResult.error || genericRequirementsResult.error) {
      return actionFail("DB_ERROR", "Could not load package requirements.");
    }

    const allRequirements = [
      ...(packageRequirementsResult.data ?? []),
      ...(genericRequirementsResult.data ?? []),
    ];

    return actionOk({
      generatedAt: new Date().toISOString(),
      packages: packageRows.map((visaPackage) => {
        const packageRequirements = allRequirements.filter(
          (requirement) => requirement.visa_package_id === visaPackage.id,
        );
        const requirements =
          packageRequirements.length > 0
            ? packageRequirements
            : allRequirements.filter(
                (requirement) =>
                  !requirement.visa_package_id &&
                  requirement.country === visaPackage.country &&
                  requirement.visa_type === visaPackage.visa_type,
              );

        return buildCoverageSummary({
          visaPackage,
          country: visaPackage.country,
          visaType: visaPackage.visa_type,
          requirements: requirements.sort((a, b) => a.sort_order - b.sort_order),
        });
      }),
    });
  } catch (error) {
    console.error(
      "[getAdminPackageCoverageSummary]",
      actionErrorMessage(error, "Unexpected package coverage summary error"),
    );
    return actionFail("UNKNOWN_ERROR", "Could not load package coverage summary.");
  }
}

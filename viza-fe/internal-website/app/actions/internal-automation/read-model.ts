import "server-only";

import {
  actionFail,
  actionOk,
  type AutomationActionResult,
  type AutomationCoverageSummary,
  type AutomationJson,
  type ConsentEventSummary,
  type ConsentStateSummary,
  type CustomerStatusSummary,
  type DataRightsRequestSummary,
  type DocumentReadinessItem,
  type DocumentReadinessSummary,
  type DocumentRequirementSummary,
  type InvoiceRequestSummary,
  type LifecycleSummary,
  type NotificationEventSummary,
  type PacketStateSummary,
  type PaymentRecordSummary,
  type PaymentStateSummary,
  type RefundRequestSummary,
  type SignatureSummary,
} from "./types";
import {
  type ApplicationAutomationRow,
  type ApplicationDocumentRow,
  type ApplicationPacketRow,
  type ConsentEventRow,
  type DataPrivacyRequestRow,
  type DocumentRequirementRow,
  type InternalSupabaseClient,
  type InvoiceRequestRow,
  type NotificationEventRow,
  type PaymentRecordRow,
  type RefundRecordRow,
  type SupabaseErrorLike,
  type VisaPackageRow,
  type ApplicationSignatureRow,
} from "./db";

const REQUIRED_CONSENT_TYPES = [
  "terms_of_service",
  "privacy_policy",
  "data_processing",
];
const REQUIRED_SIGNATURE_TYPE = "agency_authorisation";

const PAID_PAYMENT_STATUSES = new Set([
  "paid",
  "succeeded",
  "success",
  "complete",
  "completed",
]);
const PENDING_PAYMENT_STATUSES = new Set([
  "pending",
  "processing",
  "requires_action",
  "requires_payment_method",
]);
const FAILED_PAYMENT_STATUSES = new Set([
  "failed",
  "canceled",
  "cancelled",
  "expired",
]);
const COMPLETED_REFUND_STATUSES = new Set([
  "refunded",
  "succeeded",
  "success",
  "processed",
  "complete",
  "completed",
]);
const OPEN_REQUEST_STATUSES = new Set([
  "requested",
  "pending",
  "processing",
  "approved",
  "queued",
]);

export interface ApplicationAutomationBundle {
  application: ApplicationAutomationRow;
  documents: ApplicationDocumentRow[];
  requirements: DocumentRequirementRow[];
  paymentRecords: PaymentRecordRow[];
  invoiceRequests: InvoiceRequestRow[];
  refundRecords: RefundRecordRow[];
  consentEvents: ConsentEventRow[];
  signatures: ApplicationSignatureRow[];
  packets: ApplicationPacketRow[];
  notifications: NotificationEventRow[];
  visaPackage: VisaPackageRow | null;
}

function getAutomationRecord(
  value: AutomationJson | undefined,
): { [key: string]: AutomationJson | undefined } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value;
}

function getBoolean(
  record: { [key: string]: AutomationJson | undefined } | null,
  key: string,
  fallback: boolean,
): boolean {
  const value = record?.[key];
  return typeof value === "boolean" ? value : fallback;
}

function getString(
  record: { [key: string]: AutomationJson | undefined } | null,
  key: string,
): string | null {
  const value = record?.[key];
  return typeof value === "string" ? value : null;
}

function getNumber(
  record: { [key: string]: AutomationJson | undefined } | null,
  key: string,
): number | null {
  const value = record?.[key];
  return typeof value === "number" ? value : null;
}

function groupByApplication<T extends { application_id: string | null }>(
  rows: T[],
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    if (!row.application_id) continue;
    const current = grouped.get(row.application_id) ?? [];
    current.push(row);
    grouped.set(row.application_id, current);
  }
  return grouped;
}

function groupPackages(rows: VisaPackageRow[]): Map<string, VisaPackageRow> {
  const grouped = new Map<string, VisaPackageRow>();
  for (const row of rows) {
    grouped.set(row.id, row);
  }
  return grouped;
}

function newestTime(row: { updated_at?: string | null; created_at?: string | null }): number {
  return new Date(row.updated_at ?? row.created_at ?? 0).getTime();
}

function sortNewestFirst<T extends { updated_at?: string | null; created_at?: string | null }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => newestTime(b) - newestTime(a));
}

function firstError(
  responses: { error: SupabaseErrorLike | null }[],
): SupabaseErrorLike | null {
  return responses.find((response) => response.error)?.error ?? null;
}

function summarizeRequirement(row: DocumentRequirementRow): DocumentRequirementSummary {
  return {
    id: row.id,
    requirementKey: row.requirement_key,
    labelEn: row.label_en,
    labelZh: row.label_zh,
    description: row.description,
    required: row.required,
    sortOrder: row.sort_order,
  };
}

function summarizeDocumentOnlyRequirement(
  document: ApplicationDocumentRow,
): DocumentRequirementSummary {
  const key = document.requirement_key ?? document.document_type;
  return {
    id: null,
    requirementKey: key,
    labelEn: key.replace(/_/g, " "),
    labelZh: key.replace(/_/g, " "),
    description: null,
    required: document.required ?? true,
    sortOrder: 0,
  };
}

export function summarizePaymentRecord(row: PaymentRecordRow): PaymentRecordSummary {
  return {
    id: row.id,
    provider: row.provider,
    amountCents: row.amount_cents,
    currency: row.currency,
    status: row.status,
    feeType: row.fee_type,
    receiptUrl: row.receipt_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function summarizeInvoiceRequest(row: InvoiceRequestRow): InvoiceRequestSummary {
  return {
    id: row.id,
    paymentRecordId: row.payment_record_id,
    applicationId: row.application_id,
    status: row.status,
    billingEmail: row.billing_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function summarizeRefundRequest(row: RefundRecordRow): RefundRequestSummary {
  return {
    id: row.id,
    paymentRecordId: row.payment_record_id,
    applicationId: row.application_id,
    amountCents: row.amount_cents,
    currency: row.currency,
    status: row.status,
    reason: row.reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function latestConsentByType(rows: ConsentEventRow[]): ConsentEventRow[] {
  const latest = new Map<string, ConsentEventRow>();
  for (const row of sortNewestFirst(rows)) {
    if (!latest.has(row.consent_type)) {
      latest.set(row.consent_type, row);
    }
  }
  return [...latest.values()];
}

function summarizeConsent(row: ConsentEventRow): ConsentEventSummary {
  return {
    id: row.id,
    consentType: row.consent_type,
    version: row.version,
    accepted: row.accepted,
    createdAt: row.created_at,
  };
}

function summarizeSignature(row: ApplicationSignatureRow): SignatureSummary {
  return {
    id: row.id,
    signatureType: row.signature_type,
    signerName: row.signer_name,
    signedAt: row.signed_at ?? row.created_at,
  };
}

export function summarizeNotificationEvent(
  row: NotificationEventRow,
): NotificationEventSummary {
  const payloadRecord = getAutomationRecord(row.payload ?? undefined);

  return {
    id: row.id,
    applicationId: row.application_id,
    channel: row.channel,
    templateKey: row.template_key,
    recipient: row.recipient,
    status: row.status,
    sentAt: row.sent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    payloadKeys: payloadRecord ? Object.keys(payloadRecord).sort() : [],
  };
}

export function summarizeDataRightsRequest(
  row: DataPrivacyRequestRow,
): DataRightsRequestSummary {
  return {
    id: row.id,
    applicantId: row.applicant_id,
    requestType: row.request_type,
    status: row.status,
    notes: row.notes,
    fulfilledAt: row.fulfilled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getRequirementRowsForApplication(
  application: ApplicationAutomationRow,
  requirements: DocumentRequirementRow[],
): DocumentRequirementRow[] {
  const packageRequirements = application.visa_package_id
    ? requirements.filter(
        (requirement) => requirement.visa_package_id === application.visa_package_id,
      )
    : [];

  if (packageRequirements.length > 0) {
    return packageRequirements.sort((a, b) => a.sort_order - b.sort_order);
  }

  return requirements
    .filter(
      (requirement) =>
        !requirement.visa_package_id &&
        requirement.country === application.country &&
        requirement.visa_type === application.visa_type,
    )
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function buildCoverageSummary(
  params: {
    visaPackage: VisaPackageRow | null;
    application?: ApplicationAutomationRow;
    requirements: DocumentRequirementRow[];
    country: string;
    visaType: string;
  },
): AutomationCoverageSummary {
  const metadata = params.visaPackage?.metadata ?? null;
  const metadataRecord = getAutomationRecord(metadata ?? undefined);
  const coverageRecord = getAutomationRecord(metadataRecord?.coverage);
  const feeRecord = getAutomationRecord(metadataRecord?.government_fee);
  const app = params.application;

  return {
    visaPackageId: params.visaPackage?.id ?? app?.visa_package_id ?? null,
    country: params.country,
    visaType: params.visaType,
    coverage: {
      schema: getBoolean(coverageRecord, "schema", false),
      documents: getBoolean(coverageRecord, "documents", false),
      payment: getBoolean(coverageRecord, "payment", false),
      packet: getBoolean(coverageRecord, "packet", false),
      externalSubmission: getBoolean(coverageRecord, "external_submission", false),
      resultDelivery: getBoolean(coverageRecord, "result_delivery", false),
    },
    governmentFee: {
      mode:
        getString(feeRecord, "mode") ??
        app?.government_fee_mode ??
        "display_only",
      amountCents: getNumber(feeRecord, "amount_cents") ?? app?.government_fee_cents ?? null,
      currency:
        getString(feeRecord, "currency") ??
        app?.government_fee_currency ??
        params.visaPackage?.currency ??
        "USD",
      label: getString(feeRecord, "label"),
    },
    requirements: params.requirements.map(summarizeRequirement),
    metadata,
  };
}

export function buildDocumentReadinessSummary(
  application: ApplicationAutomationRow,
  documents: ApplicationDocumentRow[],
  requirements: DocumentRequirementRow[],
): DocumentReadinessSummary {
  const effectiveRequirements =
    requirements.length > 0
      ? requirements.map(summarizeRequirement)
      : documents.map(summarizeDocumentOnlyRequirement);

  const items: DocumentReadinessItem[] = effectiveRequirements.map((requirement) => {
    const document = documents.find(
      (candidate) =>
        candidate.requirement_key === requirement.requirementKey ||
        candidate.document_type === requirement.requirementKey,
    );
    const status = document?.status ?? "missing";
    const uploaded = Boolean(document?.storage_path || document?.filename) && status !== "missing";
    const reviewed = Boolean(document?.reviewed_at) || status === "validated" || status === "rejected";
    const blocking = requirement.required && (status === "missing" || status === "rejected");

    return {
      requirementKey: requirement.requirementKey,
      documentType: document?.document_type ?? requirement.requirementKey,
      labelEn: requirement.labelEn,
      labelZh: requirement.labelZh,
      required: requirement.required,
      status,
      uploaded,
      reviewed,
      blocking,
      reviewNotes: document?.review_notes ?? document?.rejection_reason ?? null,
      updatedAt: document?.updated_at ?? document?.created_at ?? null,
    };
  });

  const orphanDocuments = documents
    .filter(
      (document) =>
        !items.some(
          (item) =>
            item.requirementKey === document.requirement_key ||
            item.requirementKey === document.document_type,
        ),
    )
    .map<DocumentReadinessItem>((document) => ({
      requirementKey: document.requirement_key ?? document.document_type,
      documentType: document.document_type,
      labelEn: document.document_type.replace(/_/g, " "),
      labelZh: document.document_type.replace(/_/g, " "),
      required: document.required ?? false,
      status: document.status,
      uploaded: Boolean(document.storage_path || document.filename) && document.status !== "missing",
      reviewed:
        Boolean(document.reviewed_at) ||
        document.status === "validated" ||
        document.status === "rejected",
      blocking: Boolean(document.required) && document.status === "rejected",
      reviewNotes: document.review_notes ?? document.rejection_reason,
      updatedAt: document.updated_at ?? document.created_at,
    }));

  const allItems = [...items, ...orphanDocuments];
  const requiredItems = allItems.filter((item) => item.required);
  const uploadedRequired = requiredItems.filter((item) => item.uploaded).length;
  const validatedRequired = requiredItems.filter((item) => item.status === "validated").length;
  const missingRequired = requiredItems.filter((item) => item.status === "missing").length;
  const rejectedRequired = requiredItems.filter((item) => item.status === "rejected").length;
  const needsReview = requiredItems.some(
    (item) => item.uploaded && !item.reviewed && item.status !== "validated",
  );

  let status: DocumentReadinessSummary["status"] = "ready";
  if (effectiveRequirements.length === 0) status = "coverage_gap";
  else if (rejectedRequired > 0) status = "blocked";
  else if (missingRequired > 0) status = "needs_upload";
  else if (needsReview) status = "needs_review";

  return {
    applicationId: application.id,
    status,
    totalRequired: requiredItems.length,
    uploadedRequired,
    validatedRequired,
    missingRequired,
    rejectedRequired,
    items: allItems,
  };
}

export function buildPaymentStateSummary(
  application: ApplicationAutomationRow | null,
  paymentRecords: PaymentRecordRow[],
  invoiceRequests: InvoiceRequestRow[],
  refundRecords: RefundRecordRow[],
): PaymentStateSummary {
  const records = sortNewestFirst(paymentRecords);
  const invoices = sortNewestFirst(invoiceRequests);
  const refunds = sortNewestFirst(refundRecords);
  const currency =
    records[0]?.currency ??
    refunds[0]?.currency ??
    application?.government_fee_currency ??
    "USD";
  const paidCents = records
    .filter((record) => PAID_PAYMENT_STATUSES.has(record.status))
    .reduce((sum, record) => sum + record.amount_cents, 0);
  const refundedCents = refunds
    .filter((record) => COMPLETED_REFUND_STATUSES.has(record.status))
    .reduce((sum, record) => sum + record.amount_cents, 0);
  const hasOpenRefund = refunds.some((record) => OPEN_REQUEST_STATUSES.has(record.status));
  const latestReceiptUrl = records.find((record) => record.receipt_url)?.receipt_url ?? null;

  let status: PaymentStateSummary["status"] = "unpaid";
  if (paidCents > 0 && refundedCents >= paidCents) status = "refunded";
  else if (paidCents > 0 && refundedCents > 0) status = "partially_refunded";
  else if (paidCents > 0) status = "paid";
  else if (records.some((record) => PENDING_PAYMENT_STATUSES.has(record.status))) status = "pending";
  else if (records.length > 0 && records.every((record) => FAILED_PAYMENT_STATUSES.has(record.status))) {
    status = "failed";
  }

  const maxRefundable = Math.max(0, paidCents - refundedCents);
  const canRequest = maxRefundable > 0 && !hasOpenRefund;
  let reason = "A paid balance is available for review.";
  if (maxRefundable === 0) reason = "No paid refundable balance is available.";
  else if (hasOpenRefund) reason = "A refund request is already open.";

  return {
    applicationId: application?.id ?? null,
    status,
    totalPaid: { amountCents: paidCents, currency },
    totalRefunded: { amountCents: refundedCents, currency },
    latestReceiptUrl,
    records: records.map(summarizePaymentRecord),
    invoiceRequests: invoices.map(summarizeInvoiceRequest),
    refundRequests: refunds.map(summarizeRefundRequest),
    refundEligibility: {
      canRequest,
      maxAmountCents: maxRefundable,
      currency,
      reason,
    },
  };
}

export function buildConsentStateSummary(
  application: ApplicationAutomationRow,
  consentEvents: ConsentEventRow[],
  signatures: ApplicationSignatureRow[],
): ConsentStateSummary {
  const latestConsents = latestConsentByType(consentEvents);
  const acceptedConsentTypes = latestConsents
    .filter((event) => event.accepted)
    .map((event) => event.consent_type);
  const hasRequiredConsents = REQUIRED_CONSENT_TYPES.every((consentType) =>
    acceptedConsentTypes.includes(consentType),
  );
  const visibleSignatures = sortNewestFirst(signatures).map(summarizeSignature);
  const hasAgencySignature = visibleSignatures.some(
    (signature) => signature.signatureType === REQUIRED_SIGNATURE_TYPE,
  );

  let status: ConsentStateSummary["status"] = "complete";
  if (!hasRequiredConsents) status = "needs_consent";
  else if (!hasAgencySignature) status = "needs_signature";

  return {
    applicationId: application.id,
    status,
    requiredConsentTypes: REQUIRED_CONSENT_TYPES,
    acceptedConsentTypes,
    latestConsents: latestConsents.map(summarizeConsent),
    signatures: visibleSignatures,
  };
}

export function buildPacketStateSummary(
  application: ApplicationAutomationRow,
  packets: ApplicationPacketRow[],
): PacketStateSummary {
  const latestPacket = sortNewestFirst(packets)[0] ?? null;

  return {
    applicationId: application.id,
    status: latestPacket?.status ?? application.packet_status ?? "not_started",
    manifest: latestPacket?.manifest ?? application.packet_manifest ?? null,
    storagePath: latestPacket?.storage_path ?? application.packet_storage_path,
    handoffTokenAvailable: Boolean(latestPacket?.handoff_token),
    generatedAt: latestPacket?.generated_at ?? null,
    readyAt: application.packet_ready_at ?? latestPacket?.generated_at ?? null,
    externalStatus: application.external_status,
    externalReference: application.external_reference,
    externalStatusUpdatedAt: application.external_status_updated_at,
    resultStatus: application.result_status,
    resultStoragePath: application.result_storage_path,
    resultNotes: application.result_notes,
  };
}

function packetIsReady(packet: PacketStateSummary): boolean {
  return ["ready", "generated", "complete", "completed"].includes(packet.status);
}

export function buildLifecycleSummary(bundle: ApplicationAutomationBundle): LifecycleSummary {
  const payment = buildPaymentStateSummary(
    bundle.application,
    bundle.paymentRecords,
    bundle.invoiceRequests,
    bundle.refundRecords,
  );
  const documents = buildDocumentReadinessSummary(
    bundle.application,
    bundle.documents,
    bundle.requirements,
  );
  const consent = buildConsentStateSummary(
    bundle.application,
    bundle.consentEvents,
    bundle.signatures,
  );
  const packet = buildPacketStateSummary(bundle.application, bundle.packets);
  const checklist = {
    payment:
      payment.status === "paid" ||
      payment.status === "partially_refunded" ||
      payment.status === "refunded",
    consent: consent.status === "complete",
    documents: documents.status === "ready",
    packet: packetIsReady(packet),
    externalStatus: Boolean(packet.externalStatus || packet.externalReference),
    result: Boolean(packet.resultStatus || packet.resultStoragePath),
  };
  const blockers: string[] = [];
  if (!checklist.payment) blockers.push("payment");
  if (!checklist.consent) blockers.push("consent");
  if (documents.status === "coverage_gap") blockers.push("document_coverage");
  else if (!checklist.documents) blockers.push("documents");

  let lifecycleStage: LifecycleSummary["lifecycleStage"] = "complete";
  let nextAction: LifecycleSummary["nextAction"] = "view_result";

  if (!checklist.payment) {
    lifecycleStage = "payment";
    nextAction = "complete_payment";
  } else if (!checklist.consent) {
    lifecycleStage = "consent";
    nextAction = "accept_consent";
  } else if (!checklist.documents) {
    lifecycleStage = "documents";
    nextAction = documents.status === "needs_review" ? "wait_for_review" : "upload_documents";
  } else if (!checklist.packet) {
    lifecycleStage = "packet";
    nextAction = "prepare_packet";
  } else if (!checklist.externalStatus) {
    lifecycleStage = "external_status";
    nextAction = "track_external_status";
  } else if (!checklist.result) {
    lifecycleStage = "result";
    nextAction = "track_external_status";
  }

  return {
    applicationId: bundle.application.id,
    applicantId: bundle.application.applicant_id,
    country: bundle.application.country,
    visaType: bundle.application.visa_type,
    visaPackageId: bundle.application.visa_package_id,
    applicationStatus: bundle.application.status,
    lifecycleStage,
    nextAction,
    checklist,
    blockers,
    updatedAt: bundle.application.updated_at ?? bundle.application.created_at,
    payment,
    consent,
    documents,
    packet,
  };
}

export function buildCustomerStatusSummary(params: {
  applicantId: string;
  bundles: ApplicationAutomationBundle[];
  notifications: NotificationEventRow[];
  dataRightsRequests: DataPrivacyRequestRow[];
}): CustomerStatusSummary {
  return {
    applicantId: params.applicantId,
    generatedAt: new Date().toISOString(),
    applications: params.bundles.map(buildLifecycleSummary),
    notifications: sortNewestFirst(params.notifications)
      .slice(0, 20)
      .map(summarizeNotificationEvent),
    dataRightsRequests: sortNewestFirst(params.dataRightsRequests).map(
      summarizeDataRightsRequest,
    ),
  };
}

export async function readApplicationAutomationBundles(
  adminClient: InternalSupabaseClient,
  applications: ApplicationAutomationRow[],
): Promise<AutomationActionResult<ApplicationAutomationBundle[]>> {
  if (applications.length === 0) return actionOk([]);

  const applicationIds = applications.map((application) => application.id);
  const packageIds = applications
    .map((application) => application.visa_package_id)
    .filter((id): id is string => Boolean(id));
  const countries = [...new Set(applications.map((application) => application.country))];
  const visaTypes = [...new Set(applications.map((application) => application.visa_type))];

  const [
    documentsResult,
    paymentResult,
    invoiceResult,
    refundResult,
    consentResult,
    signatureResult,
    packetResult,
    notificationResult,
    packageResult,
    countryRequirementsResult,
    packageRequirementsResult,
  ] = await Promise.all([
    adminClient
      .from<ApplicationDocumentRow>("application_documents")
      .select(
        "id, application_id, document_type, requirement_key, storage_path, filename, status, rejection_reason, required, review_notes, reviewed_at, reviewed_by, created_at, updated_at",
      )
      .in("application_id", applicationIds),
    adminClient
      .from<PaymentRecordRow>("payment_records")
      .select(
        "id, application_id, applicant_id, visa_package_id, provider, provider_session_id, provider_payment_id, amount_cents, currency, status, fee_type, receipt_url, metadata, created_at, updated_at",
      )
      .in("application_id", applicationIds),
    adminClient
      .from<InvoiceRequestRow>("invoice_requests")
      .select(
        "id, payment_record_id, application_id, applicant_id, invoice_name, tax_identifier, billing_email, status, notes, created_at, updated_at",
      )
      .in("application_id", applicationIds),
    adminClient
      .from<RefundRecordRow>("refund_records")
      .select(
        "id, payment_record_id, application_id, applicant_id, amount_cents, currency, status, reason, policy_snapshot, created_at, updated_at",
      )
      .in("application_id", applicationIds),
    adminClient
      .from<ConsentEventRow>("consent_events")
      .select("id, application_id, applicant_id, consent_type, version, accepted, document_hash, created_at")
      .in("application_id", applicationIds),
    adminClient
      .from<ApplicationSignatureRow>("application_signatures")
      .select(
        "id, application_id, applicant_id, signature_type, signer_name, signed_document_path, document_hash, signed_at, created_at",
      )
      .in("application_id", applicationIds),
    adminClient
      .from<ApplicationPacketRow>("application_packets")
      .select(
        "id, application_id, applicant_id, status, manifest, storage_path, handoff_token, generated_at, created_at, updated_at",
      )
      .in("application_id", applicationIds),
    adminClient
      .from<NotificationEventRow>("notification_events")
      .select(
        "id, application_id, applicant_id, channel, template_key, recipient, status, payload, sent_at, created_at, updated_at",
      )
      .in("application_id", applicationIds)
      .order("created_at", { ascending: false })
      .limit(100),
    packageIds.length > 0
      ? adminClient
          .from<VisaPackageRow>("visa_packages")
          .select(
            "id, country, visa_type, name, description, price_cents, currency, is_active, metadata, created_at, updated_at",
          )
          .in("id", packageIds)
      : Promise.resolve({ data: [], error: null }),
    adminClient
      .from<DocumentRequirementRow>("document_requirements")
      .select(
        "id, visa_package_id, country, visa_type, requirement_key, label_en, label_zh, description, required, sort_order, metadata, created_at, updated_at",
      )
      .in("country", countries)
      .in("visa_type", visaTypes),
    packageIds.length > 0
      ? adminClient
          .from<DocumentRequirementRow>("document_requirements")
          .select(
            "id, visa_package_id, country, visa_type, requirement_key, label_en, label_zh, description, required, sort_order, metadata, created_at, updated_at",
          )
          .in("visa_package_id", packageIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const error = firstError([
    documentsResult,
    paymentResult,
    invoiceResult,
    refundResult,
    consentResult,
    signatureResult,
    packetResult,
    notificationResult,
    packageResult,
    countryRequirementsResult,
    packageRequirementsResult,
  ]);

  if (error) {
    return actionFail("DB_ERROR", "Could not load automation state.");
  }

  const documentsByApplication = groupByApplication(documentsResult.data ?? []);
  const paymentsByApplication = groupByApplication(paymentResult.data ?? []);
  const invoicesByApplication = groupByApplication(invoiceResult.data ?? []);
  const refundsByApplication = groupByApplication(refundResult.data ?? []);
  const consentsByApplication = groupByApplication(consentResult.data ?? []);
  const signaturesByApplication = groupByApplication(signatureResult.data ?? []);
  const packetsByApplication = groupByApplication(packetResult.data ?? []);
  const notificationsByApplication = groupByApplication(notificationResult.data ?? []);
  const packagesById = groupPackages(packageResult.data ?? []);
  const allRequirements = [
    ...(countryRequirementsResult.data ?? []),
    ...(packageRequirementsResult.data ?? []),
  ];

  return actionOk(
    applications.map((application) => ({
      application,
      documents: documentsByApplication.get(application.id) ?? [],
      requirements: getRequirementRowsForApplication(application, allRequirements),
      paymentRecords: paymentsByApplication.get(application.id) ?? [],
      invoiceRequests: invoicesByApplication.get(application.id) ?? [],
      refundRecords: refundsByApplication.get(application.id) ?? [],
      consentEvents: consentsByApplication.get(application.id) ?? [],
      signatures: signaturesByApplication.get(application.id) ?? [],
      packets: packetsByApplication.get(application.id) ?? [],
      notifications: notificationsByApplication.get(application.id) ?? [],
      visaPackage: application.visa_package_id
        ? packagesById.get(application.visa_package_id) ?? null
        : null,
    })),
  );
}

export async function readDataRightsRequests(
  adminClient: InternalSupabaseClient,
  applicantId: string,
): Promise<AutomationActionResult<DataPrivacyRequestRow[]>> {
  const { data, error } = await adminClient
    .from<DataPrivacyRequestRow>("data_privacy_requests")
    .select("id, applicant_id, request_type, status, notes, fulfilled_at, created_at, updated_at")
    .eq("applicant_id", applicantId)
    .order("created_at", { ascending: false });

  if (error) {
    return actionFail("DB_ERROR", "Could not load data-rights requests.");
  }

  return actionOk(data ?? []);
}

export async function readApplicantNotifications(
  adminClient: InternalSupabaseClient,
  applicantId: string,
): Promise<AutomationActionResult<NotificationEventRow[]>> {
  const { data, error } = await adminClient
    .from<NotificationEventRow>("notification_events")
    .select(
      "id, application_id, applicant_id, channel, template_key, recipient, status, payload, sent_at, created_at, updated_at",
    )
    .eq("applicant_id", applicantId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return actionFail("DB_ERROR", "Could not load notification events.");
  }

  return actionOk(data ?? []);
}

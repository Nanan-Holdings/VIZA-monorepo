export type AutomationJson =
  | string
  | number
  | boolean
  | null
  | { [key: string]: AutomationJson | undefined }
  | AutomationJson[];

export type AutomationActionErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "DB_ERROR"
  | "UNKNOWN_ERROR";

export interface AutomationActionError {
  code: AutomationActionErrorCode;
  message: string;
}

export type AutomationActionResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: AutomationActionError;
    };

export function actionOk<T>(data: T): AutomationActionResult<T> {
  return { ok: true, data };
}

export function actionFail<T = never>(
  code: AutomationActionErrorCode,
  message: string,
): AutomationActionResult<T> {
  return {
    ok: false,
    error: { code, message },
  };
}

export function actionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export interface MoneyAmount {
  amountCents: number;
  currency: string;
}

export interface AutomationCoverageSummary {
  visaPackageId: string | null;
  country: string;
  visaType: string;
  coverage: {
    schema: boolean;
    documents: boolean;
    payment: boolean;
    packet: boolean;
    externalSubmission: boolean;
    resultDelivery: boolean;
  };
  governmentFee: {
    mode: string;
    amountCents: number | null;
    currency: string;
    label: string | null;
  };
  requirements: DocumentRequirementSummary[];
  metadata: AutomationJson | null;
}

export interface DocumentRequirementSummary {
  id: string | null;
  requirementKey: string;
  labelEn: string;
  labelZh: string;
  description: string | null;
  required: boolean;
  sortOrder: number;
}

export interface DocumentReadinessItem {
  requirementKey: string;
  documentType: string;
  labelEn: string;
  labelZh: string;
  required: boolean;
  status: string;
  uploaded: boolean;
  reviewed: boolean;
  blocking: boolean;
  reviewNotes: string | null;
  updatedAt: string | null;
}

export interface DocumentReadinessSummary {
  applicationId: string;
  status: "ready" | "needs_upload" | "needs_review" | "blocked" | "coverage_gap";
  totalRequired: number;
  uploadedRequired: number;
  validatedRequired: number;
  missingRequired: number;
  rejectedRequired: number;
  items: DocumentReadinessItem[];
}

export interface PaymentRecordSummary {
  id: string;
  provider: string;
  amountCents: number;
  currency: string;
  status: string;
  feeType: string;
  receiptUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface InvoiceRequestSummary {
  id: string;
  paymentRecordId: string | null;
  applicationId: string | null;
  status: string;
  billingEmail: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface RefundRequestSummary {
  id: string;
  paymentRecordId: string | null;
  applicationId: string | null;
  amountCents: number;
  currency: string;
  status: string;
  reason: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PaymentStateSummary {
  applicationId: string | null;
  status: "unpaid" | "pending" | "paid" | "failed" | "refunded" | "partially_refunded";
  totalPaid: MoneyAmount;
  totalRefunded: MoneyAmount;
  latestReceiptUrl: string | null;
  records: PaymentRecordSummary[];
  invoiceRequests: InvoiceRequestSummary[];
  refundRequests: RefundRequestSummary[];
  refundEligibility: {
    canRequest: boolean;
    maxAmountCents: number;
    currency: string;
    reason: string;
  };
}

export interface ConsentEventSummary {
  id: string;
  consentType: string;
  version: string;
  accepted: boolean;
  createdAt: string | null;
}

export interface SignatureSummary {
  id: string;
  signatureType: string;
  signerName: string;
  signedAt: string | null;
}

export interface ConsentStateSummary {
  applicationId: string;
  status: "complete" | "needs_consent" | "needs_signature";
  requiredConsentTypes: string[];
  acceptedConsentTypes: string[];
  latestConsents: ConsentEventSummary[];
  signatures: SignatureSummary[];
}

export interface PacketStateSummary {
  applicationId: string;
  status: string;
  manifest: AutomationJson | null;
  storagePath: string | null;
  handoffTokenAvailable: boolean;
  generatedAt: string | null;
  readyAt: string | null;
  externalStatus: string | null;
  externalReference: string | null;
  externalStatusUpdatedAt: string | null;
  resultStatus: string | null;
  resultStoragePath: string | null;
  resultNotes: string | null;
}

export interface NotificationEventSummary {
  id: string;
  applicationId: string | null;
  channel: string;
  templateKey: string;
  recipient: string | null;
  status: string;
  sentAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  payloadKeys: string[];
}

export interface LifecycleChecklistSummary {
  payment: boolean;
  consent: boolean;
  documents: boolean;
  packet: boolean;
  externalStatus: boolean;
  result: boolean;
}

export interface LifecycleSummary {
  applicationId: string;
  applicantId: string;
  country: string;
  visaType: string;
  visaPackageId: string | null;
  applicationStatus: string;
  lifecycleStage:
    | "payment"
    | "consent"
    | "documents"
    | "packet"
    | "external_status"
    | "result"
    | "complete";
  nextAction:
    | "complete_payment"
    | "accept_consent"
    | "upload_documents"
    | "wait_for_review"
    | "prepare_packet"
    | "track_external_status"
    | "view_result";
  checklist: LifecycleChecklistSummary;
  blockers: string[];
  updatedAt: string | null;
  payment: PaymentStateSummary;
  consent: ConsentStateSummary;
  documents: DocumentReadinessSummary;
  packet: PacketStateSummary;
}

export interface CustomerStatusSummary {
  applicantId: string;
  generatedAt: string;
  applications: LifecycleSummary[];
  notifications: NotificationEventSummary[];
  dataRightsRequests: DataRightsRequestSummary[];
}

export interface AdminApplicationSummary {
  applicationId: string;
  applicantId: string;
  country: string;
  visaType: string;
  status: string;
  paymentStatus: PaymentStateSummary["status"];
  documentStatus: DocumentReadinessSummary["status"];
  consentStatus: ConsentStateSummary["status"];
  packetStatus: string;
  externalStatus: string | null;
  resultStatus: string | null;
  updatedAt: string | null;
}

export interface AdminBillingSummary {
  generatedAt: string;
  paymentCounts: Record<string, number>;
  invoiceCounts: Record<string, number>;
  refundCounts: Record<string, number>;
  totalPaid: MoneyAmount;
  openInvoiceRequests: InvoiceRequestSummary[];
  openRefundRequests: RefundRequestSummary[];
}

export interface AdminPackageCoverageSummary {
  generatedAt: string;
  packages: AutomationCoverageSummary[];
}

export interface DataRightsRequestSummary {
  id: string;
  applicantId: string | null;
  requestType: string;
  status: string;
  notes: string | null;
  fulfilledAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

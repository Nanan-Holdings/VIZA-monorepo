export type RefundEligibilityStatus =
  | "eligible"
  | "manual_review"
  | "not_eligible";

export interface BillingStatusSummary {
  totalRecords: number;
  paidCount: number;
  openInvoiceRequests: number;
  openRefundRequests: number;
  collectedCents: number;
  collectedCurrency: string;
}

export interface BillingReference {
  id: string;
  label: string;
  secondary?: string | null;
  href?: string;
}

export interface PaymentSummary {
  id: string;
  provider: string;
  providerSessionRef: string | null;
  providerPaymentRef: string | null;
  amountLabel: string;
  amountCents: number;
  currency: string;
  status: string;
  feeType: string;
  receiptUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  metadata: Array<{ label: string; value: string }>;
}

export interface InvoiceSummary {
  id: string;
  invoiceName: string | null;
  billingEmail: string | null;
  taxIdentifierMasked: string | null;
  status: string;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface RefundSummary {
  id: string;
  amountLabel: string;
  amountCents: number;
  currency: string;
  status: string;
  reason: string | null;
  policySnapshot: Array<{ label: string; value: string }>;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface RefundEligibility {
  status: RefundEligibilityStatus;
  label: string;
  reason: string;
  eligibleAmountLabel: string;
  ruleCode: string;
}

export interface BillingTimelineEvent {
  id: string;
  label: string;
  status: string;
  happenedAt: string | null;
}

export interface BillingSupportRecord {
  id: string;
  source: "payment" | "invoice_request" | "refund_request";
  payment: PaymentSummary | null;
  invoiceStatus: string;
  refundStatus: string;
  latestInvoice: InvoiceSummary | null;
  latestRefund: RefundSummary | null;
  invoices: InvoiceSummary[];
  refunds: RefundSummary[];
  refundEligibility: RefundEligibility;
  applicant: BillingReference | null;
  application: BillingReference | null;
  visaPackage: BillingReference | null;
  governmentFeeMode: string | null;
  applicationStatus: string | null;
  timeline: BillingTimelineEvent[];
}

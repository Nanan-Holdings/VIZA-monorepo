export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = Record<string, JsonValue>;

export const officialFeeModes = ["dry_run", "sandbox", "manual", "live"] as const;
export type OfficialFeeMode = (typeof officialFeeModes)[number];

export const officialFeeProviderStatuses = [
  "succeeded",
  "failed",
  "pending",
  "needs_user_action",
  "manual_review",
  "unsupported",
] as const;
export type OfficialFeeProviderStatus =
  (typeof officialFeeProviderStatuses)[number];

export const officialFeeIntentStatuses = [
  "created",
  "admin_approved",
  "ready",
  "in_progress",
  "succeeded",
  "failed",
  "pending",
  "needs_user_action",
  "manual_review",
  "unsupported",
  "cancelled",
] as const;
export type OfficialFeeIntentStatus = (typeof officialFeeIntentStatuses)[number];

export type OfficialFeeFundingSource = "user_deposit" | "company_advance";

export interface OfficialFeeApplication {
  id: string;
  applicantId: string;
  userId: string;
  country: string;
  countryCode: string;
  visaType: string | null;
  visaPackageId: string | null;
  status: string;
  paymentStatus: string | null;
  packetStatus: string | null;
  automationStatus: string | null;
  governmentFeeCents: number | null;
  governmentFeeCurrency: string | null;
}

export interface GovernmentFeeRule {
  id: string;
  amountCents: number;
  currency: string;
  sourceUrl: string | null;
  mode: string;
  metadata: JsonObject | null;
}

export interface FeeDiscoveryResult {
  status: "discovered" | "unsupported" | "manual_review";
  countryCode: string;
  officialFeeAmount: number;
  officialFeeCurrency: string;
  feeSource: string;
  feeSourceUrl: string | null;
  targetPayee: string | null;
  targetSite: string | null;
  feeBreakdown: JsonObject;
  message?: string;
}

export interface OfficialFeeQuote {
  id: string;
  applicationId: string;
  userId: string;
  countryCode: string;
  visaType: string | null;
  officialFeeAmount: number;
  officialFeeCurrency: string;
  serviceFeeAmount: number | null;
  serviceFeeCurrency: string | null;
  totalChargeAmount: number | null;
  totalChargeCurrency: string | null;
  exchangeRate: number | null;
  feeSource: string | null;
  feeSourceUrl: string | null;
  feeBreakdownJson: JsonObject;
  quoteStatus: string;
  expiresAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface OfficialFeeConsent {
  id: string;
  applicationId: string;
  userId: string;
  quoteId: string;
  accepted: boolean;
  snapshot: JsonObject;
  createdAt: string | null;
}

export interface OfficialFeePaymentIntent {
  id: string;
  applicationId: string;
  userId: string;
  feeQuoteId: string | null;
  countryCode: string;
  provider: string;
  mode: OfficialFeeMode;
  officialFeeAmount: number;
  officialFeeCurrency: string;
  targetPayee: string | null;
  targetSite: string | null;
  paymentMethodType: string | null;
  paymentInstrumentId: string | null;
  status: OfficialFeeIntentStatus;
  idempotencyKey: string;
  requiresAdminApproval: boolean;
  adminApprovedBy: string | null;
  adminApprovedAt: string | null;
  userConsentedAt: string | null;
  userConsentSnapshotJson: JsonObject | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface OfficialFeePaymentAttempt {
  id: string;
  officialFeePaymentIntentId: string | null;
  applicationId: string;
  attemptNumber: number;
  provider: string;
  mode: OfficialFeeMode;
  status: string;
  requestPayloadRedactedJson: JsonObject | null;
  responsePayloadRedactedJson: JsonObject | null;
  errorCode: string | null;
  errorMessage: string | null;
  officialReceiptNumber: string | null;
  officialReceiptUrl: string | null;
  screenshotUrl: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface OfficialFeeReceipt {
  id: string;
  applicationId: string;
  userId: string;
  officialFeePaymentIntentId: string | null;
  countryCode: string;
  receiptNumber: string | null;
  receiptUrl: string | null;
  receiptFileUrl: string | null;
  amount: number;
  currency: string;
  paidAt: string | null;
  source: string | null;
  rawReceiptRedactedJson: JsonObject | null;
  createdAt: string | null;
}

export interface UserPaymentEvidence {
  id: string;
  amount: number;
  currency: string;
  status: string;
  feeType: string;
  source: "payment_records" | "order";
}

export interface PaymentInstrumentSelection {
  paymentInstrumentId: string | null;
  paymentMethodType: string;
  provider: string;
  instrumentType: string;
}

export interface PaymentInstrumentRecord extends PaymentInstrumentSelection {
  status: string;
  currency: string | null;
  spendingLimitAmount: number | null;
  spendingLimitCurrency: string | null;
}

export interface OfficialFeePaymentResult {
  status: OfficialFeeProviderStatus;
  mode: OfficialFeeMode;
  countryCode: string;
  officialReceiptNumber: string | null;
  officialReceiptUrl: string | null;
  screenshotUrl: string | null;
  message: string;
  rawResultRedacted: JsonObject;
  errorCode?: string;
  errorMessage?: string;
}

export interface PreparedOfficialFeePayment {
  providerName: string;
  targetPayee: string | null;
  targetSite: string | null;
  paymentMethodType: string;
}

export interface OfficialFeePaymentProvider {
  countryCode: string;
  providerName: string;
  supportsDryRun: boolean;
  supportsSandbox: boolean;
  supportsLive: boolean;
  discoverFee(
    application: OfficialFeeApplication,
    context: {
      feeRule: GovernmentFeeRule | null;
      mode: OfficialFeeMode;
    },
  ): Promise<FeeDiscoveryResult>;
  preparePayment(
    application: OfficialFeeApplication,
    quote: OfficialFeeQuote,
  ): Promise<PreparedOfficialFeePayment>;
  payOfficialFee(
    intent: OfficialFeePaymentIntent,
    options: {
      application: OfficialFeeApplication;
      quote: OfficialFeeQuote;
      instrument: PaymentInstrumentSelection;
    },
  ): Promise<OfficialFeePaymentResult>;
  captureReceipt(
    result: OfficialFeePaymentResult,
    intent: OfficialFeePaymentIntent,
  ): Promise<OfficialFeeReceiptInput>;
}

export interface OfficialFeeReceiptInput {
  applicationId: string;
  userId: string;
  officialFeePaymentIntentId: string;
  countryCode: string;
  receiptNumber: string | null;
  receiptUrl: string | null;
  receiptFileUrl: string | null;
  amount: number;
  currency: string;
  paidAt: string | null;
  source: string;
  rawReceiptRedactedJson: JsonObject;
}

export interface OfficialFeeReconciliationEntry {
  id: string;
  applicationId: string;
  userId: string;
  officialFeePaymentIntentId: string | null;
  userPaymentId: string | null;
  officialFeeAmount: number;
  officialFeeCurrency: string;
  userCollectedAmount: number | null;
  userCollectedCurrency: string | null;
  fxRate: number | null;
  balanceDelta: number | null;
  reconciliationStatus: string;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface OfficialFeeAuditEventInput {
  applicationId: string;
  applicantId: string;
  userId: string | null;
  eventType: string;
  actorType: "user" | "admin" | "system";
  actorId: string | null;
  message: string;
  metadata: JsonObject;
  idempotencyKey?: string;
}

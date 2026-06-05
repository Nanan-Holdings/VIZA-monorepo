import { randomUUID } from "node:crypto";
import type {
  JsonObject,
  OfficialFeeApplication,
  OfficialFeeFundingSource,
  OfficialFeeMode,
  OfficialFeePaymentAttempt,
  OfficialFeePaymentIntent,
  OfficialFeePaymentProvider,
  OfficialFeeQuote,
  OfficialFeeReceipt,
  OfficialFeeReconciliationEntry,
  PaymentInstrumentSelection,
  UserPaymentEvidence,
} from "./types.js";
import {
  OfficialFeeProviderRegistry,
} from "./providers.js";
import {
  type OfficialFeeRepository,
} from "./repository.js";
import { redactToObject } from "./redaction.js";

export class OfficialFeeServiceError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "OfficialFeeServiceError";
    this.status = status;
    this.code = code;
  }
}

export interface CreateFeeQuoteOptions {
  mode?: OfficialFeeMode;
  expiresInMinutes?: number;
}

export interface RecordConsentOptions {
  actorUserId: string;
  consentSnapshot: JsonObject;
  idempotencyKey?: string;
}

export interface CreateOfficialFeePaymentIntentOptions {
  quoteId?: string;
  mode?: OfficialFeeMode;
  provider?: string;
  idempotencyKey?: string;
  fundingSource?: OfficialFeeFundingSource;
}

export interface OfficialFeeStatusSnapshot {
  quote: OfficialFeeQuote | null;
  consent: {
    id: string;
    quoteId: string;
    accepted: boolean;
    createdAt: string | null;
  } | null;
  intent: SafeOfficialFeeIntent | null;
  attempts: OfficialFeePaymentAttempt[];
  receipt: OfficialFeeReceipt | null;
  reconciliation: OfficialFeeReconciliationEntry | null;
  notice: string | null;
}

export type SafeOfficialFeeIntent = Omit<
  OfficialFeePaymentIntent,
  "paymentInstrumentId" | "userConsentSnapshotJson"
> & {
  paymentInstrumentId: null;
  userConsentSnapshotJson: JsonObject | null;
};

const READY_APPLICATION_STATUSES = new Set([
  "application_ready_for_official_fee",
  "ready_for_official_fee",
  "ready_for_packet",
  "packet_ready",
  "staff_reviewed",
  "external_submission_in_progress",
  "submitted",
  "submitted_to_government",
]);

const READY_PACKET_STATUSES = new Set([
  "ready",
  "generated",
  "packet_ready",
  "complete",
  "completed",
]);

function isExpired(expiresAt: string | null): boolean {
  return Boolean(expiresAt && Date.parse(expiresAt) <= Date.now());
}

function addMinutes(minutes: number): string {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function requireLiveModeEnabled(): void {
  if (process.env.OFFICIAL_FEE_LIVE_MODE_ENABLED !== "true") {
    throw new OfficialFeeServiceError(
      403,
      "live_mode_disabled",
      "Live official-fee payment is disabled. Legal, compliance, provider, and admin approval are required.",
    );
  }
}

function assertProviderSupportsMode(
  provider: OfficialFeePaymentProvider,
  mode: OfficialFeeMode,
): void {
  if (mode === "manual") return;
  if (mode === "dry_run" && provider.supportsDryRun) return;
  if (mode === "sandbox" && provider.supportsSandbox) return;
  if (mode === "live") {
    requireLiveModeEnabled();
    if (provider.supportsLive) return;
  }

  throw new OfficialFeeServiceError(
    409,
    "provider_mode_unsupported",
    `Provider ${provider.providerName} does not support ${mode} official-fee payment.`,
  );
}

function assertApplicationReady(application: OfficialFeeApplication): void {
  const status = application.status.toLowerCase();
  const packetStatus = application.packetStatus?.toLowerCase() ?? "";
  const automationStatus = application.automationStatus?.toLowerCase() ?? "";
  if (
    READY_APPLICATION_STATUSES.has(status) ||
    READY_PACKET_STATUSES.has(packetStatus) ||
    READY_APPLICATION_STATUSES.has(automationStatus)
  ) {
    return;
  }

  throw new OfficialFeeServiceError(
    409,
    "application_not_ready",
    "Application is not ready for official-fee payment.",
  );
}

function assertQuoteUsable(quote: OfficialFeeQuote, applicationId: string): void {
  if (quote.applicationId !== applicationId) {
    throw new OfficialFeeServiceError(
      409,
      "quote_application_mismatch",
      "Fee quote does not belong to this application.",
    );
  }
  if (quote.quoteStatus === "expired" || isExpired(quote.expiresAt)) {
    throw new OfficialFeeServiceError(
      409,
      "quote_expired",
      "Official fee quote has expired.",
    );
  }
}

function buildAuditIdempotencyKey(
  eventType: string,
  applicationId: string,
  id: string,
): string {
  return `official-fee:${eventType}:${applicationId}:${id}`;
}

function makeIntentIdempotencyKey(
  applicationId: string,
  quoteId: string,
  mode: OfficialFeeMode,
  fundingSource: OfficialFeeFundingSource,
): string {
  return `official-fee:${applicationId}:${quoteId}:${mode}:${fundingSource}`;
}

function sanitizeIntent(intent: OfficialFeePaymentIntent): SafeOfficialFeeIntent {
  return {
    ...intent,
    paymentInstrumentId: null,
    userConsentSnapshotJson: intent.userConsentSnapshotJson
      ? redactToObject(intent.userConsentSnapshotJson)
      : null,
  };
}

export class OfficialFeeQuoteService {
  constructor(
    private readonly repository: OfficialFeeRepository,
    private readonly providerRegistry: OfficialFeeProviderRegistry,
  ) {}

  async createFeeQuote(
    applicationId: string,
    options: CreateFeeQuoteOptions = {},
  ): Promise<OfficialFeeQuote> {
    const application = await this.getApplicationOrThrow(applicationId);
    if (!this.providerRegistry.hasCountrySupport(application.countryCode)) {
      throw new OfficialFeeServiceError(
        422,
        "unsupported_country",
        "Official fee payment is not supported for this country.",
      );
    }

    const latestQuote = await this.repository.getLatestFeeQuote(applicationId);
    if (
      latestQuote &&
      !isExpired(latestQuote.expiresAt) &&
      latestQuote.quoteStatus !== "expired" &&
      latestQuote.quoteStatus !== "superseded"
    ) {
      return latestQuote;
    }

    if (latestQuote && isExpired(latestQuote.expiresAt)) {
      await this.repository.updateFeeQuote(latestQuote.id, {
        quoteStatus: "expired",
      });
    }

    const mode = options.mode ?? "dry_run";
    const provider = this.providerRegistry.getProvider(application.countryCode);
    assertProviderSupportsMode(provider, mode);

    const feeRule = await this.repository.getLatestGovernmentFeeRule(application);
    const discovery = await provider.discoverFee(application, { feeRule, mode });

    if (discovery.status !== "discovered") {
      throw new OfficialFeeServiceError(
        422,
        discovery.status === "unsupported" ? "unsupported_country" : "fee_manual_review_required",
        discovery.message ?? "Official fee could not be discovered automatically.",
      );
    }

    const quote = await this.repository.insertFeeQuote({
      applicationId: application.id,
      userId: application.userId,
      countryCode: discovery.countryCode,
      visaType: application.visaType,
      officialFeeAmount: discovery.officialFeeAmount,
      officialFeeCurrency: discovery.officialFeeCurrency,
      serviceFeeAmount: null,
      serviceFeeCurrency: null,
      totalChargeAmount: discovery.officialFeeAmount,
      totalChargeCurrency: discovery.officialFeeCurrency,
      exchangeRate: null,
      feeSource: discovery.feeSource,
      feeSourceUrl: discovery.feeSourceUrl,
      feeBreakdownJson: {
        ...discovery.feeBreakdown,
        provider: provider.providerName,
        target_payee: discovery.targetPayee,
        target_site: discovery.targetSite,
        dry_run_only: mode === "dry_run",
      },
      quoteStatus: "created",
      expiresAt: addMinutes(options.expiresInMinutes ?? 60),
    });

    await this.repository.updateApplicationOfficialFeeState(application.id, {
      officialFeeStatus: "fee_quote_created",
      officialFeeQuoteId: quote.id,
    });
    await this.repository.addApplicationEvent({
      applicationId: application.id,
      applicantId: application.applicantId,
      userId: application.userId,
      eventType: "fee_quote_created",
      actorType: "system",
      actorId: null,
      message: "Official fee quote created.",
      metadata: {
        quote_id: quote.id,
        country_code: quote.countryCode,
        amount: quote.officialFeeAmount,
        currency: quote.officialFeeCurrency,
        fee_source: quote.feeSource,
      },
      idempotencyKey: buildAuditIdempotencyKey("fee_quote_created", application.id, quote.id),
    });

    return quote;
  }

  async refreshFeeQuote(quoteId: string): Promise<OfficialFeeQuote> {
    const quote = await this.repository.getFeeQuoteById(quoteId);
    if (!quote) {
      throw new OfficialFeeServiceError(404, "quote_not_found", "Official fee quote not found.");
    }
    await this.repository.updateFeeQuote(quote.id, { quoteStatus: "expired" });
    return this.createFeeQuote(quote.applicationId);
  }

  async getFeeQuote(applicationId: string): Promise<OfficialFeeQuote | null> {
    const quote = await this.repository.getLatestFeeQuote(applicationId);
    if (!quote) return null;
    if (isExpired(quote.expiresAt)) {
      await this.repository.updateFeeQuote(quote.id, { quoteStatus: "expired" });
      return null;
    }
    return quote;
  }

  private async getApplicationOrThrow(applicationId: string): Promise<OfficialFeeApplication> {
    const application = await this.repository.getApplicationContext(applicationId);
    if (!application) {
      throw new OfficialFeeServiceError(
        404,
        "application_not_found_or_unsupported",
        "Application was not found or its country is unsupported.",
      );
    }
    return application;
  }
}

export class UserFeeConsentService {
  constructor(private readonly repository: OfficialFeeRepository) {}

  async requestConsent(applicationId: string, quoteId: string): Promise<void> {
    const application = await this.getApplicationOrThrow(applicationId);
    const quote = await this.getQuoteOrThrow(quoteId);
    assertQuoteUsable(quote, application.id);
    await this.repository.updateApplicationOfficialFeeState(application.id, {
      officialFeeStatus: "user_fee_consent_required",
      officialFeeQuoteId: quote.id,
    });
    await this.repository.addApplicationEvent({
      applicationId: application.id,
      applicantId: application.applicantId,
      userId: application.userId,
      eventType: "user_consent_requested",
      actorType: "system",
      actorId: null,
      message: "Official fee user consent requested.",
      metadata: {
        quote_id: quote.id,
        amount: quote.officialFeeAmount,
        currency: quote.officialFeeCurrency,
      },
      idempotencyKey: buildAuditIdempotencyKey("user_consent_requested", application.id, quote.id),
    });
  }

  async recordConsent(
    applicationId: string,
    quoteId: string,
    options: RecordConsentOptions,
  ): Promise<void> {
    const application = await this.getApplicationOrThrow(applicationId);
    if (application.userId !== options.actorUserId) {
      throw new OfficialFeeServiceError(
        403,
        "forbidden",
        "Only the application owner can consent to official-fee payment.",
      );
    }
    const quote = await this.getQuoteOrThrow(quoteId);
    assertQuoteUsable(quote, application.id);

    const consent = await this.repository.insertConsentEvent({
      application,
      quote,
      actorUserId: options.actorUserId,
      consentSnapshot: redactToObject({
        ...options.consentSnapshot,
        quote_id: quote.id,
        official_fee_amount: quote.officialFeeAmount,
        official_fee_currency: quote.officialFeeCurrency,
        authorized_to_pay_on_behalf: true,
      }),
      idempotencyKey:
        options.idempotencyKey ?? `official-fee-consent:${application.id}:${quote.id}:${options.actorUserId}`,
    });

    await this.repository.updateFeeQuote(quote.id, { quoteStatus: "consented" });
    await this.repository.updateApplicationOfficialFeeState(application.id, {
      officialFeeStatus: "user_fee_consent_received",
      officialFeeQuoteId: quote.id,
    });
    await this.repository.addApplicationEvent({
      applicationId: application.id,
      applicantId: application.applicantId,
      userId: application.userId,
      eventType: "user_consent_received",
      actorType: "user",
      actorId: options.actorUserId,
      message: "User consent received for official-fee payment.",
      metadata: {
        consent_id: consent.id,
        quote_id: quote.id,
        amount: quote.officialFeeAmount,
        currency: quote.officialFeeCurrency,
      },
      idempotencyKey: buildAuditIdempotencyKey("user_consent_received", application.id, consent.id),
    });
  }

  async hasValidConsent(applicationId: string, quoteId?: string): Promise<boolean> {
    const consent = await this.repository.getLatestConsent(applicationId);
    if (!consent?.accepted) return false;
    if (quoteId && consent.quoteId !== quoteId) return false;
    const quote = await this.repository.getFeeQuoteById(consent.quoteId);
    return Boolean(quote && !isExpired(quote.expiresAt));
  }

  async getValidConsent(applicationId: string, quoteId: string) {
    const consent = await this.repository.getLatestConsent(applicationId);
    if (!consent?.accepted || consent.quoteId !== quoteId) {
      throw new OfficialFeeServiceError(
        409,
        "user_consent_required",
        "User consent is required before official-fee payment.",
      );
    }
    return consent;
  }

  private async getApplicationOrThrow(applicationId: string): Promise<OfficialFeeApplication> {
    const application = await this.repository.getApplicationContext(applicationId);
    if (!application) {
      throw new OfficialFeeServiceError(404, "application_not_found", "Application not found.");
    }
    return application;
  }

  private async getQuoteOrThrow(quoteId: string): Promise<OfficialFeeQuote> {
    const quote = await this.repository.getFeeQuoteById(quoteId);
    if (!quote) {
      throw new OfficialFeeServiceError(404, "quote_not_found", "Official fee quote not found.");
    }
    return quote;
  }
}

export class PaymentInstrumentService {
  constructor(private readonly repository: OfficialFeeRepository) {}

  async selectInstrumentForOfficialFee(input: {
    application: OfficialFeeApplication;
    quote: OfficialFeeQuote;
    mode: OfficialFeeMode;
    provider: string;
  }): Promise<PaymentInstrumentSelection> {
    if (input.mode === "dry_run") {
      return {
        paymentInstrumentId: null,
        paymentMethodType: "manual",
        provider: "dry_run",
        instrumentType: "dry_run_mock",
      };
    }

    if (input.mode === "manual") {
      return {
        paymentInstrumentId: null,
        paymentMethodType: "manual",
        provider: "manual",
        instrumentType: "manual",
      };
    }

    const instrument = await this.repository.selectPaymentInstrument({
      countryCode: input.quote.countryCode,
      amount: input.quote.officialFeeAmount,
      currency: input.quote.officialFeeCurrency,
      provider: input.provider,
    });

    if (!instrument) {
      throw new OfficialFeeServiceError(
        409,
        "payment_instrument_unavailable",
        "No eligible company-controlled payment instrument is available.",
      );
    }

    return instrument;
  }

  async createVirtualCardForPayment(): Promise<never> {
    throw new OfficialFeeServiceError(
      501,
      "virtual_card_not_enabled",
      "Virtual-card creation is not enabled in this dry-run framework.",
    );
  }

  async lockInstrument(): Promise<void> {
    return;
  }

  async releaseInstrument(): Promise<void> {
    return;
  }

  async markInstrumentUsed(): Promise<void> {
    return;
  }
}

export class OfficialFeeReconciliationService {
  constructor(private readonly repository: OfficialFeeRepository) {}

  async createReconciliationEntry(input: {
    application: OfficialFeeApplication;
    intent: OfficialFeePaymentIntent;
    userPayment: UserPaymentEvidence | null;
  }): Promise<OfficialFeeReconciliationEntry> {
    const sameCurrency =
      input.userPayment?.currency === input.intent.officialFeeCurrency;
    const balanceDelta =
      input.userPayment && sameCurrency
        ? Number((input.userPayment.amount - input.intent.officialFeeAmount).toFixed(2))
        : null;
    const reconciliationStatus =
      input.userPayment && sameCurrency && (balanceDelta ?? -1) >= 0
        ? "reconciled"
        : input.userPayment
          ? "pending_fx_review"
          : "company_advance_outstanding";

    const entry = await this.repository.insertReconciliationEntry({
      applicationId: input.application.id,
      userId: input.application.userId,
      officialFeePaymentIntentId: input.intent.id,
      userPaymentId:
        input.userPayment?.source === "payment_records" ? input.userPayment.id : null,
      officialFeeAmount: input.intent.officialFeeAmount,
      officialFeeCurrency: input.intent.officialFeeCurrency,
      userCollectedAmount: input.userPayment?.amount ?? null,
      userCollectedCurrency: input.userPayment?.currency ?? null,
      fxRate: null,
      balanceDelta,
      reconciliationStatus,
      notes: input.userPayment
        ? `Matched ${input.userPayment.source} funding evidence.`
        : "Company advance or manual collection is outstanding.",
    });

    await this.repository.updateApplicationOfficialFeeState(input.application.id, {
      officialFeeReconciliationStatus: entry.reconciliationStatus,
    });
    await this.repository.addApplicationEvent({
      applicationId: input.application.id,
      applicantId: input.application.applicantId,
      userId: input.application.userId,
      eventType: "reconciliation_completed",
      actorType: "system",
      actorId: null,
      message: "Official fee reconciliation entry created.",
      metadata: {
        reconciliation_id: entry.id,
        status: entry.reconciliationStatus,
        user_payment_id: entry.userPaymentId,
        balance_delta: entry.balanceDelta,
      },
      idempotencyKey: buildAuditIdempotencyKey(
        "reconciliation_completed",
        input.application.id,
        entry.id,
      ),
    });

    return entry;
  }

  async reconcileApplication(applicationId: string): Promise<OfficialFeeReconciliationEntry | null> {
    const intent = await this.repository.getLatestPaymentIntent(applicationId);
    if (!intent) return null;
    return this.repository.getReconciliationByIntent(intent.id);
  }

  async getOutstandingBalance(userId: string): Promise<{ userId: string; status: string }> {
    return { userId, status: "not_implemented" };
  }
}

export class OfficialFeePaymentService {
  constructor(
    private readonly repository: OfficialFeeRepository,
    private readonly providerRegistry: OfficialFeeProviderRegistry,
    private readonly consentService: UserFeeConsentService,
    private readonly instrumentService: PaymentInstrumentService,
    private readonly reconciliationService: OfficialFeeReconciliationService,
  ) {}

  async createOfficialFeePaymentIntent(
    applicationId: string,
    options: CreateOfficialFeePaymentIntentOptions = {},
  ): Promise<OfficialFeePaymentIntent> {
    const application = await this.getApplicationOrThrow(applicationId);
    assertApplicationReady(application);

    const quote = await this.getQuoteForIntent(application.id, options.quoteId);
    assertQuoteUsable(quote, application.id);

    const mode = options.mode ?? "dry_run";
    const providerName = options.provider ?? (mode === "manual" ? "manual_official_fee" : null);
    const provider = this.providerRegistry.getProvider(application.countryCode, providerName);
    assertProviderSupportsMode(provider, mode);

    const consent = await this.consentService.getValidConsent(application.id, quote.id);
    const userPayment = await this.repository.getPaidUserPayment(application.id);
    const fundingSource = options.fundingSource ?? "user_deposit";
    if (!userPayment && fundingSource !== "company_advance") {
      throw new OfficialFeeServiceError(
        409,
        "user_fee_not_collected",
        "User official-fee deposit or an admin-approved company advance is required.",
      );
    }

    const idempotencyKey =
      options.idempotencyKey ??
      makeIntentIdempotencyKey(application.id, quote.id, mode, fundingSource);
    const existing = await this.repository.findPaymentIntentByIdempotencyKey(idempotencyKey);
    if (existing) return existing;

    const prepared = await provider.preparePayment(application, quote);
    const instrument = await this.instrumentService.selectInstrumentForOfficialFee({
      application,
      quote,
      mode,
      provider: provider.providerName,
    });
    const requiresAdminApproval = mode !== "dry_run" || fundingSource === "company_advance";

    const intent = await this.repository.insertPaymentIntent({
      applicationId: application.id,
      userId: application.userId,
      feeQuoteId: quote.id,
      countryCode: quote.countryCode,
      provider: prepared.providerName,
      mode,
      officialFeeAmount: quote.officialFeeAmount,
      officialFeeCurrency: quote.officialFeeCurrency,
      targetPayee: prepared.targetPayee,
      targetSite: prepared.targetSite,
      paymentMethodType: instrument.paymentMethodType,
      paymentInstrumentId: instrument.paymentInstrumentId,
      status: requiresAdminApproval ? "created" : "ready",
      idempotencyKey,
      requiresAdminApproval,
      userConsentedAt: consent.createdAt,
      userConsentSnapshotJson: redactToObject(consent.snapshot),
    });

    await this.repository.updateApplicationOfficialFeeState(application.id, {
      officialFeeStatus: requiresAdminApproval
        ? "company_advance_approval_required"
        : "official_fee_payment_ready",
      officialFeePaymentIntentId: intent.id,
    });
    await this.repository.addApplicationEvent({
      applicationId: application.id,
      applicantId: application.applicantId,
      userId: application.userId,
      eventType: "official_fee_intent_created",
      actorType: "system",
      actorId: null,
      message: "Official fee payment intent created.",
      metadata: {
        intent_id: intent.id,
        quote_id: quote.id,
        mode,
        provider: intent.provider,
        funding_source: fundingSource,
        requires_admin_approval: requiresAdminApproval,
        user_payment_id: userPayment?.id ?? null,
      },
      idempotencyKey: buildAuditIdempotencyKey(
        "official_fee_intent_created",
        application.id,
        intent.id,
      ),
    });

    return intent;
  }

  async approveOfficialFeePayment(
    intentId: string,
    adminId: string,
  ): Promise<OfficialFeePaymentIntent> {
    const intent = await this.getIntentOrThrow(intentId);
    if (intent.status === "succeeded") return intent;

    const application = await this.getApplicationOrThrow(intent.applicationId);
    const approvedAt = new Date().toISOString();
    const approved = await this.repository.updatePaymentIntent(intent.id, {
      status: "admin_approved",
      adminApprovedBy: adminId,
      adminApprovedAt: approvedAt,
    });

    await this.repository.updateApplicationOfficialFeeState(application.id, {
      officialFeeStatus: "company_advance_approved",
      officialFeePaymentIntentId: approved.id,
    });
    await this.repository.addApplicationEvent({
      applicationId: application.id,
      applicantId: application.applicantId,
      userId: application.userId,
      eventType: "admin_approved",
      actorType: "admin",
      actorId: adminId,
      message: "Admin approved official-fee company advance or non-dry-run payment.",
      metadata: {
        intent_id: approved.id,
        mode: approved.mode,
        provider: approved.provider,
        approved_at: approvedAt,
      },
      idempotencyKey: buildAuditIdempotencyKey("admin_approved", application.id, approved.id),
    });

    return approved;
  }

  async executeOfficialFeePayment(intentId: string): Promise<{
    intent: OfficialFeePaymentIntent;
    attempt: OfficialFeePaymentAttempt;
    receipt: OfficialFeeReceipt | null;
    reconciliation: OfficialFeeReconciliationEntry | null;
  }> {
    const initialIntent = await this.getIntentOrThrow(intentId);
    if (initialIntent.status === "succeeded") {
      throw new OfficialFeeServiceError(
        409,
        "official_fee_already_paid",
        "Official fee payment has already succeeded.",
      );
    }
    if (initialIntent.status === "in_progress") {
      throw new OfficialFeeServiceError(
        409,
        "payment_in_progress",
        "Official fee payment is already in progress.",
      );
    }

    const application = await this.getApplicationOrThrow(initialIntent.applicationId);
    const quote = await this.getQuoteForIntent(application.id, initialIntent.feeQuoteId ?? undefined);
    const provider = this.providerRegistry.getProvider(initialIntent.countryCode, initialIntent.provider);
    const { userPayment, instrument } = await this.enforceExecutionPreconditions({
      application,
      quote,
      intent: initialIntent,
      provider,
    });

    const previousAttempts = await this.repository.listPaymentAttempts(initialIntent.id);
    const attempt = await this.repository.insertPaymentAttempt({
      officialFeePaymentIntentId: initialIntent.id,
      applicationId: application.id,
      attemptNumber: previousAttempts.length + 1,
      provider: initialIntent.provider,
      mode: initialIntent.mode,
      status: "started",
      requestPayloadRedactedJson: redactToObject({
        intent_id: initialIntent.id,
        application_id: application.id,
        country_code: initialIntent.countryCode,
        amount: initialIntent.officialFeeAmount,
        currency: initialIntent.officialFeeCurrency,
        mode: initialIntent.mode,
        provider: initialIntent.provider,
        instrument_type: instrument.instrumentType,
      }),
    });

    await this.repository.updatePaymentIntent(initialIntent.id, { status: "in_progress" });
    await this.repository.updateApplicationOfficialFeeState(application.id, {
      officialFeeStatus: "official_fee_payment_in_progress",
      officialFeePaymentIntentId: initialIntent.id,
    });
    await this.repository.addApplicationEvent({
      applicationId: application.id,
      applicantId: application.applicantId,
      userId: application.userId,
      eventType: "payment_attempt_started",
      actorType: "system",
      actorId: null,
      message: "Official fee payment attempt started.",
      metadata: {
        intent_id: initialIntent.id,
        attempt_id: attempt.id,
        mode: initialIntent.mode,
        provider: initialIntent.provider,
      },
      idempotencyKey: buildAuditIdempotencyKey(
        "payment_attempt_started",
        application.id,
        attempt.id,
      ),
    });

    try {
      const result = await provider.payOfficialFee(initialIntent, {
        application,
        quote,
        instrument,
      });

      if (result.status === "succeeded") {
        const receiptInput = await provider.captureReceipt(result, initialIntent);
        const receipt = await this.repository.insertReceipt(receiptInput);
        const finishedAttempt = await this.repository.updatePaymentAttempt(attempt.id, {
          status: "succeeded",
          responsePayloadRedactedJson: result.rawResultRedacted,
          officialReceiptNumber: result.officialReceiptNumber,
          officialReceiptUrl: result.officialReceiptUrl,
          screenshotUrl: result.screenshotUrl,
          finishedAt: new Date().toISOString(),
        });
        const intent = await this.repository.updatePaymentIntent(initialIntent.id, {
          status: "succeeded",
        });

        await this.repository.updateApplicationOfficialFeeState(application.id, {
          officialFeeStatus: "official_fee_payment_succeeded",
          officialFeePaymentIntentId: intent.id,
          officialFeeReceiptId: receipt.id,
        });
        await this.repository.addApplicationEvent({
          applicationId: application.id,
          applicantId: application.applicantId,
          userId: application.userId,
          eventType: "payment_attempt_succeeded",
          actorType: "system",
          actorId: null,
          message: "Official fee dry-run payment succeeded.",
          metadata: {
            intent_id: intent.id,
            attempt_id: finishedAttempt.id,
            receipt_id: receipt.id,
            receipt_number: receipt.receiptNumber,
            dry_run_only: intent.mode === "dry_run",
          },
          idempotencyKey: buildAuditIdempotencyKey(
            "payment_attempt_succeeded",
            application.id,
            finishedAttempt.id,
          ),
        });
        await this.repository.addApplicationEvent({
          applicationId: application.id,
          applicantId: application.applicantId,
          userId: application.userId,
          eventType: "receipt_captured",
          actorType: "system",
          actorId: null,
          message: "Official fee receipt captured.",
          metadata: {
            receipt_id: receipt.id,
            receipt_number: receipt.receiptNumber,
            dry_run_only: intent.mode === "dry_run",
          },
          idempotencyKey: buildAuditIdempotencyKey("receipt_captured", application.id, receipt.id),
        });

        const reconciliation = await this.reconciliationService.createReconciliationEntry({
          application,
          intent,
          userPayment,
        });

        return {
          intent,
          attempt: finishedAttempt,
          receipt,
          reconciliation,
        };
      }

      const mappedStatus = mapProviderStatusToIntentStatus(result.status);
      const finishedAttempt = await this.repository.updatePaymentAttempt(attempt.id, {
        status: mappedStatus,
        responsePayloadRedactedJson: result.rawResultRedacted,
        errorCode: result.errorCode ?? null,
        errorMessage: result.errorMessage ?? result.message,
        officialReceiptNumber: result.officialReceiptNumber,
        officialReceiptUrl: result.officialReceiptUrl,
        screenshotUrl: result.screenshotUrl,
        finishedAt: new Date().toISOString(),
      });
      const intent = await this.repository.updatePaymentIntent(initialIntent.id, {
        status: mappedStatus,
      });
      await this.repository.updateApplicationOfficialFeeState(application.id, {
        officialFeeStatus: `official_fee_payment_${mappedStatus}`,
        officialFeePaymentIntentId: intent.id,
      });
      await this.repository.addApplicationEvent({
        applicationId: application.id,
        applicantId: application.applicantId,
        userId: application.userId,
        eventType:
          mappedStatus === "manual_review" || mappedStatus === "needs_user_action"
            ? "manual_review_required"
            : "payment_attempt_failed",
        actorType: "system",
        actorId: null,
        message: result.message,
        metadata: {
          intent_id: intent.id,
          attempt_id: finishedAttempt.id,
          status: mappedStatus,
          error_code: result.errorCode ?? null,
        },
        idempotencyKey: buildAuditIdempotencyKey(
          mappedStatus === "manual_review" || mappedStatus === "needs_user_action"
            ? "manual_review_required"
            : "payment_attempt_failed",
          application.id,
          finishedAttempt.id,
        ),
      });

      return {
        intent,
        attempt: finishedAttempt,
        receipt: null,
        reconciliation: null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const finishedAttempt = await this.repository.updatePaymentAttempt(attempt.id, {
        status: "failed",
        responsePayloadRedactedJson: redactToObject({ error: message }),
        errorCode: "provider_error",
        errorMessage: message,
        finishedAt: new Date().toISOString(),
      });
      const intent = await this.repository.updatePaymentIntent(initialIntent.id, {
        status: "failed",
      });
      await this.repository.updateApplicationOfficialFeeState(application.id, {
        officialFeeStatus: "official_fee_payment_failed",
        officialFeePaymentIntentId: intent.id,
      });
      await this.repository.addApplicationEvent({
        applicationId: application.id,
        applicantId: application.applicantId,
        userId: application.userId,
        eventType: "payment_attempt_failed",
        actorType: "system",
        actorId: null,
        message,
        metadata: {
          intent_id: intent.id,
          attempt_id: finishedAttempt.id,
          error_code: "provider_error",
        },
        idempotencyKey: buildAuditIdempotencyKey(
          "payment_attempt_failed",
          application.id,
          finishedAttempt.id,
        ),
      });
      return {
        intent,
        attempt: finishedAttempt,
        receipt: null,
        reconciliation: null,
      };
    }
  }

  async getOfficialFeePaymentStatus(applicationId: string): Promise<OfficialFeeStatusSnapshot> {
    const quote = await this.repository.getLatestFeeQuote(applicationId);
    const consent = await this.repository.getLatestConsent(applicationId);
    const intent = await this.repository.getLatestPaymentIntent(applicationId);
    const attempts = intent ? await this.repository.listPaymentAttempts(intent.id) : [];
    const receipt = intent ? await this.repository.getReceiptByIntent(intent.id) : null;
    const reconciliation = intent
      ? await this.repository.getReconciliationByIntent(intent.id)
      : null;

    return {
      quote,
      consent: consent
        ? {
          id: consent.id,
          quoteId: consent.quoteId,
          accepted: consent.accepted,
          createdAt: consent.createdAt,
        }
        : null,
      intent: intent ? sanitizeIntent(intent) : null,
      attempts,
      receipt,
      reconciliation,
      notice:
        intent?.mode === "dry_run" || receipt?.source === "dry_run"
          ? "Dry-run only. No real official fee was paid."
          : null,
    };
  }

  async retryOfficialFeePayment(intentId: string): Promise<{
    intent: OfficialFeePaymentIntent;
    attempt: OfficialFeePaymentAttempt;
    receipt: OfficialFeeReceipt | null;
    reconciliation: OfficialFeeReconciliationEntry | null;
  }> {
    const intent = await this.getIntentOrThrow(intentId);
    if (intent.status === "succeeded") {
      throw new OfficialFeeServiceError(
        409,
        "official_fee_already_paid",
        "Cannot retry a successful official fee payment.",
      );
    }
    return this.executeOfficialFeePayment(intent.id);
  }

  private async enforceExecutionPreconditions(input: {
    application: OfficialFeeApplication;
    quote: OfficialFeeQuote;
    intent: OfficialFeePaymentIntent;
    provider: OfficialFeePaymentProvider;
  }): Promise<{
    userPayment: UserPaymentEvidence | null;
    instrument: PaymentInstrumentSelection;
  }> {
    assertApplicationReady(input.application);
    assertQuoteUsable(input.quote, input.application.id);
    assertProviderSupportsMode(input.provider, input.intent.mode);
    await this.consentService.getValidConsent(input.application.id, input.quote.id);

    const userPayment = await this.repository.getPaidUserPayment(input.application.id);
    if (!userPayment && !input.intent.adminApprovedAt) {
      throw new OfficialFeeServiceError(
        409,
        "funding_or_admin_approval_required",
        "User deposit or admin-approved company advance is required before execution.",
      );
    }
    if (input.intent.requiresAdminApproval && !input.intent.adminApprovedAt) {
      throw new OfficialFeeServiceError(
        409,
        "admin_approval_required",
        "Admin approval is required before this official-fee payment can execute.",
      );
    }

    const instrument = await this.instrumentService.selectInstrumentForOfficialFee({
      application: input.application,
      quote: input.quote,
      mode: input.intent.mode,
      provider: input.intent.provider,
    });

    return { userPayment, instrument };
  }

  private async getApplicationOrThrow(applicationId: string): Promise<OfficialFeeApplication> {
    const application = await this.repository.getApplicationContext(applicationId);
    if (!application) {
      throw new OfficialFeeServiceError(
        404,
        "application_not_found",
        "Application not found.",
      );
    }
    return application;
  }

  private async getQuoteForIntent(
    applicationId: string,
    quoteId?: string,
  ): Promise<OfficialFeeQuote> {
    const quote = quoteId
      ? await this.repository.getFeeQuoteById(quoteId)
      : await this.repository.getLatestFeeQuote(applicationId);
    if (!quote) {
      throw new OfficialFeeServiceError(
        409,
        "quote_required",
        "A valid official fee quote is required.",
      );
    }
    return quote;
  }

  private async getIntentOrThrow(intentId: string): Promise<OfficialFeePaymentIntent> {
    const intent = await this.repository.getPaymentIntent(intentId);
    if (!intent) {
      throw new OfficialFeeServiceError(
        404,
        "payment_intent_not_found",
        "Official fee payment intent not found.",
      );
    }
    return intent;
  }
}

function mapProviderStatusToIntentStatus(
  status: "failed" | "pending" | "needs_user_action" | "manual_review" | "unsupported",
): OfficialFeePaymentIntent["status"] {
  if (status === "unsupported") return "unsupported";
  return status;
}

export function createOfficialFeeServices(
  repository: OfficialFeeRepository,
  providerRegistry = new OfficialFeeProviderRegistry(),
) {
  const quoteService = new OfficialFeeQuoteService(repository, providerRegistry);
  const consentService = new UserFeeConsentService(repository);
  const instrumentService = new PaymentInstrumentService(repository);
  const reconciliationService = new OfficialFeeReconciliationService(repository);
  const paymentService = new OfficialFeePaymentService(
    repository,
    providerRegistry,
    consentService,
    instrumentService,
    reconciliationService,
  );

  return {
    quoteService,
    consentService,
    instrumentService,
    reconciliationService,
    paymentService,
  };
}

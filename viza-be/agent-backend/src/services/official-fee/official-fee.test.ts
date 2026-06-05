import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createOfficialFeeServices,
  DryRunOfficialFeeProvider,
  ManualOfficialFeeProvider,
  OfficialFeeProviderRegistry,
  OfficialFeeServiceError,
  redactSensitivePayload,
  type GovernmentFeeRule,
  type InsertOfficialFeeConsentInput,
  type InsertOfficialFeePaymentAttemptInput,
  type InsertOfficialFeePaymentIntentInput,
  type InsertOfficialFeeQuoteInput,
  type InsertReconciliationEntryInput,
  type JsonObject,
  type OfficialFeeApplication,
  type OfficialFeeAuditEventInput,
  type OfficialFeeMode,
  type OfficialFeePaymentAttempt,
  type OfficialFeePaymentIntent,
  type OfficialFeePaymentProvider,
  type OfficialFeeReceipt,
  type OfficialFeeReceiptInput,
  type OfficialFeeReconciliationEntry,
  type OfficialFeeRepository,
  type OfficialFeeQuote,
  type PaymentInstrumentRecord,
  type UserPaymentEvidence,
} from "./index.js";

const APPLICATION_ID = "11111111-1111-4111-8111-111111111111";
const APPLICANT_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const ADMIN_ID = "44444444-4444-4444-8444-444444444444";

function now(): string {
  return new Date().toISOString();
}

function baseApplication(
  overrides: Partial<OfficialFeeApplication> = {},
): OfficialFeeApplication {
  return {
    id: APPLICATION_ID,
    applicantId: APPLICANT_ID,
    userId: USER_ID,
    country: "france",
    countryCode: "FR",
    visaType: "schengen_short_stay_tourism",
    visaPackageId: null,
    status: "application_ready_for_official_fee",
    paymentStatus: "paid",
    packetStatus: "ready",
    automationStatus: null,
    governmentFeeCents: 9000,
    governmentFeeCurrency: "EUR",
    ...overrides,
  };
}

class InMemoryOfficialFeeRepository implements OfficialFeeRepository {
  application: OfficialFeeApplication | null = baseApplication();
  feeRule: GovernmentFeeRule | null = null;
  userPayment: UserPaymentEvidence | null = {
    id: "55555555-5555-4555-8555-555555555555",
    amount: 100,
    currency: "EUR",
    status: "paid",
    feeType: "official_fee_deposit",
    source: "payment_records",
  };
  instruments: PaymentInstrumentRecord[] = [];
  quotes: OfficialFeeQuote[] = [];
  consents: Array<{
    id: string;
    applicationId: string;
    userId: string;
    quoteId: string;
    accepted: boolean;
    snapshot: JsonObject;
    createdAt: string | null;
  }> = [];
  intents: OfficialFeePaymentIntent[] = [];
  attempts: OfficialFeePaymentAttempt[] = [];
  receipts: OfficialFeeReceipt[] = [];
  reconciliations: OfficialFeeReconciliationEntry[] = [];
  events: OfficialFeeAuditEventInput[] = [];
  applicationState: Record<string, string | null> = {};

  async getApplicationContext(): Promise<OfficialFeeApplication | null> {
    return this.application;
  }

  async getLatestGovernmentFeeRule(): Promise<GovernmentFeeRule | null> {
    return this.feeRule;
  }

  async getLatestFeeQuote(applicationId: string): Promise<OfficialFeeQuote | null> {
    return this.quotes
      .filter((quote) => quote.applicationId === applicationId)
      .sort((a, b) => Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? ""))[0] ?? null;
  }

  async getFeeQuoteById(quoteId: string): Promise<OfficialFeeQuote | null> {
    return this.quotes.find((quote) => quote.id === quoteId) ?? null;
  }

  async insertFeeQuote(input: InsertOfficialFeeQuoteInput): Promise<OfficialFeeQuote> {
    const timestamp = now();
    const quote: OfficialFeeQuote = {
      id: randomUUID(),
      applicationId: input.applicationId,
      userId: input.userId,
      countryCode: input.countryCode,
      visaType: input.visaType,
      officialFeeAmount: input.officialFeeAmount,
      officialFeeCurrency: input.officialFeeCurrency,
      serviceFeeAmount: input.serviceFeeAmount,
      serviceFeeCurrency: input.serviceFeeCurrency,
      totalChargeAmount: input.totalChargeAmount,
      totalChargeCurrency: input.totalChargeCurrency,
      exchangeRate: input.exchangeRate,
      feeSource: input.feeSource,
      feeSourceUrl: input.feeSourceUrl,
      feeBreakdownJson: input.feeBreakdownJson,
      quoteStatus: input.quoteStatus,
      expiresAt: input.expiresAt,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.quotes.push(quote);
    return quote;
  }

  async updateFeeQuote(
    quoteId: string,
    patch: Partial<Pick<OfficialFeeQuote, "quoteStatus" | "expiresAt">>,
  ): Promise<OfficialFeeQuote> {
    const quote = await this.getRequiredQuote(quoteId);
    Object.assign(quote, patch, { updatedAt: now() });
    return quote;
  }

  async insertConsentEvent(input: InsertOfficialFeeConsentInput) {
    const consent = {
      id: randomUUID(),
      applicationId: input.application.id,
      userId: input.actorUserId,
      quoteId: input.quote.id,
      accepted: true,
      snapshot: input.consentSnapshot,
      createdAt: now(),
    };
    this.consents.push(consent);
    return consent;
  }

  async getLatestConsent(applicationId: string) {
    return this.consents
      .filter((consent) => consent.applicationId === applicationId && consent.accepted)
      .sort((a, b) => Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? ""))[0] ?? null;
  }

  async findPaymentIntentByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<OfficialFeePaymentIntent | null> {
    return this.intents.find((intent) => intent.idempotencyKey === idempotencyKey) ?? null;
  }

  async insertPaymentIntent(
    input: InsertOfficialFeePaymentIntentInput,
  ): Promise<OfficialFeePaymentIntent> {
    const timestamp = now();
    const intent: OfficialFeePaymentIntent = {
      id: randomUUID(),
      applicationId: input.applicationId,
      userId: input.userId,
      feeQuoteId: input.feeQuoteId,
      countryCode: input.countryCode,
      provider: input.provider,
      mode: input.mode,
      officialFeeAmount: input.officialFeeAmount,
      officialFeeCurrency: input.officialFeeCurrency,
      targetPayee: input.targetPayee,
      targetSite: input.targetSite,
      paymentMethodType: input.paymentMethodType,
      paymentInstrumentId: input.paymentInstrumentId,
      status: input.status as OfficialFeePaymentIntent["status"],
      idempotencyKey: input.idempotencyKey,
      requiresAdminApproval: input.requiresAdminApproval,
      adminApprovedBy: null,
      adminApprovedAt: null,
      userConsentedAt: input.userConsentedAt,
      userConsentSnapshotJson: input.userConsentSnapshotJson,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.intents.push(intent);
    return intent;
  }

  async getPaymentIntent(intentId: string): Promise<OfficialFeePaymentIntent | null> {
    return this.intents.find((intent) => intent.id === intentId) ?? null;
  }

  async getLatestPaymentIntent(applicationId: string): Promise<OfficialFeePaymentIntent | null> {
    return this.intents
      .filter((intent) => intent.applicationId === applicationId)
      .sort((a, b) => Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? ""))[0] ?? null;
  }

  async updatePaymentIntent(
    intentId: string,
    patch: Partial<
      Pick<
        OfficialFeePaymentIntent,
        | "status"
        | "paymentMethodType"
        | "paymentInstrumentId"
        | "adminApprovedBy"
        | "adminApprovedAt"
      >
    >,
  ): Promise<OfficialFeePaymentIntent> {
    const intent = await this.getRequiredIntent(intentId);
    Object.assign(intent, patch, { updatedAt: now() });
    return intent;
  }

  async listPaymentAttempts(intentId: string): Promise<OfficialFeePaymentAttempt[]> {
    return this.attempts
      .filter((attempt) => attempt.officialFeePaymentIntentId === intentId)
      .sort((a, b) => a.attemptNumber - b.attemptNumber);
  }

  async insertPaymentAttempt(
    input: InsertOfficialFeePaymentAttemptInput,
  ): Promise<OfficialFeePaymentAttempt> {
    const attempt: OfficialFeePaymentAttempt = {
      id: randomUUID(),
      officialFeePaymentIntentId: input.officialFeePaymentIntentId,
      applicationId: input.applicationId,
      attemptNumber: input.attemptNumber,
      provider: input.provider,
      mode: input.mode,
      status: input.status,
      requestPayloadRedactedJson: input.requestPayloadRedactedJson,
      responsePayloadRedactedJson: null,
      errorCode: null,
      errorMessage: null,
      officialReceiptNumber: null,
      officialReceiptUrl: null,
      screenshotUrl: null,
      startedAt: now(),
      finishedAt: null,
    };
    this.attempts.push(attempt);
    return attempt;
  }

  async updatePaymentAttempt(
    attemptId: string,
    patch: Partial<
      Pick<
        OfficialFeePaymentAttempt,
        | "status"
        | "responsePayloadRedactedJson"
        | "errorCode"
        | "errorMessage"
        | "officialReceiptNumber"
        | "officialReceiptUrl"
        | "screenshotUrl"
        | "finishedAt"
      >
    >,
  ): Promise<OfficialFeePaymentAttempt> {
    const attempt = this.attempts.find((candidate) => candidate.id === attemptId);
    if (!attempt) throw new Error("attempt not found");
    Object.assign(attempt, patch);
    return attempt;
  }

  async insertReceipt(input: OfficialFeeReceiptInput): Promise<OfficialFeeReceipt> {
    const receipt: OfficialFeeReceipt = {
      id: randomUUID(),
      applicationId: input.applicationId,
      userId: input.userId,
      officialFeePaymentIntentId: input.officialFeePaymentIntentId,
      countryCode: input.countryCode,
      receiptNumber: input.receiptNumber,
      receiptUrl: input.receiptUrl,
      receiptFileUrl: input.receiptFileUrl,
      amount: input.amount,
      currency: input.currency,
      paidAt: input.paidAt,
      source: input.source,
      rawReceiptRedactedJson: input.rawReceiptRedactedJson,
      createdAt: now(),
    };
    this.receipts.push(receipt);
    return receipt;
  }

  async getReceiptByIntent(intentId: string): Promise<OfficialFeeReceipt | null> {
    return this.receipts.find((receipt) => receipt.officialFeePaymentIntentId === intentId) ?? null;
  }

  async getPaidUserPayment(): Promise<UserPaymentEvidence | null> {
    return this.userPayment;
  }

  async selectPaymentInstrument(): Promise<PaymentInstrumentRecord | null> {
    return this.instruments[0] ?? null;
  }

  async insertReconciliationEntry(
    input: InsertReconciliationEntryInput,
  ): Promise<OfficialFeeReconciliationEntry> {
    const timestamp = now();
    const entry: OfficialFeeReconciliationEntry = {
      id: randomUUID(),
      applicationId: input.applicationId,
      userId: input.userId,
      officialFeePaymentIntentId: input.officialFeePaymentIntentId,
      userPaymentId: input.userPaymentId,
      officialFeeAmount: input.officialFeeAmount,
      officialFeeCurrency: input.officialFeeCurrency,
      userCollectedAmount: input.userCollectedAmount,
      userCollectedCurrency: input.userCollectedCurrency,
      fxRate: input.fxRate,
      balanceDelta: input.balanceDelta,
      reconciliationStatus: input.reconciliationStatus,
      notes: input.notes,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.reconciliations.push(entry);
    return entry;
  }

  async getReconciliationByIntent(
    intentId: string,
  ): Promise<OfficialFeeReconciliationEntry | null> {
    return this.reconciliations.find((entry) => entry.officialFeePaymentIntentId === intentId) ?? null;
  }

  async updateApplicationOfficialFeeState(
    _applicationId: string,
    patch: {
      officialFeeStatus?: string;
      officialFeeQuoteId?: string | null;
      officialFeePaymentIntentId?: string | null;
      officialFeeReceiptId?: string | null;
      officialFeeReconciliationStatus?: string | null;
    },
  ): Promise<void> {
    if (patch.officialFeeStatus !== undefined) {
      this.applicationState.officialFeeStatus = patch.officialFeeStatus;
    }
    if (patch.officialFeeQuoteId !== undefined) {
      this.applicationState.officialFeeQuoteId = patch.officialFeeQuoteId;
    }
    if (patch.officialFeePaymentIntentId !== undefined) {
      this.applicationState.officialFeePaymentIntentId = patch.officialFeePaymentIntentId;
    }
    if (patch.officialFeeReceiptId !== undefined) {
      this.applicationState.officialFeeReceiptId = patch.officialFeeReceiptId;
    }
    if (patch.officialFeeReconciliationStatus !== undefined) {
      this.applicationState.officialFeeReconciliationStatus =
        patch.officialFeeReconciliationStatus;
    }
  }

  async addApplicationEvent(input: OfficialFeeAuditEventInput): Promise<void> {
    this.events.push(input);
  }

  private async getRequiredQuote(quoteId: string): Promise<OfficialFeeQuote> {
    const quote = await this.getFeeQuoteById(quoteId);
    if (!quote) throw new Error("quote not found");
    return quote;
  }

  private async getRequiredIntent(intentId: string): Promise<OfficialFeePaymentIntent> {
    const intent = await this.getPaymentIntent(intentId);
    if (!intent) throw new Error("intent not found");
    return intent;
  }
}

class FailingProvider extends DryRunOfficialFeeProvider {
  constructor() {
    super({ countryCode: "FR", providerName: "failing_provider" });
  }

  override async payOfficialFee(intent: OfficialFeePaymentIntent) {
    return {
      status: "failed" as const,
      mode: intent.mode,
      countryCode: intent.countryCode,
      officialReceiptNumber: null,
      officialReceiptUrl: null,
      screenshotUrl: null,
      message: "Dry-run provider failure.",
      rawResultRedacted: { failed: true },
      errorCode: "dry_run_failure",
      errorMessage: "Dry-run provider failure.",
    };
  }
}

function servicesWith(
  repository: InMemoryOfficialFeeRepository,
  providers?: OfficialFeePaymentProvider[],
) {
  return createOfficialFeeServices(
    repository,
    providers ? new OfficialFeeProviderRegistry(providers) : new OfficialFeeProviderRegistry(),
  );
}

async function quoteAndConsent(repository: InMemoryOfficialFeeRepository) {
  const services = servicesWith(repository);
  const quote = await services.quoteService.createFeeQuote(APPLICATION_ID);
  await services.consentService.recordConsent(APPLICATION_ID, quote.id, {
    actorUserId: USER_ID,
    consentSnapshot: {
      checked: true,
      authorization: "VIZA may pay this official fee on my behalf.",
    },
  });
  return { services, quote };
}

async function expectServiceError(
  promise: Promise<unknown>,
  code: string,
): Promise<void> {
  await expect(promise).rejects.toMatchObject({
    name: "OfficialFeeServiceError",
    code,
  } satisfies Partial<OfficialFeeServiceError>);
}

describe("official fee services", () => {
  it("creates a quote and reuses a valid quote", async () => {
    const repository = new InMemoryOfficialFeeRepository();
    const services = servicesWith(repository);

    const quote = await services.quoteService.createFeeQuote(APPLICATION_ID);
    const reused = await services.quoteService.createFeeQuote(APPLICATION_ID);

    expect(quote.id).toBe(reused.id);
    expect(quote.countryCode).toBe("FR");
    expect(quote.officialFeeAmount).toBe(90);
    expect(quote.officialFeeCurrency).toBe("EUR");
    expect(repository.applicationState.officialFeeStatus).toBe("fee_quote_created");
  });

  it("rejects unsupported countries cleanly", async () => {
    const repository = new InMemoryOfficialFeeRepository();
    repository.application = baseApplication({ country: "unsupported", countryCode: "ZZZ" });
    const services = servicesWith(repository);

    await expectServiceError(
      services.quoteService.createFeeQuote(APPLICATION_ID),
      "unsupported_country",
    );
  });

  it("records consent and blocks intent creation without consent", async () => {
    const repository = new InMemoryOfficialFeeRepository();
    const services = servicesWith(repository);
    const quote = await services.quoteService.createFeeQuote(APPLICATION_ID);

    await expectServiceError(
      services.paymentService.createOfficialFeePaymentIntent(APPLICATION_ID, {
        quoteId: quote.id,
      }),
      "user_consent_required",
    );

    await services.consentService.recordConsent(APPLICATION_ID, quote.id, {
      actorUserId: USER_ID,
      consentSnapshot: { accepted: true },
    });

    await expect(services.consentService.hasValidConsent(APPLICATION_ID, quote.id))
      .resolves
      .toBe(true);
  });

  it("requires user funding or admin-approved company advance", async () => {
    const repository = new InMemoryOfficialFeeRepository();
    repository.userPayment = null;
    const { services, quote } = await quoteAndConsent(repository);

    await expectServiceError(
      services.paymentService.createOfficialFeePaymentIntent(APPLICATION_ID, {
        quoteId: quote.id,
      }),
      "user_fee_not_collected",
    );

    const intent = await services.paymentService.createOfficialFeePaymentIntent(APPLICATION_ID, {
      quoteId: quote.id,
      fundingSource: "company_advance",
    });

    expect(intent.requiresAdminApproval).toBe(true);
    await expectServiceError(
      services.paymentService.executeOfficialFeePayment(intent.id),
      "funding_or_admin_approval_required",
    );
  });

  it("executes dry-run payment end to end with receipt and reconciliation", async () => {
    const repository = new InMemoryOfficialFeeRepository();
    const { services, quote } = await quoteAndConsent(repository);

    const intent = await services.paymentService.createOfficialFeePaymentIntent(APPLICATION_ID, {
      quoteId: quote.id,
      mode: "dry_run",
    });
    const result = await services.paymentService.executeOfficialFeePayment(intent.id);

    expect(result.intent.status).toBe("succeeded");
    expect(result.attempt.status).toBe("succeeded");
    expect(result.receipt?.receiptNumber).toMatch(/^DRYRUN-FR-/);
    expect(result.reconciliation?.reconciliationStatus).toBe("reconciled");
    expect(repository.applicationState.officialFeeStatus).toBe("official_fee_payment_succeeded");
    expect(repository.events.map((event) => event.eventType)).toContain("receipt_captured");
  });

  it("does not duplicate a successful official fee payment", async () => {
    const repository = new InMemoryOfficialFeeRepository();
    const { services, quote } = await quoteAndConsent(repository);
    const intent = await services.paymentService.createOfficialFeePaymentIntent(APPLICATION_ID, {
      quoteId: quote.id,
    });

    await services.paymentService.executeOfficialFeePayment(intent.id);
    await expectServiceError(
      services.paymentService.retryOfficialFeePayment(intent.id),
      "official_fee_already_paid",
    );
  });

  it("stores failed attempts and allows retry", async () => {
    const repository = new InMemoryOfficialFeeRepository();
    const services = servicesWith(repository, [new FailingProvider()]);
    const quote = await services.quoteService.createFeeQuote(APPLICATION_ID);
    await services.consentService.recordConsent(APPLICATION_ID, quote.id, {
      actorUserId: USER_ID,
      consentSnapshot: { accepted: true },
    });
    const intent = await services.paymentService.createOfficialFeePaymentIntent(APPLICATION_ID, {
      quoteId: quote.id,
      provider: "failing_provider",
    });

    const first = await services.paymentService.executeOfficialFeePayment(intent.id);
    const second = await services.paymentService.retryOfficialFeePayment(intent.id);

    expect(first.intent.status).toBe("failed");
    expect(second.intent.status).toBe("failed");
    expect(repository.attempts).toHaveLength(2);
    expect(repository.receipts).toHaveLength(0);
  });

  it("marks manual-mode payments for manual review after approval", async () => {
    const repository = new InMemoryOfficialFeeRepository();
    const services = servicesWith(repository, [new ManualOfficialFeeProvider("FR")]);
    const quote = await services.quoteService.createFeeQuote(APPLICATION_ID);
    await services.consentService.recordConsent(APPLICATION_ID, quote.id, {
      actorUserId: USER_ID,
      consentSnapshot: { accepted: true },
    });
    const intent = await services.paymentService.createOfficialFeePaymentIntent(APPLICATION_ID, {
      quoteId: quote.id,
      mode: "manual",
    });

    await services.paymentService.approveOfficialFeePayment(intent.id, ADMIN_ID);
    const result = await services.paymentService.executeOfficialFeePayment(intent.id);

    expect(result.intent.status).toBe("manual_review");
    expect(result.receipt).toBeNull();
    expect(repository.applicationState.officialFeeStatus).toBe("official_fee_payment_manual_review");
  });

  it("redacts sensitive payment and auth fields", () => {
    const redacted = redactSensitivePayload({
      card_number: "4111111111111111",
      cvv: "123",
      nested: {
        access_token: "secret-token",
        last4: "1111",
      },
    });

    expect(redacted).toEqual({
      card_number: "[REDACTED]",
      cvv: "[REDACTED]",
      nested: {
        access_token: "[REDACTED]",
        last4: "1111",
      },
    });
  });

  it("does not enable live payment without the live-mode flag", async () => {
    const repository = new InMemoryOfficialFeeRepository();
    const { services, quote } = await quoteAndConsent(repository);

    await expectServiceError(
      services.paymentService.createOfficialFeePaymentIntent(APPLICATION_ID, {
        quoteId: quote.id,
        mode: "live" as OfficialFeeMode,
      }),
      "live_mode_disabled",
    );
  });
});

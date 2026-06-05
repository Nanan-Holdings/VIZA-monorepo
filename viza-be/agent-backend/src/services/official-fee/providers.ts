import type {
  FeeDiscoveryResult,
  GovernmentFeeRule,
  OfficialFeeApplication,
  OfficialFeeMode,
  OfficialFeePaymentIntent,
  OfficialFeePaymentProvider,
  OfficialFeePaymentResult,
  OfficialFeeQuote,
  OfficialFeeReceiptInput,
  PaymentInstrumentSelection,
  PreparedOfficialFeePayment,
} from "./types.js";

function amountFromMinorUnits(cents: number): number {
  return Math.round(cents) / 100;
}

function getDryRunPlaceholderAmount(): number {
  const configured = Number(process.env.OFFICIAL_FEE_DRY_RUN_PLACEHOLDER_AMOUNT ?? "1");
  return Number.isFinite(configured) && configured >= 0 ? configured : 1;
}

function buildFeeDiscoveryFromRule(
  application: OfficialFeeApplication,
  feeRule: GovernmentFeeRule | null,
): Pick<
  FeeDiscoveryResult,
  "officialFeeAmount" | "officialFeeCurrency" | "feeSource" | "feeSourceUrl" | "feeBreakdown"
> {
  if (application.governmentFeeCents !== null && application.governmentFeeCents >= 0) {
    return {
      officialFeeAmount: amountFromMinorUnits(application.governmentFeeCents),
      officialFeeCurrency: application.governmentFeeCurrency ?? "USD",
      feeSource: "applications.government_fee_cents",
      feeSourceUrl: null,
      feeBreakdown: {
        source: "application_snapshot",
        dry_run_only: true,
      },
    };
  }

  if (feeRule) {
    return {
      officialFeeAmount: amountFromMinorUnits(feeRule.amountCents),
      officialFeeCurrency: feeRule.currency,
      feeSource: "government_fee_rules",
      feeSourceUrl: feeRule.sourceUrl,
      feeBreakdown: {
        source: "government_fee_rules",
        rule_id: feeRule.id,
        mode: feeRule.mode,
        metadata: feeRule.metadata ?? {},
      },
    };
  }

  return {
    officialFeeAmount: getDryRunPlaceholderAmount(),
    officialFeeCurrency: application.governmentFeeCurrency ?? "USD",
    feeSource: "dry_run_placeholder",
    feeSourceUrl: null,
    feeBreakdown: {
      source: "dry_run_placeholder",
      dry_run_only: true,
      warning: "Placeholder fee for lifecycle testing. Do not treat as an official requirement.",
    },
  };
}

export class DryRunOfficialFeeProvider implements OfficialFeePaymentProvider {
  public readonly countryCode: string;
  public readonly providerName: string;
  public readonly supportsDryRun = true;
  public readonly supportsSandbox = false;
  public readonly supportsLive = false;

  private readonly targetPayee: string | null;
  private readonly targetSite: string | null;

  constructor(options?: {
    countryCode?: string;
    providerName?: string;
    targetPayee?: string | null;
    targetSite?: string | null;
  }) {
    this.countryCode = options?.countryCode ?? "*";
    this.providerName = options?.providerName ?? "dry_run_official_fee";
    this.targetPayee = options?.targetPayee ?? null;
    this.targetSite = options?.targetSite ?? null;
  }

  async discoverFee(
    application: OfficialFeeApplication,
    context: { feeRule: GovernmentFeeRule | null; mode: OfficialFeeMode },
  ): Promise<FeeDiscoveryResult> {
    const fee = buildFeeDiscoveryFromRule(application, context.feeRule);
    return {
      status: "discovered",
      countryCode: application.countryCode,
      targetPayee: this.targetPayee ?? application.countryCode,
      targetSite: this.targetSite,
      ...fee,
    };
  }

  async preparePayment(
    _application: OfficialFeeApplication,
    _quote: OfficialFeeQuote,
  ): Promise<PreparedOfficialFeePayment> {
    return {
      providerName: this.providerName,
      targetPayee: this.targetPayee,
      targetSite: this.targetSite,
      paymentMethodType: "manual",
    };
  }

  async payOfficialFee(
    intent: OfficialFeePaymentIntent,
    options: {
      application: OfficialFeeApplication;
      quote: OfficialFeeQuote;
      instrument: PaymentInstrumentSelection;
    },
  ): Promise<OfficialFeePaymentResult> {
    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    const receiptNumber = `DRYRUN-${intent.countryCode}-${intent.applicationId.slice(0, 8)}-${timestamp}`;
    return {
      status: "succeeded",
      mode: intent.mode,
      countryCode: intent.countryCode,
      officialReceiptNumber: receiptNumber,
      officialReceiptUrl: null,
      screenshotUrl: null,
      message: "Dry-run official fee payment completed. No real payment was made.",
      rawResultRedacted: {
        dry_run_only: true,
        receipt_number: receiptNumber,
        provider: this.providerName,
        instrument_type: options.instrument.instrumentType,
        amount: intent.officialFeeAmount,
        currency: intent.officialFeeCurrency,
      },
    };
  }

  async captureReceipt(
    result: OfficialFeePaymentResult,
    intent: OfficialFeePaymentIntent,
  ): Promise<OfficialFeeReceiptInput> {
    return {
      applicationId: intent.applicationId,
      userId: intent.userId,
      officialFeePaymentIntentId: intent.id,
      countryCode: intent.countryCode,
      receiptNumber: result.officialReceiptNumber,
      receiptUrl: result.officialReceiptUrl,
      receiptFileUrl: null,
      amount: intent.officialFeeAmount,
      currency: intent.officialFeeCurrency,
      paidAt: new Date().toISOString(),
      source: "dry_run",
      rawReceiptRedactedJson: result.rawResultRedacted,
    };
  }
}

export class ManualOfficialFeeProvider extends DryRunOfficialFeeProvider {
  constructor(countryCode = "*") {
    super({
      countryCode,
      providerName: "manual_official_fee",
      targetPayee: "manual_operator",
      targetSite: null,
    });
  }

  override async payOfficialFee(
    intent: OfficialFeePaymentIntent,
  ): Promise<OfficialFeePaymentResult> {
    return {
      status: "manual_review",
      mode: intent.mode,
      countryCode: intent.countryCode,
      officialReceiptNumber: null,
      officialReceiptUrl: null,
      screenshotUrl: null,
      message: "Manual official-fee payment task created. No payment was made by the backend.",
      rawResultRedacted: {
        manual_review_required: true,
        provider: this.providerName,
        amount: intent.officialFeeAmount,
        currency: intent.officialFeeCurrency,
      },
    };
  }
}

export class BrowserAutomationOfficialFeeProvider extends DryRunOfficialFeeProvider {
  constructor(countryCode = "*") {
    super({
      countryCode,
      providerName: "browser_automation_official_fee_experimental",
    });
  }

  override async payOfficialFee(
    intent: OfficialFeePaymentIntent,
  ): Promise<OfficialFeePaymentResult> {
    return {
      status: "manual_review",
      mode: intent.mode,
      countryCode: intent.countryCode,
      officialReceiptNumber: null,
      officialReceiptUrl: null,
      screenshotUrl: null,
      message:
        "Browser automation provider is experimental and stops before irreversible payment.",
      rawResultRedacted: {
        manual_review_required: true,
        provider: this.providerName,
        stopped_before_payment: true,
      },
    };
  }
}

export class VirtualCardOfficialFeeProvider extends DryRunOfficialFeeProvider {
  constructor(countryCode = "*") {
    super({
      countryCode,
      providerName: "virtual_card_official_fee_experimental",
    });
  }

  override async payOfficialFee(
    intent: OfficialFeePaymentIntent,
  ): Promise<OfficialFeePaymentResult> {
    return {
      status: "unsupported",
      mode: intent.mode,
      countryCode: intent.countryCode,
      officialReceiptNumber: null,
      officialReceiptUrl: null,
      screenshotUrl: null,
      message:
        "Virtual-card live payment is not enabled. Provider/account/compliance approval is required.",
      rawResultRedacted: {
        unsupported: true,
        provider: this.providerName,
        live_enabled: false,
      },
      errorCode: "virtual_card_not_enabled",
      errorMessage: "Virtual-card official-fee payment is not enabled.",
    };
  }
}

class CountryDryRunProvider extends DryRunOfficialFeeProvider {
  constructor(input: {
    countryCode: string;
    providerName: string;
    targetPayee: string;
    targetSite: string | null;
  }) {
    super(input);
  }
}

export class OfficialFeeProviderRegistry {
  private readonly providersByCountry = new Map<string, OfficialFeePaymentProvider>();
  private readonly namedProviders = new Map<string, OfficialFeePaymentProvider>();
  private readonly fallbackProvider = new DryRunOfficialFeeProvider();

  constructor(providers: OfficialFeePaymentProvider[] = defaultOfficialFeeProviders()) {
    for (const provider of providers) {
      this.register(provider);
    }
    this.register(this.fallbackProvider);
  }

  register(provider: OfficialFeePaymentProvider): void {
    this.namedProviders.set(provider.providerName, provider);
    if (provider.countryCode !== "*") {
      this.providersByCountry.set(provider.countryCode, provider);
    }
  }

  getProvider(countryCode: string, providerName?: string | null): OfficialFeePaymentProvider {
    if (providerName) {
      return this.namedProviders.get(providerName) ?? this.fallbackProvider;
    }
    return this.providersByCountry.get(countryCode) ?? this.fallbackProvider;
  }

  hasCountrySupport(countryCode: string): boolean {
    return this.providersByCountry.has(countryCode) || countryCode.length === 2;
  }
}

export function defaultOfficialFeeProviders(): OfficialFeePaymentProvider[] {
  return [
    new CountryDryRunProvider({
      countryCode: "US",
      providerName: "usa_official_fee_dry_run",
      targetPayee: "United States visa appointment/payment system",
      targetSite: "https://ais.usvisa-info.com/",
    }),
    new CountryDryRunProvider({
      countryCode: "FR",
      providerName: "france_official_fee_dry_run",
      targetPayee: "France-Visas / visa application center",
      targetSite: "https://france-visas.gouv.fr/",
    }),
    new CountryDryRunProvider({
      countryCode: "GB",
      providerName: "uk_official_fee_dry_run",
      targetPayee: "UK Visas and Immigration",
      targetSite: "https://www.gov.uk/",
    }),
    new CountryDryRunProvider({
      countryCode: "CA",
      providerName: "canada_official_fee_dry_run",
      targetPayee: "Immigration, Refugees and Citizenship Canada",
      targetSite: "https://www.canada.ca/",
    }),
    new CountryDryRunProvider({
      countryCode: "AU",
      providerName: "australia_official_fee_dry_run",
      targetPayee: "Australian Department of Home Affairs",
      targetSite: "https://immi.homeaffairs.gov.au/",
    }),
    new CountryDryRunProvider({
      countryCode: "JP",
      providerName: "japan_official_fee_dry_run",
      targetPayee: "Japan eVISA / consular fee desk",
      targetSite: "https://www.evisa.mofa.go.jp/",
    }),
    new ManualOfficialFeeProvider(),
    new BrowserAutomationOfficialFeeProvider(),
    new VirtualCardOfficialFeeProvider(),
  ];
}

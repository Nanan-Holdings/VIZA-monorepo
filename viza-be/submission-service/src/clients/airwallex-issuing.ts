/**
 * Low-level Airwallex Issuing client (PAY-004).
 *
 * Mints non-personalized, single-use COMMERCIAL VIRTUAL cards so VIZA can pay
 * each applicant's government visa fee from a fresh card scoped to the exact
 * amount and a short active window. This caps the blast radius of a
 * portal compromise to one applicant + one fee, and stops the "same card
 * across many government portals" pattern that gets cards frozen.
 *
 * Native `fetch` (Node 18+), no extra deps. Mirrors the env-gated factory
 * pattern of the other API clients (see src/captcha/two-captcha.ts): the
 * factory returns `null` when the integration is disabled so callers stay a
 * no-op until AIRWALLEX_ISSUING_ENABLED is flipped on.
 *
 * PCI: this client returns raw PAN/CVV from `getSensitiveDetails`. Callers
 * must never log or persist those values. The durable managed-card adapter
 * keeps them in worker memory only (see
 * src/issuing/airwallex-card-provider.ts). This file itself logs nothing.
 */

// ---------------------------------------------------------------------------
// Config + types
// ---------------------------------------------------------------------------

export interface AirwallexConfig {
  /** https://api.airwallex.com (prod) | https://api-demo.airwallex.com (sandbox). */
  baseUrl: string;
  clientId: string;
  apiKey: string;
  /** Explicit currency capabilities and major-unit per-card ceilings. */
  currencyMaximums: Readonly<Record<string, number>>;
  /** Omit to use the card program configured on the Airwallex account. */
  programType?: "PREPAID" | "DEBIT" | "CREDIT" | "DEFERRED_DEBIT";
  /** Omit unless Airwallex has explicitly enabled this subtype for the account. */
  programSubType?: "GOOD_FUNDS_CREDIT" | "B2B_TRAVEL";
}

export interface CreateApplicationFeeCardInput {
  applicationId: string;
  allocationId: string;
  officialFeePaymentIntentId: string;
  attemptNumber: number;
  /** Must equal the deterministic application/allocation-scoped key. */
  requestId: string;
  cardholderId: string;
  createdBy: string;
  /** e.g. "USD" — the portal's billing currency. */
  currency: string;
  /** Exact allocated official fee in major units; no percentage buffer. */
  exactAmount: number;
  /** ISO 8601 with a +0000 style offset. */
  activeFrom: string;
  activeTo: string;
  /** Omit to allow all merchant categories (see doc §8.4 — MCC lock causes false declines). */
  allowedMerchantCategories?: string[];
}

export interface CreatedCard {
  cardId: string;
  cardStatus: string;
  maskedNumber: string;
}

export interface SensitiveCardDetails {
  pan: string;
  cvv: string;
  /** "01".."12". */
  expiryMonth: string;
  /** Four digits, e.g. "2026". */
  expiryYear: string;
}

export interface AirwallexIssuingSecurityConfig {
  remoteAuthEnabled: boolean;
  remoteAuthDefaultAction: "AUTHORIZED" | "DECLINED" | null;
  remoteAuthVersion: number | null;
}

/** Thrown when the integration is enabled but required credentials are absent. */
export class AirwallexConfigError extends Error {
  readonly code = "AIRWALLEX_CONFIG_ERROR" as const;
  constructor(message = "Airwallex issuing configuration is incomplete or invalid") {
    super(message);
    this.name = "AirwallexConfigError";
  }
}

export class AirwallexIssuanceGuardError extends Error {
  readonly code = "AIRWALLEX_ISSUANCE_GUARD" as const;
  constructor(message: string) {
    super(message);
    this.name = "AirwallexIssuanceGuardError";
  }
}

const IDENTIFIER_PATTERN = /^[0-9a-z][0-9a-z-]{7,127}$/i;

function exactRequestId(input: CreateApplicationFeeCardInput): string {
  return `viza-airwallex-${input.applicationId}-${input.allocationId}-${input.attemptNumber}`;
}

function assertApplicationFeeCardInput(
  input: CreateApplicationFeeCardInput,
  currencyMaximums: Readonly<Record<string, number>>,
): void {
  for (const [label, value] of [
    ["application", input.applicationId],
    ["allocation", input.allocationId],
    ["official-fee payment intent", input.officialFeePaymentIntentId],
  ] as const) {
    if (!IDENTIFIER_PATTERN.test(value)) {
      throw new AirwallexIssuanceGuardError(`${label} id is missing or invalid`);
    }
  }
  if (!Number.isSafeInteger(input.attemptNumber) || input.attemptNumber <= 0) {
    throw new AirwallexIssuanceGuardError("Airwallex attempt number must be a positive integer");
  }
  if (input.requestId !== exactRequestId(input)) {
    throw new AirwallexIssuanceGuardError(
      "Airwallex request id is not bound to the application, allocation, and attempt",
    );
  }
  const currency = input.currency.trim().toUpperCase();
  const maximum = currencyMaximums[currency];
  if (!maximum) {
    throw new AirwallexIssuanceGuardError(`Airwallex currency ${currency || "(empty)"} is not allowlisted`);
  }
  const amountCents = Math.round(input.exactAmount * 100);
  if (
    !Number.isFinite(input.exactAmount) ||
    input.exactAmount <= 0 ||
    !Number.isSafeInteger(amountCents) ||
    Math.abs(amountCents / 100 - input.exactAmount) > Number.EPSILON
  ) {
    throw new AirwallexIssuanceGuardError(
      "Airwallex exact official-fee amount must be positive with at most two decimal places",
    );
  }
  if (input.exactAmount > maximum) {
    throw new AirwallexIssuanceGuardError(
      `Airwallex exact official-fee amount exceeds the configured ${currency} per-card maximum`,
    );
  }
  if (!input.cardholderId.trim() || !input.createdBy.trim()) {
    throw new AirwallexIssuanceGuardError("Airwallex cardholder and creator are required");
  }
  const activeFrom = Date.parse(input.activeFrom);
  const activeTo = Date.parse(input.activeTo);
  if (
    !Number.isFinite(activeFrom) ||
    !Number.isFinite(activeTo) ||
    activeTo <= activeFrom ||
    activeTo - activeFrom > 4 * 60 * 60 * 1_000
  ) {
    throw new AirwallexIssuanceGuardError(
      "Airwallex application-fee card active window must be positive and at most four hours",
    );
  }
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class AirwallexIssuingClient {
  private token: string | null = null;
  private tokenExpiresAt = 0;

  constructor(
    private cfg: AirwallexConfig,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  private async authHeader(): Promise<Record<string, string>> {
    const now = Date.now();
    if (this.token && now < this.tokenExpiresAt - 60_000) {
      return { Authorization: `Bearer ${this.token}` };
    }
    const res = await this.fetchImpl(`${this.cfg.baseUrl}/api/v1/authentication/login`, {
      method: "POST",
      headers: {
        "x-client-id": this.cfg.clientId,
        "x-api-key": this.cfg.apiKey,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(`Airwallex auth failed: ${res.status} ${await res.text()}`);
    }
    const body = (await res.json()) as { token: string };
    this.token = body.token;
    // Token lives ~30 min; refresh a minute early.
    this.tokenExpiresAt = now + 29 * 60_000;
    return { Authorization: `Bearer ${this.token}` };
  }

  private async post<T>(path: string, payload: unknown): Promise<T> {
    const res = await this.fetchImpl(`${this.cfg.baseUrl}${path}`, {
      method: "POST",
      headers: { ...(await this.authHeader()), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`Airwallex POST ${path} failed: ${res.status} ${await res.text()}`);
    }
    return (await res.json()) as T;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await this.fetchImpl(`${this.cfg.baseUrl}${path}`, {
      method: "GET",
      headers: await this.authHeader(),
    });
    if (!res.ok) {
      throw new Error(`Airwallex GET ${path} failed: ${res.status} ${await res.text()}`);
    }
    return (await res.json()) as T;
  }

  /** Read-only pre-issuance safety gate; deliberately omits any shared secret. */
  async getIssuingConfig(): Promise<AirwallexIssuingSecurityConfig> {
    const config = await this.get<{
      remote_auth_settings?: {
        enabled?: unknown;
        default_action?: unknown;
        version?: unknown;
      } | null;
    }>("/api/v1/issuing/config");
    const action = config.remote_auth_settings?.default_action;
    return {
      remoteAuthEnabled: config.remote_auth_settings?.enabled === true,
      remoteAuthDefaultAction:
        action === "AUTHORIZED" || action === "DECLINED" ? action : null,
      remoteAuthVersion:
        typeof config.remote_auth_settings?.version === "number"
          ? config.remote_auth_settings.version
          : null,
    };
  }

  /** The sole card-creation API: one exact application/allocation official fee. */
  async createApplicationFeeCard(input: CreateApplicationFeeCardInput): Promise<CreatedCard> {
    assertApplicationFeeCardInput(input, this.cfg.currencyMaximums);
    const currency = input.currency.trim().toUpperCase();
    const body = await this.post<{
      card_id: string;
      card_status: string;
      card_number: string;
    }>("/api/v1/issuing/cards/create", {
      request_id: input.requestId,
      created_by: input.createdBy,
      cardholder_id: input.cardholderId,
      is_personalized: false,
      form_factor: "VIRTUAL",
      // program.type / sub_type are account-specific. Omitting them makes
      // Airwallex use the program configured for this account.
      program: {
        purpose: "COMMERCIAL",
        ...(this.cfg.programType ? { type: this.cfg.programType } : {}),
        ...(this.cfg.programSubType ? { sub_type: this.cfg.programSubType } : {}),
      },
      authorization_controls: {
        allowed_transaction_count: "SINGLE",
        allowed_currencies: [currency],
        active_from: input.activeFrom,
        active_to: input.activeTo,
        ...(input.allowedMerchantCategories
          ? { allowed_merchant_categories: input.allowedMerchantCategories }
          : {}),
        transaction_limits: {
          currency,
          limits: [
            { amount: input.exactAmount, interval: "PER_TRANSACTION" },
            { amount: input.exactAmount, interval: "ALL_TIME" },
          ],
        },
      },
    });
    return {
      cardId: body.card_id,
      cardStatus: body.card_status,
      maskedNumber: body.card_number,
    };
  }

  /** @deprecated Disabled permanently; use createApplicationFeeCard. */
  async createCard(_input: unknown): Promise<CreatedCard> {
    throw new AirwallexIssuanceGuardError(
      "General-purpose Airwallex card creation is disabled; an application-scoped official fee is required",
    );
  }

  async getSensitiveDetails(cardId: string): Promise<SensitiveCardDetails> {
    const d = await this.get<{
      card_number: string;
      cvv: string;
      expiry_month: string;
      expiry_year: string;
    }>(`/api/v1/issuing/cards/${encodeURIComponent(cardId)}/details`);
    return {
      pan: d.card_number,
      cvv: d.cvv,
      expiryMonth: d.expiry_month,
      expiryYear: d.expiry_year,
    };
  }

  async freezeCard(cardId: string): Promise<void> {
    const path = `/api/v1/issuing/cards/${encodeURIComponent(cardId)}`;
    const terminalStatuses = new Set([
      "INACTIVE",
      "CLOSED",
      "EXPIRED",
      "LOST",
      "STOLEN",
      "BLOCKED",
    ]);
    const current = await this.get<{ card_status?: string }>(path);
    if (current.card_status && terminalStatuses.has(current.card_status)) return;

    try {
      await this.post(`${path}/update`, { card_status: "INACTIVE" });
    } catch (error) {
      // A successful SINGLE-use authorization may close the card between the
      // status read and update. Treat that race as already safely finalized.
      try {
        const refreshed = await this.get<{ card_status?: string }>(path);
        if (refreshed.card_status && terminalStatuses.has(refreshed.card_status)) return;
      } catch {
        // Preserve the update failure below; it is the actionable cleanup error.
      }
      throw error;
    }
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function envEnabled(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test((value ?? "").trim());
}

export function readAirwallexCurrencyMaximums(
  env: NodeJS.ProcessEnv = process.env,
): Readonly<Record<string, number>> {
  const raw = env.AIRWALLEX_ISSUING_SUPPORTED_CURRENCIES?.trim();
  if (!raw) {
    throw new AirwallexConfigError(
      "AIRWALLEX_ISSUING_SUPPORTED_CURRENCIES is required when Airwallex issuing is enabled",
    );
  }
  const currencies = [...new Set(raw.split(",").map((value) => value.trim().toUpperCase()).filter(Boolean))];
  if (currencies.length === 0 || currencies.some((value) => !/^[A-Z]{3}$/.test(value))) {
    throw new AirwallexConfigError(
      "AIRWALLEX_ISSUING_SUPPORTED_CURRENCIES must contain ISO 4217 currency codes",
    );
  }
  const maximums: Record<string, number> = {};
  for (const currency of currencies) {
    const name = `AIRWALLEX_ISSUING_MAX_CARD_AMOUNT_${currency}`;
    const maximum = Number(env[name]);
    if (!Number.isFinite(maximum) || maximum <= 0 || Math.round(maximum * 100) / 100 !== maximum) {
      throw new AirwallexConfigError(`${name} must be a positive major-unit amount with at most two decimals`);
    }
    maximums[currency] = maximum;
  }
  return Object.freeze(maximums);
}

/**
 * Build the client, or return `null` when AIRWALLEX_ISSUING_ENABLED is off.
 * Managed-card callers fail closed or select another configured issuer; they
 * never fall back to applicant-vault card material. Throws
 * AirwallexConfigError when enabled but credentials are missing.
 */
export function createAirwallexIssuingClient(): AirwallexIssuingClient | null {
  if (!envEnabled(process.env.AIRWALLEX_ISSUING_ENABLED)) return null;
  const clientId = process.env.AIRWALLEX_ISSUING_CLIENT_ID;
  const apiKey = process.env.AIRWALLEX_ISSUING_API_KEY;
  const baseUrl = process.env.AIRWALLEX_ISSUING_BASE_URL ?? "https://api.airwallex.com";
  if (!clientId || !apiKey) {
    throw new AirwallexConfigError(
      "AIRWALLEX_ISSUING_CLIENT_ID and AIRWALLEX_ISSUING_API_KEY must be set when Airwallex issuing is enabled",
    );
  }
  const programType = process.env.AIRWALLEX_ISSUING_PROGRAM_TYPE?.trim().toUpperCase();
  if (
    programType &&
    !["PREPAID", "DEBIT", "CREDIT", "DEFERRED_DEBIT"].includes(programType)
  ) {
    throw new AirwallexConfigError(
      "AIRWALLEX_ISSUING_PROGRAM_TYPE must be PREPAID, DEBIT, CREDIT, or DEFERRED_DEBIT",
    );
  }
  const programSubType = process.env.AIRWALLEX_ISSUING_PROGRAM_SUB_TYPE?.trim().toUpperCase();
  if (programSubType && !["GOOD_FUNDS_CREDIT", "B2B_TRAVEL"].includes(programSubType)) {
    throw new AirwallexConfigError(
      "AIRWALLEX_ISSUING_PROGRAM_SUB_TYPE must be GOOD_FUNDS_CREDIT or B2B_TRAVEL",
    );
  }
  return new AirwallexIssuingClient({
    baseUrl,
    clientId,
    apiKey,
    currencyMaximums: readAirwallexCurrencyMaximums(),
    programType: programType as AirwallexConfig["programType"],
    programSubType: programSubType as AirwallexConfig["programSubType"],
  });
}

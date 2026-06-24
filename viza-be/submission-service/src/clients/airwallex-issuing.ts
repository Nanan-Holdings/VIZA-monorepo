/**
 * Low-level Airwallex Issuing client (PAY-004).
 *
 * Mints non-personalized, single-use COMMERCIAL VIRTUAL cards so each
 * applicant pays their government visa fee from a fresh card scoped to the
 * exact amount and a short active window. This caps the blast radius of a
 * portal compromise to one applicant + one fee, and stops the "same card
 * across many government portals" pattern that gets cards frozen.
 *
 * Native `fetch` (Node 18+), no extra deps. Mirrors the env-gated factory
 * pattern of the other API clients (see src/captcha/two-captcha.ts): the
 * factory returns `null` when the integration is disabled so callers stay a
 * no-op until AIRWALLEX_ISSUING_ENABLED is flipped on.
 *
 * PCI: this client returns raw PAN/CVV from `getSensitiveDetails`. Callers
 * must never log those values and must purge them from storage after the
 * portal payment (see src/issuing/escrow-card-provider.ts). This file itself
 * logs nothing.
 */

// ---------------------------------------------------------------------------
// Config + types
// ---------------------------------------------------------------------------

export interface AirwallexConfig {
  /** https://api.airwallex.com (prod) | https://api-demo.airwallex.com (sandbox). */
  baseUrl: string;
  clientId: string;
  apiKey: string;
}

export interface CreateCardInput {
  /** Idempotency key — survives retries so a retried job reuses one card. */
  requestId: string;
  cardholderId: string;
  createdBy: string;
  /** e.g. "USD" — the portal's billing currency. */
  currency: string;
  /** Major units, e.g. 27.5 — government fee plus optional FX buffer. */
  limitAmount: number;
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

/** Thrown when the integration is enabled but required credentials are absent. */
export class AirwallexConfigError extends Error {
  readonly code = "AIRWALLEX_CONFIG_ERROR" as const;
  constructor() {
    super(
      "AIRWALLEX_ISSUING_CLIENT_ID and AIRWALLEX_ISSUING_API_KEY must be set when AIRWALLEX_ISSUING_ENABLED is on",
    );
    this.name = "AirwallexConfigError";
  }
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class AirwallexIssuingClient {
  private token: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private cfg: AirwallexConfig) {}

  private async authHeader(): Promise<Record<string, string>> {
    const now = Date.now();
    if (this.token && now < this.tokenExpiresAt - 60_000) {
      return { Authorization: `Bearer ${this.token}` };
    }
    const res = await fetch(`${this.cfg.baseUrl}/api/v1/authentication/login`, {
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
    const res = await fetch(`${this.cfg.baseUrl}${path}`, {
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
    const res = await fetch(`${this.cfg.baseUrl}${path}`, {
      method: "GET",
      headers: await this.authHeader(),
    });
    if (!res.ok) {
      throw new Error(`Airwallex GET ${path} failed: ${res.status} ${await res.text()}`);
    }
    return (await res.json()) as T;
  }

  async createCard(input: CreateCardInput): Promise<CreatedCard> {
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
      // program.type / sub_type vary by account — confirm with the account
      // manager (doc §11). PREPAID + GOOD_FUNDS_CREDIT is the expected default.
      program: { purpose: "COMMERCIAL", type: "PREPAID", sub_type: "GOOD_FUNDS_CREDIT" },
      authorization_controls: {
        allowed_transaction_count: "SINGLE",
        allowed_currencies: [input.currency],
        active_from: input.activeFrom,
        active_to: input.activeTo,
        ...(input.allowedMerchantCategories
          ? { allowed_merchant_categories: input.allowedMerchantCategories }
          : {}),
        transaction_limits: {
          currency: input.currency,
          limits: [
            { amount: input.limitAmount, interval: "PER_TRANSACTION" },
            { amount: input.limitAmount, interval: "ALL_TIME" },
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

  async getSensitiveDetails(cardId: string): Promise<SensitiveCardDetails> {
    const d = await this.get<{
      card_number: string;
      cvv: string;
      expiry_month: string;
      expiry_year: string;
    }>(`/api/v1/issuing/cards/${cardId}/details`);
    return {
      pan: d.card_number,
      cvv: d.cvv,
      expiryMonth: d.expiry_month,
      expiryYear: d.expiry_year,
    };
  }

  async freezeCard(cardId: string): Promise<void> {
    // TODO-confirm: exact freeze/cancel endpoint + payload with the account
    // manager (doc §3/§11). This is the expected shape. A SINGLE-use card is
    // already spent after one debit, so freeze is best-effort defence in depth.
    await this.post(`/api/v1/issuing/cards/${cardId}/update`, { card_status: "INACTIVE" });
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function envEnabled(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test((value ?? "").trim());
}

/**
 * Build the client, or return `null` when AIRWALLEX_ISSUING_ENABLED is off so
 * callers degrade to a no-op (falling back to whatever is already in the vault).
 * Throws AirwallexConfigError when enabled but credentials are missing.
 */
export function createAirwallexIssuingClient(): AirwallexIssuingClient | null {
  if (!envEnabled(process.env.AIRWALLEX_ISSUING_ENABLED)) return null;
  const clientId = process.env.AIRWALLEX_ISSUING_CLIENT_ID;
  const apiKey = process.env.AIRWALLEX_ISSUING_API_KEY;
  const baseUrl = process.env.AIRWALLEX_ISSUING_BASE_URL ?? "https://api.airwallex.com";
  if (!clientId || !apiKey) {
    throw new AirwallexConfigError();
  }
  return new AirwallexIssuingClient({ baseUrl, clientId, apiKey });
}

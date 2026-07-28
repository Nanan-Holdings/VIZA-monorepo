/**
 * PhotonPay Open API client (card issuing / 发卡).
 *
 * Low-level client for the PhotonPay VCC APIs that mint the single-use
 * virtual cards our runners use to pay government visa fees (the escrow-card
 * model — see src/issuing/photonpay-card-provider.ts). Native `fetch`
 * (Node 18+), no extra deps. Mirrors the env-gated factory pattern of the
 * Airwallex client it replaces (src/clients/airwallex-issuing.ts).
 *
 * Auth (per PhotonPay 授权 docs):
 *   - POST /oauth2/token/accessToken with `Authorization: basic base64(appId/appSecret)`
 *     returns a bearer token good for ~2h. Fetching a new one invalidates the
 *     old, so we cache and refresh a few minutes early (never per-request).
 *   - Every business call carries `X-PD-TOKEN: <token>`.
 *
 * Signing (per PhotonPay 签名文档 — validated byte-for-byte against their
 * worked example):
 *   - Requests with a body (POST/PUT/DELETE) must carry `X-PD-SIGN`, the
 *     base64 of an MD5withRSA (PKCS#1 v1.5) signature over the EXACT JSON
 *     string sent as the body, using the merchant RSA private key. We sign
 *     the serialized string once and send that same string — re-serializing
 *     would change bytes and break the signature.
 *   - GET / empty-body calls need no signature.
 *   - Webhook callbacks carry `x-pd-sign`; verify against PhotonPay's platform
 *     public key with the same primitive (see `verifyWebhookSignature`).
 *
 * PCI: `getCardDetail` / `getCvv` return raw PAN/CVV. Callers must never log
 * those values and must not persist the CVV at all (PhotonPay acceptance
 * requirement). This file logs nothing sensitive.
 */

import { createSign, createVerify } from "node:crypto";
import { readFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// Config + envelope
// ---------------------------------------------------------------------------

export interface PhotonPayConfig {
  /** https://x-api.photonpay.com (prod) | https://x-api.sandbox.photontech.cc (sandbox). */
  baseUrl: string;
  appId: string;
  appSecret: string;
  /** Merchant RSA private key, PEM (PKCS#8). Used to sign request bodies. */
  privateKeyPem: string;
  /** PhotonPay platform RSA public key, PEM. Used to verify webhook callbacks. */
  platformPublicKeyPem?: string;
  /**
   * Optional structured logger for every request/response (acceptance item 5:
   * log time, path, headers, body, status, duration). Sensitive header and
   * body fields are redacted before this is called.
   */
  logger?: (entry: PhotonPayLogEntry) => void;
}

/** One request or response line, sensitive fields already redacted. */
export interface PhotonPayLogEntry {
  direction: "request" | "response";
  method: string;
  path: string;
  at: string;
  headers?: Record<string, string>;
  body?: string;
  status?: number;
  durationMs?: number;
}

const SENSITIVE_HEADERS = new Set(["x-pd-token", "x-pd-sign", "authorization"]);

function redactHeaders(h?: Record<string, string>): Record<string, string> | undefined {
  if (!h) return h;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) out[k] = SENSITIVE_HEADERS.has(k.toLowerCase()) ? "***" : v;
  return out;
}

/** Redact card three-elements from a JSON body string (PCI — never log PAN/CVV). */
function redactBody(b?: string): string | undefined {
  if (!b) return b;
  return b.replace(
    /("(?:cardNo|cardNumber|pan|cvv|cvv2|expirationDate|expiryDate)"\s*:\s*")[^"]*(")/gi,
    "$1***$2",
  );
}

/** PhotonPay wraps every response as `{ code, msg, data }`. */
interface Envelope<T> {
  code?: string;
  msg?: string;
  data?: T;
  path?: string;
}

/** `code` values that indicate success across PhotonPay endpoints. */
const SUCCESS_CODES = new Set(["0000", "0"]);

/** Refresh the access token this long BEFORE its real expiry — never present a
 * token at the exact 2h deadline (clock skew / in-flight latency). Matches the
 * PhotonPay reference implementation's 5-minute early refresh. */
const TOKEN_REFRESH_MARGIN_MS = 5 * 60_000;

/** Fallback token lifetime when the response carries no usable expiry. */
const TOKEN_DEFAULT_TTL_MS = 2 * 60 * 60_000;

/** Hard ceiling on a cached token, whichever way `expiresIn` is read. PhotonPay
 * documents ~2h; anything claiming longer is a misread value, and caching a
 * dead token is far worse than one redundant refresh. */
const TOKEN_MAX_TTL_MS = 24 * 60 * 60_000;

/**
 * Resolve the token's absolute expiry (epoch ms) from PhotonPay's `expiresIn`.
 *
 * On the UAT tenant `expiresIn` is an ABSOLUTE epoch-ms timestamp, not the
 * relative duration the name implies. We accept both forms rather than bet the
 * rail on that holding across the sandbox and prod tenants — but we do not try
 * to tell relative-seconds from relative-milliseconds, because for realistic
 * token lifetimes those ranges overlap and any boundary would be a guess.
 * Instead: a future value is absolute, anything else is seconds (the OAuth
 * convention), and the result is clamped so a misread can never pin a dead
 * token in cache.
 *
 * Exported for tests.
 */
export function resolveTokenExpiry(expiresIn: unknown, now: number): number {
  const value = Number(expiresIn);
  if (!Number.isFinite(value) || value <= 0) return now + TOKEN_DEFAULT_TTL_MS;
  const expiry = value > now ? value : now + value * 1000;
  return Math.min(expiry, now + TOKEN_MAX_TTL_MS);
}

/** Thrown when PhotonPay returns a non-success envelope or a transport error. */
export class PhotonPayApiError extends Error {
  readonly code: string;
  readonly path: string;
  constructor(path: string, code: string, msg: string) {
    super(`PhotonPay ${path} → [${code}] ${msg}`);
    this.name = "PhotonPayApiError";
    this.code = code;
    this.path = path;
  }
}

/** Thrown when the integration is enabled but required config is absent. */
export class PhotonPayConfigError extends Error {
  readonly code = "PHOTONPAY_CONFIG_ERROR" as const;
  constructor(detail: string) {
    super(`PhotonPay config error: ${detail}`);
    this.name = "PhotonPayConfigError";
  }
}

// ---------------------------------------------------------------------------
// Issuing types (only what we use; extend as needed)
// ---------------------------------------------------------------------------

export interface CardBin {
  cardBin: string;
  /** e.g. "share,recharge". */
  cardType: string;
  cardScheme: string;
  cardCurrency: string;
  cardFormFactor: string;
}

export interface OpenCardInput {
  /** Idempotency key — a retry with the same requestId must not mint a 2nd card. */
  requestId: string;
  cardBin: string;
  cardCurrency: string;
  /** "share" (shared pool) | "recharge" (regular card loaded to an exact amount). */
  cardType: "share" | "recharge";
  /** Optional — omitted, the card belongs to the account's DEFAULT cardholder
   * (VIZA's standard setup: one company cardholder, no per-card holders). */
  cardholderId?: string;
  /** PhotonPay funding account (accountNo from account list), e.g. "FA-USD…". */
  accountId?: string;
  /** For recharge cards: the amount to load, major units (e.g. 27.5). */
  rechargeAmount?: number;
  /** "limited" | "unlimited". Recharge/virtual-share default "unlimited". */
  transactionLimitType?: "limited" | "unlimited";
  /** Required when transactionLimitType is "limited". */
  transactionLimit?: number;
  nickname?: string;
}

/**
 * A card as PhotonPay returns it (the `cardDetail` object). `cardNo` and `cvv`
 * are sensitive — never log them; never persist `cvv`.
 */
export interface IssuedCard {
  cardId: string;
  /** Full PAN. Sensitive. */
  cardNo?: string;
  /** CVV, present inline on recharge cards. Sensitive — use once, never store. */
  cvv?: string;
  /** "MM/YY". */
  expirationDate?: string;
  cardScheme?: string;
  cardCurrency?: string;
  cardType?: string;
  /** "normal" | "frozen" | ... */
  cardStatus?: string;
  cardBalance?: number;
}

/** PhotonPay wraps card mutations as `{ requestId, status, cardDetail }`. */
export interface CardRequestResult {
  /** "succeed" | "processing" | "fail" (PhotonPay vocab). */
  status?: string;
  card?: IssuedCard;
  raw: unknown;
}

/** Extract the nested cardDetail into IssuedCard, tolerant of field aliases. */
function parseCardDetail(raw: unknown): IssuedCard | undefined {
  const r = raw as Record<string, unknown> | null;
  const d = (r?.cardDetail ?? r) as Record<string, unknown> | undefined;
  const cardId = (d?.cardId ?? d?.id) as string | undefined;
  if (!cardId) return undefined;
  return {
    cardId,
    cardNo: (d?.cardNo ?? d?.cardNumber) as string | undefined,
    cvv: d?.cvv as string | undefined,
    expirationDate: (d?.expirationDate ?? d?.expiryDate) as string | undefined,
    cardScheme: d?.cardScheme as string | undefined,
    cardCurrency: d?.cardCurrency as string | undefined,
    cardType: d?.cardType as string | undefined,
    cardStatus: (d?.cardStatus ?? d?.status) as string | undefined,
    cardBalance: d?.cardBalance as number | undefined,
  };
}

/** Whether a PhotonPay request status string indicates terminal success. */
export function isSucceeded(status?: string): boolean {
  return /^(succe|success)/i.test(status ?? "");
}

/** Whether a PhotonPay request status string indicates terminal failure. */
export function isFailed(status?: string): boolean {
  return /^(fail|reject|error|decline)/i.test(status ?? "");
}

export interface AddCardholderInput {
  firstName: string;
  lastName: string;
  /** yyyy-MM-dd. */
  dateOfBirth: string;
  /** ISO 3166 alpha-2. */
  nationalityCountryCode: string;
  email?: string;
  mobile?: string;
  mobilePrefix?: string;
  cardholderNameAbbreviation?: string;
  certType?: string;
  certId?: string;
  certCountryCode?: string;
  residentialAddress?: string;
  residentialCity?: string;
  residentialCountryCode?: string;
  residentialPostalCode?: string;
  residentialState?: string;
}

export interface Cardholder {
  cardholderId?: string;
  /** e.g. "processing" | "approved" | "rejected" (review is async). */
  status?: string;
  raw: unknown;
}

export interface IssuingHistoryQuery {
  pageIndex?: number;
  pageSize?: number;
  cardId?: string;
  /** yyyy-MM-dd HH:mm:ss. */
  createdAtStart?: string;
  createdAtEnd?: string;
  status?: string;
}

export interface IssuingHistoryPage {
  list: unknown[];
  total: number;
  raw: unknown;
}

// ---------------------------------------------------------------------------
// Acquiring (Cashier v5) types — the checkout that replaces Stripe
// ---------------------------------------------------------------------------

export interface CashierSessionInput {
  /** Merchant order id, unique. */
  reqId: string;
  /** Amount in the currency's MINOR unit (e.g. cents). ISO 4217 minor units. */
  amountMinor: number;
  /** ISO 4217 alpha, e.g. "USD". */
  currency: string;
  /** Store id from 收单 → 站点管理 → 详情. */
  siteId: string;
  goods: Array<{ name: string; virtual: boolean; price?: string; quantity?: string; desc?: string }>;
  shopper: { id: string; nickName: string; platform: string; shopperIp: string; email?: string; phone?: string };
  /** Anti-fraud context. fingerprintId/platform/retryTimes are required by v5. */
  risk: { fingerprintId: string; platform: string; retryTimes: string };
  /** Async result callback (our webhook). */
  notifyUrl?: string;
  /** Browser return URL after payment. */
  redirectUrl?: string;
  /** When true the response also returns a hosted-cashier payRedirectUrl. */
  autoRedirect?: boolean;
  /** Restrict to specific methods, e.g. ["ApplePay","GooglePay"]. Empty = aggregation. */
  payMethods?: string[];
}

export interface CashierSession {
  /** PhotonPay's payment id (echoes our reqId in v5). */
  payId?: string;
  /** Token to init the hosted cashier / @photonpay/cashierjs. */
  authCode?: string;
  /** Aggregation or a specific method. */
  payMethod?: string;
  /** Hosted-cashier URL to redirect the buyer to (present when autoRedirect). */
  payRedirectUrl?: string;
  raw: unknown;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class PhotonPayClient {
  private token: string | null = null;
  private tokenExpiresAt = 0;
  /** Shared promise while a token fetch is in flight — see `accessToken`. */
  private tokenInFlight: Promise<string> | null = null;

  constructor(private cfg: PhotonPayConfig) {}

  // --- auth ---------------------------------------------------------------

  private async accessToken(): Promise<string> {
    const now = Date.now();
    // Reuse the cached token until the margin-adjusted expiry. Fetching a new
    // one invalidates the old, so we hold a single cached token per instance.
    if (this.token && now < this.tokenExpiresAt) return this.token;

    // Two concurrent cache misses must not both fetch: the second token would
    // invalidate the first while an in-flight request is still carrying it.
    // Whoever misses first owns the fetch; everyone else awaits that promise.
    this.tokenInFlight ??= this.fetchToken().finally(() => {
      this.tokenInFlight = null;
    });
    return this.tokenInFlight;
  }

  private async fetchToken(): Promise<string> {
    const now = Date.now();
    const basic =
      "basic " +
      Buffer.from(`${this.cfg.appId}/${this.cfg.appSecret}`).toString("base64");
    const res = await fetch(`${this.cfg.baseUrl}/oauth2/token/accessToken`, {
      method: "POST",
      headers: { Authorization: basic, "Content-Type": "application/json" },
    });
    const body = (await res.json().catch(() => ({}))) as Envelope<{
      token?: string;
      accessToken?: string;
      expiresIn?: number;
    }>;
    const token = body.data?.token ?? body.data?.accessToken ?? null;
    if (!res.ok || !token) {
      throw new PhotonPayApiError(
        "/oauth2/token/accessToken",
        body.code ?? String(res.status),
        body.msg ?? "no token in response",
      );
    }
    this.token = token;
    // Refresh TOKEN_REFRESH_MARGIN_MS before the real deadline — never key off
    // a fixed "now + 2h" that could ride the token to its edge.
    this.tokenExpiresAt = resolveTokenExpiry(body.data?.expiresIn, now) - TOKEN_REFRESH_MARGIN_MS;
    return token;
  }

  // --- signing ------------------------------------------------------------

  /** base64(MD5withRSA(body)) over the exact request-body string. */
  sign(body: string): string {
    return createSign("RSA-MD5").update(body, "utf8").sign(this.cfg.privateKeyPem, "base64");
  }

  /**
   * Verify a webhook callback signature (x-pd-sign header) against PhotonPay's
   * platform public key. `rawBody` MUST be the exact bytes received, not a
   * re-serialized object.
   */
  verifyWebhookSignature(rawBody: string, sign: string): boolean {
    if (!this.cfg.platformPublicKeyPem) {
      throw new PhotonPayConfigError("platformPublicKeyPem required to verify webhooks");
    }
    try {
      return createVerify("RSA-MD5")
        .update(rawBody, "utf8")
        .verify(this.cfg.platformPublicKeyPem, sign, "base64");
    } catch {
      return false;
    }
  }

  // --- transport ----------------------------------------------------------

  private emitLog(entry: Omit<PhotonPayLogEntry, "at">): void {
    if (!this.cfg.logger) return;
    this.cfg.logger({
      ...entry,
      headers: redactHeaders(entry.headers),
      body: redactBody(entry.body),
      at: new Date().toISOString(),
    });
  }

  /** Single fetch chokepoint: logs the request + response (redacted), timed. */
  private async send(
    method: string,
    path: string,
    url: string,
    headers: Record<string, string>,
    body?: string,
  ): Promise<Response> {
    const started = Date.now();
    this.emitLog({ direction: "request", method, path, headers, body });
    const res = await fetch(url, { method, headers, ...(body !== undefined ? { body } : {}) });
    let respText = "";
    try {
      respText = await res.clone().text();
    } catch {
      /* body not clonable/readable — log without it */
    }
    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    this.emitLog({
      direction: "response",
      method,
      path,
      status: res.status,
      durationMs: Date.now() - started,
      headers: responseHeaders,
      body: respText,
    });
    return res;
  }

  private async get<T>(path: string, query?: Record<string, string | undefined>): Promise<T> {
    const qs = query
      ? "?" +
        Object.entries(query)
          .filter(([, v]) => v !== undefined && v !== "")
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
          .join("&")
      : "";
    const res = await this.send("GET", path, `${this.cfg.baseUrl}${path}${qs}`, {
      "X-PD-TOKEN": await this.accessToken(),
    });
    return this.unwrap<T>(path, res);
  }

  private async post<T>(path: string, payload: unknown): Promise<T> {
    // Serialize ONCE and sign that exact string — see the file header.
    const body = JSON.stringify(payload);
    const res = await this.send("POST", path, `${this.cfg.baseUrl}${path}`, {
      "X-PD-TOKEN": await this.accessToken(),
      "X-PD-SIGN": this.sign(body),
      "Content-Type": "application/json",
    }, body);
    return this.unwrap<T>(path, res);
  }

  /** Parse + success-check, returning the FULL envelope (code, msg, data, and
   * any sibling fields). Most endpoints nest results under `data`, but some
   * (e.g. cashierSession) return fields as siblings of `code`. */
  private async parseEnvelope(path: string, res: Response): Promise<Record<string, unknown>> {
    const env = (await res.json().catch(() => ({}))) as Envelope<unknown> & Record<string, unknown>;
    if (!res.ok || (env.code !== undefined && !SUCCESS_CODES.has(env.code as string))) {
      throw new PhotonPayApiError(
        path,
        (env.code as string) ?? String(res.status),
        (env.msg as string) ?? "request failed",
      );
    }
    return env;
  }

  private async unwrap<T>(path: string, res: Response): Promise<T> {
    return (await this.parseEnvelope(path, res)).data as T;
  }

  /** POST that returns the full envelope (for endpoints with top-level result fields). */
  private async postEnvelope(path: string, payload: unknown): Promise<Record<string, unknown>> {
    const body = JSON.stringify(payload);
    const res = await this.send("POST", path, `${this.cfg.baseUrl}${path}`, {
      "X-PD-TOKEN": await this.accessToken(),
      "X-PD-SIGN": this.sign(body),
      "Content-Type": "application/json",
    }, body);
    return this.parseEnvelope(path, res);
  }

  // --- issuing methods ----------------------------------------------------

  /** List the card BINs the account may issue against. */
  async getCardBins(): Promise<CardBin[]> {
    const data = await this.get<CardBin[]>("/vcc/openApi/v4/getCardBin");
    return Array.isArray(data) ? data : [];
  }

  /**
   * Apply for a single virtual card. PhotonPay issues synchronously and returns
   * the card inline; `card` is populated on success. `getRequestResult` can
   * re-fetch by requestId if a call is ever interrupted.
   */
  async openCard(input: OpenCardInput): Promise<CardRequestResult> {
    const payload: Record<string, unknown> = {
      requestId: input.requestId,
      cardBin: input.cardBin,
      cardCurrency: input.cardCurrency,
      cardType: input.cardType,
      cardFormFactor: "virtual_card",
    };
    // Omitted → the card belongs to the account's default cardholder.
    if (input.cardholderId) payload.cardholderId = input.cardholderId;
    if (input.accountId) payload.accountId = input.accountId;
    if (input.rechargeAmount !== undefined) payload.rechargeAmount = input.rechargeAmount;
    if (input.transactionLimitType) payload.transactionLimitType = input.transactionLimitType;
    if (input.transactionLimit !== undefined) payload.transactionLimit = input.transactionLimit;
    if (input.nickname) payload.nickname = input.nickname;
    const raw = await this.post<Record<string, unknown>>("/vcc/openApi/v4/openCard", payload);
    return { status: raw?.status as string | undefined, card: parseCardDetail(raw), raw };
  }

  /** Re-fetch the result of a prior request by merchant requestId (idempotency/recovery). */
  async getRequestResult(requestId: string, type?: string): Promise<CardRequestResult> {
    const raw = await this.get<Record<string, unknown>>("/vcc/openApi/v4/getRequestResult", {
      requestId,
      type,
    });
    return { status: raw?.status as string | undefined, card: parseCardDetail(raw), raw };
  }

  /** Card metadata by cardId (PAN/expiry/status/balance). PAN is sensitive. */
  async getCardDetail(cardId: string): Promise<IssuedCard> {
    const raw = await this.get<Record<string, unknown>>("/vcc/openApi/v4/getCardDetail", { cardId });
    return parseCardDetail(raw) ?? { cardId };
  }

  /** CVV — sensitive, single-use at payment time. NEVER persist. */
  async getCvv(cardId: string): Promise<string> {
    const raw = await this.get<Record<string, unknown>>("/vcc/openApi/v4/getCvv", { cardId });
    const cvv = (raw?.cvv ?? raw?.cvv2) as string | undefined;
    if (!cvv) throw new PhotonPayApiError("/vcc/openApi/v4/getCvv", "NO_CVV", "no cvv in response");
    return cvv;
  }

  /** Freeze/unfreeze a card (best-effort defence in depth; a spent single-use
   * card is inert). requestId is the idempotency key for the state change. */
  async freezeCard(cardId: string, requestId: string, status: "freeze" | "unfreeze" = "freeze"): Promise<void> {
    await this.post("/vcc/openApi/v4/freezeCard", { cardId, requestId, status });
  }

  /** Cancel/discard a card. */
  async cancelCard(cardId: string): Promise<void> {
    await this.post("/vcc/openApi/v4/cancelCard", { cardId });
  }

  /**
   * Register a cardholder (用卡人). Operationally VIZA uses one shared cardholder
   * for all escrow cards, so this is a one-time setup call, not per-application.
   * Review is asynchronous — poll status or listen for the cardholder-review
   * webhook before issuing against a new cardholder.
   */
  async addCardholder(input: AddCardholderInput): Promise<Cardholder> {
    const raw = await this.post<Record<string, unknown>>("/vcc/openApi/v4/addCardholder", input);
    return {
      cardholderId: (raw?.cardholderId ?? raw?.id) as string | undefined,
      status: raw?.status as string | undefined,
      raw,
    };
  }

  /** Paged card transaction history — the reconciliation poll (acceptance: 24h). */
  async getIssuingHistory(query: IssuingHistoryQuery = {}): Promise<IssuingHistoryPage> {
    const raw = await this.get<Record<string, unknown>>("/vcc/openApi/v4/pagingIssuingHistory", {
      pageIndex: query.pageIndex !== undefined ? String(query.pageIndex) : undefined,
      pageSize: query.pageSize !== undefined ? String(query.pageSize) : undefined,
      cardId: query.cardId,
      createdAtStart: query.createdAtStart,
      createdAtEnd: query.createdAtEnd,
      status: query.status,
    });
    const list = Array.isArray(raw)
      ? raw
      : ((raw?.list ?? raw?.records ?? raw?.data) as unknown[] | undefined) ?? [];
    const total = (raw && !Array.isArray(raw) ? (raw.total as number | undefined) : undefined) ?? list.length;
    return { list, total, raw };
  }

  // --- regular-card recharge (充值) ---------------------------------------

  /** FX inquiry before a recharge (换汇询价). Returns a quote keyed by requestId;
   * pass the SAME requestId to `recharge` to confirm the transfer-in. */
  async preRecharge(input: {
    requestId: string;
    accountId: string;
    cardId: string;
    rechargeAmount?: number;
    arrivalAmount?: number;
  }): Promise<Record<string, unknown>> {
    return this.get<Record<string, unknown>>("/vcc/openApi/v4/preRecharge", {
      requestId: input.requestId,
      accountId: input.accountId,
      cardId: input.cardId,
      rechargeAmount: input.rechargeAmount !== undefined ? String(input.rechargeAmount) : undefined,
      arrivalAmount: input.arrivalAmount !== undefined ? String(input.arrivalAmount) : undefined,
    });
  }

  /** Transfer funds into a regular card (充值/TRANSFER IN). `requestId` must be the
   * one from the matching `preRecharge` FX inquiry. */
  async recharge(requestId: string): Promise<Record<string, unknown>> {
    return this.post<Record<string, unknown>>("/vcc/openApi/v4/recharge", { requestId });
  }

  /** Return funds from a card back to the funding account (card amount return). */
  async rechargeReturn(cardId: string, requestId: string, returnAmount: number): Promise<Record<string, unknown>> {
    return this.post<Record<string, unknown>>("/vcc/openApi/v4/rechargeReturn", {
      cardId,
      requestId,
      returnAmount: String(returnAmount),
    });
  }

  /** Paged card spend transactions (auth/settle/void) — distinct from the
   * funding history in getIssuingHistory. Yields transactionId for void/refund. */
  async getTradeOrders(query: { pageIndex?: number; pageSize?: number; cardId?: string } = {}): Promise<IssuingHistoryPage> {
    const raw = await this.get<Record<string, unknown>>("/vcc/openApi/v4/pagingVccTradeOrder", {
      pageIndex: query.pageIndex !== undefined ? String(query.pageIndex) : undefined,
      pageSize: query.pageSize !== undefined ? String(query.pageSize) : undefined,
      cardId: query.cardId,
    });
    const list = Array.isArray(raw) ? raw : ((raw?.list ?? raw?.records ?? raw?.data) as unknown[] | undefined) ?? [];
    const total = (raw && !Array.isArray(raw) ? (raw.total as number | undefined) : undefined) ?? list.length;
    return { list, total, raw };
  }

  // --- test / webhook management ------------------------------------------

  /** Simulate a card transaction (交易模拟) — drives a real issuing-transaction
   * webhook so the notification path can be exercised end-to-end on UAT. */
  async sandboxTransaction(input: {
    requestId: string;
    cardId: string;
    cvv: string;
    expirationDate: string;
    txnCurrency: string;
    txnAmount: number;
    txnType?: "auth" | "void" | "refund";
    mcc?: string;
    merchantName?: string;
    merchantCountry?: string;
    merchantCity?: string;
    merchantPostcode?: string;
  }): Promise<Record<string, unknown>> {
    return this.post<Record<string, unknown>>("/vcc/open/v2/sandBoxTransaction", {
      requestId: input.requestId,
      cardID: input.cardId,
      cvv: input.cvv,
      expirationDate: input.expirationDate,
      txnCurrency: input.txnCurrency,
      txnAmount: input.txnAmount,
      txnType: input.txnType ?? "auth",
      mcc: input.mcc ?? "5311",
      merchantName: input.merchantName ?? "VIZA UAT",
      merchantCountry: input.merchantCountry ?? "US",
      merchantCity: input.merchantCity ?? "NewYork",
      merchantPostcode: input.merchantPostcode ?? "10001",
    });
  }

  /** List available webhook topics/templates (to find topicCode + templateCode). */
  async getWebhookTopics(): Promise<Record<string, unknown>> {
    return this.get<Record<string, unknown>>("/exchange-center/open/api/v1/webhook/notification");
  }

  /** Subscribe to webhook events. Each item = {topicCode, templateCode}. */
  async subscribeWebhook(subscriptions: Array<{ topicCode: string; templateCode: string }>): Promise<unknown> {
    const body = JSON.stringify({ subscriptions });
    const res = await this.send("PUT", "/exchange-center/open/api/v1/webhook/notification",
      `${this.cfg.baseUrl}/exchange-center/open/api/v1/webhook/notification`, {
        "X-PD-TOKEN": await this.accessToken(),
        "X-PD-SIGN": this.sign(body),
        "Content-Type": "application/json",
      }, body);
    return this.parseEnvelope("/exchange-center/open/api/v1/webhook/notification", res);
  }

  // --- acquiring (cashier) ------------------------------------------------

  /**
   * Create a v5 cashier session. With `autoRedirect: true` the response carries
   * `payRedirectUrl` — redirect the buyer there to complete payment on
   * PhotonPay's hosted page. The final result arrives asynchronously at
   * `notifyUrl` (our webhook); treat the browser redirect as advisory only.
   */
  async createCashierSession(input: CashierSessionInput): Promise<CashierSession> {
    const payload: Record<string, unknown> = {
      reqId: input.reqId,
      amount: input.amountMinor,
      currency: input.currency,
      siteId: input.siteId,
      goodsInfo: input.goods.map((g) => ({
        name: g.name,
        virtual: g.virtual ? "Y" : "N",
        ...(g.price ? { price: g.price } : {}),
        ...(g.quantity ? { quantity: g.quantity } : {}),
        ...(g.desc ? { desc: g.desc } : {}),
      })),
      shopper: {
        id: input.shopper.id,
        nickName: input.shopper.nickName,
        platform: input.shopper.platform,
        shopperIp: input.shopper.shopperIp,
        ...(input.shopper.email ? { email: input.shopper.email } : {}),
        ...(input.shopper.phone ? { phone: input.shopper.phone } : {}),
      },
      risk: {
        fingerprintId: input.risk.fingerprintId,
        platform: input.risk.platform,
        retryTimes: input.risk.retryTimes,
      },
    };
    if (input.notifyUrl) payload.notifyUrl = input.notifyUrl;
    if (input.redirectUrl) payload.redirectUrl = input.redirectUrl;
    if (input.autoRedirect !== undefined) payload.autoRedirect = input.autoRedirect;
    if (input.payMethods?.length) payload.payMethods = input.payMethods;
    // cashierSession returns result fields at the top level, not under `data`.
    const env = await this.postEnvelope("/txncore/openApi/v5/cashierSession", payload);
    return {
      payId: env.payId as string | undefined,
      authCode: env.authCode as string | undefined,
      payMethod: env.payMethod as string | undefined,
      payRedirectUrl: (env.payRedirectUrl ?? env.redirectUrl) as string | undefined,
      raw: env,
    };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function envEnabled(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test((value ?? "").trim());
}

function loadKey(pem: string | undefined, path: string | undefined): string | undefined {
  if (pem && pem.includes("BEGIN")) return pem.replace(/\\n/g, "\n");
  if (path) return readFileSync(path, "utf8");
  return undefined;
}

/**
 * Build a PhotonPay client from env, or return `null` when PHOTONPAY_ENABLED is
 * off so callers degrade to a no-op (falling back to whatever the runner
 * already has). Throws PhotonPayConfigError when enabled but misconfigured.
 *
 * Env:
 *   PHOTONPAY_ENABLED           1|true to activate
 *   PHOTONPAY_BASE_URL          REQUIRED — sandbox or prod host, no default
 *   PHOTONPAY_APP_ID / _SECRET  developer credentials
 *   PHOTONPAY_PRIVATE_KEY       merchant private key PEM (or _PATH to a file)
 *   PHOTONPAY_PLATFORM_PUBLIC_KEY  platform public key PEM (or _PATH), for webhooks
 *
 * `PHOTONPAY_BASE_URL` has no default on purpose. It used to fall back to the
 * production host, so any UAT script run with the var unset would mint real
 * cards against real money. Forgetting to set it must fail, not fall through.
 */
export function createPhotonPayClient(): PhotonPayClient | null {
  if (!envEnabled(process.env.PHOTONPAY_ENABLED)) return null;
  const baseUrl = process.env.PHOTONPAY_BASE_URL?.trim();
  if (!baseUrl) {
    throw new PhotonPayConfigError(
      "PHOTONPAY_BASE_URL required (sandbox: https://x-api.sandbox.photontech.cc, prod: https://x-api.photonpay.com)",
    );
  }
  const appId = process.env.PHOTONPAY_APP_ID;
  const appSecret = process.env.PHOTONPAY_APP_SECRET;
  const privateKeyPem = loadKey(process.env.PHOTONPAY_PRIVATE_KEY, process.env.PHOTONPAY_PRIVATE_KEY_PATH);
  const platformPublicKeyPem = loadKey(
    process.env.PHOTONPAY_PLATFORM_PUBLIC_KEY,
    process.env.PHOTONPAY_PLATFORM_PUBLIC_KEY_PATH,
  );
  if (!appId || !appSecret) throw new PhotonPayConfigError("PHOTONPAY_APP_ID and PHOTONPAY_APP_SECRET required");
  if (!privateKeyPem) throw new PhotonPayConfigError("PHOTONPAY_PRIVATE_KEY(_PATH) required");
  const logger = envEnabled(process.env.PHOTONPAY_LOG) ? defaultLogger : undefined;
  return new PhotonPayClient({ baseUrl, appId, appSecret, privateKeyPem, platformPublicKeyPem, logger });
}

/** Default console logger (enabled with PHOTONPAY_LOG=1). Bodies pre-redacted. */
function defaultLogger(e: PhotonPayLogEntry): void {
  if (e.direction === "request") {
    console.debug(`[${e.at}][photonpay][req] ${e.method} ${e.path} body=${e.body ?? ""}`);
  } else {
    console.debug(
      `[${e.at}][photonpay][res] ${e.method} ${e.path} status=${e.status} ${e.durationMs}ms body=${(e.body ?? "").slice(0, 800)}`,
    );
  }
}

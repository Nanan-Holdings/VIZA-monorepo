/**
 * PhotonPay client (acquiring / 收单) for the Next.js portal.
 *
 * Sibling of the submission-service issuing client
 * (viza-be/submission-service/src/clients/photonpay.ts) — this repo keeps one
 * PhotonPay client per package, the same way it has lib/airwallex here and
 * clients/airwallex-issuing there. This one covers what the portal needs:
 * creating a hosted Cashier v5 session and verifying webhook callbacks.
 *
 * Auth: POST /oauth2/token/accessToken with `basic base64(appId/appSecret)`
 * yields a ~2h bearer token sent as `X-PD-TOKEN`. Signed POSTs carry
 * `X-PD-SIGN` = base64(MD5withRSA(rawBody)) with the merchant private key —
 * pinned byte-for-byte against PhotonPay's official example in client.test.ts.
 *
 * DEPLOYMENT — read before enabling:
 *
 *   PhotonPay enforces a merchant IP allowlist on every OpenAPI call, and a
 *   caller that is not on it gets `HTTP 200 {"code":"403","msg":"forbidden"}`
 *   (confirmed against production, 2026-07-26). Vercel functions have no static
 *   egress IP, so `createCashierSession` — the only OUTBOUND call here — cannot
 *   work from the Vercel runtime. It must run from a static-IP host whose
 *   address is on the allowlist.
 *
 *   The webhook direction is unaffected: PhotonPay calls us, and signature
 *   verification is local crypto, so `verifyWebhookSignature` is fine on Vercel.
 */

import { createSign, createVerify } from "node:crypto";
import { readFileSync } from "node:fs";

export interface PhotonPayConfig {
  baseUrl: string;
  appId: string;
  appSecret: string;
  privateKeyPem: string;
  platformPublicKeyPem?: string;
}

const SUCCESS_CODES = new Set(["0000", "0"]);

/** Refresh this long before the real expiry — never present a token at the
 * exact deadline (clock skew / in-flight latency). */
const TOKEN_REFRESH_MARGIN_MS = 5 * 60_000;

/** Fallback lifetime when the response carries no usable expiry. */
const TOKEN_DEFAULT_TTL_MS = 2 * 60 * 60_000;

/** Ceiling on a cached token however `expiresIn` is read. PhotonPay documents
 * ~2h; caching a dead token is far worse than one redundant refresh. */
const TOKEN_MAX_TTL_MS = 24 * 60 * 60_000;

export class PhotonPayApiError extends Error {
  readonly code: string;
  constructor(path: string, code: string, msg: string) {
    super(`PhotonPay ${path} → [${code}] ${msg}`);
    this.name = "PhotonPayApiError";
    this.code = code;
  }
}

/**
 * Resolve the token's absolute expiry (epoch ms). PhotonPay's `expiresIn` is
 * misnamed: production returns an ABSOLUTE epoch-ms timestamp, not a duration.
 * Accept both forms and clamp, so a misread can never pin a dead token in cache.
 * Mirrors `resolveTokenExpiry` in the submission-service client.
 */
export function resolveTokenExpiry(expiresIn: unknown, now: number): number {
  const value = Number(expiresIn);
  if (!Number.isFinite(value) || value <= 0) return now + TOKEN_DEFAULT_TTL_MS;
  const expiry = value > now ? value : now + value * 1000;
  return Math.min(expiry, now + TOKEN_MAX_TTL_MS);
}

export interface CashierSessionInput {
  /** Unique merchant order ref (we encode the order id here). ≤64 chars. */
  reqId: string;
  /** Amount in the currency's MINOR unit (e.g. USD cents). */
  amountMinor: number;
  currency: string;
  /** Store id from 收单 → 站点管理 → 详情. */
  siteId: string;
  goods: Array<{ name: string; virtual: boolean; price?: string; quantity?: string }>;
  shopper: { id: string; nickName: string; platform: string; shopperIp: string; email?: string };
  risk: { fingerprintId: string; platform: string; retryTimes: string };
  notifyUrl?: string;
  redirectUrl?: string;
  autoRedirect?: boolean;
  payMethods?: string[];
}

export interface CashierSession {
  payId?: string;
  authCode?: string;
  payMethod?: string;
  payRedirectUrl?: string;
  raw: unknown;
}

export class PhotonPayClient {
  private token: string | null = null;
  private tokenExpiresAt = 0;
  /** Shared promise while a token fetch is in flight — see `accessToken`. */
  private tokenInFlight: Promise<string> | null = null;

  constructor(private cfg: PhotonPayConfig) {}

  private async accessToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiresAt) return this.token;
    // Fetching a new token invalidates the previous one server-side, so
    // concurrent misses must share one fetch rather than each minting a token
    // and killing the one an in-flight request is still carrying.
    this.tokenInFlight ??= this.fetchToken().finally(() => {
      this.tokenInFlight = null;
    });
    return this.tokenInFlight;
  }

  private async fetchToken(): Promise<string> {
    const now = Date.now();
    const basic = "basic " + Buffer.from(`${this.cfg.appId}/${this.cfg.appSecret}`).toString("base64");
    const res = await fetch(`${this.cfg.baseUrl}/oauth2/token/accessToken`, {
      method: "POST",
      headers: { Authorization: basic, "Content-Type": "application/json" },
    });
    const body = (await res.json().catch(() => ({}))) as {
      code?: string;
      msg?: string;
      data?: { token?: string; expiresIn?: number };
    };
    const token = body.data?.token ?? null;
    if (!res.ok || !token) {
      throw new PhotonPayApiError(
        "/oauth2/token/accessToken",
        body.code ?? String(res.status),
        body.msg ?? "no token",
      );
    }
    this.token = token;
    this.tokenExpiresAt = resolveTokenExpiry(body.data?.expiresIn, now) - TOKEN_REFRESH_MARGIN_MS;
    return token;
  }

  /** base64(MD5withRSA(body)) over the exact request-body string. */
  sign(body: string): string {
    return createSign("RSA-MD5").update(body, "utf8").sign(this.cfg.privateKeyPem, "base64");
  }

  /** Whether webhook verification is possible at all (platform key present). */
  get canVerifyWebhooks(): boolean {
    return Boolean(this.cfg.platformPublicKeyPem);
  }

  /**
   * Verify a webhook `x-pd-sign` against PhotonPay's platform public key.
   * Returns false — never throws — so a bad callback cannot become an unhandled
   * 500. Check `canVerifyWebhooks` to tell "not configured" apart from
   * "signature did not match".
   */
  verifyWebhookSignature(rawBody: string, sign: string): boolean {
    if (!this.cfg.platformPublicKeyPem) return false;
    try {
      return createVerify("RSA-MD5")
        .update(rawBody, "utf8")
        .verify(this.cfg.platformPublicKeyPem, sign, "base64");
    } catch {
      return false;
    }
  }

  /**
   * Create a v5 cashier session. With `autoRedirect`, the response carries a
   * hosted `payRedirectUrl` to send the buyer to. The final result arrives
   * asynchronously at `notifyUrl` (our webhook) — treat the browser redirect as
   * advisory only. cashierSession returns its fields at the TOP LEVEL of the
   * envelope, as siblings of `code`, not nested under `data`.
   *
   * Outbound: requires an allowlisted egress IP (see the file header).
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
      })),
      shopper: {
        id: input.shopper.id,
        nickName: input.shopper.nickName,
        platform: input.shopper.platform,
        shopperIp: input.shopper.shopperIp,
        ...(input.shopper.email ? { email: input.shopper.email } : {}),
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

    // Serialize ONCE and sign that exact string — re-serializing would change
    // the bytes and invalidate the signature.
    const body = JSON.stringify(payload);
    const res = await fetch(`${this.cfg.baseUrl}/txncore/openApi/v5/cashierSession`, {
      method: "POST",
      headers: {
        "X-PD-TOKEN": await this.accessToken(),
        "X-PD-SIGN": this.sign(body),
        "Content-Type": "application/json",
      },
      body,
    });
    const env = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || (env.code !== undefined && !SUCCESS_CODES.has(env.code as string))) {
      throw new PhotonPayApiError(
        "/txncore/openApi/v5/cashierSession",
        (env.code as string) ?? String(res.status),
        (env.msg as string) ?? "cashier session failed",
      );
    }
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
// Config + factory
// ---------------------------------------------------------------------------

function loadKey(pem: string | undefined, path: string | undefined): string | undefined {
  if (pem && pem.includes("BEGIN")) return pem.replace(/\\n/g, "\n");
  if (path) {
    try {
      return readFileSync(path, "utf8");
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** True when PhotonPay is configured to be the active checkout gateway. */
export function isPhotonPayEnabled(): boolean {
  return /^(1|true|yes|on)$/i.test((process.env.PHOTONPAY_ENABLED ?? "").trim());
}

let cached: PhotonPayClient | null = null;

/**
 * Build (and memoize) the portal PhotonPay client from env, or return null when
 * disabled/misconfigured so callers can fall back to Stripe.
 *
 * `PHOTONPAY_BASE_URL` is required rather than defaulting to production — an
 * unset value used to silently mean "prod", which is how a test run charges
 * real cards. Same rule as the submission-service factory.
 *
 * Env: PHOTONPAY_ENABLED, PHOTONPAY_BASE_URL, PHOTONPAY_APP_ID/_SECRET,
 * PHOTONPAY_PRIVATE_KEY(_PATH), PHOTONPAY_PLATFORM_PUBLIC_KEY(_PATH), PHOTONPAY_SITE_ID.
 */
export function getPhotonPayClient(): PhotonPayClient | null {
  if (!isPhotonPayEnabled()) return null;
  if (cached) return cached;

  const baseUrl = process.env.PHOTONPAY_BASE_URL?.trim();
  const appId = process.env.PHOTONPAY_APP_ID?.trim();
  const appSecret = process.env.PHOTONPAY_APP_SECRET?.trim();
  const privateKeyPem = loadKey(process.env.PHOTONPAY_PRIVATE_KEY, process.env.PHOTONPAY_PRIVATE_KEY_PATH);
  const platformPublicKeyPem = loadKey(
    process.env.PHOTONPAY_PLATFORM_PUBLIC_KEY,
    process.env.PHOTONPAY_PLATFORM_PUBLIC_KEY_PATH,
  );
  if (!baseUrl || !appId || !appSecret || !privateKeyPem) return null;

  cached = new PhotonPayClient({ baseUrl, appId, appSecret, privateKeyPem, platformPublicKeyPem });
  return cached;
}

export function getPhotonPaySiteId(): string | null {
  return process.env.PHOTONPAY_SITE_ID?.trim() || null;
}

export type WebhookVerification = "ok" | "bad-signature" | "not-configured";

/**
 * Verify a PhotonPay webhook signature from the platform public key alone.
 *
 * Deliberately independent of `PHOTONPAY_ENABLED` and of `getPhotonPayClient()`.
 * That flag decides whether we mint NEW cashier sessions; it says nothing about
 * whether we can authenticate an inbound callback, which is pure local crypto.
 * Coupling the two is a trap in both directions:
 *
 *   - The documented split topology has webhooks landing on Vercel while the
 *     outbound call runs from an allowlisted static-IP host. That receiver has
 *     no reason to set `PHOTONPAY_ENABLED=true`, and would reject every
 *     delivery.
 *   - Switching the flag off to roll back to Stripe would strand every session
 *     already in flight: the buyer is charged, the callback is refused, the
 *     order never reaches `paid`, and no magic-link email is sent.
 *
 * Either way the refusals are non-conforming responses, and 8 consecutive ones
 * disable every webhook topic on the account.
 */
export function verifyPhotonPayWebhook(rawBody: string, sign: string | null): WebhookVerification {
  const platformPublicKeyPem = loadKey(
    process.env.PHOTONPAY_PLATFORM_PUBLIC_KEY,
    process.env.PHOTONPAY_PLATFORM_PUBLIC_KEY_PATH,
  );
  if (!platformPublicKeyPem) return "not-configured";
  if (!sign) return "bad-signature";
  try {
    const ok = createVerify("RSA-MD5").update(rawBody, "utf8").verify(platformPublicKeyPem, sign, "base64");
    return ok ? "ok" : "bad-signature";
  } catch {
    return "bad-signature";
  }
}

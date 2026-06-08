import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

type JsonObject = Record<string, unknown>;

export type AirwallexPaymentIntentStatus =
  | "REQUIRES_PAYMENT_METHOD"
  | "REQUIRES_CUSTOMER_ACTION"
  | "PENDING_REVIEW"
  | "REQUIRES_CAPTURE"
  | "SUCCEEDED"
  | "CANCELLED"
  | "FAILED"
  | string;

export interface AirwallexPaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: AirwallexPaymentIntentStatus;
  client_secret?: string;
  request_id?: string;
  merchant_order_id?: string;
  next_action?: unknown;
  latest_payment_attempt?: unknown;
}

export type AirwallexPaymentMethodType =
  | "card"
  | "alipaycn_qrcode"
  | "alipaycn_mobile_web"
  | "wechatpay_qrcode"
  | "wechatpay_mobile_web";

interface AirwallexLoginResponse {
  token?: string;
  expires_at?: string;
}

interface TokenCache {
  token: string;
  expiresAtMs: number;
}

let cachedToken: TokenCache | null = null;

function getBaseUrl(): string {
  return (process.env.AIRWALLEX_BASE_URL?.trim() || "https://api-demo.airwallex.com").replace(/\/+$/, "");
}

export function getAirwallexEnvironment(): "demo" | "prod" {
  return process.env.AIRWALLEX_ENV?.trim() === "prod" ? "prod" : "demo";
}

export function isAirwallexConfigured(): boolean {
  return Boolean(process.env.AIRWALLEX_CLIENT_ID?.trim() && process.env.AIRWALLEX_API_KEY?.trim());
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function parseExpiry(value: string | undefined): number {
  if (!value) return Date.now() + 30 * 60 * 1000;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now() + 30 * 60 * 1000;
}

async function readError(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) return `${response.status} ${response.statusText}`;
  try {
    const parsed = JSON.parse(text) as { message?: unknown; code?: unknown };
    const message = typeof parsed.message === "string" ? parsed.message : text;
    const code = typeof parsed.code === "string" ? parsed.code : null;
    return code ? `${code}: ${message}` : message;
  } catch {
    return text;
  }
}

async function getAccessToken(): Promise<string> {
  const refreshByMs = Date.now() + 2 * 60 * 1000;
  if (cachedToken && cachedToken.expiresAtMs > refreshByMs) return cachedToken.token;

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-client-id": getRequiredEnv("AIRWALLEX_CLIENT_ID"),
    "x-api-key": getRequiredEnv("AIRWALLEX_API_KEY"),
  };
  const loginAs = process.env.AIRWALLEX_LOGIN_AS?.trim();
  if (loginAs) headers["x-login-as"] = loginAs;

  const response = await fetch(`${getBaseUrl()}/api/v1/authentication/login`, {
    method: "POST",
    headers,
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`Airwallex authentication failed: ${await readError(response)}`);

  const body = (await response.json()) as AirwallexLoginResponse;
  if (!body.token) throw new Error("Airwallex authentication response did not include a token.");

  cachedToken = {
    token: body.token,
    expiresAtMs: parseExpiry(body.expires_at),
  };
  return body.token;
}

async function airwallexRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`Airwallex API request failed: ${await readError(response)}`);
  return (await response.json()) as T;
}

export async function createPaymentIntent(input: {
  amountFen: number;
  currency: "CNY";
  merchantOrderId: string;
  requestId: string;
  returnUrl: string;
  metadata?: JsonObject;
}): Promise<AirwallexPaymentIntent> {
  return airwallexRequest<AirwallexPaymentIntent>("/api/v1/pa/payment_intents/create", {
    method: "POST",
    body: JSON.stringify({
      amount: input.amountFen / 100,
      currency: input.currency,
      merchant_order_id: input.merchantOrderId,
      request_id: input.requestId,
      return_url: input.returnUrl,
      metadata: input.metadata,
    }),
  });
}

export async function createBindingPaymentIntent(input: {
  currency: "CNY";
  merchantOrderId: string;
  requestId: string;
  returnUrl: string;
  customerEmail: string;
  customerName: string;
  metadata?: JsonObject;
}): Promise<AirwallexPaymentIntent> {
  return airwallexRequest<AirwallexPaymentIntent>("/api/v1/pa/payment_intents/create", {
    method: "POST",
    body: JSON.stringify({
      amount: 0,
      currency: input.currency,
      merchant_order_id: input.merchantOrderId,
      request_id: input.requestId,
      return_url: input.returnUrl,
      customer: {
        email: input.customerEmail,
        first_name: input.customerName,
      },
      metadata: input.metadata,
    }),
  });
}

export async function retrievePaymentIntent(intentId: string): Promise<AirwallexPaymentIntent> {
  return airwallexRequest<AirwallexPaymentIntent>(`/api/v1/pa/payment_intents/${encodeURIComponent(intentId)}`);
}

export async function confirmPaymentIntent(input: {
  intentId: string;
  methodType: AirwallexPaymentMethodType;
  returnUrl: string;
}): Promise<AirwallexPaymentIntent> {
  const paymentMethod =
    input.methodType === "alipaycn_qrcode"
      ? {
          type: "alipaycn",
          alipaycn: {
            flow: "qrcode",
          },
        }
      : input.methodType === "alipaycn_mobile_web"
      ? {
          type: "alipaycn",
          alipaycn: {
            flow: "mobile_web",
            os_type: "android",
          },
        }
      : input.methodType === "wechatpay_qrcode"
        ? {
            type: "wechatpay",
            wechatpay: {
              flow: "qrcode",
            },
          }
        : input.methodType === "wechatpay_mobile_web"
          ? {
              type: "wechatpay",
              wechatpay: {
                flow: "mobile_web",
              },
            }
          : { type: "card" };

  return airwallexRequest<AirwallexPaymentIntent>(
    `/api/v1/pa/payment_intents/${encodeURIComponent(input.intentId)}/confirm`,
    {
      method: "POST",
      body: JSON.stringify({
        payment_method: paymentMethod,
        request_id: `${input.intentId}-${input.methodType}-${Date.now()}`.slice(0, 64),
        return_url: input.returnUrl,
      }),
    },
  );
}

export function normalizeAirwallexStatus(status: string | null | undefined): "pending" | "paid" | "failed" {
  if (status === "SUCCEEDED" || status === "succeeded" || status === "paid") return "paid";
  if (status === "FAILED" || status === "CANCELLED" || status === "failed" || status === "cancelled") {
    return "failed";
  }
  return "pending";
}

export function verifyAirwallexWebhookSignature(input: {
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
  toleranceMs?: number;
}): boolean {
  const secret = process.env.AIRWALLEX_WEBHOOK_SECRET?.trim();
  if (!secret || !input.timestamp || !input.signature) return false;

  const timestampMs = Number(input.timestamp);
  if (!Number.isFinite(timestampMs)) return false;
  if (Math.abs(Date.now() - timestampMs) > (input.toleranceMs ?? 5 * 60 * 1000)) return false;

  const expected = createHmac("sha256", secret).update(`${input.timestamp}${input.rawBody}`).digest("hex");
  const received = input.signature.trim();
  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(received, "utf8");
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

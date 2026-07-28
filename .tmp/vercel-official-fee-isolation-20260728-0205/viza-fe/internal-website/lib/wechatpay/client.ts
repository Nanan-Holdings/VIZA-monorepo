/**
 * Tiny WeChat Pay v3 REST client (Native QR flow).
 *
 * Avoids the `wechatpay-node-v3` npm package — Phase 1 only uses
 * /v3/pay/transactions/native, /v3/certificates, and the notify
 * callback decryption, all of which are small enough to do with
 * `fetch` + `node:crypto`. Mirrors the shape of `lib/stripe/client.ts`.
 *
 * WeChat Pay v3 spec references:
 * - Signing:   POST/GET\n{path}\n{ts}\n{nonce}\n{body}\n  →  RSA-SHA256 →  base64
 * - Auth hdr:  WECHATPAY2-SHA256-RSA2048 mchid="...",nonce_str="...",signature="...",
 *              timestamp="...",serial_no="..."
 * - Callback signature: header `Wechatpay-Signature` (base64) verified against the
 *   platform-cert public key whose serial is in `Wechatpay-Serial`.
 * - Callback resource:   AES-256-GCM, key=api_v3_key (32B utf8), iv=`nonce` (12B),
 *                        aad=`associated_data`, ciphertext is base64 of {ct||tag}.
 */

import {
  createHash,
  createPrivateKey,
  createPublicKey,
  createSign,
  createVerify,
  createDecipheriv,
  randomBytes,
  X509Certificate,
} from "node:crypto";

const WECHAT_PAY_API = "https://api.mch.weixin.qq.com";
const PLATFORM_CERTS_PATH = "/v3/certificates";
const NATIVE_PATH = "/v3/pay/transactions/native";

export class WechatPaySignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WechatPaySignatureError";
  }
}

interface Env {
  mchId: string;
  appId: string;
  apiV3Key: string;
  merchantSerial: string;
  privateKeyPem: string;
  notifyUrl?: string;
}

function loadEnv(): Env {
  const required = {
    mchId: process.env.WECHAT_PAY_MCH_ID,
    appId: process.env.WECHAT_PAY_APP_ID,
    apiV3Key: process.env.WECHAT_PAY_API_V3_KEY,
    merchantSerial: process.env.WECHAT_PAY_MERCHANT_SERIAL_NO,
    privateKeyPem: process.env.WECHAT_PAY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    notifyUrl: process.env.WECHAT_PAY_NOTIFY_URL,
  };
  for (const [k, v] of Object.entries(required).filter(([k]) => k !== "notifyUrl")) {
    if (!v) throw new Error(`WeChat Pay env ${k} not set`);
  }
  return required as Env;
}

function nonce(): string {
  return randomBytes(16).toString("hex");
}

function nowSeconds(): string {
  return Math.floor(Date.now() / 1000).toString();
}

function signRequest(opts: {
  method: "GET" | "POST";
  path: string;
  body: string;
  env: Env;
}): { header: string; timestamp: string; nonceStr: string } {
  const timestamp = nowSeconds();
  const nonceStr = nonce();
  const message = `${opts.method}\n${opts.path}\n${timestamp}\n${nonceStr}\n${opts.body}\n`;
  const key = createPrivateKey({ key: opts.env.privateKeyPem, format: "pem" });
  const signer = createSign("RSA-SHA256");
  signer.update(message);
  const signature = signer.sign(key).toString("base64");
  const header =
    `WECHATPAY2-SHA256-RSA2048 ` +
    `mchid="${opts.env.mchId}",` +
    `nonce_str="${nonceStr}",` +
    `signature="${signature}",` +
    `timestamp="${timestamp}",` +
    `serial_no="${opts.env.merchantSerial}"`;
  return { header, timestamp, nonceStr };
}

interface WeChatError {
  code?: string;
  message?: string;
}

async function request<T>(opts: {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
}): Promise<T> {
  const env = loadEnv();
  const bodyStr = opts.body === undefined ? "" : JSON.stringify(opts.body);
  const { header } = signRequest({
    method: opts.method,
    path: opts.path,
    body: bodyStr,
    env,
  });
  const res = await fetch(`${WECHAT_PAY_API}${opts.path}`, {
    method: opts.method,
    headers: {
      Authorization: header,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "viza-portal/wechatpay-v3",
    },
    body: opts.method === "POST" ? bodyStr : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    let detail: WeChatError = {};
    try {
      detail = JSON.parse(text) as WeChatError;
    } catch {
      // body not JSON — fall through with empty detail
    }
    throw new Error(
      `WeChat Pay ${opts.path}: ${res.status} ${detail.code ?? ""} ${detail.message ?? text}`.trim(),
    );
  }
  return JSON.parse(text) as T;
}

// =============================================================================
// Public: create a Native (QR) order
// =============================================================================

export interface CreateNativeInput {
  outTradeNo: string;
  amountFen: number;
  description: string;
  notifyUrl?: string;
}

export interface CreateNativeOutput {
  codeUrl: string;
}

export async function createNativeOrder(
  input: CreateNativeInput,
): Promise<CreateNativeOutput> {
  const env = loadEnv();
  const notifyUrl = input.notifyUrl ?? env.notifyUrl;
  if (!notifyUrl) {
    throw new Error("WeChat Pay notify URL is not configured");
  }
  const res = await request<{ code_url?: string }>({
    method: "POST",
    path: NATIVE_PATH,
    body: {
      appid: env.appId,
      mchid: env.mchId,
      description: input.description,
      out_trade_no: input.outTradeNo,
      notify_url: notifyUrl,
      amount: { total: input.amountFen, currency: "CNY" },
    },
  });
  if (!res.code_url) {
    throw new Error("WeChat Pay native: no code_url in response");
  }
  return { codeUrl: res.code_url };
}

// =============================================================================
// Public: callback signature verification + resource decryption
// =============================================================================

export interface CallbackHeaders {
  signature: string | null;
  serial: string | null;
  timestamp: string | null;
  nonce: string | null;
}

export function readCallbackHeaders(
  h: Headers | Record<string, string | null | undefined>,
): CallbackHeaders {
  const get = (name: string): string | null => {
    if (h instanceof Headers) return h.get(name);
    return h[name] ?? h[name.toLowerCase()] ?? null;
  };
  return {
    signature: get("Wechatpay-Signature"),
    serial: get("Wechatpay-Serial"),
    timestamp: get("Wechatpay-Timestamp"),
    nonce: get("Wechatpay-Nonce"),
  };
}

/**
 * Verify the callback HMAC against the platform cert whose serial is
 * advertised in `Wechatpay-Serial`. Throws WechatPaySignatureError if
 * the signature is invalid or the cert is unknown.
 */
export async function verifyCallbackSignature(
  headers: CallbackHeaders,
  rawBody: string,
): Promise<void> {
  if (
    !headers.signature ||
    !headers.serial ||
    !headers.timestamp ||
    !headers.nonce
  ) {
    throw new WechatPaySignatureError("missing wechat-pay headers");
  }
  // Reject signatures older than 5 minutes (replay window).
  const skew = Math.abs(Date.now() / 1000 - Number(headers.timestamp));
  if (!Number.isFinite(skew) || skew > 300) {
    throw new WechatPaySignatureError(`timestamp skew ${skew}s`);
  }
  const certPem = await getPlatformCertPem(headers.serial);
  const message = `${headers.timestamp}\n${headers.nonce}\n${rawBody}\n`;
  const verifier = createVerify("RSA-SHA256");
  verifier.update(message);
  const ok = verifier.verify(
    createPublicKey(certPem),
    Buffer.from(headers.signature, "base64"),
  );
  if (!ok) throw new WechatPaySignatureError("signature mismatch");
}

export interface DecryptedResource {
  // Native callbacks deliver a transaction. Other fields exist but
  // these are the ones we read.
  transaction_id?: string;
  out_trade_no?: string;
  trade_state?: string;
  trade_state_desc?: string;
  success_time?: string;
  payer?: { openid?: string };
  amount?: { total?: number; payer_total?: number; currency?: string };
}

export function decryptCallbackResource(resource: {
  algorithm: string;
  ciphertext: string;
  associated_data?: string;
  nonce: string;
}): DecryptedResource {
  const env = loadEnv();
  if (resource.algorithm !== "AEAD_AES_256_GCM") {
    throw new Error(`unsupported algorithm ${resource.algorithm}`);
  }
  const key = Buffer.from(env.apiV3Key, "utf8");
  if (key.length !== 32) {
    throw new Error("WECHAT_PAY_API_V3_KEY must be 32 bytes");
  }
  const data = Buffer.from(resource.ciphertext, "base64");
  // GCM ciphertext = ct || tag(16)
  const tag = data.subarray(data.length - 16);
  const ct = data.subarray(0, data.length - 16);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(resource.nonce, "utf8"),
  );
  decipher.setAuthTag(tag);
  if (resource.associated_data) {
    decipher.setAAD(Buffer.from(resource.associated_data, "utf8"));
  }
  const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8")) as DecryptedResource;
}

// =============================================================================
// Platform certificate cache
//
// /v3/certificates returns the merchant's platform certs, encrypted under
// api_v3_key. We decrypt, cache by serial, and refresh on TTL miss.
// =============================================================================

interface CachedCert {
  pem: string;
  notAfter: number; // epoch ms
  fetchedAt: number;
}

const certCache = new Map<string, CachedCert>();

function cacheTtlMs(): number {
  const ttl = Number(process.env.WECHAT_PAY_PLATFORM_CERT_CACHE_TTL_S ?? 3600);
  return Math.max(60, ttl) * 1000;
}

async function getPlatformCertPem(serial: string): Promise<string> {
  const hit = certCache.get(serial);
  if (hit && Date.now() - hit.fetchedAt < cacheTtlMs()) return hit.pem;
  await refreshPlatformCerts();
  const fresh = certCache.get(serial);
  if (!fresh) {
    throw new WechatPaySignatureError(`unknown platform cert serial ${serial}`);
  }
  return fresh.pem;
}

async function refreshPlatformCerts(): Promise<void> {
  const res = await request<{
    data?: Array<{
      serial_no: string;
      expire_time?: string;
      encrypt_certificate: {
        algorithm: string;
        ciphertext: string;
        associated_data?: string;
        nonce: string;
      };
    }>;
  }>({ method: "GET", path: PLATFORM_CERTS_PATH });
  if (!res.data) return;
  for (const entry of res.data) {
    const env = loadEnv();
    if (entry.encrypt_certificate.algorithm !== "AEAD_AES_256_GCM") continue;
    const key = Buffer.from(env.apiV3Key, "utf8");
    const ciphertext = Buffer.from(entry.encrypt_certificate.ciphertext, "base64");
    const tag = ciphertext.subarray(ciphertext.length - 16);
    const ct = ciphertext.subarray(0, ciphertext.length - 16);
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(entry.encrypt_certificate.nonce, "utf8"),
    );
    decipher.setAuthTag(tag);
    if (entry.encrypt_certificate.associated_data) {
      decipher.setAAD(
        Buffer.from(entry.encrypt_certificate.associated_data, "utf8"),
      );
    }
    const pem = Buffer.concat([decipher.update(ct), decipher.final()]).toString(
      "utf8",
    );
    const cert = new X509Certificate(pem);
    certCache.set(entry.serial_no, {
      pem,
      notAfter: Date.parse(cert.validTo),
      fetchedAt: Date.now(),
    });
  }
}

// =============================================================================
// Misc helpers
// =============================================================================

export function generateOutTradeNo(orderId: string): string {
  // Merchant out_trade_no spec: 6–32 chars, [a-zA-Z0-9_*-]. We embed
  // the order UUID (stripped of dashes) + a short hash of the current
  // ms to guarantee uniqueness across retries that reuse the order id.
  const h = createHash("sha256")
    .update(`${orderId}:${Date.now()}`)
    .digest("hex")
    .slice(0, 8);
  return `viza_${orderId.replace(/-/g, "")}_${h}`;
}

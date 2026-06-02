import "server-only";

import { createPrivateKey, createPublicKey, createSign, createVerify } from "node:crypto";

const DEFAULT_GATEWAY = "https://openapi.alipay.com/gateway.do";

export class AlipayConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AlipayConfigError";
  }
}

interface AlipayConfig {
  appId: string;
  privateKeyPem: string;
  alipayPublicKeyPem: string;
  gatewayUrl: string;
}

function wrapPem(base64Body: string, label: string): string {
  const keyType = label === "ALIPAY_PRIVATE_KEY" ? "PRIVATE KEY" : "PUBLIC KEY";
  const normalizedBody = base64Body.replace(/\s+/g, "");
  const lines = normalizedBody.match(/.{1,64}/g)?.join("\n") ?? normalizedBody;
  return `-----BEGIN ${keyType}-----\n${lines}\n-----END ${keyType}-----`;
}

function normalizePem(value: string | undefined, label: string): string {
  const normalized = value?.replace(/\\n/g, "\n").trim();
  if (!normalized) throw new AlipayConfigError(`${label} is not configured.`);
  if (normalized.includes("-----BEGIN ")) return normalized;
  return wrapPem(normalized, label);
}

function normalizeAppId(value: string | undefined): string {
  const appId = value?.trim();
  if (!appId) throw new AlipayConfigError("ALIPAY_APP_ID is not configured.");
  if (!/^\d{10,32}$/.test(appId)) {
    throw new AlipayConfigError("ALIPAY_APP_ID must be the numeric Alipay Open Platform application ID.");
  }
  return appId;
}

function loadConfig(): AlipayConfig {
  const appId = normalizeAppId(process.env.ALIPAY_APP_ID);

  return {
    appId,
    privateKeyPem: normalizePem(process.env.ALIPAY_PRIVATE_KEY, "ALIPAY_PRIVATE_KEY"),
    alipayPublicKeyPem: normalizePem(process.env.ALIPAY_PUBLIC_KEY, "ALIPAY_PUBLIC_KEY"),
    gatewayUrl: process.env.ALIPAY_GATEWAY_URL?.trim() || DEFAULT_GATEWAY,
  };
}

export function isAlipayConfigReady(): boolean {
  try {
    const config = loadConfig();
    createPrivateKey(config.privateKeyPem);
    createPublicKey(config.alipayPublicKeyPem);
    return true;
  } catch {
    return false;
  }
}

export function getAlipayAppId(): string {
  return loadConfig().appId;
}

function alipayTimestamp(): string {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    " ",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
    ":",
    pad(date.getSeconds()),
  ].join("");
}

function canonicalize(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((key) => key !== "sign" && key !== "sign_type" && params[key] !== "")
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
}

function signParams(params: Record<string, string>, privateKeyPem: string): string {
  const signer = createSign("RSA-SHA256");
  signer.update(canonicalize(params), "utf8");
  return signer.sign(createPrivateKey(privateKeyPem), "base64");
}

export interface CreateAlipayPagePayInput {
  outTradeNo: string;
  subject: string;
  totalAmountYuan: string;
  notifyUrl: string;
  returnUrl: string;
}

export function createAlipayPagePayUrl(input: CreateAlipayPagePayInput): string {
  const config = loadConfig();
  const params: Record<string, string> = {
    app_id: config.appId,
    method: "alipay.trade.page.pay",
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: alipayTimestamp(),
    version: "1.0",
    notify_url: input.notifyUrl,
    return_url: input.returnUrl,
    biz_content: JSON.stringify({
      out_trade_no: input.outTradeNo,
      product_code: "FAST_INSTANT_TRADE_PAY",
      total_amount: input.totalAmountYuan,
      subject: input.subject,
    }),
  };

  params.sign = signParams(params, config.privateKeyPem);

  const url = new URL(config.gatewayUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export function verifyAlipayNotify(params: Record<string, string>): boolean {
  const config = loadConfig();
  const signature = params.sign;
  if (!signature) return false;

  try {
    const verifier = createVerify("RSA-SHA256");
    verifier.update(canonicalize(params), "utf8");
    return verifier.verify(createPublicKey(config.alipayPublicKeyPem), signature, "base64");
  } catch {
    return false;
  }
}

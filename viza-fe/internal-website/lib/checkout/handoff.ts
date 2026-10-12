import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { cookies } from "next/headers";

export const CHECKOUT_HANDOFF_COOKIE = "viza_checkout_handoff";
export const CHECKOUT_HANDOFF_TTL_SECONDS = 10 * 60;

export type CheckoutHandoff = {
  paymentMethod: "card" | "wechat";
  country: string;
  visaType: string;
  locale: "en" | "zh-CN";
  email: string;
  fullName: string;
  prefill: string;
  betaToken: string;
  expiresAt: number;
};

function keyFrom(encodedKey = process.env.CHECKOUT_HANDOFF_ENCRYPTION_KEY?.trim()): Buffer {
  const key = encodedKey ? Buffer.from(encodedKey, "base64") : Buffer.alloc(0);
  if (key.length !== 32) {
    throw new Error("CHECKOUT_HANDOFF_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  }
  return key;
}

export function sealCheckoutHandoff(
  payload: Omit<CheckoutHandoff, "expiresAt">,
  encodedKey?: string,
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(encodedKey), iv);
  const plaintext = deflateRawSync(Buffer.from(JSON.stringify({
    ...payload,
    expiresAt: Date.now() + CHECKOUT_HANDOFF_TTL_SECONDS * 1_000,
  } satisfies CheckoutHandoff), "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function openCheckoutHandoff(value: string, encodedKey?: string): CheckoutHandoff | null {
  try {
    const [version, iv, tag, ciphertext, extra] = value.split(".");
    if (version !== "v1" || !iv || !tag || !ciphertext || extra) return null;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      keyFrom(encodedKey),
      Buffer.from(iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const compressed = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final(),
    ]);
    const plaintext = inflateRawSync(compressed, { maxOutputLength: 16_384 }).toString("utf8");
    const payload = JSON.parse(plaintext) as CheckoutHandoff;
    if (!Number.isFinite(payload.expiresAt) || payload.expiresAt <= Date.now()) return null;
    if (!(["card", "wechat"] as const).includes(payload.paymentMethod)) return null;
    if (!(["en", "zh-CN"] as const).includes(payload.locale)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function readCheckoutHandoff(
  paymentMethod: CheckoutHandoff["paymentMethod"],
): Promise<CheckoutHandoff | null> {
  const value = (await cookies()).get(CHECKOUT_HANDOFF_COOKIE)?.value;
  if (!value) return null;
  const payload = openCheckoutHandoff(value);
  return payload?.paymentMethod === paymentMethod ? payload : null;
}

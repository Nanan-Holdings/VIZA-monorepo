/**
 * RFC 6238 TOTP generator. Inline so the worker can compute ImmiAccount
 * MFA codes from a base32-encoded shared secret without pulling another
 * dependency. Defaults match the standard ImmiAccount authenticator
 * config (SHA-1, 6-digit, 30s window).
 */

import { createHmac } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(input: string): Buffer {
  const cleaned = input.replace(/\s+/g, "").replace(/=+$/, "").toUpperCase();
  if (cleaned.length === 0) return Buffer.alloc(0);

  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (const char of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) {
      throw new Error(`Invalid base32 character "${char}" in TOTP secret`);
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 0xff);
    }
  }

  return Buffer.from(bytes);
}

export interface TotpOptions {
  /** Period in seconds (default 30). */
  period?: number;
  /** Code length (default 6). */
  digits?: number;
  /** Hash algorithm (default sha1). */
  algorithm?: "sha1" | "sha256" | "sha512";
  /** Override clock for tests (epoch ms). */
  nowMs?: number;
}

/**
 * Generate a TOTP code for the given base32 secret. Throws on malformed
 * secret. Used by the AU runner to satisfy ImmiAccount's TOTP MFA prompt.
 */
export function generateTotp(secret: string, options: TotpOptions = {}): string {
  const period = options.period ?? 30;
  const digits = options.digits ?? 6;
  const algorithm = options.algorithm ?? "sha1";
  const nowMs = options.nowMs ?? Date.now();

  const counter = Math.floor(nowMs / 1000 / period);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));

  const key = base32Decode(secret);
  const hmac = createHmac(algorithm, key).update(counterBuf).digest();

  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const code = binary % 10 ** digits;
  return code.toString().padStart(digits, "0");
}

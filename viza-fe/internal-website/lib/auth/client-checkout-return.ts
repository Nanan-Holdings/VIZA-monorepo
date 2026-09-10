export const CLIENT_CHECKOUT_BETA_COOKIE = "viza_client_checkout_beta";
export const CLIENT_CHECKOUT_BETA_TTL_SECONDS = 10 * 60;

export type StoredCheckoutBeta = {
  token: string;
  deliveryMethod: "promo_code" | "link_suffix" | "";
  returnTo?: string;
  expiresAt: number;
};

function decodeKey(encodedKey = process.env.CHECKOUT_HANDOFF_ENCRYPTION_KEY?.trim()): Uint8Array {
  if (!encodedKey) throw new Error("CHECKOUT_HANDOFF_ENCRYPTION_KEY is required");
  let binary: string;
  try {
    binary = atob(encodedKey);
  } catch {
    throw new Error("CHECKOUT_HANDOFF_ENCRYPTION_KEY must be valid base64");
  }
  const key = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (key.length !== 32) {
    throw new Error("CHECKOUT_HANDOFF_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  }
  return key;
}

function asArrayBuffer(value: Uint8Array): ArrayBuffer {
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
}

function encodeBase64Url(value: Uint8Array): string {
  let binary = "";
  value.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function betaFromCheckoutUrl(url: URL): StoredCheckoutBeta | null {
  const token = (url.searchParams.get("betaToken") || url.searchParams.get("beta") || "").trim();
  if (!token) return null;
  const requestedMethod = (
    url.searchParams.get("betaDeliveryMethod") || url.searchParams.get("deliveryMethod") || ""
  ).trim();
  const deliveryMethod = requestedMethod === "promo_code" || requestedMethod === "link_suffix"
    ? requestedMethod
    : "";
  return {
    token: token.slice(0, 128),
    deliveryMethod,
    expiresAt: Date.now() + CLIENT_CHECKOUT_BETA_TTL_SECONDS * 1_000,
  };
}

export function removeBetaFromCheckoutUrl(url: URL): URL {
  const clean = new URL(url);
  clean.searchParams.delete("beta");
  clean.searchParams.delete("betaToken");
  clean.searchParams.delete("betaDeliveryMethod");
  clean.searchParams.delete("deliveryMethod");
  return clean;
}

export async function sealCheckoutBeta(
  payload: StoredCheckoutBeta,
  encodedKey?: string,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey("raw", asArrayBuffer(decodeKey(encodedKey)), "AES-GCM", false, ["encrypt"]);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: asArrayBuffer(iv) },
    key,
    asArrayBuffer(plaintext),
  ));
  return `v1.${encodeBase64Url(iv)}.${encodeBase64Url(encrypted)}`;
}

export async function openCheckoutBeta(
  value: string,
  encodedKey?: string,
): Promise<StoredCheckoutBeta | null> {
  try {
    const [version, ivValue, encryptedValue, extra] = value.split(".");
    if (version !== "v1" || !ivValue || !encryptedValue || extra) return null;
    const key = await crypto.subtle.importKey("raw", asArrayBuffer(decodeKey(encodedKey)), "AES-GCM", false, ["decrypt"]);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: asArrayBuffer(decodeBase64Url(ivValue)) },
      key,
      asArrayBuffer(decodeBase64Url(encryptedValue)),
    );
    const payload = JSON.parse(new TextDecoder().decode(plaintext)) as StoredCheckoutBeta;
    if (!Number.isFinite(payload.expiresAt) || payload.expiresAt <= Date.now()) return null;
    if (typeof payload.token !== "string" || !payload.token || payload.token.length > 128) return null;
    if (!(["", "promo_code", "link_suffix"] as const).includes(payload.deliveryMethod)) return null;
    return payload;
  } catch {
    return null;
  }
}

/* Vendored from Kelin-Studio/kelin-social@9cf1e11 (src/oauth1.ts). Edit there and re-sync. */
/* OAuth 1.0a request signing (HMAC-SHA1), RFC 5849.

   X still accepts OAuth 1.0a user context for posting, and its user tokens do
   not expire, which spares us a refresh loop for a single account we own.
   Only query and form-encoded parameters are signed; a JSON or multipart body
   is not part of the signature. */
import { createHmac, randomBytes } from "node:crypto";

export type OAuth1Credentials = {
  consumerKey: string;
  consumerSecret: string;
  token: string;
  tokenSecret: string;
};

/** RFC 3986 encoding, which is stricter than encodeURIComponent. */
export function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function signatureBaseString(method: string, url: string, params: Array<[string, string]>): string {
  const u = new URL(url);
  const all: Array<[string, string]> = [...params];
  u.searchParams.forEach((v, k) => all.push([k, v]));
  const normalised = all
    .map(([k, v]) => [percentEncode(k), percentEncode(v)] as const)
    .sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) : a[0] < b[0] ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const baseUrl = `${u.protocol}//${u.host}${u.pathname}`;
  return [method.toUpperCase(), percentEncode(baseUrl), percentEncode(normalised)].join("&");
}

export function authorizationHeader(
  method: string,
  url: string,
  creds: OAuth1Credentials,
  /** Form-encoded body parameters, which are signed. Leave empty for JSON or multipart. */
  formParams: Record<string, string> = {},
  /** Fixed values for tests; real calls let these default. */
  fixed: { nonce?: string; timestamp?: string } = {},
): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: creds.consumerKey,
    oauth_nonce: fixed.nonce ?? randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: fixed.timestamp ?? Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.token,
    oauth_version: "1.0",
  };
  const base = signatureBaseString(method, url, [...Object.entries(oauth), ...Object.entries(formParams)]);
  const key = `${percentEncode(creds.consumerSecret)}&${percentEncode(creds.tokenSecret)}`;
  oauth.oauth_signature = createHmac("sha1", key).update(base).digest("base64");
  return (
    "OAuth " +
    Object.keys(oauth)
      .sort()
      .map((k) => `${percentEncode(k)}="${percentEncode(oauth[k])}"`)
      .join(", ")
  );
}

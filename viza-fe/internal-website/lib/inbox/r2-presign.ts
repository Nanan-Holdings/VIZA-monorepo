import { createHash, createHmac } from "node:crypto";

/**
 * Cloudflare R2 presigned-URL helper (INBOX-006).
 *
 * R2 speaks the S3 SigV4 dialect, so we can mint a time-limited GET URL
 * with nothing but `node:crypto`. Saves dragging in the AWS SDK.
 *
 * Required env (server-only, never bundled):
 *   R2_ACCOUNT_ID            — Cloudflare account id (UUID-ish)
 *   R2_ACCESS_KEY_ID         — R2 API token, S3-compatible
 *   R2_SECRET_ACCESS_KEY     — paired secret
 *   R2_INBOX_BUCKET          — bucket name (matches Worker binding bucket)
 *
 * Endpoint shape:
 *   https://<account>.r2.cloudflarestorage.com/<bucket>/<key>
 */

const SERVICE = "s3";
const REGION = "auto";
const ALGORITHM = "AWS4-HMAC-SHA256";

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

function sha256Hex(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

function rfc3986(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) =>
    "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

export interface R2PresignOpts {
  /** Key under the bucket, e.g. `inbound/<alias>/<stamp>-<id>.eml`. */
  key: string;
  /** TTL in seconds, max 7 days (S3 limit). Default 5 minutes. */
  expiresIn?: number;
}

export function presignR2Get(opts: R2PresignOpts): string {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_INBOX_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      "R2 env not configured: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_INBOX_BUCKET",
    );
  }
  const expiresIn = Math.min(opts.expiresIn ?? 300, 7 * 24 * 3600);
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const now = new Date();
  const amzDate = now
    .toISOString()
    .replace(/[:-]|\.\d{3}/g, "")
    .replace("Z", "Z");
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;

  // Encode the path: bucket + key. R2 expects the bucket in the path.
  const canonicalUri =
    "/" + rfc3986(bucket) + "/" + opts.key.split("/").map(rfc3986).join("/");

  const params: Record<string, string> = {
    "X-Amz-Algorithm": ALGORITHM,
    "X-Amz-Credential": `${accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresIn),
    "X-Amz-SignedHeaders": "host",
  };
  const canonicalQuerystring = Object.keys(params)
    .sort()
    .map((k) => `${rfc3986(k)}=${rfc3986(params[k])}`)
    .join("&");

  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = "host";
  const payloadHash = "UNSIGNED-PAYLOAD";

  const canonicalRequest = [
    "GET",
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const stringToSign = [
    ALGORITHM,
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmac("AWS4" + secretAccessKey, dateStamp);
  const kRegion = hmac(kDate, REGION);
  const kService = hmac(kRegion, SERVICE);
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

  return `https://${host}${canonicalUri}?${canonicalQuerystring}&X-Amz-Signature=${signature}`;
}

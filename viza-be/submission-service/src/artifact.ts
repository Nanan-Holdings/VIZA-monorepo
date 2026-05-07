import { Buffer } from "node:buffer";
import { supabase } from "./supabase.js";

/**
 * Generic artefact bucket helper (INFRA-006).
 *
 * Single API for runner-job artefacts (screenshots, HAR captures,
 * submission PDFs). Layered on top of the existing
 * `submission-artifacts` Supabase Storage bucket, but addressed by
 * runner_job id rather than the user/application/country path the
 * legacy uploadArtifact helper uses. Both helpers coexist; this one
 * is the canonical entry for new code.
 *
 * Path layout under the bucket:
 *
 *   jobs/{jobId}/{name}
 *
 * `name` is treated as caller-supplied path within the job folder, so
 * runners can group screenshots like `step-01.png`, `har/network.har`,
 * `pdf/confirmation.pdf`.
 *
 * Bucket lifecycle (configured on the bucket itself, not in Postgres):
 *   - Live: 90 days, hot-tier reads
 *   - 91d → 365d: glacier-class
 *   - >365d: deleted unless explicitly tagged `legal_hold=true`
 *
 * Signed URLs default to 5 minutes — long enough for a staff-portal
 * download click, short enough to bound the leak window.
 */

export const ARTIFACT_BUCKET = "submission-artifacts";

const DEFAULT_SIGNED_URL_TTL_S = 300;

export interface ArtifactRef {
  /** Full bucket path, e.g. `jobs/<uuid>/step-01.png`. */
  path: string;
  /** Pre-signed GET URL valid for `ttlSeconds`. */
  signedUrl: string;
  /** Bytes uploaded. */
  sizeBytes: number;
  contentType: string;
  ttlSeconds: number;
}

export interface PutOpts {
  contentType?: string;
  /** Override default signed-URL TTL in seconds. Max 7 days. */
  ttlSeconds?: number;
  /** Overwrite an existing object at the same path. Default false. */
  upsert?: boolean;
}

export const artifact = {
  /**
   * Upload bytes and return a signed URL. `name` is appended under
   * `jobs/<jobId>/`.
   */
  async put(
    jobId: string,
    name: string,
    body: Buffer | Uint8Array | string,
    opts: PutOpts = {},
  ): Promise<ArtifactRef> {
    const buffer =
      typeof body === "string"
        ? Buffer.from(body, "utf8")
        : body instanceof Buffer
          ? body
          : Buffer.from(body);
    const path = `jobs/${jobId}/${name.replace(/^\/+/, "")}`;
    const contentType = opts.contentType ?? "application/octet-stream";
    const { error: upErr } = await supabase.storage
      .from(ARTIFACT_BUCKET)
      .upload(path, buffer, {
        contentType,
        upsert: opts.upsert ?? false,
      });
    if (upErr) {
      throw new Error(`artifact.put(${path}) upload: ${upErr.message}`);
    }
    const ttl = Math.min(opts.ttlSeconds ?? DEFAULT_SIGNED_URL_TTL_S, 7 * 24 * 3600);
    const { data: signed, error: signErr } = await supabase.storage
      .from(ARTIFACT_BUCKET)
      .createSignedUrl(path, ttl);
    if (signErr || !signed) {
      throw new Error(`artifact.put(${path}) sign: ${signErr?.message}`);
    }
    return {
      path,
      signedUrl: signed.signedUrl,
      sizeBytes: buffer.byteLength,
      contentType,
      ttlSeconds: ttl,
    };
  },

  /** List artefacts under a job. Returns paths only. */
  async list(jobId: string): Promise<string[]> {
    const prefix = `jobs/${jobId}`;
    const { data, error } = await supabase.storage
      .from(ARTIFACT_BUCKET)
      .list(prefix, { limit: 1000 });
    if (error) {
      throw new Error(`artifact.list(${prefix}): ${error.message}`);
    }
    return (data ?? []).map((d) => `${prefix}/${d.name}`);
  },

  /** Mint a fresh signed URL for an existing artefact. */
  async sign(path: string, ttlSeconds = DEFAULT_SIGNED_URL_TTL_S): Promise<string> {
    const { data, error } = await supabase.storage
      .from(ARTIFACT_BUCKET)
      .createSignedUrl(path, ttlSeconds);
    if (error || !data) {
      throw new Error(`artifact.sign(${path}): ${error?.message}`);
    }
    return data.signedUrl;
  },

  /** Remove an artefact. Use sparingly — retention purge owns lifecycle. */
  async remove(path: string): Promise<void> {
    const { error } = await supabase.storage.from(ARTIFACT_BUCKET).remove([path]);
    if (error) {
      throw new Error(`artifact.remove(${path}): ${error.message}`);
    }
  },
};

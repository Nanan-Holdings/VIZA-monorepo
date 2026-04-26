import * as fs from "node:fs";
import { supabase } from "./supabase";

/**
 * Single private bucket for per-country runner artifacts. Path layout:
 *
 *   {authUserId}/{applicationId}/{countryCode}/{kind}-{utcMillis}.{ext}
 *
 * RLS policy on storage.objects ties the first path segment to auth.uid()
 * so signed URLs minted by the agent-backend stay scoped to the owner.
 */
export const SUBMISSION_ARTIFACTS_BUCKET = "submission-artifacts";

export type CountryCode = "US" | "FR" | "UK" | "VN";

export interface UploadArtifactInput {
  authUserId: string;
  applicationId: string;
  country: CountryCode;
  /** Short kind tag, e.g. "dat", "cerfa", "screenshot". */
  kind: string;
  /** File extension without the leading dot, e.g. "pdf". */
  ext: string;
  /** Content-Type for the upload. */
  contentType: string;
  /** Raw bytes to upload. Prefer this when the source is already in memory. */
  data?: Buffer;
  /** Local file path; read into memory if `data` is omitted. */
  filePath?: string;
}

/**
 * Upload an artifact to the submission-artifacts bucket and return the
 * storage path (suitable for persisting on applications.submission_result).
 */
export async function uploadArtifact(input: UploadArtifactInput): Promise<string> {
  const buffer =
    input.data ?? (input.filePath ? fs.readFileSync(input.filePath) : null);
  if (!buffer) {
    throw new Error("uploadArtifact requires either `data` or `filePath`");
  }
  const ts = Date.now();
  const path = `${input.authUserId}/${input.applicationId}/${input.country}/${input.kind}-${ts}.${input.ext}`;

  const { error } = await supabase.storage
    .from(SUBMISSION_ARTIFACTS_BUCKET)
    .upload(path, buffer, {
      contentType: input.contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(
      `uploadArtifact(${input.country}/${input.kind}) failed: ${error.message}`,
    );
  }
  return path;
}

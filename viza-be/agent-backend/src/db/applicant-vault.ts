import { getSupabaseClient } from "./supabase-client.js";
import { decryptSecret, encryptSecret } from "../utils/secret-cipher.js";
import { Logger } from "../utils/logger.js";

/**
 * Per-applicant credential vault (SECRETS-001).
 *
 * Single trusted code path for reading and writing portal credentials,
 * captcha keys, and other per-applicant secrets. Backed by the
 * `applicant_secret` table with RLS guarding metadata access; the
 * encryption key (SUBMISSION_RESULT_SECRET_KEY) is required to recover
 * plaintext, so a leaked DB alone does not expose secrets.
 *
 * Public API:
 *   - vault.get(applicant_id, key) → string | null  (decrypted)
 *   - vault.set(applicant_id, key, value, note?)    (encrypts + upserts)
 *   - vault.delete(applicant_id, key)
 *
 * Service-role client only. Frontend MUST NOT import this module.
 */

const logger = new Logger({ serviceName: "ApplicantVault" });
const TABLE = "applicant_secret";

export async function getApplicantSecret(
  applicantId: string,
  key: string,
): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("ciphertext")
    .eq("applicant_id", applicantId)
    .eq("key", key)
    .maybeSingle();

  if (error) {
    logger.error("vault_get_failed", new Error(error.message), {
      applicantId,
      key,
    });
    throw new Error(`vault.get(${key}) failed: ${error.message}`);
  }
  if (!data) return null;

  try {
    return decryptSecret(data.ciphertext);
  } catch (err) {
    const wrapped = err instanceof Error ? err : new Error(String(err));
    logger.error("vault_decrypt_failed", wrapped, { applicantId, key });
    throw new Error(`vault.get(${key}) decrypt failed`);
  }
}

export async function setApplicantSecret(
  applicantId: string,
  key: string,
  plaintext: string,
  note?: string,
): Promise<void> {
  const supabase = getSupabaseClient();
  const ciphertext = encryptSecret(plaintext);

  const { error } = await supabase
    .from(TABLE)
    .upsert(
      {
        applicant_id: applicantId,
        key,
        ciphertext,
        note: note ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "applicant_id,key" },
    );

  if (error) {
    logger.error("vault_set_failed", new Error(error.message), {
      applicantId,
      key,
    });
    throw new Error(`vault.set(${key}) failed: ${error.message}`);
  }
}

export async function deleteApplicantSecret(
  applicantId: string,
  key: string,
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("applicant_id", applicantId)
    .eq("key", key);

  if (error) {
    logger.error("vault_delete_failed", new Error(error.message), {
      applicantId,
      key,
    });
    throw new Error(`vault.delete(${key}) failed: ${error.message}`);
  }
}

export const applicantVault = {
  get: getApplicantSecret,
  set: setApplicantSecret,
  delete: deleteApplicantSecret,
};

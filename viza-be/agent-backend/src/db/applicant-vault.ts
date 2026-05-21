import { getSupabaseClient } from "./supabase-client.js";
import { decryptSecret, encryptSecret } from "../utils/secret-cipher.js";
import { Logger } from "../utils/logger.js";

/**
 * Per-applicant credential vault (SECRETS-001) + audit log (SECRETS-003).
 *
 * Single trusted code path for reading and writing portal credentials,
 * captcha keys, and other per-applicant secrets. Backed by the
 * `applicant_secret` table with RLS guarding metadata access; the
 * encryption key (SUBMISSION_RESULT_SECRET_KEY) is required to recover
 * plaintext, so a leaked DB alone does not expose secrets.
 *
 * Every operation appends a row to `secret_access_log` for forensic
 * traceability. The log records (applicant_id, key, action, actor, ts)
 * — never the plaintext or ciphertext itself.
 *
 * Public API:
 *   - vault.get(applicant_id, key, opts?) → string | null
 *   - vault.set(applicant_id, key, value, opts?)
 *   - vault.delete(applicant_id, key, opts?)
 *
 * `opts.actor` is required by convention (defaults to `unknown` if the
 * caller forgets — surfaced loudly in the log so the omission is visible).
 *
 * Service-role client only. Frontend MUST NOT import this module.
 */

const logger = new Logger({ serviceName: "ApplicantVault" });
const TABLE = "applicant_secret";
const LOG_TABLE = "secret_access_log";

export type VaultAction = "read" | "read_miss" | "write" | "delete";

export interface VaultOpts {
  /** Identifier of the calling service / job. Free-form. */
  actor?: string;
  /** Optional run / request correlation id. */
  correlationId?: string;
}

interface AppendLogArgs {
  applicantId: string;
  key: string;
  action: VaultAction;
  actor: string;
  correlationId?: string;
  errorClass?: string;
}

async function appendAccessLog(args: AppendLogArgs): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from(LOG_TABLE).insert({
      applicant_id: args.applicantId,
      key: args.key,
      action: args.action,
      actor: args.actor,
      correlation_id: args.correlationId ?? null,
      error_class: args.errorClass ?? null,
    });
    if (error) {
      // Audit failure must NEVER mask the underlying operation. Log loud
      // and continue — the alternative (refusing the read because the log
      // failed) is worse than a missing audit row.
      logger.error("vault_audit_log_failed", new Error(error.message), {
        applicantId: args.applicantId,
        key: args.key,
        action: args.action,
      });
    }
  } catch (err) {
    const wrapped = err instanceof Error ? err : new Error(String(err));
    logger.error("vault_audit_log_threw", wrapped, {
      applicantId: args.applicantId,
      key: args.key,
      action: args.action,
    });
  }
}

export async function getApplicantSecret(
  applicantId: string,
  key: string,
  opts?: VaultOpts,
): Promise<string | null> {
  const actor = opts?.actor ?? "unknown@agent-backend";
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("ciphertext")
    .eq("applicant_id", applicantId)
    .eq("key", key)
    .maybeSingle();

  if (error) {
    logger.error("vault_get_failed", new Error(error.message), { applicantId, key });
    await appendAccessLog({
      applicantId,
      key,
      action: "read",
      actor,
      correlationId: opts?.correlationId,
      errorClass: "PostgrestError",
    });
    throw new Error(`vault.get(${key}) failed: ${error.message}`);
  }
  if (!data) {
    await appendAccessLog({
      applicantId,
      key,
      action: "read_miss",
      actor,
      correlationId: opts?.correlationId,
    });
    return null;
  }

  try {
    const plaintext = decryptSecret(data.ciphertext);
    await appendAccessLog({
      applicantId,
      key,
      action: "read",
      actor,
      correlationId: opts?.correlationId,
    });
    return plaintext;
  } catch (err) {
    const wrapped = err instanceof Error ? err : new Error(String(err));
    logger.error("vault_decrypt_failed", wrapped, { applicantId, key });
    await appendAccessLog({
      applicantId,
      key,
      action: "read",
      actor,
      correlationId: opts?.correlationId,
      errorClass: "DecryptError",
    });
    throw new Error(`vault.get(${key}) decrypt failed`);
  }
}

export async function setApplicantSecret(
  applicantId: string,
  key: string,
  plaintext: string,
  opts?: VaultOpts & { note?: string },
): Promise<void> {
  const actor = opts?.actor ?? "unknown@agent-backend";
  const supabase = getSupabaseClient();
  const ciphertext = encryptSecret(plaintext);

  const { error } = await supabase.from(TABLE).upsert(
    {
      applicant_id: applicantId,
      key,
      ciphertext,
      note: opts?.note ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "applicant_id,key" },
  );

  if (error) {
    logger.error("vault_set_failed", new Error(error.message), { applicantId, key });
    await appendAccessLog({
      applicantId,
      key,
      action: "write",
      actor,
      correlationId: opts?.correlationId,
      errorClass: "PostgrestError",
    });
    throw new Error(`vault.set(${key}) failed: ${error.message}`);
  }

  await appendAccessLog({
    applicantId,
    key,
    action: "write",
    actor,
    correlationId: opts?.correlationId,
  });
}

export async function deleteApplicantSecret(
  applicantId: string,
  key: string,
  opts?: VaultOpts,
): Promise<void> {
  const actor = opts?.actor ?? "unknown@agent-backend";
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("applicant_id", applicantId)
    .eq("key", key);

  if (error) {
    logger.error("vault_delete_failed", new Error(error.message), { applicantId, key });
    await appendAccessLog({
      applicantId,
      key,
      action: "delete",
      actor,
      correlationId: opts?.correlationId,
      errorClass: "PostgrestError",
    });
    throw new Error(`vault.delete(${key}) failed: ${error.message}`);
  }

  await appendAccessLog({
    applicantId,
    key,
    action: "delete",
    actor,
    correlationId: opts?.correlationId,
  });
}

export const applicantVault = {
  get: getApplicantSecret,
  set: setApplicantSecret,
  delete: deleteApplicantSecret,
};

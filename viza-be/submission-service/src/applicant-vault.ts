import { supabase } from "./supabase";
import { decryptSecret, encryptSecret } from "./secret-cipher";

/**
 * Per-applicant credential vault — submission-service side
 * (SECRETS-002 + SECRETS-003).
 *
 * Mirrors viza-be/agent-backend/src/db/applicant-vault.ts. Reads ciphertext
 * from `applicant_secret` and decrypts using the AES-256-GCM cipher whose
 * key derives from SUBMISSION_RESULT_SECRET_KEY.
 *
 * **Crash loudly if `require` cannot find the row.** Callers MUST NOT fall
 * back to `process.env.PORTAL_*` — the whole point of SECRETS-002 is that
 * the runner has exactly one trusted credential read path.
 *
 * Every operation appends a row to `secret_access_log` so we can
 * reconstruct which job touched which credential after an incident.
 */

const TABLE = "applicant_secret";
const LOG_TABLE = "secret_access_log";

export type VaultAction = "read" | "read_miss" | "write" | "delete";

export interface VaultOpts {
  /** Identifier of the calling job. Free-form. */
  actor?: string;
  /** Optional run / request correlation id. */
  correlationId?: string;
}

export class VaultMissError extends Error {
  constructor(applicantId: string, key: string) {
    super(
      `applicant_secret missing for applicant=${applicantId} key=${key} — ` +
        `no env fallback permitted (SECRETS-002). Seed via vault helper.`,
    );
    this.name = "VaultMissError";
  }
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
    const { error } = await supabase.from(LOG_TABLE).insert({
      applicant_id: args.applicantId,
      key: args.key,
      action: args.action,
      actor: args.actor,
      correlation_id: args.correlationId ?? null,
      error_class: args.errorClass ?? null,
    });
    if (error) {
      console.error(
        `[applicant-vault] audit log insert failed: ${error.message} ` +
          `(applicant=${args.applicantId} key=${args.key} action=${args.action})`,
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[applicant-vault] audit log threw: ${msg} ` +
        `(applicant=${args.applicantId} key=${args.key})`,
    );
  }
}

export async function getApplicantSecret(
  applicantId: string,
  key: string,
  opts?: VaultOpts,
): Promise<string | null> {
  const actor = opts?.actor ?? "unknown@submission-service";
  const { data, error } = await supabase
    .from(TABLE)
    .select("ciphertext")
    .eq("applicant_id", applicantId)
    .eq("key", key)
    .maybeSingle();

  if (error) {
    await appendAccessLog({
      applicantId,
      key,
      action: "read",
      actor,
      correlationId: opts?.correlationId,
      errorClass: "PostgrestError",
    });
    throw new Error(
      `applicantVault.get(${key}) failed for ${applicantId}: ${error.message}`,
    );
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
  const plaintext = decryptSecret(data.ciphertext);
  await appendAccessLog({
    applicantId,
    key,
    action: "read",
    actor,
    correlationId: opts?.correlationId,
  });
  return plaintext;
}

/**
 * Strict variant: throws VaultMissError when the row is absent. Use this
 * everywhere the runner needs a credential — no env fallback.
 */
export async function requireApplicantSecret(
  applicantId: string,
  key: string,
  opts?: VaultOpts,
): Promise<string> {
  const v = await getApplicantSecret(applicantId, key, opts);
  if (v === null) throw new VaultMissError(applicantId, key);
  return v;
}

export async function setApplicantSecret(
  applicantId: string,
  key: string,
  plaintext: string,
  opts?: VaultOpts & { note?: string },
): Promise<void> {
  const actor = opts?.actor ?? "unknown@submission-service";
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
    await appendAccessLog({
      applicantId,
      key,
      action: "write",
      actor,
      correlationId: opts?.correlationId,
      errorClass: "PostgrestError",
    });
    throw new Error(
      `applicantVault.set(${key}) failed for ${applicantId}: ${error.message}`,
    );
  }
  await appendAccessLog({
    applicantId,
    key,
    action: "write",
    actor,
    correlationId: opts?.correlationId,
  });
}

export const applicantVault = {
  get: getApplicantSecret,
  require: requireApplicantSecret,
  set: setApplicantSecret,
};

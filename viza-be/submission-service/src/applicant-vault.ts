import { supabase } from "./supabase.js";
import { decryptSecret, encryptSecret } from "./secret-cipher.js";

/**
 * Per-applicant credential vault — submission-service side (SECRETS-002).
 *
 * Mirrors viza-be/agent-backend/src/db/applicant-vault.ts. Reads ciphertext
 * from `applicant_secret` and decrypts using the AES-256-GCM cipher whose
 * key derives from SUBMISSION_RESULT_SECRET_KEY.
 *
 * **Crash loudly if `get` returns null.** Callers MUST NOT fall back to
 * `process.env.PORTAL_*` — the whole point of SECRETS-002 is that the
 * runner has exactly one trusted credential read path.
 */

const TABLE = "applicant_secret";

export class VaultMissError extends Error {
  constructor(applicantId: string, key: string) {
    super(
      `applicant_secret missing for applicant=${applicantId} key=${key} — ` +
        `no env fallback permitted (SECRETS-002). Seed via vault helper.`,
    );
    this.name = "VaultMissError";
  }
}

export async function getApplicantSecret(
  applicantId: string,
  key: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("ciphertext")
    .eq("applicant_id", applicantId)
    .eq("key", key)
    .maybeSingle();

  if (error) {
    throw new Error(
      `applicantVault.get(${key}) failed for ${applicantId}: ${error.message}`,
    );
  }
  if (!data) return null;
  return decryptSecret(data.ciphertext);
}

/**
 * Strict variant: throws VaultMissError when the row is absent. Use this
 * everywhere the runner needs a credential — no env fallback.
 */
export async function requireApplicantSecret(
  applicantId: string,
  key: string,
): Promise<string> {
  const v = await getApplicantSecret(applicantId, key);
  if (v === null) throw new VaultMissError(applicantId, key);
  return v;
}

export async function setApplicantSecret(
  applicantId: string,
  key: string,
  plaintext: string,
  note?: string,
): Promise<void> {
  const ciphertext = encryptSecret(plaintext);
  const { error } = await supabase.from(TABLE).upsert(
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
    throw new Error(
      `applicantVault.set(${key}) failed for ${applicantId}: ${error.message}`,
    );
  }
}

export const applicantVault = {
  get: getApplicantSecret,
  require: requireApplicantSecret,
  set: setApplicantSecret,
};

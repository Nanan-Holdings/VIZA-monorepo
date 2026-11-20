import { supabase } from "./supabase";
import { decryptSecret } from "./secret-cipher";
import type {
  AuAccount,
  EgAccount,
  FvAccount,
  ItVfsCnAccount,
  UkAccount,
} from "./types";

/**
 * Per-country portal credential loaders. Each fn fetches the latest row for
 * the given applicant from `<country>_accounts`, decrypts the password (and
 * any other encrypted fields), and returns the row + plaintext secrets.
 *
 * The mimic-pulling pattern: today the rows are seeded by hand (see
 * scripts/seed-edward-test-credentials.ts). After VIZA owns its customer
 * domain, an intake worker auto-provisions per-applicant aliases + system
 * passwords, registers the underlying portal accounts, and writes the rows
 * here. Callers read via these helpers in either world.
 */

interface DecryptedAccount<T> {
  row: T;
  password: string;
}

export type UkAccountLoaderClient = Pick<typeof supabase, "from">;

export class UkAccountBindingAmbiguousError extends Error {
  constructor(applicationId: string, applicantId: string) {
    super(
      `An unbound legacy UK account exists for application ${applicationId} and applicant ${applicantId}; manual binding is required before registration`,
    );
    this.name = "UkAccountBindingAmbiguousError";
  }
}

async function loadOne<T extends { password_encrypted: string }>(
  table: string,
  applicantId: string,
): Promise<DecryptedAccount<T> | null> {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("applicant_id", applicantId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load ${table} for ${applicantId}: ${error.message}`);
  }
  if (!data) return null;

  const row = data as T;
  return { row, password: decryptSecret(row.password_encrypted) };
}

/**
 * Load a UKVI account only when both ownership dimensions match exactly.
 *
 * UK accounts used to be applicant-scoped and the old helper selected the
 * latest row. That is unsafe when one applicant has concurrent applications:
 * a resume URL/password from another application could be sent to UKVI. Keep
 * the stricter query separate from the generic country loaders so their
 * historical semantics do not leak into this path.
 */
export async function loadUkAccount(
  applicationId: string,
  applicantId: string,
  client: UkAccountLoaderClient = supabase,
) {
  const { data, error } = await client
    .from("uk_accounts")
    .select("*")
    .eq("application_id", applicationId)
    .eq("applicant_id", applicantId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to load uk_accounts for application ${applicationId} and applicant ${applicantId}: ${error.message}`,
    );
  }
  if (data) {
    const row = data as UkAccount;
    return { row, password: decryptSecret(row.password_encrypted) };
  }

  // Legacy rows are intentionally not adopted or decrypted. Their existence
  // means the applicant may already have a UKVI account whose application
  // binding is unknown; creating another official account would be unsafe.
  const { data: legacyRows, error: legacyError } = await client
    .from("uk_accounts")
    .select("id, application_id, applicant_id")
    .eq("applicant_id", applicantId)
    .is("application_id", null)
    .limit(2);
  if (legacyError) {
    throw new Error(
      `Failed to inspect legacy uk_accounts for applicant ${applicantId}: ${legacyError.message}`,
    );
  }
  if (legacyRows && legacyRows.length > 0) {
    throw new UkAccountBindingAmbiguousError(applicationId, applicantId);
  }
  return null;
}

export async function loadAuAccount(applicantId: string) {
  const result = await loadOne<AuAccount>("au_accounts", applicantId);
  if (!result) return null;
  const totpSecret = result.row.totp_secret_encrypted
    ? decryptSecret(result.row.totp_secret_encrypted)
    : null;
  return { ...result, totpSecret };
}

export async function loadFvAccount(applicantId: string) {
  return loadOne<FvAccount>("fv_accounts", applicantId);
}

export async function loadEgAccount(applicantId: string) {
  return loadOne<EgAccount>("eg_accounts", applicantId);
}

export async function loadItVfsCnAccount(applicantId: string) {
  return loadOne<ItVfsCnAccount>("it_vfs_cn_accounts", applicantId);
}

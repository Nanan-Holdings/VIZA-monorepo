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

export async function loadUkAccount(applicantId: string) {
  return loadOne<UkAccount>("uk_accounts", applicantId);
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

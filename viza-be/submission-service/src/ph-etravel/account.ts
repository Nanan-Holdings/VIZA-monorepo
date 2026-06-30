import { decryptSecret, encryptSecret } from "../secret-cipher";

export interface PhEtravelAccountRow {
  id: string;
  applicant_id: string;
  email: string;
  password_encrypted: string | null;
  mpin_encrypted: string | null;
  status: string | null;
  storage_state_json: Record<string, unknown> | null;
  last_authenticated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PhEtravelAccountCredentials {
  id: string;
  email: string;
  password: string | null;
  mpin: string | null;
  status: string;
  storageState: Record<string, unknown> | null;
}

export interface PhEtravelAccountPlan {
  mode: "reuse_existing" | "create_new";
  email: string;
  password: string | null;
  mpin: string | null;
  accountId?: string;
}

const PH_ETRAVEL_NON_REUSABLE_ACCOUNT_STATUSES = new Set([
  "pending_registration",
  "failed",
  "verification_required",
  "blocked",
]);

const VAULT_EMAIL_KEY = "ph_etravel.account.email";
const VAULT_PASSWORD_KEY = "ph_etravel.account.password";
const VAULT_MPIN_KEY = "ph_etravel.account.mpin";
const VAULT_STATUS_KEY = "ph_etravel.account.status";

export function isMissingPhEtravelAccountsTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate.code === "string" ? candidate.code : "";
  const message = typeof candidate.message === "string" ? candidate.message : "";
  return code === "PGRST205" || /ph_etravel_accounts/i.test(message) && /not find|not found|schema cache/i.test(message);
}

export function choosePhEtravelAccountPlan(input: {
  existingAccount?: PhEtravelAccountCredentials | null;
  aliasEmail: string;
  generatedPassword: string;
  generatedMpin: string;
}): PhEtravelAccountPlan {
  const existingAccount = input.existingAccount;
  const existingStatus = existingAccount?.status?.trim().toLowerCase() ?? "";
  const hasReusabilityMpin = existingAccount?.email && existingAccount.mpin && !PH_ETRAVEL_NON_REUSABLE_ACCOUNT_STATUSES.has(existingStatus);
  if (existingAccount?.email && existingAccount.status === "pending_registration") {
    return {
      mode: "create_new",
      accountId: existingAccount.id,
      email: existingAccount.email,
      password: existingAccount.password ?? input.generatedPassword,
      mpin: existingAccount.mpin ?? input.generatedMpin,
    };
  }

  if (hasReusabilityMpin) {
    return {
      mode: "reuse_existing",
      accountId: existingAccount.id,
      email: existingAccount.email,
      password: existingAccount.password,
      mpin: existingAccount.mpin,
    };
  }

  return {
    mode: "create_new",
    email: input.aliasEmail.toLowerCase(),
    password: input.generatedPassword,
    mpin: input.generatedMpin,
  };
}

export function normalizePhEtravelAccount(row: PhEtravelAccountRow): PhEtravelAccountCredentials {
  return {
    id: row.id,
    email: row.email,
    password: row.password_encrypted ? decryptSecret(row.password_encrypted) : null,
    mpin: row.mpin_encrypted ? decryptSecret(row.mpin_encrypted) : null,
    status: row.status ?? "created",
    storageState: row.storage_state_json,
  };
}

export async function loadPhEtravelAccount(applicantId: string): Promise<PhEtravelAccountCredentials | null> {
  const { supabase } = await import("../supabase");
  const { data, error } = await supabase
    .from("ph_etravel_accounts")
    .select("id, applicant_id, email, password_encrypted, mpin_encrypted, status, storage_state_json, last_authenticated_at, created_at, updated_at")
    .eq("applicant_id", applicantId)
    .order("last_authenticated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingPhEtravelAccountsTableError(error)) {
      return loadPhEtravelAccountFromVault(applicantId);
    }
    throw new Error(`Failed to load ph_etravel_accounts: ${error.message}`);
  }
  return data ? normalizePhEtravelAccount(data as PhEtravelAccountRow) : null;
}

async function loadPhEtravelAccountFromVault(applicantId: string): Promise<PhEtravelAccountCredentials | null> {
  const { applicantVault } = await import("../applicant-vault");
  const opts = { actor: "ph-etravel@submission-service" };
  const email = await applicantVault.get(applicantId, VAULT_EMAIL_KEY, opts);
  if (!email) return null;
  const password = await applicantVault.get(applicantId, VAULT_PASSWORD_KEY, opts);
  const mpin = await applicantVault.get(applicantId, VAULT_MPIN_KEY, opts);
  const status = await applicantVault.get(applicantId, VAULT_STATUS_KEY, opts);
  return {
    id: `vault:${applicantId}`,
    email,
    password,
    mpin,
    status: status ?? "created",
    storageState: null,
  };
}

export async function upsertPhEtravelAccount(input: {
  applicantId: string;
  email: string;
  password: string | null;
  mpin?: string | null;
  status: string;
  storageState?: Record<string, unknown> | null;
  lastAuthenticatedAt?: string | null;
}): Promise<PhEtravelAccountCredentials> {
  const { supabase } = await import("../supabase");
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("ph_etravel_accounts")
    .upsert({
      applicant_id: input.applicantId,
      email: input.email.toLowerCase(),
      password_encrypted: input.password ? encryptSecret(input.password) : null,
      mpin_encrypted: input.mpin ? encryptSecret(input.mpin) : null,
      status: input.status,
      storage_state_json: input.storageState ?? null,
      last_authenticated_at: input.lastAuthenticatedAt ?? null,
      updated_at: now,
    }, { onConflict: "applicant_id,email" })
    .select("id, applicant_id, email, password_encrypted, mpin_encrypted, status, storage_state_json, last_authenticated_at, created_at, updated_at")
    .single();

  if (error) {
    if (isMissingPhEtravelAccountsTableError(error)) {
      return upsertPhEtravelAccountInVault(input);
    }
    throw new Error(`Failed to upsert ph_etravel_accounts: ${error.message}`);
  }
  return normalizePhEtravelAccount(data as PhEtravelAccountRow);
}

async function upsertPhEtravelAccountInVault(input: {
  applicantId: string;
  email: string;
  password: string | null;
  mpin?: string | null;
  status: string;
}): Promise<PhEtravelAccountCredentials> {
  const { applicantVault } = await import("../applicant-vault");
  const opts = {
    actor: "ph-etravel@submission-service",
    note: "PH eTravel account fallback while ph_etravel_accounts table is unavailable.",
  };
  await applicantVault.set(input.applicantId, VAULT_EMAIL_KEY, input.email.toLowerCase(), opts);
  if (input.password) {
    await applicantVault.set(input.applicantId, VAULT_PASSWORD_KEY, input.password, opts);
  }
  if (input.mpin) {
    await applicantVault.set(input.applicantId, VAULT_MPIN_KEY, input.mpin, opts);
  }
  await applicantVault.set(input.applicantId, VAULT_STATUS_KEY, input.status, opts);
  return {
    id: `vault:${input.applicantId}`,
    email: input.email.toLowerCase(),
    password: input.password,
    mpin: input.mpin ?? null,
    status: input.status,
    storageState: null,
  };
}

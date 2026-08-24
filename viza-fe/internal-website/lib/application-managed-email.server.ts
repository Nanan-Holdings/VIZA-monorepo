import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_ALIAS_DOMAIN = "viza.it.com";
const ULID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function configuredAliasDomain(): string {
  return (
    process.env.INBOX_ALIAS_DOMAIN?.trim().toLowerCase().replace(/^@/u, "") ||
    DEFAULT_ALIAS_DOMAIN
  );
}

function generateUlid(now = Date.now()): string {
  let timePart = "";
  let timestamp = now;
  for (let index = 0; index < 10; index += 1) {
    timePart = ULID_ALPHABET[timestamp % 32] + timePart;
    timestamp = Math.floor(timestamp / 32);
  }

  let randomPart = "";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  for (const byte of bytes) randomPart += ULID_ALPHABET[byte % 32];
  return `${timePart}${randomPart}`.toLowerCase();
}

export function generateApplicationManagedEmail(
  now = Date.now(),
  domain = configuredAliasDomain(),
): string {
  return `appl-${generateUlid(now)}@${domain.trim().toLowerCase().replace(/^@/u, "")}`;
}

export async function ensureApplicationManagedEmailForOwner(
  admin: SupabaseClient,
  applicationId: string,
  applicantId: string,
): Promise<string> {
  const readExisting = async () => {
    const { data, error } = await admin
      .from("application_inbox_aliases")
      .select("application_id, applicant_id, alias, retired_at")
      .eq("application_id", applicationId)
      .maybeSingle();
    if (error) {
      throw new Error(`Application email lookup failed: ${error.message}`);
    }
    if (data && data.applicant_id !== applicantId) {
      throw new Error("Application email owner mismatch");
    }
    if (data?.retired_at) {
      throw new Error("Application email has been retired");
    }
    return data;
  };

  const existing = await readExisting();
  if (existing?.alias) return String(existing.alias).trim().toLowerCase();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const alias = generateApplicationManagedEmail(Date.now() + attempt);
    const { data, error } = await admin
      .from("application_inbox_aliases")
      .insert({
        application_id: applicationId,
        applicant_id: applicantId,
        alias,
      })
      .select("application_id, applicant_id, alias, retired_at")
      .maybeSingle();
    if (!error && data?.alias) return String(data.alias).trim().toLowerCase();
    if (error?.code !== "23505") {
      throw new Error(`Application email creation failed: ${error?.message ?? "missing row"}`);
    }

    const raced = await readExisting();
    if (raced?.alias) return String(raced.alias).trim().toLowerCase();
  }

  throw new Error("Application email creation exhausted collision retries");
}

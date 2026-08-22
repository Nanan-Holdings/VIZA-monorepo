import { supabase } from "../supabase";

const DEFAULT_ALIAS_DOMAIN =
  process.env.INBOX_ALIAS_DOMAIN?.trim().toLowerCase().replace(/^@/u, "") ||
  "viza.it.com";
const ULID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

type InboxAliasClient = Pick<typeof supabase, "from">;

export interface EnsureApplicantInboxAliasResult {
  alias: string;
  created: boolean;
}

export interface EnsureApplicationInboxAliasResult extends EnsureApplicantInboxAliasResult {
  applicationId: string;
}

function randomByte(): number {
  return Math.floor(Math.random() * 256);
}

function normalizeAliasDomain(value: string): string {
  const candidate = value.trim().toLowerCase();
  return candidate.startsWith("@") ? candidate.slice(1) : candidate;
}

export function generateApplicantInboxAlias(now = Date.now(), domain = DEFAULT_ALIAS_DOMAIN): string {
  let timePart = "";
  let t = now;
  for (let i = 0; i < 10; i += 1) {
    timePart = ULID_ALPHABET[t % 32] + timePart;
    t = Math.floor(t / 32);
  }

  let randPart = "";
  for (let i = 0; i < 16; i += 1) {
    randPart += ULID_ALPHABET[randomByte() % 32];
  }

  return `appl-${(timePart + randPart).toLowerCase()}@${normalizeAliasDomain(domain)}`;
}

export async function ensureApplicantInboxAlias(
  applicantId: string,
  client: InboxAliasClient = supabase,
  domain = DEFAULT_ALIAS_DOMAIN,
): Promise<EnsureApplicantInboxAliasResult> {
  const { data: existing, error: readError } = await client
    .from("applicant_profiles")
    .select("inbox_alias")
    .eq("id", applicantId)
    .maybeSingle();

  if (readError) {
    throw new Error(`ensureApplicantInboxAlias read failed: ${readError.message}`);
  }
  if (!existing) {
    throw new Error(`Applicant profile not found: ${applicantId}`);
  }
  if (typeof existing.inbox_alias === "string" && existing.inbox_alias.trim()) {
    return { alias: existing.inbox_alias.toLowerCase(), created: false };
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const alias = generateApplicantInboxAlias(Date.now(), domain);
    const { data: updated, error: writeError } = await client
      .from("applicant_profiles")
      .update({ inbox_alias: alias })
      .eq("id", applicantId)
      .is("inbox_alias", null)
      .select("inbox_alias")
      .maybeSingle();

    if (!writeError && updated?.inbox_alias) {
      return { alias: String(updated.inbox_alias).toLowerCase(), created: true };
    }

    if (writeError && writeError.code !== "23505") {
      throw new Error(`ensureApplicantInboxAlias write failed: ${writeError.message}`);
    }
  }

  throw new Error(`ensureApplicantInboxAlias exhausted retries for ${applicantId}`);
}

/**
 * Creates one managed alias per application. This is the required path for
 * unattended official portals because applicant-level aliases allow OTP and
 * approval mail from concurrent applications to share one inbox identity.
 */
export async function ensureApplicationInboxAlias(
  applicationId: string,
  applicantId: string,
  client: InboxAliasClient = supabase,
  domain = DEFAULT_ALIAS_DOMAIN,
): Promise<EnsureApplicationInboxAliasResult> {
  const readExisting = async () => {
    const { data, error } = await client
      .from("application_inbox_aliases")
      .select("application_id, applicant_id, alias, retired_at")
      .eq("application_id", applicationId)
      .maybeSingle();
    if (error) {
      throw new Error(`ensureApplicationInboxAlias read failed: ${error.message}`);
    }
    if (data && data.applicant_id !== applicantId) {
      throw new Error(`Application inbox alias owner mismatch for ${applicationId}`);
    }
    if (data?.retired_at) {
      throw new Error(`Application inbox alias is retired for ${applicationId}`);
    }
    return data;
  };

  const existing = await readExisting();
  if (existing?.alias) {
    return {
      applicationId,
      alias: String(existing.alias).toLowerCase(),
      created: false,
    };
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const alias = generateApplicantInboxAlias(Date.now() + attempt, domain);
    const { data, error } = await client
      .from("application_inbox_aliases")
      .insert({
        application_id: applicationId,
        applicant_id: applicantId,
        alias,
      })
      .select("application_id, applicant_id, alias, retired_at")
      .maybeSingle();
    if (!error && data?.alias) {
      return { applicationId, alias: String(data.alias).toLowerCase(), created: true };
    }
    if (error?.code !== "23505") {
      throw new Error(`ensureApplicationInboxAlias write failed: ${error?.message ?? "missing row"}`);
    }
    const raced = await readExisting();
    if (raced?.alias) {
      return {
        applicationId,
        alias: String(raced.alias).toLowerCase(),
        created: false,
      };
    }
  }

  throw new Error(`ensureApplicationInboxAlias exhausted retries for ${applicationId}`);
}

export async function ensureApplicantInboxAliasForDomain(
  applicantId: string,
  domain: string,
  client: InboxAliasClient = supabase,
): Promise<EnsureApplicantInboxAliasResult> {
  const normalizedDomain = normalizeAliasDomain(domain);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const localNow = Date.now() + attempt;
    const alias = generateApplicantInboxAlias(localNow, normalizedDomain);
    const { data: updated, error: writeError } = await client
      .from("applicant_profiles")
      .update({ inbox_alias: alias })
      .eq("id", applicantId)
      .select("inbox_alias")
      .maybeSingle();

    if (writeError && writeError.code !== "23505") {
      throw new Error(`ensureApplicantInboxAliasForDomain write failed: ${writeError.message}`);
    }
    if (!writeError && updated?.inbox_alias) {
      return { alias: String(updated.inbox_alias).toLowerCase(), created: true };
    }
  }

  throw new Error(`ensureApplicantInboxAliasForDomain exhausted retries for ${applicantId}`);
}

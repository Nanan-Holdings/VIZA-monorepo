import { supabase } from "../supabase";

const ALIAS_DOMAIN = "haggstorm.com";
const ULID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

type InboxAliasClient = Pick<typeof supabase, "from">;

export interface EnsureApplicantInboxAliasResult {
  alias: string;
  created: boolean;
}

function randomByte(): number {
  return Math.floor(Math.random() * 256);
}

export function generateApplicantInboxAlias(now = Date.now()): string {
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

  return `appl-${(timePart + randPart).toLowerCase()}@${ALIAS_DOMAIN}`;
}

export async function ensureApplicantInboxAlias(
  applicantId: string,
  client: InboxAliasClient = supabase,
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
    const alias = generateApplicantInboxAlias();
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

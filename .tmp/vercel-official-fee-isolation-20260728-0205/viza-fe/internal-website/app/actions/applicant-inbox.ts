"use server";

import { withAdmin } from "@/lib/auth/with-admin";

/**
 * Per-applicant inbox alias (INBOX-003).
 *
 * `assignApplicantInboxAlias(applicantId)` returns the existing alias if
 * one is already assigned, otherwise mints a fresh `appl-{ulid}@haggstorm.com`,
 * persists it to `applicant_profiles.inbox_alias`, and returns it.
 *
 * Aliases are case-insensitive (the unique index uses `LOWER(inbox_alias)`),
 * but we always store and return them lowercased for byte-equivalence
 * with `inbound_email.to_addr`.
 */

const ALIAS_DOMAIN = "haggstorm.com";

// Crockford base32 (no I, L, O, U) — keeps aliases legible in tickets.
const ULID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function generateUlid(): string {
  // 26-char ULID: 10 chars time (48 bits) + 16 chars random (80 bits).
  // Implementation here is intentionally local — adding the `ulid` package
  // is overkill for one call site and we control the only producer.
  const time = Date.now();
  let timePart = "";
  let t = time;
  for (let i = 0; i < 10; i++) {
    timePart = ULID_ALPHABET[t % 32] + timePart;
    t = Math.floor(t / 32);
  }
  let randPart = "";
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  for (let i = 0; i < 16; i++) {
    randPart += ULID_ALPHABET[buf[i] % 32];
  }
  return timePart + randPart;
}

function buildAlias(): string {
  return `appl-${generateUlid().toLowerCase()}@${ALIAS_DOMAIN}`;
}

export interface AssignAliasResult {
  alias: string;
  created: boolean;
}

export async function assignApplicantInboxAlias(
  applicantId: string,
): Promise<AssignAliasResult> {
  return withAdmin("system", "actions/applicant-inbox:assign", async (admin) => {
    const { data: existing, error: readErr } = await admin
      .from("applicant_profiles")
      .select("inbox_alias")
      .eq("id", applicantId)
      .maybeSingle();
    if (readErr) {
      throw new Error(`assignApplicantInboxAlias read failed: ${readErr.message}`);
    }
    if (!existing) {
      throw new Error(`Applicant not found: ${applicantId}`);
    }
    if (existing.inbox_alias) {
      return { alias: existing.inbox_alias, created: false };
    }

    // Retry up to 3 times in case the random ULID collides with the unique
    // index. A retry rather than a transaction keeps the action simple
    // and the collision odds are vanishingly small (80 bits of entropy).
    for (let attempt = 0; attempt < 3; attempt++) {
      const alias = buildAlias();
      const { error: writeErr } = await admin
        .from("applicant_profiles")
        .update({ inbox_alias: alias })
        .eq("id", applicantId)
        .is("inbox_alias", null);
      if (!writeErr) {
        return { alias, created: true };
      }
      if (writeErr.code !== "23505") {
        throw new Error(`assignApplicantInboxAlias write failed: ${writeErr.message}`);
      }
      // 23505 = unique violation → retry with a new alias.
    }
    throw new Error(
      `assignApplicantInboxAlias exhausted retries after collisions for ${applicantId}`,
    );
  });
}

/**
 * Retire an applicant's inbox alias (INBOX-007). Stamps
 * `inbox_alias_retired_at` so the worker rejects further mail to that
 * address with a 5xx and the per-applicant SELECT policy hides past
 * messages from the client view. Existing rows are kept until the
 * retention purge (`purge_old_inbound_email`) runs.
 *
 * Use when an applicant reaches a terminal status (visa delivered or
 * application cancelled). Idempotent — re-calling on an already-retired
 * applicant is a no-op.
 */
export async function retireApplicantInboxAlias(
  applicantId: string,
): Promise<{ retiredAt: string | null }> {
  return withAdmin("admin", "actions/applicant-inbox:retire", async (admin) => {
    const { data: existing, error: readErr } = await admin
      .from("applicant_profiles")
      .select("inbox_alias, inbox_alias_retired_at")
      .eq("id", applicantId)
      .maybeSingle();
    if (readErr) {
      throw new Error(`retireApplicantInboxAlias read failed: ${readErr.message}`);
    }
    if (!existing) {
      throw new Error(`Applicant not found: ${applicantId}`);
    }
    if (!existing.inbox_alias) {
      // Nothing to retire — no alias was ever minted.
      return { retiredAt: null };
    }
    if (existing.inbox_alias_retired_at) {
      return { retiredAt: existing.inbox_alias_retired_at };
    }
    const retiredAt = new Date().toISOString();
    const { error: writeErr } = await admin
      .from("applicant_profiles")
      .update({ inbox_alias_retired_at: retiredAt })
      .eq("id", applicantId);
    if (writeErr) {
      throw new Error(`retireApplicantInboxAlias write failed: ${writeErr.message}`);
    }
    return { retiredAt };
  });
}

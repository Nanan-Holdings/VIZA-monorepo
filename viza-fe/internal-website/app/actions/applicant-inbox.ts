"use server";

import { headers } from "next/headers";
import { withAdmin } from "@/lib/auth/with-admin";
import { getClientSessionWithFallback } from "@/lib/client-session";

/**
 * Per-applicant inbox alias (INBOX-003).
 *
 * `assignApplicantInboxAlias(applicantId)` returns the existing alias if
 * one is already assigned on the active managed domain, rotates recognized
 * legacy managed aliases to the active domain, or otherwise mints a fresh
 * `appl-{ulid}@viza.it.com` alias.
 *
 * Aliases are case-insensitive (the unique index uses `LOWER(inbox_alias)`),
 * but we always store and return them lowercased for byte-equivalence
 * with `inbound_email.to_addr`.
 */

const LEGACY_MANAGED_ALIAS_DOMAINS = new Set(["haggstorm.com"]);
const DEFAULT_ALIAS_DOMAIN = "viza.it.com";
const configuredAliasDomain =
  process.env.INBOX_ALIAS_DOMAIN?.trim().toLowerCase().replace(/^@/u, "") || "";
const ALIAS_DOMAIN =
  configuredAliasDomain && !LEGACY_MANAGED_ALIAS_DOMAINS.has(configuredAliasDomain)
    ? configuredAliasDomain
    : DEFAULT_ALIAS_DOMAIN;
const EMAIL_FORWARDING_CONSENT = {
  type: "alias_email_forwarding",
  version: "2026-07-22",
  documentHash:
    "sha256:5d2d7fcccd083bbde90b9d42529b5f8cab380fd7bf26a79eb2ba84315f1fb212",
} as const;

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

function replacementForLegacyAlias(alias: string): string | null {
  const normalized = alias.trim().toLowerCase();
  const atIndex = normalized.lastIndexOf("@");
  if (atIndex <= 0) return null;
  const localPart = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);
  if (!LEGACY_MANAGED_ALIAS_DOMAINS.has(domain) || domain === ALIAS_DOMAIN) {
    return null;
  }
  return `${localPart}@${ALIAS_DOMAIN}`;
}

export interface AssignAliasResult {
  alias: string;
  created: boolean;
}

export interface ApplicantInboxSetupState {
  alias: string;
  destinationEmail: string;
  forwardingAuthorized: boolean;
}

export async function assignApplicantInboxAlias(
  applicantId: string,
): Promise<AssignAliasResult> {
  return withAdmin("system", "actions/applicant-inbox:assign", async (admin) => {
    const { data: existing, error: readErr } = await admin
      .from("applicant_profiles")
      .select("inbox_alias, inbox_alias_retired_at")
      .eq("id", applicantId)
      .maybeSingle();
    if (readErr) {
      throw new Error(`assignApplicantInboxAlias read failed: ${readErr.message}`);
    }
    if (!existing) {
      throw new Error(`Applicant not found: ${applicantId}`);
    }
    if (existing.inbox_alias) {
      const legacyAlias = existing.inbox_alias;
      const replacement = replacementForLegacyAlias(legacyAlias);
      if (!replacement) {
        if (existing.inbox_alias_retired_at) {
          const { error: reactivateError } = await admin
            .from("applicant_profiles")
            .update({ inbox_alias_retired_at: null })
            .eq("id", applicantId);
          if (reactivateError) {
            throw new Error(
              `assignApplicantInboxAlias reactivation failed: ${reactivateError.message}`,
            );
          }
        }
        return { alias: legacyAlias.trim().toLowerCase(), created: false };
      }

      const { data: rotated, error: rotateErr } = await admin
        .from("applicant_profiles")
        .update({ inbox_alias: replacement, inbox_alias_retired_at: null })
        .eq("id", applicantId)
        .eq("inbox_alias", legacyAlias)
        .select("inbox_alias")
        .maybeSingle();
      if (rotateErr) {
        throw new Error(
          `assignApplicantInboxAlias legacy rotation failed: ${rotateErr.message}`,
        );
      }
      if (rotated?.inbox_alias) {
        return { alias: rotated.inbox_alias, created: true };
      }

      const { data: concurrent, error: concurrentReadErr } = await admin
        .from("applicant_profiles")
        .select("inbox_alias")
        .eq("id", applicantId)
        .maybeSingle();
      if (concurrentReadErr) {
        throw new Error(
          `assignApplicantInboxAlias concurrent read failed: ${concurrentReadErr.message}`,
        );
      }
      if (concurrent?.inbox_alias) {
        return {
          alias: concurrent.inbox_alias.trim().toLowerCase(),
          created: concurrent.inbox_alias !== legacyAlias,
        };
      }
    }

    // Retry up to 3 times in case the random ULID collides with the unique
    // index. A retry rather than a transaction keeps the action simple
    // and the collision odds are vanishingly small (80 bits of entropy).
    for (let attempt = 0; attempt < 3; attempt++) {
      const alias = buildAlias();
      const { error: writeErr } = await admin
        .from("applicant_profiles")
        .update({ inbox_alias: alias, inbox_alias_retired_at: null })
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

async function readForensics() {
  try {
    const requestHeaders = await headers();
    return {
      ip:
        requestHeaders.get("cf-connecting-ip") ??
        requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        requestHeaders.get("x-real-ip") ??
        null,
      ua: requestHeaders.get("user-agent") ?? null,
    };
  } catch {
    return { ip: null, ua: null };
  }
}

async function getAuthenticatedApplicantProfile() {
  const session = await getClientSessionWithFallback();
  if (!session) {
    throw new Error("You must be signed in to manage your VIZA application email.");
  }

  return withAdmin("system", "actions/applicant-inbox:profile", async (admin) => {
    const { data, error } = await admin
      .from("applicant_profiles")
      .select("id, auth_user_id, email")
      .eq("id", session.userId)
      .maybeSingle();
    if (error) {
      throw new Error(`Applicant profile lookup failed: ${error.message}`);
    }
    if (!data?.id || !data.email) {
      throw new Error("Your applicant profile does not have a destination email.");
    }
    return {
      id: data.id as string,
      authUserId: (data.auth_user_id as string | null) ?? null,
      email: String(data.email).trim().toLowerCase(),
    };
  });
}

async function hasAccountForwardingConsent(applicantId: string): Promise<boolean> {
  return withAdmin("system", "actions/applicant-inbox:consent-read", async (admin) => {
    const { data: accountConsent, error: accountConsentError } = await admin
      .from("consent_event")
      .select("id")
      .eq("applicant_id", applicantId)
      .eq("doc_kind", EMAIL_FORWARDING_CONSENT.type)
      .eq("doc_version", EMAIL_FORWARDING_CONSENT.version)
      .limit(1)
      .maybeSingle();
    if (accountConsentError) {
      throw new Error(
        `Account email forwarding consent lookup failed: ${accountConsentError.message}`,
      );
    }
    if (accountConsent?.id) {
      return true;
    }

    // Existing users may already have accepted the same document for an older
    // application. Treat that explicit acceptance as account authorization and
    // backfill the account event when they next confirm through the modal.
    const { data: applicationConsent, error: applicationConsentError } = await admin
      .from("consent_events")
      .select("id")
      .eq("applicant_id", applicantId)
      .eq("consent_type", EMAIL_FORWARDING_CONSENT.type)
      .eq("version", EMAIL_FORWARDING_CONSENT.version)
      .eq("document_hash", EMAIL_FORWARDING_CONSENT.documentHash)
      .eq("accepted", true)
      .limit(1)
      .maybeSingle();
    if (applicationConsentError) {
      throw new Error(
        `Application email forwarding consent lookup failed: ${applicationConsentError.message}`,
      );
    }
    return Boolean(applicationConsent?.id);
  });
}

export async function initializeAuthenticatedApplicantInbox(): Promise<ApplicantInboxSetupState> {
  const profile = await getAuthenticatedApplicantProfile();
  const [{ alias }, forwardingAuthorized] = await Promise.all([
    assignApplicantInboxAlias(profile.id),
    hasAccountForwardingConsent(profile.id),
  ]);
  return {
    alias,
    destinationEmail: profile.email,
    forwardingAuthorized,
  };
}

export async function authorizeAuthenticatedApplicantInboxForwarding(): Promise<ApplicantInboxSetupState> {
  const profile = await getAuthenticatedApplicantProfile();
  const { alias } = await assignApplicantInboxAlias(profile.id);

  if (!(await hasAccountForwardingConsent(profile.id))) {
    const { ip, ua } = await readForensics();
    await withAdmin("system", "actions/applicant-inbox:consent-write", async (admin) => {
      const { error } = await admin.from("consent_event").insert({
        user_id: profile.authUserId,
        applicant_id: profile.id,
        email: profile.email,
        doc_kind: EMAIL_FORWARDING_CONSENT.type,
        doc_version: EMAIL_FORWARDING_CONSENT.version,
        ip,
        ua,
      });
      if (error) {
        throw new Error(`Email forwarding authorization failed: ${error.message}`);
      }
    });
  }

  await withAdmin("system", "actions/applicant-inbox:resume-forwarding", async (admin) => {
    const { error } = await admin
      .from("inbound_email")
      .update({
        forwarding_status: "pending",
        forwarding_error: null,
      })
      .eq("to_addr", alias)
      .eq("forwarding_status", "skipped")
      .eq("forwarding_error", "consent_required")
      .eq("quarantined", false);
    if (error) {
      throw new Error(`Deferred email forwarding resume failed: ${error.message}`);
    }
  });

  return {
    alias,
    destinationEmail: profile.email,
    forwardingAuthorized: true,
  };
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

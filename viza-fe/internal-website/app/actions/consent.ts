"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { withAdmin } from "@/lib/auth/with-admin";
import { documentVersion, type DocKind } from "@/lib/legal/document-versions";

/**
 * Consent capture (LEGAL-002).
 *
 * Records one row per acceptance. Caller passes the `docKind`; the
 * doc_version hash is read from `lib/legal/document-versions.ts`,
 * which hashes the source markdown so doc updates re-prompt users
 * naturally.
 *
 * - ToS / Privacy at signup or re-consent.
 * - Application authorisation at the per-application signing step.
 *
 * Fails open on the IP / user-agent capture (header reads). The
 * underlying insert still goes through.
 */

export interface RecordConsentInput {
  docKind: DocKind;
  /** Optional applicant_id when the consent is scoped to a profile. */
  applicantId?: string;
  /** Optional application_id when the consent is per-application. */
  applicationId?: string;
  /**
   * Email captured pre-account (e.g. waitlist signup). Stored
   * lowercase. Only populated when the caller is unauthenticated.
   */
  email?: string;
}

async function readForensics() {
  try {
    const h = await headers();
    const ip =
      h.get("cf-connecting-ip") ??
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      h.get("x-real-ip") ??
      null;
    const ua = h.get("user-agent") ?? null;
    return { ip, ua };
  } catch {
    return { ip: null, ua: null };
  }
}

export async function recordConsentEvent(
  input: RecordConsentInput,
): Promise<{ id: string; docVersion: string }> {
  const docVersion = documentVersion(input.docKind);
  const { ip, ua } = await readForensics();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return withAdmin("system", "actions/consent:record", async (admin) => {
    const row = {
      user_id: user?.id ?? null,
      applicant_id: input.applicantId ?? null,
      application_id: input.applicationId ?? null,
      email: input.email?.toLowerCase() ?? null,
      doc_kind: input.docKind,
      doc_version: docVersion,
      ip,
      ua,
    };
    const { data, error } = await admin
      .from("consent_event")
      .insert(row)
      .select("id")
      .single();
    if (error) {
      throw new Error(`recordConsentEvent failed: ${error.message}`);
    }
    return { id: data.id as string, docVersion };
  });
}

/** Convenience: bundle ToS + Privacy at signup (one call, two rows). */
export async function recordSignupConsent(input: {
  email?: string;
  applicantId?: string;
}): Promise<{ tos: string; privacy: string }> {
  const tos = await recordConsentEvent({
    docKind: "tos",
    email: input.email,
    applicantId: input.applicantId,
  });
  const privacy = await recordConsentEvent({
    docKind: "privacy",
    email: input.email,
    applicantId: input.applicantId,
  });
  return { tos: tos.id, privacy: privacy.id };
}

/** Per-application authorisation captured at the signing step. */
export async function recordApplicationAuthorisation(
  applicationId: string,
): Promise<{ id: string; docVersion: string }> {
  return recordConsentEvent({
    docKind: "application_authorisation",
    applicationId,
  });
}

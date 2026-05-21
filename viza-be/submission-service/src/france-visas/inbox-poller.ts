/**
 * France-Visas mailbox polling.
 *
 * After the Keycloak registration form is submitted, Keycloak emails an
 * account-verification link to the applicant's address. This module is the
 * pluggable seam for waiting on that email and extracting the link —
 * concrete providers (Resend inbound, Mailgun, Postmark, IMAP) are injected
 * at the orchestration layer so this file stays transport-free.
 */

import { InboxTimeoutError } from "./errors";

/**
 * Minimum contract a mailbox provider must satisfy for the registration
 * flow to resolve a verification link.
 */
export interface MailboxProvider {
  /**
   * Wait for a matching message and return the first verification URL found
   * in its HTML or text body.
   *
   * Implementations MUST:
   *   - Resolve only after a match arrives OR the timeout expires.
   *   - Prefer HTML-body link extraction over text-body when both exist
   *     (quoted-printable encoding mangles raw URLs in the text alternative).
   *   - Throw `InboxTimeoutError` on timeout — never return null/undefined.
   */
  waitForVerificationLink(params: {
    mailboxAddress: string;
    timeoutMs: number;
    subjectPattern?: RegExp;
    senderPattern?: RegExp;
  }): Promise<URL>;
}

/**
 * Default subject / sender filters for France-Visas verification emails.
 * Exported so alternate providers can reuse them.
 *
 * TODO(walk): confirm exact subject line and sender after a real registration.
 */
export const FV_VERIFICATION_EMAIL_FILTERS = {
  subjectPattern: /france[- ]?visas|vérif|confirm|activat/i,
  senderPattern: /(no[-_.]?reply|noreply|contact)@.*france-visas\.gouv\.fr/i,
} as const;

/**
 * Convenience wrapper: delegates to the provider with France-Visas defaults
 * and re-wraps non-typed errors as `InboxTimeoutError` for a consistent
 * failure class at the call site.
 */
export async function pollInboxForVerificationLink(
  provider: MailboxProvider,
  params: {
    mailboxAddress: string;
    timeoutMs?: number;
    subjectPattern?: RegExp;
    senderPattern?: RegExp;
  },
): Promise<URL> {
  const timeoutMs = params.timeoutMs ?? 120_000;
  try {
    return await provider.waitForVerificationLink({
      mailboxAddress: params.mailboxAddress,
      timeoutMs,
      subjectPattern:
        params.subjectPattern ?? FV_VERIFICATION_EMAIL_FILTERS.subjectPattern,
      senderPattern:
        params.senderPattern ?? FV_VERIFICATION_EMAIL_FILTERS.senderPattern,
    });
  } catch (err) {
    if (err instanceof InboxTimeoutError) throw err;
    throw new InboxTimeoutError(
      `Failed to retrieve verification link for ${params.mailboxAddress}`,
      {
        details: {
          timeoutMs,
          cause: err instanceof Error ? err.message : String(err),
        },
      },
    );
  }
}

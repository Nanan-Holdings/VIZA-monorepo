/**
 * Shared types for INBOX-004 extractor profiles.
 *
 * A profile knows how to pull the OTP / magic link / portal reference
 * out of a single sender's confirmation mail. Each profile is small,
 * pure, and snapshot-tested against an anonymised real sample.
 */

export interface ExtractInput {
  /** From-address used for profile selection (case-insensitive match). */
  from: string;
  /** Subject line, optional but most profiles inspect it. */
  subject?: string | null;
  /** text/plain body when present. */
  text?: string | null;
  /** text/html body when present. */
  html?: string | null;
}

export interface ExtractResult {
  code?: string;
  link?: string;
  reference?: string;
}

export interface ExtractorProfile {
  /** Stable id used in logs and tests. */
  id: string;
  /** Lowercased sender domains the profile claims (e.g. ["evisa.xuatnhapcanh.gov.vn"]). */
  senderDomains: string[];
  /** Optional subject regex used to disambiguate when one domain sends many kinds of mail. */
  subjectMatch?: RegExp;
  /** Pure extraction function. */
  extract: (input: ExtractInput) => ExtractResult;
}

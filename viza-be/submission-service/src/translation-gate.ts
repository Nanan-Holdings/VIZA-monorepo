/**
 * Translation Gate for CEAC Autofill
 *
 * The /client portal lets applicants fill DS-160 answers in their preferred
 * language (default zh). CEAC only accepts ASCII-transliterated English in
 * its text fields, so non-English answers must be translated to English
 * before autofill runs. The agent-backend `/api/applications/:id/translate`
 * route does the translation and writes results to `application_translations`.
 *
 * This module enforces the translation requirement at the submission-service
 * boundary in two steps:
 *
 *   1. applyTranslationOverlay() — overlays English `translated_text` from
 *      `application_translations` onto raw answer/profile fields. User edits
 *      to translations (PATCH endpoint sets user_edited=true) win because the
 *      table stores the most recent value per (application_id, field_key).
 *
 *   2. assertNoCjkRemaining() — scans every answer/profile string for CJK
 *      characters (Chinese ideographs, Japanese kana, Korean hangul) and
 *      throws TranslationGateError if any remain. The runner can then mark
 *      the submission_queue row as failed-with-retry; the next sweep picks
 *      it up after the translation route finishes.
 *
 * The gate is bypassable via CEAC_SKIP_TRANSLATION_GATE=1 for local debugging
 * of fill steps without depending on the translate route.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * CJK character classes:
 *   - U+4E00-U+9FFF   CJK Unified Ideographs (most modern Chinese)
 *   - U+3400-U+4DBF   CJK Unified Ideographs Extension A
 *   - U+3040-U+309F   Hiragana
 *   - U+30A0-U+30FF   Katakana
 *   - U+AC00-U+D7AF   Hangul syllables
 *
 * Match any single character in those ranges. CEAC's text inputs reject
 * non-ASCII anyway; this regex's job is to flag the input before the
 * autofill walker wastes a captcha solve typing characters CEAC will reject.
 */
const HAS_CJK = /[一-鿿㐀-䶿぀-ヿ가-힯]/;

export class TranslationGateError extends Error {
  readonly offendingKeys: ReadonlyArray<string>;

  constructor(message: string, offendingKeys: string[]) {
    super(message);
    this.name = "TranslationGateError";
    this.offendingKeys = offendingKeys;
  }
}

function isMissingTranslationsTableError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("application_translations") &&
    (normalized.includes("schema cache") ||
      normalized.includes("does not exist") ||
      normalized.includes("could not find the table"));
}

/**
 * Read every translation row for an application and overlay the English
 * `translated_text` onto the matching key in either the raw profile or the
 * dynamic answer set.
 *
 * The translate route stores rows keyed by `field_key` matching either an
 * applicant_profiles column (full_name, nationality, ...) or a
 * visa_application_answers field_name. We don't need to know which class a
 * key belongs to — we look it up in both maps and overwrite whichever side
 * holds it.
 */
export async function applyTranslationOverlay(
  supabase: SupabaseClient,
  applicationId: string,
  rawProfile: Record<string, unknown>,
  answers: Record<string, string>,
): Promise<{ overlaid: number }> {
  const { data, error } = await supabase
    .from("application_translations")
    .select("field_key, translated_text, target_lang")
    .eq("application_id", applicationId)
    .eq("target_lang", "en");

  if (error) {
    if (isMissingTranslationsTableError(error.message)) {
      console.warn(
        `[translation-gate] application_translations table is unavailable; ` +
          `continuing without translation overlay for application ${applicationId}`,
      );
      return { overlaid: 0 };
    }
    throw new Error(`application_translations lookup failed: ${error.message}`);
  }

  let overlaid = 0;
  for (const row of (data ?? []) as Array<{
    field_key: string;
    translated_text: string;
  }>) {
    const { field_key, translated_text } = row;
    if (!translated_text) continue;
    if (field_key in answers) {
      answers[field_key] = translated_text;
      overlaid += 1;
    } else if (field_key in rawProfile) {
      rawProfile[field_key] = translated_text;
      overlaid += 1;
    }
    // Keys that aren't in either map are silently ignored — they may belong
    // to fields we no longer collect, or they may be application-row columns
    // (port_of_entry, purpose) that the orchestrator reads via a separate
    // path. Logging would be nice but answer-loader has no logger today.
  }

  return { overlaid };
}

/**
 * Throw TranslationGateError if any answer or profile string still contains
 * CJK characters. Bypass the check entirely when CEAC_SKIP_TRANSLATION_GATE=1
 * (used for fill-step debugging where raw Chinese input lets us watch CEAC's
 * validation messages in the browser).
 */
export function assertNoCjkRemaining(
  answers: Record<string, string>,
  profile: Record<string, unknown>,
  options: { applicationId?: string } = {},
): void {
  if (process.env.CEAC_SKIP_TRANSLATION_GATE === "1") return;

  const offenders: string[] = [];

  for (const [key, value] of Object.entries(answers)) {
    if (typeof value === "string" && HAS_CJK.test(value)) {
      offenders.push(`answers.${key}`);
    }
  }
  for (const [key, value] of Object.entries(profile)) {
    if (typeof value === "string" && HAS_CJK.test(value)) {
      offenders.push(`profile.${key}`);
    }
  }

  if (offenders.length === 0) return;

  const idSuffix = options.applicationId ? ` (application ${options.applicationId})` : "";
  throw new TranslationGateError(
    `Translation gate failed${idSuffix}: ${offenders.length} field(s) still contain ` +
      `non-English (CJK) characters. The translate route must run before autofill. ` +
      `Offending keys: ${offenders.slice(0, 20).join(", ")}` +
      (offenders.length > 20 ? `, ... (+${offenders.length - 20} more)` : ""),
    offenders,
  );
}

export const __INTERNALS = { HAS_CJK };

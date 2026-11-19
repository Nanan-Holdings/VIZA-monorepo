import { randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const DS160_SECURITY_ANSWER_FIELD = "ds160_security_answer";

// Uppercase letters and digits without look-alikes (0/O, 1/I/L), so the
// applicant can read the answer back and type it on CEAC's Retrieve page.
const READABLE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const GENERATED_LENGTH = 12;

/** A random CEAC security answer an applicant can read and retype. */
export function generateDs160SecurityAnswer(random: (max: number) => number = randomInt): string {
  let answer = "";
  for (let i = 0; i < GENERATED_LENGTH; i += 1) {
    answer += READABLE_ALPHABET[random(READABLE_ALPHABET.length)];
  }
  return answer;
}

/**
 * Keep a readable copy of the CEAC security answer actually used for this
 * application in the applicant's own answers, so the applicant can retrieve
 * their draft. Fills a missing or blank row only; an existing different
 * answer is never overwritten.
 */
export async function rememberDs160SecurityAnswer(
  client: SupabaseClient,
  applicationId: string,
  answer: string,
): Promise<void> {
  const value = answer.trim();
  if (!value) return;
  const { error: fillError } = await client
    .from("visa_application_answers")
    .update({ value_text: value })
    .eq("application_id", applicationId)
    .eq("field_name", DS160_SECURITY_ANSWER_FIELD)
    .or("value_text.is.null,value_text.eq.");
  if (fillError) throw new Error(`DS-160 security answer could not be saved: ${fillError.message}`);
  const { error: insertError } = await client
    .from("visa_application_answers")
    .upsert(
      { application_id: applicationId, field_name: DS160_SECURITY_ANSWER_FIELD, value_text: value },
      { onConflict: "application_id,field_name", ignoreDuplicates: true },
    );
  if (insertError) throw new Error(`DS-160 security answer could not be saved: ${insertError.message}`);
}

export interface Ds160SecurityAnswerBackfillResult {
  checked: number;
  filled: number;
  failed: number;
}

/**
 * Give older US results a readable security answer: for each submitted or
 * stopped DS-160 result that only has the worker-side ciphertext, decrypt it
 * and save it to the applicant's answers (never overwriting a saved answer).
 * Answers are never logged; only counts are returned.
 */
export async function backfillDs160SecurityAnswers(
  client: SupabaseClient,
  decrypt: (cipher: string) => string,
  limit = 500,
): Promise<Ds160SecurityAnswerBackfillResult> {
  const result: Ds160SecurityAnswerBackfillResult = { checked: 0, filled: 0, failed: 0 };
  const { data: applications, error } = await client
    .from("applications")
    .select("id, submission_result")
    .eq("submission_result->>country", "US")
    .not("submission_result->>securityAnswerCipher", "is", null)
    .limit(limit);
  if (error) throw new Error(`DS-160 security answer backfill query failed: ${error.message}`);
  const rows = (applications ?? []) as Array<{ id: string; submission_result: { securityAnswerCipher?: unknown } | null }>;
  if (rows.length === 0) return result;

  const { data: saved, error: savedError } = await client
    .from("visa_application_answers")
    .select("application_id, value_text")
    .eq("field_name", DS160_SECURITY_ANSWER_FIELD)
    .in("application_id", rows.map((row) => row.id));
  if (savedError) throw new Error(`DS-160 security answer backfill read failed: ${savedError.message}`);
  const hasReadable = new Set(
    (saved ?? [])
      .filter((row: { value_text: unknown }) => typeof row.value_text === "string" && row.value_text.trim())
      .map((row: { application_id: string }) => row.application_id),
  );

  for (const row of rows) {
    if (hasReadable.has(row.id)) continue;
    const cipher = row.submission_result?.securityAnswerCipher;
    if (typeof cipher !== "string" || !cipher) continue;
    result.checked += 1;
    try {
      await rememberDs160SecurityAnswer(client, row.id, decrypt(cipher));
      result.filled += 1;
    } catch {
      result.failed += 1;
    }
  }
  return result;
}

/**
 * Return the application's saved CEAC security answer, creating and saving
 * one first when none exists. The answer is stored with the applicant's own
 * answers before CEAC sees it, so a draft created with it can always be
 * retrieved later and every retry reuses the same answer. A value saved by
 * anyone else (including a concurrent run) always wins over the generated one.
 */
export async function ensureDs160SecurityAnswer(
  client: SupabaseClient,
  applicationId: string,
  generate: () => string = generateDs160SecurityAnswer,
): Promise<string> {
  const candidate = generate();

  // Fill an existing blank row without touching a non-blank one.
  const { error: fillError } = await client
    .from("visa_application_answers")
    .update({ value_text: candidate })
    .eq("application_id", applicationId)
    .eq("field_name", DS160_SECURITY_ANSWER_FIELD)
    .or("value_text.is.null,value_text.eq.");
  if (fillError) throw new Error(`DS-160 security answer could not be saved: ${fillError.message}`);

  const { error: insertError } = await client
    .from("visa_application_answers")
    .upsert(
      { application_id: applicationId, field_name: DS160_SECURITY_ANSWER_FIELD, value_text: candidate },
      { onConflict: "application_id,field_name", ignoreDuplicates: true },
    );
  if (insertError) throw new Error(`DS-160 security answer could not be saved: ${insertError.message}`);

  const { data, error: readError } = await client
    .from("visa_application_answers")
    .select("value_text")
    .eq("application_id", applicationId)
    .eq("field_name", DS160_SECURITY_ANSWER_FIELD)
    .maybeSingle();
  if (readError) throw new Error(`DS-160 security answer could not be read back: ${readError.message}`);
  const stored = typeof data?.value_text === "string" ? data.value_text.trim() : "";
  if (!stored) throw new Error("DS-160 security answer was not persisted; refusing to create an unrecoverable draft.");
  return stored;
}

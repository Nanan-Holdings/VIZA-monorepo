import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildUniversalProfileAnswerPatch,
  UNIVERSAL_PROFILE_SELECT,
} from "@/lib/universal-profile-prefill";
import type { UniversalProfileAnswerRecord } from "@/lib/universal-profile-fields";

type AdminClient = ReturnType<typeof createAdminClient>;

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
} | null | undefined;

/**
 * The reusable-answer table is an optional migration for older deployments.
 * Keep this check local to the server boundary so the route never leaks
 * provider/table details to an applicant.
 */
export function isMissingSchemaFeatureError(
  error: SupabaseErrorLike,
  featureNames: readonly string[],
): boolean {
  if (!error) return false;
  const normalized = error.message?.toLowerCase() ?? "";
  const schemaMissing = error.code === "PGRST204"
    || error.code === "PGRST205"
    || normalized.includes("schema cache")
    || normalized.includes("does not exist")
    || normalized.includes("relation");
  return schemaMissing && featureNames.some((name) => normalized.includes(name.toLowerCase()));
}

interface ReusableAnswerRow {
  canonical_key: string;
  value_text: string;
  value_zh?: string | null;
  value_en?: string | null;
  label_zh?: string | null;
  label_en?: string | null;
  category?: string | null;
  source_application_id?: string | null;
  source_visa_type?: string | null;
  source_field_name?: string | null;
  updated_at?: string | null;
}

function toReusableRecord(row: ReusableAnswerRow): UniversalProfileAnswerRecord {
  return {
    canonicalKey: typeof row.canonical_key === "string" ? row.canonical_key : "",
    value: typeof row.value_text === "string" ? row.value_text : "",
    valueZh: row.value_zh,
    valueEn: row.value_en,
    labelZh: row.label_zh,
    labelEn: row.label_en,
    category: row.category as UniversalProfileAnswerRecord["category"],
    sourceApplicationId: row.source_application_id,
    sourceVisaType: row.source_visa_type,
    sourceFieldName: row.source_field_name,
    updatedAt: row.updated_at,
  };
}

/**
 * The reusable-answer query is ordered newest-first. Keep that order while
 * dropping duplicate canonical keys so older rows cannot overwrite newer
 * values in the universal-profile patch builder.
 */
export function dedupeReusableProfileAnswers(
  records: UniversalProfileAnswerRecord[],
): UniversalProfileAnswerRecord[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    if (seen.has(record.canonicalKey)) return false;
    seen.add(record.canonicalKey);
    return true;
  });
}

/**
 * Load reusable applicant facts without making the optional answers table a
 * hard dependency. This function is server-only and returns the same flat
 * answer patch used by application-form prefilling.
 */
export async function loadShenyangApplicantProfileFallbacks(
  admin: AdminClient,
  applicantId: string,
): Promise<Record<string, string>> {
  let profileResult: {
    data: Record<string, unknown> | null;
    error: SupabaseErrorLike;
  };
  try {
    profileResult = await admin
      .from("applicant_profiles")
      .select(UNIVERSAL_PROFILE_SELECT)
      .eq("id", applicantId)
      .maybeSingle() as unknown as {
        data: Record<string, unknown> | null;
        error: SupabaseErrorLike;
      };
  } catch {
    throw new Error("Applicant profile could not be read.");
  }

  if (profileResult.error) {
    throw new Error("Applicant profile could not be read.");
  }

  let reusableResult: {
    data: ReusableAnswerRow[] | null;
    error: SupabaseErrorLike;
  };
  try {
    reusableResult = await admin
      .from("universal_profile_answers")
      .select("canonical_key,value_text,value_zh,value_en,label_zh,label_en,category,source_application_id,source_visa_type,source_field_name,updated_at")
      .eq("applicant_id", applicantId)
      .order("updated_at", { ascending: false }) as unknown as {
        data: ReusableAnswerRow[] | null;
        error: SupabaseErrorLike;
      };
  } catch {
    throw new Error("Reusable applicant details could not be read.");
  }

  if (reusableResult.error && !isMissingSchemaFeatureError(reusableResult.error, ["universal_profile_answers"])) {
    throw new Error("Reusable applicant details could not be read.");
  }

  const reusableAnswers = reusableResult.error
    ? []
    : dedupeReusableProfileAnswers((reusableResult.data ?? []).map(toReusableRecord));
  const profile = profileResult.data ?? {};
  return buildUniversalProfileAnswerPatch({
    ...(profile as Record<string, unknown>),
    reusable_answers: reusableAnswers,
  });
}

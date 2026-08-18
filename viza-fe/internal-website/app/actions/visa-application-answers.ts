"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getClientSessionWithFallback,
  type ClientSession,
} from "@/lib/client-session";
import {
  resolveApplicantProfileForAuthUser,
  type ApplicantProfileIdentityRow,
  type ApplicantProfileIdentityStore,
} from "@/lib/applicant-profile-identity";
import { auditPiiRead } from "@/lib/legal/audit-pii";
import {
  buildUniversalProfileAnswerPatch,
  type UniversalProfileSnapshot,
} from "@/lib/universal-profile-prefill";
import {
  getCanonicalVisaDestinationCountry,
  getFormVisaType,
} from "@/lib/visa-destinations";
import {
  buildUniversalProfileFieldDefinitions,
  canonicalizeUniversalProfileFieldName,
  getUniversalProfileCategory,
  isReusableUniversalProfileField,
  splitUniversalProfileRepeatKey,
  type UniversalProfileAnswerRecord,
  type UniversalProfileFieldDefinition,
} from "@/lib/universal-profile-fields";
import { getChineseLabel, getEnglishLabel } from "@/lib/ds160-translations";
import { normalizeBilingualFormField } from "@/lib/bilingual-schema-contract";
import { retryTransientSupabaseResult } from "@/lib/supabase/fetch-with-timeout";
import {
  cacheApplicationAnswers,
  isResilienceEligibleError,
  loadCachedApplicationAnswers,
  queueApplicationAnswers,
  type ApplicationAnswersEvent,
} from "@/lib/resilience/application-answers";
import {
  dbRowToFormField,
  type VisaFormFieldDbRow,
  type WizardStep,
} from "@/types/visa-form-fields";
import {
  applicationIdentityMatches,
  findOngoingApplicationByIdentity,
  isOngoingApplicationRecord,
} from "@/lib/applications/ongoing-application";
import {
  isQaDryRunPurpose,
  isSyntheticQaValue,
} from "@/lib/applications/qa-safety";
import { sanitizeCustomerSubmissionResult } from "@/app/api/applications/customer-submission-result";
import { canContinueKoreaArrivalPreflight } from "@/app/client/arrival-cards/south-korea/eligibility";
import { buildKoreaEArrivalPreflightAnswerPatch } from "@/features/kr-arrival-card/preflight";

type ApplicationOwnerProfile = {
  id?: string | null;
  auth_user_id?: string | null;
  dependant_of_user_id?: string | null;
};

type UniversalProfileSaveInput = Omit<
  UniversalProfileSnapshot,
  "reusable_answers"
> & {
  wechat?: string | null;
};
type UniversalProfileSaveField = keyof UniversalProfileSaveInput;
type SeedableUniversalProfile = UniversalProfileSnapshot & {
  id?: string | null;
  auth_user_id?: string | null;
  email?: string | null;
  updated_at?: string | null;
};
type SupabaseErrorLike = { code?: string; message?: string } | null;

const UNIVERSAL_PROFILE_SAVE_FIELDS: UniversalProfileSaveField[] = [
  "full_name",
  "full_name_zh",
  "full_name_en",
  "surname",
  "surname_zh",
  "surname_en",
  "given_names",
  "given_names_zh",
  "given_names_en",
  "date_of_birth",
  "place_of_birth",
  "place_of_birth_zh",
  "place_of_birth_en",
  "birth_country",
  "birth_province_or_state",
  "birth_province_or_state_zh",
  "birth_province_or_state_en",
  "birth_city",
  "birth_city_zh",
  "birth_city_en",
  "gender",
  "nationality",
  "occupation",
  "occupation_zh",
  "occupation_en",
  "address",
  "address_zh",
  "address_en",
  "passport_number",
  "passport_issue_date",
  "passport_expiry_date",
  "passport_issuing_country",
  "passport_issuing_authority",
  "email",
  "phone",
  "wechat",
];
const UNIVERSAL_PROFILE_SAVE_FIELD_SET = new Set<string>(
  UNIVERSAL_PROFILE_SAVE_FIELDS
);

const UNIVERSAL_TO_LEGACY_PROFILE_COLUMN: Record<
  string,
  UniversalProfileSaveField
> = {
  surname: "surname",
  given_names: "given_names",
  date_of_birth: "date_of_birth",
  place_of_birth: "birth_city",
  birth_country: "birth_country",
  birth_province_or_state: "birth_province_or_state",
  gender: "gender",
  nationality: "nationality",
  occupation: "occupation",
  address: "address",
  passport_number: "passport_number",
  passport_issue_date: "passport_issue_date",
  passport_expiry_date: "passport_expiry_date",
  passport_issuing_country: "passport_issuing_country",
  passport_issuing_authority: "passport_issuing_authority",
  email: "email",
  phone: "phone",
  wechat: "wechat",
};

const PROFILE_SAVE_FALLBACK_COLUMNS = [
  "full_name_zh",
  "full_name_en",
  "surname",
  "surname_zh",
  "surname_en",
  "given_names",
  "given_names_zh",
  "given_names_en",
  "place_of_birth_zh",
  "place_of_birth_en",
  "birth_country",
  "birth_province_or_state",
  "birth_province_or_state_zh",
  "birth_province_or_state_en",
  "birth_city",
  "birth_city_zh",
  "birth_city_en",
  "occupation_zh",
  "occupation_en",
  "address_zh",
  "address_en",
  "wechat",
] as const;

function cleanOptional(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

type NormalizedAnswerValueResult =
  { ok: true; value: string } | { ok: false; error: string };

type NormalizedAnswersResult =
  { ok: true; data: Record<string, string> } | { ok: false; error: string };

function normalizeDynamicAnswerValue(
  fieldName: string,
  value: unknown
): NormalizedAnswerValueResult {
  if (value === null || value === undefined) return { ok: true, value: "" };
  if (typeof value === "string") return { ok: true, value };
  if (typeof value === "number" || typeof value === "boolean")
    return { ok: true, value: String(value) };

  if (typeof value === "object") {
    const maybeValueObject = value as { value?: unknown };
    if (typeof maybeValueObject.value === "string") {
      return { ok: true, value: maybeValueObject.value };
    }
  }

  return {
    ok: false,
    error: `Invalid answer value for ${fieldName}: expected text but received ${Array.isArray(value) ? "array" : typeof value}.`,
  };
}

function normalizeDynamicAnswers(
  data: Record<string, unknown>
): NormalizedAnswersResult {
  const normalized: Record<string, string> = {};

  for (const [rawFieldName, rawValue] of Object.entries(data)) {
    const fieldName = rawFieldName.trim();
    if (!fieldName)
      return {
        ok: false,
        error: "Invalid answer field name: field name cannot be empty.",
      };

    const result = normalizeDynamicAnswerValue(fieldName, rawValue);
    if (!result.ok) return { ok: false, error: result.error };
    if (isSyntheticQaValue(result.value)) {
      return {
        ok: false,
        error: `Synthetic QA data is not allowed in application answers (${fieldName}). Clear the field and enter the applicant's real information.`,
      };
    }
    normalized[fieldName] = result.value;
  }

  return { ok: true, data: normalized };
}

function isRetryableMissingProfileColumnError(message: string) {
  const normalized = message.toLowerCase();
  return (
    PROFILE_SAVE_FALLBACK_COLUMNS.some((column) =>
      normalized.includes(column)
    ) &&
    (normalized.includes("schema cache") ||
      normalized.includes("column") ||
      normalized.includes("relation"))
  );
}

function getMissingProfileSaveColumn(
  message: string,
  payload: Record<string, unknown>
) {
  if (!isRetryableMissingProfileColumnError(message)) return null;
  const normalized = message.toLowerCase();
  return (
    PROFILE_SAVE_FALLBACK_COLUMNS.find(
      (column) => column in payload && normalized.includes(column)
    ) ?? null
  );
}

function isMissingColumnError(message: string, column: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes(column.toLowerCase()) &&
    (normalized.includes("schema cache") ||
      normalized.includes("column") ||
      normalized.includes("does not exist"))
  );
}

function isMissingSchemaFeatureError(
  error: SupabaseErrorLike,
  featureNames: string[]
) {
  if (!error) return false;
  const normalized = error.message?.toLowerCase() ?? "";
  return (
    (error.code === "PGRST204" ||
      normalized.includes("schema cache") ||
      normalized.includes("does not exist") ||
      normalized.includes("relation")) &&
    featureNames.some((name) => normalized.includes(name.toLowerCase()))
  );
}

interface UniversalProfileAnswerDbRow {
  canonical_key: string;
  value_text: string;
  value_zh?: string | null;
  value_en?: string | null;
  label_zh?: string | null;
  label_en?: string | null;
  field_type?: UniversalProfileAnswerRecord["fieldType"] | null;
  category?: UniversalProfileAnswerRecord["category"] | null;
  source_application_id?: string | null;
  source_visa_type?: string | null;
  source_field_name?: string | null;
  updated_at?: string | null;
}

function toUniversalProfileAnswerRecord(
  row: UniversalProfileAnswerDbRow
): UniversalProfileAnswerRecord {
  return {
    canonicalKey: row.canonical_key,
    value: row.value_text,
    valueZh: row.value_zh,
    valueEn: row.value_en,
    labelZh: row.label_zh,
    labelEn: row.label_en,
    fieldType: row.field_type,
    category: row.category,
    sourceApplicationId: row.source_application_id,
    sourceVisaType: row.source_visa_type,
    sourceFieldName: row.source_field_name,
    updatedAt: row.updated_at,
  };
}

async function loadReusableProfileAnswers(
  adminClient: ReturnType<typeof createAdminClient>,
  userId: string
) {
  const { data, error } = await adminClient
    .from("universal_profile_answers")
    .select(
      "canonical_key, value_text, value_zh, value_en, label_zh, label_en, field_type, category, source_application_id, source_visa_type, source_field_name, updated_at"
    )
    .eq("auth_user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    if (isMissingSchemaFeatureError(error, ["universal_profile_answers"])) {
      return {
        answers: [] as UniversalProfileAnswerRecord[],
        schemaAvailable: false,
      };
    }
    return {
      answers: [] as UniversalProfileAnswerRecord[],
      schemaAvailable: true,
      error: error.message,
    };
  }

  return {
    answers: ((data ?? []) as UniversalProfileAnswerDbRow[]).map(
      toUniversalProfileAnswerRecord
    ),
    schemaAvailable: true,
  };
}

function groupUniversalSchemaRows(rows: VisaFormFieldDbRow[]) {
  const stepMap = new Map<string, WizardStep>();
  for (const row of rows) {
    const key = `${row.visa_type}:${row.step_number}:${row.step_name ?? ""}`;
    const step = stepMap.get(key) ?? {
      stepNumber: row.step_number,
      stepName: row.step_name || `Step ${row.step_number}`,
      fields: [],
    };
    step.fields.push(normalizeBilingualFormField(dbRowToFormField(row)));
    stepMap.set(key, step);
  }
  return Array.from(stepMap.values());
}

async function loadUniversalProfileSchemaDefinitions(
  adminClient: ReturnType<typeof createAdminClient>
) {
  const pageSize = 1_000;
  const rows: VisaFormFieldDbRow[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await adminClient
      .from("visa_form_fields")
      .select("*")
      .order("visa_type", { ascending: true })
      .order("step_number", { ascending: true })
      .order("display_order", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error)
      return {
        fields: [] as UniversalProfileFieldDefinition[],
        error: error.message,
      };
    const page = (data ?? []) as VisaFormFieldDbRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return {
    fields: buildUniversalProfileFieldDefinitions(
      groupUniversalSchemaRows(rows)
    ),
  };
}

async function loadApplicationOwnerProfile(
  adminClient: ReturnType<typeof createAdminClient>,
  applicantId: string
): Promise<{ profile: ApplicationOwnerProfile | null; error?: string }> {
  const { data, error } = await adminClient
    .from("applicant_profiles")
    .select("id, auth_user_id, dependant_of_user_id")
    .eq("id", applicantId)
    .maybeSingle();

  if (!error) return { profile: data };

  if (!isMissingColumnError(error.message, "dependant_of_user_id")) {
    return { profile: null, error: error.message };
  }

  const fallbackResult = await adminClient
    .from("applicant_profiles")
    .select("id, auth_user_id")
    .eq("id", applicantId)
    .maybeSingle();

  return {
    profile: fallbackResult.data,
    error: fallbackResult.error?.message,
  };
}

function createApplicantProfileIdentityStore(
  adminClient: ReturnType<typeof createAdminClient>
): ApplicantProfileIdentityStore<
  SeedableUniversalProfile & ApplicantProfileIdentityRow
> {
  return {
    async findByAuthUserId(authUserId) {
      const { data, error } = await adminClient
        .from("applicant_profiles")
        .select("*")
        .eq("auth_user_id", authUserId)
        .maybeSingle();

      return {
        profile:
          (data as
            (SeedableUniversalProfile & ApplicantProfileIdentityRow) | null) ??
          null,
        error: error?.message,
      };
    },
    async findByEmail(email) {
      const { data, error } = await adminClient
        .from("applicant_profiles")
        .select("*")
        .ilike("email", email)
        .order("updated_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      return {
        profile:
          (data as
            (SeedableUniversalProfile & ApplicantProfileIdentityRow) | null) ??
          null,
        error: error?.message,
      };
    },
    async bindProfileToAuthUser(profileId, authUserId) {
      const { data, error } = await adminClient
        .from("applicant_profiles")
        .update({
          auth_user_id: authUserId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profileId)
        .select("*")
        .single();

      return {
        profile:
          (data as
            (SeedableUniversalProfile & ApplicantProfileIdentityRow) | null) ??
          null,
        error: error?.message,
      };
    },
  };
}

async function loadCurrentApplicantProfile(
  adminClient: ReturnType<typeof createAdminClient>,
  user: { id: string; email?: string | null }
) {
  return resolveApplicantProfileForAuthUser(
    createApplicantProfileIdentityStore(adminClient),
    user
  );
}

async function loadCurrentApplicantProfileForSession(
  adminClient: ReturnType<typeof createAdminClient>,
  session: ClientSession
) {
  const { data: profileById, error: profileByIdError } = await adminClient
    .from("applicant_profiles")
    .select("*")
    .eq("id", session.userId)
    .maybeSingle();
  if (profileByIdError)
    return { profile: null, error: profileByIdError.message };
  if (profileById) return { profile: profileById as SeedableUniversalProfile };

  if (session.authUserId) {
    return loadCurrentApplicantProfile(adminClient, {
      id: session.authUserId,
      email: session.email,
    });
  }

  const { data: profileByEmail, error: profileByEmailError } = await adminClient
    .from("applicant_profiles")
    .select("*")
    .ilike("email", session.email)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  return {
    profile: (profileByEmail as SeedableUniversalProfile | null) ?? null,
    error: profileByEmailError?.message,
  };
}

function ownsApplication(
  profile: ApplicationOwnerProfile | null,
  userId: string
): profile is ApplicationOwnerProfile & { id: string } {
  return Boolean(
    profile?.id &&
    (profile.auth_user_id === userId || profile.dependant_of_user_id === userId)
  );
}

async function upsertApplicantProfileWithOptionalColumnFallback(
  adminClient: ReturnType<typeof createAdminClient>,
  payload: Record<string, string | null>
) {
  let nextPayload = { ...payload };
  const missingColumns: string[] = [];

  for (
    let attempt = 0;
    attempt <= PROFILE_SAVE_FALLBACK_COLUMNS.length;
    attempt += 1
  ) {
    const result = await adminClient
      .from("applicant_profiles")
      .upsert(nextPayload, { onConflict: "auth_user_id" })
      .select("*")
      .single();

    if (!result.error) return { ...result, missingColumns };

    const missingColumn = getMissingProfileSaveColumn(
      result.error.message,
      nextPayload
    );
    if (!missingColumn) return result;

    const { [missingColumn]: _missingValue, ...fallbackPayload } = nextPayload;
    missingColumns.push(missingColumn);
    nextPayload = fallbackPayload;
  }

  const result = await adminClient
    .from("applicant_profiles")
    .upsert(nextPayload, { onConflict: "auth_user_id" })
    .select("*")
    .single();
  return { ...result, missingColumns };
}

async function seedNewApplicationFromUniversalProfile(
  adminClient: ReturnType<typeof createAdminClient>,
  applicationId: string,
  applicantId: string,
  profile: SeedableUniversalProfile
) {
  const answerPatch = buildUniversalProfileAnswerPatch(profile);
  const answerEntries = Object.entries(answerPatch).filter(
    ([, value]) => value.trim() !== ""
  );
  if (answerEntries.length === 0 || !profile.id) return null;

  const now = new Date().toISOString();
  const sourceMetadata = {
    source: "universal_profile",
    profileId: profile.id,
    seededAt: now,
  };
  const answerRows = answerEntries.map(([fieldName, value]) => ({
    application_id: applicationId,
    field_name: fieldName,
    value_text: value,
    updated_at: now,
    source: "universal_profile",
    source_profile_updated_at: profile.updated_at ?? null,
    source_metadata: sourceMetadata,
  }));

  const { error: answerError } = await adminClient
    .from("visa_application_answers")
    .upsert(answerRows, { onConflict: "application_id,field_name" });

  if (answerError) {
    if (
      !isMissingSchemaFeatureError(answerError, [
        "source",
        "source_profile_updated_at",
        "source_metadata",
      ])
    ) {
      return answerError.message;
    }

    const fallbackRows = answerEntries.map(([fieldName, value]) => ({
      application_id: applicationId,
      field_name: fieldName,
      value_text: value,
      updated_at: now,
    }));
    const { error: fallbackAnswerError } = await adminClient
      .from("visa_application_answers")
      .upsert(fallbackRows, { onConflict: "application_id,field_name" });
    if (fallbackAnswerError) return fallbackAnswerError.message;
  }

  const { error: snapshotError } = await adminClient
    .from("application_profile_snapshots")
    .upsert(
      {
        application_id: applicationId,
        applicant_id: applicantId,
        profile_id: profile.id,
        source: "universal_profile",
        profile_updated_at: profile.updated_at ?? null,
        snapshot_json: profile,
        answer_keys: answerEntries.map(([fieldName]) => fieldName),
        created_at: now,
      },
      { onConflict: "application_id" }
    );

  if (
    snapshotError &&
    !isMissingSchemaFeatureError(snapshotError, [
      "application_profile_snapshots",
    ])
  ) {
    return snapshotError.message;
  }

  return null;
}

/**
 * Save dynamic form answers for a visa application.
 * Uses admin client to bypass RLS on visa_application_answers.
 */
async function saveDynamicAnswersOnce(
  applicationId: string,
  data: Record<string, unknown>
): Promise<{ error?: string; queued?: boolean }> {
  try {
    const session = await getClientSessionWithFallback();
    if (!session) return { error: "Not authenticated" };

    const normalized = normalizeDynamicAnswers(data);
    if (!normalized.ok) return { error: normalized.error };
    const answers = normalized.data;
    const savedAt = new Date().toISOString();
    const resilienceEvent: ApplicationAnswersEvent = {
      version: 1,
      applicantId: session.userId,
      applicationId,
      answers,
      savedAt,
    };

    // Verify the user owns this application
    const adminClient = createAdminClient({
      requestTimeoutMs: 4_000,
      retryDelaysMs: [],
    });
    const { data: app, error: appError } = await adminClient
      .from("applications")
      .select("id, applicant_id")
      .eq("id", applicationId)
      .single();

    if (appError) {
      if (isResilienceEligibleError(appError.message)) {
        await queueApplicationAnswers(resilienceEvent);
        return { queued: true };
      }
      return { error: appError.message };
    }
    if (!app) return { error: "Application not found" };

    const { profile, error: profileError } = await loadApplicationOwnerProfile(
      adminClient,
      app.applicant_id
    );

    if (profileError) return { error: profileError };
    if (!ownsApplicationSession(profile, session)) {
      return { error: "Unauthorized" };
    }

    const now = savedAt;
    const emptyFieldNames = Object.entries(answers)
      .filter(
        ([fieldName, value]) => fieldName.trim() !== "" && value.trim() === ""
      )
      .map(([fieldName]) => fieldName);

    if (emptyFieldNames.length > 0) {
      const { error: deleteError } = await adminClient
        .from("visa_application_answers")
        .delete()
        .eq("application_id", applicationId)
        .in("field_name", emptyFieldNames);
      if (deleteError) {
        if (isResilienceEligibleError(deleteError.message)) {
          await queueApplicationAnswers(resilienceEvent);
          return { queued: true };
        }
        return { error: deleteError.message };
      }
    }

    const upserts = Object.entries(answers)
      .filter(([, v]) => v.trim() !== "")
      .map(([fieldName, value]) => ({
        application_id: applicationId,
        field_name: fieldName,
        value_text: value,
        // Manual form input is authoritative. Persisting it clears any older
        // assistant/OCR provenance so a later assistant turn cannot overwrite
        // the applicant's edit.
        source: "user_form",
        source_profile_updated_at: null,
        source_metadata: null,
        updated_at: now,
      }));

    if (upserts.length > 0) {
      const { error: upsertError } = await adminClient
        .from("visa_application_answers")
        .upsert(upserts, { onConflict: "application_id,field_name" });
      if (upsertError) {
        if (
          !isMissingSchemaFeatureError(upsertError, [
            "source",
            "source_profile_updated_at",
            "source_metadata",
          ])
        ) {
          if (isResilienceEligibleError(upsertError.message)) {
            await queueApplicationAnswers(resilienceEvent);
            return { queued: true };
          }
          return { error: upsertError.message };
        }
        const legacyUpserts = upserts.map(
          ({
            source: _source,
            source_profile_updated_at: _profileUpdatedAt,
            source_metadata: _metadata,
            ...row
          }) => row
        );
        const { error: legacyError } = await adminClient
          .from("visa_application_answers")
          .upsert(legacyUpserts, { onConflict: "application_id,field_name" });
        if (legacyError) {
          if (isResilienceEligibleError(legacyError.message)) {
            await queueApplicationAnswers(resilienceEvent);
            return { queued: true };
          }
          return { error: legacyError.message };
        }
      }
    }

    // Dynamic visa form saves are application-scoped. Universal Profile is a
    // reusable source for initial autofill and must only change through explicit
    // profile/OCR confirmation flows, not from arbitrary form answers.
    await cacheApplicationAnswers(resilienceEvent).catch((error) => {
      console.warn("Failed to refresh encrypted application answer cache", {
        applicationId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
    return {};
  } catch (err) {
    if (isResilienceEligibleError(err)) {
      const session = await getClientSessionWithFallback();
      const normalized = normalizeDynamicAnswers(data);
      if (session && normalized.ok) {
        try {
          await queueApplicationAnswers({
            version: 1,
            applicantId: session.userId,
            applicationId,
            answers: normalized.data,
            savedAt: new Date().toISOString(),
          });
          return { queued: true };
        } catch (queueError) {
          console.error("Encrypted application answer outbox enqueue failed", {
            applicationId,
            error:
              queueError instanceof Error
                ? queueError.message
                : String(queueError),
          });
        }
      }
    }
    return { error: err instanceof Error ? err.message : "Failed to save" };
  }
}

function ownsApplicationSession(
  profile: ApplicationOwnerProfile | null,
  session: ClientSession
): profile is ApplicationOwnerProfile & { id: string } {
  return Boolean(
    profile?.id &&
    (profile.id === session.userId ||
      (session.authUserId && profile.auth_user_id === session.authUserId) ||
      profile.dependant_of_user_id === (session.authUserId ?? session.userId))
  );
}

export async function saveDynamicAnswers(
  applicationId: string,
  data: Record<string, unknown>
): Promise<{ error?: string }> {
  // This save is idempotent: blank values are deleted and non-blank values are
  // upserted on (application_id, field_name). A bounded retry is therefore safe
  // when PostgREST briefly cannot build its schema cache during autosave.
  return retryTransientSupabaseResult(() =>
    saveDynamicAnswersOnce(applicationId, data)
  );
}

/**
 * Save the reusable bilingual profile. Existing visa application answers stay
 * application-scoped; forms read this profile only for initial autofill.
 */
export async function saveUniversalProfileWithSharedAnswers(input: {
  profile: UniversalProfileSaveInput;
  applicationId?: string | null;
  country?: string;
  visaType?: string;
  preferExplicit?: boolean;
  clearedFields?: UniversalProfileSaveField[];
}): Promise<{
  applicationId?: string;
  answerCount?: number;
  profile?: UniversalProfileSnapshot;
  missingColumns?: string[];
  schemaWarning?: string;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const adminClient = createAdminClient();
    const existingProfileResult = await loadCurrentApplicantProfile(
      adminClient,
      user
    );

    if (existingProfileResult.error)
      return { error: existingProfileResult.error };

    const clearedFields = new Set(input.clearedFields ?? []);
    const profilePatch: Record<string, string | null> = {
      auth_user_id: user.id,
      updated_at: new Date().toISOString(),
    };

    for (const field of UNIVERSAL_PROFILE_SAVE_FIELDS) {
      const rawValue = input.profile[field];
      const value = cleanOptional(rawValue);
      if (value !== null) {
        if (isSyntheticQaValue(value)) {
          return {
            error: `Synthetic QA data is not allowed in Universal Profile (${field}).`,
          };
        }
        profilePatch[field] = value;
      } else if (clearedFields.has(field)) {
        profilePatch[field] = null;
      }
    }

    if (!existingProfileResult.profile && !("email" in profilePatch)) {
      profilePatch.email = user.email ?? null;
    }

    const profileResult =
      await upsertApplicantProfileWithOptionalColumnFallback(
        adminClient,
        profilePatch
      );
    const savedProfile = profileResult.data;
    const profileError = profileResult.error;

    if (profileError || !savedProfile) {
      return { error: profileError?.message ?? "Failed to save profile" };
    }

    const missingColumns =
      "missingColumns" in profileResult ? profileResult.missingColumns : [];

    return {
      applicationId: input.applicationId ?? undefined,
      answerCount: 0,
      profile: savedProfile as UniversalProfileSnapshot,
      missingColumns,
      schemaWarning:
        missingColumns.length > 0
          ? `Universal Profile saved with legacy fallback. Missing applicant_profiles columns: ${missingColumns.join(", ")}. Run migration 0090_applicant_profile_bilingual_fields.sql.`
          : undefined,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to save profile",
    };
  }
}

export async function loadUniversalProfileWorkspace(): Promise<{
  profile?: UniversalProfileSnapshot;
  fields: UniversalProfileFieldDefinition[];
  answers: UniversalProfileAnswerRecord[];
  schemaAvailable: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return {
        fields: [],
        answers: [],
        schemaAvailable: true,
        error: "Not authenticated",
      };

    const adminClient = createAdminClient();
    const profileResult = await loadCurrentApplicantProfile(adminClient, user);
    if (profileResult.error || !profileResult.profile?.id) {
      return {
        fields: [],
        answers: [],
        schemaAvailable: true,
        error: profileResult.error ?? "Profile not found",
      };
    }

    const [schemaResult, answerResult] = await Promise.all([
      loadUniversalProfileSchemaDefinitions(adminClient),
      loadReusableProfileAnswers(adminClient, user.id),
    ]);
    if (schemaResult.error) {
      return {
        profile: profileResult.profile,
        fields: [],
        answers: answerResult.answers,
        schemaAvailable: answerResult.schemaAvailable,
        error: schemaResult.error,
      };
    }
    if (answerResult.error) {
      return {
        profile: profileResult.profile,
        fields: schemaResult.fields,
        answers: [],
        schemaAvailable: answerResult.schemaAvailable,
        error: answerResult.error,
      };
    }

    const fieldsByKey = new Map(
      schemaResult.fields.map((field) => [field.canonicalKey, field])
    );
    for (const answer of answerResult.answers) {
      if (fieldsByKey.has(answer.canonicalKey)) continue;
      fieldsByKey.set(answer.canonicalKey, {
        id: `saved:${answer.canonicalKey}`,
        visaType: answer.sourceVisaType ?? "UNIVERSAL_PROFILE",
        fieldName: answer.canonicalKey,
        canonicalKey: answer.canonicalKey,
        label:
          answer.labelEn ||
          answer.labelZh ||
          answer.canonicalKey.replaceAll("_", " "),
        fieldType: answer.fieldType ?? "text",
        required: false,
        stepNumber: 0,
        stepName: answer.category ?? "Saved information",
        displayOrder: 0,
        placeholder: null,
        validationRules: null,
        options: null,
        conditionalLogic: null,
        category:
          answer.category ?? getUniversalProfileCategory(answer.canonicalKey),
        sourceVisaTypes: answer.sourceVisaType ? [answer.sourceVisaType] : [],
      });
    }

    await auditPiiRead(
      "actions/visa-application-answers:loadUniversalProfileWorkspace",
      profileResult.profile.id,
      ["form_answers", "passport", "contact", "address"],
      { purpose: "self_view" }
    );

    return {
      profile: {
        ...profileResult.profile,
        reusable_answers: answerResult.answers,
      },
      fields: Array.from(fieldsByKey.values()),
      answers: answerResult.answers,
      schemaAvailable: answerResult.schemaAvailable,
    };
  } catch (err) {
    return {
      fields: [],
      answers: [],
      schemaAvailable: true,
      error:
        err instanceof Error ? err.message : "Failed to load universal profile",
    };
  }
}

export async function saveUniversalProfileAnswerValues(input: {
  answers: Array<{
    canonicalKey: string;
    value: string;
    valueZh?: string | null;
    valueEn?: string | null;
  }>;
}): Promise<{ savedCount?: number; deletedCount?: number; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };
    if (input.answers.length > 250)
      return { error: "Too many profile fields in one update" };

    const adminClient = createAdminClient();
    const profileResult = await loadCurrentApplicantProfile(adminClient, user);
    if (profileResult.error || !profileResult.profile?.id) {
      return { error: profileResult.error ?? "Profile not found" };
    }

    const [schemaResult, existingResult] = await Promise.all([
      loadUniversalProfileSchemaDefinitions(adminClient),
      loadReusableProfileAnswers(adminClient, user.id),
    ]);
    if (schemaResult.error) return { error: schemaResult.error };
    if (!existingResult.schemaAvailable)
      return { error: "Universal Profile schema is not installed" };
    if (existingResult.error) return { error: existingResult.error };

    const definitions = new Map(
      schemaResult.fields.map((field) => [field.canonicalKey, field])
    );
    const existingKeys = new Set(
      existingResult.answers.map((answer) => answer.canonicalKey)
    );
    const now = new Date().toISOString();
    const upserts: Record<string, unknown>[] = [];
    const deletes: string[] = [];

    for (const answer of input.answers) {
      const canonicalKey = canonicalizeUniversalProfileFieldName(
        answer.canonicalKey
      );
      const definition = definitions.get(canonicalKey);
      if (!definition && !existingKeys.has(canonicalKey)) continue;
      const value = cleanOptional(answer.value);
      if (!value) {
        deletes.push(canonicalKey);
        continue;
      }
      const valueZh = cleanOptional(answer.valueZh);
      const valueEn = cleanOptional(answer.valueEn);
      if (
        isSyntheticQaValue(value) ||
        isSyntheticQaValue(valueZh) ||
        isSyntheticQaValue(valueEn)
      ) {
        return {
          error: `Synthetic QA data is not allowed in Universal Profile (${canonicalKey}).`,
        };
      }
      upserts.push({
        applicant_id: profileResult.profile.id,
        auth_user_id: user.id,
        canonical_key: canonicalKey,
        value_text: value,
        value_zh: valueZh,
        value_en: valueEn,
        label_zh: definition ? getChineseLabel(definition.label) : null,
        label_en: definition ? getEnglishLabel(definition.label) : null,
        field_type: definition?.fieldType ?? "text",
        category:
          definition?.category ?? getUniversalProfileCategory(canonicalKey),
        source_field_name: definition?.fieldName ?? canonicalKey,
        field_schema: definition ?? {},
        updated_at: now,
      });
    }

    if (deletes.length > 0) {
      const { error } = await adminClient
        .from("universal_profile_answers")
        .delete()
        .eq("auth_user_id", user.id)
        .in("canonical_key", deletes);
      if (error) return { error: error.message };
    }
    if (upserts.length > 0) {
      const { error } = await adminClient
        .from("universal_profile_answers")
        .upsert(upserts, { onConflict: "auth_user_id,canonical_key" });
      if (error) return { error: error.message };
    }

    return { savedCount: upserts.length, deletedCount: deletes.length };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to save universal profile",
    };
  }
}

export async function syncApplicationAnswersToUniversalProfile(
  applicationId: string
): Promise<{ savedCount?: number; skippedCount?: number; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const adminClient = createAdminClient();
    const { data: application, error: applicationError } = await adminClient
      .from("applications")
      .select("id, applicant_id, visa_type, purpose")
      .eq("id", applicationId)
      .maybeSingle();
    if (applicationError) return { error: applicationError.message };
    if (!application?.applicant_id) return { error: "Application not found" };
    if (isQaDryRunPurpose(application.purpose)) {
      return {
        error: "QA dry-run answers cannot be copied into Universal Profile.",
      };
    }

    const ownerResult = await loadApplicationOwnerProfile(
      adminClient,
      application.applicant_id
    );
    if (ownerResult.error) return { error: ownerResult.error };
    if (!ownsApplication(ownerResult.profile, user.id))
      return { error: "Unauthorized" };

    const [
      { data: schemaRows, error: schemaError },
      { data: answerRows, error: answerError },
    ] = await Promise.all([
      adminClient
        .from("visa_form_fields")
        .select("*")
        .eq("visa_type", application.visa_type),
      adminClient
        .from("visa_application_answers")
        .select("field_name, value_text")
        .eq("application_id", applicationId),
    ]);
    if (schemaError) return { error: schemaError.message };
    if (answerError) return { error: answerError.message };

    const fields = ((schemaRows ?? []) as VisaFormFieldDbRow[]).map((row) =>
      normalizeBilingualFormField(dbRowToFormField(row))
    );
    const fieldsByName = new Map(
      fields.map((field) => [field.fieldName, field])
    );
    const answers = new Map(
      (
        (answerRows ?? []) as Array<{
          field_name: string;
          value_text: string | null;
        }>
      ).map((row) => [row.field_name, row.value_text?.trim() ?? ""] as const)
    );
    const now = new Date().toISOString();
    const upserts: Record<string, unknown>[] = [];
    const legacyProfilePatch: Record<string, string> = {};
    let skippedCount = 0;

    for (const [fieldName, value] of answers) {
      if (
        !value ||
        fieldName.endsWith("_zh") ||
        fieldName.endsWith("_en") ||
        fieldName.startsWith("__")
      )
        continue;
      const { baseKey, repeatSuffix } =
        splitUniversalProfileRepeatKey(fieldName);
      const field = fieldsByName.get(baseKey);
      if (!field || !isReusableUniversalProfileField(field)) {
        skippedCount += 1;
        continue;
      }
      const valueZh = cleanOptional(answers.get(`${fieldName}_zh`));
      const valueEn = cleanOptional(answers.get(`${fieldName}_en`));
      if (
        isSyntheticQaValue(value) ||
        isSyntheticQaValue(valueZh) ||
        isSyntheticQaValue(valueEn)
      ) {
        skippedCount += 1;
        continue;
      }
      const canonicalKey = `${canonicalizeUniversalProfileFieldName(baseKey)}${repeatSuffix}`;
      const legacyColumn = repeatSuffix
        ? null
        : UNIVERSAL_TO_LEGACY_PROFILE_COLUMN[canonicalKey];
      if (legacyColumn) {
        legacyProfilePatch[legacyColumn] = value;
        if (
          valueZh &&
          UNIVERSAL_PROFILE_SAVE_FIELD_SET.has(`${legacyColumn}_zh`)
        ) {
          legacyProfilePatch[`${legacyColumn}_zh`] = valueZh;
        }
        if (
          valueEn &&
          UNIVERSAL_PROFILE_SAVE_FIELD_SET.has(`${legacyColumn}_en`)
        ) {
          legacyProfilePatch[`${legacyColumn}_en`] = valueEn;
        }
      }
      upserts.push({
        applicant_id: application.applicant_id,
        auth_user_id: user.id,
        canonical_key: canonicalKey,
        value_text: value,
        value_zh: valueZh,
        value_en: valueEn,
        label_zh: getChineseLabel(field.label),
        label_en: getEnglishLabel(field.label),
        field_type: field.fieldType,
        category: getUniversalProfileCategory(
          canonicalKey,
          field.stepName ?? ""
        ),
        source_application_id: applicationId,
        source_visa_type: application.visa_type,
        source_field_name: fieldName,
        field_schema: field,
        updated_at: now,
      });
    }

    if (upserts.length === 0) return { savedCount: 0, skippedCount };
    const { error: upsertError } = await adminClient
      .from("universal_profile_answers")
      .upsert(upserts, { onConflict: "auth_user_id,canonical_key" });
    if (upsertError) {
      if (
        isMissingSchemaFeatureError(upsertError, ["universal_profile_answers"])
      ) {
        return { error: "Universal Profile schema is not installed" };
      }
      return { error: upsertError.message };
    }

    if (Object.keys(legacyProfilePatch).length > 0) {
      const { error: profileUpdateError } = await adminClient
        .from("applicant_profiles")
        .update({ ...legacyProfilePatch, updated_at: now })
        .eq("id", application.applicant_id);
      if (profileUpdateError) return { error: profileUpdateError.message };
    }

    return { savedCount: upserts.length, skippedCount };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Failed to update universal profile",
    };
  }
}

/**
 * Create a draft application for the current user if one doesn't exist.
 * Returns the application ID.
 */
export async function ensureDraftApplication(
  country: string,
  visaType: string,
  options: { preferExplicit?: boolean } = {}
): Promise<{ applicationId?: string; created?: boolean; error?: string }> {
  try {
    const session = await getClientSessionWithFallback();
    if (!session) return { error: "Not authenticated" };

    const adminClient = createAdminClient();

    const profileResult = await loadCurrentApplicantProfileForSession(
      adminClient,
      session
    );
    if (profileResult.error) return { error: profileResult.error };
    const profile = profileResult.profile;
    if (!profile?.id) return { error: "Profile not found" };

    const { data: activePackage } = await adminClient
      .from("user_packages")
      .select("visa_package_id, visa_packages(id, country, visa_type)")
      .eq("auth_user_id", session.authUserId ?? session.userId)
      .eq("status", "active")
      .order("assigned_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const pkg = Array.isArray(activePackage?.visa_packages)
      ? activePackage?.visa_packages[0]
      : activePackage?.visa_packages;

    const resolvedCountry = getCanonicalVisaDestinationCountry(
      options.preferExplicit ? country : (pkg?.country ?? country)
    );
    const resolvedVisaType = getFormVisaType(
      options.preferExplicit ? visaType : (pkg?.visa_type ?? visaType)
    );
    const resolvedVisaPackageId = options.preferExplicit
      ? null
      : (activePackage?.visa_package_id ?? pkg?.id ?? null);

    // Application identity is applicant + canonical country + visa type. A
    // package assignment enriches that application; it must not create a
    // second draft when an older row has no visa_package_id.
    const { data: applicationRows, error: existingError } = await adminClient
      .from("applications")
      .select(
        "id, country, visa_type, purpose, status, visa_package_id, submission_result_status, result_status, submission_result"
      )
      .eq("applicant_id", profile.id)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (existingError) return { error: existingError.message };
    const existing = findOngoingApplicationByIdentity(
      applicationRows ?? [],
      resolvedCountry,
      resolvedVisaType
    );

    if (existing) {
      if (resolvedVisaPackageId && !existing.visa_package_id) {
        await adminClient
          .from("applications")
          .update({
            visa_package_id: resolvedVisaPackageId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      }
      return { applicationId: existing.id, created: false };
    }

    const { data: newApp, error: appError } = await adminClient
      .from("applications")
      .insert({
        applicant_id: profile.id,
        status: "draft",
        country: resolvedCountry,
        visa_type: resolvedVisaType,
        visa_package_id: resolvedVisaPackageId,
      })
      .select("id")
      .single();

    if (appError?.code === "23505") {
      const { data: concurrentRows, error: concurrentError } = await adminClient
        .from("applications")
        .select(
          "id, country, visa_type, purpose, status, visa_package_id, submission_result_status, result_status, submission_result"
        )
        .eq("applicant_id", profile.id)
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (concurrentError) return { error: concurrentError.message };
      const concurrent = findOngoingApplicationByIdentity(
        concurrentRows ?? [],
        resolvedCountry,
        resolvedVisaType
      );
      if (concurrent) return { applicationId: concurrent.id, created: false };
    }
    if (appError || !newApp)
      return { error: appError?.message ?? "Failed to create application" };

    const reusableResult = await loadReusableProfileAnswers(
      adminClient,
      session.authUserId ?? profile.auth_user_id ?? session.userId
    );
    if (reusableResult.error) return { error: reusableResult.error };
    const seedProfile: SeedableUniversalProfile = {
      ...profile,
      reusable_answers: reusableResult.answers,
    };
    const seedError = await seedNewApplicationFromUniversalProfile(
      adminClient,
      newApp.id,
      profile.id,
      seedProfile
    );
    if (seedError) return { error: seedError };

    return { applicationId: newApp.id, created: true };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to create application",
    };
  }
}

export async function completeKoreaEArrivalCardPreflight(input: {
  applicationId?: string | null;
  dateOfBirth: string;
  adultRepresentativeConfirmed: boolean;
}): Promise<{
  ok: boolean;
  applicationId?: string;
  completedAt?: number;
  answers?: Record<string, string>;
  error?: string;
}> {
  try {
    if (!canContinueKoreaArrivalPreflight({
      eligibility: "needs_declaration",
      dateOfBirth: input.dateOfBirth,
      adultRepresentativeConfirmed: input.adultRepresentativeConfirmed,
    })) {
      return { ok: false, error: "Complete the Korea e-Arrival Card eligibility check before continuing." };
    }

    const requestedApplicationId = input.applicationId?.trim() || null;
    let applicationId = requestedApplicationId;

    if (requestedApplicationId) {
      const session = await getClientSessionWithFallback();
      if (!session) return { ok: false, error: "Not authenticated" };

      const adminClient = createAdminClient();
      const { data: application, error: applicationError } = await adminClient
        .from("applications")
        .select(
          "id, applicant_id, country, visa_type, purpose, status, submission_result_status, result_status, submission_result"
        )
        .eq("id", requestedApplicationId)
        .maybeSingle();
      if (applicationError || !application) {
        return { ok: false, error: applicationError?.message ?? "Application not found" };
      }

      const owner = await loadApplicationOwnerProfile(adminClient, application.applicant_id);
      if (owner.error || !ownsApplicationSession(owner.profile, session)) {
        return { ok: false, error: owner.error ?? "Unauthorized" };
      }
      if (
        !applicationIdentityMatches(application, "south_korea", "KR_E_ARRIVAL_CARD") ||
        !isOngoingApplicationRecord(application)
      ) {
        return { ok: false, error: "The selected application is not an active Korea e-Arrival Card draft." };
      }
    } else {
      const draft = await ensureDraftApplication("south_korea", "KR_E_ARRIVAL_CARD", {
        preferExplicit: true,
      });
      if (draft.error || !draft.applicationId) {
        return { ok: false, error: draft.error ?? "Failed to create application" };
      }
      applicationId = draft.applicationId;
    }

    if (!applicationId) {
      return { ok: false, error: "Failed to resolve application" };
    }

    const completedAt = Date.now();
    const answers = buildKoreaEArrivalPreflightAnswerPatch({
      adultRepresentativeConfirmed: input.adultRepresentativeConfirmed,
      completedAt,
      dateOfBirth: input.dateOfBirth,
    });
    const saveResult = await saveDynamicAnswers(applicationId, answers);
    if (saveResult.error) return { ok: false, error: saveResult.error };

    return { ok: true, applicationId, completedAt, answers };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to complete Korea e-Arrival Card eligibility check",
    };
  }
}

export async function loadApplicationFormContext(
  country: string,
  visaType: string,
  options: { preferExplicit?: boolean } = {}
): Promise<{
  profile?: SeedableUniversalProfile;
  application?: Record<string, unknown> | null;
  error?: string;
}> {
  try {
    const session = await getClientSessionWithFallback();
    if (!session) return { error: "Not authenticated" };

    const adminClient = createAdminClient();
    const profileResult = await loadCurrentApplicantProfileForSession(
      adminClient,
      session
    );
    if (profileResult.error) return { error: profileResult.error };
    const profile = profileResult.profile;
    if (!profile?.id) return { error: "Profile not found" };

    const { data: applicationRows, error } = await adminClient
      .from("applications")
      .select("*")
      .eq("applicant_id", profile.id)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) return { error: error.message };

    const resolvedVisaType = getFormVisaType(visaType);
    const applications = (applicationRows ?? []).filter(
      (row) => !isQaDryRunPurpose(row.purpose)
    ) as Record<string, unknown>[];
    const matchingApplications = applications.filter((row) =>
      applicationIdentityMatches(row, country, resolvedVisaType)
    );
    const application =
      findOngoingApplicationByIdentity(
        matchingApplications,
        country,
        resolvedVisaType
      ) ??
      matchingApplications[0] ??
      (options.preferExplicit ? null : (applications[0] ?? null));

    const reusableResult = await loadReusableProfileAnswers(
      adminClient,
      session.authUserId ?? profile.auth_user_id ?? session.userId
    );
    if (reusableResult.error) return { error: reusableResult.error };

    const customerApplication = application
      ? {
          ...application,
          submission_result: sanitizeCustomerSubmissionResult(
            application.submission_result
          ),
        }
      : null;

    return {
      profile: {
        ...profile,
        reusable_answers: reusableResult.answers,
      },
      application: customerApplication,
    };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Failed to load application context",
    };
  }
}

/**
 * Stash the simplified-form's raw wizard state (the full SimplifiedFormData
 * blob plus the active step index) so the user can leave mid-flow and resume.
 * Stored as a JSON string in `value_text` under the reserved field_name
 * `__simplified_form_state` — the double-underscore prefix keeps it from
 * colliding with canonical DS-160 field names.
 */
const SIMPLIFIED_FORM_STATE_KEY = "__simplified_form_state";

export async function saveSimplifiedFormState(
  applicationId: string,
  state: { form: unknown; stepIndex: number }
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const adminClient = createAdminClient();
    const { data: app } = await adminClient
      .from("applications")
      .select("id, applicant_id")
      .eq("id", applicationId)
      .single();
    if (!app) return { error: "Application not found" };

    const { data: profile } = await adminClient
      .from("applicant_profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();
    if (!profile || profile.id !== app.applicant_id) {
      return { error: "Unauthorized" };
    }

    const value = JSON.stringify({
      form: state.form,
      stepIndex: state.stepIndex,
      savedAt: new Date().toISOString(),
    });

    const { error: upsertError } = await adminClient
      .from("visa_application_answers")
      .upsert(
        [
          {
            application_id: applicationId,
            field_name: SIMPLIFIED_FORM_STATE_KEY,
            value_text: value,
            updated_at: new Date().toISOString(),
          },
        ],
        { onConflict: "application_id,field_name" }
      );
    if (upsertError) return { error: upsertError.message };

    return {};
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to save state",
    };
  }
}

export async function loadSimplifiedFormState(
  applicationId: string
): Promise<{
  state?: { form: unknown; stepIndex: number; savedAt?: string };
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const adminClient = createAdminClient();
    const { data: row, error } = await adminClient
      .from("visa_application_answers")
      .select("value_text")
      .eq("application_id", applicationId)
      .eq("field_name", SIMPLIFIED_FORM_STATE_KEY)
      .maybeSingle();

    if (error) return { error: error.message };
    if (!row?.value_text) return {};

    try {
      const parsed = JSON.parse(row.value_text);
      if (parsed && typeof parsed === "object" && "form" in parsed) {
        return {
          state: {
            form: parsed.form,
            stepIndex:
              typeof parsed.stepIndex === "number" ? parsed.stepIndex : 0,
            savedAt:
              typeof parsed.savedAt === "string" ? parsed.savedAt : undefined,
          },
        };
      }
      return {};
    } catch {
      return {};
    }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to load state",
    };
  }
}

/**
 * Load all saved answers for an application.
 */
export async function loadDynamicAnswers(
  applicationId: string
): Promise<{ answers: Record<string, string>; error?: string }> {
  try {
    const session = await getClientSessionWithFallback();
    if (!session) return { answers: {}, error: "Not authenticated" };

    const adminClient = createAdminClient({
      requestTimeoutMs: 4_000,
      retryDelaysMs: [],
    });

    const { data: app, error: appError } = await adminClient
      .from("applications")
      .select("applicant_id")
      .eq("id", applicationId)
      .maybeSingle();

    if (appError && isResilienceEligibleError(appError.message)) {
      const cached = await loadCachedApplicationAnswers(
        session.userId,
        applicationId
      );
      if (cached) return { answers: cached.answers };
    }
    if (appError) return { answers: {}, error: appError.message };
    if (!app?.applicant_id)
      return { answers: {}, error: "Application not found" };

    const { profile, error: profileError } = await loadApplicationOwnerProfile(
      adminClient,
      app.applicant_id
    );

    if (profileError) {
      if (isResilienceEligibleError(profileError)) {
        const cached = await loadCachedApplicationAnswers(
          session.userId,
          applicationId
        );
        if (cached) return { answers: cached.answers };
      }
      return { answers: {}, error: profileError };
    }
    if (!ownsApplicationSession(profile, session)) {
      return { answers: {}, error: "Unauthorized" };
    }

    const { data: rows, error } = await adminClient
      .from("visa_application_answers")
      .select("field_name, value_text")
      .eq("application_id", applicationId);

    if (error) {
      if (isResilienceEligibleError(error.message)) {
        const cached = await loadCachedApplicationAnswers(
          session.userId,
          applicationId
        );
        if (cached) return { answers: cached.answers };
      }
      return { answers: {}, error: error.message };
    }

    const answers: Record<string, string> = {};
    for (const row of rows ?? []) {
      if (!row.value_text) continue;
      // Skip reserved meta keys (e.g. simplified-form wizard state blob).
      if (row.field_name.startsWith("__")) continue;
      answers[row.field_name] = row.value_text;
    }

    await cacheApplicationAnswers({
      version: 1,
      applicantId: session.userId,
      applicationId,
      answers,
      savedAt: new Date().toISOString(),
    }).catch(() => undefined);

    if (app?.applicant_id) {
      await auditPiiRead(
        "actions/visa-application-answers:loadDynamicAnswers",
        app.applicant_id,
        ["form_answers"],
        { applicationId, purpose: "self_view" }
      );
    }

    return { answers };
  } catch (err) {
    if (isResilienceEligibleError(err)) {
      const session = await getClientSessionWithFallback();
      if (session) {
        try {
          const cached = await loadCachedApplicationAnswers(
            session.userId,
            applicationId
          );
          if (cached) return { answers: cached.answers };
        } catch {
          // Return the original provider error below.
        }
      }
    }
    return {
      answers: {},
      error: err instanceof Error ? err.message : "Failed to load",
    };
  }
}

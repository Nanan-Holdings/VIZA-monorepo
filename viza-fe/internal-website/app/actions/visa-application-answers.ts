"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { auditPiiRead } from "@/lib/legal/audit-pii";
import { buildUniversalProfileAnswerPatch, type UniversalProfileSnapshot } from "@/lib/universal-profile-prefill";
import { getCanonicalVisaDestinationCountry, getFormVisaType } from "@/lib/visa-destinations";

type ApplicationOwnerProfile = {
  id?: string | null;
  auth_user_id?: string | null;
  dependant_of_user_id?: string | null;
};

interface UniversalProfileSaveInput extends UniversalProfileSnapshot {
  wechat?: string | null;
}
type UniversalProfileSaveField = keyof UniversalProfileSaveInput;
type SeedableUniversalProfile = UniversalProfileSnapshot & {
  id?: string | null;
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
  | { ok: true; value: string }
  | { ok: false; error: string };

type NormalizedAnswersResult =
  | { ok: true; data: Record<string, string> }
  | { ok: false; error: string };

function normalizeDynamicAnswerValue(fieldName: string, value: unknown): NormalizedAnswerValueResult {
  if (value === null || value === undefined) return { ok: true, value: "" };
  if (typeof value === "string") return { ok: true, value };
  if (typeof value === "number" || typeof value === "boolean") return { ok: true, value: String(value) };

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

function normalizeDynamicAnswers(data: Record<string, unknown>): NormalizedAnswersResult {
  const normalized: Record<string, string> = {};

  for (const [rawFieldName, rawValue] of Object.entries(data)) {
    const fieldName = rawFieldName.trim();
    if (!fieldName) return { ok: false, error: "Invalid answer field name: field name cannot be empty." };

    const result = normalizeDynamicAnswerValue(fieldName, rawValue);
    if (!result.ok) return { ok: false, error: result.error };
    normalized[fieldName] = result.value;
  }

  return { ok: true, data: normalized };
}

function isRetryableMissingProfileColumnError(message: string) {
  const normalized = message.toLowerCase();
  return PROFILE_SAVE_FALLBACK_COLUMNS.some((column) => normalized.includes(column)) &&
    (normalized.includes("schema cache") || normalized.includes("column") || normalized.includes("relation"));
}

function getMissingProfileSaveColumn(message: string, payload: Record<string, unknown>) {
  if (!isRetryableMissingProfileColumnError(message)) return null;
  const normalized = message.toLowerCase();
  return PROFILE_SAVE_FALLBACK_COLUMNS.find(
    (column) => column in payload && normalized.includes(column),
  ) ?? null;
}

function isMissingColumnError(message: string, column: string) {
  const normalized = message.toLowerCase();
  return normalized.includes(column.toLowerCase()) &&
    (normalized.includes("schema cache") || normalized.includes("column") || normalized.includes("does not exist"));
}

function isMissingSchemaFeatureError(error: SupabaseErrorLike, featureNames: string[]) {
  if (!error) return false;
  const normalized = error.message?.toLowerCase() ?? "";
  return (
    error.code === "PGRST204" ||
    normalized.includes("schema cache") ||
    normalized.includes("does not exist") ||
    normalized.includes("relation")
  ) && featureNames.some((name) => normalized.includes(name.toLowerCase()));
}

async function loadApplicationOwnerProfile(
  adminClient: ReturnType<typeof createAdminClient>,
  applicantId: string,
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

function ownsApplication(
  profile: ApplicationOwnerProfile | null,
  userId: string,
): profile is ApplicationOwnerProfile & { id: string } {
  return Boolean(profile?.id && (profile.auth_user_id === userId || profile.dependant_of_user_id === userId));
}

async function upsertApplicantProfileWithOptionalColumnFallback(
  adminClient: ReturnType<typeof createAdminClient>,
  payload: Record<string, string | null>,
) {
  let nextPayload = { ...payload };
  const missingColumns: string[] = [];

  for (let attempt = 0; attempt <= PROFILE_SAVE_FALLBACK_COLUMNS.length; attempt += 1) {
    const result = await adminClient
      .from("applicant_profiles")
      .upsert(nextPayload, { onConflict: "auth_user_id" })
      .select("*")
      .single();

    if (!result.error) return { ...result, missingColumns };

    const missingColumn = getMissingProfileSaveColumn(result.error.message, nextPayload);
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
  profile: SeedableUniversalProfile,
) {
  const answerPatch = buildUniversalProfileAnswerPatch(profile);
  const answerEntries = Object.entries(answerPatch).filter(([, value]) => value.trim() !== "");
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
    if (!isMissingSchemaFeatureError(answerError, ["source", "source_profile_updated_at", "source_metadata"])) {
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
      { onConflict: "application_id" },
    );

  if (snapshotError && !isMissingSchemaFeatureError(snapshotError, ["application_profile_snapshots"])) {
    return snapshotError.message;
  }

  return null;
}

/**
 * Save dynamic form answers for a visa application.
 * Uses admin client to bypass RLS on visa_application_answers.
 */
export async function saveDynamicAnswers(
  applicationId: string,
  data: Record<string, unknown>
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    // Verify the user owns this application
    const adminClient = createAdminClient();
    const { data: app } = await adminClient
      .from("applications")
      .select("id, applicant_id")
      .eq("id", applicationId)
      .single();

    if (!app) return { error: "Application not found" };

    const { profile, error: profileError } = await loadApplicationOwnerProfile(adminClient, app.applicant_id);

    if (profileError) return { error: profileError };
    if (!ownsApplication(profile, user.id)) {
      return { error: "Unauthorized" };
    }

    const normalized = normalizeDynamicAnswers(data);
    if (!normalized.ok) return { error: normalized.error };
    const answers = normalized.data;

    const now = new Date().toISOString();
    const emptyFieldNames = Object.entries(answers)
      .filter(([fieldName, value]) => fieldName.trim() !== "" && value.trim() === "")
      .map(([fieldName]) => fieldName);

    if (emptyFieldNames.length > 0) {
      const { error: deleteError } = await adminClient
        .from("visa_application_answers")
        .delete()
        .eq("application_id", applicationId)
        .in("field_name", emptyFieldNames);
      if (deleteError) return { error: deleteError.message };
    }

    const upserts = Object.entries(answers)
      .filter(([, v]) => v.trim() !== "")
      .map(([fieldName, value]) => ({
        application_id: applicationId,
        field_name: fieldName,
        value_text: value,
        updated_at: now,
      }));

    if (upserts.length > 0) {
      const { error: upsertError } = await adminClient
        .from("visa_application_answers")
        .upsert(upserts, { onConflict: "application_id,field_name" });
      if (upsertError) return { error: upsertError.message };
    }

    // Dynamic visa form saves are application-scoped. Universal Profile is a
    // reusable source for initial autofill and must only change through explicit
    // profile/OCR confirmation flows, not from arbitrary form answers.
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save" };
  }
}

/**
 * Save the reusable bilingual profile. Existing visa application answers stay
 * application-scoped; forms read this profile only for initial autofill.
 */
export async function saveUniversalProfileWithSharedAnswers(
  input: {
    profile: UniversalProfileSaveInput;
    applicationId?: string | null;
    country?: string;
    visaType?: string;
    preferExplicit?: boolean;
    clearedFields?: UniversalProfileSaveField[];
  },
): Promise<{
  applicationId?: string;
  answerCount?: number;
  profile?: UniversalProfileSnapshot;
  missingColumns?: string[];
  schemaWarning?: string;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const adminClient = createAdminClient();
    const { data: existingProfile, error: existingProfileError } = await adminClient
      .from("applicant_profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (existingProfileError) return { error: existingProfileError.message };

    const clearedFields = new Set(input.clearedFields ?? []);
    const profilePatch: Record<string, string | null> = {
      auth_user_id: user.id,
      updated_at: new Date().toISOString(),
    };

    for (const field of UNIVERSAL_PROFILE_SAVE_FIELDS) {
      const rawValue = input.profile[field];
      const value = cleanOptional(rawValue);
      if (value !== null) {
        profilePatch[field] = value;
      } else if (clearedFields.has(field)) {
        profilePatch[field] = null;
      }
    }

    if (!existingProfile && !("email" in profilePatch)) {
      profilePatch.email = user.email ?? null;
    }

    const profileResult = await upsertApplicantProfileWithOptionalColumnFallback(
      adminClient,
      profilePatch,
    );
    const savedProfile = profileResult.data;
    const profileError = profileResult.error;

    if (profileError || !savedProfile) {
      return { error: profileError?.message ?? "Failed to save profile" };
    }

    const missingColumns = "missingColumns" in profileResult ? profileResult.missingColumns : [];

    return {
      applicationId: input.applicationId ?? undefined,
      answerCount: 0,
      profile: savedProfile as UniversalProfileSnapshot,
      missingColumns,
      schemaWarning: missingColumns.length > 0
        ? `Universal Profile saved with legacy fallback. Missing applicant_profiles columns: ${missingColumns.join(", ")}. Run migration 0090_applicant_profile_bilingual_fields.sql.`
        : undefined,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save profile" };
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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const adminClient = createAdminClient();

    const { data: profileData } = await adminClient
      .from("applicant_profiles")
      .select("*")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    const profile = profileData as SeedableUniversalProfile | null;
    if (!profile?.id) return { error: "Profile not found" };

    const { data: activePackage } = await adminClient
      .from("user_packages")
      .select("visa_package_id, visa_packages(id, country, visa_type)")
      .eq("auth_user_id", user.id)
      .eq("status", "active")
      .order("assigned_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const pkg = Array.isArray(activePackage?.visa_packages)
      ? activePackage?.visa_packages[0]
      : activePackage?.visa_packages;

    const resolvedCountry = getCanonicalVisaDestinationCountry(options.preferExplicit ? country : pkg?.country ?? country);
    const resolvedVisaType = getFormVisaType(options.preferExplicit ? visaType : pkg?.visa_type ?? visaType);
    const resolvedVisaPackageId = options.preferExplicit
      ? null
      : activePackage?.visa_package_id ?? pkg?.id ?? null;

    // Check for existing application for the same package/type first
    let existingQuery = adminClient
      .from("applications")
      .select("id")
      .eq("applicant_id", profile.id)
      .eq("country", resolvedCountry)
      .eq("visa_type", resolvedVisaType)
      .order("created_at", { ascending: false })
      .limit(1);

    if (resolvedVisaPackageId) {
      existingQuery = existingQuery.eq("visa_package_id", resolvedVisaPackageId);
    }

    const { data: existing } = await existingQuery.maybeSingle();

    if (existing) return { applicationId: existing.id, created: false };

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

    if (appError) return { error: appError.message };

    const seedError = await seedNewApplicationFromUniversalProfile(adminClient, newApp.id, profile.id, profile);
    if (seedError) return { error: seedError };

    return { applicationId: newApp.id, created: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create application" };
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
  state: { form: unknown; stepIndex: number },
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
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
        { onConflict: "application_id,field_name" },
      );
    if (upsertError) return { error: upsertError.message };

    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save state" };
  }
}

export async function loadSimplifiedFormState(
  applicationId: string,
): Promise<{ state?: { form: unknown; stepIndex: number; savedAt?: string }; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
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
            stepIndex: typeof parsed.stepIndex === "number" ? parsed.stepIndex : 0,
            savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : undefined,
          },
        };
      }
      return {};
    } catch {
      return {};
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to load state" };
  }
}

/**
 * Load all saved answers for an application.
 */
export async function loadDynamicAnswers(
  applicationId: string
): Promise<{ answers: Record<string, string>; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { answers: {}, error: "Not authenticated" };

    const adminClient = createAdminClient();

    const { data: app } = await adminClient
      .from("applications")
      .select("applicant_id")
      .eq("id", applicationId)
      .maybeSingle();

    if (!app?.applicant_id) return { answers: {}, error: "Application not found" };

    const { profile, error: profileError } = await loadApplicationOwnerProfile(adminClient, app.applicant_id);

    if (profileError) return { answers: {}, error: profileError };
    if (!ownsApplication(profile, user.id)) {
      return { answers: {}, error: "Unauthorized" };
    }

    const { data: rows, error } = await adminClient
      .from("visa_application_answers")
      .select("field_name, value_text")
      .eq("application_id", applicationId);

    if (error) return { answers: {}, error: error.message };

    const answers: Record<string, string> = {};
    for (const row of rows ?? []) {
      if (!row.value_text) continue;
      // Skip reserved meta keys (e.g. simplified-form wizard state blob).
      if (row.field_name.startsWith("__")) continue;
      answers[row.field_name] = row.value_text;
    }

    if (app?.applicant_id) {
      await auditPiiRead(
        "actions/visa-application-answers:loadDynamicAnswers",
        app.applicant_id,
        ["form_answers"],
        { applicationId, purpose: "self_view" },
      );
    }

    return { answers };
  } catch (err) {
    return { answers: {}, error: err instanceof Error ? err.message : "Failed to load" };
  }
}

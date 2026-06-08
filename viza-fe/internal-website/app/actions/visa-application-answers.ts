"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { auditPiiRead } from "@/lib/legal/audit-pii";
import type { UniversalProfileSnapshot } from "@/lib/universal-profile-prefill";
import { getCanonicalVisaDestinationCountry, getFormVisaType } from "@/lib/visa-destinations";

type ApplicationOwnerProfile = {
  id?: string | null;
  auth_user_id?: string | null;
  dependant_of_user_id?: string | null;
};

interface UniversalProfileSaveInput extends UniversalProfileSnapshot {
  wechat?: string | null;
}

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

  for (let attempt = 0; attempt <= PROFILE_SAVE_FALLBACK_COLUMNS.length; attempt += 1) {
    const result = await adminClient
      .from("applicant_profiles")
      .upsert(nextPayload, { onConflict: "auth_user_id" })
      .select("id, auth_user_id")
      .single();

    if (!result.error) return result;

    const missingColumn = getMissingProfileSaveColumn(result.error.message, nextPayload);
    if (!missingColumn) return result;

    const { [missingColumn]: _missingValue, ...fallbackPayload } = nextPayload;
    nextPayload = fallbackPayload;
  }

  return adminClient
    .from("applicant_profiles")
    .upsert(nextPayload, { onConflict: "auth_user_id" })
    .select("id, auth_user_id")
    .single();
}

/**
 * Save dynamic form answers for a visa application.
 * Uses admin client to bypass RLS on visa_application_answers.
 */
export async function saveDynamicAnswers(
  applicationId: string,
  data: Record<string, string>
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

    const now = new Date().toISOString();
    const emptyFieldNames = Object.entries(data)
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

    const upserts = Object.entries(data)
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
  },
): Promise<{ applicationId?: string; answerCount?: number; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const adminClient = createAdminClient();
    const baseProfilePayload = {
      auth_user_id: user.id,
      full_name: cleanOptional(input.profile.full_name),
      surname: cleanOptional(input.profile.surname),
      given_names: cleanOptional(input.profile.given_names),
      date_of_birth: cleanOptional(input.profile.date_of_birth),
      place_of_birth: cleanOptional(input.profile.place_of_birth),
      birth_country: cleanOptional(input.profile.birth_country),
      birth_province_or_state: cleanOptional(input.profile.birth_province_or_state),
      birth_city: cleanOptional(input.profile.birth_city),
      gender: cleanOptional(input.profile.gender),
      nationality: cleanOptional(input.profile.nationality),
      occupation: cleanOptional(input.profile.occupation),
      address: cleanOptional(input.profile.address),
      passport_number: cleanOptional(input.profile.passport_number),
      passport_issue_date: cleanOptional(input.profile.passport_issue_date),
      passport_expiry_date: cleanOptional(input.profile.passport_expiry_date),
      passport_issuing_country: cleanOptional(input.profile.passport_issuing_country),
      passport_issuing_authority: cleanOptional(input.profile.passport_issuing_authority),
      email: cleanOptional(input.profile.email) ?? user.email ?? null,
      phone: cleanOptional(input.profile.phone),
      wechat: cleanOptional(input.profile.wechat),
      updated_at: new Date().toISOString(),
    };
    const bilingualProfilePayload = {
      full_name_zh: cleanOptional(input.profile.full_name_zh),
      full_name_en: cleanOptional(input.profile.full_name_en),
      surname_zh: cleanOptional(input.profile.surname_zh),
      surname_en: cleanOptional(input.profile.surname_en),
      given_names_zh: cleanOptional(input.profile.given_names_zh),
      given_names_en: cleanOptional(input.profile.given_names_en),
      place_of_birth_zh: cleanOptional(input.profile.place_of_birth_zh),
      place_of_birth_en: cleanOptional(input.profile.place_of_birth_en),
      birth_province_or_state_zh: cleanOptional(input.profile.birth_province_or_state_zh),
      birth_province_or_state_en: cleanOptional(input.profile.birth_province_or_state_en),
      birth_city_zh: cleanOptional(input.profile.birth_city_zh),
      birth_city_en: cleanOptional(input.profile.birth_city_en),
      occupation_zh: cleanOptional(input.profile.occupation_zh),
      occupation_en: cleanOptional(input.profile.occupation_en),
      address_zh: cleanOptional(input.profile.address_zh),
      address_en: cleanOptional(input.profile.address_en),
    };
    const hasBilingualPayload = Object.values(bilingualProfilePayload).some(Boolean);

    const profileResult = await upsertApplicantProfileWithOptionalColumnFallback(
      adminClient,
      hasBilingualPayload ? { ...baseProfilePayload, ...bilingualProfilePayload } : baseProfilePayload,
    );
    const savedProfile = profileResult.data;
    const profileError = profileResult.error;

    if (profileError || !savedProfile) {
      return { error: profileError?.message ?? "Failed to save profile" };
    }

    let applicationId = input.applicationId ?? null;

    if (applicationId) {
      const { data: app, error: appError } = await adminClient
        .from("applications")
        .select("id, applicant_id")
        .eq("id", applicationId)
        .maybeSingle();

      if (appError) return { error: appError.message };
      if (!app || app.applicant_id !== savedProfile.id) {
        return { error: "Application not found" };
      }
    } else {
      const ensured = await ensureDraftApplication(
        input.country ?? "us",
        input.visaType ?? "b1_b2",
        { preferExplicit: input.preferExplicit ?? false },
      );
      if (ensured.error || !ensured.applicationId) {
        return { error: ensured.error ?? "Failed to create draft application" };
      }
      applicationId = ensured.applicationId;
    }

    return { applicationId, answerCount: 0 };
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
): Promise<{ applicationId?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const adminClient = createAdminClient();

    const { data: profile } = await adminClient
      .from("applicant_profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!profile) return { error: "Profile not found" };

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

    if (existing) return { applicationId: existing.id };

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
    return { applicationId: newApp.id };
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

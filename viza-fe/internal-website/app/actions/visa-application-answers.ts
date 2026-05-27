"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { auditPiiRead } from "@/lib/legal/audit-pii";

type ProfilePatch = Record<string, string>;
const DATE_PROFILE_FIELDS = new Set(["date_of_birth", "passport_issue_date", "passport_expiry_date"]);

function firstFilled(data: Record<string, string>, fieldNames: string[]): string | null {
  for (const fieldName of fieldNames) {
    const value = data[fieldName]?.trim();
    if (value) return value;
  }
  return null;
}

function buildProfilePatchFromAnswers(data: Record<string, string>): ProfilePatch {
  const patch: ProfilePatch = {};
  const givenNames = firstFilled(data, ["given_names", "givenNames", "first_name", "given_name"]);
  const surname = firstFilled(data, ["surname", "last_name", "family_name"]);
  const explicitFullName = firstFilled(data, ["full_name", "fullName", "full_name_native_alphabet"]);

  if (explicitFullName) {
    patch.full_name = explicitFullName;
  } else if (givenNames || surname) {
    patch.full_name = [givenNames, surname].filter(Boolean).join(" ");
  }

  const fieldMappings: Record<string, string[]> = {
    date_of_birth: ["date_of_birth", "dob", "birth_date"],
    place_of_birth: ["place_of_birth", "city_of_birth", "birth_city"],
    gender: ["gender", "sex"],
    nationality: ["nationality", "nationality_country", "country_of_nationality", "current_nationality"],
    occupation: ["occupation", "current_occupation", "primary_occupation"],
    address: ["address", "home_address_line1", "home_address", "residential_address"],
    passport_number: ["passport_number", "passportNumber"],
    passport_issue_date: ["passport_issue_date", "passport_issuance_date", "passportIssuanceDate"],
    passport_expiry_date: ["passport_expiry_date", "passport_expiration_date", "passportExpirationDate"],
    passport_issuing_country: ["passport_issuing_country", "passport_issuance_country", "issuing_country"],
    passport_issuing_authority: ["passport_issuing_authority", "passport_place_of_issue", "passportIssuanceCity"],
    email: ["email", "email_address"],
    phone: ["phone", "phone_number", "primary_phone_number", "mobile_phone"],
  };

  for (const [profileField, answerFields] of Object.entries(fieldMappings)) {
    const value = firstFilled(data, answerFields);
    if (!value) continue;
    if (DATE_PROFILE_FIELDS.has(profileField) && !/^\d{4}-\d{2}-\d{2}$/.test(value)) continue;
    patch[profileField] = value;
  }

  return patch;
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

    const { data: profile } = await adminClient
      .from("applicant_profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (!profile || profile.id !== app.applicant_id) {
      return { error: "Unauthorized" };
    }

    const upserts = Object.entries(data)
      .filter(([, v]) => v.trim() !== "")
      .map(([fieldName, value]) => ({
        application_id: applicationId,
        field_name: fieldName,
        value_text: value,
        updated_at: new Date().toISOString(),
      }));

    if (upserts.length > 0) {
      const { error: upsertError } = await adminClient
        .from("visa_application_answers")
        .upsert(upserts, { onConflict: "application_id,field_name" });
      if (upsertError) return { error: upsertError.message };
    }

    const profilePatch = buildProfilePatchFromAnswers(data);
    if (Object.keys(profilePatch).length > 0) {
      const { error: profileUpdateError } = await adminClient
        .from("applicant_profiles")
        .update({
          ...profilePatch,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (profileUpdateError) {
        console.warn("[saveDynamicAnswers] Failed to sync applicant profile:", profileUpdateError.message);
      }
    }

    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save" };
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

    const resolvedCountry = options.preferExplicit ? country : pkg?.country ?? country;
    const resolvedVisaType = options.preferExplicit ? visaType : pkg?.visa_type ?? visaType;
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

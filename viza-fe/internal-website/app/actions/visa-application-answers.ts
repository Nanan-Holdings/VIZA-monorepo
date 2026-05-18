"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

    const { data: rows, error } = await adminClient
      .from("visa_application_answers")
      .select("field_name, value_text")
      .eq("application_id", applicationId);

    if (error) return { answers: {}, error: error.message };

    const answers: Record<string, string> = {};
    for (const row of rows ?? []) {
      if (row.value_text) answers[row.field_name] = row.value_text;
    }

    return { answers };
  } catch (err) {
    return { answers: {}, error: err instanceof Error ? err.message : "Failed to load" };
  }
}

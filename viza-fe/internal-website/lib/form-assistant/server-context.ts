import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeBilingualFormField,
  normalizeBilingualWizardSteps,
} from "@/lib/bilingual-schema-contract";
import {
  getRagVisitorIntakeSteps,
  shouldUseRagVisitorIntakeFallback,
} from "@/lib/rag-visitor-intake-form";
import { augmentThailandTouristEVisaSteps } from "@/lib/thailand-tourist-evisa-form-overrides";
import { augmentVietnamEVisaOfficialParitySteps } from "@/lib/vietnam-evisa-form-parity";
import { resolveVisaFormSchemaVisaType } from "@/lib/visa-form-schema-aliases";
import { dbRowToFormField, type VisaFormFieldDbRow, type WizardStep } from "@/types/visa-form-fields";

export interface OwnedApplicationContext {
  admin: SupabaseClient;
  user: User;
  application: {
    id: string;
    applicant_id: string;
    country: string;
    visa_type: string;
    submitted_at: string | null;
  };
}

export async function requireOwnedApplication(
  applicationId: string,
): Promise<OwnedApplicationContext | { status: number; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: 401, error: "Not authenticated" };

  const admin = createAdminClient();
  const { data: application } = await admin
    .from("applications")
    .select("id, applicant_id, country, visa_type, submitted_at")
    .eq("id", applicationId)
    .maybeSingle();
  if (!application?.applicant_id) return { status: 404, error: "Application not found" };

  const { data: profile } = await admin
    .from("applicant_profiles")
    .select("id, auth_user_id, dependant_of_user_id")
    .eq("id", application.applicant_id)
    .maybeSingle();
  if (!profile || (profile.auth_user_id !== user.id && profile.dependant_of_user_id !== user.id)) {
    return { status: 403, error: "Unauthorized" };
  }

  return {
    admin,
    user,
    application: application as OwnedApplicationContext["application"],
  };
}

export async function loadAssistantSchema(
  admin: SupabaseClient,
  country: string,
  visaType: string,
): Promise<WizardStep[]> {
  const schemaVisaType = resolveVisaFormSchemaVisaType(visaType, country);
  const { data, error } = await admin
    .from("visa_form_fields")
    .select("*")
    .eq("visa_type", schemaVisaType)
    .order("step_number", { ascending: true })
    .order("display_order", { ascending: true });
  if (error) throw new Error(error.message);

  if (!data || data.length === 0) {
    return shouldUseRagVisitorIntakeFallback(schemaVisaType)
      ? normalizeBilingualWizardSteps(getRagVisitorIntakeSteps(schemaVisaType))
      : [];
  }

  const steps = new Map<number, WizardStep>();
  for (const row of (data ?? []) as VisaFormFieldDbRow[]) {
    if (!steps.has(row.step_number)) {
      steps.set(row.step_number, {
        stepNumber: row.step_number,
        stepName: row.step_name || `Step ${row.step_number}`,
        fields: [],
      });
    }
    steps.get(row.step_number)!.fields.push(
      normalizeBilingualFormField(dbRowToFormField(row)),
    );
  }
  const orderedSteps = Array.from(steps.values()).sort((left, right) => left.stepNumber - right.stepNumber);
  const vietnamPatched = schemaVisaType === "VN_E_VISA"
    ? augmentVietnamEVisaOfficialParitySteps(orderedSteps)
    : orderedSteps;
  const patchedSteps = schemaVisaType === "TH_TOURIST_E_VISA"
    ? augmentThailandTouristEVisaSteps(vietnamPatched)
    : vietnamPatched;
  return schemaVisaType === "VN_E_VISA"
    ? normalizeBilingualWizardSteps(patchedSteps)
    : patchedSteps;
}

export async function loadAssistantAnswers(
  admin: SupabaseClient,
  applicationId: string,
  options: { applicantId?: string; authUserId?: string } = {},
): Promise<Record<string, { value: string; source: string | null }>> {
  let { data, error } = await admin
    .from("visa_application_answers")
    .select("field_name, value_text, source")
    .eq("application_id", applicationId);
  if (error?.message?.includes("source") && error.message.includes("does not exist")) {
    const legacy = await admin
      .from("visa_application_answers")
      .select("field_name, value_text")
      .eq("application_id", applicationId);
    data = (legacy.data ?? []).map((row) => ({ ...row, source: null }));
    error = legacy.error;
  }
  if (error) throw new Error(error.message);
  const answers = Object.fromEntries(
    (data ?? [])
      .filter((row) => !row.field_name.startsWith("__") && typeof row.value_text === "string")
      .map((row) => [row.field_name, { value: row.value_text, source: row.source ?? null }]),
  );
  if (!options.applicantId) return answers;

  const [{ data: profile }, { data: reusableRows }] = await Promise.all([
    admin
      .from("applicant_profiles")
      .select("full_name, passport_number, passport_expiry_date, date_of_birth, gender, email")
      .eq("id", options.applicantId)
      .maybeSingle(),
    options.authUserId
      ? admin
          .from("universal_profile_answers")
          .select("canonical_key, value_text")
          .eq("auth_user_id", options.authUserId)
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: null }),
  ]);
  const profileValues: Record<string, string | null | undefined> = {
    full_name: profile?.full_name,
    passport_number: profile?.passport_number,
    passport_expiry_date: profile?.passport_expiry_date,
    date_of_birth: profile?.date_of_birth,
    sex: profile?.gender?.toLowerCase() === "m" ? "male"
      : profile?.gender?.toLowerCase() === "f" ? "female"
        : profile?.gender?.toLowerCase(),
    email_address: profile?.email,
  };
  for (const [fieldName, value] of Object.entries(profileValues)) {
    if (!answers[fieldName] && value?.trim()) {
      answers[fieldName] = { value: value.trim(), source: "universal_profile" };
    }
  }
  for (const row of reusableRows ?? []) {
    if (!answers[row.canonical_key] && row.value_text?.trim()) {
      answers[row.canonical_key] = { value: row.value_text.trim(), source: "universal_profile" };
    }
  }
  return answers;
}

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadDocumentCenterData } from "@/app/client/documents/actions";
import { getMissingRequiredDocumentRequirementKeys } from "@/lib/application-tab-completion";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientSessionWithFallback } from "@/lib/client-session";
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
import { canonicalizeSchemaOptionValue } from "@/lib/universal-profile-prefill";
import { dbRowToFormField, type VisaFormFieldDbRow, type WizardStep } from "@/types/visa-form-fields";
import { isJapanVisitJapanWebApplication } from "@/lib/submission-queue";
import type { FormAssistantDocumentReadiness } from "@/types/form-assistant";
import { hasSuccessfulFormSubmission } from "@/lib/form-assistant/submission-readonly";
import {
  getCachedStaticVisaMetadata,
  PUBLIC_VISA_FORM_SCHEMA_CACHE_TTL_MS,
} from "@/lib/static-visa-metadata-cache";

export interface OwnedApplicationContext {
  admin: SupabaseClient;
  user: {
    id: string;
    email?: string;
  };
  application: {
    id: string;
    applicant_id: string;
    country: string;
    visa_type: string;
    submitted_at: string | null;
    submission_result_status: string | null;
    submission_result: unknown;
  };
  formAssistantReadOnly: boolean;
}

export async function requireOwnedApplication(
  applicationId: string,
  options: { allowSuccessfulSubmission?: boolean } = {},
): Promise<OwnedApplicationContext | { status: number; error: string }> {
  const session = await getClientSessionWithFallback();
  if (!session) return { status: 401, error: "Not authenticated" };

  const admin = createAdminClient();
  const { data: application } = await admin
    .from("applications")
    .select("id, applicant_id, country, visa_type, submitted_at, submission_result_status, submission_result")
    .eq("id", applicationId)
    .maybeSingle();
  if (!application?.applicant_id) return { status: 404, error: "Application not found" };

  const { data: profile } = await admin
    .from("applicant_profiles")
    .select("id, auth_user_id, dependant_of_user_id")
    .eq("id", application.applicant_id)
    .maybeSingle();
  const ownsProfile = profile && (
    profile.id === session.userId
    || profile.auth_user_id === session.authUserId
    || profile.dependant_of_user_id === session.authUserId
    || profile.dependant_of_user_id === session.userId
  );
  if (!ownsProfile) {
    return { status: 403, error: "Unauthorized" };
  }
  const formAssistantReadOnly = hasSuccessfulFormSubmission({
    country: application.country,
    visaType: application.visa_type,
    submissionResultStatus: application.submission_result_status,
    submissionResult: application.submission_result,
  });
  if (formAssistantReadOnly && !options.allowSuccessfulSubmission) {
    return {
      status: 409,
      error: "The form assistant is read-only after a successful submission. Start another application to continue.",
    };
  }

  return {
    admin,
    user: {
      id: session.authUserId ?? session.userId,
      email: session.email,
    },
    application: application as OwnedApplicationContext["application"],
    formAssistantReadOnly,
  };
}

export async function loadAssistantSchema(
  admin: SupabaseClient,
  country: string,
  visaType: string,
): Promise<WizardStep[]> {
  const schemaVisaType = resolveVisaFormSchemaVisaType(visaType, country);
  const data = await getCachedStaticVisaMetadata<VisaFormFieldDbRow[]>(
    `visa-form-fields:v1:${schemaVisaType}`,
    async () => {
      const { data: rows, error } = await admin
        .from("visa_form_fields")
        .select("*")
        .eq("visa_type", schemaVisaType)
        .order("step_number", { ascending: true })
        .order("display_order", { ascending: true });
      if (error) throw new Error(error.message);
      return (rows ?? []) as VisaFormFieldDbRow[];
    },
    {
      // An empty schema can be a transient read/deployment gap. Let the
      // concurrent burst share that lookup, but retry on the next request.
      shouldCache: (rows) => rows.length > 0,
      ttlMs: PUBLIC_VISA_FORM_SCHEMA_CACHE_TTL_MS,
    },
  );

  if (data.length === 0) {
    return shouldUseRagVisitorIntakeFallback(schemaVisaType)
      ? normalizeBilingualWizardSteps(getRagVisitorIntakeSteps(schemaVisaType))
      : [];
  }

  const steps = new Map<number, WizardStep>();
  for (const cachedRow of data) {
    // Supabase JSON columns are mutable objects. Clone each cached public row
    // before normalization so one request cannot modify another request's
    // options, validation rules, or conditional logic.
    const row = structuredClone(cachedRow);
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

export async function repairAssistantOfficialOptionAnswers(
  admin: SupabaseClient,
  applicationId: string,
  steps: WizardStep[],
  answers: Record<string, { value: string; source: string | null }>,
): Promise<Record<string, { value: string; source: string | null }>> {
  const repaired = { ...answers };
  const fields = steps.flatMap((step) => step.fields);
  for (const field of fields) {
    const current = repaired[field.fieldName];
    if (
      !current?.value.trim()
      || !field.options?.length
      || !["universal_profile", "form_assistant"].includes(current.source ?? "")
    ) continue;
    const canonical = canonicalizeSchemaOptionValue(field, current.value);
    if (!canonical || canonical === current.value) continue;

    const { data, error } = await admin
      .from("visa_application_answers")
      .update({ value_text: canonical, updated_at: new Date().toISOString() })
      .eq("application_id", applicationId)
      .eq("field_name", field.fieldName)
      .eq("value_text", current.value)
      .eq("source", current.source)
      .select("field_name")
      .maybeSingle();
    if (error) {
      console.warn("[form-assistant] Unable to repair legacy official option value", {
        fieldName: field.fieldName,
        code: error.code,
      });
      continue;
    }
    if (data?.field_name) {
      repaired[field.fieldName] = { ...current, value: canonical };
    }
  }
  return repaired;
}

export async function loadAssistantDocumentReadiness(input: {
  applicationId: string;
  country: string;
  visaType: string;
}): Promise<FormAssistantDocumentReadiness | null> {
  // Visit Japan Web collects structured answers directly and has no applicant
  // upload checklist. Do not let Document Center's conservative generic
  // fallback invent passport/photo/itinerary/funds requirements for VJW.
  if (isJapanVisitJapanWebApplication(input.country, input.visaType)) {
    return {
      documentCollectionComplete: true,
      missingDocumentCount: 0,
      missingDocuments: [],
    };
  }

  const result = await loadDocumentCenterData({
    applicationId: input.applicationId,
    country: input.country,
    visaType: input.visaType,
  });
  if (!result.ok) return null;

  const missingKeys = new Set(getMissingRequiredDocumentRequirementKeys(result.data));
  const missingDocuments = result.data.requirements
    .filter((requirement) => requirement.required && missingKeys.has(requirement.key))
    .map((requirement) => ({
      requirementKey: requirement.key,
      labelEn: requirement.labelEn,
      labelZh: requirement.labelZh,
    }));
  return {
    documentCollectionComplete: missingDocuments.length === 0,
    missingDocumentCount: missingDocuments.length,
    missingDocuments,
  };
}

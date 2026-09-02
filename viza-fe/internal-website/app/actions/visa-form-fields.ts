"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getClientSessionWithFallback } from "@/lib/client-session";
import { getImpersonationSession } from "@/lib/impersonation-session";
import {
  type VisaFormFieldDbRow,
  type WizardStep,
  dbRowToFormField,
} from "@/types/visa-form-fields";
import { normalizeBilingualFormField, normalizeBilingualWizardSteps } from "@/lib/bilingual-schema-contract";
import {
  getRagVisitorIntakeSteps,
  shouldUseRagVisitorIntakeFallback,
} from "@/lib/rag-visitor-intake-form";
import { resolveVisaFormSchemaVisaType } from "@/lib/visa-form-schema-aliases";
import { augmentVietnamEVisaOfficialParitySteps } from "@/lib/vietnam-evisa-form-parity";
import { augmentThailandTouristEVisaSteps } from "@/lib/thailand-tourist-evisa-form-overrides";
import { compileApplicationSchemaForUi } from "@/lib/application-schema-ui-contract";
import { getCanonicalApplicationProductCountry } from "@/lib/visa-destinations";
import {
  getCachedStaticVisaMetadata,
  PUBLIC_VISA_FORM_SCHEMA_CACHE_TTL_MS,
} from "@/lib/static-visa-metadata-cache";

const STEP_NAMES: Record<number, string> = {
  1: "Visa Selection",
  2: "Personal Info",
  3: "Passport",
  4: "Travel Details",
  5: "Documents",
  6: "Review",
};

/**
 * Fetch all visa_form_fields for a given visa type from Supabase,
 * grouped into WizardStep objects ordered by step_number and display_order.
 *
 * Returns empty array on error (caller should fall back to hardcoded steps).
 */
export async function getVisaFormSteps(
  visaType = "ID_C1_TOURIST",
  options: { country?: string | null } = {},
): Promise<WizardStep[]> {
  try {
    const impersonation = await getImpersonationSession();
    const session = impersonation ? null : await getClientSessionWithFallback();
    if (!impersonation && !session) return [];

    const schemaCountry = getCanonicalApplicationProductCountry(
      options.country ?? "",
      visaType,
    );
    const schemaVisaType = resolveVisaFormSchemaVisaType(visaType, schemaCountry);
    return getCachedStaticVisaMetadata<WizardStep[]>(
      `visa-form-steps:v1:${schemaVisaType}`,
      async () => {
        const rows = await getCachedStaticVisaMetadata<VisaFormFieldDbRow[]>(
          `visa-form-fields:v1:${schemaVisaType}`,
          async () => {
            const { data, error } = await createAdminClient({
              requestTimeoutMs: 4_000,
              retryDelaysMs: [],
            })
              .from("visa_form_fields")
              .select("*")
              .eq("visa_type", schemaVisaType)
              .order("step_number", { ascending: true })
              .order("display_order", { ascending: true });
            if (error) throw new Error(error.message);
            return (data ?? []) as VisaFormFieldDbRow[];
          },
          {
            shouldCache: (schemaRows) => schemaRows.length > 0,
            ttlMs: PUBLIC_VISA_FORM_SCHEMA_CACHE_TTL_MS,
          },
        );

        if (rows.length === 0) {
          return shouldUseRagVisitorIntakeFallback(schemaVisaType)
            ? normalizeBilingualWizardSteps(getRagVisitorIntakeSteps(schemaVisaType))
            : [];
        }

        const stepMap = new Map<number, WizardStep>();
        for (const row of rows) {
          const step = row.step_number;
          if (!stepMap.has(step)) {
            stepMap.set(step, {
              stepNumber: step,
              stepName: row.step_name || STEP_NAMES[step] || `Step ${step}`,
              fields: [],
            });
          }
          stepMap.get(step)!.fields.push(normalizeBilingualFormField(dbRowToFormField(row)));
        }

        const steps = Array.from(stepMap.values()).sort((a, b) => a.stepNumber - b.stepNumber);
        const vietnamPatched = schemaVisaType === "VN_E_VISA"
          ? augmentVietnamEVisaOfficialParitySteps(steps)
          : steps;
        const patchedSteps = schemaVisaType === "TH_TOURIST_E_VISA"
          ? augmentThailandTouristEVisaSteps(vietnamPatched)
          : vietnamPatched;
        const localizedSteps = schemaVisaType === "VN_E_VISA"
          ? normalizeBilingualWizardSteps(patchedSteps)
          : patchedSteps;
        const compiled = compileApplicationSchemaForUi(localizedSteps);

        if (process.env.NODE_ENV !== "production" && compiled.report.summary.errors > 0) {
          console.warn(
            `[getVisaFormSteps] ${schemaVisaType} has ${compiled.report.summary.errors} schema/UI contract error(s). Run npm run qa:audit-schema-ui for guidance.`,
          );
        }

        return compiled.steps;
      },
      { shouldCache: (steps) => steps.length > 0 },
    );
  } catch (err) {
    console.error("[getVisaFormSteps] Unexpected error:", err);
    return [];
  }
}

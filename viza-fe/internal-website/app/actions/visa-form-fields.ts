"use server";

import { createClient } from "@/lib/supabase/server";
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
export async function getVisaFormSteps(visaType = "B211A"): Promise<WizardStep[]> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("visa_form_fields")
      .select("*")
      .eq("visa_type", visaType)
      .order("step_number", { ascending: true })
      .order("display_order", { ascending: true });

    if (error) {
      console.error("[getVisaFormSteps] Supabase error:", error.message);
      return [];
    }

    if (!data || data.length === 0) {
      return shouldUseRagVisitorIntakeFallback(visaType)
        ? normalizeBilingualWizardSteps(getRagVisitorIntakeSteps(visaType))
        : [];
    }

    // Group by step_number
    const stepMap = new Map<number, WizardStep>();

    for (const row of data as VisaFormFieldDbRow[]) {
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

    return Array.from(stepMap.values()).sort((a, b) => a.stepNumber - b.stepNumber);
  } catch (err) {
    console.error("[getVisaFormSteps] Unexpected error:", err);
    return [];
  }
}

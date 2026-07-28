// @ts-nocheck - needs refactoring after domain migration

"use server";

import { getAuthenticatedUserId } from "@/lib/auth/get-authenticated-user";
import {
  updateClientLifestyle,
  updateClientProfile,
  type UserLifestyleInput,
} from "./user-profile";
import type { AboutMeFormData } from "@/lib/forms/about-me-questions";

/**
 * Transform smoking status from form values to database enum values
 * Form sends "Never smoked", "Former smoker", etc.
 * Database expects: 'non_smoker', 'former_smoker', 'current_smoker', 'occasional'
 */
function transformSmokingStatus(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const mapping: Record<string, string> = {
    "Never smoked": "non_smoker",
    "Former smoker": "former_smoker",
    "Current smoker": "current_smoker",
    "Occasionally": "occasional",
    // Also accept database values directly
    "non_smoker": "non_smoker",
    "former_smoker": "former_smoker",
    "current_smoker": "current_smoker",
    "occasional": "occasional",
  };
  return mapping[value] || value;
}

/**
 * Extract numeric value from exercise hours string
 * Form sends "0–1 hours", "2–3 hours", etc.
 * Extract the first number from the range
 */
function extractExerciseHours(value: string | undefined | number | string[]): number | undefined {
  if (!value || Array.isArray(value)) return undefined;
  const strValue = String(value);
  const match = strValue.match(/\d+/);
  return match ? parseInt(match[0], 10) : undefined;
}

/**
 * Transform alcohol consumption from form values to the normalized values
 * used by /client/about.
 */
function transformAlcoholConsumption(value: string | undefined | number | string[]): string | undefined {
  if (!value || Array.isArray(value)) return undefined;
  const strValue = String(value);
  const mapping: Record<string, string> = {
    // About-me-form values
    "I don't drink": "none",
    "1–2 drinks per week": "occasional",
    "1-2 drinks per week": "occasional",
    "3–5 drinks per week": "moderate",
    "3-5 drinks per week": "moderate",
    "Daily or almost daily": "heavy",
    "daily or almost daily": "heavy",

    // Also accept /client/about values directly
    "none": "none",
    "occasional": "occasional",
    "moderate": "moderate",
    "heavy": "heavy",
  };

  return mapping[strValue] ?? strValue;
}

/**
 * Transform diet type from about-me-form labels to the normalized values
 * used by /client/about.
 */
function transformDietType(
  dietType: string | undefined,
  dietDetails: string | undefined
): string | undefined {
  if (!dietType) return undefined;

  // If user provided details, treat as "other" to stay compatible with /client/about
  if (dietDetails && dietDetails.trim().length > 0) {
    return "other";
  }

  const mapping: Record<string, string> = {
    "Balanced / no restrictions": "balanced",
    "balanced / no restrictions": "balanced",
    "Vegetarian": "vegetarian",
    "vegetarian": "vegetarian",
    "Vegan": "vegan",
    "vegan": "vegan",
    "Keto": "keto",
    "keto": "keto",
    "Paleo": "paleo",
    "paleo": "paleo",
    "Mediterranean": "mediterranean",
    "mediterranean": "mediterranean",
    "Low-carb": "low_carb",
    "low-carb": "low_carb",
    "Low carb": "low_carb",
    "low carb": "low_carb",
    "Other (please specify)": "other",
    "Other": "other",
    "other": "other",
  };

  return mapping[dietType] ?? "other";
}

/**
 * Transform sleep hours from about-me-form labels to the normalized values
 * used by /client/about.
 */
function transformSleepHours(value: string | undefined | number | string[]): string | undefined {
  if (!value || Array.isArray(value)) return undefined;
  const strValue = String(value);
  const mapping: Record<string, string> = {
    "Less than 5 hours": "<5",
    "5–6 hours": "5-6",
    "5-6 hours": "5-6",
    "6–7 hours": "6-7",
    "6-7 hours": "6-7",
    "7–8 hours": "7-8",
    "7-8 hours": "7-8",
    "More than 8 hours": "8+",
    "More than 8": "8+",

    // About page values
    "<5": "<5",
    "5-6": "5-6",
    "6-7": "6-7",
    "7-8": "7-8",
    "8+": "8+",
  };
  return mapping[strValue] ?? strValue;
}

/**
 * Sync about-me form data to normalized database tables
 * 
 * This ensures data entered in the about-me-form is visible in the /client/about page
 * which reads from user_profile_data, user_lifestyle, user_profile, user_hormones tables
 */
export async function syncAboutMeToNormalizedTables(
  formData: AboutMeFormData
): Promise<{ success: boolean; error?: string }> {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return { success: false, error: "Not authenticated or no user linked" };
  }

  try {
    console.log("[Sync] Starting sync with formData:", JSON.stringify(formData, null, 2));

    // Extract and sync Profile data
    const profile_data: ProfileInput[] = [];
    const profileData = formData.profile;

    const resolveProfileUnit = (
      unitKey: string,
      fallback: string,
      allowedUnits: readonly string[]
    ): string => {
      const value = profileData?.[unitKey];
      if (typeof value === "string" && allowedUnits.includes(value)) {
        return value;
      }
      return fallback;
    };
    
    if (formData.profile?.height) {
      profile_data.push({
        metric: "height",
        value: Number(formData.profile.height),
        unit: resolveProfileUnit("height_unit", "cm", ["cm", "in"]),
      });
    }
    
    if (formData.profile?.weight) {
      profile_data.push({
        metric: "weight",
        value: Number(formData.profile.weight),
        unit: resolveProfileUnit("weight_unit", "kg", ["kg", "lb"]),
      });
    }
    
    if (formData.profile?.waist_circumference) {
      profile_data.push({
        metric: "waist",
        value: Number(formData.profile.waist_circumference),
        unit: resolveProfileUnit("waist_circumference_unit", "cm", ["cm", "in"]),
      });
    }

    if (profile_data.length > 0) {
      console.log("[Sync] Syncing profile_data:", profile_data);
      const profileResult = await updateClientProfile(profile_data);
      if (!profileResult.success) {
        console.error("[Sync] Profile sync failed:", profileResult.error);
        return { success: false, error: `Failed to sync profile_data: ${profileResult.error}` };
      }
      console.log("[Sync] Profile synced successfully");
    }

    // Extract and sync Habits/Lifestyle data
    console.log("[Sync] Checking lifestyle data:", {
      smoking_status: formData.habits?.smoking_status,
      alcohol_frequency: formData.habits?.alcohol_frequency,
      exercise_hours: formData.habits?.exercise_hours,
      diet_type: formData.diet?.diet_type,
      stress_level: formData.recovery?.stress_level,
      sleep_hours: formData.recovery?.sleep_hours,
    });
    
    const hasLifestyleData = formData.habits?.smoking_status || formData.habits?.alcohol_frequency || 
                             formData.habits?.exercise_hours || formData.diet?.diet_type ||
                             formData.recovery?.stress_level || formData.recovery?.sleep_hours;
    
    if (hasLifestyleData) {
      const lifestyle: UserLifestyleInput = {
        smokingStatus: transformSmokingStatus(typeof formData.habits?.smoking_status === 'string' ? formData.habits.smoking_status : undefined),
        alcoholConsumption: transformAlcoholConsumption(formData.habits?.alcohol_frequency),
        exerciseHoursPerWeek: extractExerciseHours(formData.habits?.exercise_hours),
        dietType: transformDietType(
          typeof formData.diet?.diet_type === "string" ? formData.diet.diet_type : undefined,
          typeof formData.diet?.diet_details === "string" ? formData.diet.diet_details : undefined
        ),
        stressLevel: formData.recovery?.stress_level ? Number(formData.recovery.stress_level) : undefined,
        sleepHoursPerNight: transformSleepHours(formData.recovery?.sleep_hours),
      };

      console.log("[Sync] Syncing lifestyle:", lifestyle);
      const lifestyleResult = await updateClientLifestyle(lifestyle);
      if (!lifestyleResult.success) {
        console.error("[Sync] Lifestyle sync failed:", lifestyleResult.error);
        return { success: false, error: `Failed to sync lifestyle: ${lifestyleResult.error}` };
      }
      console.log("[Sync] Lifestyle synced successfully");
    }

    console.log("[Sync] All data synced successfully");
    return { success: true };
  } catch (error) {
    console.error("Error syncing about-me data:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to sync data",
    };
  }
}

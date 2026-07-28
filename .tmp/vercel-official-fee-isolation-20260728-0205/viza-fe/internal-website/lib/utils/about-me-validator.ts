import type { AboutMeFormData } from "@/lib/forms/about-me-questions";

/**
 * Checks if a value is meaningful (not empty, null, or an empty array)
 */
function isMeaningful(value: unknown): boolean {
  if (value === null || value === undefined || value === "") {
    return false;
  }
  
  if (Array.isArray(value)) {
    return value.length > 0 && !value.every(v => v === "None" || v === "");
  }
  
  return true;
}

/**
 * Checks if a section has all required fields filled with meaningful values
 */
function isSectionComplete(
  section: Record<string, string | number | string[]> | undefined,
  requiredFields: string[]
): boolean {
  if (!section) {
    return false;
  }

  return requiredFields.every(field => {
    const value = section[field];
    return isMeaningful(value);
  });
}

/**
 * Validates if the about me form is complete with all required fields
 * Males automatically skip the hormones section
 */
export function isAboutMeComplete(
  aboutMeData: AboutMeFormData | undefined,
  biologicalSex?: string
): boolean {
  if (!aboutMeData) {
    return false;
  }

  const isMale = biologicalSex?.toUpperCase() === "M";

  // Profile section
  if (!isSectionComplete(aboutMeData.profile, ["height", "weight", "waist_circumference"])) {
    return false;
  }

  // Habits section
  if (!isSectionComplete(aboutMeData.habits, ["smoking_status", "alcohol_frequency", "exercise_hours"])) {
    return false;
  }

  // Diet section
  if (!isSectionComplete(aboutMeData.diet, ["diet_type"])) {
    return false;
  }

  // Items section
  if (!isSectionComplete(aboutMeData.documents, ["current_documents", "hormone_therapy", "thyroid_document"])) {
    return false;
  }

  // Hormones section (skip for males)
  if (!isMale) {
    if (!isSectionComplete(aboutMeData.hormones, ["menstrual_status", "hormonal_birth_control"])) {
      return false;
    }
  }

  // Recovery section
  if (!isSectionComplete(aboutMeData.recovery, ["stress_level", "sleep_hours"])) {
    return false;
  }

  // Conditions section
  if (!isSectionComplete(aboutMeData.conditions, ["conditions"])) {
    return false;
  }

  return true;
}

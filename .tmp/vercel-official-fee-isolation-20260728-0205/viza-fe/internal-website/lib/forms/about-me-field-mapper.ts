/**
 * About Me Form Field Mapper
 * 
 * Maps form questions to database field paths with value transformations.
 * Handles legacy data formats and provides bidirectional mapping for display.
 */

type FieldMapping = {
  path: string;
  isMapped: boolean;
};

type ValidationResult = {
  isValid: boolean;
  error?: string;
};

/**
 * Hardcoded range validation limits
 * Only for actual numeric inputs (sliders, number fields)
 * Note: sleep_hours is a string select field, not validated here
 */
const NUMERIC_RANGES = {
  height: { min: 50, max: 250, unit: "cm" },
  weight: { min: 20, max: 300, unit: "kg" },
  waist_circumference: { min: 40, max: 200, unit: "cm" },
  exercise_hours: { min: 0, max: 168, unit: "hours" },
  stress_level: { min: 1, max: 10, unit: "" },
  cycle_day: { min: 1, max: 35, unit: "days" },
} as const;

/**
 * Value transformation rules for form to database
 */
const VALUE_TRANSFORMS: Record<string, Record<string, string>> = {
  smoking_status: {
    "Never smoked": "never",
    "never smoked": "never",
    "Never Smoked": "never",
    "Former smoker": "former",
    "former smoker": "former",
    "Former Smoker": "former",
    "Current smoker": "current",
    "current smoker": "current",
    "Current Smoker": "current",
  },
  alcohol_frequency: {
    "I don't drink": "none",
    "i don't drink": "none",
    "I Don't Drink": "none",
    "1–2 drinks per week": "1-2",
    "1-2 drinks per week": "1-2",
    "3–5 drinks per week": "3-5",
    "3-5 drinks per week": "3-5",
    "Daily or almost daily": "daily",
    "daily or almost daily": "daily",
  },
  exercise_hours: {
    "0–1 hours": "0-1",
    "0-1 hours": "0-1",
    "2–3 hours": "2-3",
    "2-3 hours": "2-3",
    "4–5 hours": "4-5",
    "4-5 hours": "4-5",
    "6+ hours": "6+",
    "6 or more hours": "6+",
  },
  diet_type: {
    "Balanced / no restrictions": "balanced",
    "balanced / no restrictions": "balanced",
    "Vegetarian": "vegetarian",
    "vegetarian": "vegetarian",
    "Low-carb": "low-carb",
    "low-carb": "low-carb",
    "High-protein": "high-protein",
    "high-protein": "high-protein",
    "Intermittent fasting": "intermittent-fasting",
    "intermittent fasting": "intermittent-fasting",
    "Other": "other",
    "other": "other",
  },
  current_documents: {
    "None": "none",
    "none": "none",
    "Yes (please specify)": "yes",
    "yes (please specify)": "yes",
  },
  hormone_therapy: {
    "No": "no",
    "no": "no",
    "Yes (please specify document and dose)": "yes",
    "yes (please specify document and dose)": "yes",
  },
  thyroid_document: {
    "No": "no",
    "no": "no",
    "Yes (please specify document and dose)": "yes",
    "yes (please specify document and dose)": "yes",
  },
  menstrual_status: {
    "Regular cycles": "regular",
    "regular cycles": "regular",
    "Irregular cycles": "irregular",
    "irregular cycles": "irregular",
    "Not currently menstruating": "not-menstruating",
    "not currently menstruating": "not-menstruating",
    "Postmenopausal": "postmenopausal",
    "postmenopausal": "postmenopausal",
  },
  hormonal_birth_control: {
    "Yes": "yes",
    "yes": "yes",
    "No": "no",
    "no": "no",
  },
  sleep_hours: {
    "Less than 5 hours": "<5",
    "less than 5 hours": "<5",
    "5–6 hours": "5-6",
    "5-6 hours": "5-6",
    "6–7 hours": "6-7",
    "6-7 hours": "6-7",
    "7–8 hours": "7-8",
    "7-8 hours": "7-8",
    "More than 8 hours": "8+",
    "more than 8 hours": "8+",
  },
};

/**
 * Reverse mapping for database to form display
 */
const DISPLAY_TRANSFORMS: Record<string, Record<string, string>> = {
  smoking_status: {
    "never": "Never smoked",
    "former": "Former smoker",
    "current": "Current smoker",
  },
  alcohol_frequency: {
    "none": "I don't drink",
    "1-2": "1–2 drinks per week",
    "3-5": "3–5 drinks per week",
    "daily": "Daily or almost daily",
  },
  exercise_hours: {
    "0-1": "0–1 hours",
    "2-3": "2–3 hours",
    "4-5": "4–5 hours",
    "6+": "6+ hours",
  },
  diet_type: {
    "balanced": "Balanced / no restrictions",
    "vegetarian": "Vegetarian",
    "low-carb": "Low-carb",
    "high-protein": "High-protein",
    "intermittent-fasting": "Intermittent fasting",
    "other": "Other",
  },
  current_documents: {
    "none": "None",
    "yes": "Yes (please specify)",
  },
  hormone_therapy: {
    "no": "No",
    "yes": "Yes (please specify document and dose)",
  },
  thyroid_document: {
    "no": "No",
    "yes": "Yes (please specify document and dose)",
  },
  menstrual_status: {
    "regular": "Regular cycles",
    "irregular": "Irregular cycles",
    "not-menstruating": "Not currently menstruating",
    "postmenopausal": "Postmenopausal",
  },
  hormonal_birth_control: {
    "yes": "Yes",
    "no": "No",
  },
  sleep_hours: {
    "<5": "Less than 5 hours",
    "5-6": "5–6 hours",
    "6-7": "6–7 hours",
    "7-8": "7–8 hours",
    "8+": "More than 8 hours",
  },
};

/**
 * Development-only logging
 */
function devLog(message: string, ...args: unknown[]) {
  if (process.env.NODE_ENV === "development") {
    console.warn(`[Field Mapper] ${message}`, ...args);
  }
}

/**
 * Transform a value from form display format to database storage format
 */
function transformValueForDatabase(fieldKey: string, value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  // Handle string transformations
  if (typeof value === "string" && VALUE_TRANSFORMS[fieldKey]) {
    const transformed = VALUE_TRANSFORMS[fieldKey][value];
    if (transformed) {
      devLog(`Transformed ${fieldKey}: "${value}" → "${transformed}"`);
      return transformed;
    }
    
    // Handle legacy formats (case-insensitive)
    const lowerValue = value.toLowerCase();
    const matchedKey = Object.keys(VALUE_TRANSFORMS[fieldKey]).find(
      (key) => key.toLowerCase() === lowerValue
    );
    if (matchedKey) {
      const transformed = VALUE_TRANSFORMS[fieldKey][matchedKey];
      devLog(`Transformed legacy ${fieldKey}: "${value}" → "${transformed}"`);
      return transformed;
    }
  }

  // Handle multi-select arrays
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "string" && VALUE_TRANSFORMS[fieldKey]) {
        return VALUE_TRANSFORMS[fieldKey][item] || item;
      }
      return item;
    });
  }

  return value;
}

/**
 * Transform a value from database storage format to form display format
 */
function transformValueForDisplay(fieldKey: string, value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  // Handle string transformations
  if (typeof value === "string" && DISPLAY_TRANSFORMS[fieldKey]) {
    const transformed = DISPLAY_TRANSFORMS[fieldKey][value];
    if (transformed) {
      return transformed;
    }
  }

  // Handle multi-select arrays
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "string" && DISPLAY_TRANSFORMS[fieldKey]) {
        return DISPLAY_TRANSFORMS[fieldKey][item] || item;
      }
      return item;
    });
  }

  return value;
}

/**
 * Validate numeric range for a field
 */
export function validateNumericRange(fieldKey: string, value: unknown): ValidationResult {
  const range = NUMERIC_RANGES[fieldKey as keyof typeof NUMERIC_RANGES];
  if (!range) {
    return { isValid: true }; // No range validation for this field
  }

  const numValue = typeof value === "string" ? parseFloat(value) : Number(value);
  
  if (isNaN(numValue)) {
    return {
      isValid: false,
      error: `${fieldKey.replace(/_/g, " ")} must be a valid number`,
    };
  }

  if (numValue < range.min || numValue > range.max) {
    const unit = range.unit ? ` ${range.unit}` : "";
    return {
      isValid: false,
      error: `${fieldKey.replace(/_/g, " ")} must be between ${range.min}-${range.max}${unit}`,
    };
  }

  return { isValid: true };
}

/**
 * Get the database field path for a form question
 */
export function getFieldPath(sectionKey: string, questionKey: string): FieldMapping {
  // All current form questions map directly to database paths
  // Format: section.field (e.g., "profile.height")
  return {
    path: `${sectionKey}.${questionKey}`,
    isMapped: true,
  };
}

/**
 * Map form question value to database format with transformations
 */
export function mapFormToDatabase(
  sectionKey: string,
  questionKey: string,
  value: unknown
): { path: string; value: unknown; isMapped: boolean } {
  const mapping = getFieldPath(sectionKey, questionKey);
  const transformedValue = transformValueForDatabase(questionKey, value);

  return {
    path: mapping.path,
    value: transformedValue,
    isMapped: mapping.isMapped,
  };
}

/**
 * Map database value to form display format
 */
export function mapDatabaseToForm(fieldPath: string, value: unknown): unknown {
  const parts = fieldPath.split(".");
  if (parts.length !== 2) {
    return value;
  }

  const [, fieldKey] = parts;
  return transformValueForDisplay(fieldKey, value);
}

/**
 * Get all field paths for a section
 */
export function getSectionMappings(sectionKey: string): string[] {
  const sectionFieldMappings: Record<string, string[]> = {
    profile: ["profile.height", "profile.weight", "profile.waist_circumference"],
    habits: [
      "habits.smoking_status",
      "habits.alcohol_frequency",
      "habits.exercise_hours",
    ],
    diet: ["diet.diet_type"],
    documents: [
      "documents.current_documents",
      "documents.document_details",
      "documents.hormone_therapy",
      "documents.hormone_therapy_details",
      "documents.thyroid_document",
      "documents.thyroid_document_details",
    ],
    hormones: [
      "hormones.menstrual_status",
      "hormones.cycle_day",
      "hormones.hormonal_birth_control",
    ],
    recovery: ["recovery.stress_level", "recovery.sleep_hours"],
    conditions: ["conditions.conditions", "conditions.other_conditions"],
  };

  return sectionFieldMappings[sectionKey] || [];
}

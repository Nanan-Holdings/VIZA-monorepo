/**
 * Category mapping for metrics and metrics based on VIZA Master Sheet
 * Maps each metric/metric to Primary, Secondary, and Tertiary categories
 */

export interface CategoryAssignment {
  primary: string;
  secondary?: string;
  tertiary?: string;
}

export const METRIC_CATEGORIES_LEGACY: Record<string, CategoryAssignment> = {
  // DNA Markers
  "Vitamin B12": { primary: "DNA Markers", secondary: "Nutrients" },
  "Folate (RBC)": { primary: "DNA Markers", secondary: "Nutrients" },

  // Category A
  "Total Cholesterol": { primary: "Category A", secondary: "Metabolic Markers" },
  "LDL Cholesterol": { primary: "Category A", secondary: "Metabolic Markers" },
  "HDL Cholesterol": { primary: "Category A", secondary: "Metabolic Markers" },
  "Triglycerides": { primary: "Category A", secondary: "Metabolic Markers" },
  "Apolipoprotein B": { primary: "Category A", secondary: "Metabolic Markers" },
  "Lipoprotein a": { primary: "Category A", secondary: "Metabolic Markers" },
  "High-Sensitivity CRP": { primary: "Category A", secondary: "Immune System", tertiary: "Metabolic Markers" },
  "Homocysteine": { primary: "Category A", secondary: "DNA Markers", tertiary: "Metabolic Markers" },
  "VLDL Cholesterol": { primary: "Category A" },

  // Immune System
  "Hemoglobin": { primary: "Immune System", secondary: "Nutrients" },
  "RBC Count": { primary: "Immune System", secondary: "Nutrients" },
  "Hematocrit": { primary: "Immune System", secondary: "Nutrients" },
  "RDW": { primary: "Immune System", secondary: "Nutrients" },
  "WBC Count": { primary: "Immune System" },
  "Lymphocytes": { primary: "Immune System" },
  "Anti-TPO": { primary: "Immune System", secondary: "Metabolic Markers" },
  "Anti-Thyroglobulin": { primary: "Immune System", secondary: "Metabolic Markers" },
  "Erythrocyte Sedimentation Rate": { primary: "Immune System" },
  "Rheumatoid Factor": { primary: "Immune System" },
  "Antinuclear Antibody": { primary: "Immune System" },

  // Kidney Markers
  "Urea": { primary: "Kidney Markers" },
  "Creatinine with EGFR": { primary: "Kidney Markers" },
  "eGFR": { primary: "Kidney Markers" },
  "Chloride": { primary: "Metabolic Markers", secondary: "Kidney Markers" },
  "Potassium": { primary: "Metabolic Markers", secondary: "Kidney Markers" },
  "Sodium": { primary: "Metabolic Markers", secondary: "Kidney Markers" },

  // Liver Markers
  "ALT SGPT": { primary: "Liver Markers" },
  "AST SGOT": { primary: "Liver Markers", secondary: "Nutrients" },
  "ALP": { primary: "Liver Markers" },
  "GGT": { primary: "Liver Markers" },
  "Albumin": { primary: "Liver Markers", secondary: "Gut Health" },
  "Bilirubin - Total": { primary: "Liver Markers" },
  "Globulin": { primary: "Liver Markers" },

  // Metabolic Markers
  "Glucose FBS/RBS": { primary: "Metabolic Markers" },
  "HbA1c with eAG": { primary: "Metabolic Markers" },
  "Insulin": { primary: "Metabolic Markers" },
  "Uric Acid": { primary: "Metabolic Markers", secondary: "Kidney Markers" },
  "TSH": { primary: "Metabolic Markers" },
  "FT4": { primary: "Metabolic Markers" },
  "FT3": { primary: "Metabolic Markers" },
  "CO2": { primary: "Metabolic Markers" },
  "Cortisol": { primary: "Metabolic Markers", secondary: "Category A" },

  // Nutrients
  "Vitamin D": { primary: "Nutrients" },
  "Ferritin": { primary: "Nutrients" },
  "Iron": { primary: "Nutrients" },
  "TIBC": { primary: "Nutrients" },
  "Magnesium": { primary: "Nutrients" },
  "Ionized Calcium": { primary: "Nutrients" },

  // Sex Hormones
  "DHEA-S": { primary: "Sex Hormones" },
  "Total Testosterone": { primary: "Sex Hormones" },
  "Free Testosterone": { primary: "Sex Hormones" },
  "Estradiol": { primary: "Sex Hormones" },
  "IGF-1": { primary: "Sex Hormones" },
  "PSA Profile": { primary: "Sex Hormones" },
  "FSH": { primary: "Sex Hormones" },
  "LH": { primary: "Sex Hormones" },
  "Progesterone": { primary: "Sex Hormones" },
  "Prolactin": { primary: "Sex Hormones" },
  "PSA (Free)": { primary: "Sex Hormones" },
  "PSA Free/Total Ratio": { primary: "Sex Hormones" },
  "SHBG": { primary: "Sex Hormones" },
};

export const METRIC_CATEGORIES: Record<string, CategoryAssignment> = {
  // Category A
  "Cardiovascular Age": { primary: "Category A" },
  "Heart Disease Risk Index": { primary: "Category A" },
  "Cholesterol Risk Ratio": { primary: "Category A" },
  "Bad Cholesterol Total": { primary: "Category A" },
  "Non-HDL Cholesterol": { primary: "Category A" },
  "Total Cholesterol/HDL Ratio": { primary: "Category A" },
  "Remnant Cholesterol": { primary: "Category A" },
  "Particle Number vs Size": { primary: "Category A" },

  // Immune System
  "Inflammation Score": { primary: "Immune System" },
  "Immune Stress Index": { primary: "Immune System" },
  "Immune Balance Ratio": { primary: "Immune System" },
  "Platelet Inflammation Index": { primary: "Immune System" },
  "Systemic Inflammation Score": { primary: "Immune System" },

  // Kidney Markers
  "Kidney Progress Score": { primary: "Kidney Markers" },

  // Liver Markers
  "Liver Markers Ratio": { primary: "Liver Markers" },
  "Liver Fibrosis Risk (FIB-4)": { primary: "Liver Markers" },
  "Fatty Liver Risk Score": { primary: "Liver Markers" },

  // Metabolic Markers
  "Metabolic Age": { primary: "Metabolic Markers" },
  "Metabolic Progress Score": { primary: "Metabolic Markers" },
  "Insulin Resistance Score": { primary: "Metabolic Markers" },
  "Insulin Resistance Indicator": { primary: "Metabolic Markers" },
  "Thyroid Conversion Efficiency": { primary: "Metabolic Markers" },
  "Thyroid Feedback Score": { primary: "Metabolic Markers" },
  "Estimated Average Glucose": { primary: "Metabolic Markers" },

  // Nutrients
  "Iron Utilization %": { primary: "Nutrients" },

  // Sex Hormones
  "Hormone Age": { primary: "Sex Hormones" },
  "Androgen Index": { primary: "Sex Hormones" },
  "IGF-1 Z-Score": { primary: "Sex Hormones" },
  "Testosterone Z-Score": { primary: "Sex Hormones" },
  "Calculated Free Testosterone": { primary: "Sex Hormones" },
  "Estrogen Balance Ratio": { primary: "Sex Hormones" },
  "Testosterone Vitality Score": { primary: "Sex Hormones" },

  // Summary
  "Progress Score": { primary: "Summary" },
  "Biological Age (PhenoAge)": { primary: "Summary" },
  "Pace of Aging": { primary: "Summary" },
  "Longevity Score": { primary: "Summary" },
  "Longevity Score (Age-Adjusted)": { primary: "Summary" },
};

/**
 * List of all categories in the desired display order
 */
export const CATEGORY_ORDER = [
  "Summary",
  "Category A",
  "Liver Markers",
  "Kidney Markers",
  "Metabolic Markers",
  "Sex Hormones",
  "Immune System",
  "Gut Health",
  "DNA Markers",
  "Nutrients",
  "Immune Defense",
  "Others",
] as const;

export type CategoryName = typeof CATEGORY_ORDER[number];

/**
 * Get the category assignment for a metric or metric
 */
export function getCategoryAssignment(name: string): CategoryAssignment | null {
  return METRIC_CATEGORIES_LEGACY[name] || METRIC_CATEGORIES[name] || null;
}

/**
 * Get all categories that a metric/metric belongs to (primary, secondary, tertiary)
 */
export function getAllCategories(name: string): string[] {
  const assignment = getCategoryAssignment(name);
  if (!assignment) return [];
  
  const categories = [assignment.primary];
  if (assignment.secondary) categories.push(assignment.secondary);
  if (assignment.tertiary) categories.push(assignment.tertiary);
  
  return categories;
}

/**
 * Get related categories (non-primary) for display in "Related" section
 */
export function getRelatedCategories(name: string): string[] {
  const assignment = getCategoryAssignment(name);
  if (!assignment) return [];
  
  const related: string[] = [];
  if (assignment.secondary) related.push(assignment.secondary);
  if (assignment.tertiary) related.push(assignment.tertiary);
  
  return related;
}

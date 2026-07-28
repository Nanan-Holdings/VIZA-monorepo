/**
 * Mapping between report metric names and CSV metric names
 * This allows flexibility if the report uses different naming than the CSV
 */

export const metricNameMapping: Record<string, string> = {
  // Lipid Panel
  "Total Cholesterol": "Total Cholesterol",
  "LDL Cholesterol": "LDL Cholesterol",
  "HDL Cholesterol": "HDL Cholesterol",
  "Triglycerides": "Triglycerides",

  // Metabolic Panel
  "Fasting Glucose": "Glucose (FBS)",
  "Glucose FBS/RBS": "Glucose (FBS)",
  "Hemoglobin A1c": "HbA1c",
  "HbA1c with eAG": "HbA1c",

  // Liver Function
  "ALT (Alanine Aminotransferase)": "ALT",
  "ALT SGPT": "ALT",
  "AST": "AST",
  "AST SGOT": "AST",
  "ALP": "ALP",
  "GGT": "GGT",
  "Bilirubin": "Bilirubin - Total",
  "Albumin": "Albumin",

  // Kidney Markers
  "Creatinine": "Creatinine (eGFR)",
  "Creatinine with EGFR": "Creatinine (eGFR)",
  "eGFR": "eGFR",
  "BUN": "Urea (BUN)",
  "Urea": "Urea (BUN)",
  "Sodium": "Sodium",
  "Potassium": "Potassium",
  "Chloride": "Chloride",
  "Bicarbonate": "Bicarbonate (CO2)",

  // Thyroid
  "TSH": "TSH",
  "Free T4": "Free T4",
  "FT4": "Free T4",
  "Free T3": "Free T3",
  "FT3": "Free T3",
  "Anti-TPO": "Anti-TPO",
  "Anti-Thyroglobulin": "Anti-Thyroglobulin",

  // Hormones
  "Total Testosterone": "Total Testosterone",
  "Free Testosterone": "Free Testosterone",
  "Estradiol": "Estradiol",
  "FSH": "FSH",
  "LH": "LH",
  "Progesterone": "Progesterone",
  "Prolactin": "Prolactin",
  "DHEA-S": "DHEA-S",
  "DHEAS": "DHEA-S",
  "SHBG": "SHBG",

  // Vitamins & Minerals
  "Vitamin B12": "Vitamin B12",
  "Folate": "Folate",
  "Folate (RBC)": "Folate",
  "Magnesium": "Magnesium",
  "Iron": "Iron",
  "Ferritin": "Ferritin",
  "Vitamin D": "Vitamin D",

  // Inflammation & Immunity
  "CRP": "CRP (high sensitive)",
  "hs-CRP": "CRP (high sensitive)",
  "Cortisol": "Cortisol",
  "Homocysteine": "Homocysteine",

  // Lipoproteins & Advanced Lipids
  "Apolipoprotein B": "Apolipoprotein B",
  "Lipoprotein (a)": "Lipoprotein (a)",
  "Remnant Cholesterol": "Remnant Cholesterol",

  // Glucose & Insulin
  "Fasting Insulin": "Insulin",
  "Insulin": "Insulin",

  // Blood Cells - Individual markers
  "White Blood Cells": "WBC Count",
  "WBC Count": "WBC Count",
  "Red Blood Cells": "Complete Blood Count (14 panel)",
  "Platelets": "Complete Blood Count (14 panel)",
  "Hemoglobin": "Hemoglobin",
  "Hematocrit": "Hematocrit",
  "RDW": "RDW",
  "Lymphocytes": "Lymphocytes",

  // Other markers
  "PSA": "PSA Profile (Free + Total)",
  "PSA (Free)": "PSA (Free)",
  "PSA Free/Total Ratio": "PSA Free/Total Ratio",
  "IGF-1": "IGF-1",
  "Uric Acid": "Uric Acid",

  // Derived metrics
  "Total Cholesterol / HDL Ratio": "Cholesterol Risk Ratio",
  "LDL / HDL Ratio": "Insulin Resistance Indicator",
  "Cholesterol Risk Ratio": "Cholesterol Risk Ratio",
  "Insulin Resistance Indicator": "Insulin Resistance Indicator",
  "Kidney Progress Score": "Kidney Progress Score",
  "Liver Markers Ratio": "Liver Markers Ratio",
  "Immune Stress Index": "Immune Stress Index",
  "Bad Cholesterol Total": "Bad Cholesterol Total",
  "Systemic Inflammation Score": "Systemic Inflammation Score",
  "Insulin Resistance Score": "Insulin Resistance Score",
  "Iron Utilization %": "Iron Utilization %",
  "Androgen Index": "Androgen Index",
  "Calculated Free Testosterone": "Calculated Free Testosterone",
  "Longevity Score (Age-Adjusted)": "Longevity Score (Age-Adjusted)",
  "Biological Age (PhenoAge)": "Biological Age (PhenoAge)",
  "Heart Disease Risk Index": "Heart Disease Risk Index",
  "Particle Number vs Size": "Particle Number vs Size",
  "Testosterone Vitality Score": "Testosterone Vitality Score",
  "Estrogen Balance Ratio": "Estrogen Balance Ratio",
  "Metabolic Progress Score": "Metabolic Progress Score",
  "Metabolic Age": "Metabolic Age",
  "Hormone Age": "Hormone Age",
  "Pace of Aging": "Pace of Aging",
  "Liver Fibrosis Risk": "Liver Fibrosis Risk",
  "Heart Age": "Heart Age",
  "Longevity Score": "Longevity Score",
  "Inflammation Score": "Inflammation Score",
  "Thyroid Conversion Efficiency": "Thyroid Conversion Efficiency",
  "Thyroid Feedback Score": "Thyroid Feedback Score",
  "Immune Balance Ratio": "Immune Balance Ratio",
  "Platelet Inflammation Index": "Platelet Inflammation Index",
  "Fatty Liver Risk Score": "Fatty Liver Risk Score",
};

/**
 * Get the CSV metric name from a report metric name
 */
export function getMappedMetricName(reportMetricName: string): string {
  return metricNameMapping[reportMetricName] || reportMetricName;
}

/**
 * List all unmapped metrics (those that don't exist in the mapping)
 */
export function getUnmappedMetrics(reportMetricNames: string[]): string[] {
  return reportMetricNames.filter(
    (name) => !metricNameMapping[name] && name
  );
}

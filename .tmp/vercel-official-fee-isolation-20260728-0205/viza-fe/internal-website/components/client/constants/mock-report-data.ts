// TypeScript types for Lab Report structured data

export type ResultStatus = "OK" | "BORDERLINE" | "HIGH" | "LOW" | "CRITICAL" | "N_A";
export type TrendDirection = "UP" | "DOWN" | "FLAT" | null;
export type OverallGrade = "EXCELLENT" | "GOOD" | "FAIR" | "POOR";

export interface User {
  name: string;
  age: number;
  sex: "M" | "F";
  testDate: string;
}

export interface MetricResult {
  metricCode: string;
  metricName: string;
  value: number | null;
  unit: string;
  status: ResultStatus;
  statusLabel: string;
  refLow: number;
  refHigh: number;
  optimalLow?: number;
  optimalHigh?: number;
  trendDirection: TrendDirection;
  prevValue?: number;
  trendMagnitude?: number;
  whatThisMeans: string;
  trendValues?: number[];
  trendDates?: string[]; // ISO date strings for each trend value (e.g., "2025-01-15")
  ranges?: RangeTriple;
}

export interface ResultCategory {
  category: string;
  summary: string;
  criticalCount: number;
  abnormalCount: number;
  normalCount: number;
  results: MetricResult[];
}

export interface DerivedMetric {
  metricCode: string;
  metricName: string;
  value: number;
  unit: string;
  status: ResultStatus;
  statusLabel: string;
  refHigh?: number;
  refLow?: number;
  trendDirection?: TrendDirection;
  trendMagnitude?: number;
  trendValues?: [number, number, number];
  trendDates?: string[]; // ISO date strings for each trend value (e.g., "2025-01-15")
  ranges?: RangeTriple;
  whatThisMeans: string;
}

export interface Findings {
  overallGrade: OverallGrade;
  criticalFindings: string[];
  keyInsights: string[];
  categories: ResultCategory[];
  derivedMetrics: DerivedMetric[];
}

export interface StructuredData {
  user: User;
  findings: Findings;
}

export interface SummaryCounts {
  optimal: number;
  borderline: number;
  flagged: number;
  total: number;        // Metrics WITH reference ranges (for status bar chart)
  totalTested: number;  // ALL metrics including Others (for "X metrics tested")
  totalMeasured?: number; // Measured metrics only (not derived/calculated)
  totalDerived?: number;  // Derived/calculated metrics only
  others: number;       // Metrics WITHOUT reference ranges
}

export interface LabReport {
  id: string;
  user_id: string;
  consultation_id: string;
  lab_order_id: string;
  status: "DRAFT" | "FINAL";
  grade: OverallGrade;
  summary_counts: SummaryCounts;
  clinician_message: string;
  structured_data: StructuredData;
  clinician_pdf_url: string;
  user_pdf_url: string;
  created_at: string;
  signed_at: string | null;
  input_hash: string;
}

export type RangeTriple = {
  optimal: string; // "<180" or ">60"
  inRange: string; // "180-200" or "40-60"
  outOfRange: string; // ">200" or "<40"
};

// Mock report data - Male user, age 45, with elevated cholesterol
export const mockLabReport: LabReport = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  user_id: "880e8400-e29b-41d4-a716-446655440000",
  consultation_id: "660e8400-e29b-41d4-a716-446655440000",
  lab_order_id: "770e8400-e29b-41d4-a716-446655440000",
  status: "FINAL",
  grade: "FAIR",

  summary_counts: {
    optimal: 5,
    borderline: 4,
    flagged: 6,
    total: 15,
    totalTested: 15,
    others: 0,
  },

  clinician_message:
    "User shows elevated LDL cholesterol (160 mg/dL) and borderline triglycerides (185 mg/dL). HDL is slightly low (42 mg/dL). Cardiovascular risk assessment recommended. Consider lifestyle modifications and possible statin therapy.",

  structured_data: {
    user: {
      name: "John Doe",
      age: 45,
      sex: "M",
      testDate: "2025-12-10",
    },

    findings: {
      overallGrade: "FAIR",
      criticalFindings: [
        "LDL Cholesterol: 160 mg/dL (ABNORMAL - High cardiovascular risk)",
      ],
      keyInsights: [
        "Lipid panel shows pattern consistent with increased cardiovascular risk",
        "HDL/LDL ratio is unfavorable (0.26, optimal >0.4)",
        "Fasting glucose is normal, ruling out metabolic syndrome at this time",
      ],

      categories: [
        {
          category: "Lipid Panel",
          summary:
            "Lipid panel shows elevated LDL and low HDL, indicating increased cardiovascular risk.",
          criticalCount: 0,
          abnormalCount: 2,
          normalCount: 2,
          results: [
            {
              metricCode: "TC",
              metricName: "Total Cholesterol",
              value: 235,
              unit: "mg/dL",
              status: "HIGH",
              statusLabel: "Elevated",
              refLow: 0,
              refHigh: 200,
              trendDirection: "UP",
              prevValue: 190,
              trendMagnitude: 23.7,
              trendValues: [270, 195, 235],
              ranges: {
                optimal: "<180",
                inRange: "180-220",
                outOfRange: ">220",
              },
              whatThisMeans:
                "Total cholesterol is elevated. Recommend dietary changes and exercise.",
            },
            {
              metricCode: "LDL_C",
              metricName: "LDL Cholesterol",
              value: 170,
              unit: "mg/dL",
              status: "HIGH",
              statusLabel: "Elevated",
              refLow: 0,
              refHigh: 100,
              trendDirection: "UP",
              prevValue: 120,
              trendMagnitude: 41.7,
              trendValues: [95, 120, 170],
              ranges: {
                optimal: "<100",
                inRange: "100-130",
                outOfRange: ">130",
              },
              whatThisMeans:
                "LDL cholesterol is high. Increases risk of heart disease. Statin therapy may be indicated.",
            },
            {
              metricCode: "HDL_C",
              metricName: "HDL Cholesterol",
              value: 62,
              unit: "mg/dL",
              status: "OK",
              statusLabel: "Optimal",
              refLow: 40,
              refHigh: 999,
              optimalLow: 60,
              trendDirection: "UP",
              prevValue: 50,
              trendMagnitude: 24,
              trendValues: [38, 50, 62],
              ranges: { optimal: ">60", inRange: "40-60", outOfRange: "<40" },
              whatThisMeans:
                "HDL cholesterol is below optimal. Aerobic exercise can help raise HDL.",
            },
            {
              metricCode: "TRIG",
              metricName: "Triglycerides",
              value: 145,
              unit: "mg/dL",
              status: "OK",
              statusLabel: "Improved",
              refLow: 0,
              refHigh: 150,
              trendDirection: "DOWN",
              prevValue: 190,
              trendMagnitude: -23.7,
              trendValues: [210, 190],
              ranges: {
                optimal: "<150",
                inRange: "150-200",
                outOfRange: ">200",
              },
              whatThisMeans:
                "Triglycerides are borderline high. Reduce sugar and alcohol intake.",
            },
          ],
        },

        {
          category: "Metabolic Panel",
          summary: "Metabolic markers are within normal range.",
          criticalCount: 0,
          abnormalCount: 0,
          normalCount: 5,
          results: [
            {
              metricCode: "GLUCOSE",
              metricName: "Fasting Glucose",
              value: 92,
              unit: "mg/dL",
              status: "OK",
              statusLabel: "Normal",
              refLow: 70,
              refHigh: 100,
              trendDirection: "DOWN",
              prevValue: 105,
              trendMagnitude: -12.4,
              trendValues: [130],
              ranges: {
                optimal: "<100",
                inRange: "100-125",
                outOfRange: ">125",
              },
              whatThisMeans:
                "Fasting glucose is normal. Continue healthy diet.",
            },
            {
              metricCode: "HBA1C",
              metricName: "Hemoglobin A1c",
              value: 5.3,
              unit: "%",
              status: "OK",
              statusLabel: "Normal",
              refLow: 0,
              refHigh: 5.7,
              trendDirection: "DOWN",
              trendMagnitude: -14.6,
              trendValues: [6.2, 5.8, 5.3],
              ranges: {
                optimal: "<5.4",
                inRange: "5.4-5.7",
                outOfRange: ">5.7",
              },
              whatThisMeans: "HbA1c is normal. No evidence of diabetes.",
            },
          ],
        },

        {
          category: "Liver Function",
          summary: "Liver enzymes are within normal range.",
          criticalCount: 0,
          abnormalCount: 0,
          normalCount: 3,
          results: [
            {
              metricCode: "ALT",
              metricName: "ALT (Alanine Aminotransferase)",
              value: 28,
              unit: "U/L",
              status: "OK",
              statusLabel: "Normal",
              refLow: 0,
              refHigh: 40,
              trendDirection: "FLAT",
              trendValues: [24, 26, 28],
              ranges: { optimal: "<35", inRange: "35-40", outOfRange: ">40" },
              whatThisMeans: "Liver function is normal.",
            },
          ],
        },
      ],

      derivedMetrics: [
        {
          metricCode: "TC_HDL_RATIO",
          metricName: "Total Cholesterol / HDL Ratio",
          value: 4.7,
          unit: "ratio",
          status: "BORDERLINE",
          statusLabel: "Improving",
          refHigh: 5.0,
          trendDirection: "DOWN",
          trendMagnitude: -17.4,
          trendValues: [6.1, 5.4, 4.7],
          ranges: {
            optimal: "<4.5",
            inRange: "4.5-5.0",
            outOfRange: ">5.0",
          },
          whatThisMeans:
            "TC/HDL ratio is elevated (5.6), indicating increased cardiovascular risk. Optimal is <5.0.",
        },
        {
          metricCode: "LDL_HDL_RATIO",
          metricName: "LDL / HDL Ratio",
          value: 2.95,
          unit: "ratio",
          status: "BORDERLINE",
          statusLabel: "Improving",
          refHigh: 3.0,
          trendDirection: "DOWN",
          trendMagnitude: -22.6,
          trendValues: [3.8, 3.4, 2.95],
          ranges: {
            optimal: "<2.5",
            inRange: "2.5-3.0",
            outOfRange: ">3.0",
          },
          whatThisMeans:
            "LDL/HDL ratio is unfavorable. Target is <3.0 for cardiovascular protection.",
        },
      ],
    },
  },

  clinician_pdf_url:
    "reports/770e8400-e29b-41d4-a716-446655440000/clinician_1734262200000.pdf",
  user_pdf_url:
    "reports/770e8400-e29b-41d4-a716-446655440000/user_1734262200000.pdf",

  created_at: "2025-12-15T10:30:00Z",
  signed_at: null,
  input_hash: "a3f5e9c8b2d1...",
};

// Helper function to map status to badge color
export function getStatusBadgeColor(
  status: ResultStatus
): "green" | "yellow" | "red" | "gray" {
  switch (status) {
    case "OK":
      return "green";
    case "BORDERLINE":
      return "yellow";
    case "HIGH":
    case "LOW":
    case "CRITICAL":
      return "red";
    case "N_A":
      return "gray";
    default:
      return "yellow";
  }
}

// Helper to format date for display
export function formatReportDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

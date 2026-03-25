import { z } from "zod";

export type QuestionType =
  | "select"
  | "multi-select"
  | "text"
  | "slider"
  | "number";

export interface Question {
  id: string;
  question: string;
  subtitle?: string;
  type: QuestionType;
  options?: string[];
  conditional?: {
    questionId: string;
    value: string | string[];
  };
}

export interface Section {
  id: string;
  name: string;
  title: string;
  color: string;
  /** Optional gender filter - 'F' for female-only, 'M' for male-only, undefined for all */
  genderFilter?: "M" | "F";
}

export const ABOUT_ME_SECTIONS: Section[] = [
  { id: "profile", name: "Profile", title: "Your Profile", color: "#A8644D" },
  { id: "habits", name: "Habits", title: "Your Habits", color: "#A8644D" },
  { id: "diet", name: "Diet", title: "Your Diet", color: "#A8644D" },
  {
    id: "recovery",
    name: "Recovery",
    title: "Your Recovery",
    color: "#A8644D",
  },
];

export const ABOUT_ME_QUESTIONS: Record<string, Question[]> = {
  profile: [
    {
      id: "sex",
      question: "What is your biological sex?",
      subtitle: "This helps us personalize your recommendations",
      type: "select",
      options: ["Male", "Female"],
    },
    {
      id: "height",
      question: "How tall are you?",
      subtitle: "Used to calculate body and metabolic metrics",
      type: "text",
    },
    {
      id: "weight",
      question: "What is your current weight?",
      subtitle: "Helps us assess wellbeing",
      type: "text",
    },
    {
      id: "waist_circumference",
      question: "What is your waist circumference?",
      subtitle: "This helps estimate visceral fat and metabolic risk",
      type: "text",
    },
  ],
  habits: [
    {
      id: "smoking_status",
      question: "Do you smoke?",
      subtitle: "Smoking affects cardiovascular and wellbeing",
      type: "select",
      options: ["Never smoked", "Former smoker", "Current smoker"],
    },
    {
      id: "alcohol_frequency",
      question: "How often do you drink alcohol?",
      subtitle: "Alcohol intake can influence metabolic markers",
      type: "select",
      options: [
        "I don't drink",
        "1–2 drinks per week",
        "3–5 drinks per week",
        "Daily or almost daily",
      ],
    },
    {
      id: "exercise_hours",
      question: "How many hours do you exercise per week?",
      subtitle: "Physical activity supports wellbeing",
      type: "select",
      options: ["0–1 hours", "2–3 hours", "4–5 hours", "6+ hours"],
    },
  ],
  diet: [
    {
      id: "diet_type",
      question: "How would you describe your usual diet?",
      subtitle: "Diet patterns affect nutrient and metabolic results",
      type: "select",
      options: [
        "Balanced / no restrictions",
        "Vegetarian",
        "Low-carb",
        "High-protein",
        "Intermittent fasting",
        "Other (please specify)",
      ],
    },
  ],
  documents: [
    {
      id: "current_documents",
      question: "Are you currently taking any documents?",
      subtitle: "Some documents affect how results are interpreted",
      type: "select",
      options: ["None", "Yes (please specify)"],
    },
    {
      id: "hormone_therapy",
      question: "Are you using hormone therapy or optimization?",
      subtitle: "Hormone use can influence lab values",
      type: "select",
      options: ["No", "Yes (please specify document and dose)"],
    },
    {
      id: "thyroid_document",
      question: "Are you taking any thyroid document?",
      subtitle: "Hormone use can influence lab values",
      type: "select",
      options: ["No", "Yes (please specify document and dose)"],
    },
  ],
  hormones: [
    {
      id: "menstrual_status",
      question: "What best describes your menstrual status?",
      subtitle: "Cycle status helps interpret hormone level",
      type: "select",
      options: [
        "Regular cycles",
        "Irregular cycles",
        "Not currently menstruating",
        "Postmenopausal",
      ],
    },
    {
      id: "cycle_day",
      question: "What day of your cycle are you currently on?",
      subtitle: "This helps us time hormone interpretation correctly",
      type: "number",
      conditional: {
        questionId: "menstrual_status",
        value: ["Regular cycles", "Irregular cycles"],
      },
    },
    {
      id: "hormonal_birth_control",
      question: "Are you using hormonal birth control?",
      subtitle: "Birth control can change hormone readings",
      type: "select",
      options: ["Yes", "No"],
    },
  ],
  recovery: [
    {
      id: "stress_level",
      question: "How would you rate your stress level?",
      subtitle: "Stress influences hormones and inflammation",
      type: "slider",
    },
    {
      id: "sleep_hours",
      question: "How many hours do you usually sleep per night?",
      subtitle: "Sleep plays a key role in recovery and wellbeing",
      type: "select",
      options: [
        "Less than 5 hours",
        "5–6 hours",
        "6–7 hours",
        "7–8 hours",
        "More than 8 hours",
      ],
    },
  ],
  conditions: [
    {
      id: "conditions",
      question: "Have you been diagnosed with any conditions?",
      subtitle: "This helps us personalize your results",
      type: "multi-select",
      options: ["None", "PCOS", "Hypothyroidism", "Diabetes", "Other (please specify)"],
    },
  ],
};

export type AboutMeFormData = {
  profile: Record<string, string | number | string[]>;
  habits: Record<string, string | number | string[]>;
  diet: Record<string, string | number | string[]>;
  documents: Record<string, string | number | string[]>;
  hormones?: Record<string, string | number | string[]>;
  recovery: Record<string, string | number | string[]>;
  conditions: Record<string, string | number | string[]>;
};

// Validation schemas for each section
export const profileSchema = z.object({
  height: z.string().refine(
    (val) => val === "" || (!isNaN(Number(val)) && Number(val) > 0),
    "Height must be a positive number"
  ).optional(),
  weight: z.string().refine(
    (val) => val === "" || (!isNaN(Number(val)) && Number(val) > 0),
    "Weight must be a positive number"
  ).optional(),
  waist_circumference: z.string().refine(
    (val) => val === "" || (!isNaN(Number(val)) && Number(val) > 0),
    "Waist circumference must be a positive number"
  ).optional(),
});

export const habitsSchema = z.object({
  smoking_status: z.string().min(1, "Please select a smoking status"),
  alcohol_frequency: z.string().min(1, "Please select an alcohol frequency"),
  exercise_hours: z.string().min(1, "Please select exercise hours"),
});

export const dietSchema = z.object({
  diet_type: z.string().min(1, "Please select a diet type"),
  diet_details: z.string().optional(),
});

export const documentsSchema = z.object({
  current_documents: z.string().min(1, "Please select"),
  document_details: z.string().optional(),
  hormone_therapy: z.string().min(1, "Please select"),
  hormone_therapy_details: z.string().optional(),
  thyroid_document: z.string().min(1, "Please select"),
  thyroid_document_details: z.string().optional(),
});

export const hormonesSchema = z.object({
  menstrual_status: z.string().min(1, "Please select a menstrual status"),
  cycle_day: z.string().optional(),
  hormonal_birth_control: z.string().min(1, "Please select"),
});

export const recoverySchema = z.object({
  stress_level: z.number().min(1).max(10),
  sleep_hours: z.string().min(1, "Please select sleep hours"),
});

export const conditionsSchema = z.object({
  conditions: z.array(z.string()).min(1, "Please select at least one"),
  conditions_details: z.string().optional(),
});

export const sectionSchemas: Record<string, z.ZodSchema> = {
  profile: profileSchema,
  habits: habitsSchema,
  diet: dietSchema,
  documents: documentsSchema,
  hormones: hormonesSchema,
  recovery: recoverySchema,
  conditions: conditionsSchema,
};

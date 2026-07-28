import { type VisaFormFieldRow } from "@/types/visa-form-fields";

export type FieldGuidanceSeverity = "ok" | "warning" | "error";
export type FieldGuidanceConfidence = "high" | "medium" | "low";
export type FieldGuidanceChatRole = "user" | "assistant";

export interface FieldGuidanceSource {
  title: string;
  url: string | null;
  excerpt: string;
}

export interface FieldGuidanceChatMessage {
  role: FieldGuidanceChatRole;
  content: string;
}

export interface FieldGuidanceBody {
  title: string;
  summary: string;
  examples: string[];
  optionExplanations?: FieldGuidanceOptionExplanation[];
  hints: string[];
  officialWarnings: string[];
  formatHints: string[];
}

export interface FieldGuidanceOptionExplanation {
  value: string;
  label: string;
  description: string;
}

export interface FieldGuidanceValidation {
  severity: FieldGuidanceSeverity;
  messages: string[];
}

export interface FieldGuidanceResponse {
  guidance: FieldGuidanceBody;
  validation: FieldGuidanceValidation;
  reply?: string;
  sources: FieldGuidanceSource[];
  confidence: FieldGuidanceConfidence;
  aiUsed: boolean;
  cached: boolean;
}

export interface FieldGuidanceRequest {
  visaType: string;
  country?: string | null;
  locale: string;
  field: VisaFormFieldRow;
  answer: string;
  allAnswers: Record<string, string>;
  question?: string;
  history?: FieldGuidanceChatMessage[];
}

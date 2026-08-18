import type { MissingApplicationField } from "@/lib/application-tab-completion";

export const FORM_ASSISTANT_PROVIDERS_UNAVAILABLE_CODE =
  "FORM_ASSISTANT_PROVIDERS_UNAVAILABLE" as const;

export type FormAssistantSourceKind =
  | "user_chat"
  | "universal_profile"
  | "document";

export type FormAssistantConfidence = "high" | "medium" | "low";

export interface FormAssistantAppliedPatch {
  fieldName: string;
  value: string;
  sourceKind: FormAssistantSourceKind;
  confidence: FormAssistantConfidence;
}

export interface FormAssistantSource {
  title: string;
  url: string | null;
}

export interface FormAssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface FormAssistantProgress {
  completed: number;
  total: number;
}

export interface FormAssistantTurnResponse {
  sessionId: string;
  assistantMessage: string;
  appliedPatches: FormAssistantAppliedPatch[];
  skippedConflicts: string[];
  missingFields: MissingApplicationField[];
  progress: FormAssistantProgress;
  sources: FormAssistantSource[];
  canRunFinalCheck: boolean;
}

export interface FormAssistantState extends FormAssistantTurnResponse {
  messages: FormAssistantMessage[];
  aiFilledFieldNames: string[];
  enabled: boolean;
}

export interface FormAssistantValidationIssue {
  code: string;
  fieldNames: string[];
  message: string;
  source?: FormAssistantSource;
}

export interface FormAssistantValidationResponse {
  errors: FormAssistantValidationIssue[];
  warnings: FormAssistantValidationIssue[];
  progress: FormAssistantProgress;
  missingFields?: MissingApplicationField[];
  canReview: boolean;
  validationId: string;
}

export interface FormAssistantFieldReviewIssue {
  fieldName: string;
  message: string;
  severity: "error" | "warning";
  nextFieldName: string | null;
}

export interface FormAssistantTranscriptionResponse {
  transcript: string;
  detectedLanguage?: string;
  durationMs?: number;
}

export interface FormAssistantUndoPatch {
  fieldName: string;
  value: string;
}

export interface FormAssistantUndoResult {
  fieldName: string;
  restoredValue: string | null;
  restoredSource: string | null;
}

export interface FormAssistantUndoResponse {
  restored: FormAssistantUndoResult[];
  skippedConflicts: string[];
}

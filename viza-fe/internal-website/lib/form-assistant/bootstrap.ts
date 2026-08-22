import { isFormAssistantEnabled } from "./constants";

interface FormAssistantDraftBootstrapInput {
  applicationId: string | null | undefined;
  country: string | null | undefined;
  visaType: string | null | undefined;
  hasFormSchema: boolean;
}

/**
 * The assistant is application-scoped, so a first-time DB-driven form visit
 * needs a draft before the assistant can load. Existing drafts are reused.
 */
export function shouldBootstrapFormAssistantDraft({
  applicationId,
  visaType,
  hasFormSchema,
}: FormAssistantDraftBootstrapInput): boolean {
  return !applicationId && hasFormSchema && isFormAssistantEnabled(visaType);
}

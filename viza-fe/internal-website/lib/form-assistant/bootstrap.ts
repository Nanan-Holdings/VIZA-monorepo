import { isSgArrivalCardApplication } from "@/lib/submission-queue";

interface FormAssistantDraftBootstrapInput {
  applicationId: string | null | undefined;
  country: string | null | undefined;
  visaType: string | null | undefined;
}

/**
 * The SGAC assistant is application-scoped, so a first-time form visit needs
 * a draft before the assistant can load. Existing drafts are always reused.
 */
export function shouldBootstrapFormAssistantDraft({
  applicationId,
  country,
  visaType,
}: FormAssistantDraftBootstrapInput): boolean {
  return !applicationId && isSgArrivalCardApplication(country, visaType);
}

/**
 * Applicant email mapping for POST /api/external-submission.
 *
 * Only real transitions email: a retried POST with the same statuses
 * returns null, so the applicant is not emailed twice.
 */

import type { TransitionEvent } from "./templates";

/** Which applicant email (if any) an ingest transition should send. */
export function pickExternalEmailEvent(
  payload: { externalStatus: string; resultStatus?: string | null },
  previous: { external_status: string | null; result_status: string | null },
): TransitionEvent | null {
  const result = payload.resultStatus;
  if (result && result !== previous.result_status) {
    if (result === "approved" || result === "issued") return "visa_approved";
    if (result === "rejected") return "visa_refused";
    if (result === "additional_documents_requested") return "info_requested";
    return null;
  }
  if (payload.externalStatus === previous.external_status) return null;
  if (payload.externalStatus === "submitted") return "submitted";
  if (payload.externalStatus === "action_required") return "info_requested";
  return null;
}

export function externalEmailDetail(
  event: TransitionEvent,
  reference: string | null,
  notes: string | null,
): { en: string; "zh-CN": string } | undefined {
  if (event === "submitted" && reference) {
    return {
      en: `Your government reference is ${reference}. We will email you as soon as there is a decision.`,
      "zh-CN": `官方申请编号为 ${reference}。一有结果我们会立即邮件通知您。`,
    };
  }
  if (event === "info_requested") {
    const text = notes?.trim();
    return text
      ? { en: text, "zh-CN": text }
      : {
          en: "Please open your VIZA portal to see what is needed.",
          "zh-CN": "请打开 VIZA 客户端查看需要补充的内容。",
        };
  }
  if (event === "visa_refused" && notes?.trim()) {
    return {
      en: `The reason given was: ${notes.trim()}. Reply to this email or contact VIZA support if you would like help with next steps.`,
      "zh-CN": `官方给出的原因：${notes.trim()}。如需协助了解后续步骤，请直接回复本邮件或联系 VIZA 客服。`,
    };
  }
  return undefined;
}

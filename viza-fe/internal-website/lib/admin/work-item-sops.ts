export const WORK_ITEM_STATUSES = [
  "open",
  "in_progress",
  "waiting_customer",
  "blocked",
  "resolved",
  "cancelled",
] as const;

export type WorkItemStatus = (typeof WORK_ITEM_STATUSES)[number];
export type WorkItemPriority = "p0" | "p1" | "p2" | "p3";

export interface WorkItemSop {
  kind: string;
  owningTeam: string;
  defaultPriority: WorkItemPriority;
  targetMinutes: number;
  checklist: readonly string[];
  resolutionCodes: readonly string[];
}

export const WORK_ITEM_SOPS: readonly WorkItemSop[] = [
  {
    kind: "lead_followup",
    owningTeam: "customer_support",
    defaultPriority: "p2",
    targetMinutes: 240,
    checklist: [
      "Review destination, nationality, intent, and message",
      "Assign an owner and reply through the preferred channel",
      "Qualify, convert, or record a specific loss reason",
    ],
    resolutionCodes: ["qualified", "converted", "not_eligible", "unresponsive", "duplicate"],
  },
  {
    kind: "payment_provisioning_failed",
    owningTeam: "commerce_ops",
    defaultPriority: "p1",
    targetMinutes: 30,
    checklist: [
      "Verify the commercial payment is settled and not disputed",
      "Identify the failed provisioning step and retry eligibility",
      "Confirm account, application, inbox, allocation, and runner state",
      "Notify the customer if their expected timeline changes",
    ],
    resolutionCodes: ["retried_successfully", "payment_reversed", "engineering_escalation"],
  },
  {
    kind: "document_review",
    owningTeam: "case_ops",
    defaultPriority: "p2",
    targetMinutes: 240,
    checklist: [
      "Open the submitted document in the protected viewer",
      "Check legibility, expiry, identity match, and destination rules",
      "Record an explicit acceptance or rejection reason",
      "Send the localized customer request when replacement is required",
    ],
    resolutionCodes: ["accepted", "replacement_requested", "not_required"],
  },
  {
    kind: "submission_action_required",
    owningTeam: "submission_ops",
    defaultPriority: "p1",
    targetMinutes: 30,
    checklist: [
      "Review runner evidence and the last successful step",
      "Confirm the official portal session is still valid",
      "Use takeover or an approved retry command",
      "Record the official reference or escalation outcome",
    ],
    resolutionCodes: ["takeover_completed", "retry_succeeded", "portal_unavailable", "engineering_escalation"],
  },
  {
    kind: "refund_or_dispute",
    owningTeam: "commerce_ops",
    defaultPriority: "p1",
    targetMinutes: 120,
    checklist: [
      "Verify refundable order lines and prior official-fee spend",
      "Review customer reason and supporting evidence",
      "Execute or deny through the payment workflow",
      "Confirm provider result and customer notification",
    ],
    resolutionCodes: ["refunded", "partially_refunded", "denied", "dispute_evidence_submitted"],
  },
  {
    kind: "privacy_request",
    owningTeam: "compliance",
    defaultPriority: "p1",
    targetMinutes: 1440,
    checklist: [
      "Verify requester identity and request scope",
      "Identify retention or legal-hold constraints",
      "Export, correct, or erase data through approved tooling",
      "Record evidence and send completion notice",
    ],
    resolutionCodes: ["export_delivered", "correction_completed", "erasure_completed", "retention_exception"],
  },
  {
    kind: "support_sla_risk",
    owningTeam: "customer_support",
    defaultPriority: "p2",
    targetMinutes: 30,
    checklist: [
      "Review the customer question and case history",
      "Assign an accountable owner",
      "Reply using an approved localized response",
      "Link follow-up work rather than leaving an informal note",
    ],
    resolutionCodes: ["customer_replied", "case_ops_handoff", "commerce_handoff", "duplicate"],
  },
  {
    kind: "appointment_action_required",
    owningTeam: "appointment_ops",
    defaultPriority: "p1",
    targetMinutes: 120,
    checklist: [
      "Review the appointment job, post, and customer preferences",
      "Confirm whether the action belongs to staff or the customer",
      "Complete the approved scheduling step without storing portal secrets",
      "Record confirmation evidence or a clear escalation outcome",
    ],
    resolutionCodes: ["appointment_booked", "customer_action_requested", "no_slot_available", "provider_escalation"],
  },
  {
    kind: "portal_incident",
    owningTeam: "platform_ops",
    defaultPriority: "p0",
    targetMinutes: 15,
    checklist: [
      "Confirm the failure across the canary and a second signal",
      "Pause or drain affected submissions when necessary",
      "Publish an internal incident update and customer impact",
      "Confirm recovery before resuming queued work",
    ],
    resolutionCodes: ["portal_recovered", "automation_adjusted", "false_alarm"],
  },
] as const;

export function getWorkItemSop(kind: string): WorkItemSop | undefined {
  return WORK_ITEM_SOPS.find((sop) => sop.kind === kind);
}

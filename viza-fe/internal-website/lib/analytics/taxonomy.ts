/**
 * Product event taxonomy (OBS-001), shared by the browser helper in
 * ./events.ts and the server helper in ./server.ts.
 *
 * Properties are deliberately coarse: country and visa codes, counts, document
 * type keys and outcome labels. Never add names, emails, passport numbers,
 * file names, free text or record ids here; the portal handles identity
 * documents and PostHog is a third-party processor.
 */

export const EVENT = {
  application_started: "application_started",
  documents_uploaded: "documents_uploaded",
  application_submitted: "application_submitted",
  application_result_recorded: "application_result_recorded",
  chat_assistant_used: "chat_assistant_used",
} as const;

export type EventName = (typeof EVENT)[keyof typeof EVENT];

type Code = string | null;

export interface EventProperties {
  /** An applicant created a new application. */
  application_started: {
    destination_country: Code;
    visa_type: Code;
    /** UI entry point, e.g. "destinations" or "group". */
    source: string;
  };
  /** One upload action finished; counts and type keys only, never file names. */
  documents_uploaded: {
    count: number;
    doc_types: string[];
    source: string;
  };
  /** The application left the applicant's hands: submitted for review or handed off. */
  application_submitted: {
    destination_country: Code;
    visa_type: Code;
    /** Submission mode code, e.g. "dry_run" or "live_assisted". */
    mode: string;
    /** "retry" for a resubmission, otherwise "initial". */
    intent: string;
    source: string;
  };
  /** A visa outcome was recorded for an application. */
  application_result_recorded: {
    destination_country: Code;
    visa_type: Code;
    result: string;
    source: string;
  };
  /** The applicant sent a message to an AI assistant. */
  chat_assistant_used: {
    /** "visa" (VIZA AI) or "travel" (travel planner). Never the message text. */
    assistant: string;
    source: string;
  };
}

/** Lower-case trimmed code, or null when absent. Codes only; never free text. */
export function eventCode(value: string | null | undefined): Code {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

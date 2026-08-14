export type AppointmentServiceFailureKind =
  | "unavailable"
  | "no_slots"
  | "cancellation_session_expired"
  | "generic";

export interface AppointmentServiceFailureInput {
  status?: number | null;
  rawError?: unknown;
  networkError?: unknown;
}

const UNAVAILABLE_HTTP_STATUSES = new Set([401, 403, 404, 408, 425, 429, 500, 502, 503, 504]);
const NETWORK_ERROR_PATTERN = /fetch failed|failed to fetch|econnrefused|econnreset|etimedout|etimed out|eai_again|aborterror|aborted|network error|socket hang up|terminated|failed \((?:401|403|404)\)/iu;

function rawText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    for (const key of ["message", "error", "detail"]) {
      const text = record[key];
      if (typeof text === "string") return text;
    }
  }
  return "";
}

/**
 * Classify worker failures without retaining the worker's URL or diagnostic
 * payload. The raw text is inspected only during this call and is never
 * returned to callers.
 */
export function classifyAppointmentServiceFailure(
  input: AppointmentServiceFailureInput,
): AppointmentServiceFailureKind {
  const networkText = rawText(input.networkError);
  if (input.networkError !== undefined && input.networkError !== false) {
    if (input.networkError === true || NETWORK_ERROR_PATTERN.test(networkText)) {
      return "unavailable";
    }
  }

  const text = rawText(input.rawError);
  if (/cancellation (?:session is missing or expired|button is no longer visible)/iu.test(text)) {
    return "cancellation_session_expired";
  }
  if (/no selectable .*appointment slots|no (?:appointment )?slots?\b|no appointments?(?:\s+(?:are\s+)?(?:currently\s+)?(?:available|open))?(?=$|[.!?,])|no appointment (?:times?|availability)|not available|fully booked/iu.test(text)) {
    return "no_slots";
  }
  if (NETWORK_ERROR_PATTERN.test(text)) return "unavailable";
  if (typeof input.status === "number" && UNAVAILABLE_HTTP_STATUSES.has(input.status)) {
    return "unavailable";
  }
  return "generic";
}

export function appointmentServiceFailureMessage(kind: AppointmentServiceFailureKind): string {
  switch (kind) {
    case "unavailable":
      return "The Korea appointment service is temporarily unavailable. Please try again shortly.";
    case "no_slots":
      return "No appointment times are currently available at the selected Korea visa application center.";
    case "cancellation_session_expired":
      return "The official cancellation session expired. Start the cancellation query again.";
    case "generic":
      return "The Korea appointment service could not complete this request safely. Please try again.";
  }
}

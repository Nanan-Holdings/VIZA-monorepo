import "server-only";

import { sha256Hex, enqueueResilienceEvent, getResilienceCache, putResilienceCache } from "./gateway";

export const APPLICATION_ANSWERS_SCOPE = "application_answers";
export const APPLICATION_ANSWERS_EVENT = "application_answers.v1";

export interface ApplicationAnswersEvent {
  version: 1;
  applicantId: string;
  applicationId: string;
  answers: Record<string, string>;
  savedAt: string;
}

export function isResilienceEligibleError(error: unknown): boolean {
  const name = error instanceof Error ? error.name : "";
  const message = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();
  return (
    name === "AbortError" ||
    name === "TimeoutError" ||
    name === "SupabaseCircuitOpenError" ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("econnreset") ||
    message.includes("circuit open") ||
    message.includes("pgrst002") ||
    message.includes("schema cache") ||
    message.includes("gateway timeout")
  );
}

function canonicalAnswers(answers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(answers).sort(([left], [right]) => left.localeCompare(right)));
}

export async function queueApplicationAnswers(event: ApplicationAnswersEvent): Promise<void> {
  const answers = canonicalAnswers(event.answers);
  const digest = sha256Hex(JSON.stringify({
    applicantId: event.applicantId,
    applicationId: event.applicationId,
    answers,
    savedAt: event.savedAt,
  }));
  await enqueueResilienceEvent({
    idempotencyKey: `application-answers:${event.applicationId}:${digest}`,
    userRef: event.applicantId,
    scope: APPLICATION_ANSWERS_SCOPE,
    eventType: APPLICATION_ANSWERS_EVENT,
    value: { ...event, answers },
  });
  let cachedAnswers: Record<string, string> = {};
  try {
    cachedAnswers = (
      await loadCachedApplicationAnswers(event.applicantId, event.applicationId)
    )?.answers ?? {};
  } catch {
    // The write remains durable in the outbox even if the read cache cannot be
    // refreshed. Do not convert a successful enqueue into a failed autosave.
  }
  const mergedAnswers = { ...cachedAnswers };
  for (const [fieldName, value] of Object.entries(answers)) {
    if (value.trim() === "") delete mergedAnswers[fieldName];
    else mergedAnswers[fieldName] = value;
  }
  await putResilienceCache({
    userRef: event.applicantId,
    scope: APPLICATION_ANSWERS_SCOPE,
    key: event.applicationId,
    value: { ...event, answers: mergedAnswers },
    ttlSeconds: 30 * 24 * 60 * 60,
  });
}

export async function cacheApplicationAnswers(event: ApplicationAnswersEvent): Promise<void> {
  await putResilienceCache({
    userRef: event.applicantId,
    scope: APPLICATION_ANSWERS_SCOPE,
    key: event.applicationId,
    value: { ...event, answers: canonicalAnswers(event.answers) },
    ttlSeconds: 30 * 24 * 60 * 60,
  });
}

export async function loadCachedApplicationAnswers(
  applicantId: string,
  applicationId: string,
): Promise<ApplicationAnswersEvent | null> {
  return getResilienceCache<ApplicationAnswersEvent>({
    userRef: applicantId,
    scope: APPLICATION_ANSWERS_SCOPE,
    key: applicationId,
  });
}

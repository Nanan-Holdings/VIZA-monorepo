/** Keep the current failure when an existing draft is routed to recovery. */
export function withDs160RecoveryFailure(
  previous: Record<string, unknown> | null | undefined,
  error: unknown,
  runId: string,
  sensitiveValues: readonly string[] = [],
): Record<string, unknown> {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const redact = (value: unknown): string => {
    let text = typeof value === "string" ? value : "Unknown CEAC failure";
    for (const secret of sensitiveValues.filter(value => value.length >= 4).sort((a, b) => b.length - a.length)) {
      text = text.split(secret).join("[redacted]");
    }
    return text
      .replace(/(?:https?|wss?):\/\/[^\s<>"'`]+/gi, "[redacted-url]")
      .replace(/\bAA[0-9A-Z]{8}\b/g, "[redacted-id]")
      .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "[redacted-email]")
      .replace(/(["'`])[^\n]*?\1/g, "[redacted-value]")
      .slice(0, 1600);
  };
  const name = redact(error instanceof Error ? error.name : record.name ?? "Error");
  const message = redact(error instanceof Error ? error.message : record.message ?? error);
  const recoveryMetadata = { ...(previous ?? {}) };
  for (const key of ["reason", "error", "currentFailure", "stack", "context", "gateContext"]) {
    delete recoveryMetadata[key];
  }
  return {
    ...recoveryMetadata,
    status: "action_required",
    reason: message,
    error: { name, message },
    currentFailure: { runId, name, message, recordedAt: new Date().toISOString() },
  };
}

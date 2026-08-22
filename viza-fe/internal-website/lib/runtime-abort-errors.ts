export function isIgnorableRuntimeAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error && error.name === "AbortError") return true;

  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.trim().toLowerCase();
  return (
    normalized === "aborted" ||
    normalized.includes("signal is aborted") ||
    normalized.includes("operation was aborted")
  );
}

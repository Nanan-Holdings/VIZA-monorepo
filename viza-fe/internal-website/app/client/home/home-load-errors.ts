export function isIgnorableDashboardLoadError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error && error.name === "AbortError") return true;

  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes("signal is aborted");
}

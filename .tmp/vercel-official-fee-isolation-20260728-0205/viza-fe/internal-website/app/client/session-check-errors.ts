import { isIgnorableRuntimeAbortError } from "@/lib/runtime-abort-errors";

export function isIgnorableClientSessionCheckError(error: unknown): boolean {
  if (isIgnorableRuntimeAbortError(error)) return true;
  if (!(error instanceof Error)) return false;

  return error instanceof TypeError && error.message.toLowerCase().includes("failed to fetch");
}

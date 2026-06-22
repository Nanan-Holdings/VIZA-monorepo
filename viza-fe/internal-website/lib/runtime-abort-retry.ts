import { isIgnorableRuntimeAbortError } from "@/lib/runtime-abort-errors";

export async function withRuntimeAbortRetry<T>(
  operation: () => Promise<T>,
  options: { retries?: number; delayMs?: number } = {},
): Promise<T> {
  const retries = options.retries ?? 1;
  const delayMs = options.delayMs ?? 100;

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isIgnorableRuntimeAbortError(error) || attempt >= retries) throw error;
      await new Promise((resolve) => globalThis.setTimeout(resolve, delayMs));
    }
  }
}

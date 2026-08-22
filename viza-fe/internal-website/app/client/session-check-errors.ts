import { isIgnorableRuntimeAbortError } from "@/lib/runtime-abort-errors";

export class UnexpectedClientSessionResponseError extends Error {
  constructor() {
    super("Client session check returned a non-JSON response");
    this.name = "UnexpectedClientSessionResponseError";
  }
}

export async function parseClientSessionResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    throw new UnexpectedClientSessionResponseError();
  }

  try {
    return await response.json();
  } catch {
    throw new UnexpectedClientSessionResponseError();
  }
}

export function isIgnorableClientSessionCheckError(error: unknown): boolean {
  if (isIgnorableRuntimeAbortError(error)) return true;
  if (error instanceof UnexpectedClientSessionResponseError) return true;
  if (!(error instanceof Error)) return false;

  return error instanceof TypeError && error.message.toLowerCase().includes("failed to fetch");
}

/* Vendored from Kelin-Studio/kelin-social@9cf1e11 (src/http.ts). Edit there and re-sync. */
import { SocialError, type Network } from "./types";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type Http = {
  fetch: FetchLike;
  /** Milliseconds to wait between status polls. Tests set it to 0. */
  pollMs: number;
};

export const defaultHttp: Http = { fetch: (input, init) => fetch(input, init), pollMs: 2000 };

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Graph-style error bodies: Meta and Threads both send { error: { message, code } }.
    X sends { title, detail } or { errors: [{ message }] }, LinkedIn { message }. */
function describe(body: unknown): { message: string; code: string | null } {
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    const err = b.error as Record<string, unknown> | undefined;
    if (err && typeof err === "object") {
      const sub = err.error_user_msg ?? err.message;
      return {
        message: String(sub ?? "request failed"),
        code: err.code != null ? String(err.code) + (err.error_subcode != null ? `/${err.error_subcode}` : "") : null,
      };
    }
    /* LinkedIn: { message, status, serviceErrorCode }. */
    if (typeof b.message === "string") {
      return { message: b.message, code: b.serviceErrorCode != null ? String(b.serviceErrorCode) : null };
    }
    if (typeof b.detail === "string") return { message: b.detail, code: typeof b.title === "string" ? b.title : null };
    const errors = b.errors as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(errors) && errors[0]) {
      return { message: String(errors[0].message ?? errors[0].detail ?? "request failed"), code: errors[0].code != null ? String(errors[0].code) : null };
    }
  }
  return { message: typeof body === "string" && body ? body.slice(0, 300) : "request failed", code: null };
}

export async function requestJson<T = Record<string, unknown>>(
  http: Http,
  network: Network,
  url: string,
  init: RequestInit = {},
  timeoutMs = 30000,
): Promise<T> {
  let res: Response;
  try {
    res = await http.fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    throw new SocialError(network, `no answer (${err instanceof Error ? err.message : String(err)})`, null, true);
  }
  const raw = await res.text();
  let body: unknown = raw;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    /* Keep the text: some errors come back as HTML. */
  }
  if (!res.ok) {
    const { message, code } = describe(body);
    const retryable = res.status === 429 || res.status >= 500;
    throw new SocialError(network, message, res.status, retryable, code);
  }
  return body as T;
}

/** Meta's Graph API takes parameters as a form body on POST. */
export function form(params: Record<string, string | undefined>): URLSearchParams {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") out.set(k, v);
  return out;
}

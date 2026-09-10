const MAX_BODY_BYTES = 16 * 1024;
const MAX_REPORTS_PER_REQUEST = 20;
const MAX_REQUESTS_PER_WINDOW = 60;
const RATE_WINDOW_MS = 60_000;
const MAX_AGGREGATE_KEYS = 128;

type BlockedKind = "self" | "external" | "inline" | "eval" | "data" | "blob" | "unknown";

export interface SafeCspAggregate {
  directive: string;
  blockedKind: BlockedKind;
  disposition: "enforce" | "report" | "unknown";
  count: number;
}

interface CollectorOptions {
  now?: () => number;
  log?: (summary: { accepted: number; aggregates: SafeCspAggregate[] }) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function response(status: number, headers: Record<string, string> = {}): Response {
  return new Response(null, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Cross-Origin-Resource-Policy": "same-origin",
      ...headers,
    },
  });
}

async function readBoundedBody(request: Request): Promise<string> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new RangeError("body_too_large");
  }
  if (!request.body) return "";

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let body = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new RangeError("body_too_large");
      }
      body += decoder.decode(value, { stream: true });
    }
    return body + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function reportBodies(payload: unknown): Record<string, unknown>[] {
  const envelopes = Array.isArray(payload) ? payload.slice(0, MAX_REPORTS_PER_REQUEST) : [payload];
  const reports: Record<string, unknown>[] = [];
  for (const envelope of envelopes) {
    if (!isRecord(envelope)) continue;
    const legacy = envelope["csp-report"];
    if (isRecord(legacy)) {
      reports.push(legacy);
      continue;
    }
    if (envelope.type === "csp-violation" && isRecord(envelope.body)) reports.push(envelope.body);
  }
  return reports;
}

function safeDirective(value: unknown): string {
  if (typeof value !== "string") return "unknown";
  const normalized = value.trim().toLowerCase();
  return /^[a-z][a-z0-9-]{0,63}$/.test(normalized) ? normalized : "unknown";
}

function classifyBlocked(value: unknown, collectorOrigin: string): BlockedKind {
  if (typeof value !== "string") return "unknown";
  const normalized = value.trim().toLowerCase();
  if (normalized === "inline" || normalized === "'inline'") return "inline";
  if (normalized === "eval" || normalized === "'eval'") return "eval";
  if (normalized.startsWith("data:")) return "data";
  if (normalized.startsWith("blob:")) return "blob";
  try {
    return new URL(value).origin === collectorOrigin ? "self" : "external";
  } catch {
    return "unknown";
  }
}

function safeDisposition(value: unknown): SafeCspAggregate["disposition"] {
  return value === "enforce" || value === "report" ? value : "unknown";
}

function explicitCrossOrigin(request: Request): boolean {
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  if (origin && origin !== requestOrigin) return true;
  const fetchSite = request.headers.get("sec-fetch-site");
  return Boolean(fetchSite && fetchSite !== "same-origin" && fetchSite !== "none");
}

export function createCspReportCollector(options: CollectorOptions = {}) {
  const now = options.now ?? Date.now;
  const log = options.log ?? ((summary) => console.info("[csp-report]", summary));
  let windowStartedAt = now();
  let requestsInWindow = 0;
  const aggregates = new Map<string, SafeCspAggregate>();

  return {
    snapshot(): SafeCspAggregate[] {
      return [...aggregates.values()].map((aggregate) => ({ ...aggregate }));
    },

    async handle(request: Request): Promise<Response> {
      if (explicitCrossOrigin(request)) return response(403);

      const currentTime = now();
      if (currentTime - windowStartedAt >= RATE_WINDOW_MS) {
        windowStartedAt = currentTime;
        requestsInWindow = 0;
      }
      requestsInWindow += 1;
      if (requestsInWindow > MAX_REQUESTS_PER_WINDOW) {
        return response(429, { "Retry-After": "60" });
      }

      const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
      if (!contentType || !["application/csp-report", "application/reports+json", "application/json"].includes(contentType)) {
        return response(415);
      }

      let payload: unknown;
      try {
        payload = JSON.parse(await readBoundedBody(request));
      } catch (error) {
        return response(error instanceof RangeError ? 413 : 400);
      }

      const bodies = reportBodies(payload);
      if (bodies.length === 0) return response(400);

      const requestAggregates = new Map<string, SafeCspAggregate>();
      const collectorOrigin = new URL(request.url).origin;
      for (const body of bodies) {
        const directive = safeDirective(body["effective-directive"] ?? body.effectiveDirective ?? body["violated-directive"]);
        const blockedKind = classifyBlocked(body["blocked-uri"] ?? body.blockedURL ?? body.blockedUrl, collectorOrigin);
        const disposition = safeDisposition(body.disposition);
        let key = `${directive}:${blockedKind}:${disposition}`;
        let dimensions = { directive, blockedKind, disposition };
        if (!aggregates.has(key) && aggregates.size >= MAX_AGGREGATE_KEYS - 1) {
          key = "unknown:unknown:unknown";
          dimensions = { directive: "unknown", blockedKind: "unknown", disposition: "unknown" };
        }
        const existing = aggregates.get(key) ?? { ...dimensions, count: 0 };
        existing.count += 1;
        aggregates.set(key, existing);

        const requestExisting = requestAggregates.get(key) ?? { ...existing, count: 0 };
        requestExisting.count += 1;
        requestAggregates.set(key, requestExisting);
      }

      log({ accepted: bodies.length, aggregates: [...requestAggregates.values()] });
      return response(204);
    },
  };
}

const LIMITS = {
  bodyBytes: 16 * 1024,
  reports: 20,
  requests: 60,
  windowMs: 60_000,
  aggregateKeys: 128,
} as const;

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

function emptyResponse(status: number, headers: Record<string, string> = {}): Response {
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
  if (Number.isFinite(declaredLength) && declaredLength > LIMITS.bodyBytes) throw new RangeError("body_too_large");
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
      if (size > LIMITS.bodyBytes) {
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
  const envelopes = Array.isArray(payload) ? payload.slice(0, LIMITS.reports) : [payload];
  return envelopes.flatMap((envelope) => {
    if (!isRecord(envelope)) return [];
    if (isRecord(envelope["csp-report"])) return [envelope["csp-report"]];
    return envelope.type === "csp-violation" && isRecord(envelope.body) ? [envelope.body] : [];
  });
}

function directive(value: unknown): string {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^[a-z][a-z0-9-]{0,63}$/.test(normalized) ? normalized : "unknown";
}

function blockedKind(value: unknown, collectorOrigin: string): BlockedKind {
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

function disposition(value: unknown): SafeCspAggregate["disposition"] {
  return value === "enforce" || value === "report" ? value : "unknown";
}

function isExplicitlyCrossOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return true;
  const fetchSite = request.headers.get("sec-fetch-site");
  return Boolean(fetchSite && fetchSite !== "same-origin" && fetchSite !== "none");
}

export function createCspReportCollector(options: CollectorOptions = {}) {
  const now = options.now ?? Date.now;
  const log = options.log ?? ((summary) => console.info("[csp-report]", summary));
  let windowStartedAt = now();
  let requests = 0;
  const aggregates = new Map<string, SafeCspAggregate>();

  return {
    snapshot: () => [...aggregates.values()].map((aggregate) => ({ ...aggregate })),
    async handle(request: Request): Promise<Response> {
      if (isExplicitlyCrossOrigin(request)) return emptyResponse(403);
      const currentTime = now();
      if (currentTime - windowStartedAt >= LIMITS.windowMs) {
        windowStartedAt = currentTime;
        requests = 0;
      }
      requests += 1;
      if (requests > LIMITS.requests) return emptyResponse(429, { "Retry-After": "60" });

      const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
      if (!contentType || !["application/csp-report", "application/reports+json", "application/json"].includes(contentType)) {
        return emptyResponse(415);
      }

      let payload: unknown;
      try {
        payload = JSON.parse(await readBoundedBody(request));
      } catch (error) {
        return emptyResponse(error instanceof RangeError ? 413 : 400);
      }
      const bodies = reportBodies(payload);
      if (bodies.length === 0) return emptyResponse(400);

      const requestAggregates = new Map<string, SafeCspAggregate>();
      const collectorOrigin = new URL(request.url).origin;
      for (const body of bodies) {
        const safe = {
          directive: directive(body["effective-directive"] ?? body.effectiveDirective ?? body["violated-directive"]),
          blockedKind: blockedKind(body["blocked-uri"] ?? body.blockedURL ?? body.blockedUrl, collectorOrigin),
          disposition: disposition(body.disposition),
        };
        let key = `${safe.directive}:${safe.blockedKind}:${safe.disposition}`;
        let dimensions = safe;
        if (!aggregates.has(key) && aggregates.size >= LIMITS.aggregateKeys - 1) {
          key = "unknown:unknown:unknown";
          dimensions = { directive: "unknown", blockedKind: "unknown", disposition: "unknown" };
        }
        const aggregate = aggregates.get(key) ?? { ...dimensions, count: 0 };
        aggregate.count += 1;
        aggregates.set(key, aggregate);
        const current = requestAggregates.get(key) ?? { ...aggregate, count: 0 };
        current.count += 1;
        requestAggregates.set(key, current);
      }
      log({ accepted: bodies.length, aggregates: [...requestAggregates.values()] });
      return emptyResponse(204);
    },
  };
}

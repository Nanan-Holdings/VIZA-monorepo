import "server-only";

export type PublicMonitorStatus = "ok" | "degraded" | "down" | "unknown";

export interface PublicStatusDay {
  date: string;
  status: PublicMonitorStatus;
  uptime: number | null;
  checks: number;
}

export interface PublicStatusMonitor {
  id: string;
  type: "platform" | "government_portal";
  code: string | null;
  name: { en: string; "zh-CN": string };
  description: { en: string; "zh-CN": string };
  status: PublicMonitorStatus;
  lastCheckedAt: string | null;
  latencyMs: number | null;
  uptime90d: number | null;
  days: PublicStatusDay[];
}

export interface PublicStatusIncident {
  id: string;
  monitorId: string;
  status: "investigating" | "monitoring" | "resolved";
  severity: "degraded" | "down";
  startedAt: string;
  resolvedAt: string | null;
  lastObservedAt: string;
  summary: { en: string; "zh-CN": string };
}

export interface PublicStatusSnapshot {
  version: 1;
  generatedAt: string;
  probeIntervalSeconds: number;
  staleAfterSeconds: number;
  summary: {
    status: "operational" | "degraded" | "major_outage" | "unknown";
    monitored: number;
    operational: number;
    activeIncidents: number;
    uptime90d: number | null;
  };
  monitors: PublicStatusMonitor[];
  incidents: PublicStatusIncident[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDay(value: unknown): value is PublicStatusDay {
  if (!isRecord(value)) return false;
  return typeof value.date === "string"
    && ["ok", "degraded", "down", "unknown"].includes(String(value.status))
    && (typeof value.uptime === "number" || value.uptime === null)
    && typeof value.checks === "number";
}

function isMonitor(value: unknown): value is PublicStatusMonitor {
  if (!isRecord(value) || !isRecord(value.name) || !isRecord(value.description)) return false;
  return typeof value.id === "string"
    && (value.type === "platform" || value.type === "government_portal")
    && (typeof value.code === "string" || value.code === null)
    && typeof value.name.en === "string"
    && typeof value.name["zh-CN"] === "string"
    && typeof value.description.en === "string"
    && typeof value.description["zh-CN"] === "string"
    && ["ok", "degraded", "down", "unknown"].includes(String(value.status))
    && (typeof value.lastCheckedAt === "string" || value.lastCheckedAt === null)
    && (typeof value.latencyMs === "number" || value.latencyMs === null)
    && (typeof value.uptime90d === "number" || value.uptime90d === null)
    && Array.isArray(value.days)
    && value.days.every(isDay);
}

function isIncident(value: unknown): value is PublicStatusIncident {
  if (!isRecord(value) || !isRecord(value.summary)) return false;
  return typeof value.id === "string"
    && typeof value.monitorId === "string"
    && ["investigating", "monitoring", "resolved"].includes(String(value.status))
    && (value.severity === "degraded" || value.severity === "down")
    && typeof value.startedAt === "string"
    && (typeof value.resolvedAt === "string" || value.resolvedAt === null)
    && typeof value.lastObservedAt === "string"
    && typeof value.summary.en === "string"
    && typeof value.summary["zh-CN"] === "string";
}

export function isPublicStatusSnapshot(value: unknown): value is PublicStatusSnapshot {
  if (!isRecord(value) || !isRecord(value.summary)) return false;
  return value.version === 1
    && typeof value.generatedAt === "string"
    && typeof value.probeIntervalSeconds === "number"
    && typeof value.staleAfterSeconds === "number"
    && ["operational", "degraded", "major_outage", "unknown"].includes(String(value.summary.status))
    && typeof value.summary.monitored === "number"
    && typeof value.summary.operational === "number"
    && typeof value.summary.activeIncidents === "number"
    && (typeof value.summary.uptime90d === "number" || value.summary.uptime90d === null)
    && Array.isArray(value.monitors)
    && value.monitors.every(isMonitor)
    && Array.isArray(value.incidents)
    && value.incidents.every(isIncident);
}

export function unavailableStatusSnapshot(): PublicStatusSnapshot {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    probeIntervalSeconds: 300,
    staleAfterSeconds: 900,
    summary: {
      status: "unknown",
      monitored: 0,
      operational: 0,
      activeIncidents: 0,
      uptime90d: null,
    },
    monitors: [],
    incidents: [],
  };
}

export async function getPublicStatusSnapshot(options?: { noStore?: boolean }): Promise<PublicStatusSnapshot> {
  const baseUrl = (
    process.env.AGENT_BACKEND_URL
    ?? process.env.NEXT_PUBLIC_AGENT_BACKEND_URL
    ?? "http://localhost:3002"
  ).replace(/\/$/, "");
  try {
    const response = await fetch(`${baseUrl}/api/public/status`, {
      headers: { Accept: "application/json" },
      cache: options?.noStore ? "no-store" : undefined,
      next: options?.noStore ? undefined : { revalidate: 60 },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return unavailableStatusSnapshot();
    const payload: unknown = await response.json();
    return isPublicStatusSnapshot(payload) ? payload : unavailableStatusSnapshot();
  } catch {
    return unavailableStatusSnapshot();
  }
}

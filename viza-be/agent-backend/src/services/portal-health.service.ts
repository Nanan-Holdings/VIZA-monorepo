import { getSupabaseClient } from "../db/supabase-client.js";
import { Logger } from "../utils/logger.js";

const logger = new Logger({ serviceName: "PortalHealthService" });
const DEFAULT_TIMEOUT_MS = 15_000;
const FAST_THRESHOLD_MS = 5_000;
const PROBE_CONCURRENCY = 5;

export type PortalProbeStatus = "ok" | "degraded" | "down" | "unknown";

interface MonitorRow {
  country: string;
  probe_url: string | null;
}

export interface PortalProbeResult {
  monitorKey: string;
  status: Exclude<PortalProbeStatus, "unknown">;
  httpStatus: number | null;
  latencyMs: number;
  note: string;
  errorCode: string | null;
  checkedAt: string;
}

export interface PortalProbeRunSummary {
  startedAt: string;
  finishedAt: string;
  checked: number;
  operational: number;
  degraded: number;
  down: number;
  persistenceFailures: number;
}

export function classifyPortalProbe(httpStatus: number, latencyMs: number): PortalProbeResult["status"] {
  if (httpStatus >= 500) return "down";
  if (httpStatus >= 300 || latencyMs > FAST_THRESHOLD_MS) return "degraded";
  return "ok";
}

function probeTimeoutMs(): number {
  const configured = Number(process.env.STATUS_PROBE_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(configured)) return DEFAULT_TIMEOUT_MS;
  return Math.min(30_000, Math.max(2_000, Math.floor(configured)));
}

function errorCodeFor(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") return "timeout";
  if (error instanceof TypeError) return "network_error";
  return "probe_error";
}

function isAllowedProbeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const privateIpv4 = /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/;
    return url.protocol === "https:"
      && hostname !== "localhost"
      && hostname !== "::1"
      && !hostname.endsWith(".local")
      && !privateIpv4.test(hostname);
  } catch {
    return false;
  }
}

async function probeMonitor(row: MonitorRow): Promise<PortalProbeResult> {
  const checkedAt = new Date().toISOString();
  if (!row.probe_url || !isAllowedProbeUrl(row.probe_url)) {
    return {
      monitorKey: row.country,
      status: "down",
      httpStatus: null,
      latencyMs: 0,
      note: "Probe URL is missing or not allowed",
      errorCode: "invalid_probe_url",
      checkedAt,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), probeTimeoutMs());
  const started = Date.now();
  try {
    const response = await fetch(row.probe_url, {
      method: "GET",
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/json;q=0.8,*/*;q=0.5",
        "User-Agent": "Mozilla/5.0 (compatible; VIZA-Status/1.0; +https://viza.it.com/status)",
      },
      signal: controller.signal,
    });
    const latencyMs = Date.now() - started;
    await response.body?.cancel().catch(() => undefined);
    return {
      monitorKey: row.country,
      status: classifyPortalProbe(response.status, latencyMs),
      httpStatus: response.status,
      latencyMs,
      note: `HTTP ${response.status} in ${latencyMs}ms`,
      errorCode: null,
      checkedAt,
    };
  } catch (error) {
    const latencyMs = Date.now() - started;
    const errorCode = errorCodeFor(error);
    return {
      monitorKey: row.country,
      status: "down",
      httpStatus: null,
      latencyMs,
      note: errorCode === "timeout" ? "Probe timed out" : "Probe request failed",
      errorCode,
      checkedAt,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  fn: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await fn(values[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => worker()),
  );
  return results;
}

export async function getPublicPortalStatus(): Promise<unknown> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("get_public_portal_status", { p_days: 90 });
  if (error) throw new Error(`Public status snapshot failed: ${error.message}`);
  if (!data || typeof data !== "object") throw new Error("Public status snapshot was empty");
  return data;
}

export async function runPortalHealthProbes(): Promise<PortalProbeRunSummary> {
  const startedAt = new Date().toISOString();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("portal_health")
    .select("country, probe_url")
    .eq("public_visible", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`Portal monitor list failed: ${error.message}`);

  const rows = (data ?? []) as MonitorRow[];
  const results = await mapWithConcurrency(rows, PROBE_CONCURRENCY, probeMonitor);
  let persistenceFailures = 0;

  await mapWithConcurrency(results, PROBE_CONCURRENCY, async (result) => {
    const { error: recordError } = await supabase.rpc("record_portal_health_check", {
      p_monitor_key: result.monitorKey,
      p_status: result.status,
      p_http_status: result.httpStatus,
      p_latency_ms: result.latencyMs,
      p_note: result.note,
      p_error_code: result.errorCode,
      p_checked_at: result.checkedAt,
      p_source: "scheduled_probe",
    });
    if (recordError) {
      persistenceFailures += 1;
      logger.error("portal_health_record_failed", new Error(recordError.message), {
        monitorKey: result.monitorKey,
        status: result.status,
      });
    }
  });

  const summary: PortalProbeRunSummary = {
    startedAt,
    finishedAt: new Date().toISOString(),
    checked: results.length,
    operational: results.filter((result) => result.status === "ok").length,
    degraded: results.filter((result) => result.status === "degraded").length,
    down: results.filter((result) => result.status === "down").length,
    persistenceFailures,
  };
  logger.info("portal_health_probe_completed", { ...summary });
  return summary;
}

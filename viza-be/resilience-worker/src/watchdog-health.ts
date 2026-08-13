export type Probe = { ok: boolean; transient: boolean; status: number | null; latencyMs: number };
export type ProbeResult = { auth: Probe; rest: Probe; control: Probe; healthy: boolean };
export type ScheduledStatus = { at: number; ok: boolean; errorCode: string | null };
export type StoredProbe = { at: number; probe: ProbeResult };

export const MAX_PROBE_AGE_MS = 3 * 60 * 1_000;
export const PRODUCTION_PROJECT_REF = "oyjxdzsoejraedqghndi";

export function validateWatchdogConfiguration(
  supabaseUrl: string,
  projectRef: string,
  anonKey: string,
): { ok: true; baseUrl: string } | { ok: false; reason: string } {
  const baseUrl = supabaseUrl.trim().replace(/\/$/u, "");
  const ref = projectRef.trim();
  if (!baseUrl || !ref || !anonKey.trim()) return { ok: false, reason: "watchdog_probe_configuration_invalid" };
  if (ref !== PRODUCTION_PROJECT_REF) return { ok: false, reason: "project_ref_not_allowlisted" };

  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    return { ok: false, reason: "SUPABASE_URL_invalid" };
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== `${PRODUCTION_PROJECT_REF}.supabase.co` ||
    (parsed.pathname !== "" && parsed.pathname !== "/") ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    parsed.search ||
    parsed.hash
  ) {
    return { ok: false, reason: "watchdog_probe_configuration_invalid" };
  }
  return { ok: true, baseUrl: `https://${parsed.hostname}` };
}

export function isTransientProbeStatus(status: number): boolean {
  // 429 is a rate-limit signal, not proof that the database data plane is down.
  return status === 408 || status >= 500;
}

export function isAllowedManagementProjectResponse(body: unknown): body is { ref?: string; status: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const candidate = body as { ref?: unknown; status?: unknown };
  return typeof candidate.status === "string" && (candidate.ref === undefined || candidate.ref === PRODUCTION_PROJECT_REF);
}

export function evaluateHealth(
  lastProbe: unknown,
  scheduledStatus: ScheduledStatus | null,
  now: number,
): { ok: boolean; probeFresh: boolean; probeHealthy: boolean; scheduledOk: boolean; probeAgeMs: number | null } {
  const candidate = lastProbe && typeof lastProbe === "object" && !Array.isArray(lastProbe)
    ? lastProbe as Partial<StoredProbe>
    : null;
  const probeAt = typeof candidate?.at === "number" && Number.isFinite(candidate.at) ? candidate.at : null;
  const probeAgeMs = probeAt === null ? null : Math.max(0, now - probeAt);
  const probeFresh = probeAt !== null && now - probeAt <= MAX_PROBE_AGE_MS;
  const probeHealthy = candidate?.probe?.healthy === true;
  const scheduledOk = scheduledStatus === null || scheduledStatus.ok === true;
  return { ok: probeFresh && probeHealthy && scheduledOk, probeFresh, probeHealthy, scheduledOk, probeAgeMs };
}

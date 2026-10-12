import type { PublicStatusSnapshot } from "./public-status";

export type PublicStatusReadinessReason =
  | "ready"
  | "configuration_missing"
  | "upstream_unavailable"
  | "invalid_payload"
  | "no_fresh_evidence";

export function resolvePublicStatusBaseUrl(env: NodeJS.ProcessEnv): string | null {
  const configured = (env.AGENT_BACKEND_URL ?? env.NEXT_PUBLIC_AGENT_BACKEND_URL)?.trim();
  const candidate = configured || (env.NODE_ENV === "production" ? null : "http://localhost:3002");
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    if (env.NODE_ENV === "production" && url.protocol !== "https:") return null;
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function hasFreshPublicStatusEvidence(
  snapshot: PublicStatusSnapshot,
  nowMs = Date.now(),
): boolean {
  if (snapshot.summary.monitored <= 0 || snapshot.monitors.length <= 0 || snapshot.summary.status === "unknown") {
    return false;
  }
  const staleAfterMs = snapshot.staleAfterSeconds * 1_000;
  return snapshot.monitors.some((monitor) => {
    if (!monitor.lastCheckedAt || monitor.status === "unknown") return false;
    const checkedAt = Date.parse(monitor.lastCheckedAt);
    return Number.isFinite(checkedAt) && nowMs - checkedAt <= staleAfterMs;
  });
}

export function publicStatusHttpStatus(ready: boolean): 200 | 503 {
  return ready ? 200 : 503;
}

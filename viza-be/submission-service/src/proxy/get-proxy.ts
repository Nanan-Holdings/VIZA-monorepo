import { randomBytes } from "node:crypto";
import { supabase } from "../supabase.js";
import { resolveEgressCountry } from "./country-overrides.js";

/**
 * Bright Data residential proxy session helper (INFRA-004).
 *
 * `getProxyForApplicant(applicantId, country, ctx)` returns a sticky
 * session pinned to the applicant + country combination. Pass the
 * result straight to Playwright's `proxy: { server, username, password }`
 * launch option.
 *
 * Sticky-session token:
 *   `viza-${countrySlug}-${applicantPrefix}-${sessionId}`
 *
 * Same applicant + same country reuses the same upstream IP for
 * `stickyMinutes`; a different country (e.g. the applicant has two
 * applications in flight) gets a new session. This is what we want —
 * a portal complaining about "your VN session and your KR session
 * came from the same IP" is exactly the failure we are trying to
 * avoid.
 */

export interface ProxyContext {
  workerId?: string;
  jobId?: string;
  /** Sticky duration. Default 30 minutes. */
  stickyMinutes?: number;
}

export interface ProxyConnection {
  /** `host:port` for Playwright `proxy.server`. */
  server: string;
  username: string;
  password: string;
  /** The sticky-session id we minted; lands on artefact metadata. */
  sessionId: string;
  brightDataCountry: string;
  city: string | null;
  stickyMinutes: number;
  reason: string | null;
}

function getEnvOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`[proxy] env not set: ${name}`);
  return v;
}

function applicantSlug(applicantId: string): string {
  return applicantId.replace(/-/g, "").slice(0, 12);
}

function freshSessionToken(): string {
  return randomBytes(8).toString("hex");
}

export async function getProxyForApplicant(
  applicantId: string,
  country: string,
  ctx: ProxyContext = {},
): Promise<ProxyConnection> {
  const host = getEnvOrThrow("BRIGHTDATA_PROXY_HOST");
  const port = getEnvOrThrow("BRIGHTDATA_PROXY_PORT");
  const baseUser = getEnvOrThrow("BRIGHTDATA_USERNAME");
  const password = getEnvOrThrow("BRIGHTDATA_PASSWORD");
  const stickyMinutes = ctx.stickyMinutes ?? 30;

  const geo = resolveEgressCountry(country);
  const sessionId = `viza-${geo.brightDataCountry}-${applicantSlug(applicantId)}-${freshSessionToken()}`;

  // Bright Data username convention: -country-XX-session-<id>-session_duration-<m>.
  // We append city when an override pins to a specific PoP.
  const userParts: string[] = [baseUser];
  userParts.push(`country-${geo.brightDataCountry}`);
  if (geo.city) userParts.push(`city-${geo.city}`);
  userParts.push(`session-${sessionId}`);
  userParts.push(`session_duration-${stickyMinutes}`);
  const username = userParts.join("-");

  // Artefact registration: stamp the runner_job row metadata so we
  // can later trace which session id paired with which job. Worker
  // tolerance: a logger failure must not block the runner.
  if (ctx.jobId) {
    void registerProxyOnJob(ctx.jobId, {
      provider: "brightdata",
      country,
      session_id: sessionId,
      city: geo.city ?? null,
      sticky_minutes: stickyMinutes,
      worker_id: ctx.workerId ?? null,
      override_reason: geo.override?.reason ?? null,
    });
  }

  return {
    server: `http://${host}:${port}`,
    username,
    password,
    sessionId,
    brightDataCountry: geo.brightDataCountry,
    city: geo.city ?? null,
    stickyMinutes,
    reason: geo.override?.reason ?? null,
  };
}

async function registerProxyOnJob(
  jobId: string,
  proxy: Record<string, unknown>,
): Promise<void> {
  try {
    const { data: job, error: readErr } = await supabase
      .from("runner_job")
      .select("metadata")
      .eq("id", jobId)
      .maybeSingle();
    if (readErr) {
      console.error(`[proxy] runner_job read failed: ${readErr.message}`);
      return;
    }
    const merged = {
      ...(job?.metadata ?? {}),
      proxy,
    };
    const { error } = await supabase
      .from("runner_job")
      .update({ metadata: merged })
      .eq("id", jobId);
    if (error) {
      console.error(`[proxy] runner_job metadata update failed: ${error.message}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[proxy] registerProxyOnJob threw: ${msg}`);
  }
}

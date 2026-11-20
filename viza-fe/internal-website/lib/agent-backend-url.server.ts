/** The production agent-backend, used when no URL is configured. */
export const CANONICAL_AGENT_BACKEND_URL = "https://viza-agent-backend-gqix.onrender.com";

/**
 * Agent-backend base URLs to try in order: the configured one, then (in
 * production) the canonical Render URL as a fallback.
 */
export function agentBackendBaseUrls(env: NodeJS.ProcessEnv = process.env): string[] {
  const configured = (env.AGENT_BACKEND_URL?.trim() || env.NEXT_PUBLIC_AGENT_BACKEND_URL?.trim() || "")
    .replace(/\/+$/, "");
  const isProduction = env.NODE_ENV === "production";
  const primary = configured || (isProduction ? CANONICAL_AGENT_BACKEND_URL : "http://localhost:3002");
  return isProduction && primary !== CANONICAL_AGENT_BACKEND_URL
    ? [primary, CANONICAL_AGENT_BACKEND_URL]
    : [primary];
}

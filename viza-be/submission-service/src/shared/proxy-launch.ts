/**
 * Bright Data residential-proxy launch option for country runners.
 *
 * Returns a Playwright `proxy: { server, username, password }` object built
 * from env, with the exit country pinned and a per-launch sticky session, or
 * `undefined` when no proxy is configured (local/offline runs). Pair with
 * `ignoreHTTPSErrors: Boolean(proxy)` on the browser context — Bright Data
 * presents a MITM cert that Chromium otherwise rejects.
 *
 * Env: BRIGHTDATA_PROXY_HOST, BRIGHTDATA_PROXY_PORT (default 33335),
 *      BRIGHTDATA_USERNAME, BRIGHTDATA_PASSWORD.
 */
import { randomBytes } from "node:crypto";
import { resolveBrightDataCredentials } from "./brightdata-credentials.js";

export interface BrightDataProxy {
  server: string;
  username: string;
  password: string;
}

export function brightDataProxy(country: string): BrightDataProxy | undefined {
  const host = process.env.BRIGHTDATA_PROXY_HOST;
  if (!host) return undefined;
  const creds = resolveBrightDataCredentials();
  if (!creds) return undefined;
  const port = process.env.BRIGHTDATA_PROXY_PORT ?? "33335";
  const cc = (country || "in").toLowerCase();
  return {
    server: `http://${host}:${port}`,
    username: `${creds.username}-country-${cc}-session-${randomBytes(6).toString("hex")}`,
    password: creds.password,
  };
}

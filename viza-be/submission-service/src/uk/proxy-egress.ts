/**
 * UKVI egress: Bright Data GB residential proxy vs local IP.
 *
 * Default is local IP (same as France-Visas). Set `UK_USE_LOCAL_IP=false` or
 * `UK_PROXY_REQUIRED=true` to force Bright Data residential egress.
 */

import {
  brightDataCredentialsConfigured,
  BRIGHTDATA_CREDENTIALS_HELP,
} from "../shared/brightdata-credentials.js";

export const UK_EGRESS_COUNTRY = "gb";

/** True when UK automation should route through Bright Data residential proxy. */
export function ukUsesResidentialProxy(): boolean {
  const localFlag = (process.env.UK_USE_LOCAL_IP ?? "true").trim().toLowerCase();
  if (localFlag === "true" || localFlag === "1") return false;
  if (localFlag === "false" || localFlag === "0") return true;
  return process.env.UK_PROXY_REQUIRED?.trim().toLowerCase() === "true";
}

/** Pin the stealth-browser / proxy-launch country suffix to GB (proxy mode only). */
export function ensureUkEgressCountry(): void {
  process.env.RECON_PROXY_COUNTRY =
    process.env.UK_PROXY_COUNTRY?.trim().toLowerCase() ||
    process.env.RECON_PROXY_COUNTRY?.trim().toLowerCase() ||
    UK_EGRESS_COUNTRY;
}

/** When proxy mode is on, require Bright Data zone credentials. */
export function assertUkBrightDataCredentials(): void {
  if (!ukUsesResidentialProxy()) return;
  if (!process.env.BRIGHTDATA_PROXY_HOST?.trim()) {
    throw new Error(
      `UK proxy mode is enabled but BRIGHTDATA_PROXY_HOST is not set. ${BRIGHTDATA_CREDENTIALS_HELP}`,
    );
  }
  if (!brightDataCredentialsConfigured()) {
    throw new Error(
      `UKVI Bright Data proxy is configured but credentials are missing. ${BRIGHTDATA_CREDENTIALS_HELP}`,
    );
  }
}

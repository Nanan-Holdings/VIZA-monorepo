/**
 * Bright Data residential-proxy credential resolution.
 *
 * Supports either:
 *   - BRIGHTDATA_USERNAME + BRIGHTDATA_PASSWORD (full zone username from dashboard), or
 *   - BRIGHTDATA_CUSTOMER_ID + BRIGHTDATA_ZONE + BRIGHTDATA_ZONE_PASSWORD
 *     (username is built as `brd-customer-{id}-zone-{zone}`).
 *
 * Legacy alias: BRIGHTDATA_USER for username.
 */

export interface BrightDataCredentials {
  username: string;
  password: string;
}

export function resolveBrightDataBaseUsername(): string | null {
  const explicit =
    process.env.BRIGHTDATA_USERNAME?.trim() ||
    process.env.BRIGHTDATA_USER?.trim();
  if (explicit) return explicit;

  const customerId = process.env.BRIGHTDATA_CUSTOMER_ID?.trim();
  const zone = process.env.BRIGHTDATA_ZONE?.trim();
  if (customerId && zone) {
    return `brd-customer-${customerId}-zone-${zone}`;
  }
  return null;
}

export function resolveBrightDataPassword(): string | null {
  return (
    process.env.BRIGHTDATA_PASSWORD?.trim() ||
    process.env.BRIGHTDATA_ZONE_PASSWORD?.trim() ||
    null
  );
}

export function resolveBrightDataCredentials(): BrightDataCredentials | null {
  const username = resolveBrightDataBaseUsername();
  const password = resolveBrightDataPassword();
  if (!username || !password) return null;
  return { username, password };
}

export function brightDataCredentialsConfigured(): boolean {
  return resolveBrightDataCredentials() !== null;
}

export const BRIGHTDATA_CREDENTIALS_HELP =
  "Set BRIGHTDATA_USERNAME + BRIGHTDATA_PASSWORD, or BRIGHTDATA_CUSTOMER_ID + BRIGHTDATA_ZONE + BRIGHTDATA_ZONE_PASSWORD (zone password from the Bright Data dashboard — not the API token).";

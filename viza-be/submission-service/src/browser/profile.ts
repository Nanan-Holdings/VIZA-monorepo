import { randomBytes, createHash } from "node:crypto";
import { supabase } from "../supabase.js";

/**
 * Per-applicant browser fingerprint persistence (INFRA-005).
 *
 * `getOrCreateApplicantProfile(applicantId)` returns the same
 * fingerprint payload across runs. First call mints a deterministic
 * (yet plausibly random) fingerprint derived from the applicant id;
 * subsequent calls return the persisted JSON unchanged.
 *
 * The fingerprint is intentionally derived deterministically — if a
 * row gets accidentally deleted, regenerating produces the same
 * shape, so the portal does not see a sudden identity change. Tweak
 * `FP_VERSION` to force a global rotation.
 */

const FP_VERSION = 1;

const USER_AGENTS: ReadonlyArray<string> = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
];

const VIEWPORTS: ReadonlyArray<{ width: number; height: number }> = [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1536, height: 960 },
  { width: 1920, height: 1080 },
];

const LOCALES: ReadonlyArray<string> = [
  "en-US",
  "en-GB",
  "en-AU",
  "en-CA",
  "fr-FR",
  "es-ES",
];

const TIMEZONES: ReadonlyArray<string> = [
  "America/Los_Angeles",
  "America/New_York",
  "Europe/London",
  "Europe/Paris",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Ho_Chi_Minh",
  "Australia/Sydney",
];

export interface BrowserFingerprint {
  v: number;
  userAgent: string;
  viewport: { width: number; height: number };
  locale: string;
  timezone: string;
  /** Stable hardwareConcurrency. */
  hardwareConcurrency: number;
  /** Stable deviceMemory (GB). */
  deviceMemory: number;
  /** Stable canvas-noise seed. Used by the stealth plugin. */
  canvasNoiseSeed: string;
  /** Pre-generated WebGL vendor / renderer pair. */
  webgl: { vendor: string; renderer: string };
}

const WEBGL_PAIRS: ReadonlyArray<{ vendor: string; renderer: string }> = [
  { vendor: "Google Inc. (Apple)", renderer: "ANGLE (Apple, Apple M1, OpenGL 4.1)" },
  { vendor: "Google Inc. (Intel)", renderer: "ANGLE (Intel, Intel(R) UHD Graphics 630, OpenGL 4.1)" },
  { vendor: "Google Inc. (NVIDIA)", renderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060, Direct3D11 vs_5_0 ps_5_0)" },
];

function pick<T>(arr: ReadonlyArray<T>, index: number): T {
  return arr[index % arr.length];
}

/** Deterministic per-applicant fingerprint when no row exists yet. */
function deriveFingerprint(applicantId: string): BrowserFingerprint {
  const h = createHash("sha256").update(`${FP_VERSION}:${applicantId}`).digest();
  return {
    v: FP_VERSION,
    userAgent: pick(USER_AGENTS, h[0]),
    viewport: pick(VIEWPORTS, h[1]),
    locale: pick(LOCALES, h[2]),
    timezone: pick(TIMEZONES, h[3]),
    hardwareConcurrency: 4 + (h[4] % 5) * 2, // 4, 6, 8, 10, 12
    deviceMemory: [4, 8, 16][h[5] % 3],
    canvasNoiseSeed: h.subarray(8, 16).toString("hex"),
    webgl: pick(WEBGL_PAIRS, h[6]),
  };
}

export async function getOrCreateApplicantProfile(
  applicantId: string,
): Promise<BrowserFingerprint> {
  const { data: existing, error: readErr } = await supabase
    .from("applicant_browser_profile")
    .select("fingerprint_json")
    .eq("applicant_id", applicantId)
    .maybeSingle();
  if (readErr) {
    throw new Error(`browser profile read: ${readErr.message}`);
  }
  if (existing?.fingerprint_json) {
    const fp = existing.fingerprint_json as BrowserFingerprint;
    if (fp.v === FP_VERSION) return fp;
    // Older fingerprint version — keep using it. A global rotation
    // would re-mint via a separate migration; we never silently
    // overwrite a stored fingerprint.
    return fp;
  }
  const fp = deriveFingerprint(applicantId);
  const { error: insErr } = await supabase
    .from("applicant_browser_profile")
    .insert({ applicant_id: applicantId, fingerprint_json: fp });
  if (insErr) {
    // Race: another worker beat us to it. Re-read.
    if (insErr.code === "23505") {
      const { data: re } = await supabase
        .from("applicant_browser_profile")
        .select("fingerprint_json")
        .eq("applicant_id", applicantId)
        .maybeSingle();
      if (re?.fingerprint_json) return re.fingerprint_json as BrowserFingerprint;
    }
    throw new Error(`browser profile insert: ${insErr.message}`);
  }
  return fp;
}

/**
 * Apply a fingerprint to a Playwright `context` options bag. Returns
 * the input shape Playwright's `browser.newContext()` accepts.
 */
export interface PlaywrightContextOpts {
  userAgent: string;
  viewport: { width: number; height: number };
  locale: string;
  timezoneId: string;
  deviceScaleFactor?: number;
  colorScheme?: "dark" | "light" | "no-preference";
  extraHTTPHeaders?: Record<string, string>;
}

export function asContextOpts(fp: BrowserFingerprint): PlaywrightContextOpts {
  return {
    userAgent: fp.userAgent,
    viewport: fp.viewport,
    locale: fp.locale,
    timezoneId: fp.timezone,
    deviceScaleFactor: 1,
    colorScheme: "light",
    extraHTTPHeaders: {
      "Accept-Language": `${fp.locale},en;q=0.9`,
    },
  };
}

/**
 * Persist the live storageState (cookies + localStorage) so future
 * runs can skip the login dance for the same applicant.
 */
export async function saveStorageState(
  applicantId: string,
  state: unknown,
): Promise<void> {
  const { error } = await supabase
    .from("applicant_browser_profile")
    .update({
      storage_state_json: state,
      updated_at: new Date().toISOString(),
    })
    .eq("applicant_id", applicantId);
  if (error) {
    throw new Error(`storage state save: ${error.message}`);
  }
}

/** Load the prior storageState (or null when none persisted yet). */
export async function loadStorageState(
  applicantId: string,
): Promise<unknown | null> {
  const { data, error } = await supabase
    .from("applicant_browser_profile")
    .select("storage_state_json")
    .eq("applicant_id", applicantId)
    .maybeSingle();
  if (error) throw new Error(`storage state read: ${error.message}`);
  return data?.storage_state_json ?? null;
}

/** Lightweight token used in metadata when the runner forgets to log. */
export function fingerprintShortId(fp: BrowserFingerprint): string {
  return createHash("sha256")
    .update(JSON.stringify(fp))
    .digest("hex")
    .slice(0, 12);
}

void randomBytes; // kept for future entropy needs (rotate canvas seed)

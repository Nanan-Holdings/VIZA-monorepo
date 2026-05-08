/**
 * Per-attempt fingerprint rotation (ANTIBOT-002).
 *
 * `getOrCreateApplicantProfile` (browser/profile.ts) gives us a stable
 * fingerprint per applicant. When a runner retries after an anti-bot
 * gate, the next attempt should NOT reuse the same fingerprint — but
 * we also can't churn fingerprints unboundedly because excessive
 * reshuffling itself looks bot-like.
 *
 * Contract:
 *   - rotateFingerprint(applicantId, attempt) is deterministic — same
 *     (applicantId, attempt) always returns the same nonce-augmented
 *     fingerprint, so a re-replay reproduces history exactly.
 *   - The function refuses to mint a new variant once 3 distinct
 *     fingerprints have already been used in the previous 7 days.
 */

import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { getOrCreateApplicantProfile, type BrowserFingerprint } from "../browser/profile";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

export interface FingerprintRotationResult {
  fingerprint: BrowserFingerprint;
  /** Hex digest used as the cap key (not the fingerprint itself). */
  rotationKey: string;
  /** True if we hit the 7d cap and reused an earlier rotation. */
  capped: boolean;
}

const MAX_DISTINCT_FP_PER_7D = 3;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

interface HistoryEntry {
  rotation_key: string;
  attempt: number;
  ts: string;
}

function deriveRotationKey(applicantId: string, attempt: number): string {
  return createHash("sha256")
    .update(`fp:${applicantId}:${attempt}`)
    .digest("hex")
    .slice(0, 16);
}

function applyRotation(base: BrowserFingerprint, rotationKey: string): BrowserFingerprint {
  // Deterministic rotation: shift integer-valued fields by deterministic
  // offsets derived from the rotation key. Keeps the fingerprint inside
  // the realistic shape — no impossible viewport sizes / hardware specs.
  const seed = parseInt(rotationKey.slice(0, 8), 16);
  const offsetW = ((seed >>> 0) % 41) - 20; // ±20px
  const offsetH = ((seed >>> 8) & 0xff) % 31 - 15;
  return {
    ...base,
    viewport: {
      width: Math.max(1024, base.viewport.width + offsetW),
      height: Math.max(700, base.viewport.height + offsetH),
    },
    canvasNoiseSeed: createHash("sha256")
      .update(`${base.canvasNoiseSeed}:${rotationKey}`)
      .digest("hex")
      .slice(0, 16),
    hardwareConcurrency: base.hardwareConcurrency,
    deviceMemory: base.deviceMemory,
  };
}

async function readRecentHistory(applicantId: string): Promise<HistoryEntry[]> {
  const cutoff = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();
  const { data } = await supabase
    .from("runner_job")
    .select("fingerprint_history, updated_at")
    .eq("application_id", applicantId) // attempts indexed by application_id; OK to broaden
    .gte("updated_at", cutoff);
  const entries: HistoryEntry[] = [];
  for (const row of (data ?? []) as Array<{ fingerprint_history: HistoryEntry[] | null }>) {
    if (Array.isArray(row.fingerprint_history)) entries.push(...row.fingerprint_history);
  }
  return entries;
}

export async function rotateFingerprint(
  applicantId: string,
  attempt: number,
): Promise<FingerprintRotationResult> {
  const base = await getOrCreateApplicantProfile(applicantId);
  if (attempt <= 0) {
    return {
      fingerprint: base,
      rotationKey: deriveRotationKey(applicantId, 0),
      capped: false,
    };
  }
  const history = await readRecentHistory(applicantId);
  const distinctKeys = new Set(history.map((h) => h.rotation_key));
  const desiredKey = deriveRotationKey(applicantId, attempt);

  if (distinctKeys.size >= MAX_DISTINCT_FP_PER_7D && !distinctKeys.has(desiredKey)) {
    // Cap hit — reuse the most recent rotation key rather than mint a new one.
    const sorted = [...history].sort((a, b) => b.ts.localeCompare(a.ts));
    const fallback = sorted[0]?.rotation_key ?? deriveRotationKey(applicantId, 0);
    return {
      fingerprint: applyRotation(base, fallback),
      rotationKey: fallback,
      capped: true,
    };
  }
  return {
    fingerprint: applyRotation(base, desiredKey),
    rotationKey: desiredKey,
    capped: false,
  };
}

export async function recordFingerprintUsage(
  jobId: string,
  applicantId: string,
  attempt: number,
  rotationKey: string,
): Promise<void> {
  const entry: HistoryEntry = {
    rotation_key: rotationKey,
    attempt,
    ts: new Date().toISOString(),
  };
  const { data: existing } = await supabase
    .from("runner_job")
    .select("fingerprint_history")
    .eq("id", jobId)
    .maybeSingle();
  const prior = (existing?.fingerprint_history as HistoryEntry[] | null) ?? [];
  await supabase
    .from("runner_job")
    .update({ fingerprint_history: [...prior, entry] })
    .eq("id", jobId);
  // Also touch applicant-scoped history if you maintain a sister table —
  // for now `runner_job.fingerprint_history` is enough.
  void applicantId;
}

/**
 * Per-IP cooldown after Cloudflare hit (ANTIBOT-003).
 *
 * Wraps the proxy_pool table. Runners call `pickStickySession` before
 * each attempt to skip recently-challenged IPs and `markChallenged` on
 * any anti-bot trip so the cooldown timer kicks in.
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const DEFAULT_COOLDOWN_MINUTES = 30;
const SUSTAINED_FAILURE_THRESHOLD = 3;
const SUSTAINED_FAILURE_COOLDOWN_HOURS = 4;

export interface ProxySession {
  id: string;
  sticky_session_id: string;
  ip: string;
  region: string | null;
}

export async function pickStickySession(opts?: { region?: string }): Promise<ProxySession | null> {
  let query = supabase
    .from("proxy_pool")
    .select("id, sticky_session_id, ip, region")
    .eq("is_active", true)
    .or(`cooled_until.is.null,cooled_until.lte.${new Date().toISOString()}`)
    .order("last_challenge_at", { ascending: true, nullsFirst: true })
    .limit(1);
  if (opts?.region) query = query.eq("region", opts.region);
  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error("[proxy-pool] pick failed:", error.message);
    return null;
  }
  return (data ?? null) as ProxySession | null;
}

export async function markChallenged(stickySessionId: string, opts?: { cooldownMinutes?: number }): Promise<void> {
  const cooldownMinutes = opts?.cooldownMinutes ?? DEFAULT_COOLDOWN_MINUTES;
  const { data: row } = await supabase
    .from("proxy_pool")
    .select("challenge_streak")
    .eq("sticky_session_id", stickySessionId)
    .maybeSingle();
  const nextStreak = ((row?.challenge_streak as number | null) ?? 0) + 1;
  const escalated = nextStreak >= SUSTAINED_FAILURE_THRESHOLD;
  const cooledUntil = new Date(
    Date.now() + (escalated ? SUSTAINED_FAILURE_COOLDOWN_HOURS * 60 : cooldownMinutes) * 60_000,
  ).toISOString();
  await supabase
    .from("proxy_pool")
    .update({
      cooled_until: cooledUntil,
      last_challenge_at: new Date().toISOString(),
      challenge_streak: nextStreak,
      updated_at: new Date().toISOString(),
    })
    .eq("sticky_session_id", stickySessionId);
}

export async function markSuccess(stickySessionId: string): Promise<void> {
  await supabase
    .from("proxy_pool")
    .update({ challenge_streak: 0, updated_at: new Date().toISOString() })
    .eq("sticky_session_id", stickySessionId);
}

/**
 * Government-fee scraper (FEES-001).
 *
 * Runs Sunday 03:00 UTC. For each registered country fetches the
 * published fee table, compares against the latest package_pricing
 * row, writes a fresh row when numbers change, and posts a Slack
 * digest of the diff for staff review.
 *
 * The per-country scraper functions are intentionally minimal stubs
 * for now — they hit the upstream HTML page and yank the headline
 * USD fee out of a hand-curated regex. When the regex no longer
 * matches we keep the prior value and flag the country in the
 * digest so staff can update the regex (or fall back to manual entry
 * via the FEES-002 admin override UI).
 */

import { getSupabaseClient } from "../db/supabase-client.js";

/**
 * Well-known UUID for the "system" actor — used in audit rows produced by
 * automated jobs (no human auth.user.id available). Keep in sync with
 * `docs/operations/system-actor.md`.
 */
export const SYSTEM_ACTOR_UUID = "00000000-0000-0000-0000-000000000001";

interface ScrapeResult {
  visaPackageId: string;
  country: string;
  visaType: string;
  currency: string;
  governmentFeeCents: number | null;
  agencyFeeCents: number;
  source: string;
  scrapedAt: string;
  notes?: string;
}

interface CountryScraper {
  country: string;
  visaType: string;
  /** Hard-coded agency markup (cents). */
  agencyFeeCents: number;
  url: string;
  /** Returns headline gov-fee in cents (USD), or null when scrape fails. */
  parse: (html: string) => number | null;
}

const COUNTRY_SCRAPERS: CountryScraper[] = [
  {
    country: "KH",
    visaType: "tourist_evisa",
    url: "https://www.evisa.gov.kh/visa-fees",
    agencyFeeCents: 4_900,
    parse: (html) => {
      const m = html.match(/USD\s*\$?\s*([0-9]+)(?:\.(\d{2}))?/i);
      if (!m) return null;
      return parseInt(m[1], 10) * 100 + (m[2] ? parseInt(m[2], 10) : 0);
    },
  },
  {
    country: "LA",
    visaType: "tourist_evisa",
    url: "https://laoevisa.gov.la/fees",
    agencyFeeCents: 4_900,
    parse: (html) => {
      const m = html.match(/Tourist\s*Visa.*?USD\s*\$?\s*([0-9]+)/is);
      return m ? parseInt(m[1], 10) * 100 : null;
    },
  },
  {
    country: "LK",
    visaType: "eta",
    url: "https://www.eta.gov.lk/slvisa/fees",
    agencyFeeCents: 4_900,
    parse: (html) => {
      const m = html.match(/ETA.*?US\$\s*([0-9]+)/is);
      return m ? parseInt(m[1], 10) * 100 : null;
    },
  },
];

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "user-agent": "VIZA fee-scraper/1.0" } });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function resolveVisaPackageId(country: string, visaType: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from("visa_packages")
    .select("id")
    .eq("country", country)
    .eq("visa_type", visaType)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  return (data?.id as string) ?? null;
}

interface DiffEntry {
  country: string;
  visaType: string;
  prior: number | null;
  next: number | null;
  agencyFee: number;
  notes?: string;
}

export async function runFeeScraper(): Promise<{ diff: DiffEntry[]; updated: number }> {
  const supabase = getSupabaseClient();
  const diff: DiffEntry[] = [];
  let updated = 0;

  for (const scraper of COUNTRY_SCRAPERS) {
    const packageId = await resolveVisaPackageId(scraper.country, scraper.visaType);
    if (!packageId) {
      diff.push({ country: scraper.country, visaType: scraper.visaType, prior: null, next: null, agencyFee: scraper.agencyFeeCents, notes: "no visa_packages row" });
      continue;
    }
    const html = await fetchHtml(scraper.url);
    const next = html ? scraper.parse(html) : null;
    const { data: existing } = await supabase
      .from("package_pricing")
      .select("government_fee_cents, source, override_until")
      .eq("visa_package_id", packageId)
      .eq("currency", "USD")
      .maybeSingle();
    const prior = (existing?.government_fee_cents as number | null) ?? null;
    const overrideActive = existing?.override_until && new Date(existing.override_until as string).getTime() > Date.now();

    if (next === null) {
      diff.push({
        country: scraper.country,
        visaType: scraper.visaType,
        prior,
        next: null,
        agencyFee: scraper.agencyFeeCents,
        notes: html === null ? "fetch failed" : "regex no match",
      });
      continue;
    }
    if (overrideActive) {
      diff.push({
        country: scraper.country,
        visaType: scraper.visaType,
        prior,
        next,
        agencyFee: scraper.agencyFeeCents,
        notes: "skip — staff override active",
      });
      continue;
    }
    if (prior === next) continue;

    const result: ScrapeResult = {
      visaPackageId: packageId,
      country: scraper.country,
      visaType: scraper.visaType,
      currency: "USD",
      governmentFeeCents: next,
      agencyFeeCents: scraper.agencyFeeCents,
      source: "scraper",
      scrapedAt: new Date().toISOString(),
    };
    await persistResult(result);
    updated += 1;
    diff.push({ country: scraper.country, visaType: scraper.visaType, prior, next, agencyFee: scraper.agencyFeeCents });
  }

  await postSlackDigest(diff);
  return { diff, updated };
}

async function persistResult(r: ScrapeResult): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase.from("package_pricing").upsert(
    {
      visa_package_id: r.visaPackageId,
      currency: r.currency,
      government_fee_cents: r.governmentFeeCents ?? 0,
      agency_fee_cents: r.agencyFeeCents,
      source: r.source,
      scraped_at: r.scrapedAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "visa_package_id,currency" },
  );
  await supabase.from("package_pricing_history").insert({
    visa_package_id: r.visaPackageId,
    currency: r.currency,
    government_fee_cents: r.governmentFeeCents ?? 0,
    agency_fee_cents: r.agencyFeeCents,
    source: r.source,
    // Well-known system-actor UUID so audit queries can distinguish
    // automated writes from staff overrides without joining auth.users.
    changed_by: SYSTEM_ACTOR_UUID,
    reason: "weekly fee scraper",
  });
}

async function postSlackDigest(diff: DiffEntry[]): Promise<void> {
  const webhook = process.env.FEE_SCRAPER_SLACK_WEBHOOK;
  if (!webhook) return;
  if (diff.length === 0) return;
  const lines = diff.map(
    (d) =>
      `• ${d.country}/${d.visaType}: ${d.prior ?? "—"} → ${d.next ?? "—"} cents${d.notes ? ` (${d.notes})` : ""}`,
  );
  const body = `*Weekly fee-scraper digest*\n${lines.join("\n")}`;
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: body }),
    });
  } catch (err) {
    console.error("[fee-scraper] slack post failed:", err instanceof Error ? err.message : String(err));
  }
}

/**
 * Vendor cost adapters (OBS-003).
 *
 * Each adapter returns daily spend for the last N days in USD cents.
 * Adapters are independent — failure in one doesn't break the dashboard.
 * Real implementations live behind env-gated wiring; default impl returns
 * an empty series so /admin/costs renders without provisioning.
 */

export interface DailySpend {
  date: string; // ISO date (yyyy-mm-dd)
  amountCents: number;
}

export interface CostAdapter {
  vendor: string;
  fetchDaily(days: number): Promise<DailySpend[]>;
}

const stubAdapter = (vendor: string): CostAdapter => ({
  vendor,
  async fetchDaily(_days: number): Promise<DailySpend[]> {
    return [];
  },
});

export const BRIGHT_DATA: CostAdapter = stubAdapter("bright-data");
export const ANTHROPIC: CostAdapter = stubAdapter("anthropic");
export const AWS: CostAdapter = stubAdapter("aws");
export const TWILIO: CostAdapter = stubAdapter("twilio");
export const RESEND: CostAdapter = stubAdapter("resend");
export const STRIPE_IDENTITY: CostAdapter = stubAdapter("stripe-identity");

export const ALL_ADAPTERS: CostAdapter[] = [BRIGHT_DATA, ANTHROPIC, AWS, TWILIO, RESEND, STRIPE_IDENTITY];

export interface AggregatedVendor {
  vendor: string;
  weeklyCents: number;
  priorWeeklyCents: number;
  wowDelta: number;
  series: DailySpend[];
}

export async function aggregateLastWeeks(): Promise<AggregatedVendor[]> {
  const out: AggregatedVendor[] = [];
  for (const adapter of ALL_ADAPTERS) {
    try {
      const fortnight = await adapter.fetchDaily(14);
      const split = fortnight.length - 7;
      const weekly = fortnight.slice(Math.max(0, split)).reduce((s, d) => s + d.amountCents, 0);
      const prior = fortnight.slice(0, Math.max(0, split)).reduce((s, d) => s + d.amountCents, 0);
      const wow = prior === 0 ? 0 : (weekly - prior) / prior;
      out.push({ vendor: adapter.vendor, weeklyCents: weekly, priorWeeklyCents: prior, wowDelta: wow, series: fortnight.slice(Math.max(0, split)) });
    } catch (err) {
      console.error(`[costs] ${adapter.vendor} failed:`, err instanceof Error ? err.message : String(err));
      out.push({ vendor: adapter.vendor, weeklyCents: 0, priorWeeklyCents: 0, wowDelta: 0, series: [] });
    }
  }
  return out;
}

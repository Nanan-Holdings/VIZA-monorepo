import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface Row {
  country: string;
  week_start: string;
  success: boolean;
  time_to_submit_s: number | null;
  captcha_cost_cents: number;
  proxy_cost_cents: number;
}

interface Bucket {
  total: number;
  succeeded: number;
  ttsSum: number;
  ttsCount: number;
  captchaCents: number;
  proxyCents: number;
}

const SUCCESS_RATE_THRESHOLD = 0.9;

function makeBucket(): Bucket {
  return {
    total: 0,
    succeeded: 0,
    ttsSum: 0,
    ttsCount: 0,
    captchaCents: 0,
    proxyCents: 0,
  };
}

export default async function AdminMetricsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/admin/login");

  const admin = createAdminClient();
  // Last 8 weeks.
  const sinceIso = new Date(Date.now() - 8 * 7 * 24 * 3600 * 1000)
    .toISOString();
  const { data, error } = await admin
    .from("runner_metric")
    .select(
      "country, week_start, success, time_to_submit_s, captcha_cost_cents, proxy_cost_cents",
    )
    .gte("ts", sinceIso)
    .order("week_start", { ascending: false });

  if (error) {
    return (
      <div className="w-full p-6 md:p-8">
        <p className="text-sm text-red-600">{error.message}</p>
      </div>
    );
  }
  const rows = (data ?? []) as Row[];

  // Aggregate: country|week → Bucket.
  const buckets = new Map<string, Bucket>();
  const weeks = new Set<string>();
  const countries = new Set<string>();
  for (const r of rows) {
    weeks.add(r.week_start);
    countries.add(r.country);
    const key = `${r.country}|${r.week_start}`;
    const b = buckets.get(key) ?? makeBucket();
    b.total += 1;
    if (r.success) {
      b.succeeded += 1;
      if (r.time_to_submit_s != null) {
        b.ttsSum += r.time_to_submit_s;
        b.ttsCount += 1;
      }
    }
    b.captchaCents += r.captcha_cost_cents;
    b.proxyCents += r.proxy_cost_cents;
    buckets.set(key, b);
  }
  const sortedWeeks = Array.from(weeks).sort().reverse();
  const sortedCountries = Array.from(countries).sort();

  // Current-week alerts: country with success_rate < threshold AND >=5 jobs.
  const currentWeek = sortedWeeks[0];
  const alerts: Array<{ country: string; rate: number; total: number }> = [];
  if (currentWeek) {
    for (const c of sortedCountries) {
      const b = buckets.get(`${c}|${currentWeek}`);
      if (!b || b.total < 5) continue;
      const rate = b.succeeded / b.total;
      if (rate < SUCCESS_RATE_THRESHOLD) {
        alerts.push({ country: c, rate, total: b.total });
      }
    }
  }

  return (
    <div className="w-full p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#232323]">Runner KPIs</h1>
        <p className="text-sm text-[#6b6b6b]">
          Last 8 weeks · {rows.length} job-metrics · current week {currentWeek ?? "—"}
        </p>
      </div>

      {alerts.length > 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="font-semibold text-amber-800 text-sm">
            Success rate below {(SUCCESS_RATE_THRESHOLD * 100).toFixed(0)}%
            this week
          </p>
          <ul className="text-sm mt-2 list-disc list-inside text-amber-800">
            {alerts.map((a) => (
              <li key={a.country}>
                {a.country}: {(a.rate * 100).toFixed(1)}% over {a.total} jobs
              </li>
            ))}
          </ul>
          <p className="text-xs text-amber-700 mt-2">
            (OPS-003 alert class <code>runner.success_rate.&lt;country&gt;</code> fires
            on the same threshold via the daily metrics rollup cron.)
          </p>
        </div>
      ) : null}

      <div className="bg-white rounded-lg border border-[#efefef] shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-[#fafafa]">
              <th className="text-left px-3 py-2 font-medium text-[#6b6b6b]">Country</th>
              {sortedWeeks.map((w) => (
                <th
                  key={w}
                  className="text-right px-3 py-2 font-medium text-[#6b6b6b]"
                >
                  {w}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedCountries.map((c) => (
              <tr key={c} className="border-b last:border-0">
                <td className="px-3 py-2 font-mono text-xs">{c}</td>
                {sortedWeeks.map((w) => {
                  const b = buckets.get(`${c}|${w}`);
                  if (!b) {
                    return (
                      <td
                        key={w}
                        className="px-3 py-2 text-right text-xs text-[#9ca3af]"
                      >
                        —
                      </td>
                    );
                  }
                  const rate = b.succeeded / Math.max(1, b.total);
                  const tts =
                    b.ttsCount > 0 ? Math.round(b.ttsSum / b.ttsCount) : null;
                  const cost =
                    ((b.captchaCents + b.proxyCents) / 100).toFixed(2);
                  return (
                    <td
                      key={w}
                      className="px-3 py-2 text-right text-xs font-mono"
                    >
                      <span
                        className={
                          rate < SUCCESS_RATE_THRESHOLD && b.total >= 5
                            ? "text-red-600 font-semibold"
                            : "text-[#232323]"
                        }
                      >
                        {(rate * 100).toFixed(0)}% / {b.total}
                      </span>
                      <br />
                      <span className="text-[#6b6b6b]">
                        {tts != null ? `${tts}s` : "—"} · ${cost}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-[#6b6b6b]">
        Cell format: success_rate / total jobs · avg time-to-submit · USD
        captcha+proxy spend.
      </p>
    </div>
  );
}

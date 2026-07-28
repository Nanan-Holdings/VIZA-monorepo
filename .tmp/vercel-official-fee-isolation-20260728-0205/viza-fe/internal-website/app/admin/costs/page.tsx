import { aggregateLastWeeks, type AggregatedVendor } from "@/lib/costs/adapters";

export const dynamic = "force-dynamic";

function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function pct(delta: number): string {
  return `${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(0)}%`;
}

function deltaTone(delta: number): string {
  if (delta > 0.2) return "text-destructive";
  if (delta < -0.05) return "text-brand-500";
  return "text-muted-foreground";
}

function Sparkline({ vendor }: { vendor: AggregatedVendor }): React.ReactElement {
  if (vendor.series.length === 0) return <span className="text-xs text-muted-foreground">no data</span>;
  const max = Math.max(...vendor.series.map((d) => d.amountCents), 1);
  return (
    <div className="flex h-6 items-end gap-0.5">
      {vendor.series.map((d) => (
        <div
          key={d.date}
          className="w-1.5 rounded-sm bg-brand-500"
          style={{ height: `${(d.amountCents / max) * 100}%`, minHeight: 2 }}
          title={`${d.date}: ${usd(d.amountCents)}`}
        />
      ))}
    </div>
  );
}

export default async function AdminCostsPage() {
  const vendors = await aggregateLastWeeks();
  const total = vendors.reduce((s, v) => s + v.weeklyCents, 0);
  const totalPrior = vendors.reduce((s, v) => s + v.priorWeeklyCents, 0);
  const totalWow = totalPrior === 0 ? 0 : (total - totalPrior) / totalPrior;

  return (
    <main className="min-h-screen bg-[#fafafa] px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-4">
        <header>
          <h1 className="text-2xl font-semibold text-foreground">Vendor costs</h1>
          <p className="mt-1 text-sm text-muted-foreground">7-day rolling spend per vendor.</p>
        </header>
        <div className="rounded-xl border border-input bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-muted-foreground">Total this week</p>
          <p className="mt-1 text-3xl font-semibold text-foreground">
            {usd(total)} <span className={`text-sm ${deltaTone(totalWow)}`}>{pct(totalWow)}</span>
          </p>
        </div>
        <div className="overflow-hidden rounded-xl border border-input bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-[#fafafa] text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Vendor</th>
                <th className="px-3 py-2 text-left font-semibold">7d spend</th>
                <th className="px-3 py-2 text-left font-semibold">WoW</th>
                <th className="px-3 py-2 text-left font-semibold">Sparkline</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.vendor} className="border-t border-input/60">
                  <td className="px-3 py-2 font-mono text-xs">{v.vendor}</td>
                  <td className="px-3 py-2">{usd(v.weeklyCents)}</td>
                  <td className={`px-3 py-2 text-xs ${deltaTone(v.wowDelta)}`}>{pct(v.wowDelta)}</td>
                  <td className="px-3 py-2">
                    <Sparkline vendor={v} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

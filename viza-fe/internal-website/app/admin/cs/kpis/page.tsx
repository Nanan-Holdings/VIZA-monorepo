import { loadKpis } from "@/app/actions/admin-cs";

export const dynamic = "force-dynamic";

function pct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

export default async function AdminCsKpisPage() {
  const { snapshot, error } = await loadKpis(7);

  if (error || !snapshot) {
    return (
      <main className="min-h-screen bg-[#fafafa] px-6 py-10">
        <div className="mx-auto max-w-3xl rounded-xl border border-input bg-white p-6 shadow-sm">
          <p className="text-sm text-destructive">{error ?? "No data"}</p>
        </div>
      </main>
    );
  }

  const cards = [
    { label: "Tickets (7d)", value: snapshot.totalTickets.toString() },
    {
      label: "Median first-response",
      value: snapshot.firstResponseMedianMinutes === null ? "—" : `${snapshot.firstResponseMedianMinutes}m`,
    },
    { label: "Resolution rate", value: pct(snapshot.resolutionRate) },
    { label: "SLA breaches", value: snapshot.slaBreachCount.toString() },
    { label: "WoW volume", value: `${snapshot.weekOverWeekDelta >= 0 ? "+" : ""}${pct(snapshot.weekOverWeekDelta)}` },
  ];

  return (
    <main className="min-h-screen bg-[#fafafa] px-6 py-10">
      <div className="mx-auto max-w-3xl space-y-4">
        <header>
          <h1 className="text-2xl font-semibold text-foreground">Support KPIs</h1>
          <p className="mt-1 text-sm text-muted-foreground">7-day rolling window.</p>
        </header>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {cards.map((c) => (
            <div key={c.label} className="rounded-xl border border-input bg-white p-4 shadow-sm">
              <p className="text-xs uppercase text-muted-foreground">{c.label}</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{c.value}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

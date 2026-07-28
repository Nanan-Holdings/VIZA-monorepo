import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface PortalRow {
  country: string;
  status: string;
  last_ok_at: string | null;
  last_failure_at: string | null;
}

async function loadPortalHealth(): Promise<PortalRow[]> {
  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from("portal_health")
    .select("country, status, last_ok_at, last_failure_at")
    .order("country");
  return (data ?? []) as PortalRow[];
}

function uptime30d(_row: PortalRow): string {
  // Placeholder — wire to canary history aggregation when portal_health
  // grows a "runs_30d / oks_30d" pair (cheaper than reading the full log).
  return "—";
}

export default async function AdminStatusPage() {
  const rows = await loadPortalHealth();
  const incidentBanner = process.env.STATUS_INCIDENT_BANNER || null;

  return (
    <main className="min-h-screen bg-[#fafafa] px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-4">
        <header>
          <h1 className="text-2xl font-semibold text-foreground">Portal status</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Per-portal uptime (admin view). Public mirror at{" "}
            <a href="https://status.viza.app" className="text-brand-500 hover:underline">
              status.viza.app
            </a>
            .
          </p>
        </header>
        {incidentBanner ? (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {incidentBanner}
          </p>
        ) : null}
        <div className="overflow-hidden rounded-xl border border-input bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-[#fafafa] text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Country</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2 text-left font-semibold">Last OK</th>
                <th className="px-3 py-2 text-left font-semibold">Last fail</th>
                <th className="px-3 py-2 text-left font-semibold">30d uptime</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.country} className="border-t border-input/60">
                  <td className="px-3 py-2 font-mono text-xs">{row.country.toUpperCase()}</td>
                  <td className="px-3 py-2 text-xs">
                    <span
                      className={
                        row.status === "ok"
                          ? "inline-block rounded-full bg-brand-50 px-2 py-0.5 text-brand-500"
                          : "inline-block rounded-full bg-destructive/10 px-2 py-0.5 text-destructive"
                      }
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {row.last_ok_at ? new Date(row.last_ok_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {row.last_failure_at ? new Date(row.last_failure_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{uptime30d(row)}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-xs text-muted-foreground">
                    portal_health is empty — canary cron hasn&apos;t populated yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

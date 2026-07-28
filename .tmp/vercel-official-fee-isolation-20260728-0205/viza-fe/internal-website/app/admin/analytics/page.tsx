import Link from "next/link";

export const dynamic = "force-dynamic";

interface FunnelStage {
  label: string;
  count: number;
}

async function loadFunnel(): Promise<FunnelStage[]> {
  // Placeholder counts — wire to PostHog query API once OBS-001 / PROV
  // sequence has analytics provisioned. The dashboard structure stays
  // identical; only the data source swaps.
  return [
    { label: "Signed up", count: 0 },
    { label: "Email verified", count: 0 },
    { label: "Application created", count: 0 },
    { label: "Payment succeeded", count: 0 },
    { label: "Application submitted", count: 0 },
  ];
}

export default async function AdminAnalyticsPage() {
  const funnel = await loadFunnel();
  return (
    <main className="min-h-screen bg-[#fafafa] px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Product analytics</h1>
            <p className="mt-1 text-sm text-muted-foreground">Signup → submission funnel (7d).</p>
          </div>
          <a
            href={process.env.NEXT_PUBLIC_POSTHOG_DASHBOARD_URL || "https://app.posthog.com"}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-brand-500 hover:underline"
          >
            PostHog →
          </a>
        </header>
        <ol className="space-y-2">
          {funnel.map((stage) => (
            <li
              key={stage.label}
              className="flex items-center justify-between rounded-xl border border-input bg-white px-4 py-3 shadow-sm"
            >
              <span className="text-sm text-foreground">{stage.label}</span>
              <span className="font-mono text-2xl font-semibold text-brand-500">{stage.count}</span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">
          Numbers are placeholder until PostHog is provisioned and the producer call sites are
          wired (see <Link href="/docs/operations/analytics.md" className="underline">analytics.md</Link>).
        </p>
      </div>
    </main>
  );
}

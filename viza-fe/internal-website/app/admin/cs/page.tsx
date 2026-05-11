import { listAdminTickets } from "@/app/actions/admin-cs";
import { CsQueueClient } from "./_components/CsQueueClient";

export const dynamic = "force-dynamic";

export default async function AdminCsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const tab = ((await searchParams).tab as "open" | "mine" | "unassigned" | "breaching") || "open";
  const { rows, error } = await listAdminTickets(tab);
  return (
    <main className="min-h-screen bg-[#fafafa] px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Support tickets</h1>
            <p className="mt-1 text-sm text-muted-foreground">Assign, reply, track SLA.</p>
          </div>
          <a href="/admin/cs/kpis" className="text-sm font-medium text-brand-500 hover:underline">
            KPIs →
          </a>
        </header>
        {error ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : (
          <CsQueueClient initialTab={tab} initialRows={rows ?? []} />
        )}
      </div>
    </main>
  );
}

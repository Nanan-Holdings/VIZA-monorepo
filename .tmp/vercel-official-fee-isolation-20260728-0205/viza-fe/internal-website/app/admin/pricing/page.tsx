import { listPricing } from "@/app/actions/package-pricing";
import { PricingClient } from "./_components/PricingClient";

export const dynamic = "force-dynamic";

export default async function AdminPricingPage() {
  const { rows, error } = await listPricing();
  return (
    <main className="min-h-screen bg-[#fafafa] px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">Package pricing</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live numbers consumer-facing. Staff overrides expire automatically.
          </p>
        </header>
        {error ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>
        ) : (
          <PricingClient initialRows={rows ?? []} />
        )}
      </div>
    </main>
  );
}

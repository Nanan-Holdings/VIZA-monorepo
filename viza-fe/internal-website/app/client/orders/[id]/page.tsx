import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface OrderRow {
  id: string;
  application_id: string;
  agency_fee_cents: number;
  govt_fee_cents: number;
  currency: string;
  status: string;
  paid_at: string | null;
  created_at: string;
}

interface LineRow {
  id: string;
  kind: string;
  amount_cents: number;
  currency: string;
  payee: string;
  description: string | null;
}

const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "TWD", "CLP", "ISK"]);

function formatAmount(cents: number, currency: string): string {
  const upper = currency.toUpperCase();
  if (ZERO_DECIMAL.has(upper)) return `${cents.toLocaleString()} ${upper}`;
  return `${(cents / 100).toFixed(2)} ${upper}`;
}

export default async function ClientOrderPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/client/login");

  const [{ data: order, error }, { data: lines }] = await Promise.all([
    supabase
      .from("order")
      .select(
        "id, application_id, agency_fee_cents, govt_fee_cents, currency, status, paid_at, created_at",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("order_line")
      .select("id, kind, amount_cents, currency, payee, description")
      .eq("order_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (error || !order) {
    return (
      <div className="w-full p-6 md:p-8 max-w-3xl mx-auto">
        <p className="text-sm text-[#6b6b6b]">Order not found.</p>
      </div>
    );
  }

  const ord = order as OrderRow;
  const lineRows = (lines ?? []) as LineRow[];
  const total =
    lineRows.length > 0
      ? lineRows.reduce((s, l) => s + l.amount_cents, 0)
      : ord.agency_fee_cents + ord.govt_fee_cents;

  return (
    <div className="w-full p-6 md:p-8 space-y-6 max-w-3xl mx-auto">
      <div>
        <Link
          href="/client/home"
          className="text-sm text-brand-500 hover:underline mb-1 inline-block"
        >
          &larr; Back
        </Link>
        <h1 className="text-2xl font-semibold text-[#232323]">Order {ord.id}</h1>
        <p className="text-sm text-[#6b6b6b]">
          Status: {ord.status} ·{" "}
          {ord.paid_at
            ? `paid ${new Date(ord.paid_at).toLocaleDateString()}`
            : `created ${new Date(ord.created_at).toLocaleDateString()}`}
        </p>
      </div>

      <div className="bg-white rounded-lg border border-[#efefef] shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-[#fafafa]">
              <th className="text-left px-3 py-2 font-medium text-[#6b6b6b]">Kind</th>
              <th className="text-left px-3 py-2 font-medium text-[#6b6b6b]">Description</th>
              <th className="text-left px-3 py-2 font-medium text-[#6b6b6b]">Payee</th>
              <th className="text-right px-3 py-2 font-medium text-[#6b6b6b]">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lineRows.map((l) => (
              <tr key={l.id} className="border-b last:border-0">
                <td className="px-3 py-2 font-mono text-xs text-[#232323]">{l.kind}</td>
                <td className="px-3 py-2 text-[#232323]">
                  {l.description ?? l.payee}
                </td>
                <td className="px-3 py-2 text-[#6b6b6b]">{l.payee}</td>
                <td className="px-3 py-2 text-right font-mono text-[#232323]">
                  {formatAmount(l.amount_cents, l.currency)}
                </td>
              </tr>
            ))}
            <tr className="bg-[#fafafa] font-medium">
              <td className="px-3 py-2" colSpan={3}>
                Total
              </td>
              <td className="px-3 py-2 text-right font-mono">
                {formatAmount(total, ord.currency)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <a
          href={`/api/orders/${ord.id}/receipt`}
          className="inline-flex items-center justify-center px-4 py-2 rounded-md border border-[#d1d5db] text-sm hover:bg-[#fafafa]"
        >
          Download receipt (PDF)
        </a>
        <details className="text-sm">
          <summary className="cursor-pointer text-brand-500 hover:underline">
            Need a B2B invoice with company + tax ID?
          </summary>
          <form
            method="get"
            action={`/api/orders/${ord.id}/receipt`}
            className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2"
          >
            <input type="hidden" name="mode" value="invoice" />
            <input
              name="company"
              placeholder="Company name"
              required
              className="px-3 py-2 border rounded text-sm"
            />
            <input
              name="tax_id"
              placeholder="Tax / VAT ID"
              required
              className="px-3 py-2 border rounded text-sm"
            />
            <input
              name="vat_percent"
              placeholder="VAT % (optional)"
              className="px-3 py-2 border rounded text-sm"
            />
            <input
              name="billing"
              placeholder="Billing address (optional)"
              className="px-3 py-2 border rounded text-sm"
            />
            <button
              type="submit"
              className="sm:col-span-2 px-4 py-2 rounded-md bg-black text-white text-sm"
            >
              Download invoice (PDF)
            </button>
          </form>
        </details>
      </div>
    </div>
  );
}

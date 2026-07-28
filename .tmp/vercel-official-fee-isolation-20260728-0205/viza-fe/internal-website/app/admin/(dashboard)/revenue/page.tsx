import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/rbac";
import { getRevenueDashboard } from "@/app/actions/revenue";

export const dynamic = "force-dynamic";

const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "TWD", "CLP", "ISK"]);

function formatAmount(cents: number, currency: string): string {
  const upper = currency.toUpperCase();
  if (ZERO_DECIMAL.has(upper)) return `${cents.toLocaleString()} ${upper}`;
  return `${(cents / 100).toFixed(2)} ${upper}`;
}

export default async function AdminRevenuePage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/admin/login");

  const dash = await getRevenueDashboard();

  return (
    <div className="w-full p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#232323]">Revenue</h1>
        <p className="text-sm text-[#6b6b6b]">
          Last 30 days · generated {new Date(dash.generatedAt).toLocaleString()}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-[#efefef] shadow-sm p-4">
          <p className="text-xs text-[#6b6b6b] uppercase tracking-wider">MRR (agency)</p>
          <p className="text-2xl font-semibold text-[#232323] mt-1">
            {formatAmount(dash.mrrCents, dash.mrrCurrency)}
          </p>
          <p className="text-xs text-[#6b6b6b] mt-1">{dash.ordersPaid30d} paid orders</p>
        </div>
        <div className="bg-white rounded-lg border border-[#efefef] shadow-sm p-4">
          <p className="text-xs text-[#6b6b6b] uppercase tracking-wider">Refunds (30d)</p>
          <p className="text-2xl font-semibold text-[#232323] mt-1">
            {formatAmount(dash.refundsCents30d, dash.mrrCurrency)}
          </p>
          <p className="text-xs text-[#6b6b6b] mt-1">
            {(dash.refundRate * 100).toFixed(2)}% refund rate
          </p>
        </div>
        <div className="bg-white rounded-lg border border-[#efefef] shadow-sm p-4">
          <p className="text-xs text-[#6b6b6b] uppercase tracking-wider">Packages active</p>
          <p className="text-2xl font-semibold text-[#232323] mt-1">{dash.packages.length}</p>
          <p className="text-xs text-[#6b6b6b] mt-1">distinct country / visa-type pairs paid</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[#efefef] shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-[#fafafa]">
          <h2 className="font-semibold text-[#232323]">Per-package gross margin</h2>
        </div>
        {dash.packages.length === 0 ? (
          <p className="p-6 text-sm text-[#9ca3af]">No paid orders in the last 30 days.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-white">
                  <th className="text-left px-3 py-2 font-medium text-[#6b6b6b]">Package</th>
                  <th className="text-right px-3 py-2 font-medium text-[#6b6b6b]">Orders paid</th>
                  <th className="text-right px-3 py-2 font-medium text-[#6b6b6b]">Agency revenue</th>
                  <th className="text-right px-3 py-2 font-medium text-[#6b6b6b]">3rd-party costs</th>
                  <th className="text-right px-3 py-2 font-medium text-[#6b6b6b]">Refunds</th>
                  <th className="text-right px-3 py-2 font-medium text-[#6b6b6b]">Gross margin</th>
                </tr>
              </thead>
              <tbody>
                {dash.packages.map((p) => (
                  <tr
                    key={`${p.country}|${p.visaType}`}
                    className="border-b last:border-0"
                  >
                    <td className="px-3 py-2 font-mono text-xs">
                      {p.country}/{p.visaType}
                    </td>
                    <td className="px-3 py-2 text-right">{p.ordersPaid}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatAmount(p.agencyRevenueCents, p.currency)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatAmount(p.thirdPartyCostsCents, p.currency)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatAmount(p.refundsCents, p.currency)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">
                      {formatAmount(p.grossMarginCents, p.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

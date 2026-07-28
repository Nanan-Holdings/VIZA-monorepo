import { PACKAGE_PRICING, type PackagePricing } from "@/lib/pricing";
import { listPackageSla, type PackageSlaRow } from "@/app/actions/sla";

export const dynamic = "force-dynamic";

const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "TWD", "CLP", "ISK"]);

function formatAmount(cents: number, currency: string): string {
  const upper = currency.toUpperCase();
  if (ZERO_DECIMAL.has(upper)) return `${cents.toLocaleString()} ${upper}`;
  return `${(cents / 100).toFixed(2)} ${upper}`;
}

function formatHours(h: number): string {
  if (h <= 48) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

function rowKey(p: PackagePricing): string {
  return `${p.country}|${p.visaType}`;
}

export default async function PricingPage() {
  const slaList = await listPackageSla();
  const slaByKey = new Map<string, PackageSlaRow>();
  for (const s of slaList) slaByKey.set(`${s.country}|${s.visaType}`, s);

  return (
    <div className="w-full p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-[#232323]">Pricing</h1>
        <p className="text-sm text-[#6b6b6b]">
          Agency fee + government fee + SLA per visa package. SLA values
          back-fill weekly from real submissions; until measured volume
          lands, the displayed numbers are seeded estimates.
        </p>
      </div>
      <div className="bg-white rounded-lg border border-[#efefef] shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-[#fafafa]">
              <th className="text-left px-3 py-2 font-medium text-[#6b6b6b]">Package</th>
              <th className="text-right px-3 py-2 font-medium text-[#6b6b6b]">Agency</th>
              <th className="text-right px-3 py-2 font-medium text-[#6b6b6b]">Government</th>
              <th className="text-right px-3 py-2 font-medium text-[#6b6b6b]">Median</th>
              <th className="text-right px-3 py-2 font-medium text-[#6b6b6b]">p95</th>
              <th className="text-right px-3 py-2 font-medium text-[#6b6b6b]">Source</th>
            </tr>
          </thead>
          <tbody>
            {PACKAGE_PRICING.map((p) => {
              const sla = slaByKey.get(rowKey(p));
              return (
                <tr key={rowKey(p)} className="border-b last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">
                    {p.country}/{p.visaType}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatAmount(p.agencyFeeCents, p.currency)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatAmount(p.govtFeeCents, p.currency)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {sla ? formatHours(sla.medianHours) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {sla ? formatHours(sla.p95Hours) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-[#6b6b6b]">
                    {sla
                      ? sla.source === "measured"
                        ? `${sla.sampleSize} samples`
                        : "estimate"
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[#6b6b6b]">
        Government fees are charged at cost. Currency varies by portal.
        SLA = wall-clock from agency-fee payment to visa delivery; outliers
        beyond p95 trigger an internal alert and a courtesy update to the
        applicant.
      </p>
    </div>
  );
}

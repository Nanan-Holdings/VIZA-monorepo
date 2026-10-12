import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface Row {
  country: string;
  status: "ok" | "degraded" | "down" | "unknown";
  http_status: number | null;
  latency_ms: number | null;
  note: string | null;
  error: string | null;
  last_run_at: string;
  probe_url: string | null;
}

const PILL_CLASS: Record<Row["status"], string> = {
  ok: "border-green-200 bg-green-50 text-green-700",
  degraded: "border-amber-200 bg-amber-50 text-amber-700",
  down: "border-red-200 bg-red-50 text-red-700",
  unknown: "border-gray-200 bg-gray-50 text-gray-600",
};

export default async function PortalHealthPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/admin/login");

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("portal_health")
    .select(
      "country, status, http_status, latency_ms, note, error, last_run_at, probe_url",
    )
    .order("country", { ascending: true });

  if (error) {
    return (
      <div className="w-full p-6 md:p-8">
        <p className="text-sm text-red-600">{error.message}</p>
      </div>
    );
  }
  const rows = (data ?? []) as Row[];
  const counts = rows.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="w-full p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#232323]">Portal health</h1>
        <p className="text-sm text-[#6b6b6b]">
          {rows.length} portals · ok {counts.ok ?? 0} · degraded{" "}
          {counts.degraded ?? 0} · down {counts.down ?? 0} · unknown{" "}
          {counts.unknown ?? 0}
        </p>
      </div>

      <div className="bg-white rounded-lg border border-[#efefef] shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-[#fafafa]">
              <th className="text-left px-3 py-2 font-medium text-[#6b6b6b]">Country</th>
              <th className="text-left px-3 py-2 font-medium text-[#6b6b6b]">Status</th>
              <th className="text-left px-3 py-2 font-medium text-[#6b6b6b]">HTTP</th>
              <th className="text-left px-3 py-2 font-medium text-[#6b6b6b]">Latency</th>
              <th className="text-left px-3 py-2 font-medium text-[#6b6b6b]">Last run</th>
              <th className="text-left px-3 py-2 font-medium text-[#6b6b6b]">Probe</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.country} className="border-b last:border-0">
                <td className="px-3 py-2 font-mono text-xs">{r.country}</td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${PILL_CLASS[r.status]}`}
                  >
                    {r.status}
                  </span>
                  {r.error ? (
                    <span className="block text-xs text-red-700 mt-1">{r.error}</span>
                  ) : null}
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {r.http_status ?? "—"}
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {r.latency_ms != null ? `${r.latency_ms}ms` : "—"}
                </td>
                <td className="px-3 py-2 text-xs text-[#6b6b6b]">
                  {new Date(r.last_run_at).toLocaleString()}
                </td>
                <td className="px-3 py-2">
                  {r.probe_url ? (
                    <a
                      href={r.probe_url}
                      className="text-xs text-brand-500 hover:underline truncate block max-w-[280px]"
                    >
                      {r.probe_url}
                    </a>
                  ) : (
                    <span className="text-xs text-[#9ca3af]">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

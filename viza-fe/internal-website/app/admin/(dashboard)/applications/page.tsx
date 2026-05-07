import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface SearchParams {
  status?: string;
  country?: string;
  q?: string;
}

interface Row {
  id: string;
  applicant_id: string;
  country: string;
  visa_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ApplicantLite {
  id: string;
  full_name: string | null;
  email: string | null;
}

const PAGE_SIZE = 100;

export default async function StaffApplicationsListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/admin/login");

  const admin = createAdminClient();
  let q = admin
    .from("applications")
    .select("id, applicant_id, country, visa_type, status, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(PAGE_SIZE);
  if (params.status) q = q.eq("status", params.status);
  if (params.country) q = q.eq("country", params.country);
  const { data: rows } = await q;
  const apps = (rows ?? []) as Row[];

  // Resolve applicant names in a single query.
  const ids = Array.from(new Set(apps.map((a) => a.applicant_id)));
  const { data: applicantRows } =
    ids.length === 0
      ? { data: [] as ApplicantLite[] }
      : await admin
          .from("applicant_profiles")
          .select("id, full_name, email")
          .in("id", ids);
  const byId = new Map<string, ApplicantLite>();
  for (const r of (applicantRows ?? []) as ApplicantLite[]) byId.set(r.id, r);

  // Cheap free-text filter on the resolved name + id.
  const term = (params.q ?? "").toLowerCase().trim();
  const filtered = term
    ? apps.filter((a) => {
        const ap = byId.get(a.applicant_id);
        return (
          a.id.toLowerCase().includes(term) ||
          (ap?.full_name ?? "").toLowerCase().includes(term) ||
          (ap?.email ?? "").toLowerCase().includes(term)
        );
      })
    : apps;

  // Distinct values for the filter dropdowns. Keep the existing
  // selections sticky so a Country filter doesn't disappear when the
  // Status filter narrows the set to zero.
  const distinctStatuses = Array.from(new Set(apps.map((a) => a.status))).sort();
  const distinctCountries = Array.from(new Set(apps.map((a) => a.country))).sort();

  return (
    <div className="w-full p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#232323]">Applications</h1>
        <p className="text-sm text-[#6b6b6b]">
          {filtered.length} of {apps.length} (latest {PAGE_SIZE} by updated_at)
        </p>
      </div>

      <form
        method="get"
        action="/admin/applications"
        className="flex flex-wrap gap-2"
      >
        <select
          name="status"
          defaultValue={params.status ?? ""}
          className="text-sm border rounded px-2 py-1"
        >
          <option value="">all statuses</option>
          {distinctStatuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          name="country"
          defaultValue={params.country ?? ""}
          className="text-sm border rounded px-2 py-1"
        >
          <option value="">all countries</option>
          {distinctCountries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          type="search"
          name="q"
          placeholder="search id / name / email"
          defaultValue={params.q ?? ""}
          className="text-sm border rounded px-2 py-1 flex-1"
        />
        <button
          type="submit"
          className="text-sm border rounded px-3 py-1 bg-black text-white"
        >
          Filter
        </button>
      </form>

      <div className="bg-white rounded-lg border border-[#efefef] shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <p className="p-6 text-sm text-[#9ca3af]">No matching applications.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-[#fafafa]">
                  <th className="text-left px-3 py-2 font-medium text-[#6b6b6b]">Updated</th>
                  <th className="text-left px-3 py-2 font-medium text-[#6b6b6b]">Applicant</th>
                  <th className="text-left px-3 py-2 font-medium text-[#6b6b6b]">Package</th>
                  <th className="text-left px-3 py-2 font-medium text-[#6b6b6b]">Status</th>
                  <th className="text-left px-3 py-2 font-medium text-[#6b6b6b]">Application id</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const ap = byId.get(a.applicant_id);
                  return (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="px-3 py-2 whitespace-nowrap text-[#232323]">
                        {new Date(a.updated_at).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 text-[#232323]">
                        <Link
                          href={`/admin/applications/${a.id}`}
                          className="text-brand-500 hover:underline"
                        >
                          {ap?.full_name ?? "(unnamed)"}
                        </Link>
                        <span className="block text-xs text-[#6b6b6b]">{ap?.email ?? "—"}</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {a.country}/{a.visa_type}
                      </td>
                      <td className="px-3 py-2 text-[#232323]">{a.status}</td>
                      <td className="px-3 py-2 font-mono text-xs text-[#6b6b6b]">
                        {a.id.slice(0, 8)}…
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

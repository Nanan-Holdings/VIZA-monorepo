import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface SecretAccessRow {
  id: number;
  applicant_id: string;
  key: string;
  action: string;
  actor: string;
  correlation_id: string | null;
  error_class: string | null;
  ts: string;
}

const ACTION_BADGE: Record<string, string> = {
  read: "bg-blue-50 text-blue-700 border border-blue-200",
  read_miss: "bg-amber-50 text-amber-700 border border-amber-200",
  write: "bg-green-50 text-green-700 border border-green-200",
  delete: "bg-red-50 text-red-700 border border-red-200",
};

export default async function AdminSecretAccessPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/admin/login");

  const adminClient = createAdminClient();

  const [profileRes, logRes] = await Promise.all([
    adminClient
      .from("applicant_profiles")
      .select("id, full_name, email")
      .eq("id", id)
      .single(),
    adminClient
      .from("secret_access_log")
      .select("id, applicant_id, key, action, actor, correlation_id, error_class, ts")
      .eq("applicant_id", id)
      .order("ts", { ascending: false })
      .limit(500),
  ]);

  const profile = profileRes.data;
  const rows = (logRes.data ?? []) as SecretAccessRow[];

  if (!profile) {
    return (
      <div className="w-full p-6 md:p-8">
        <p className="text-[#6b6b6b]">Applicant not found.</p>
        <Link
          href="/admin/users"
          className="text-brand-500 hover:underline mt-2 inline-block"
        >
          Back to users
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full p-6 md:p-8 space-y-6">
      <div>
        <Link
          href={`/admin/users/${id}`}
          className="text-sm text-brand-500 hover:underline mb-1 inline-block"
        >
          &larr; Back to {profile.full_name ?? "user"}
        </Link>
        <h1 className="text-2xl font-semibold text-[#232323]">
          Secret access log
        </h1>
        <p className="text-sm text-[#6b6b6b]">
          Read-only audit of every read / write / delete touching this
          applicant&apos;s credential vault. Showing the most recent 500
          entries. Plaintext and ciphertext are NEVER displayed here — this
          view is metadata only.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-[#efefef] shadow-sm overflow-hidden">
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-[#9ca3af]">
            No vault activity recorded for this applicant yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-[#fafafa]">
                  <th className="text-left px-3 py-2 font-medium text-[#6b6b6b]">When</th>
                  <th className="text-left px-3 py-2 font-medium text-[#6b6b6b]">Action</th>
                  <th className="text-left px-3 py-2 font-medium text-[#6b6b6b]">Key</th>
                  <th className="text-left px-3 py-2 font-medium text-[#6b6b6b]">Actor</th>
                  <th className="text-left px-3 py-2 font-medium text-[#6b6b6b]">Correlation</th>
                  <th className="text-left px-3 py-2 font-medium text-[#6b6b6b]">Error</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="px-3 py-2 text-[#232323] whitespace-nowrap">
                      {new Date(row.ts).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          ACTION_BADGE[row.action] ?? "bg-gray-50 text-gray-700 border border-gray-200"
                        }`}
                      >
                        {row.action}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-[#232323]">{row.key}</td>
                    <td className="px-3 py-2 text-[#6b6b6b]">{row.actor}</td>
                    <td className="px-3 py-2 font-mono text-xs text-[#6b6b6b]">
                      {row.correlation_id ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-red-600">
                      {row.error_class ?? "—"}
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

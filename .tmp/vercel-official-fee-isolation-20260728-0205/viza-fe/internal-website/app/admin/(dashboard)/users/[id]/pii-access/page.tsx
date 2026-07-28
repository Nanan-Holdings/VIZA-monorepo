import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface PiiRow {
  id: number;
  applicant_id: string;
  application_id: string | null;
  actor_user_id: string | null;
  actor: string;
  purpose: string;
  fields: string[];
  ip: string | null;
  ua: string | null;
  ts: string;
}

export default async function AdminPiiAccessPage({ params }: PageProps) {
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
      .from("pii_access_log")
      .select(
        "id, applicant_id, application_id, actor_user_id, actor, purpose, fields, ip, ua, ts",
      )
      .eq("applicant_id", id)
      .order("ts", { ascending: false })
      .limit(500),
  ]);

  const profile = profileRes.data;
  const rows = (logRes.data ?? []) as PiiRow[];

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
          &larr; Back to {profile.full_name ?? "applicant"}
        </Link>
        <h1 className="text-2xl font-semibold text-[#232323]">PII access log</h1>
        <p className="text-sm text-[#6b6b6b]">
          Read-only audit of every staff / system read of this
          applicant&apos;s passport, photo, or form-answer data. Most
          recent 500 entries.
        </p>
      </div>
      <div className="bg-white rounded-lg border border-[#efefef] shadow-sm overflow-hidden">
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-[#9ca3af]">
            No PII reads recorded yet for this applicant.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-[#fafafa]">
                  <th className="text-left px-3 py-2 font-medium text-[#6b6b6b]">When</th>
                  <th className="text-left px-3 py-2 font-medium text-[#6b6b6b]">Actor</th>
                  <th className="text-left px-3 py-2 font-medium text-[#6b6b6b]">Purpose</th>
                  <th className="text-left px-3 py-2 font-medium text-[#6b6b6b]">Fields</th>
                  <th className="text-left px-3 py-2 font-medium text-[#6b6b6b]">User</th>
                  <th className="text-left px-3 py-2 font-medium text-[#6b6b6b]">IP</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="px-3 py-2 text-[#232323] whitespace-nowrap">
                      {new Date(row.ts).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-[#232323]">{row.actor}</td>
                    <td className="px-3 py-2 text-[#6b6b6b]">{row.purpose}</td>
                    <td className="px-3 py-2 font-mono text-xs text-[#6b6b6b]">
                      {row.fields.join(", ")}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-[#6b6b6b]">
                      {row.actor_user_id ?? "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-[#6b6b6b]">
                      {row.ip ?? "—"}
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

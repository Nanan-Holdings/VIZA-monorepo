import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/rbac";
import { listStaffQueuedThreads } from "@/app/actions/staff-chat";

export const dynamic = "force-dynamic";

export default async function StaffChatQueuePage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/admin/login");
  const rows = await listStaffQueuedThreads();
  const queued = rows.filter((r) => r.status === "queued").length;
  const active = rows.filter((r) => r.status === "active").length;

  return (
    <div className="w-full p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#232323]">Staff chat queue</h1>
        <p className="text-sm text-[#6b6b6b]">
          {queued} queued · {active} active
        </p>
      </div>

      <div className="bg-white rounded-lg border border-[#efefef] shadow-sm overflow-hidden">
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-[#9ca3af]">No conversations open.</p>
        ) : (
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-[#232323]">
                      {r.applicantName ?? "(unnamed)"}
                      <span
                        className={`ml-2 text-xs px-2 py-0.5 rounded border ${
                          r.status === "queued"
                            ? "border-amber-200 bg-amber-50 text-amber-800"
                            : "border-blue-200 bg-blue-50 text-blue-700"
                        }`}
                      >
                        {r.status}
                      </span>
                    </p>
                    <p className="text-xs text-[#6b6b6b]">
                      {r.applicantEmail ?? "—"}
                      {r.applicationId ? (
                        <>
                          {" · "}
                          <Link
                            href={`/admin/applications/${r.applicationId}`}
                            className="text-brand-500 hover:underline"
                          >
                            {r.applicationStatus ?? "application"}
                          </Link>
                          {r.lastRunnerStep ? ` · last step: ${r.lastRunnerStep}` : null}
                        </>
                      ) : null}
                    </p>
                  </div>
                  <span className="text-xs text-[#6b6b6b]">
                    {new Date(r.lastMessageAt).toLocaleString()}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-xs text-[#6b6b6b]">
        Realtime updates land via the Supabase channel — refresh
        triggers a server-side reload of the queue.
      </p>
    </div>
  );
}

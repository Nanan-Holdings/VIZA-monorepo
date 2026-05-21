import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/rbac";
import { listOpenTakeovers } from "@/app/actions/takeover";

export const dynamic = "force-dynamic";

export default async function TakeoverQueuePage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/admin/login");
  const rows = await listOpenTakeovers();
  return (
    <div className="w-full p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#232323]">
          Operator takeovers
        </h1>
        <p className="text-sm text-[#6b6b6b]">
          {rows.length} open · revealing the live remote-debug URL
          requires a TOTP-verified session.
        </p>
      </div>
      <div className="bg-white rounded-lg border border-[#efefef] shadow-sm overflow-hidden">
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-[#9ca3af]">No open takeovers.</p>
        ) : (
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-[#232323]">{r.reason}</p>
                    <p className="text-xs text-[#6b6b6b]">
                      job{" "}
                      <Link
                        href={`/admin/jobs/${r.jobId}`}
                        className="text-brand-500 hover:underline font-mono"
                      >
                        {r.jobId.slice(0, 8)}
                      </Link>
                      {" · "}application{" "}
                      <Link
                        href={`/admin/applications/${r.applicationId}`}
                        className="text-brand-500 hover:underline font-mono"
                      >
                        {r.applicationId.slice(0, 8)}
                      </Link>
                      {r.claimedBy ? ` · claimed by ${r.claimedBy.slice(0, 8)}` : null}
                    </p>
                  </div>
                  <Link
                    href={`/admin/takeovers/${r.id}`}
                    className="text-xs px-3 py-1 rounded border border-black text-black hover:bg-black hover:text-white"
                  >
                    Open
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

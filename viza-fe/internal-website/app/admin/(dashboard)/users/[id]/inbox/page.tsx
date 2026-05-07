import { listApplicantInboxAsStaff, type InboxRow } from "@/app/actions/inbox";
import { sanitiseInboundHtml, escapeText } from "@/lib/inbox/sanitize-html";
import { getCurrentUser } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

function MessageBody({ row }: { row: InboxRow }) {
  if (row.html) {
    return (
      <div
        className="prose prose-sm max-w-none text-[#232323]"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: sanitiseInboundHtml(row.html) }}
      />
    );
  }
  if (row.text) {
    return (
      <pre className="whitespace-pre-wrap break-words text-sm text-[#232323] font-mono">
        {row.text}
      </pre>
    );
  }
  if (row.r2_key) {
    return (
      <p className="text-sm text-[#6b6b6b]">
        Body stored as attachment ({(row.raw_size / 1024).toFixed(1)} KB).
      </p>
    );
  }
  return <p className="text-sm text-[#9ca3af]">No body content.</p>;
}

export default async function StaffApplicantInboxPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/admin/login");

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("applicant_profiles")
    .select("id, full_name, email, inbox_alias")
    .eq("id", id)
    .single();

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

  const rows = await listApplicantInboxAsStaff(id, 200);

  return (
    <div className="w-full p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
      <div>
        <Link
          href={`/admin/users/${id}`}
          className="text-sm text-brand-500 hover:underline mb-1 inline-block"
        >
          &larr; Back to {profile.full_name ?? "applicant"}
        </Link>
        <h1 className="text-2xl font-semibold text-[#232323]">Applicant inbox</h1>
        <p className="text-sm text-[#6b6b6b] mt-1">
          Alias:{" "}
          {profile.inbox_alias ? (
            <span className="font-mono">{profile.inbox_alias}</span>
          ) : (
            <span className="italic">not assigned</span>
          )}{" "}
          · HTML rendered with remote images blocked.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-[#9ca3af]">
          No mail recorded for this applicant yet.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <article
              key={row.id}
              className="bg-white rounded-lg border border-[#efefef] shadow-sm overflow-hidden"
            >
              <header className="flex items-start justify-between gap-4 px-4 py-3 border-b bg-[#fafafa]">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-[#6b6b6b]">
                    {new Date(row.received_at).toLocaleString()} · from{" "}
                    <span className="font-mono">{escapeText(row.from_addr)}</span>
                    {row.spam_score != null
                      ? ` · spam ${row.spam_score.toFixed(2)}`
                      : ""}
                  </p>
                  <h3 className="text-base font-semibold text-[#232323] truncate">
                    {escapeText(row.subject ?? "(no subject)")}
                  </h3>
                </div>
                {row.r2_key ? (
                  <a
                    href={`/api/inbox/${row.id}/download`}
                    className="text-xs text-brand-500 hover:underline whitespace-nowrap"
                  >
                    Download .eml
                  </a>
                ) : null}
              </header>
              <div className="px-4 py-4">
                <MessageBody row={row} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

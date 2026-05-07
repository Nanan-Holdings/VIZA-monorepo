import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { RealtimeApplicationStatus } from "./realtime-status";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface RunnerJobRow {
  id: string;
  status: string;
  attempts: number;
  enqueued_at: string;
  started_at: string | null;
  finished_at: string | null;
  last_error: string | null;
}

interface OrderRow {
  id: string;
  status: string;
  agency_fee_cents: number;
  govt_fee_cents: number;
  currency: string;
  paid_at: string | null;
}

interface InboundRow {
  id: string;
  from_addr: string;
  subject: string | null;
  received_at: string;
  processed: boolean;
}

interface ApplicationRow {
  id: string;
  applicant_id: string;
  country: string;
  visa_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export default async function StaffApplicationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/admin/login");

  const admin = createAdminClient();

  const { data: app } = await admin
    .from("applications")
    .select("id, applicant_id, country, visa_type, status, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (!app) {
    return (
      <div className="w-full p-6 md:p-8">
        <p className="text-sm text-[#6b6b6b]">Application not found.</p>
      </div>
    );
  }
  const application = app as ApplicationRow;

  const { data: profile } = await admin
    .from("applicant_profiles")
    .select("id, full_name, email, inbox_alias")
    .eq("id", application.applicant_id)
    .single();

  const [{ data: jobs }, { data: orders }, inbound] = await Promise.all([
    admin
      .from("runner_job")
      .select("id, status, attempts, enqueued_at, started_at, finished_at, last_error")
      .eq("application_id", application.id)
      .order("enqueued_at", { ascending: false })
      .limit(20),
    admin
      .from("order")
      .select("id, status, agency_fee_cents, govt_fee_cents, currency, paid_at")
      .eq("application_id", application.id)
      .order("created_at", { ascending: false }),
    profile?.inbox_alias
      ? admin
          .from("inbound_email")
          .select("id, from_addr, subject, received_at, processed")
          .eq("to_addr", profile.inbox_alias.toLowerCase())
          .order("received_at", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] as InboundRow[] }),
  ]);

  const jobRows = (jobs ?? []) as RunnerJobRow[];
  const orderRows = (orders ?? []) as OrderRow[];
  const inboundRows = (inbound.data ?? []) as InboundRow[];

  return (
    <div className="w-full p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <Link
          href="/admin/applications"
          className="text-sm text-brand-500 hover:underline mb-1 inline-block"
        >
          &larr; Back to applications
        </Link>
        <h1 className="text-2xl font-semibold text-[#232323]">
          {profile?.full_name ?? "(unnamed)"}
        </h1>
        <p className="text-sm text-[#6b6b6b]">
          {profile?.email ?? "—"} · {application.country}/{application.visa_type}
        </p>
      </div>

      <RealtimeApplicationStatus
        applicationId={application.id}
        initialStatus={application.status}
      />

      <section className="bg-white rounded-lg border border-[#efefef] shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-[#fafafa]">
          <h2 className="font-semibold text-[#232323]">Runner timeline</h2>
        </div>
        {jobRows.length === 0 ? (
          <p className="p-6 text-sm text-[#9ca3af]">No runner jobs yet.</p>
        ) : (
          <ul className="divide-y">
            {jobRows.map((j) => (
              <li key={j.id} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <Link
                    href={`/admin/jobs/${j.id}`}
                    className="font-mono text-xs text-brand-500 hover:underline"
                  >
                    {j.id.slice(0, 8)}
                  </Link>
                  <span className="text-xs text-[#6b6b6b]">
                    {new Date(j.enqueued_at).toLocaleString()}
                  </span>
                </div>
                <div className="text-xs text-[#6b6b6b] mt-1">
                  {j.status} · attempts {j.attempts}
                  {j.last_error ? ` · ${j.last_error.slice(0, 80)}` : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white rounded-lg border border-[#efefef] shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-[#fafafa]">
          <h2 className="font-semibold text-[#232323]">Payment</h2>
        </div>
        {orderRows.length === 0 ? (
          <p className="p-6 text-sm text-[#9ca3af]">No order yet.</p>
        ) : (
          <ul className="divide-y">
            {orderRows.map((o) => (
              <li key={o.id} className="px-4 py-3 text-sm flex justify-between">
                <div>
                  <Link
                    href={`/client/orders/${o.id}`}
                    className="font-mono text-xs text-brand-500 hover:underline"
                  >
                    {o.id.slice(0, 8)}
                  </Link>
                  <span className="ml-2 text-[#6b6b6b]">{o.status}</span>
                </div>
                <span className="font-mono text-[#232323]">
                  {((o.agency_fee_cents + o.govt_fee_cents) / 100).toFixed(2)}{" "}
                  {o.currency}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white rounded-lg border border-[#efefef] shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-[#fafafa] flex justify-between items-center">
          <h2 className="font-semibold text-[#232323]">Inbox</h2>
          {profile?.inbox_alias ? (
            <span className="text-xs font-mono text-[#6b6b6b]">
              {profile.inbox_alias}
            </span>
          ) : (
            <span className="text-xs italic text-[#9ca3af]">no alias</span>
          )}
        </div>
        {inboundRows.length === 0 ? (
          <p className="p-6 text-sm text-[#9ca3af]">No mail.</p>
        ) : (
          <ul className="divide-y">
            {inboundRows.map((m) => (
              <li key={m.id} className="px-4 py-2 text-sm">
                <p className="font-medium text-[#232323]">
                  {m.subject ?? "(no subject)"}
                </p>
                <p className="text-xs text-[#6b6b6b]">
                  {new Date(m.received_at).toLocaleString()} · from {m.from_addr}
                  {m.processed ? " · processed" : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

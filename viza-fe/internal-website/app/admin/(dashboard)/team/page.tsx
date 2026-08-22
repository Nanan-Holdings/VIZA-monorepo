import Link from "next/link";
import { getLocale } from "next-intl/server";
import { AlertTriangle, ArrowRight, Users } from "lucide-react";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface StaffRow { id: string; name: string | null; email: string | null; role: string; created_at: string }
interface AssignedRow { assigned_to: string | null; status: string; due_at?: string | null }

const COPY = {
  en: { title: "Team & workload", subtitle: "Role visibility and accountable workload across operational queues.", staff: "Staff", openWork: "Open work", overdue: "Overdue", support: "Support tickets", leads: "Leads", unassigned: "Unassigned across queues", empty: "No staff accounts found.", openAccount: "Open account", unavailable: "Some workload sources are unavailable." },
  zh: { title: "团队与工作量", subtitle: "集中查看员工角色和各运营队列中的责任工作量。", staff: "员工", openWork: "处理中工作", overdue: "已超时", support: "客服工单", leads: "销售线索", unassigned: "各队列未分配", empty: "未找到员工账户。", openAccount: "打开账户", unavailable: "部分工作量数据不可用。" },
} as const;

function active(status: string) { return !["resolved", "cancelled", "closed", "converted", "lost"].includes(status); }

export default async function AdminTeamPage() {
  const locale = normalizeInterfaceLocale(await getLocale());
  const copy = COPY[locale];
  const admin = createAdminClient();
  const [staffResult, workResult, supportResult, leadsResult] = await Promise.all([
    admin.from("users").select("id, name, email, role, created_at").in("role", ["admin", "staff", "customer_service"]).is("deleted_at", null).order("name"),
    admin.from("admin_work_items").select("assigned_to, status, due_at").limit(1000),
    admin.from("support_ticket").select("assigned_to, status").limit(1000),
    admin.from("marketing_leads").select("assigned_to, status").limit(1000),
  ]);
  const errors = [staffResult, workResult, supportResult, leadsResult].map((result) => result.error?.message).filter((message): message is string => Boolean(message));
  const staff = (staffResult.data ?? []) as StaffRow[];
  const work = (workResult.data ?? []) as AssignedRow[];
  const support = (supportResult.data ?? []) as AssignedRow[];
  const leads = (leadsResult.data ?? []) as AssignedRow[];
  const now = new Date();
  const unassigned = [...work, ...support, ...leads].filter((row) => active(row.status) && !row.assigned_to).length;
  return <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
    <div><div className="flex items-center gap-2"><Users className="h-6 w-6 text-brand-500" /><h1 className="text-2xl font-semibold text-[#232323]">{copy.title}</h1></div><p className="mt-1 text-sm text-[#64748b]">{copy.subtitle}</p></div>
    {errors.length ? <details className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><summary className="cursor-pointer font-semibold">{copy.unavailable}</summary>{errors.map((error) => <p key={error} className="mt-1 font-mono text-xs">{error}</p>)}</details> : null}
    <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border bg-white p-4 shadow-sm"><p className="text-sm text-[#64748b]">{copy.staff}</p><p className="mt-2 text-3xl font-semibold">{staff.length}</p></div><Link href="/admin/work?view=unassigned" className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm"><p className="text-sm text-amber-800">{copy.unassigned}</p><p className="mt-2 text-3xl font-semibold text-amber-900">{unassigned}</p></Link></div>
    {staff.length === 0 ? <div className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-[#64748b]">{copy.empty}</div> : <div className="grid gap-4 lg:grid-cols-2">{staff.map((member) => { const memberWork = work.filter((row) => row.assigned_to === member.id && active(row.status)); const memberSupport = support.filter((row) => row.assigned_to === member.id && active(row.status)); const memberLeads = leads.filter((row) => row.assigned_to === member.id && active(row.status)); const overdue = memberWork.filter((row) => row.due_at && new Date(row.due_at) < now).length; return <article key={member.id} className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-[#232323]">{member.name || member.email || member.id}</h2><p className="mt-1 text-xs text-[#64748b]">{member.role} · {member.email}</p></div><Link href={`/admin/users/${member.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">{copy.openAccount}<ArrowRight className="h-3.5 w-3.5" /></Link></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded-lg bg-[#fafbfc] p-3"><p className="text-xs text-[#64748b]">{copy.openWork}</p><p className="mt-1 text-xl font-semibold">{memberWork.length}</p></div><div className={`rounded-lg p-3 ${overdue ? "bg-red-50" : "bg-[#fafbfc]"}`}><p className={`text-xs ${overdue ? "text-red-700" : "text-[#64748b]"}`}>{copy.overdue}</p><p className={`mt-1 text-xl font-semibold ${overdue ? "text-red-800" : ""}`}>{overdue}</p></div><div className="rounded-lg bg-[#fafbfc] p-3"><p className="text-xs text-[#64748b]">{copy.support}</p><p className="mt-1 text-xl font-semibold">{memberSupport.length}</p></div><div className="rounded-lg bg-[#fafbfc] p-3"><p className="text-xs text-[#64748b]">{copy.leads}</p><p className="mt-1 text-xl font-semibold">{memberLeads.length}</p></div></div>{overdue ? <p className="mt-3 text-xs font-semibold text-red-700"><AlertTriangle className="mr-1 inline h-3.5 w-3.5" />{overdue} {copy.overdue.toLowerCase()}</p> : null}</article>; })}</div>}
  </div>;
}

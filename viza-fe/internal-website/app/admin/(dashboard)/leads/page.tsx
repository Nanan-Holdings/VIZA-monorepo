import { getLocale } from "next-intl/server";
import { Clock3, Mail, MapPin, MessageSquare, Phone, UserPlus } from "lucide-react";
import { updateAdminLead } from "@/app/actions/admin-leads";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface LeadRow { id: string; full_name: string; email: string; phone: string | null; preferred_channel: string | null; passport_nationality: string | null; destination: string | null; reasons: unknown; message: string; locale: string | null; status: "new" | "contacted" | "qualified" | "converted" | "lost"; assigned_to: string | null; first_response_at: string | null; due_at: string; loss_reason: string | null; email_delivery_status: string; created_at: string }
interface StaffRow { id: string; name: string | null; email: string | null }

const COPY = {
  en: { title: "Lead pipeline", subtitle: "Marketing enquiries with ownership, first-response SLA, qualification, conversion, and loss reasons.", new: "New", overdue: "SLA overdue", unassigned: "Unassigned", converted: "Converted", empty: "No marketing enquiries found.", destination: "Destination", nationality: "Nationality", preferred: "Preferred channel", emailNotice: "Ops email", update: "Update lead", note: "Required contact note / decision reason", assign: "Assign to me", unavailable: "Lead pipeline is unavailable." },
  zh: { title: "销售线索流程", subtitle: "集中管理营销咨询的负责人、首次回复 SLA、资格判断、转化和流失原因。", new: "新线索", overdue: "已超时", unassigned: "未分配", converted: "已转化", empty: "暂无营销咨询。", destination: "目的地", nationality: "国籍", preferred: "首选渠道", emailNotice: "运营邮件", update: "更新线索", note: "必填的联系备注/决定原因", assign: "分配给我", unavailable: "销售线索流程不可用。" },
} as const;

function active(status: string) { return !["converted", "lost"].includes(status); }
function tone(status: string) { return status === "converted" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : status === "lost" ? "border-slate-200 bg-slate-50 text-slate-600" : status === "new" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-blue-200 bg-blue-50 text-blue-700"; }

export default async function AdminLeadsPage() {
  const locale = normalizeInterfaceLocale(await getLocale());
  const copy = COPY[locale];
  const admin = createAdminClient();
  const [{ data, error }, { data: staffData }] = await Promise.all([
    admin.from("marketing_leads").select("*").order("created_at", { ascending: false }).limit(250),
    admin.from("users").select("id, name, email").in("role", ["admin", "staff", "customer_service"]).is("deleted_at", null),
  ]);
  const leads = (data ?? []) as LeadRow[];
  const staff = new Map(((staffData ?? []) as StaffRow[]).map((row) => [row.id, row.name || row.email || row.id.slice(0, 8)]));
  const now = new Date();
  const metrics = { new: leads.filter((lead) => lead.status === "new").length, overdue: leads.filter((lead) => active(lead.status) && new Date(lead.due_at) < now).length, unassigned: leads.filter((lead) => active(lead.status) && !lead.assigned_to).length, converted: leads.filter((lead) => lead.status === "converted").length };
  async function update(formData: FormData) { "use server"; await updateAdminLead({ leadId: String(formData.get("leadId")), status: String(formData.get("status")) as LeadRow["status"], reason: String(formData.get("reason")), assignToMe: formData.get("assignToMe") === "1" }); }
  return <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
    <div><div className="flex items-center gap-2"><UserPlus className="h-6 w-6 text-brand-500" /><h1 className="text-2xl font-semibold text-[#232323]">{copy.title}</h1></div><p className="mt-1 text-sm text-[#64748b]">{copy.subtitle}</p></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[[copy.new, metrics.new], [copy.overdue, metrics.overdue], [copy.unassigned, metrics.unassigned], [copy.converted, metrics.converted]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-[#e5e7eb] bg-white p-4 shadow-sm"><p className="text-sm text-[#64748b]">{label}</p><p className="mt-2 text-3xl font-semibold text-[#232323]">{value}</p></div>)}</div>
    {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"><strong>{copy.unavailable}</strong><p className="mt-1 font-mono text-xs">{error.message}</p></div> : leads.length === 0 ? <div className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-[#64748b]">{copy.empty}</div> : <div className="space-y-4">{leads.map((lead) => { const overdue = active(lead.status) && new Date(lead.due_at) < now; return <article key={lead.id} className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${tone(lead.status)}`}>{lead.status}</span><h2 className="font-semibold text-[#232323]">{lead.full_name}</h2>{overdue ? <span className="text-xs font-semibold text-red-700"><Clock3 className="mr-1 inline h-3.5 w-3.5" />{copy.overdue}</span> : null}</div><div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#64748b]"><a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1 hover:text-brand-600"><Mail className="h-3.5 w-3.5" />{lead.email}</a>{lead.phone ? <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 hover:text-brand-600"><Phone className="h-3.5 w-3.5" />{lead.phone}</a> : null}<span><MapPin className="mr-1 inline h-3.5 w-3.5" />{copy.destination}: {lead.destination || "—"}</span><span>{copy.nationality}: {lead.passport_nationality || "—"}</span><span>{copy.preferred}: {lead.preferred_channel || "—"}</span></div></div><div className="text-right text-xs text-[#64748b]"><p>{lead.assigned_to ? staff.get(lead.assigned_to) || lead.assigned_to.slice(0, 8) : copy.unassigned}</p><p className="mt-1">{copy.emailNotice}: {lead.email_delivery_status}</p></div></div><div className="mt-4 rounded-lg bg-[#fafbfc] p-4"><p className="text-sm leading-6 text-[#475569]"><MessageSquare className="mr-2 inline h-4 w-4 text-brand-500" />{lead.message}</p></div>{active(lead.status) ? <form action={update} className="mt-4 grid gap-2 md:grid-cols-[180px_1fr_auto]"><input type="hidden" name="leadId" value={lead.id} /><select name="status" defaultValue={lead.status} className="h-9 rounded-md border px-3 text-sm"><option value="new">new</option><option value="contacted">contacted</option><option value="qualified">qualified</option><option value="converted">converted</option><option value="lost">lost</option></select><input name="reason" required placeholder={copy.note} className="h-9 rounded-md border px-3 text-sm" /><div className="flex gap-2">{!lead.assigned_to ? <button name="assignToMe" value="1" className="h-9 rounded-md border px-3 text-sm font-semibold">{copy.assign}</button> : null}<button className="h-9 rounded-md bg-brand-500 px-4 text-sm font-semibold text-white">{copy.update}</button></div></form> : null}</article>; })}</div>}
  </div>;
}

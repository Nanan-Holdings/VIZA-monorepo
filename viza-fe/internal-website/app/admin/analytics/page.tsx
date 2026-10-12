import { getLocale } from "next-intl/server";
import { BarChart3, ExternalLink } from "lucide-react";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const COPY = {
  en: { title: "Operational funnel", subtitle: "Thirty-day database-backed volume from marketing enquiry to successful submission.", leads: "Marketing enquiries", profiles: "Applicant profiles created", applications: "Applications created", paid: "Paid orders", submitted: "Successful submissions", caveat: "These are operational stage volumes, not a cohort conversion report. Use PostHog for identity-safe behavioral analysis.", posthog: "Open PostHog", unavailable: "Some funnel sources are unavailable." },
  zh: { title: "运营漏斗", subtitle: "过去 30 天从营销咨询到成功提交的数据库实际数量。", leads: "营销咨询", profiles: "创建客户档案", applications: "创建申请", paid: "已付款订单", submitted: "成功提交", caveat: "这些是各阶段运营数量，并非同一批客户的转化率报告。行为分析请使用保护身份信息的 PostHog。", posthog: "打开 PostHog", unavailable: "部分漏斗数据源不可用。" },
} as const;

export default async function AdminAnalyticsPage() {
  const locale = normalizeInterfaceLocale(await getLocale());
  const copy = COPY[locale];
  const admin = createAdminClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
  const [leads, profiles, applications, paid, submitted] = await Promise.all([
    admin.from("marketing_leads").select("id", { count: "exact", head: true }).gte("created_at", since),
    admin.from("applicant_profiles").select("id", { count: "exact", head: true }).gte("created_at", since),
    admin.from("applications").select("id", { count: "exact", head: true }).gte("created_at", since),
    admin.from("order").select("id", { count: "exact", head: true }).in("status", ["paid", "submitted", "completed"]).gte("paid_at", since),
    admin.from("runner_job").select("id", { count: "exact", head: true }).eq("status", "succeeded").gte("finished_at", since),
  ]);
  const sources = [leads, profiles, applications, paid, submitted];
  const errors = sources.map((source) => source.error?.message).filter((message): message is string => Boolean(message));
  const funnel = [
    { label: copy.leads, count: leads.count ?? 0 },
    { label: copy.profiles, count: profiles.count ?? 0 },
    { label: copy.applications, count: applications.count ?? 0 },
    { label: copy.paid, count: paid.count ?? 0 },
    { label: copy.submitted, count: submitted.count ?? 0 },
  ];
  const max = Math.max(1, ...funnel.map((stage) => stage.count));
  return <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-8">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><BarChart3 className="h-6 w-6 text-brand-500" /><h1 className="text-2xl font-semibold text-[#232323]">{copy.title}</h1></div><p className="mt-1 text-sm text-[#64748b]">{copy.subtitle}</p></div><a href={process.env.NEXT_PUBLIC_POSTHOG_DASHBOARD_URL || "https://app.posthog.com"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">{copy.posthog}<ExternalLink className="h-3.5 w-3.5" /></a></div>
    {errors.length ? <details className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><summary className="cursor-pointer font-semibold">{copy.unavailable}</summary>{errors.map((error) => <p key={error} className="mt-1 font-mono text-xs">{error}</p>)}</details> : null}
    <ol className="space-y-3">{funnel.map((stage) => <li key={stage.label} className="rounded-xl border border-[#e5e7eb] bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-4"><span className="text-sm font-medium text-[#334155]">{stage.label}</span><span className="font-mono text-2xl font-semibold text-brand-600">{stage.count}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[#edf0f4]"><div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(stage.count ? 4 : 0, Math.round((stage.count / max) * 100))}%` }} /></div></li>)}</ol>
    <p className="rounded-lg bg-[#fafbfc] p-3 text-xs leading-5 text-[#64748b]">{copy.caveat}</p>
  </div>;
}

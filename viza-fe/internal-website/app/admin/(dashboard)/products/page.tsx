import Link from "next/link";
import { getLocale } from "next-intl/server";
import { AlertTriangle, ArrowRight, FileCheck2, Map, Package, Tags } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const COPY = {
  en: {
    title: "Catalogue control",
    subtitle: "The operational source of truth for what VIZA can sell, collect, price, submit, and support.",
    packages: "Visa packages",
    prices: "Pricing records",
    fields: "Form fields",
    documents: "Document rules",
    coverage: "Coverage matrix",
    coverageBody: "Verify schema, documents, payment, packet, handoff, result, and status-UI readiness.",
    pricing: "Pricing controls",
    pricingBody: "Manage auditable, expiring pricing overrides used by the internal application.",
    marketing: "Marketing publication",
    marketingBody: "Prepare public metadata and SGD display pricing, resolve readiness blockers, then publish or retire an auditable marketing snapshot.",
    open: "Open",
    unavailable: "Some catalogue sources are unavailable.",
  },
  zh: {
    title: "产品目录控制",
    subtitle: "统一管理 VIZA 可以销售、收集资料、定价、提交和支持的产品能力。",
    packages: "签证产品",
    prices: "定价记录",
    fields: "表单字段",
    documents: "文件规则",
    coverage: "覆盖矩阵",
    coverageBody: "核对表单、文件、支付、材料包、外部交接、结果和状态界面的完整性。",
    pricing: "定价控制",
    pricingBody: "管理可审计、会自动过期的内部定价覆盖。",
    marketing: "营销发布",
    marketingBody: "准备公开资料和新币展示价格，解决就绪阻塞项，再发布或下架可审计的营销快照。",
    open: "打开",
    unavailable: "部分产品目录数据无法加载。",
  },
} as const;

function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: LucideIcon }) {
  return <div className="rounded-xl border border-[#e5e7eb] bg-white p-4 shadow-sm"><div className="flex items-center justify-between text-sm text-[#64748b]"><span>{label}</span><Icon className="h-4 w-4 text-brand-500" /></div><p className="mt-2 text-3xl font-semibold text-[#232323]">{value}</p></div>;
}
export default async function CatalogueControlPage() {
  const locale = normalizeInterfaceLocale(await getLocale());
  const copy = COPY[locale];
  const admin = createAdminClient();
  const [packages, prices, fields, documents] = await Promise.all([
    admin.from("visa_packages").select("id").limit(1000),
    admin.from("package_pricing").select("id").limit(1000),
    admin.from("visa_form_fields").select("id").limit(1000),
    admin.from("document_requirements").select("id").limit(1000),
  ]);
  const errors = [packages, prices, fields, documents].map((result) => result.error?.message).filter((message): message is string => Boolean(message));
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
      <div><div className="flex items-center gap-2"><Package className="h-6 w-6 text-brand-500" /><h1 className="text-2xl font-semibold text-[#232323]">{copy.title}</h1></div><p className="mt-1 text-sm text-[#64748b]">{copy.subtitle}</p></div>
      {errors.length ? <details className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><summary className="cursor-pointer font-semibold">{copy.unavailable}</summary>{errors.map((error) => <p key={error} className="mt-1 font-mono text-xs">{error}</p>)}</details> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label={copy.packages} value={packages.data?.length ?? 0} icon={Package} /><Metric label={copy.prices} value={prices.data?.length ?? 0} icon={Tags} /><Metric label={copy.fields} value={fields.data?.length ?? 0} icon={FileCheck2} /><Metric label={copy.documents} value={documents.data?.length ?? 0} icon={FileCheck2} /></div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Link href="/admin/packages" className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm transition hover:border-brand-200"><Map className="h-5 w-5 text-brand-500" /><h2 className="mt-3 font-semibold text-[#232323]">{copy.coverage}</h2><p className="mt-2 text-sm leading-6 text-[#64748b]">{copy.coverageBody}</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600">{copy.open}<ArrowRight className="h-3.5 w-3.5" /></span></Link>
        <Link href="/admin/pricing" className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm transition hover:border-brand-200"><Tags className="h-5 w-5 text-brand-500" /><h2 className="mt-3 font-semibold text-[#232323]">{copy.pricing}</h2><p className="mt-2 text-sm leading-6 text-[#64748b]">{copy.pricingBody}</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600">{copy.open}<ArrowRight className="h-3.5 w-3.5" /></span></Link>
        <Link href="/admin/catalogue-publication" className="rounded-xl border border-amber-200 bg-amber-50 p-5 transition hover:border-amber-300"><AlertTriangle className="h-5 w-5 text-amber-600" /><h2 className="mt-3 font-semibold text-amber-950">{copy.marketing}</h2><p className="mt-2 text-sm leading-6 text-amber-800">{copy.marketingBody}</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-amber-800">{copy.open}<ArrowRight className="h-3.5 w-3.5" /></span></Link>
      </div>
    </div>
  );
}

import { Globe2, ShieldCheck } from "lucide-react";
import { getLocale } from "next-intl/server";
import { CataloguePublicationCard } from "./catalogue-publication-card";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPublicCataloguePayload, type CatalogueReadiness, type PublicCataloguePayload } from "@/lib/admin/catalogue";

export const dynamic = "force-dynamic";

const COPY = {
  en: {
    title: "Marketing catalogue publication",
    subtitle: "Prepare public metadata and pricing, resolve launch blockers, then publish an immutable snapshot. Draft changes never alter the live marketing site.",
    guardrail: "Only published snapshots can appear as available or enter checkout. Retiring a snapshot removes its sale eligibility without deleting history.",
    unavailable: "Publication data is unavailable. Apply the catalogue migration before using this control.",
    empty: "No active visa packages exist.",
    canonicalPricing: "Internal pricing source",
    draftFields: "Draft public listing",
    saveDraft: "Save & check readiness",
    publish: "Publish snapshot",
    retire: "Retire from sale",
    reason: "Required operational reason",
    featured: "Featured destination",
    blockers: "blockers",
    warnings: "warnings",
    ready: "Ready to publish",
    publishedAt: "Published",
    pending: "Retirement becomes available after publication.",
    saved: "Saved successfully.",
    fields: { slug: "Slug", portalCountry: "Portal country", publicName: "Public name", city: "City / summary", flagCode: "Flag ISO-2", publicType: "Public type", visaType: "Portal visa type", validity: "Validity", image: "Hero asset path", tag: "Tag", governmentFee: "Government fee (SGD cents)", agencyFee: "Agency fee (SGD cents)", discount: "First-time discount (SGD cents)" },
    statuses: { draft: "Draft", published: "Published", retired: "Retired", not_started: "Not started" },
  },
  zh: {
    title: "营销产品发布",
    subtitle: "准备公开资料和价格、解决上线阻塞项，然后发布不可变快照。草稿修改不会影响线上营销网站。",
    guardrail: "只有已发布的快照才能显示为可申请并进入结账。下架会停止销售，但不会删除历史记录。",
    unavailable: "发布数据不可用。请先应用产品目录数据库迁移。",
    empty: "暂无启用中的签证产品。",
    canonicalPricing: "内部定价来源",
    draftFields: "公开产品草稿",
    saveDraft: "保存并检查就绪状态",
    publish: "发布快照",
    retire: "停止销售",
    reason: "必填运营原因",
    featured: "精选目的地",
    blockers: "个阻塞项",
    warnings: "个警告",
    ready: "可以发布",
    publishedAt: "发布时间",
    pending: "发布后才可执行下架。",
    saved: "保存成功。",
    fields: { slug: "网址标识", portalCountry: "门户国家代码", publicName: "公开名称", city: "城市/摘要", flagCode: "国旗 ISO-2 代码", publicType: "公开类型", visaType: "门户签证类型", validity: "有效期", image: "主视觉资源路径", tag: "标签", governmentFee: "政府费用（新币分）", agencyFee: "服务费（新币分）", discount: "首次申请优惠（新币分）" },
    statuses: { draft: "草稿", published: "已发布", retired: "已下架", not_started: "未开始" },
  },
} as const;

interface PackageRow {
  id: string;
  country: string;
  visa_type: string;
  name: string;
  is_active: boolean;
}

interface PricingRow {
  visa_package_id: string;
  currency: string;
  government_fee_cents: number;
  agency_fee_cents: number;
}

interface PublicationRow {
  visa_package_id: string;
  status: "draft" | "published" | "retired";
  version: number;
  draft_payload: unknown;
  readiness: unknown;
  published_at: string | null;
}

const FLAG_BY_COUNTRY: Record<string, string> = {
  australia: "au", canada: "ca", egypt: "eg", france: "fr", india: "in", indonesia: "id",
  italy: "it", japan: "jp", malaysia: "my", saudi_arabia: "sa", thailand: "th", turkey: "tr",
  united_arab_emirates: "ae", united_kingdom: "gb", united_states: "us", vietnam: "vn", viza_test: "sg",
};

function defaultPayload(pkg: PackageRow, pricing?: PricingRow): PublicCataloguePayload {
  const slug = pkg.country.replaceAll("_", "-");
  return {
    slug,
    portalCountry: pkg.country,
    name: pkg.name,
    city: "",
    flagCode: FLAG_BY_COUNTRY[pkg.country] ?? "",
    type: pkg.visa_type,
    visaType: pkg.visa_type,
    validity: "",
    image: `/assets/heroes/${slug}.jpg`,
    tag: "evisa",
    featured: false,
    pricing: {
      currency: "SGD",
      governmentFeeMinor: pricing?.government_fee_cents ?? 0,
      agencyFeeMinor: pricing?.agency_fee_cents ?? 0,
      firstTimeDiscountMinor: 0,
    },
  };
}

function parseReadiness(value: unknown): CatalogueReadiness {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { blockers: [], warnings: [], evidence: {} };
  const row = value as Record<string, unknown>;
  return {
    blockers: Array.isArray(row.blockers) ? row.blockers.filter((item): item is string => typeof item === "string") : [],
    warnings: Array.isArray(row.warnings) ? row.warnings.filter((item): item is string => typeof item === "string") : [],
    evidence: row.evidence && typeof row.evidence === "object" && !Array.isArray(row.evidence) ? row.evidence as Record<string, unknown> : {},
  };
}

export default async function CataloguePublicationPage() {
  const locale = normalizeInterfaceLocale(await getLocale());
  const copy = COPY[locale];
  const admin = createAdminClient();
  const [packagesResult, pricingResult, publicationsResult] = await Promise.all([
    admin.from("visa_packages").select("id, country, visa_type, name, is_active").eq("is_active", true).order("country"),
    admin.from("package_pricing").select("visa_package_id, currency, government_fee_cents, agency_fee_cents"),
    admin.from("catalogue_publications").select("visa_package_id, status, version, draft_payload, readiness, published_at"),
  ]);
  const errors = [packagesResult.error, pricingResult.error, publicationsResult.error].filter(Boolean);
  const packages = (packagesResult.data ?? []) as PackageRow[];
  const pricing = new Map(((pricingResult.data ?? []) as PricingRow[]).map((row) => [row.visa_package_id, row]));
  const publications = new Map(((publicationsResult.data ?? []) as PublicationRow[]).map((row) => [row.visa_package_id, row]));

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-8">
      <header><div className="flex items-center gap-2"><Globe2 className="h-6 w-6 text-brand-500" /><h1 className="text-2xl font-semibold text-[#232323]">{copy.title}</h1></div><p className="mt-2 max-w-4xl text-sm leading-6 text-[#64748b]">{copy.subtitle}</p></header>
      <div className="flex gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm leading-6 text-[#334155]"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" /><p>{copy.guardrail}</p></div>
      {errors.length ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><strong>{copy.unavailable}</strong>{errors.map((error, index) => <p key={index} className="mt-1 font-mono text-xs">{error?.message}</p>)}</div> : null}
      {!packages.length ? <div className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-[#64748b]">{copy.empty}</div> : <div className="space-y-5">{packages.map((pkg) => {
        const sourcePrice = pricing.get(pkg.id);
        const publication = publications.get(pkg.id);
        const payload = publication && isPublicCataloguePayload(publication.draft_payload) ? publication.draft_payload : defaultPayload(pkg, sourcePrice);
        const canonicalPricing = sourcePrice ? `${(sourcePrice.government_fee_cents / 100).toFixed(2)} + ${(sourcePrice.agency_fee_cents / 100).toFixed(2)} ${sourcePrice.currency}` : "missing";
        return <CataloguePublicationCard key={pkg.id} packageId={pkg.id} packageLabel={`${pkg.country} · ${pkg.visa_type} · ${pkg.name}`} canonicalPricing={canonicalPricing} status={publication?.status ?? "not_started"} version={publication?.version ?? 0} publishedAt={publication?.published_at ?? null} payload={payload} readiness={parseReadiness(publication?.readiness)} copy={copy} />;
      })}</div>}
    </div>
  );
}

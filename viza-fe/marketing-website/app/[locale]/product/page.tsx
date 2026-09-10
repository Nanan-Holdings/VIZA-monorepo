import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";

export default async function ProductPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const zh = locale === "zh-CN";
  return <><SiteNav /><main className="mx-auto max-w-3xl px-6 py-20"><h1 className="text-4xl font-semibold text-fg-1">{zh ? "VIZA 如何协助您的签证申请" : "How VIZA supports your visa application"}</h1><p className="mt-6 text-lg leading-8 text-fg-2">{zh ? "了解可用的签证申请准备、材料核对和申请进度服务。具体服务范围、费用和可用性会在您选择目的地后明确显示。" : "Explore available visa preparation, document review, and application-status services. Exact scope, pricing, and availability are shown after you choose a destination."}</p><a className="mt-10 inline-flex rounded-full bg-brand-500 px-5 py-3 font-medium text-white" href="/">{zh ? "浏览目的地" : "Browse destinations"}</a></main><SiteFooter /></>;
}

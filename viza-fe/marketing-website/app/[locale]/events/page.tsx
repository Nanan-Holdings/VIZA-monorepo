import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";

export default async function EventsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const zh = locale === "zh-CN";
  return <><SiteNav activeTab="events" /><main className="mx-auto max-w-3xl px-6 py-20"><h1 className="text-4xl font-semibold text-fg-1">{zh ? "暂时还没有活动" : "No events yet"}</h1><p className="mt-6 text-lg leading-8 text-fg-2">{zh ? "未来的签证讲座、咨询会和合作活动会在这里发布。" : "Future visa clinics, information sessions, and partner events will be announced here."}</p><a className="mt-10 inline-flex rounded-full bg-brand-500 px-5 py-3 font-medium text-white" href="/contact">{zh ? "联系我们" : "Contact us"}</a></main><SiteFooter /></>;
}

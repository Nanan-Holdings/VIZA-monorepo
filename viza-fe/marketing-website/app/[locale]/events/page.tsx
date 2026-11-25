import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { staticPageMetadata } from "@/lib/seo/page-meta";
import SiteHeader from "@/design-system/sections/SiteHeader";
import SiteFooter from "@/design-system/sections/SiteFooter";
import PageIntro from "@/design-system/sections/PageIntro";
import Button from "@/design-system/ui/Button";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return staticPageMetadata(params, "events", "/events", { noindex: true });
}

export default async function EventsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const zh = locale === "zh-CN";
  return (
    <>
      <SiteHeader />
      <main className="ds-main">
        <PageIntro
          title={zh ? "暂时还没有活动" : "No events yet"}
          lede={zh ? "未来的签证讲座、咨询会和合作活动会在这里发布。" : "Future visa clinics, information sessions, and partner events will be announced here."}
          actions={<Button href="/contact">{zh ? "联系我们" : "Contact us"}</Button>}
        />
        <div className="ds-intro-body" />
      </main>
      <SiteFooter />
    </>
  );
}

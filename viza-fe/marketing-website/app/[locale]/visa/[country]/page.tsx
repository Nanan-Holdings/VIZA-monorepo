import type { Metadata } from "next";
import VisaCountryPageClient from "@/components/VisaCountryPageClient";
import { COUNTRIES } from "@/lib/countries";
import { getPublishedCatalogue } from "@/lib/public-catalogue";

/** Destination-specific metadata is resolved server-side for search crawlers. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; country: string }>;
}): Promise<Metadata> {
  const { locale, country: slug } = await params;
  const published = await getPublishedCatalogue();
  const entry = published.find((item) => item.slug === slug);
  const fallback = COUNTRIES.find((item) => item.slug === slug);
  const name = entry?.name ?? fallback?.name;
  const type = entry?.type ?? fallback?.type ?? "visa";
  const path = `/visa/${slug}`;
  const localizedPath = locale === "zh-CN" ? `/zh-CN${path}` : path;

  if (!name) {
    return {
      title: "Visa service coming soon",
      robots: { index: false, follow: false },
    };
  }

  const isChinese = locale === "zh-CN";
  const title = isChinese ? `${name}${type}申请` : `${name} ${type} application`;
  const description = isChinese
    ? `通过 VIZA 准备${name}${type}申请：AI 指引、材料核对与人工协助。VIZA 是独立签证服务商，并非政府网站。`
    : `Prepare your ${name} ${type} application with VIZA: AI guidance, document checks, and human support. VIZA is an independent visa service, not a government website.`;

  return {
    title,
    description,
    alternates: {
      canonical: localizedPath,
      languages: { en: path, "zh-CN": `/zh-CN${path}` },
    },
    openGraph: { title, description, url: localizedPath },
  };
}

export default function VisaCountryPage() {
  return <VisaCountryPageClient />;
}

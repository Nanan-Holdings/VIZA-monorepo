import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import LegalDocument from "@/design-system/sections/LegalDocument";
import { staticPageMetadata } from "@/lib/seo/page-meta";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return staticPageMetadata(params, "businessInformation", "/business-information", { ogKey: "businessInformation" });
}

export default async function BusinessInformationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalDocument slug="business-information" locale={locale} />;
}

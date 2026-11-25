import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { pageMetadata } from "@/lib/seo/metadata";
import ApplyClient from "./ApplyClient";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.apply" });
  // The wizard is a tool behind the destination pages, not a search landing page.
  return pageMetadata({ title: t("title"), description: t("description"), path: "/apply", locale, ogKey: "apply", noindex: true });
}

export default async function ApplyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ApplyClient />;
}

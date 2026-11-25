import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { staticPageMetadata } from "@/lib/seo/page-meta";
import ExplorePage from "./ExplorePage";

// The explore UI is a client component, so the homepage metadata lives in this
// server wrapper. `pages.home.title` / `pages.home.description` are metadata
// only; the visible hero copy uses `heroTitle` / `heroLede`.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return staticPageMetadata(params, "home", "/");
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ExplorePage />;
}

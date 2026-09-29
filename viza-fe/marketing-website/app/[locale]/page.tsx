import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import ExplorePage from "./ExplorePage";

// The explore UI is a client component, so the homepage metadata lives in this
// server wrapper. `pages.home.title` / `pages.home.description` are metadata
// only; the visible hero copy uses `heroTitle` / `heroLede`.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.home" });
  const title = t("title");
  const description = t("description");
  return {
    // The title already carries the brand, so skip the root "%s · VIZA" template.
    title: { absolute: title },
    description,
    openGraph: {
      type: "website",
      siteName: "VIZA",
      title,
      description,
    },
  };
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

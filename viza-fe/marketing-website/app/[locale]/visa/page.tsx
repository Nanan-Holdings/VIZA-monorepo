import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { COUNTRIES, isPublished, visaHref } from "@/lib/countries";
import { staticPageMetadata } from "@/lib/seo/page-meta";
import { SITE_URL } from "@/lib/seo/site";
import { buildLocalePath } from "@/lib/locales";
import SiteHeader from "@/design-system/sections/SiteHeader";
import SiteFooter from "@/design-system/sections/SiteFooter";
import DestinationGallery from "@/design-system/sections/DestinationGallery";
import CtaBand from "@/design-system/sections/CtaBand";

// `pages.visaIndex` holds the title and description; the visible H1 is rendered by the gallery (asPage).
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return staticPageMetadata(params, "visaIndex", "/visa");
}

export default async function VisaIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "homePage" });
  const tAll = await getTranslations({ locale });

  const published = COUNTRIES.filter(isPublished);
  const url = `${SITE_URL}${buildLocalePath(locale, "/visa")}`;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: tAll("pages.visaIndex.heroTitle"),
      description: tAll("pages.visaIndex.description"),
      url,
      isPartOf: { "@id": `${SITE_URL}/#website` },
      mainEntity: {
        "@type": "ItemList",
        itemListElement: published.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${SITE_URL}${buildLocalePath(locale, visaHref(c.slug))}`,
          name: tAll.has(`countries.${c.slug}`) ? tAll(`countries.${c.slug}`) : c.name,
        })),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "VIZA", item: `${SITE_URL}${buildLocalePath(locale, "/")}` },
        { "@type": "ListItem", position: 2, name: tAll("pages.visaIndex.heroTitle"), item: url },
      ],
    },
  ];

  return (
    <>
      <SiteHeader active="destinations" />
      <main className="ds-main">
        <DestinationGallery asPage />
        <CtaBand
          title={t("cta.title")}
          points={[t("cta.point1"), t("cta.point2")]}
          image="/assets/heroes/united-arab-emirates.jpg"
          formTitle={t("cta.formTitle")}
          formBody={t("cta.formBody")}
          card={{ title: t("contactCard.title"), body: t("contactCard.body"), cta: { label: t("contactCard.cta"), href: "/contact" } }}
          formId="VIZA-VISA-FORM"
        />
      </main>
      <SiteFooter />
      {jsonLd.map((block, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }} />
      ))}
    </>
  );
}

import type { GuideContent } from "@/lib/arrival-cards/types";
import type { GuideMeta } from "@/lib/arrival-cards/types";
import { LOCALE_HTML_LANG, buildLocalePath, isLocale } from "@/lib/locales";
import { SITE_URL } from "@/lib/seo/site";

/** BreadcrumbList, FAQPage and HowTo for one guide. The FAQ and steps match the visible text. */
export default function ArrivalJsonLd({
  guide,
  meta,
  locale,
  crumbs,
}: {
  guide: GuideContent;
  meta: GuideMeta;
  locale: string;
  crumbs: { home: string; hub: string; name: string };
}) {
  const url = `${SITE_URL}${buildLocalePath(locale, `/arrival-cards/${meta.slug}`)}`;
  const inLanguage = isLocale(locale) ? LOCALE_HTML_LANG[locale] : "en";
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: crumbs.home, item: `${SITE_URL}${buildLocalePath(locale, "/")}` },
        { "@type": "ListItem", position: 2, name: crumbs.hub, item: `${SITE_URL}${buildLocalePath(locale, "/arrival-cards")}` },
        { "@type": "ListItem", position: 3, name: crumbs.name, item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      inLanguage,
      mainEntity: guide.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      inLanguage,
      name: guide.h1,
      description: guide.description,
      totalTime: "PT10M",
      estimatedCost: { "@type": "MonetaryAmount", currency: "SGD", value: "0" },
      step: guide.steps.map((s, i) => ({
        "@type": "HowToStep",
        position: i + 1,
        name: s.name,
        text: s.text,
        url: `${url}#step-${i + 1}`,
      })),
    },
  ];
  return (
    <>
      {data.map((d) => (
        <script key={d["@type"]} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(d) }} />
      ))}
    </>
  );
}

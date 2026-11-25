"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { trackEvent } from "@/lib/analytics";
import type { CountryMeta } from "@/lib/countries";
import type { FaqItem } from "@/lib/visa-content/types";
import { LOCALE_HTML_LANG, buildLocalePath, isLocale } from "@/lib/locales";
import { SITE_URL } from "@/lib/seo/site";

interface Props {
  country: CountryMeta;
  locale: string;
  localName: string;
  localType: string;
  faq?: FaqItem[];
}

export default function VisaStructuredData({
  country,
  locale,
  localName,
  localType,
  faq = [],
}: Props) {
  const t = useTranslations("visa");
  const base = SITE_URL;
  const home = `${base}${buildLocalePath(locale, "/")}`;
  const url = `${base}${buildLocalePath(locale, `/visa/${country.slug}`)}`;
  const serviceId = `${url}#service`;
  const inLanguage = isLocale(locale) ? LOCALE_HTML_LANG[locale] : "en";

  useEffect(() => {
    trackEvent("visa_page_view", {
      destination_country: country.slug,
      visa_type: country.visaType,
      locale,
    });
  }, [country.slug, country.visaType, locale]);

  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": serviceId,
    name: `${localName} ${localType}`,
    serviceType: "Visa application service",
    provider: { "@id": `${base}/#organization` },
    areaServed: { "@type": "Country", name: localName },
    inLanguage,
    url,
    image: `${base}${country.image}`,
    description: t("serviceDescription", { country: localName, type: localType }),
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "SGD",
      availability: "https://schema.org/InStock",
      url,
      description: t("offerDescription"),
    },
  };

  // The middle crumb is the /visa destinations index.
  const index = `${base}${buildLocalePath(locale, "/visa")}`;
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "VIZA", item: home },
      { "@type": "ListItem", position: 2, name: t("breadcrumbVisas"), item: index },
      { "@type": "ListItem", position: 3, name: localName, item: url },
    ],
  };

  // Same questions and answers as the visible FAQ section (VisaCountryRich renders content.faq).
  const faqJsonLd = faq.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        inLanguage,
        mainEntity: faq.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.a,
          },
        })),
      }
    : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {faqJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      ) : null}
    </>
  );
}

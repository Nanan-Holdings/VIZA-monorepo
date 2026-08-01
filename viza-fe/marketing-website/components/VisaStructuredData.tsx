"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";
import type { CountryMeta } from "@/lib/countries";
import type { FaqItem } from "@/lib/visa-content/types";

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
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://viza.it.com").replace(/\/$/, "");
  const localePrefix = locale === "en" ? "" : `/${locale}`;
  const url = `${base}${localePrefix}/visa/${country.slug}`;
  const serviceId = `${url}#service`;

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
    name: `${localName} ${localType} application service`,
    serviceType: "Visa application service",
    provider: { "@id": `${base}/#organization` },
    areaServed: localName,
    url,
    image: `${base}${country.image}`,
    description: `VIZA helps travelers prepare, review, and submit ${localName} ${localType} applications with AI guidance and expert human oversight.`,
    offers: {
      "@type": "Offer",
      availability: "https://schema.org/InStock",
      url,
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "VIZA", item: base },
      { "@type": "ListItem", position: 2, name: "Visa services", item: `${base}${localePrefix}` },
      { "@type": "ListItem", position: 3, name: localName, item: url },
    ],
  };

  const faqJsonLd = faq.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
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

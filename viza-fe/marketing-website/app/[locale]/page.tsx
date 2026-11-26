import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { staticPageMetadata } from "@/lib/seo/page-meta";
import { COUNTRIES, visaHref } from "@/lib/countries";
import { localizedGuides } from "@/lib/guides";
import HowItWorks from "@/components/HowItWorks";
import SiteHeader from "@/design-system/sections/SiteHeader";
import SiteFooter from "@/design-system/sections/SiteFooter";
import PhotoHero from "@/design-system/sections/PhotoHero";
import HeroPicks from "@/design-system/sections/HeroPicks";
import DestinationGallery from "@/design-system/sections/DestinationGallery";
import MediaCarousel from "@/design-system/sections/MediaCarousel";
import SectionHead from "@/design-system/sections/SectionHead";
import CompareTable from "@/design-system/sections/CompareTable";
import FeatureCards from "@/design-system/sections/FeatureCards";
import PostCards from "@/design-system/sections/PostCards";
import FaqSection from "@/design-system/sections/FaqSection";
import CtaBand from "@/design-system/sections/CtaBand";
import Button from "@/design-system/ui/Button";
import { Check, Languages, Tag } from "@/design-system/ui/Icons";
import { HOME_FAQ, TYPE_IMAGES, guideImage, homeTiers } from "@/lib/site-content";

// `pages.home.title` / `pages.home.description` are the metadata; the visible H1 is `heroTitle`.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return staticPageMetadata(params, "home", "/");
}

const PICKS = ["japan", "united-states", "vietnam"] as const;

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("homePage");
  const tAll = await getTranslations();

  const picks = PICKS.map((slug) => {
    const c = COUNTRIES.find((x) => x.slug === slug)!;
    return {
      href: visaHref(slug),
      image: c.image,
      title: tAll.has(`countries.${slug}`) ? tAll(`countries.${slug}`) : c.name,
      meta: [tAll.has(`visaTypes.${c.type}`) ? tAll(`visaTypes.${c.type}`) : c.type, tAll.has(`validity.${slug}`) ? tAll(`validity.${slug}`) : c.validity].join(" · "),
    };
  });

  const usedPhotos = new Set<string>();
  const guides = (await localizedGuides(locale)).slice(0, 3).map((g) => ({
    href: `/guides/${g.slug}`,
    image: guideImage(g.visa, usedPhotos),
    meta: g.tag,
    title: g.name,
    body: g.summary,
  }));

  const tiers = homeTiers(t);

  return (
    <>
      <SiteHeader active="destinations" />
      <main className="ds-main">
        <PhotoHero
          title={tAll("pages.home.heroTitle")}
          lede={tAll("pages.home.heroLede")}
          image="/assets/hero/travel-film-v2-poster.jpg"
          video={{
            webm: "/assets/hero/travel-film-v2-1080.webm",
            mp4: "/assets/hero/travel-film-v2-1080.mp4",
            mobileMp4: "/assets/hero/travel-film-v2-720.mp4",
            poster: "/assets/hero/travel-film-v2-poster.jpg",
          }}
          primary={{ label: tAll("cta.startFreeApplication"), href: "/apply" }}
          secondary={{ label: t("hero.browse"), href: "#destinations" }}
          aside={<HeroPicks label={t("hero.picks")} picks={picks} />}
        />

        <DestinationGallery />

        <MediaCarousel
          title={t("types.title")}
          lede={t("types.lede")}
          labels={{ prev: t("types.prev"), next: t("types.next") }}
          items={(["tourist", "business", "work", "student", "long"] as const).map((k) => ({
            title: t(`types.items.${k}.title`),
            body: t(`types.items.${k}.body`),
            image: TYPE_IMAGES[k],
          }))}
        />

        <HowItWorks />

        <section className="ds-section" id="pricing">
          <div className="ds-container ds-stack">
            <SectionHead title={t("tiers.title")} lede={t("tiers.lede")} action={<Button href="/contact">{t("tiers.cta")}</Button>} />
            <CompareTable caption={t("tiers.title")} criteriaLabel={t("tiers.criteria")} columns={tiers.columns} rows={tiers.rows} />
          </div>
        </section>

        <section className="ds-section" id="why-viza">
          <div className="ds-container ds-stack">
            <SectionHead title={t("why.title")} lede={t("why.lede")} />
            <FeatureCards
              items={[
                { title: t("why.items.free.title"), body: t("why.items.free.body"), icon: <Tag size={88} strokeWidth={1.1} /> },
                { title: t("why.items.checked.title"), body: t("why.items.checked.body"), icon: <Check size={88} strokeWidth={1.1} /> },
                { title: t("why.items.language.title"), body: t("why.items.language.body"), icon: <Languages size={88} strokeWidth={1.1} /> },
              ]}
              photos={[
                { title: t("why.photos.arrival.title"), body: t("why.photos.arrival.body"), image: "/assets/heroes/thailand.jpg", href: "/arrival-cards" },
                { title: t("why.photos.news.title"), body: t("why.photos.news.body"), image: "/assets/heroes/south-korea.jpg", href: "/blog" },
              ]}
            />
          </div>
        </section>

        <section className="ds-section" id="guides">
          <div className="ds-container ds-stack">
            <SectionHead title={t("guides.title")} action={<Button href="/guides">{t("guides.cta")}</Button>} />
            <PostCards posts={guides} />
          </div>
        </section>

        <FaqSection
          title={t("faq.title")}
          lede={t("faq.lede")}
          items={HOME_FAQ.map((k) => ({ q: t(`faq.items.${k}.q`), a: t(`faq.items.${k}.a`) }))}
          more={{ label: t("faq.more"), title: t("contactCard.title"), body: t("contactCard.body"), cta: { label: t("contactCard.cta"), href: "/contact" } }}
          schema
        />

        <CtaBand
          title={t("cta.title")}
          points={[t("cta.point1"), t("cta.point2")]}
          image="/assets/heroes/united-arab-emirates.jpg"
          formTitle={t("cta.formTitle")}
          formBody={t("cta.formBody")}
          card={{ title: t("contactCard.title"), body: t("contactCard.body"), cta: { label: t("contactCard.cta"), href: "/contact" } }}
          formId="VIZA-HOME-FORM"
        />
      </main>
      <SiteFooter />
    </>
  );
}

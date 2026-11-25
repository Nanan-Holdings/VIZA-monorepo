import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { staticPageMetadata } from "@/lib/seo/page-meta";
import { COUNTRIES, isPublished } from "@/lib/countries";
import { GUIDES } from "@/lib/guides";
import { GUIDES as ARRIVAL_GUIDES } from "@/lib/arrival-cards";
import { homeTiers } from "@/lib/site-content";
import HowItWorks from "@/components/HowItWorks";
import SiteHeader from "@/design-system/sections/SiteHeader";
import SiteFooter from "@/design-system/sections/SiteFooter";
import DisplayHero from "@/design-system/sections/DisplayHero";
import Statement from "@/design-system/sections/Statement";
import FactTiles from "@/design-system/sections/FactTiles";
import SectionHead from "@/design-system/sections/SectionHead";
import CompareTable from "@/design-system/sections/CompareTable";
import InfoTiles from "@/design-system/sections/InfoTiles";
import CtaBand from "@/design-system/sections/CtaBand";
import Button from "@/design-system/ui/Button";
import Logo from "@/design-system/ui/Logo";
import Photo from "@/design-system/ui/Photo";
import { Building, Languages, Mail, Phone } from "@/design-system/ui/Icons";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return staticPageMetadata(params, "about", "/about");
}

/** Contact details already published on the site (contact page, Organization schema). */
const EMAIL = "sales@kelin.studio";
const PHONE = "+65 8410 6368";

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("aboutPage");
  const home = await getTranslations("homePage");
  const tiers = homeTiers(home);
  // Counts come from the site's own registries, so they stay true as pages are added.
  const destinations = COUNTRIES.filter(isPublished).length;

  return (
    <>
      <SiteHeader active="about" />
      <main className="ds-main">
        <DisplayHero
          title={
            <>
              <span className="ds-sr">{t("h1")}</span>
              <Logo className="ds-about-logo" height={132} alt="" />
            </>
          }
        >
          <div className="ds-about-photos" data-reveal="">
            <Photo src="/assets/heroes/japan.jpg" sizes="(max-width: 809px) 100vw, 760px" priority />
            <Photo src="/assets/heroes/south-korea.jpg" sizes="(max-width: 809px) 100vw, 380px" />
          </div>
        </DisplayHero>

        <section className="ds-section ds-section--ruled">
          <div className="ds-container ds-stack">
            <Statement title={t("intro.title")} text={t("intro.text")} />
            <FactTiles
              facts={[
                { value: String(destinations), label: t("facts.destinations") },
                { value: String(GUIDES.length), label: t("facts.guides") },
                { value: String(ARRIVAL_GUIDES.length), label: t("facts.arrival") },
                { value: t("facts.free"), label: t("facts.freeLabel") },
              ]}
            />
          </div>
        </section>

        <HowItWorks />

        <section className="ds-section">
          <div className="ds-container ds-stack">
            <SectionHead title={t("tiersTitle")} lede={t("tiersLede")} action={<Button href="/contact">{home("tiers.cta")}</Button>} />
            <CompareTable caption={t("tiersTitle")} criteriaLabel={home("tiers.criteria")} columns={tiers.columns} rows={tiers.rows} />
          </div>
        </section>

        <section className="ds-section">
          <div className="ds-container">
            <Statement title={t("free.title")} text={t("free.text")} />
          </div>
        </section>

        <section className="ds-section">
          <div className="ds-container ds-stack">
            <SectionHead title={t("company.title")} size="statement" />
            <InfoTiles
              items={[
                { icon: <Building size={20} />, label: t("company.office"), value: t("company.officeValue") },
                { icon: <Mail size={20} />, label: t("company.email"), value: <a href={`mailto:${EMAIL}`}>{EMAIL}</a> },
                { icon: <Phone size={20} />, label: t("company.phone"), value: <a href="tel:+6584106368">{PHONE}</a> },
                { icon: <Languages size={20} />, label: t("company.languages"), value: t("company.languagesValue") },
              ]}
            />
          </div>
        </section>

        <CtaBand
          title={home("cta.title")}
          points={[home("cta.point1"), home("cta.point2")]}
          image="/assets/heroes/united-arab-emirates.jpg"
          formTitle={home("cta.formTitle")}
          formBody={home("cta.formBody")}
          card={{ title: home("contactCard.title"), body: home("contactCard.body"), cta: { label: home("contactCard.cta"), href: "/contact" } }}
          formId="VIZA-ABOUT-FORM"
        />
      </main>
      <SiteFooter />
    </>
  );
}

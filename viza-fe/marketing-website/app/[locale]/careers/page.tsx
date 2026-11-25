import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { pageMetadata } from "@/lib/seo/metadata";
import SiteHeader from "@/design-system/sections/SiteHeader";
import SiteFooter from "@/design-system/sections/SiteFooter";
import PageIntro from "@/design-system/sections/PageIntro";
import SectionHead from "@/design-system/sections/SectionHead";
import Button from "@/design-system/ui/Button";
import { Building, Chat, Compass, Doc, Globe, Shield } from "@/design-system/ui/Icons";
import { stagger } from "@/design-system/motion/delay";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.careers" });
  return pageMetadata({ title: t("title"), description: t("description"), path: "/careers", locale, ogKey: "careers" });
}

const TEAM_ICONS = [Building, Compass, Shield, Chat, Doc, Globe];

export default async function CareersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "careersPage" });
  const teams = t.raw("teams") as Array<{ title: string; body: string }>;
  return (
    <>
      <SiteHeader />
      <main className="ds-main">
        <PageIntro title={t("title")} lede={t("lede")} />
        <section className="ds-section">
          <div className="ds-container ds-stack">
            <SectionHead title={t("teamsTitle")} />
            <ul className="ds-teams">
              {teams.map((team, i) => {
                const Icon = TEAM_ICONS[i % TEAM_ICONS.length];
                return (
                  <li key={team.title} className="ds-card" data-reveal="" style={stagger(i % 3)}>
                    <span className="ds-icon-btn" aria-hidden="true">
                      <Icon size={18} />
                    </span>
                    <h3 className="ds-title">{team.title}</h3>
                    <p className="ds-body">{team.body}</p>
                  </li>
                );
              })}
            </ul>
            <div className="ds-note-card" data-reveal="">
              <h2 className="ds-statement">{t("applyTitle")}</h2>
              <p className="ds-body">{t("applyBody")}</p>
              <Button href="/contact" variant="light">
                {t("applyCta")}
              </Button>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { pageMetadata } from "@/lib/seo/metadata";
import { HOME_FAQ } from "@/lib/site-content";
import SiteHeader from "@/design-system/sections/SiteHeader";
import SiteFooter from "@/design-system/sections/SiteFooter";
import DisplayHero from "@/design-system/sections/DisplayHero";
import ContactLines from "@/design-system/sections/ContactLines";
import Statement from "@/design-system/sections/Statement";
import ContactForm from "@/design-system/sections/ContactForm";
import FaqSection from "@/design-system/sections/FaqSection";
import { Chat, Mail, Phone, Pin } from "@/design-system/ui/Icons";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.contact" });
  return pageMetadata({ title: t("title"), description: t("description"), path: "/contact", locale, ogKey: "contact" });
}

/** Locale-invariant contact details, as published before this redesign. */
const CONTACTS = { phone: "+65 8410 6368", tel: "+6584106368", wechat: "@viza_help", email: "sales@kelin.studio" } as const;

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("contactPage");
  const home = await getTranslations("homePage");

  return (
    // data-ph-block: the form collects a name, an email and a phone number, so PostHog replay stops here
    // (components/PostHogAnalytics.tsx) and the recorder skips the subtree. display: contents keeps it out of layout.
    <div data-ph-block="" style={{ display: "contents" }}>
      <SiteHeader active="contact" />
      <main className="ds-main">
        <DisplayHero
          title={t("h1")}
          sub={
            <a className="ds-display-link" href={`mailto:${CONTACTS.email}`}>
              {CONTACTS.email}
            </a>
          }
        >
          <ContactLines
            items={[
              {
                icon: <Phone size={16} />,
                top: <a href={`https://wa.me/${CONTACTS.tel.slice(1)}`}>{CONTACTS.phone}</a>,
                title: t("lines.whatsapp.title"),
                body: t("lines.whatsapp.body"),
              },
              { icon: <Chat size={16} />, top: CONTACTS.wechat, title: t("lines.wechat.title"), body: t("lines.wechat.body") },
              { icon: <Mail size={16} />, top: <a href={`mailto:${CONTACTS.email}`}>{CONTACTS.email}</a>, title: t("lines.email.title"), body: t("lines.email.body") },
              { icon: <Pin size={16} />, top: t("lines.office.top"), title: t("lines.office.title"), body: t("lines.office.body") },
            ]}
          />
        </DisplayHero>

        <section className="ds-section ds-section--ruled" id="form">
          <div className="ds-container">
            <Statement title={t("message.title")} text={t("message.text")} size="statement">
              <div className="ds-contact-form">
                <ContactForm variant="full" formId="VIZA-CON-FORM-26" />
              </div>
            </Statement>
          </div>
        </section>

        <FaqSection
          title={home("faq.title")}
          lede={home("faq.lede")}
          items={HOME_FAQ.map((k) => ({ q: home(`faq.items.${k}.q`), a: home(`faq.items.${k}.a`) }))}
          more={{ label: home("faq.more"), title: home("contactCard.title"), body: home("contactCard.body"), cta: { label: home("contactCard.cta"), href: `mailto:${CONTACTS.email}` } }}
        />
      </main>
      <SiteFooter />
    </div>
  );
}

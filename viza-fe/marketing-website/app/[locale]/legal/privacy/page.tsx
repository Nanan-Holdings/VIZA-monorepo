import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import SiteNav from "@/components/SiteNav";
import "../legal.css";
import SiteFooter from "@/components/SiteFooter";

const TOC_IDS = [
  "scope",
  "data-we-collect",
  "why",
  "sharing",
  "retention",
  "your-rights",
  "security",
  "international",
  "cookies",
  "children",
  "changes",
  "contact",
] as const;

type LabeledItem = { label: string; text: string };

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("legalPrivacy");

  const b = (chunks: ReactNode) => <b>{chunks}</b>;
  const strong = (chunks: ReactNode) => <strong>{chunks}</strong>;
  const toc = t.raw("toc") as string[];

  return (
    <div className="legal-page">
      <SiteNav />

      <header className="legal-hero">
        <div className="legal-eyebrow">{t("eyebrow")}</div>
        <h1>{t("title")}</h1>
        <p className="lede">{t("lede")}</p>
        <div className="legal-meta">
          <span>{t.rich("meta.effective", { b })}</span>
          <span className="sep" />
          <span>{t.rich("meta.version", { b })}</span>
          <span className="sep" />
          <span>{t.rich("meta.controller", { b })}</span>
        </div>
      </header>

      <div className="legal-body">
        <aside className="legal-toc">
          <h4>{t("tocTitle")}</h4>
          {TOC_IDS.map((id, i) => (
            <a key={id} href={`#${id}`}>{toc[i]}</a>
          ))}
        </aside>

        <main className="legal-content">
          <section id="scope" className="legal-section">
            <span className="section-num">{t("sections.scope.num")}</span>
            <h2>{t("sections.scope.title")}</h2>
            <p>{t("sections.scope.p1")}</p>
            <p>{t.rich("sections.scope.p2", { strong })}</p>
          </section>

          <section id="data-we-collect" className="legal-section">
            <span className="section-num">{t("sections.dataWeCollect.num")}</span>
            <h2>{t("sections.dataWeCollect.title")}</h2>
            <p>{t("sections.dataWeCollect.intro")}</p>
            <h3>{t("sections.dataWeCollect.directTitle")}</h3>
            <ul>
              {(t.raw("sections.dataWeCollect.direct") as LabeledItem[]).map((it) => (
                <li key={it.label}><strong>{it.label}</strong> {it.text}</li>
              ))}
            </ul>
            <h3>{t("sections.dataWeCollect.autoTitle")}</h3>
            <ul>
              {(t.raw("sections.dataWeCollect.auto") as string[]).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <h3>{t("sections.dataWeCollect.thirdTitle")}</h3>
            <ul>
              {(t.raw("sections.dataWeCollect.third") as string[]).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </section>

          <section id="why" className="legal-section">
            <span className="section-num">{t("sections.why.num")}</span>
            <h2>{t("sections.why.title")}</h2>
            <p>{t("sections.why.intro")}</p>
            <ul>
              {(t.raw("sections.why.items") as LabeledItem[]).map((it) => (
                <li key={it.label}><strong>{it.label}</strong> {it.text}</li>
              ))}
            </ul>
            <div className="legal-callout">
              <p>{t("sections.why.callout")}</p>
            </div>
          </section>

          <section id="sharing" className="legal-section">
            <span className="section-num">{t("sections.sharing.num")}</span>
            <h2>{t("sections.sharing.title")}</h2>
            <p>{t("sections.sharing.intro")}</p>
            <ul>
              {(t.raw("sections.sharing.items") as LabeledItem[]).map((it) => (
                <li key={it.label}><strong>{it.label}</strong> {it.text}</li>
              ))}
            </ul>
            <p>{t("sections.sharing.outro")}</p>
          </section>

          <section id="retention" className="legal-section">
            <span className="section-num">{t("sections.retention.num")}</span>
            <h2>{t("sections.retention.title")}</h2>
            <p>{t("sections.retention.intro")}</p>
            <ul>
              {(t.raw("sections.retention.items") as LabeledItem[]).map((it) => (
                <li key={it.label}><strong>{it.label}</strong> {it.text}</li>
              ))}
            </ul>
          </section>

          <section id="your-rights" className="legal-section">
            <span className="section-num">{t("sections.rights.num")}</span>
            <h2>{t("sections.rights.title")}</h2>
            <p>{t("sections.rights.intro")}</p>
            <ul>
              {(t.raw("sections.rights.items") as LabeledItem[]).map((it) => (
                <li key={it.label}><strong>{it.label}</strong> {it.text}</li>
              ))}
            </ul>
            <p>
              {t.rich("sections.rights.requests", {
                a: (chunks) => <a href="mailto:privacy@viza.it.com">{chunks}</a>,
              })}
            </p>
          </section>

          <section id="security" className="legal-section">
            <span className="section-num">{t("sections.security.num")}</span>
            <h2>{t("sections.security.title")}</h2>
            <p>
              {t.rich("sections.security.body", {
                a: (chunks) => <a href="/security">{chunks}</a>,
              })}
            </p>
          </section>

          <section id="international" className="legal-section">
            <span className="section-num">{t("sections.international.num")}</span>
            <h2>{t("sections.international.title")}</h2>
            <p>{t("sections.international.body")}</p>
          </section>

          <section id="cookies" className="legal-section">
            <span className="section-num">{t("sections.cookies.num")}</span>
            <h2>{t("sections.cookies.title")}</h2>
            <p>{t("sections.cookies.intro")}</p>
            <ul>
              {(t.raw("sections.cookies.items") as LabeledItem[]).map((it) => (
                <li key={it.label}><strong>{it.label}</strong> {it.text}</li>
              ))}
            </ul>
            <p>{t("sections.cookies.outro")}</p>
          </section>

          <section id="children" className="legal-section">
            <span className="section-num">{t("sections.children.num")}</span>
            <h2>{t("sections.children.title")}</h2>
            <p>{t("sections.children.body")}</p>
          </section>

          <section id="changes" className="legal-section">
            <span className="section-num">{t("sections.changes.num")}</span>
            <h2>{t("sections.changes.title")}</h2>
            <p>{t("sections.changes.body")}</p>
          </section>

          <section id="contact" className="legal-section">
            <span className="section-num">{t("sections.contact.num")}</span>
            <h2>{t("sections.contact.title")}</h2>
            <p>{t("sections.contact.intro")}</p>
            <ul>
              <li>{t.rich("sections.contact.email", { strong, a: (chunks) => <a href="mailto:privacy@viza.it.com">{chunks}</a> })}</li>
              <li>{t.rich("sections.contact.dpo", { strong, a: (chunks) => <a href="mailto:dpo@viza.it.com">{chunks}</a> })}</li>
              <li>{t.rich("sections.contact.address", { strong })}</li>
              <li>{t.rich("sections.contact.pdpc", { strong, a: (chunks) => <a href="https://www.pdpc.gov.sg" target="_blank" rel="noopener">{chunks}</a> })}</li>
            </ul>
          </section>
        </main>
      </div>

      <SiteFooter />
    </div>
  );
}

import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import SiteNav from "@/components/SiteNav";
import "../legal.css";

const TOC_IDS = [
  "agreement",
  "account",
  "service",
  "applicant",
  "fees",
  "refunds",
  "government",
  "timelines",
  "prohibited",
  "ip",
  "liability",
  "termination",
  "disputes",
  "changes",
  "contact",
] as const;

type LabeledItem = { label: string; text: string };

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("legalTerms");

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
          <span>{t.rich("meta.law", { b })}</span>
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
          <section id="agreement" className="legal-section">
            <span className="section-num">{t("sections.agreement.num")}</span>
            <h2>{t("sections.agreement.title")}</h2>
            <p>
              {t.rich("sections.agreement.p1", {
                privacy: (chunks) => <a href="/legal/privacy">{chunks}</a>,
                refunds: (chunks) => <a href="/refunds">{chunks}</a>,
              })}
            </p>
            <p>{t("sections.agreement.p2")}</p>
          </section>

          <section id="account" className="legal-section">
            <span className="section-num">{t("sections.account.num")}</span>
            <h2>{t("sections.account.title")}</h2>
            <ul>
              <li>{t("sections.account.item1")}</li>
              <li>{t("sections.account.item2")}</li>
              <li>{t("sections.account.item3")}</li>
              <li>{t.rich("sections.account.item4", { a: (chunks) => <a href="mailto:security@viza.com">{chunks}</a> })}</li>
              <li>{t("sections.account.item5")}</li>
            </ul>
          </section>

          <section id="service" className="legal-section">
            <span className="section-num">{t("sections.service.num")}</span>
            <h2>{t("sections.service.title")}</h2>
            <p>{t("sections.service.intro")}</p>
            <ul>
              {(t.raw("sections.service.items") as string[]).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <div className="legal-callout">
              <p>{t("sections.service.callout")}</p>
            </div>
          </section>

          <section id="applicant" className="legal-section">
            <span className="section-num">{t("sections.applicant.num")}</span>
            <h2>{t("sections.applicant.title")}</h2>
            <ul>
              {(t.raw("sections.applicant.items") as LabeledItem[]).map((it) => (
                <li key={it.label}><strong>{it.label}</strong> {it.text}</li>
              ))}
            </ul>
          </section>

          <section id="fees" className="legal-section">
            <span className="section-num">{t("sections.fees.num")}</span>
            <h2>{t("sections.fees.title")}</h2>
            <p>{t("sections.fees.intro")}</p>
            <ul>
              {(t.raw("sections.fees.items") as LabeledItem[]).map((it) => (
                <li key={it.label}><strong>{it.label}</strong> {it.text}</li>
              ))}
            </ul>
            <p>{t("sections.fees.outro")}</p>
          </section>

          <section id="refunds" className="legal-section">
            <span className="section-num">{t("sections.refunds.num")}</span>
            <h2>{t("sections.refunds.title")}</h2>
            <p>
              {t.rich("sections.refunds.body", {
                a: (chunks) => <a href="/refunds">{chunks}</a>,
              })}
            </p>
          </section>

          <section id="government" className="legal-section">
            <span className="section-num">{t("sections.government.num")}</span>
            <h2>{t("sections.government.title")}</h2>
            <p>{t("sections.government.body")}</p>
          </section>

          <section id="timelines" className="legal-section">
            <span className="section-num">{t("sections.timelines.num")}</span>
            <h2>{t("sections.timelines.title")}</h2>
            <p>{t("sections.timelines.body")}</p>
          </section>

          <section id="prohibited" className="legal-section">
            <span className="section-num">{t("sections.prohibited.num")}</span>
            <h2>{t("sections.prohibited.title")}</h2>
            <p>{t("sections.prohibited.intro")}</p>
            <ul>
              {(t.raw("sections.prohibited.items") as string[]).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <p>{t("sections.prohibited.outro")}</p>
          </section>

          <section id="ip" className="legal-section">
            <span className="section-num">{t("sections.ip.num")}</span>
            <h2>{t("sections.ip.title")}</h2>
            <p>{t("sections.ip.body")}</p>
          </section>

          <section id="liability" className="legal-section">
            <span className="section-num">{t("sections.liability.num")}</span>
            <h2>{t("sections.liability.title")}</h2>
            <p>{t("sections.liability.p1")}</p>
            <p>{t("sections.liability.p2")}</p>
          </section>

          <section id="termination" className="legal-section">
            <span className="section-num">{t("sections.termination.num")}</span>
            <h2>{t("sections.termination.title")}</h2>
            <p>{t("sections.termination.p1")}</p>
            <p>{t("sections.termination.p2")}</p>
            <ul>
              {(t.raw("sections.termination.items") as string[]).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <p>{t("sections.termination.p3")}</p>
          </section>

          <section id="disputes" className="legal-section">
            <span className="section-num">{t("sections.disputes.num")}</span>
            <h2>{t("sections.disputes.title")}</h2>
            <p>{t("sections.disputes.body")}</p>
          </section>

          <section id="changes" className="legal-section">
            <span className="section-num">{t("sections.changes.num")}</span>
            <h2>{t("sections.changes.title")}</h2>
            <p>{t("sections.changes.body")}</p>
          </section>

          <section id="contact" className="legal-section">
            <span className="section-num">{t("sections.contact.num")}</span>
            <h2>{t("sections.contact.title")}</h2>
            <ul>
              <li>{t.rich("sections.contact.legal", { strong, a: (chunks) => <a href="mailto:legal@viza.com">{chunks}</a> })}</li>
              <li>{t.rich("sections.contact.privacy", { strong, a: (chunks) => <a href="mailto:privacy@viza.com">{chunks}</a> })}</li>
              <li>{t.rich("sections.contact.address", { strong })}</li>
              <li>{t.rich("sections.contact.uen", { strong })}</li>
            </ul>
          </section>
        </main>
      </div>

      <footer className="legal-foot">
        <div className="legal-foot-inner">
          <span>{t("footer.copyright")}</span>
          <span>
            <a href="/legal/privacy">{t("footer.privacy")}</a> {'·'} <a href="/refunds">{t("footer.refunds")}</a> {'·'} <a href="/security">{t("footer.security")}</a>
          </span>
        </div>
      </footer>
    </div>
  );
}

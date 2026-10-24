import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { jsonLd, breadcrumbJsonLd } from "@/lib/blog-structured-data";
import { absoluteUrl, localePath, pageMetadata } from "@/lib/seo";
import "../../legal/legal.css";

/**
 * DS-160 guide (keyword "ds160", 1,300/mo in Singapore, docs/seo/keyword-map.md).
 * Upstream content for the US visa money page: answers the form question in the
 * first lines, shows the real steps, and links to /visa/united-states twice.
 * Layout reuses the legal page shell so it looks like it was always there.
 */
const PATH = "/guides/ds-160";
const TOC_IDS = ["need", "steps", "mistakes", "viza", "faq"] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "guides.ds160" });
  return pageMetadata({ locale, path: PATH, title: t("metaTitle"), description: t("metaDescription"), type: "article" });
}

export default async function Ds160GuidePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "guides.ds160" });
  const toc = t.raw("toc") as string[];
  const need = t.raw("need") as string[];
  const steps = t.raw("steps") as [string, string][];
  const mistakes = t.raw("mistakes") as string[];
  const faq = t.raw("faq") as [string, string][];
  const sep = locale === "zh-CN" ? "：" : ". ";
  const usVisa = localePath(locale, "/visa/united-states");
  const apply = `${localePath(locale, "/apply")}?country=united-states`;

  return (
    <div className="legal-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        inLanguage: locale,
        mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
      })} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(breadcrumbJsonLd([
        { name: "VIZA", url: absoluteUrl(localePath(locale, "")) },
        { name: t("breadcrumb"), url: absoluteUrl(localePath(locale, PATH)) },
      ]))} />
      <SiteNav />

      <header className="legal-hero">
        <h1>{t("title")}</h1>
        <p className="lede">{t("lede")}</p>
      </header>

      <div className="legal-body">
        <aside className="legal-toc">
          {TOC_IDS.map((id, i) => (
            <a key={id} href={`#${id}`}>{toc[i]}</a>
          ))}
        </aside>

        <main className="legal-content">
          <section id="need" className="legal-section">
            <h2>{t("needTitle")}</h2>
            <ul className="list-disc">{need.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>

          <section id="steps" className="legal-section">
            <h2>{t("stepsTitle")}</h2>
            <ol className="list-decimal">
              {steps.map(([title, body]) => (
                <li key={title}><strong>{title}{sep}</strong>{body}</li>
              ))}
            </ol>
            <p>
              <a href="https://ceac.state.gov/genniv/" target="_blank" rel="noopener noreferrer">ceac.state.gov/genniv</a>
            </p>
          </section>

          <section id="mistakes" className="legal-section">
            <h2>{t("mistakesTitle")}</h2>
            <ul className="list-disc">{mistakes.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>

          <section id="viza" className="legal-section">
            <h2>{t("vizaTitle")}</h2>
            <p>{t("vizaBody")}</p>
            <p><a href={usVisa}>{t("vizaLink")}</a></p>
            <p><a className="inline-flex rounded-full bg-brand-500 px-5 py-3 font-medium no-underline" style={{ color: "var(--fg-on-brand)" }} href={apply}>{t("vizaApply")}</a></p>
          </section>

          <section id="faq" className="legal-section">
            <h2>{t("faqTitle")}</h2>
            {faq.map(([q, a]) => (
              <div key={q}>
                <h3>{q}</h3>
                <p>{a}</p>
              </div>
            ))}
          </section>
        </main>
      </div>

      <SiteFooter />
    </div>
  );
}

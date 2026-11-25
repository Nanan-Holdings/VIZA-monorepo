"use client";

import { Link } from "@/navigation";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { CatalogueCountry } from "@/components/CatalogueProvider";
import type { CountryMeta } from "@/lib/countries";
import type { DestinationContent, IconName } from "@/lib/visa-content/types";

/**
 * Main column of a destination page in the Phase B template (see the section order in
 * lib/visa-content/types.ts). Rendered by VisaCountryRich when the content has a `page` block.
 * Headings and chrome come from the `visa.dest` messages; the content file holds only the prose.
 */

export const DEST_TABS = [
  ["glance", "tabGlance"],
  ["passports", "tabPassports"],
  ["types", "tabTypes"],
  ["residents", "tabResidents"],
  ["fees", "tabFees"],
  ["apply", "tabApply"],
  ["checklist", "tabChecklist"],
  ["rejection", "tabRejection"],
  ["travel", "tabTravel"],
  ["faq", "tabFaq"],
  ["related", "tabRelated"],
] as const;

type RelatedCountry = Pick<CountryMeta, "slug" | "name" | "image" | "type">;

export default function VisaDestinationMain({
  content,
  consultOnly,
  applyHref,
  related,
  icons,
  localName,
}: {
  content: DestinationContent;
  consultOnly: boolean;
  applyHref: string;
  related: Array<RelatedCountry & Partial<Pick<CatalogueCountry, "pricing">>>;
  icons: Record<IconName, ReactNode>;
  localName: (slug: string, fallback: string) => string;
}) {
  const t = useTranslations("visa");
  const d = useTranslations("visa.dest");
  const { page } = content;
  const g = page.glance;

  const faqGroups: { category: string; items: typeof content.faq }[] = [];
  for (const item of content.faq) {
    const last = faqGroups[faqGroups.length - 1];
    if (last && last.category === item.category) last.items.push(item);
    else faqGroups.push({ category: item.category, items: [item] });
  }
  let faqIndex = -1;

  const glanceItems: Array<{ icon: IconName; k: string; v: string }> = [
    { icon: "globe", k: d("glanceVisa"), v: g.needVisa },
    { icon: "currency", k: d("glanceGovFee"), v: g.govFee },
    { icon: "shield", k: d("glanceVizaFee"), v: t("priceFree") },
    { icon: "clock", k: d("glanceProcessing"), v: g.processing },
    { icon: "calendar", k: d("glanceMaxStay"), v: g.maxStay },
    { icon: "doc", k: d("glanceChecked"), v: g.checked },
  ];

  const arrow = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
  );

  return (
    <main className="col-main dest">
      {/* 1. At a glance */}
      <section className="block" id="glance">
        <h2>{d("glanceTitle")}</h2>
        <div className="glance">
          {glanceItems.map((item) => (
            <div className="g" key={item.k}>
              <div className="ico">{icons[item.icon]}</div>
              <div className="k">{item.k}</div>
              <div className="v">{item.v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Do you need a visa? */}
      <section className="block" id="passports">
        <h2>{d("passportsTitle")}</h2>
        <p className="block-sub">{page.passports.intro}</p>
        <div className="dest-table-wrap">
          <table className="dest-table">
            <thead>
              <tr>
                <th>{d("colPassport")}</th>
                <th>{d("colEntry")}</th>
                <th>{d("colNotes")}</th>
              </tr>
            </thead>
            <tbody>
              {page.passports.rows.map((row) => (
                <tr key={row.passport}>
                  <th scope="row">{row.passport}</th>
                  <td className="status">{row.status}</td>
                  <td>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. Visa types */}
      <section className="block" id="types">
        <h2>{d("typesTitle")}</h2>
        <p className="block-sub">{page.visaTypes.intro}</p>
        <div className="dest-cards">
          {page.visaTypes.items.map((item) => (
            <div className="dest-card" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Residents of Singapore by pass type */}
      <section className="block" id="residents">
        <h2>{d("residentsTitle")}</h2>
        <p className="block-sub">{page.residents.intro}</p>
        <dl className="dest-defs">
          {page.residents.rows.map((row) => (
            <div className="dest-def" key={row.pass}>
              <dt>{row.pass}</dt>
              <dd>{row.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 5. Fees and processing time */}
      <section className="block" id="fees">
        <h2>{d("feesTitle")}</h2>
        <p className="block-sub">{page.fees.intro}</p>
        <div className="dest-table-wrap">
          <table className="dest-table">
            <thead>
              <tr>
                <th>{d("colItem")}</th>
                <th>{d("colAmount")}</th>
                <th>{d("colNotes")}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">{d("glanceVizaFee")}</th>
                <td className="status">{t("priceFree")}</td>
                <td>{d("vizaFeeNote")}</td>
              </tr>
              {page.fees.rows.map((row) => (
                <tr key={row.item}>
                  <th scope="row">{row.item}</th>
                  <td className="status">{row.amount}</td>
                  <td>{row.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="dest-note">{page.fees.processing}</p>
      </section>

      {/* 6. How to apply */}
      <section className="block" id="apply">
        <h2>{d("applyTitle")}</h2>
        <p className="block-sub">{page.apply.intro}</p>
        <div className="dest-cards two">
          <div className="dest-card">
            <h3>{page.apply.guided.title}</h3>
            <p>{page.apply.guided.body}</p>
          </div>
          <div className="dest-card">
            <h3>{page.apply.fullService.title}</h3>
            <p>{page.apply.fullService.body}</p>
          </div>
        </div>
        <div className="steps">
          {page.apply.steps.map((step, i) => (
            <div className="step" key={step.title}>
              <div className="num">{i + 1}</div>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 7. Document checklist by applicant type */}
      <section className="block" id="checklist">
        <h2>{d("checklistTitle")}</h2>
        <p className="block-sub">{page.checklist.intro}</p>
        <div className="dest-lists">
          {page.checklist.groups.map((group) => (
            <div className="dest-list" key={group.applicant}>
              <h3>{group.applicant}</h3>
              <ul>
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* 8. Common rejection reasons */}
      <section className="block" id="rejection">
        <h2>{content.rejectionTitle}</h2>
        <p className="block-sub">{content.rejectionSub}</p>
        <div className="reasons">
          {content.rejectionReasons.map((r) => (
            <div className="reason" key={r.title}>
              <div className="ico">{icons.alert}</div>
              <h4>{r.title}</h4>
              <p>{r.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 9. Before you travel */}
      <section className="block" id="travel">
        <h2>{d("travelTitle")}</h2>
        <p className="block-sub">{page.travel.intro}</p>
        <div className="dest-cards">
          {page.travel.items.map((item) => (
            <div className="dest-card" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              {item.href && item.linkLabel ? (
                <p><Link href={item.href} style={{ color: "var(--brand-500)", fontWeight: 500 }}>{item.linkLabel}</Link></p>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {/* 10. Reviewed by a VIZA consultant */}
      <section className="dest-reviewed" id="reviewed">
        <div className="ico">{icons.shield}</div>
        <p>
          <strong>{d("reviewedBy", { date: page.reviewed.date })}</strong> {page.reviewed.note}
        </p>
      </section>

      {/* 11. FAQ */}
      <section className="block" id="faq">
        <h2>{t("faqTitle")}</h2>
        <p className="block-sub">{content.faqSub}</p>
        <div className="faq">
          {faqGroups.map((group) => (
            <div key={group.category}>
              <div className="faq-cat">{group.category}</div>
              {group.items.map((item) => {
                faqIndex += 1;
                return (
                  <details className="q" key={item.q} open={faqIndex === 0}>
                    <summary>
                      {item.q}
                      <span className="plus"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg></span>
                    </summary>
                    <div className="a">{item.a}</div>
                  </details>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      {/* 12. Related destinations and guides */}
      <section className="block" id="related">
        <h2>{d("relatedTitle")}</h2>
        <p className="block-sub">{d("relatedSub")}</p>
        <div className="nearby">
          {related.map((c) => (
            <Link className="near" href={`/visa/${c.slug}`} key={c.slug}>
              <div className="img" style={{ backgroundImage: `url('${c.image}')` }}></div>
              <div className="body">
                <div>
                  <div className="nm">{localName(c.slug, c.name)}</div>
                  <div className="eta">{c.type}</div>
                </div>
                <span className="arrow"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg></span>
              </div>
            </Link>
          ))}
        </div>
        {page.related.guides.length > 0 ? (
          <ul className="dest-guides">
            {page.related.guides.map((guide) => (
              <li key={guide.href}>
                {guide.href.startsWith("http") ? (
                  <a href={guide.href} target="_blank" rel="noreferrer">{guide.label}</a>
                ) : (
                  <Link href={guide.href}>{guide.label}</Link>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* 13. Start application */}
      <section className="block dest-start" id="start">
        <h2>{d("startTitle")}</h2>
        <p className="block-sub">{consultOnly ? d("startConsultBody") : d("startBody")}</p>
        <Link href={consultOnly ? "/contact" : applyHref} className="price-cta" style={{ textDecoration: "none", maxWidth: 320 }}>
          {consultOnly ? d("consultCta") : t("priceCta")}
          {arrow}
        </Link>
      </section>

      {/* Sources */}
      {content.sources.length > 0 ? (
        <section className="block" id="sources">
          <h2>{t("sourcesTitle")}</h2>
          <div className="sources">
            {content.sources.map((s) => (
              <a className="source" href={s.url} target="_blank" rel="noreferrer" key={s.url}>
                <span className="ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg></span>
                <span className="lk">{s.label}</span>
                <span className="url">{s.display}</span>
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

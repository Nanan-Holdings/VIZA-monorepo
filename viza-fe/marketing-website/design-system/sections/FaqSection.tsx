import { ArrowDown } from "../ui/Icons";
import ContactCard from "./ContactCard";

export type FaqItem = { q: string; a: string };

type Props = {
  title: string;
  lede: string;
  items: FaqItem[];
  more?: { label: string; title: string; body: string; cta: { label: string; href: string } };
  /** Emit FAQPage JSON-LD for these questions (only where the page has no other FAQ schema). */
  schema?: boolean;
};

/**
 * Framer FAQ: title, short line and a "more questions" card on the left; white question cards (20px
 * corners) on the right. The first answer is open; each toggle is a round button, navy when closed.
 * Uses <details> so every answer is in the server HTML and works without scripts.
 */
export default function FaqSection({ title, lede, items, more, schema }: Props) {
  const jsonLd = schema
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      }
    : null;
  return (
    <section className="ds-section" id="faq">
      <div className="ds-container ds-faq">
        <div className="ds-faq-side">
          <div className="ds-faq-intro" data-reveal="">
            <h2 className="ds-statement">{title}</h2>
            <p className="ds-body">{lede}</p>
          </div>
          {more && (
            <div className="ds-faq-more" data-reveal="">
              <p className="ds-body ds-strong">{more.label}</p>
              <ContactCard title={more.title} body={more.body} cta={more.cta} />
            </div>
          )}
        </div>
        <div className="ds-faq-list">
          {items.map((f, i) => (
            <details key={f.q} className="ds-card ds-faq-item" open={i === 0} data-reveal="">
              <summary>
                <span className="ds-subtitle">{f.q}</span>
                <span className="ds-icon-btn ds-icon-btn--dark ds-faq-toggle" aria-hidden="true">
                  <ArrowDown size={14} />
                </span>
              </summary>
              <p className="ds-body">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
    </section>
  );
}

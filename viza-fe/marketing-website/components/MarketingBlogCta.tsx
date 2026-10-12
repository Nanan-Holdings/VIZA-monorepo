import { Link } from "@/navigation";
import type { Locale } from "@/i18n";

interface MarketingBlogCtaProps {
  locale: Locale;
  eyebrow: string;
  title: string;
  body: string;
  action: string;
}

export default function MarketingBlogCta({ locale, eyebrow, title, body, action }: MarketingBlogCtaProps) {
  return (
    <section className="viza-blog__band" aria-label={title}>
      <div className="viza-blog__container">
        <div className="viza-blog__cta">
          <span className="viza-blog__overline">{eyebrow}</span>
          <h2>{title}</h2>
          <p>{body}</p>
          <Link href="/apply" locale={locale}>{action} <span aria-hidden="true">→</span></Link>
        </div>
      </div>
    </section>
  );
}

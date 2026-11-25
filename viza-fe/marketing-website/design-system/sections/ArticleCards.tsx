import { Link } from "@/navigation";
import Photo from "../ui/Photo";
import { stagger } from "../motion/delay";

export type ArticleCard = {
  href: string;
  /** Local path (optimised) or a remote https URL (plain img). Empty shows the VIZA panel. */
  image?: string | null;
  meta: string;
  title: string;
  body: string;
  more?: string;
};

/** Framer blog cards: 20px photo, grey meta line, 26px title, two-line summary. Three columns, two on tablet, one on phone. */
export default function ArticleCards({ items }: { items: ArticleCard[] }) {
  return (
    <ul className="ds-artcards">
      {items.map((p, i) => (
        <li key={p.href} data-reveal="" style={stagger(i % 6)}>
          <Link href={p.href} className="ds-artcard">
            <div className="ds-artcard-media" aria-hidden="true">
              {p.image && p.image.startsWith("/") ? (
                <Photo src={p.image} sizes="(max-width: 809px) 100vw, (max-width: 1199px) 50vw, 421px" />
              ) : p.image ? (
                // Remote cover from the published portal feed.
                <img src={p.image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
              ) : (
                <span className="ds-artcard-fallback">VIZA</span>
              )}
            </div>
            <div className="ds-artcard-text">
              <p className="ds-artcard-meta">{p.meta}</p>
              <h3 className="ds-title">{p.title}</h3>
              <p className="ds-body ds-clamp-2">{p.body}</p>
              {p.more ? <span className="ds-artcard-more">{p.more}</span> : null}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

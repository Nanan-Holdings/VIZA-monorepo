import type { ReactNode } from "react";
import { Link } from "@/navigation";
import Photo from "../ui/Photo";
import { stagger } from "../motion/delay";

export type Feature = { title: string; body: string; icon: ReactNode };
export type PhotoFeature = { title: string; body: string; image: string; href: string };

/**
 * Framer "why us": three white cards (20px corners, a large line icon, title and text at the bottom), then a
 * row of two photo cards, the first twice as wide, with white text over a dark fade.
 */
export default function FeatureCards({ items, photos }: { items: Feature[]; photos?: PhotoFeature[] }) {
  return (
    <div className="ds-features">
      {items.map((f, i) => (
        <div key={f.title} className="ds-card ds-feature" data-reveal="" style={stagger(i)}>
          <div className="ds-feature-icon" aria-hidden="true">
            {f.icon}
          </div>
          <div className="ds-feature-text">
            <h3 className="ds-title">{f.title}</h3>
            <p className="ds-body">{f.body}</p>
          </div>
        </div>
      ))}
      {photos?.map((p, i) => (
        <Link key={p.title} href={p.href} className={`ds-feature-photo${i === 0 ? " is-wide" : ""}`} data-reveal="" style={stagger(i + 1)}>
          <Photo src={p.image} sizes={i === 0 ? "(max-width: 809px) 100vw, 860px" : "(max-width: 809px) 100vw, 424px"} />
          <div className="ds-feature-photo-text">
            <h3 className="ds-title">{p.title}</h3>
            <p className="ds-body">{p.body}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

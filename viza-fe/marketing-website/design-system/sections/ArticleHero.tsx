import type { ReactNode } from "react";
import Image from "next/image";
import { Link } from "@/navigation";
import { ArrowDown } from "../ui/Icons";

export type Crumb = { label: string; href?: string };

type Props = {
  title: string;
  crumbs: Crumb[];
  /** Cover photo URL (local or remote). Without one the frame is VIZA navy. */
  image?: string | null;
  /** Anchor of the content below the frame. */
  target?: string;
  downLabel: string;
  children?: ReactNode;
};

/** Framer article opening: a photo frame with the white title, breadcrumb above it and a round down button. */
export default function ArticleHero({ title, crumbs, image, target = "article", downLabel }: Props) {
  return (
    <section className="ds-arthero">
      <div className="ds-arthero-frame">
        {image ? (
          <div className="ds-arthero-photo" aria-hidden="true">
            {image.startsWith("/") ? (
              <Image src={image} alt="" fill sizes="100vw" priority />
            ) : (
              <img src={image} alt="" referrerPolicy="no-referrer" fetchPriority="high" />
            )}
          </div>
        ) : null}
        <div>
          <nav aria-label="Breadcrumb">
            <ol className="ds-crumbs">
              {crumbs.map((c, i) => (
                <li key={`${c.label}-${i}`} aria-current={i === crumbs.length - 1 ? "page" : undefined}>
                  {c.href && i < crumbs.length - 1 ? <Link href={c.href}>{c.label}</Link> : c.label}
                </li>
              ))}
            </ol>
          </nav>
          <h1 className="ds-arthero-title" data-reveal="hero">
            {title}
          </h1>
        </div>
        <a className="ds-arthero-down" href={`#${target}`} aria-label={downLabel}>
          <ArrowDown size={18} />
        </a>
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import { Link } from "@/navigation";
import Photo from "../ui/Photo";

export type HeroPick = { href: string; image: string; title: string; meta: string };

/**
 * The floating card in the Framer hero (image tile beside a white card with a 01 02 03 pager).
 * Here it shows real destinations; the pager switches between them.
 */
export default function HeroPicks({ label, picks }: { label: string; picks: HeroPick[] }) {
  const [i, setI] = useState(0);
  const pick = picks[i];
  if (!pick) return null;
  return (
    <div className="ds-picks">
      <Link href={pick.href} className="ds-picks-photo" tabIndex={-1} aria-hidden="true">
        <Photo src={pick.image} sizes="176px" />
      </Link>
      <div className="ds-picks-card">
        <div className="ds-picks-top">
          <span className="ds-picks-label">
            <i aria-hidden="true" />
            {label}
          </span>
          <ul className="ds-picks-pager">
            {picks.map((p, n) => (
              <li key={p.href}>
                <button type="button" aria-pressed={n === i} aria-label={p.title} onClick={() => setI(n)}>
                  {String(n + 1).padStart(2, "0")}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <Link href={pick.href} className="ds-picks-link">
          <span className="ds-subtitle">{pick.title}</span>
          <span className="ds-caption">{pick.meta}</span>
        </Link>
      </div>
    </div>
  );
}

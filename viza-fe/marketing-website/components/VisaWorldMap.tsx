"use client";
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { visaHref } from "@/lib/countries";
import WORLD from "@/lib/world-dots.json";

/**
 * Dotted world map for the explore page's Map view (MKT explore toggle).
 *
 * The dot grid is precomputed by scripts/generate-world-map.mjs (dotted-map is a
 * devDependency only) and committed as lib/world-dots.json — the client just renders
 * plain SVG circles. Launched destinations get a colorized dot (tag colors match the
 * card badges: fast → success green, evisa → brand navy); hovering / focusing one
 * floats the country's card next to the pin, clicking navigates to /visa/<slug>.
 */

export interface MapCountry {
  slug: string;
  name: string;
  tag: "fast" | "evisa";
}

interface Props {
  countries: MapCountry[];
  /** Renders the existing explore country card for the hover panel. */
  renderCard: (slug: string) => ReactNode;
}

const { width: W, height: H, dots, pins } = WORLD as {
  width: number;
  height: number;
  dots: [number, number][];
  pins: { slug: string; x: number; y: number }[];
};

const pinBySlug = new Map(pins.map((p) => [p.slug, p]));

export default function VisaWorldMap({ countries, renderCard }: Props) {
  const t = useTranslations("explore");
  const [active, setActive] = useState<string | null>(null);

  const markers = countries
    .map((c) => {
      const pin = pinBySlug.get(c.slug);
      return pin ? { ...c, x: pin.x, y: pin.y } : null;
    })
    .filter((m): m is MapCountry & { x: number; y: number } => m !== null);

  const activeMarker = markers.find((m) => m.slug === active);

  /** Anchor the panel on the pin, flipped away from the nearest map edge. */
  const panelStyle = (x: number, y: number): React.CSSProperties => ({
    left: `${(x / W) * 100}%`,
    top: `${(y / H) * 100}%`,
    transform: `translate(${x > W * 0.55 ? "calc(-100% - 14px)" : "14px"}, ${
      y > H * 0.45 ? "calc(-100% + 8px)" : "-8px"
    })`,
  });

  return (
    <div className="wmap" onMouseLeave={() => setActive(null)}>
      <svg className="wmap-svg" viewBox={`0 0 ${W} ${H}`} role="presentation" aria-hidden="true">
        {dots.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={0.32} className="wmap-dot" />
        ))}
        {markers.map((m) => (
          <g key={m.slug} className={`wmap-pin tag-${m.tag} ${active === m.slug ? "on" : ""}`}>
            <circle className="wmap-halo" cx={m.x} cy={m.y} r={1.7} />
            <circle className="wmap-core" cx={m.x} cy={m.y} r={0.85} />
          </g>
        ))}
      </svg>

      {/* Focusable hit targets over each colorized dot (hover/focus previews, click/Enter navigates). */}
      {markers.map((m) => (
        <a
          key={m.slug}
          className="wmap-hit"
          href={visaHref(m.slug)}
          aria-label={m.name}
          style={{ left: `${(m.x / W) * 100}%`, top: `${(m.y / H) * 100}%` }}
          onMouseEnter={() => setActive(m.slug)}
          onFocus={() => setActive(m.slug)}
          onClick={(e) => {
            // Touch: first tap previews the card, second tap (on the card) navigates.
            if (active !== m.slug) {
              e.preventDefault();
              setActive(m.slug);
            }
          }}
        />
      ))}

      {activeMarker && (
        <div className="wmap-panel" style={panelStyle(activeMarker.x, activeMarker.y)}>
          {renderCard(activeMarker.slug)}
        </div>
      )}

      <div className="wmap-legend">
        <span className="wmap-key tag-fast">{t("fastTrack")}</span>
        <span className="wmap-key tag-evisa">{t("mapLegendEvisa")}</span>
        <span className="wmap-hint">{t("mapHint")}</span>
      </div>
    </div>
  );
}

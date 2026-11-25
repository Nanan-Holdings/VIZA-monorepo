import { stagger } from "../motion/delay";

export type Fact = { value: string; label: string };

/**
 * Framer stat cards (/01 index, a 68px figure, a grey label). Only for real, checkable figures such as
 * counts taken from the site's own data; never for invented results.
 */
export default function FactTiles({ facts }: { facts: Fact[] }) {
  return (
    <ul className={`ds-facts ds-facts--${facts.length}`}>
      {facts.map((f, i) => (
        <li key={f.label} className="ds-card ds-fact" data-reveal="" style={stagger(i)}>
          <span className="ds-fact-index">/{String(i + 1).padStart(2, "0")}</span>
          <div>
            <p className="ds-stat">{f.value}</p>
            <p className="ds-small">{f.label}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

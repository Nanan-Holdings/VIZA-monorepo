import type { ReactNode } from "react";
import { stagger } from "../motion/delay";

export type Info = { icon: ReactNode; label: string; value: ReactNode };

/** Framer "company information" tiles: a round icon beside a grey label and the value. */
export default function InfoTiles({ items }: { items: Info[] }) {
  return (
    <ul className="ds-info">
      {items.map((item, i) => (
        <li key={item.label} className="ds-card ds-info-tile" data-reveal="" style={stagger(i)}>
          <span className="ds-info-icon" aria-hidden="true">
            {item.icon}
          </span>
          <div className="ds-info-text">
            <p className="ds-small">{item.label}</p>
            <div className="ds-info-value">{item.value}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

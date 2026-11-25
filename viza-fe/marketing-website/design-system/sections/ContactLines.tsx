import type { ReactNode } from "react";
import { stagger } from "../motion/delay";

export type ContactLine = { icon: ReactNode; top: ReactNode; title: string; body: ReactNode };

/** Framer contact columns: an icon line on top, a hairline, a 26px title and a grey note. */
export default function ContactLines({ items }: { items: ContactLine[] }) {
  return (
    <ul className="ds-lines">
      {items.map((item, i) => (
        <li key={item.title} data-reveal="" style={stagger(i)}>
          <div className="ds-lines-top">
            <span aria-hidden="true">{item.icon}</span>
            <span>{item.top}</span>
          </div>
          <h2 className="ds-title">{item.title}</h2>
          <div className="ds-body">{item.body}</div>
        </li>
      ))}
    </ul>
  );
}

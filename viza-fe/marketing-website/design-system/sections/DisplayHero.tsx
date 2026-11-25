import type { ReactNode } from "react";
import { delay } from "../motion/delay";

type Props = {
  /** The page H1: a plain label set at display size (Framer fits it to half the page width). */
  title: ReactNode;
  /** A second line in grey at statement size, for example the contact email. */
  sub?: ReactNode;
  children?: ReactNode;
};

/** Framer contact and about opening: a very large title, an optional grey line, then the page's first block. */
export default function DisplayHero({ title, sub, children }: Props) {
  return (
    <section className="ds-display-hero">
      <div className="ds-container">
        <h1 className="ds-display" data-reveal="hero">
          {title}
        </h1>
        {sub && (
          <div className="ds-display-sub" data-reveal="hero" style={delay(0.1)}>
            {sub}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

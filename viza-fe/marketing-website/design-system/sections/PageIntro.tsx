import type { ReactNode } from "react";
import { delay } from "../motion/delay";
import "../utility.css";

type Props = {
  /** The page H1. */
  title: string;
  lede?: string;
  actions?: ReactNode;
};

/** Title block for the smaller pages: a 64px H1, one grey line and buttons, on the canvas below the header. */
export default function PageIntro({ title, lede, actions }: Props) {
  return (
    <section className="ds-intro">
      <div className="ds-container">
        <h1 className="ds-hero-title ds-intro-title" data-reveal="hero">
          {title}
        </h1>
        {lede && (
          <p className="ds-body ds-intro-lede" data-reveal="hero" style={delay(0.1)}>
            {lede}
          </p>
        )}
        {actions && (
          <div className="ds-intro-actions" data-reveal="hero" style={delay(0.2)}>
            {actions}
          </div>
        )}
      </div>
    </section>
  );
}

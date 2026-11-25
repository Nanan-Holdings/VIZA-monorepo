import type { ReactNode } from "react";
import Image from "next/image";
import Button from "../ui/Button";
import { delay } from "../motion/delay";
import "../hero-fixes.css";

type Cta = { label: string; href: string };

type Props = {
  title: string;
  lede: string;
  image: string;
  primary: Cta;
  secondary?: Cta;
  /** Floating card in the bottom right corner (desktop and tablet only). */
  aside?: ReactNode;
};

/**
 * Home hero from the Framer template: a photo frame inset from the page edge with 16px corners and a 25%
 * shade, the H1, a short line and two pill buttons (white, then glass).
 */
export default function PhotoHero({ title, lede, image, primary, secondary, aside }: Props) {
  return (
    <section className="ds-hero">
      <div className="ds-hero-frame">
        <div className="ds-hero-photo" aria-hidden="true">
          <Image src={image} alt="" fill priority sizes="100vw" />
        </div>
        <div className="ds-container ds-hero-content">
          <h1 className="ds-hero-title ds-hero-h1" data-reveal="hero" style={delay(0.1)}>
            {title}
          </h1>
          <p className="ds-hero-lede" data-reveal="hero" style={delay(0.2)}>
            {lede}
          </p>
          <div className="ds-hero-actions" data-reveal="hero" style={delay(0.3)}>
            <Button href={primary.href} variant="light">
              {primary.label}
            </Button>
            {secondary && (
              <Button href={secondary.href} variant="glass" icon={false}>
                {secondary.label}
              </Button>
            )}
          </div>
        </div>
        {aside && (
          <div className="ds-hero-aside" data-reveal="hero" style={delay(0.5)}>
            {aside}
          </div>
        )}
      </div>
    </section>
  );
}

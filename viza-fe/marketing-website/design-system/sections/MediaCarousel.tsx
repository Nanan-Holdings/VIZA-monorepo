"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Photo from "../ui/Photo";
import { ArrowLeft, ArrowRight } from "../ui/Icons";
import SectionHead from "./SectionHead";
import { stagger } from "../motion/delay";

export type CarouselItem = { title: string; body: string; image: string };

type Props = {
  title: string;
  lede?: string;
  items: CarouselItem[];
  labels: { prev: string; next: string };
};

/**
 * Framer "visa types" carousel: white cards (15px corners, three window dots, a 16px-corner photo and a
 * caption) on a track that runs past the right edge, with round previous and next buttons.
 */
export default function MediaCarousel({ title, lede, items, labels }: Props) {
  const track = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 });
  }, []);

  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [update]);

  const go = (dir: 1 | -1) => {
    const el = track.current;
    const card = el?.querySelector("li");
    if (!el || !card) return;
    el.scrollBy({ left: dir * (card.getBoundingClientRect().width + 12), behavior: "smooth" });
  };

  const controls = (
    <div className="ds-carousel-nav">
      <button type="button" className="ds-icon-btn" aria-label={labels.prev} disabled={edge.start} onClick={() => go(-1)}>
        <ArrowLeft size={16} />
      </button>
      <button type="button" className="ds-icon-btn ds-icon-btn--dark" aria-label={labels.next} disabled={edge.end} onClick={() => go(1)}>
        <ArrowRight size={16} />
      </button>
    </div>
  );

  return (
    <section className="ds-section">
      <div className="ds-container ds-stack">
        <SectionHead title={title} lede={lede} action={controls} />
        <div className="ds-carousel">
          <ul className="ds-carousel-track" ref={track} onScroll={update}>
            {items.map((item, i) => (
              <li key={item.title} className="ds-media-card" data-reveal="" style={stagger(i)}>
                <div className="ds-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </div>
                <Photo src={item.image} sizes="(max-width: 809px) 80vw, 511px" className="ds-media-photo" />
                <div className="ds-media-caption">
                  <h3 className="ds-title">{item.title}</h3>
                  <p className="ds-small">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

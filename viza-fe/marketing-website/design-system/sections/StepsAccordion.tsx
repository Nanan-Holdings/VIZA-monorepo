"use client";

import { useState, type ReactNode } from "react";
import Photo from "../ui/Photo";
import { Minus, Plus } from "../ui/Icons";
import { stagger } from "../motion/delay";

export type Step = { title: string; body: string; image: string; chips?: string[] };

/**
 * Framer "how it works": a tall white side card on the left and a numbered accordion on the right.
 * The open row shows a photo, title, text and chips; closed rows show /00N and the title.
 */
export default function StepsAccordion({ side, steps }: { side: ReactNode; steps: Step[] }) {
  const [open, setOpen] = useState(0);
  return (
    <div className="ds-steps">
      <aside className="ds-steps-side" data-reveal="">
        {side}
      </aside>
      <ol className="ds-steps-list">
        {steps.map((step, i) => {
          const isOpen = i === open;
          const id = `ds-step-${i}`;
          return (
            <li key={step.title} className={`ds-step${isOpen ? " is-open" : ""}`} data-reveal="" style={stagger(i)}>
              <button type="button" className="ds-step-head" aria-expanded={isOpen} aria-controls={id} onClick={() => setOpen(isOpen ? -1 : i)}>
                <span className="ds-step-num">/{String(i + 1).padStart(3, "0")}</span>
                <span className="ds-title ds-step-title">{step.title}</span>
                <span className={`ds-icon-btn ${isOpen ? "ds-icon-btn--dark" : "ds-icon-btn--white"}`} aria-hidden="true">
                  {isOpen ? <Minus size={14} /> : <Plus size={14} />}
                </span>
              </button>
              <div id={id} className="ds-step-body" hidden={!isOpen}>
                <Photo src={step.image} sizes="(max-width: 809px) 100vw, 313px" className="ds-step-photo" />
                <div className="ds-step-text">
                  <p className="ds-body">{step.body}</p>
                  {step.chips && step.chips.length > 0 && (
                    <ul className="ds-chips">
                      {step.chips.map((c) => (
                        <li key={c} className="ds-chip">
                          {c}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

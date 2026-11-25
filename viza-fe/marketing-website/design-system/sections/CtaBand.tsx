import Image from "next/image";
import { Clock, Shield } from "../ui/Icons";
import ContactCard from "./ContactCard";
import ContactForm from "./ContactForm";

type Props = {
  title: string;
  points: [string, string];
  image: string;
  formTitle: string;
  formBody: string;
  card: { title: string; body: string; cta: { label: string; href: string } };
  formId: string;
};

/**
 * Framer closing band: a photo frame (30px corners) with a 64px white title and two short points, a small
 * contact card at the bottom left, and a white form card that rises above the frame's top edge.
 */
export default function CtaBand({ title, points, image, formTitle, formBody, card, formId }: Props) {
  return (
    <section className="ds-cta" id="get-in-touch">
      <div className="ds-cta-frame">
        <div className="ds-cta-photo" aria-hidden="true">
          <Image src={image} alt="" fill sizes="100vw" />
        </div>
        <div className="ds-container ds-cta-inner">
          <div className="ds-cta-copy">
            <h2 className="ds-hero-title ds-cta-title" data-reveal="">
              {title}
            </h2>
            <ul className="ds-cta-points" data-reveal="">
              <li>
                <Shield size={18} />
                {points[0]}
              </li>
              <li>
                <Clock size={18} />
                {points[1]}
              </li>
            </ul>
            <div className="ds-cta-card" data-reveal="pop">
              <ContactCard {...card} />
            </div>
          </div>
          <div className="ds-card ds-cta-form" data-reveal="">
            <h3 className="ds-statement">{formTitle}</h3>
            <p className="ds-body">{formBody}</p>
            <ContactForm variant="short" formId={formId} />
          </div>
        </div>
      </div>
    </section>
  );
}

import Button from "../ui/Button";
import { Chat } from "../ui/Icons";

type Props = { title: string; body: string; cta: { label: string; href: string } };

/**
 * The small white card from the Framer FAQ and CTA band ("Hi, I'm your consultant"). The template's stock
 * portrait is replaced by a navy chat tile, since VIZA has no consultant photos to show.
 */
export default function ContactCard({ title, body, cta }: Props) {
  return (
    <div className="ds-card ds-contact-card">
      <span className="ds-contact-card-icon" aria-hidden="true">
        <Chat size={26} strokeWidth={1.8} />
      </span>
      <div className="ds-contact-card-text">
        <p className="ds-contact-card-title">{title}</p>
        <p className="ds-body">{body}</p>
      </div>
      <Button href={cta.href} block>
        {cta.label}
      </Button>
    </div>
  );
}

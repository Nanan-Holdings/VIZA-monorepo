import Button from "../ui/Button";

/** Closing navy band with a plain title, one line and one button (links to the free application). */
export default function EndCta({ title, body, action, href }: { title: string; body: string; action: string; href: string }) {
  return (
    <section className="ds-endcta">
      <div className="ds-endcta-frame" data-reveal="">
        <div>
          <h2>{title}</h2>
          <p>{body}</p>
        </div>
        <Button href={href} variant="light">
          {action}
        </Button>
      </div>
    </section>
  );
}

import type { ReactNode } from "react";

/**
 * Framer statement row: the section title in the first column and a large paragraph across the other two,
 * with optional content underneath.
 */
type Props = {
  title: string;
  text: ReactNode;
  children?: ReactNode;
  id?: string;
  /** Title size: "h2" (60px) by default, "statement" (40px) beside a form. */
  size?: "h2" | "statement";
};

export default function Statement({ title, text, children, id, size = "h2" }: Props) {
  return (
    <div className="ds-statement-row" id={id}>
      <h2 className={`${size === "h2" ? "ds-h2" : "ds-statement"} ds-statement-title`} data-reveal="">
        {title}
      </h2>
      <div className="ds-statement-body" data-reveal="">
        <p className="ds-statement ds-statement-text">{text}</p>
        {children}
      </div>
    </div>
  );
}

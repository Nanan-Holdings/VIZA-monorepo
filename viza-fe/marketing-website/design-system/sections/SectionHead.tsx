import type { ReactNode } from "react";

type Props = {
  title: string;
  /** Plain label of one to three words. Defaults to an h2. */
  as?: "h1" | "h2";
  /** Short line beside the title (the Framer description column). */
  lede?: ReactNode;
  /** Button or controls, right-aligned beside the title. */
  action?: ReactNode;
  /** "h2" (60px) for most sections, "statement" (40px) for compact ones. */
  size?: "h2" | "statement";
  id?: string;
};

/**
 * Section heading row from the Framer template: the title on the left, the description and an optional
 * button on the right, on the template's three equal columns. No eyebrow label: the title is the label.
 */
export default function SectionHead({ title, as: Tag = "h2", lede, action, size = "h2", id }: Props) {
  return (
    <div className="ds-head" data-reveal="">
      <Tag id={id} className={size === "h2" ? "ds-h2" : "ds-statement"}>
        {title}
      </Tag>
      {(lede || action) && (
        <div className="ds-head-aside">
          {lede && <p className="ds-body">{lede}</p>}
          {action}
        </div>
      )}
    </div>
  );
}

import type { ReactNode } from "react";
import { Link } from "@/navigation";
import { ChevronRight } from "./Icons";

export type ButtonVariant = "primary" | "light" | "glass" | "muted";

type Props = {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  /** Show the Framer chevron after the label (default true). */
  icon?: boolean;
  block?: boolean;
  className?: string;
  /** Plain <a> for portal links, hashes and other sites; locale-aware Link otherwise. */
  external?: boolean;
  ariaLabel?: string;
};

/** The Framer pill button: 48px tall, 14px 28px padding, label plus chevron that nudges right on hover. */
export default function Button({ href, children, variant = "primary", icon = true, block, className, external, ariaLabel }: Props) {
  const cls = ["ds-btn", variant !== "primary" && `ds-btn--${variant}`, block && "ds-btn--block", className].filter(Boolean).join(" ");
  const inner = (
    <>
      <span>{children}</span>
      {icon && <ChevronRight className="ds-btn-icon" size={16} />}
    </>
  );
  const plain = external || href.startsWith("#") || /^(https?:|mailto:|tel:)/.test(href);
  return plain ? (
    <a className={cls} href={href} aria-label={ariaLabel}>
      {inner}
    </a>
  ) : (
    <Link className={cls} href={href} aria-label={ariaLabel}>
      {inner}
    </Link>
  );
}

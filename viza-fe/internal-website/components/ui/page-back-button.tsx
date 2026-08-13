"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ButtonHTMLAttributes, MouseEvent } from "react";

import { cn } from "@/lib/utils";

type PageBackButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "type"> & {
  fallbackHref: string;
  label: string;
};

export function PageBackButton({
  className,
  fallbackHref,
  label,
  onClick,
  ...props
}: PageBackButtonProps) {
  const router = useRouter();

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    onClick?.(event);
    if (event.defaultPrevented) return;

    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  }

  return (
    <button
      {...props}
      type="button"
      aria-label={label}
      title={label}
      onClick={handleClick}
      className={cn(
        "inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-sm text-foreground transition-opacity hover:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
    >
      <ArrowLeft aria-hidden="true" className="h-7 w-7" />
    </button>
  );
}

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function portalUrl(path = "/client/login"): string {
  const base =
    process.env.NEXT_PUBLIC_PORTAL_URL?.replace(/\/$/, "") ??
    "https://app.viza.com";
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

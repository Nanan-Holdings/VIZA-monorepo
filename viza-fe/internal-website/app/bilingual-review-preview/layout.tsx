import { notFound } from "next/navigation";
import type { ReactNode } from "react";

/* Development preview only: it holds sample data, so production answers 404,
   like schema-qa and edge-cases. */
export default function PreviewOnlyLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}

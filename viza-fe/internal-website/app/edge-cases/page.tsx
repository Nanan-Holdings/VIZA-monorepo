import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EdgeCasesClient } from "./edge-cases-client";
import { loadApplicationSchemaEdgeCaseCatalog } from "./data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Application form edge cases · VIZA",
  description: "Live component study for design edge cases in the VIZA master visa schema.",
};

export default async function EdgeCasesPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const catalog = await loadApplicationSchemaEdgeCaseCatalog();
  return <EdgeCasesClient catalog={catalog} />;
}

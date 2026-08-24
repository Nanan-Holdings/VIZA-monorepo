import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { loadSchemaQaPreview } from "./data";
import { SchemaQaClient } from "./schema-qa-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Schema QA preview · VIZA",
  description: "Development-only non-persistent visa schema completion preview.",
};

export default async function SchemaQaPage({
  searchParams,
}: {
  searchParams: Promise<{ visaType?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const params = await searchParams;
  const preview = await loadSchemaQaPreview(params.visaType);
  return <SchemaQaClient {...preview} />;
}

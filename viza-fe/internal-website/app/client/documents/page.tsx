import { redirect } from "next/navigation";
import { DocumentCenterClient } from "./document-center-client";
import { loadDocumentCenterData } from "./actions";

export const dynamic = "force-dynamic";

type DocumentsSearchParams =
  | Record<string, string | string[] | undefined>
  | Promise<Record<string, string | string[] | undefined>>;

function readParam(params: Record<string, string | string[] | undefined>, key: string): string | null {
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams?: DocumentsSearchParams;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const result = await loadDocumentCenterData({
    applicationId: readParam(resolvedSearchParams, "applicationId"),
    country: readParam(resolvedSearchParams, "country"),
    visaType: readParam(resolvedSearchParams, "visaType") ?? readParam(resolvedSearchParams, "visa_type"),
  });

  if (!result.ok && result.code === "not_authenticated") {
    redirect("/client/login");
  }

  return <DocumentCenterClient initialData={result.ok ? result.data : null} initialError={result.ok ? null : result.error} />;
}

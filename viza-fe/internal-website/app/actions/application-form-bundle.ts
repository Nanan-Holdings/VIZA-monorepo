"use server";

import { getTeamApplicationContext } from "@/app/actions/application-group";
import { loadDynamicAnswers } from "@/app/actions/visa-application-answers";
import { loadDocumentCenterData } from "@/app/client/documents/actions";

/**
 * Everything the application form needs for an application named in the URL,
 * loaded in one round trip. Next.js runs a page's server actions one at a
 * time, so calling the three separately costs the sum of their latencies;
 * here they run in parallel on the server. Each loader keeps its own session
 * and ownership checks.
 */
export async function loadApplicationFormBundle(
  applicationId: string,
  documents: { country: string; visaType: string },
) {
  const [context, answers, documentCenter] = await Promise.all([
    getTeamApplicationContext(applicationId),
    loadDynamicAnswers(applicationId),
    loadDocumentCenterData({ applicationId, country: documents.country, visaType: documents.visaType }),
  ]);
  return { context, answers, documents: documentCenter };
}

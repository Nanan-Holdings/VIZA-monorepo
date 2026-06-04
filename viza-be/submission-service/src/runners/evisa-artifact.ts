import { artifact } from "../artifact.js";
import { supabase } from "../supabase.js";

/**
 * Shared e-visa artifact capture + storage (RUN-CORE-003).
 *
 * Submit-capable runners call `storeEvisaArtifact` to persist the
 * confirmation / e-visa PDF under a country-tagged key and write the
 * reference onto the runner_job row the portal status page reads
 * (POR-007). Uses the jobId-scoped artifact bucket so any country code
 * works (the typed CountryCode bucket helper only covers US/FR/UK/VN/AU).
 */

export function evisaArtifactKey(country: string, jobId: string, ext = "pdf"): string {
  const safe = country.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  return `${safe}-evisa-${jobId}.${ext}`;
}

export interface StoreEvisaInput {
  applicationId: string;
  jobId: string;
  country: string;
  data: Buffer;
  ext?: string;
  contentType?: string;
}

export async function storeEvisaArtifact(input: StoreEvisaInput): Promise<string> {
  const key = evisaArtifactKey(input.country, input.jobId, input.ext ?? "pdf");
  const ref = await artifact.put(input.jobId, key, input.data, {
    contentType: input.contentType ?? "application/pdf",
    upsert: true,
  });

  // Write the reference onto the runner_job row(s) for this application so
  // the status page can surface a download link (best-effort; merges into
  // the existing metadata).
  const { data: row } = await supabase
    .from("runner_job")
    .select("id, metadata")
    .eq("application_id", input.applicationId)
    .order("enqueued_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (row?.id) {
    const metadata = { ...(row.metadata as Record<string, unknown> | null), evisaArtifactPath: ref.path, evisaCountry: input.country };
    await supabase.from("runner_job").update({ metadata }).eq("id", row.id);
  }

  return ref.path;
}

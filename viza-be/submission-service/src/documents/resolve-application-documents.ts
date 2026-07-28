/**
 * Resolve applicant-uploaded documents (from the Documents center /
 * `application_documents`, NOT `visa_application_answers`) into local files
 * a Playwright automation can attach.
 *
 * Mirrors the download step of src/index.ts's digital-arrival-card pipeline
 * (`downloadDocuments`), generalized to key by `requirement_key` — the
 * column that matches `document_requirements.requirement_key` and the seed
 * contract's `field_name`s (see docs/tw-entry-permit-auto-submit-plan.md).
 *
 * IMPORTANT: as of this writing, no country's runner reads
 * `application_documents` this way yet for automation input — this is a
 * new, reusable helper, not an existing wired-up path. Callers must not
 * assume a document exists; `resolveApplicationDocumentPaths` returns
 * `undefined` for any requirement_key it can't find/download rather than
 * throwing, so a missing optional document doesn't abort the whole run.
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { supabase } from "../supabase.js";

interface ApplicationDocumentRow {
  document_type: string;
  requirement_key: string | null;
  storage_path: string | null;
  filename: string | null;
}

const STORAGE_BUCKET = "application-documents";

/**
 * Downloads every `application_documents` row for `applicationId` that has
 * a `storage_path`, into a fresh temp directory, and returns a map keyed by
 * `requirement_key` (falling back to `document_type` when `requirement_key`
 * is null, since the upload path defaults `requirementKey` to `documentType`
 * — see app/client/documents/actions.ts's `uploadApplicationDocument`).
 */
export async function resolveApplicationDocumentPaths(
  applicationId: string,
): Promise<Map<string, string>> {
  const localPaths = new Map<string, string>();

  const { data: rows, error } = await supabase
    .from("application_documents")
    .select("document_type, requirement_key, storage_path, filename")
    .eq("application_id", applicationId);

  if (error || !rows) return localPaths;

  const documents = rows as ApplicationDocumentRow[];
  if (documents.length === 0) return localPaths;

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `viza-docs-${applicationId}-`));

  for (const doc of documents) {
    if (!doc.storage_path) continue;
    const key = doc.requirement_key ?? doc.document_type;
    if (!key) continue;

    const { data, error: downloadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(doc.storage_path);
    if (downloadError || !data) {
      console.warn(`[resolve-application-documents] Could not download ${key}: ${downloadError?.message}`);
      continue;
    }

    const filename = doc.filename ?? `${key}.bin`;
    const localPath = path.join(tempDir, filename);
    const buffer = Buffer.from(await data.arrayBuffer());
    fs.writeFileSync(localPath, buffer);
    localPaths.set(key, localPath);
  }

  return localPaths;
}

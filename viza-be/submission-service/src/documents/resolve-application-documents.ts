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
 * Preflight callers must use `resolveApplicationDocumentInventory`, which
 * reads metadata only. Callers that actually need plaintext attachments must
 * own the disposable lease returned by `resolveApplicationDocumentPaths` and
 * invoke `cleanup()` in a `finally` block.
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { supabase } from "../supabase.js";
import { reusableDocumentAliases } from "./reusable-document-aliases.js";

interface ApplicationDocumentRow {
  document_type: string;
  requirement_key: string | null;
  storage_path: string | null;
  filename: string | null;
  status: string | null;
}

interface UniversalProfileDocumentRow {
  document_type: string;
  storage_path: string | null;
  filename: string | null;
  status: string | null;
}

const STORAGE_BUCKET = "application-documents";
export const USABLE_APPLICATION_DOCUMENT_STATUSES = [
  "uploaded",
  "validated",
  "accepted",
  "approved",
] as const;

export interface ApplicationDocumentPathLease {
  paths: Map<string, string>;
  /** Idempotently removes every downloaded plaintext file and clears paths. */
  cleanup: () => Promise<void>;
}

function applicationDocumentKeys(
  applicationDocuments: Array<Pick<ApplicationDocumentRow, "document_type" | "requirement_key" | "storage_path" | "status">>,
  universalDocuments: Array<Pick<UniversalProfileDocumentRow, "document_type" | "storage_path" | "status">>,
): Set<string> {
  const keys = new Set<string>();
  for (const document of universalDocuments) {
    if (!isUsableApplicationDocument(document)) continue;
    for (const alias of reusableDocumentAliases(document.document_type)) {
      if (alias) keys.add(alias);
    }
  }
  for (const document of applicationDocuments) {
    if (!isUsableApplicationDocument(document)) continue;
    const sourceKeys = new Set([
      document.requirement_key ?? document.document_type,
      document.document_type,
    ]);
    for (const sourceKey of sourceKeys) {
      if (!sourceKey) continue;
      for (const alias of reusableDocumentAliases(sourceKey)) {
        if (alias) keys.add(alias);
      }
    }
  }
  return keys;
}

export function isUsableApplicationDocument(
  document: { storage_path: string | null; status: string | null },
): boolean {
  const status = document.status?.trim().toLowerCase() ?? "";
  return Boolean(document.storage_path?.trim()) &&
    USABLE_APPLICATION_DOCUMENT_STATUSES.includes(
      status as (typeof USABLE_APPLICATION_DOCUMENT_STATUSES)[number],
    );
}

/**
 * Returns requirement/alias keys from database metadata without downloading
 * applicant bytes or creating a temporary directory.
 */
export async function resolveApplicationDocumentInventory(
  applicationId: string,
): Promise<Set<string>> {
  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .select("applicant_id")
    .eq("id", applicationId)
    .single();
  if (applicationError || !application?.applicant_id) return new Set<string>();

  const [applicationDocumentsResult, universalDocumentsResult] = await Promise.all([
    supabase
      .from("application_documents")
      .select("document_type, requirement_key, storage_path, status")
      .eq("application_id", applicationId)
      .in("status", [...USABLE_APPLICATION_DOCUMENT_STATUSES]),
    supabase
      .from("universal_profile_documents")
      .select("document_type, storage_path, status")
      .eq("applicant_id", application.applicant_id)
      .in("status", [...USABLE_APPLICATION_DOCUMENT_STATUSES])
      .order("updated_at", { ascending: false, nullsFirst: false }),
  ]);
  if (applicationDocumentsResult.error || universalDocumentsResult.error) {
    return new Set<string>();
  }

  return applicationDocumentKeys(
    (applicationDocumentsResult.data ?? []) as ApplicationDocumentRow[],
    (universalDocumentsResult.data ?? []) as UniversalProfileDocumentRow[],
  );
}

export function createApplicationDocumentPathLease(
  tempDir: string | null,
  paths: Map<string, string>,
): ApplicationDocumentPathLease {
  if (
    tempDir &&
    (
      path.dirname(path.resolve(tempDir)) !== path.resolve(os.tmpdir()) ||
      !path.basename(tempDir).startsWith("viza-docs-")
    )
  ) {
    throw new Error("Document path lease must own one VIZA temporary directory");
  }
  let cleaned = false;
  return {
    paths,
    cleanup: async () => {
      if (cleaned) return;
      cleaned = true;
      paths.clear();
      if (tempDir) {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      }
    },
  };
}

/**
 * Downloads every `application_documents` row for `applicationId` that has
 * a `storage_path`, into a fresh temp directory, and returns a disposable
 * lease whose map is keyed by
 * `requirement_key` (falling back to `document_type` when `requirement_key`
 * is null, since the upload path defaults `requirementKey` to `documentType`
 * — see app/client/documents/actions.ts's `uploadApplicationDocument`).
 */
export async function resolveApplicationDocumentPaths(
  applicationId: string,
): Promise<ApplicationDocumentPathLease> {
  const localPaths = new Map<string, string>();
  const emptyLease = (): ApplicationDocumentPathLease =>
    createApplicationDocumentPathLease(null, localPaths);

  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .select("applicant_id")
    .eq("id", applicationId)
    .single();
  if (applicationError || !application?.applicant_id) return emptyLease();

  const [applicationDocumentsResult, universalDocumentsResult] = await Promise.all([
    supabase
      .from("application_documents")
      .select("document_type, requirement_key, storage_path, filename, status")
      .eq("application_id", applicationId)
      .in("status", [...USABLE_APPLICATION_DOCUMENT_STATUSES]),
    supabase
      .from("universal_profile_documents")
      .select("document_type, storage_path, filename, status")
      .eq("applicant_id", application.applicant_id)
      .in("status", [...USABLE_APPLICATION_DOCUMENT_STATUSES])
      .order("updated_at", { ascending: false, nullsFirst: false }),
  ]);

  if (applicationDocumentsResult.error || universalDocumentsResult.error) return emptyLease();

  const applicationDocuments = (applicationDocumentsResult.data ?? []) as ApplicationDocumentRow[];
  const universalDocuments = (universalDocumentsResult.data ?? []) as UniversalProfileDocumentRow[];
  const documents: Array<ApplicationDocumentRow & { aliases: readonly string[] }> = [
    ...universalDocuments.map((document) => ({
      document_type: document.document_type,
      requirement_key: null,
      storage_path: document.storage_path,
      filename: document.filename,
      status: document.status,
      aliases: reusableDocumentAliases(document.document_type),
    })),
    ...applicationDocuments.map((document) => ({
      ...document,
      aliases: [
        ...new Set([
          ...reusableDocumentAliases(document.requirement_key ?? document.document_type),
          ...reusableDocumentAliases(document.document_type),
        ]),
      ],
    })),
  ];
  if (documents.length === 0) return emptyLease();

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `viza-docs-${applicationId}-`));
  const lease = createApplicationDocumentPathLease(tempDir, localPaths);

  try {
    for (const [index, doc] of documents.entries()) {
      if (!isUsableApplicationDocument(doc)) continue;
      const keys = doc.aliases.filter(Boolean);
      if (keys.length === 0) continue;

      const { data, error: downloadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .download(doc.storage_path as string);
      if (downloadError || !data) {
        console.warn(
          `[resolve-application-documents] Document download unavailable for requirement ${keys[0]}`,
        );
        continue;
      }

      const filename = path.basename(doc.filename ?? `${keys[0]}.bin`);
      const localPath = path.join(tempDir, `${index}-${filename}`);
      const buffer = Buffer.from(await data.arrayBuffer());
      fs.writeFileSync(localPath, buffer);
      for (const key of keys) localPaths.set(key, localPath);
    }
    return lease;
  } catch (error) {
    await lease.cleanup();
    throw error;
  }
}

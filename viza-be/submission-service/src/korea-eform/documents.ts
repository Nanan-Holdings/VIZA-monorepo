import fs from "node:fs/promises";
import path from "node:path";
import { supabase } from "../supabase";
import type { KoreaOfficialEformDocumentPaths } from "./portal";

interface ApplicationDocumentRow {
  application_id?: string | null;
  document_type: string | null;
  storage_path: string | null;
  filename?: string | null;
  created_at?: string | null;
}

const PHOTO_TYPES = [
  "applicant_photo_cropped",
  "applicant_photo",
  "photo",
  "passport_photo",
  "id_photo",
] as const;

const PASSPORT_TYPES = [
  "passport_scan",
  "passport_copy",
  "passport_bio_page",
  "passport",
  "passport_full_image",
] as const;

function sanitizeFileName(value: string) {
  return value.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^_+/, "") || "document.bin";
}

function extensionFromPath(value: string | null | undefined) {
  const ext = path.extname(value ?? "").toLowerCase();
  return ext && ext.length <= 8 ? ext : "";
}

function pickDocument(
  rows: ApplicationDocumentRow[],
  preferredTypes: readonly string[],
): ApplicationDocumentRow | null {
  const sortedRows = [...rows].sort((left, right) => {
    const leftImage = /\.(?:jpe?g|png|webp)$/i.test(left.filename ?? left.storage_path ?? "") ? 1 : 0;
    const rightImage = /\.(?:jpe?g|png|webp)$/i.test(right.filename ?? right.storage_path ?? "") ? 1 : 0;
    if (leftImage !== rightImage) return rightImage - leftImage;
    return new Date(right.created_at ?? 0).getTime() - new Date(left.created_at ?? 0).getTime();
  });
  for (const documentType of preferredTypes) {
    const exact = sortedRows.find((row) => row.document_type === documentType && row.storage_path);
    if (exact) return exact;
  }
  const fuzzy = sortedRows.find((row) =>
    Boolean(row.storage_path) &&
    preferredTypes.some((documentType) => (row.document_type ?? "").toLowerCase().includes(documentType.replace(/^applicant_/, ""))),
  );
  return fuzzy ?? null;
}

async function loadDocumentRowsForApplicationAndApplicant(applicationId: string) {
  const { data: currentRows, error: currentError } = await supabase
    .from("application_documents")
    .select("application_id, document_type, storage_path, filename, created_at")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false });
  if (currentError) throw new Error(`Could not load Korea e-Form documents: ${currentError.message}`);
  const current = (currentRows ?? []) as ApplicationDocumentRow[];
  if (pickDocument(current, PHOTO_TYPES) && pickDocument(current, PASSPORT_TYPES)) {
    return current;
  }

  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .select("applicant_id")
    .eq("id", applicationId)
    .maybeSingle();
  if (applicationError || !application?.applicant_id) return current;

  const { data: applications, error: applicationsError } = await supabase
    .from("applications")
    .select("id")
    .eq("applicant_id", application.applicant_id);
  if (applicationsError) throw new Error(`Could not load reusable Korea e-Form applications: ${applicationsError.message}`);

  const applicationIds = ((applications ?? []) as Array<{ id: string | null }>)
    .map((row) => row.id)
    .filter((id): id is string => Boolean(id));
  if (applicationIds.length === 0) return current;

  const { data: reusableRows, error: reusableError } = await supabase
    .from("application_documents")
    .select("application_id, document_type, storage_path, filename, created_at")
    .in("application_id", applicationIds)
    .order("created_at", { ascending: false });
  if (reusableError) throw new Error(`Could not load reusable Korea e-Form documents: ${reusableError.message}`);

  const reusable = ((reusableRows ?? []) as ApplicationDocumentRow[]).filter((row) => row.storage_path);
  const currentIds = new Set(current.map((row) => `${row.application_id ?? ""}:${row.document_type ?? ""}:${row.storage_path ?? ""}`));
  const siblingRows = reusable.filter((row) => !currentIds.has(`${row.application_id ?? ""}:${row.document_type ?? ""}:${row.storage_path ?? ""}`));
  return [...current, ...siblingRows];
}

async function downloadDocument(row: ApplicationDocumentRow, tempDir: string, fallbackName: string) {
  if (!row.storage_path) return null;
  const { data, error } = await supabase.storage.from("application-documents").download(row.storage_path);
  if (error || !data) {
    throw new Error(`Could not download Korea e-Form document '${row.document_type ?? fallbackName}': ${error?.message ?? "empty response"}`);
  }
  await fs.mkdir(tempDir, { recursive: true });
  const fileName = sanitizeFileName(row.filename ?? `${fallbackName}${extensionFromPath(row.storage_path) || ".bin"}`);
  const localPath = path.join(tempDir, fileName);
  await fs.writeFile(localPath, Buffer.from(await data.arrayBuffer()));
  return localPath;
}

export async function loadKoreaOfficialEformDocuments(
  applicationId: string,
  tempDir = path.resolve(process.cwd(), "output", "korea-eform-documents", applicationId),
): Promise<{
  documents: KoreaOfficialEformDocumentPaths;
  missingUploads: Array<"photo" | "passport_scan">;
  availableDocumentTypes: string[];
}> {
  const rows = await loadDocumentRowsForApplicationAndApplicant(applicationId);
  const photo = pickDocument(rows, PHOTO_TYPES);
  const passport = pickDocument(rows, PASSPORT_TYPES);
  const photoFilePath = photo ? await downloadDocument(photo, tempDir, "photo") : null;
  const passportScanFilePath = passport ? await downloadDocument(passport, tempDir, "passport_scan") : null;

  return {
    documents: {
      photoFilePath,
      passportScanFilePath,
    },
    missingUploads: [
      ...(!photoFilePath ? ["photo" as const] : []),
      ...(!passportScanFilePath ? ["passport_scan" as const] : []),
    ],
    availableDocumentTypes: rows.map((row) => row.document_type).filter((value): value is string => Boolean(value)),
  };
}

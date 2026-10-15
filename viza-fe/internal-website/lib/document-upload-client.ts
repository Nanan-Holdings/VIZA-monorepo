import { EVENT, currentRoute, track } from "@/lib/analytics/events";

export type ClientDocumentUploadResult =
  | { ok: true; storagePath: string; filename: string }
  | { ok: false; code: string; error: string };

function isUploadResult(value: unknown): value is ClientDocumentUploadResult {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (record.ok === true) {
    return typeof record.storagePath === "string" && typeof record.filename === "string";
  }
  return record.ok === false && typeof record.error === "string";
}

export async function uploadApplicationDocumentFromClient(formData: FormData): Promise<ClientDocumentUploadResult> {
  const response = await fetch("/api/document-upload", {
    method: "POST",
    body: formData,
  });
  const payload: unknown = await response.json().catch(() => null);

  if (isUploadResult(payload)) {
    if (payload.ok) trackDocumentUploaded(formData);
    return payload;
  }

  return {
    ok: false,
    code: "server_error",
    error: response.ok ? "Upload failed" : `Upload failed (${response.status})`,
  };
}

/* Document type keys are snake_case codes; anything else (for example a
   custom requirement label) is reported as "other" so no free text leaves. */
const DOCUMENT_TYPE_CODE = /^[a-z0-9_]{1,64}$/;

function trackDocumentUploaded(formData: FormData): void {
  const raw = formData.get("documentType");
  const documentType = typeof raw === "string" && DOCUMENT_TYPE_CODE.test(raw) ? raw : "other";
  // Count and type only. The file, its name and the application id stay out.
  track(EVENT.documents_uploaded, {
    count: 1,
    doc_types: [documentType],
    source: currentRoute(),
  });
}

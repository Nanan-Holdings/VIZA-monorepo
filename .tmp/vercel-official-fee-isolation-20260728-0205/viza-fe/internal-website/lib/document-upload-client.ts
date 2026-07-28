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

  if (isUploadResult(payload)) return payload;

  return {
    ok: false,
    code: "server_error",
    error: response.ok ? "Upload failed" : `Upload failed (${response.status})`,
  };
}

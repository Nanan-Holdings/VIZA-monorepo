import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

export interface Ds160AuditStore {
  encrypt: (plaintext: string) => string;
  write: (name: string, ciphertext: string) => Promise<void>;
}

/** Never put applicant answers or review values in queue logs or public files. */
export async function persistDs160InputSnapshot(
  store: Ds160AuditStore,
  snapshot: Record<string, unknown>,
): Promise<void> {
  await store.write("input-snapshot.enc", store.encrypt(JSON.stringify({
    version: 1,
    evidenceKind: "worker_input_before_official_navigation",
    capturedAt: new Date().toISOString(),
    ...snapshot,
  })));
}

const EVIDENCE_NAME = /^(?:review-\d+\.(?:json|png)|official-review-(?:expectations|diff)\.json|ceac-[a-z0-9_-]+\.png|bootstrap-failure\.(?:json|png))$/i;

/** Preserve review and failure evidence before the private run directory is removed. */
export async function persistDs160RunEvidence(
  store: Ds160AuditStore,
  directory: string,
  name: "official-evidence.enc" | "pre-sign-review.enc" = "official-evidence.enc",
): Promise<number> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const evidence: Array<{ name: string; sha256: string; sizeBytes: number; contentBase64: string }> = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isFile() || !EVIDENCE_NAME.test(entry.name)) continue;
    const buffer = await fs.readFile(path.join(directory, entry.name));
    evidence.push({
      name: entry.name,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      sizeBytes: buffer.length,
      contentBase64: buffer.toString("base64"),
    });
  }
  if (name === "pre-sign-review.enc" && (
    !evidence.some(file => /^review-\d+\.json$/.test(file.name)) ||
    !evidence.some(file => file.name === "official-review-expectations.json") ||
    !evidence.some(file => file.name === "official-review-diff.json")
  )) {
    throw new Error("DS-160 official review artifacts are missing before final submission.");
  }
  if (evidence.length === 0) return 0;
  await store.write(name, store.encrypt(JSON.stringify({
    version: 1,
    capturedAt: new Date().toISOString(),
    // Review pages precede signing; a bundle alone is not submission proof.
    evidenceKind: "official_review_and_run_diagnostics",
    files: evidence,
  })));
  return evidence.length;
}

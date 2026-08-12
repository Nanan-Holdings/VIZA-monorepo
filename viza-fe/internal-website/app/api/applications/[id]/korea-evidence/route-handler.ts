import * as path from "node:path";

export type KoreaEvidenceSource =
  | { kind: "storage"; path: string }
  | { kind: "local"; path: string };

function storageEvidencePath(value: string, applicationId: string): string | null {
  if (value.includes("\\") || value.startsWith("/") || value.split("/").some((part) => part === ".." || part === ".")) {
    return null;
  }
  const prefix = `korea-appointments/${applicationId}/`;
  if (!value.startsWith(prefix)) return null;
  const filename = value.slice(prefix.length);
  return filename && !filename.includes("/") ? value : null;
}

function localEvidencePath(value: string, cwd: string): string | null {
  const repoRoot = path.resolve(cwd, "..", "..");
  const allowedRoots = [
    path.resolve(repoRoot, "output"),
    path.resolve(repoRoot, "viza-be", "submission-service", "output"),
  ];
  const candidate = path.isAbsolute(value)
    ? path.resolve(value)
    : path.resolve(repoRoot, "viza-be", "submission-service", value);
  return allowedRoots.some((root) => candidate === root || candidate.startsWith(`${root}${path.sep}`))
    ? candidate
    : null;
}

export function resolveKoreaEvidenceSource(
  value: string,
  applicationId: string,
  cwd = process.cwd(),
): KoreaEvidenceSource | null {
  const storagePath = storageEvidencePath(value, applicationId);
  if (storagePath) return { kind: "storage", path: storagePath };
  const localPath = localEvidencePath(value, cwd);
  return localPath ? { kind: "local", path: localPath } : null;
}

export function koreaEvidenceContentType(value: string): string {
  const extension = path.extname(value).toLowerCase();
  if (extension === ".pdf") return "application/pdf";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  return "image/png";
}


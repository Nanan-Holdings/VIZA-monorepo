import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Legal document version hashes (LEGAL-002).
 *
 * The "doc version" stored in `consent_event` is the SHA-256 of the
 * rendered markdown source. Counsel-reviewed publishes change the
 * hash, which means the consent gate naturally re-prompts users at
 * the next sign-in (or wherever the gate is enforced) when the doc
 * is updated. No manual versioning bookkeeping needed.
 *
 * Resolution is filesystem-relative to the monorepo root so the
 * function works at build time and at runtime in the Next.js server
 * environment. The result is cached at module load.
 */

export type DocKind = "tos" | "privacy" | "application_authorisation" | "dpa";

const DOC_FILES: Record<DocKind, string> = {
  tos: "docs/legal/terms-of-service.md",
  privacy: "docs/legal/privacy-policy.md",
  application_authorisation: "docs/legal/application-authorisation.md",
  dpa: "docs/legal/dpa.md",
};

function resolveRepoRoot(): string {
  // Two levels up from viza-fe/internal-website → repo root.
  return join(process.cwd(), "..", "..");
}

function hashFileContents(absPath: string): string {
  try {
    const bytes = readFileSync(absPath);
    return createHash("sha256").update(bytes).digest("hex");
  } catch {
    // Per-application authorisation has no separate file yet — its
    // text lives inline on the signing page. Fall back to a stable
    // sentinel so consent rows still record a deterministic version.
    return createHash("sha256")
      .update(`viza:fallback:${absPath}`)
      .digest("hex");
  }
}

const versionCache = new Map<DocKind, string>();

export function documentVersion(kind: DocKind): string {
  const cached = versionCache.get(kind);
  if (cached) return cached;
  const root = resolveRepoRoot();
  const abs = join(root, DOC_FILES[kind]);
  const v = hashFileContents(abs);
  versionCache.set(kind, v);
  return v;
}

export function allDocumentVersions(): Record<DocKind, string> {
  return {
    tos: documentVersion("tos"),
    privacy: documentVersion("privacy"),
    application_authorisation: documentVersion("application_authorisation"),
    dpa: documentVersion("dpa"),
  };
}

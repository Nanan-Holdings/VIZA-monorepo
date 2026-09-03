import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const sourceRoots = ["app", "components"];
const skippedPathParts = [
  "/__tests__/",
  "/app/api/",
  "/app/ui-components/",
  "/components/ui/",
  "/design-system/",
];

function productionTsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    const projectPath = `/${relative(projectRoot, path).replaceAll("\\", "/")}`;

    if (skippedPathParts.some((part) => projectPath.includes(part))) return [];
    if (entry.isDirectory()) return productionTsxFiles(path);
    return entry.isFile() && entry.name.endsWith(".tsx") ? [path] : [];
  });
}

function lineNumber(source: string, offset: number): number {
  return source.slice(0, offset).split("\n").length;
}

function findViolations(pattern: RegExp): string[] {
  return sourceRoots.flatMap((root) => productionTsxFiles(resolve(projectRoot, root))).flatMap((path) => {
    const source = readFileSync(path, "utf8");
    return Array.from(source.matchAll(pattern), (match) =>
      `${relative(projectRoot, path)}:${lineNumber(source, match.index ?? 0)}`,
    );
  });
}

describe("canonical UI alert contract", () => {
  it("does not render hand-styled live-region notice surfaces", () => {
    const intrinsicLiveRegionSurface =
      /<(?:motion\.)?(?:div|p|section)\b(?=[^>]{0,800}(?:role=["'](?:alert|status)["']|aria-live=))(?=[^>]{0,800}className=["'][^"']*(?:rounded|\bbg-(?:red|rose|orange|amber|yellow|green|emerald|blue|sky)-|\bborder-(?:red|rose|orange|amber|yellow|green|emerald|blue|sky)-))[^>]*>/g;

    expect(findViolations(intrinsicLiveRegionSurface)).toEqual([]);
  });

  it("does not attach custom semantic surfaces to the canonical Alert", () => {
    const customAlertTone =
      /<Alert\b(?=[^>]{0,600}className=["'][^"']*(?:\bbg-(?:red|rose|orange|amber|yellow|green|emerald|blue|sky)-|\bborder-(?:red|rose|orange|amber|yellow|green|emerald|blue|sky)-))[^>]*>/g;

    expect(findViolations(customAlertTone)).toEqual([]);
  });

  it("does not hand-style conditional operation feedback", () => {
    const conditionalFeedbackSurface =
      /\{\s*(?:error|errMsg|notice|successMessage|last_error_message)\s*(?:&&|\?)\s*\(?\s*<(?:motion\.)?(?:div|p|section)\b(?=[^>]{0,800}className=["'][^"']*(?:rounded|\bbg-(?:red|rose|orange|amber|yellow|green|emerald|blue|sky)-|\bborder-(?:red|rose|orange|amber|yellow|green|emerald|blue|sky)-))[^>]*>/g;

    expect(findViolations(conditionalFeedbackSurface)).toEqual([]);
  });

  it("does not use blocking browser alerts for application feedback", () => {
    const blockingBrowserAlert = /(?<![\w.])(?:window\.)?alert\s*\(/g;

    expect(findViolations(blockingBrowserAlert)).toEqual([]);
  });

  it("routes transient feedback through the canonical alert toast", () => {
    const directSonnerToastImport =
      /import\s+\{[^}]*\btoast\b[^}]*\}\s+from\s+["']sonner["']/g;

    expect(findViolations(directSonnerToastImport)).toEqual([
      "app/client/chat/chat-client.tsx:17",
    ]);
  });
});

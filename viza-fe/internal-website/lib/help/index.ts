import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Help-article registry (CS-004).
 *
 * Maps the canonical country slug to the docs/help/<cc>.mdx file.
 * Body is loaded lazily; rendered by `lib/help/render.ts` to a tiny
 * subset of markdown (H1/H2/H3, paragraphs, ordered + unordered
 * lists, links).
 */

interface ArticleSpec {
  /** Internal slug used on `applications.country`. */
  country: string;
  /** Bound to `applications.visa_type` — null = matches any visa type for the country. */
  visaType?: string;
  /** Display title shown in the picker. */
  title: string;
  /** docs/help/<file>.mdx — relative to repo root. */
  file: string;
}

export const HELP_ARTICLES: ReadonlyArray<ArticleSpec> = [
  { country: "vietnam", visaType: "VN_E_VISA", title: "Vietnam e-Visa", file: "docs/help/vn.mdx" },
  { country: "united_states", visaType: "B1_B2", title: "US DS-160 B1/B2", file: "docs/help/us.mdx" },
  { country: "united_kingdom", visaType: "UK_STANDARD_VISITOR", title: "UK Standard Visitor", file: "docs/help/uk.mdx" },
  { country: "european_union", visaType: "EU_SCHENGEN_C_SHORT_STAY", title: "Schengen Short-Stay (Type C)", file: "docs/help/eu.mdx" },
  { country: "australia", visaType: "AU_VISITOR_600", title: "Australia Subclass 600", file: "docs/help/au.mdx" },
  { country: "india", visaType: "IN_E_VISA", title: "India e-Visa", file: "docs/help/in.mdx" },
];

function repoRoot(): string {
  return join(process.cwd(), "..", "..");
}

export interface LoadedArticle {
  country: string;
  visaType?: string;
  title: string;
  body: string;
}

export function loadHelpArticle(country: string, visaType?: string): LoadedArticle | null {
  const spec = HELP_ARTICLES.find(
    (a) => a.country === country && (visaType ? a.visaType === visaType : true),
  );
  if (!spec) return null;
  try {
    const body = readFileSync(join(repoRoot(), spec.file), "utf8");
    return { country: spec.country, visaType: spec.visaType, title: spec.title, body };
  } catch {
    return null;
  }
}

export function loadAllHelpArticles(): LoadedArticle[] {
  const out: LoadedArticle[] = [];
  for (const spec of HELP_ARTICLES) {
    try {
      const body = readFileSync(join(repoRoot(), spec.file), "utf8");
      out.push({
        country: spec.country,
        visaType: spec.visaType,
        title: spec.title,
        body,
      });
    } catch {
      // missing files skipped silently — README is allowed to drift
    }
  }
  return out;
}

/** Cheap substring search for chat suggested-replies + the page filter. */
export function searchHelpArticles(query: string): LoadedArticle[] {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];
  return loadAllHelpArticles().filter(
    (a) => a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q),
  );
}

import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Help-article registry (CS-004).
 *
 * Maps the canonical country slug to a lib/help/articles/<cc>.mdx file.
 * Body is loaded lazily; rendered by `lib/help/render.ts` to a tiny
 * subset of markdown (H1/H2/H3, paragraphs, ordered + unordered
 * lists, links).
 *
 * Every readFileSync call site below passes a fully literal module
 * constant: the build-time file tracer otherwise falls back to bundling
 * the entire project directory into every function that imports this
 * file. Literal paths also guarantee the .mdx bodies ship with the
 * function. Do NOT refactor the switch into a lookup table.
 */

const ARTICLE_VN_PATH = join(process.cwd(), "lib/help/articles/vn.mdx");
const ARTICLE_US_PATH = join(process.cwd(), "lib/help/articles/us.mdx");
const ARTICLE_UK_PATH = join(process.cwd(), "lib/help/articles/uk.mdx");
const ARTICLE_EU_PATH = join(process.cwd(), "lib/help/articles/eu.mdx");
const ARTICLE_AU_PATH = join(process.cwd(), "lib/help/articles/au.mdx");
const ARTICLE_IN_PATH = join(process.cwd(), "lib/help/articles/in.mdx");

interface ArticleSpec {
  /** Internal slug used on `applications.country`. */
  country: string;
  /** Bound to `applications.visa_type` — null = matches any visa type for the country. */
  visaType?: string;
  /** Display title shown in the picker. */
  title: string;
}

export const HELP_ARTICLES: ReadonlyArray<ArticleSpec> = [
  { country: "vietnam", visaType: "VN_E_VISA", title: "Vietnam e-Visa" },
  { country: "united_states", visaType: "B1_B2", title: "US DS-160 B1/B2" },
  { country: "united_kingdom", visaType: "UK_STANDARD_VISITOR", title: "UK Standard Visitor" },
  { country: "european_union", visaType: "EU_SCHENGEN_C_SHORT_STAY", title: "Schengen Short-Stay (Type C)" },
  { country: "australia", visaType: "AU_VISITOR_600", title: "Australia Subclass 600" },
  { country: "india", visaType: "IN_E_VISA", title: "India e-Visa" },
];

/** Read an article body; each branch passes a literal const to readFileSync (see header comment). */
function readArticleBody(country: string): string | null {
  try {
    switch (country) {
      case "vietnam":
        return readFileSync(ARTICLE_VN_PATH, "utf8");
      case "united_states":
        return readFileSync(ARTICLE_US_PATH, "utf8");
      case "united_kingdom":
        return readFileSync(ARTICLE_UK_PATH, "utf8");
      case "european_union":
        return readFileSync(ARTICLE_EU_PATH, "utf8");
      case "australia":
        return readFileSync(ARTICLE_AU_PATH, "utf8");
      case "india":
        return readFileSync(ARTICLE_IN_PATH, "utf8");
      default:
        return null;
    }
  } catch {
    // missing files skipped silently — README is allowed to drift
    return null;
  }
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
  const body = readArticleBody(spec.country);
  if (body === null) return null;
  return { country: spec.country, visaType: spec.visaType, title: spec.title, body };
}

export function loadAllHelpArticles(): LoadedArticle[] {
  const out: LoadedArticle[] = [];
  for (const spec of HELP_ARTICLES) {
    const body = readArticleBody(spec.country);
    if (body === null) continue;
    out.push({
      country: spec.country,
      visaType: spec.visaType,
      title: spec.title,
      body,
    });
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

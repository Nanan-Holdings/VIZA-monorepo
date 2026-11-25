import { COUNTRIES, isPublished, type CountryMeta } from "@/lib/countries";

/** Extra words that name a destination in a post, besides the country's own name. */
const ALIASES: Record<string, string[]> = {
  "united-states": ["usa", "u.s.", "us visa", "ds-160", "ds160", "american"],
  "united-kingdom": ["uk", "britain", "british", "england"],
  "united-arab-emirates": ["uae", "dubai", "abu dhabi"],
  turkiye: ["turkey", "turkish", "istanbul"],
  "saudi-arabia": ["saudi"],
  japan: ["japanese", "tokyo"],
  china: ["chinese", "beijing"],
  "south-korea": ["korea", "korean", "k-eta", "seoul"],
  schengen: ["europe visa"],
  india: ["indian"],
  indonesia: ["bali", "indonesian"],
  vietnam: ["vietnamese"],
  thailand: ["thai"],
  malaysia: ["malaysian"],
  egypt: ["egyptian"],
  australia: ["australian"],
  canada: ["canadian"],
  france: ["french", "paris"],
  italy: ["italian", "rome"],
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function firstMatch(text: string, country: CountryMeta): number {
  const terms = [country.name, country.slug.replace(/-/g, " "), ...(ALIASES[country.slug] ?? [])];
  let best = -1;
  for (const term of terms) {
    const m = new RegExp(`(^|[^a-z0-9])${escape(term.toLowerCase())}(?![a-z0-9])`).exec(text);
    if (m && (best === -1 || m.index < best)) best = m.index;
  }
  return best;
}

/**
 * The launched destination a post is about, or null. The title decides; the
 * slug and excerpt are the fallback. Only launched destinations count, because
 * only those have a /visa/<slug> page worth linking to.
 */
export function destinationForPost(post: { title: string; slug: string; excerpt: string }): CountryMeta | null {
  const launched = COUNTRIES.filter(isPublished);
  for (const text of [post.title, post.slug.replace(/-/g, " "), post.excerpt]) {
    const lower = text.toLowerCase();
    let best: { country: CountryMeta; at: number } | null = null;
    for (const country of launched) {
      const at = firstMatch(lower, country);
      if (at !== -1 && (!best || at < best.at)) best = { country, at };
    }
    if (best) return best.country;
  }
  return null;
}

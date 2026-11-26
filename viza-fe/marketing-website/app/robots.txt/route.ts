import { SITE_URL } from "@/lib/seo/site";
import { ALLOWED_CRAWLERS, BLOCKED_AGENTS } from "@/lib/bots/policy";

// A route handler rather than app/robots.ts so the file can carry a Content-Signal line, which the
// Metadata API has no field for. Named search, preview and AI answer crawlers may read every public
// page; every other crawler is asked to stay out. /apply and /status stay crawlable for the named
// crawlers and carry noindex (a crawler must fetch a page to see noindex). The policy lives in
// lib/bots/policy.ts, which proxy.ts also enforces.
export const dynamic = "force-static";

const ALLOW_RULES = ["Allow: /", "Disallow: /api/", "Disallow: /s/", "Disallow: /*?_rsc="].join("\n");

const BODY = `# viza.it.com
# Search engines, link previews and AI answer engines are welcome.
# Bulk copying, mirroring or scraping this site is not permitted.

${ALLOWED_CRAWLERS.map((ua) => `User-agent: ${ua}`).join("\n")}
${ALLOW_RULES}

${BLOCKED_AGENTS.filter((a) => /^[A-Za-z][\w-]*$/.test(a)).map((ua) => `User-agent: ${ua}`).join("\n")}
Disallow: /

User-agent: *
Disallow: /

Content-Signal: search=yes, ai-input=yes, ai-train=yes

Sitemap: ${SITE_URL}/sitemap.xml
`;

export function GET() {
  return new Response(BODY, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

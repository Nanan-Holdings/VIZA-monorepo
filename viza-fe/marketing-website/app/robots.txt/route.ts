import { SITE_URL } from "@/lib/seo/site";

// A route handler rather than app/robots.ts so the file can carry a Content-Signal line, which the
// Metadata API has no field for. /apply and /status stay crawlable and carry noindex instead (a crawler
// must fetch a page to see noindex); only the API, the share-link redirector and RSC payloads are blocked.
export const dynamic = "force-static";

const BODY = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /s/
Disallow: /*?_rsc=

Content-Signal: search=yes, ai-input=yes, ai-train=yes

Sitemap: ${SITE_URL}/sitemap.xml
`;

export function GET() {
  return new Response(BODY, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // /apply and /status are kept out of the index with noindex (a crawler must
    // be able to fetch a page to see that), so only the API and the share-link
    // redirector are blocked here.
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/s/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

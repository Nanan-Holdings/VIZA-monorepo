/**
 * Permanent redirects shared by next.config.ts and app/sitemap.ts. The sitemap leaves out any blog slug that
 * redirects, so it never lists a URL that answers 308.
 */
export interface SiteRedirect {
  source: string;
  destination: string;
  permanent: true;
}

export const REDIRECTS: SiteRedirect[] = [
  // The SG Arrival Card post (served from the portal CMS) folds into the guide.
  { source: "/blog/sg-arrival-card-myica-app-september-30", destination: "/arrival-cards/singapore-sg-arrival-card", permanent: true },
  { source: "/zh-CN/blog/sg-arrival-card-myica-app-september-30", destination: "/zh-CN/arrival-cards/singapore-sg-arrival-card", permanent: true },
];

/** True when a blog slug is the source of a redirect in any locale. */
export function isRedirectedBlogSlug(slug: string): boolean {
  return REDIRECTS.some((r) => r.source === `/blog/${slug}` || r.source === `/zh-CN/blog/${slug}`);
}

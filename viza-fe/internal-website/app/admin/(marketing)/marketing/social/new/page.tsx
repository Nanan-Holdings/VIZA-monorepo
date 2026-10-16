import { getLocale } from "next-intl/server";
import { getMarketingBlogPostAdmin, getMarketingOperationsDashboard, getMarketingSocialComposition } from "@/app/actions/admin-marketing";
import type { MarketingSocialCompositionRecord } from "@/lib/marketing/contracts";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { requireRole } from "@/lib/rbac";
import { MarketingBackLink } from "../../_components/marketing-ui";
import { PortalHeader, PortalPage } from "../../_components/portal-ui";
import { SocialEditor } from "../../_components/social-editor";
import { MARKETING_COPY } from "../../copy";

export const dynamic = "force-dynamic";

/* A short starts from the article's caption composition: same article, same
   tracked destination, and its Instagram and Facebook captions as a first
   draft for the video channels. Nothing is copied that the editor cannot
   change before saving. */
function shortTemplate(source: MarketingSocialCompositionRecord): Partial<MarketingSocialCompositionRecord> {
  const feed = source.platformContent.instagram ?? source.platformContent.facebook ?? source.platformContent.linkedin ?? "";
  return {
    blogPostId: source.blogPostId,
    shortLinkId: source.shortLinkId,
    title: source.title.replace(/^Promote:\s*/, "Short: "),
    brief: source.brief,
    destinationUrl: source.destinationUrl,
    platforms: ["tiktok", "instagram", "youtube"],
    platformContent: {
      tiktok: source.platformContent.instagram ?? feed,
      instagram: source.platformContent.instagram ?? feed,
      youtube: source.platformContent.facebook ?? feed,
    },
  };
}

export default async function NewMarketingSocialPage({ searchParams }: { searchParams: Promise<{ blogPostId?: string; format?: string; from?: string }> }) {
  const [localeValue, query, actor] = await Promise.all([getLocale(), searchParams, requireRole("admin", "staff")]);
  const locale = normalizeInterfaceLocale(localeValue);
  const copy = MARKETING_COPY[locale];
  const format = query.format === "video" ? "video" : "image";
  const source = query.from ? await getMarketingSocialComposition(query.from) : null;
  const blogPostId = query.blogPostId ?? source?.blogPostId ?? undefined;
  const [dashboard, sourceBlog] = await Promise.all([
    getMarketingOperationsDashboard(),
    blogPostId ? getMarketingBlogPostAdmin(blogPostId) : Promise.resolve(null),
  ]);
  const base = process.env.VIZA_MARKETING_PUBLIC_BASE_URL?.replace(/\/$/, "") ?? "https://viza.it.com";
  const sourceBlogUrl = sourceBlog
    ? `${base}${sourceBlog.locale === "en" ? "" : `/${sourceBlog.locale}`}/blog/${sourceBlog.slug}`
    : undefined;

  return (
    <PortalPage>
      <MarketingBackLink href="/admin/marketing/social" label={copy.back} />
      <PortalHeader title={format === "video" ? copy.newShort : copy.newSocial} desc={copy.socialDescription} />
      <SocialEditor
        locale={locale}
        connectedPlatforms={dashboard.providers.zernio.configuredPlatforms}
        openrouterConnected={dashboard.providers.openrouter.connected}
        canPublish={actor.role === "admin"}
        template={format === "video" && source ? shortTemplate(source) : undefined}
        sourceBlog={sourceBlog ?? undefined}
        sourceBlogUrl={sourceBlogUrl}
        format={format}
        videoVisibility={dashboard.providers.uploadPost.videoVisibility}
      />
    </PortalPage>
  );
}

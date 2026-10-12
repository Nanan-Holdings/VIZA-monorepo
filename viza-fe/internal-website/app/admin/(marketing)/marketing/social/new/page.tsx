import { getLocale } from "next-intl/server";
import { getMarketingBlogPostAdmin, getMarketingOperationsDashboard } from "@/app/actions/admin-marketing";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { requireRole } from "@/lib/rbac";
import { MarketingBackLink } from "../../_components/marketing-ui";
import { PortalHeader, PortalPage } from "../../_components/portal-ui";
import { SocialEditor } from "../../_components/social-editor";
import { MARKETING_COPY } from "../../copy";

export const dynamic = "force-dynamic";

export default async function NewMarketingSocialPage({ searchParams }: { searchParams: Promise<{ blogPostId?: string }> }) {
  const [localeValue, query, actor] = await Promise.all([getLocale(), searchParams, requireRole("admin", "staff")]);
  const locale = normalizeInterfaceLocale(localeValue);
  const copy = MARKETING_COPY[locale];
  const [dashboard, sourceBlog] = await Promise.all([
    getMarketingOperationsDashboard(),
    query.blogPostId ? getMarketingBlogPostAdmin(query.blogPostId) : Promise.resolve(null),
  ]);
  const base = process.env.VIZA_MARKETING_PUBLIC_BASE_URL?.replace(/\/$/, "") ?? "https://viza.it.com";
  const sourceBlogUrl = sourceBlog
    ? `${base}${sourceBlog.locale === "en" ? "" : `/${sourceBlog.locale}`}/blog/${sourceBlog.slug}`
    : undefined;

  return (
    <PortalPage>
      <MarketingBackLink href="/admin/marketing/social" label={copy.back} />
      <PortalHeader title={copy.newSocial} desc={copy.socialDescription} />
      <SocialEditor
        locale={locale}
        connectedPlatforms={dashboard.providers.zernio.configuredPlatforms}
        openrouterConnected={dashboard.providers.openrouter.connected}
        canPublish={actor.role === "admin"}
        sourceBlog={sourceBlog ?? undefined}
        sourceBlogUrl={sourceBlogUrl}
      />
    </PortalPage>
  );
}

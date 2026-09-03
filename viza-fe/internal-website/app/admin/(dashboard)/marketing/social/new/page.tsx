import { getLocale } from "next-intl/server";
import { getMarketingBlogPostAdmin, getMarketingOperationsDashboard } from "@/app/actions/admin-marketing";
import { AdminPage, AdminPageHeader } from "@/components/admin/admin-ui";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { MarketingBackLink } from "../../_components/marketing-ui";
import { SocialEditor } from "../../_components/social-editor";
import { MARKETING_COPY } from "../../copy";

export const dynamic = "force-dynamic";
export default async function NewMarketingSocialPage({ searchParams }: { searchParams: Promise<{ blogPostId?: string }> }) { const [localeValue, query] = await Promise.all([getLocale(), searchParams]); const locale = normalizeInterfaceLocale(localeValue); const copy = MARKETING_COPY[locale]; const [dashboard, sourceBlog] = await Promise.all([getMarketingOperationsDashboard(), query.blogPostId ? getMarketingBlogPostAdmin(query.blogPostId) : Promise.resolve(null)]); const base = process.env.VIZA_MARKETING_PUBLIC_BASE_URL?.replace(/\/$/, "") ?? "https://viza.it.com"; const sourceBlogUrl = sourceBlog ? `${base}${sourceBlog.locale === "en" ? "" : `/${sourceBlog.locale}`}/blog/${sourceBlog.slug}` : undefined; return <AdminPage><MarketingBackLink href="/admin/marketing/social" label={copy.back} /><AdminPageHeader title={copy.newSocial} description={copy.socialDescription} /><SocialEditor locale={locale} connectedPlatforms={dashboard.providers.zernio.configuredPlatforms} openrouterConnected={dashboard.providers.openrouter.connected} sourceBlog={sourceBlog ?? undefined} sourceBlogUrl={sourceBlogUrl} /></AdminPage>; }

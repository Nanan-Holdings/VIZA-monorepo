import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getMarketingBlogPostAdmin, getMarketingOperationsDashboard } from "@/app/actions/admin-marketing";
import { AdminPage, AdminPageHeader } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { BlogEditor } from "../../_components/blog-editor";
import { MarketingBackLink, MarketingStatusBadge } from "../../_components/marketing-ui";
import { MARKETING_COPY } from "../../copy";

export const dynamic = "force-dynamic";
export default async function EditMarketingBlogPage({ params }: { params: Promise<{ id: string }> }) { const [{ id }, localeValue] = await Promise.all([params, getLocale()]); const [post, dashboard] = await Promise.all([getMarketingBlogPostAdmin(id), getMarketingOperationsDashboard()]); if (!post) notFound(); const locale = normalizeInterfaceLocale(localeValue); const copy = MARKETING_COPY[locale]; return <AdminPage><MarketingBackLink href="/admin/marketing/blog" label={copy.back} /><AdminPageHeader title={<span className="flex flex-wrap items-center gap-2">{post.title}<MarketingStatusBadge status={post.status} copy={copy} /></span>} description={`${post.locale} · /${post.slug} · v${post.version}`} actions={<Button asChild variant="outline"><Link href={`/admin/marketing/social/new?blogPostId=${post.id}`}>{copy.createSocialFromBlog}</Link></Button>} /><BlogEditor locale={locale} post={post} openrouterConnected={dashboard.providers.openrouter.connected} /></AdminPage>; }

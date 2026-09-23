import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getMarketingBlogPostAdmin, getMarketingOperationsDashboard } from "@/app/actions/admin-marketing";
import { AdminPage, AdminPageHeader } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { requireRole } from "@/lib/rbac";
import { BlogEditor } from "../../_components/blog-editor";
import { MarketingBackLink, MarketingStatusBadge } from "../../_components/marketing-ui";
import { MARKETING_COPY } from "../../copy";

export const dynamic = "force-dynamic";
export default async function EditMarketingBlogPage({ params }: { params: Promise<{ id: string }> }) { const [{ id }, localeValue, actor] = await Promise.all([params, getLocale(), requireRole("admin", "staff")]); const [post, dashboard] = await Promise.all([getMarketingBlogPostAdmin(id), getMarketingOperationsDashboard()]); if (!post) notFound(); const locale = normalizeInterfaceLocale(localeValue); const copy = MARKETING_COPY[locale]; const canPublish = actor.role === "admin"; const publicUrl = new URL(`${post.locale === "zh-CN" ? "/zh-CN" : ""}/blog/${post.slug}`, process.env.VIZA_MARKETING_PUBLIC_BASE_URL ?? "https://viza.it.com").toString(); return <AdminPage><MarketingBackLink href="/admin/marketing/blog" label={copy.back} /><AdminPageHeader title={<span className="flex flex-wrap items-center gap-2">{post.title}<MarketingStatusBadge status={post.status} copy={copy} /></span>} description={`${post.locale} · /${post.slug} · v${post.version}`} actions={<Button asChild variant="outline"><Link href={`/admin/marketing/social/new?blogPostId=${post.id}`}>{copy.createSocialFromBlog}</Link></Button>} />{canPublish || post.status === "draft" ? <BlogEditor locale={locale} post={post} openrouterConnected={dashboard.providers.openrouter.connected} canPublish={canPublish} /> : <div className="rounded-lg border p-6 text-sm text-muted-foreground">{locale === "zh" ? "仅管理员可以编辑已发布或归档的文章。" : "Only admins can edit published or archived articles."} {post.status === "published" ? <a className="underline" href={publicUrl} target="_blank" rel="noopener noreferrer">{locale === "zh" ? "查看公开文章" : "View public article"}</a> : null}</div>}</AdminPage>; }
